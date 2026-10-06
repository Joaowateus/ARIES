import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import {
  ErroGraphApi,
  InsightsMidia,
  MetricasContaDia,
  MetricasRecusadas,
  MidiaInstagram,
  buscarContaInstagram,
  buscarContaInstagramPorId,
  comApiDaEmpresa,
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
import { baixarEGuardarImagem } from './armazenamento'

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

type ContaParaSync = {
  id: string; usuarioId: string; accessToken: string; tokenExpiraEm: Date
  tipoConexao: string; instagramUserId: string; nomeUsuario: string; falhasSeguidas: number
}

// MANUAL / CONEXAO: sincronização completa (botão ou conta recém-ligada).
// HORA: conta, stories e mídias dos últimos 7 dias (cron de hora em hora —
// stories só têm métricas enquanto estão no ar).
// DIA: insights das mídias de 7 a 90 dias (cron diário).
// RETENTATIVA: igual à HORA, disparada pelo backoff depois de uma falha.
export type ModoSync = 'MANUAL' | 'CONEXAO' | 'HORA' | 'DIA' | 'RETENTATIVA'

const DIAS_MIDIA_RECENTE = 7
const DIAS_MIDIA_DIARIA = 90
// Backoff da nova tentativa: 5 min, 10, 20, 40... até 6h.
const BACKOFF_BASE_MS = 5 * 60 * 1000
const BACKOFF_MAX_MS = 6 * 60 * 60 * 1000
export function proximaTentativa(falhasSeguidas: number, agora = Date.now()): Date {
  return new Date(agora + Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, falhasSeguidas - 1)))
}

export interface ResultadoSync {
  midiasListadas: number
  insightsAtualizados: number
  insightsPendentes: number
  miniaturasGuardadas?: number
  diasAtualizados: number
}

function mensagemAmigavel(e: unknown): string {
  if (erroDeTokenExpirado(e)) return 'A autorização do Instagram expirou ou foi revogada — desconecte e conecte a conta de novo.'
  if (e instanceof ErroGraphApi) return `O Instagram recusou a sincronização: ${e.message}`
  return e instanceof Error ? e.message : 'Falha desconhecida ao sincronizar com o Instagram'
}

// Toda sincronização fica registrada (SmSincronizacao). Na falha, a conta
// ganha uma nova tentativa com backoff e, se for a conta da empresa, o
// gestor e o Social Media recebem um aviso (agrupado: falhas seguidas do
// mesmo motivo atualizam o mesmo aviso). No sucesso, o aviso de falha
// pendente é dado como resolvido.
export async function sincronizarContaSocialMedia(conta: ContaParaSync, modo: ModoSync = 'MANUAL'): Promise<ResultadoSync> {
  const registro = await prisma.smSincronizacao.create({ data: { contaId: conta.id, job: modo } })
  try {
    const resultado = conta.tipoConexao === 'EMPRESA'
      ? await comApiDaEmpresa(() => executarSync(conta, modo))
      : await executarSync(conta, modo)
    const agora = new Date()
    await prisma.$transaction([
      prisma.socialMediaConta.update({ where: { id: conta.id }, data: { ultimaSincronizacaoEm: agora, ultimoErroSync: null, falhasSeguidas: 0, proximaTentativaEm: null } }),
      prisma.smSincronizacao.update({ where: { id: registro.id }, data: { status: 'SUCESSO', terminadoEm: agora, resumo: resultado as unknown as Prisma.InputJsonValue } }),
      prisma.smNotificacao.updateMany({ where: { chave: chaveFalha(conta.id), lidaEm: null }, data: { lidaEm: agora } }),
    ])
    return resultado
  } catch (e) {
    const mensagem = mensagemAmigavel(e)
    const falhas = conta.falhasSeguidas + 1
    const proxima = proximaTentativa(falhas)
    await prisma.$transaction([
      prisma.socialMediaConta.update({ where: { id: conta.id }, data: { ultimoErroSync: mensagem, falhasSeguidas: falhas, proximaTentativaEm: proxima } }),
      prisma.smSincronizacao.update({ where: { id: registro.id }, data: { status: 'ERRO', terminadoEm: new Date(), erro: mensagem } }),
    ]).catch(() => {})
    if (conta.tipoConexao === 'EMPRESA') await avisarFalha(conta, mensagem, proxima).catch(() => {})
    throw new Error(mensagem)
  }
}

// Jobs do cron (seção 3.2 da especificação):
// - HORA: toda conta que não está esperando uma nova tentativa;
// - DIA: mídias de 7 a 90 dias, idem;
// - RETENTATIVA: só as contas cuja nova tentativa já venceu.
// As contas rodam em paralelo; cada uma tem o próprio prazo dentro dos 30s.
export async function rodarJobSocialMedia(job: 'HORA' | 'DIA' | 'RETENTATIVA') {
  const agora = new Date()
  const contas = await prisma.socialMediaConta.findMany({
    where: job === 'RETENTATIVA'
      ? { falhasSeguidas: { gt: 0 }, proximaTentativaEm: { lte: agora } }
      : { OR: [{ proximaTentativaEm: null }, { proximaTentativaEm: { lte: agora } }] },
  })
  const resultados = await Promise.allSettled(contas.map(c => sincronizarContaSocialMedia(c, job)))
  return {
    job,
    total: contas.length,
    sucesso: resultados.filter(r => r.status === 'fulfilled').length,
    falhas: resultados.filter(r => r.status === 'rejected').length,
  }
}

const chaveFalha = (contaId: string) => `sync-falha:${contaId}`

// Um aviso por destinatário; falhas seguidas atualizam o mesmo aviso.
async function avisarFalha(conta: ContaParaSync, mensagem: string, proxima: Date) {
  const hora = proxima.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Belem' })
  const titulo = `Falha na sincronização do @${conta.nomeUsuario}`
  const texto = `${mensagem} Nova tentativa automática às ${hora}.`
  for (const destinatario of ['GESTOR', 'SOCIAL_MEDIA'] as const) {
    const aberta = await prisma.smNotificacao.findFirst({ where: { usuarioId: conta.usuarioId, destinatario, chave: chaveFalha(conta.id), lidaEm: null } })
    if (aberta) {
      await prisma.smNotificacao.update({ where: { id: aberta.id }, data: { texto, ocorrencias: { increment: 1 } } })
    } else {
      await prisma.smNotificacao.create({
        data: { usuarioId: conta.usuarioId, destinatario, tipo: 'SYNC_FALHA', chave: chaveFalha(conta.id), titulo, texto, payload: { contaId: conta.id } },
      })
    }
  }
}

async function executarSync(conta: ContaParaSync, modo: ModoSync): Promise<ResultadoSync> {
  const empresa = conta.tipoConexao === 'EMPRESA'
  const prazo = Date.now() + PRAZO_BUSCA_MS
  // Login do Instagram: `me` resolve pro ID profissional do próprio dono do
  // token — evita depender de qual dos dois IDs da conta (app-scoped x
  // profissional) foi gravado na conexão. Conta da empresa (Graph do
  // Facebook): o token é do usuário do sistema, então vai o ID da conta.
  const ig = empresa ? conta.instagramUserId : 'me'
  const recusadas: MetricasRecusadas = new Set()

  let accessToken = conta.accessToken
  // Token do usuário do sistema não expira (ou é trocado à mão pelo gestor);
  // o renovável é o do login do Instagram.
  const diasParaExpirar = (conta.tokenExpiraEm.getTime() - Date.now()) / DIA_MS
  if (!empresa && diasParaExpirar < 10) {
    const renovado = await renovarTokenLongo(accessToken)
    accessToken = renovado.accessToken
    await prisma.socialMediaConta.update({ where: { id: conta.id }, data: { accessToken: renovado.accessToken, tokenExpiraEm: renovado.expiraEm } })
  }

  const infoConta = empresa ? await buscarContaInstagramPorId(ig, accessToken) : await buscarContaInstagram(accessToken)

  const hoje = diaBrasilia(new Date())
  const [existentesMidia, snapshotsRecentes] = await Promise.all([
    prisma.socialMediaMidia.findMany({ where: { contaId: conta.id } }),
    prisma.socialMediaSnapshotDiario.findMany({ where: { contaId: conta.id, data: { gte: new Date(hoje.getTime() - DIAS_BACKFILL * DIA_MS) } } }),
  ])
  // Backfill quando os últimos 30 dias ainda não têm as métricas diárias
  // completas (conta recém-conectada, ou snapshots do formato antigo, que
  // só guardavam alcance e visitas) — senão, só os últimos dias, que ainda
  // podem mudar enquanto a Meta termina de contabilizar.
  // Fora isso, busca também qualquer dia da janela que ficou sem snapshot
  // (sincronização parada por alguns dias): sem isso, a pausa virava um
  // buraco permanente no histórico, sem aviso nenhum.
  const diasComMetricas = snapshotsRecentes.filter(s => s.visualizacoesDia > 0 || s.interacoesDia > 0 || s.alcanceContaDia > 0).length
  const janela = Array.from({ length: DIAS_BACKFILL }, (_, i) => new Date(hoje.getTime() - (DIAS_BACKFILL - 1 - i) * DIA_MS))
  const comSnapshot = new Set(snapshotsRecentes.filter(s => s.sincronizado).map(s => s.data.getTime()))
  const dias = diasComMetricas >= DIAS_BACKFILL - 10
    ? janela.filter((d, i) => i >= DIAS_BACKFILL - DIAS_INCREMENTAL || !comSnapshot.has(d.getTime()))
    : janela

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
  // Modo HORA (e retentativa): só stories, mídias sem insight e as dos
  // últimos 7 dias. Modo DIA: as de 7 a 90 dias, as mais desatualizadas
  // primeiro. MANUAL/CONEXAO: tudo, na ordem acima.
  const idade = (m: MidiaInstagram) => agora - m.publicadoEm.getTime()
  const prioridade = (m: MidiaInstagram): number => {
    const existente = existentePorId.get(m.instagramMediaId)
    if (modo === 'DIA') {
      if (m.formato === 'STORY' || idade(m) < DIAS_MIDIA_RECENTE * DIA_MS || idade(m) > DIAS_MIDIA_DIARIA * DIA_MS) return -1
      return existente?.insightsAtualizadoEm ? 1 : 0
    }
    if (!existente?.insightsAtualizadoEm) return 0
    if (m.formato === 'STORY') return 1
    if (modo === 'HORA' || modo === 'RETENTATIVA') return idade(m) < DIAS_MIDIA_RECENTE * DIA_MS ? 2 : -1
    if (idade(m) < DIAS_POST_RECENTE * DIA_MS) return 2
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
      // A cópia própria da miniatura não depende da URL da CDN, que muda a
      // cada listagem: continua a mesma.
      miniaturaLocal: antigo?.miniaturaLocal ?? null,
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
  const miniaturasGuardadas = await guardarMiniaturas(conta, midias, prazo + 6000)
  return {
    midiasListadas: midias.length,
    insightsAtualizados: insights.size,
    insightsPendentes: pendentes,
    diasAtualizados: linhasSnapshot.length,
    miniaturasGuardadas,
  }
}

// Guarda uma cópia própria das miniaturas que ainda não têm (seção 17.8):
// só das mídias desta listagem, cujas URLs da CDN ainda valem. Stories
// primeiro (somem em 24h), depois as mais recentes. Para no prazo e
// continua na próxima rodada.
async function guardarMiniaturas(conta: ContaParaSync, midias: MidiaInstagram[], prazo: number): Promise<number> {
  const listadas = new Map(midias.map(m => [m.instagramMediaId, m]))
  const semCopia = await prisma.socialMediaMidia.findMany({
    where: { contaId: conta.id, miniaturaLocal: null, instagramMediaId: { in: [...listadas.keys()] } },
    select: { id: true, instagramMediaId: true },
  })
  const fila = semCopia
    .map(r => ({ ...r, m: listadas.get(r.instagramMediaId)! }))
    .map(r => ({ ...r, url: r.m.thumbnailUrl ?? (r.m.tipo !== 'VIDEO' ? r.m.urlMidia : undefined) }))
    .filter((r): r is typeof r & { url: string } => !!r.url)
    .sort((a, b) => Number(b.m.formato === 'STORY') - Number(a.m.formato === 'STORY') || b.m.publicadoEm.getTime() - a.m.publicadoEm.getTime())
  let guardadas = 0
  for (let i = 0; i < fila.length && Date.now() < prazo; i += 8) {
    const lote = fila.slice(i, i + 8)
    const caminhos = await Promise.all(lote.map(r => baixarEGuardarImagem(conta.usuarioId, r.url)))
    await Promise.all(lote.map((r, k) => caminhos[k]
      ? prisma.socialMediaMidia.update({ where: { id: r.id }, data: { miniaturaLocal: caminhos[k] } }).then(() => { guardadas++ })
      : Promise.resolve()))
  }
  return guardadas
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
