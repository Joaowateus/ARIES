import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import {
  ErroGraphApi,
  InsightsMidia,
  MetricasContaDia,
  MetricasRecusadas,
  MidiaInstagram,
  buscarContaInstagram,
  buscarDemografia,
  buscarDistribuicaoAlcance,
  buscarInsightsMidia,
  buscarMetricasContaDia,
  buscarMidias,
  buscarNovosSeguidoresPorDia,
  buscarSeguidoresOnlinePorHora,
  buscarStoriesAtivos,
  emLotes,
  erroDeTokenExpirado,
  renovarTokenLongo,
} from './instagramGraph'

const DIA_MS = 24 * 60 * 60 * 1000
// Fuso fixo de Brasília (UTC-3, sem horário de verão desde 2019) — mesma
// convenção do resto do app (ver horaBrasilia em routes/proLabore.ts): um
// "dia" do Social Media é o dia do calendário brasileiro, não o dia UTC.
const OFFSET_BRASILIA_MS = 3 * 60 * 60 * 1000

// A função serverless tem 30s no total (vercel.json). O sync para de buscar
// insight de posts quando chega nesse prazo e deixa o restante pro próximo
// sync — melhor salvar 80% agora do que estourar o tempo e salvar nada.
const PRAZO_BUSCA_MS = 20_000
const MAX_MIDIAS = 150
const DIAS_BACKFILL = 30
const DIAS_INCREMENTAL = 3
// Insight de post continua mudando por semanas depois de publicado (reels
// principalmente); depois disso, atualizar 1x por semana basta.
const DIAS_POST_RECENTE = 45
const DIAS_REVALIDAR_POST_ANTIGO = 7

// Chave do dia (meia-noite UTC que representa a data do calendário de
// Brasília) em que um instante cai.
export function diaBrasilia(instante: Date): Date {
  const local = new Date(instante.getTime() - OFFSET_BRASILIA_MS)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()))
}

// Instante em que um dia (chave de diaBrasilia) começa de fato.
export function inicioDoDiaBrasilia(dia: Date): Date {
  return new Date(dia.getTime() + OFFSET_BRASILIA_MS)
}

type ContaParaSync = { id: string; accessToken: string; tokenExpiraEm: Date }

export interface ResultadoSync {
  midiasListadas: number
  insightsAtualizados: number
  insightsPendentes: number
  diasAtualizados: number
}

function mensagemAmigavel(e: unknown): string {
  if (erroDeTokenExpirado(e)) return 'A autorização do Instagram expirou ou foi revogada — desconecte e conecte a conta de novo.'
  if (e instanceof ErroGraphApi) return `O Instagram recusou a sincronização: ${e.message}`
  return e instanceof Error ? e.message : 'Falha desconhecida ao sincronizar com o Instagram'
}

export async function sincronizarContaSocialMedia(conta: ContaParaSync): Promise<ResultadoSync> {
  try {
    const resultado = await executarSync(conta)
    await prisma.socialMediaConta.update({ where: { id: conta.id }, data: { ultimaSincronizacaoEm: new Date(), ultimoErroSync: null } })
    return resultado
  } catch (e) {
    await prisma.socialMediaConta.update({ where: { id: conta.id }, data: { ultimoErroSync: mensagemAmigavel(e) } }).catch(() => {})
    throw new Error(mensagemAmigavel(e))
  }
}

async function executarSync(conta: ContaParaSync): Promise<ResultadoSync> {
  const prazo = Date.now() + PRAZO_BUSCA_MS
  // `me` resolve pro ID profissional do próprio dono do token — evita
  // depender de qual dos dois IDs da conta (app-scoped x profissional) foi
  // gravado no momento da conexão.
  const ig = 'me'
  const recusadas: MetricasRecusadas = new Set()

  let accessToken = conta.accessToken
  const diasParaExpirar = (conta.tokenExpiraEm.getTime() - Date.now()) / DIA_MS
  if (diasParaExpirar < 10) {
    const renovado = await renovarTokenLongo(accessToken)
    accessToken = renovado.accessToken
    await prisma.socialMediaConta.update({ where: { id: conta.id }, data: { accessToken: renovado.accessToken, tokenExpiraEm: renovado.expiraEm } })
  }

  const infoConta = await buscarContaInstagram(accessToken)

  const hoje = diaBrasilia(new Date())
  const [existentesMidia, snapshotsRecentes] = await Promise.all([
    prisma.socialMediaMidia.findMany({ where: { contaId: conta.id } }),
    prisma.socialMediaSnapshotDiario.findMany({ where: { contaId: conta.id, data: { gte: new Date(hoje.getTime() - DIAS_BACKFILL * DIA_MS) } } }),
  ])
  // Backfill quando os últimos 30 dias ainda não têm as métricas diárias
  // completas (conta recém-conectada, ou snapshots do formato antigo, que
  // só guardavam alcance e visitas) — senão, só os últimos dias, que ainda
  // podem mudar enquanto a Meta termina de contabilizar.
  const diasComMetricas = snapshotsRecentes.filter(s => s.visualizacoesDia > 0 || s.interacoesDia > 0 || s.alcanceContaDia > 0).length
  const diasParaBuscar = diasComMetricas >= DIAS_BACKFILL - 10 ? DIAS_INCREMENTAL : DIAS_BACKFILL
  const dias = Array.from({ length: diasParaBuscar }, (_, i) => new Date(hoje.getTime() - (diasParaBuscar - 1 - i) * DIA_MS))

  const [midiasFeed, stories, demografia, seguidoresOnline, distribuicaoAlcance, metricasDias, novosSeguidores] = await Promise.all([
    buscarMidias(ig, accessToken, MAX_MIDIAS),
    buscarStoriesAtivos(ig, accessToken).catch(e => { if (erroDeTokenExpirado(e)) throw e; return [] as MidiaInstagram[] }),
    buscarDemografia(ig, accessToken, recusadas),
    buscarSeguidoresOnlinePorHora(ig, accessToken),
    buscarDistribuicaoAlcance(ig, accessToken, 30, recusadas),
    // Falha pontual num dia não derruba o sync: o dia fica de fora desta
    // rodada (sem sobrescrever o que já estava gravado) e volta na próxima.
    emLotes(dias, 6, dia => buscarMetricasContaDia(ig, accessToken, inicioDoDiaBrasilia(dia), recusadas)
      .then((m): MetricasContaDia | null => ({ ...m, data: dia }))
      .catch(e => { if (erroDeTokenExpirado(e)) throw e; return null })),
    buscarNovosSeguidoresPorDia(ig, accessToken, inicioDoDiaBrasilia(dias[0]), inicioDoDiaBrasilia(new Date(hoje.getTime() + DIA_MS))),
  ])

  const midias = [...midiasFeed, ...stories]
  const existentePorId = new Map(existentesMidia.map(m => [m.instagramMediaId, m]))

  // Ordem de prioridade: posts que nunca tiveram insight, depois stories
  // (somem em 24h), depois recentes, depois os antigos vencidos.
  const agora = Date.now()
  const prioridade = (m: MidiaInstagram): number => {
    const existente = existentePorId.get(m.instagramMediaId)
    if (!existente?.insightsAtualizadoEm) return 0
    if (m.formato === 'STORY') return 1
    if (agora - m.publicadoEm.getTime() < DIAS_POST_RECENTE * DIA_MS) return 2
    if (agora - existente.insightsAtualizadoEm.getTime() > DIAS_REVALIDAR_POST_ANTIGO * DIA_MS) return 3
    return -1
  }
  const candidatas = midias
    .map(m => ({ m, p: prioridade(m) }))
    .filter(x => x.p >= 0)
    .sort((a, b) => a.p - b.p || b.m.publicadoEm.getTime() - a.m.publicadoEm.getTime())
    .map(x => x.m)

  const insights = new Map<string, InsightsMidia>()
  for (let i = 0; i < candidatas.length && Date.now() < prazo; i += 10) {
    const lote = candidatas.slice(i, i + 10)
    const resultados = await Promise.all(lote.map(m => buscarInsightsMidia(m.instagramMediaId, m.formato, accessToken, recusadas)))
    lote.forEach((m, idx) => insights.set(m.instagramMediaId, resultados[idx]))
  }

  const agoraData = new Date()
  const linhasMidia: Prisma.SocialMediaMidiaCreateManyInput[] = midias.map(m => {
    const antigo = existentePorId.get(m.instagramMediaId)
    const novo = insights.get(m.instagramMediaId)
    const base = {
      contaId: conta.id,
      instagramMediaId: m.instagramMediaId,
      tipo: m.tipo,
      formato: m.formato,
      legenda: m.legenda ?? null,
      urlMidia: m.urlMidia ?? null,
      thumbnailUrl: m.thumbnailUrl ?? null,
      urlPermalink: m.urlPermalink ?? null,
      publicadoEm: m.publicadoEm,
      // Stories não têm like_count/comments_count na listagem — o valor
      // vem do insight, quando existe.
      curtidas: novo?.curtidas ?? (m.formato === 'STORY' ? antigo?.curtidas ?? 0 : m.curtidas),
      comentarios: novo?.comentarios ?? (m.formato === 'STORY' ? antigo?.comentarios ?? 0 : m.comentarios),
      impressoes: antigo?.impressoes ?? 0,
    }
    if (novo) {
      return {
        ...base,
        alcance: novo.alcance,
        visualizacoes: novo.visualizacoes,
        salvamentos: novo.salvamentos,
        compartilhamentos: novo.compartilhamentos,
        interacoesTotais: novo.interacoesTotais,
        visitasPerfil: novo.visitasPerfil,
        seguidoresGerados: novo.seguidoresGerados,
        respostas: novo.respostas,
        tempoMedioAssistidoSeg: novo.tempoMedioAssistidoSeg,
        tempoTotalAssistidoSeg: novo.tempoTotalAssistidoSeg,
        navegacaoStory: novo.navegacaoStory ?? Prisma.DbNull,
        insightsAtualizadoEm: agoraData,
      }
    }
    return {
      ...base,
      alcance: antigo?.alcance ?? 0,
      visualizacoes: antigo?.visualizacoes ?? 0,
      salvamentos: antigo?.salvamentos ?? 0,
      compartilhamentos: antigo?.compartilhamentos ?? 0,
      interacoesTotais: antigo?.interacoesTotais ?? 0,
      visitasPerfil: antigo?.visitasPerfil ?? 0,
      seguidoresGerados: antigo?.seguidoresGerados ?? 0,
      respostas: antigo?.respostas ?? 0,
      tempoMedioAssistidoSeg: antigo?.tempoMedioAssistidoSeg ?? null,
      tempoTotalAssistidoSeg: antigo?.tempoTotalAssistidoSeg ?? null,
      navegacaoStory: (antigo?.navegacaoStory ?? Prisma.DbNull) as Prisma.InputJsonValue,
      insightsAtualizadoEm: antigo?.insightsAtualizadoEm ?? null,
    }
  })

  const metricasOk = metricasDias.filter((m): m is MetricasContaDia => m != null)
  const linhasSnapshot = montarSnapshots(conta.id, metricasOk.map(m => m.data), metricasOk, novosSeguidores, snapshotsRecentes, midias, hoje, infoConta.seguidores)

  // Troca "apaga e recria" em vez de um upsert por linha: o banco fica em
  // outra região da função serverless (~120ms por ida e volta), e 150
  // upserts em série levariam mais tempo que o sync inteiro. Stories que já
  // saíram do ar não aparecem em `midias`, então não são apagadas.
  await prisma.$transaction([
    prisma.socialMediaMidia.deleteMany({ where: { contaId: conta.id, instagramMediaId: { in: midias.map(m => m.instagramMediaId) } } }),
    prisma.socialMediaMidia.createMany({ data: linhasMidia, skipDuplicates: true }),
    prisma.socialMediaSnapshotDiario.deleteMany({ where: { contaId: conta.id, data: { in: linhasSnapshot.map(s => s.data as Date) } } }),
    prisma.socialMediaSnapshotDiario.createMany({ data: linhasSnapshot, skipDuplicates: true }),
    prisma.socialMediaConta.update({
      where: { id: conta.id },
      data: {
        instagramUserId: infoConta.instagramUserId,
        nomeUsuario: infoConta.nomeUsuario,
        nomeExibicao: infoConta.nomeExibicao ?? null,
        fotoUrl: infoConta.fotoUrl ?? null,
        biografia: infoConta.biografia ?? null,
        site: infoConta.site ?? null,
        tipoConta: infoConta.tipoConta ?? null,
        seguidores: infoConta.seguidores,
        seguindo: infoConta.seguindo,
        publicacoesTotal: infoConta.publicacoesTotal,
        // Mantém o último retrato bom quando a API não devolve nada dessa
        // vez (falha pontual), em vez de apagar o que a tela já mostrava.
        ...(demografia.seguidores || demografia.engajados ? { demografia: { ...demografia, atualizadoEm: agoraData.toISOString() } as unknown as Prisma.InputJsonValue } : {}),
        ...(seguidoresOnline ? { seguidoresOnline } : {}),
        ...(distribuicaoAlcance ? { distribuicaoAlcance: { ...distribuicaoAlcance, atualizadoEm: agoraData.toISOString() } as unknown as Prisma.InputJsonValue } : {}),
      },
    }),
  ])

  const pendentes = candidatas.filter(m => !insights.has(m.instagramMediaId)).length
  return {
    midiasListadas: midias.length,
    insightsAtualizados: insights.size,
    insightsPendentes: pendentes,
    diasAtualizados: linhasSnapshot.length,
  }
}

function montarSnapshots(
  contaId: string,
  dias: Date[],
  metricasDias: MetricasContaDia[],
  novosSeguidores: Map<number, number>,
  existentes: Array<{ data: Date; seguidores: number | null }>,
  midias: MidiaInstagram[],
  hoje: Date,
  seguidoresAgora: number,
): Prisma.SocialMediaSnapshotDiarioCreateManyInput[] {
  const existentePorDia = new Map(existentes.map(s => [s.data.getTime(), s]))
  const publicacoesPorDia = new Map<number, number>()
  for (const m of midias) {
    if (m.formato === 'STORY') continue
    const chave = diaBrasilia(m.publicadoEm).getTime()
    publicacoesPorDia.set(chave, (publicacoesPorDia.get(chave) ?? 0) + 1)
  }
  const metricaPorDia = new Map(metricasDias.map(m => [m.data.getTime(), m]))

  // Total do dia anterior mais recente com `seguidores` gravado — base pro
  // saldo de hoje quando a API não devolve ganhos/perdas.
  const anteriorComTotal = [...existentes]
    .filter(s => s.data.getTime() < hoje.getTime() && s.seguidores != null)
    .sort((a, b) => b.data.getTime() - a.data.getTime())[0]

  return dias.map(dia => {
    const chave = dia.getTime()
    const m = metricaPorDia.get(chave)
    const ehHoje = chave === hoje.getTime()
    const ganhos = m?.seguidoresGanhos ?? novosSeguidores.get(chave) ?? 0
    const perdidos = m?.seguidoresPerdidos ?? 0
    let saldo = m?.seguidoresGanhos != null && m.seguidoresPerdidos != null ? ganhos - perdidos : ganhos
    if (ehHoje && m?.seguidoresGanhos == null && anteriorComTotal?.seguidores != null) {
      saldo = seguidoresAgora - anteriorComTotal.seguidores
    }
    return {
      contaId,
      data: dia,
      seguidores: ehHoje ? seguidoresAgora : existentePorDia.get(chave)?.seguidores ?? null,
      novosSeguidoresDia: saldo,
      seguidoresGanhosDia: ganhos,
      seguidoresPerdidosDia: perdidos,
      alcanceContaDia: m?.alcance ?? 0,
      visualizacoesDia: m?.visualizacoes ?? 0,
      contasEngajadasDia: m?.contasEngajadas ?? 0,
      interacoesDia: m?.interacoes ?? 0,
      curtidasDia: m?.curtidas ?? 0,
      comentariosDia: m?.comentarios ?? 0,
      compartilhamentosDia: m?.compartilhamentos ?? 0,
      salvamentosDia: m?.salvamentos ?? 0,
      respostasDia: m?.respostas ?? 0,
      visitasPerfilDia: m?.visitasPerfil ?? 0,
      toquesLinksDia: m?.toquesLinks ?? 0,
      cliquesSiteDia: m?.cliquesSite ?? 0,
      publicacoesNoDia: publicacoesPorDia.get(chave) ?? 0,
    }
  })
}
