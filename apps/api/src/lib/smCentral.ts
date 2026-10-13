// Central Estratégica de Conteúdo: dossiê vigente, geração e versões do
// ciclo mensal, status de cada vídeo (próprio até ir para a Produção; depois
// segue a pauta), métricas reais do post, painel, fechamento do mês e a
// geração automática do mês novo. Nada é apagado: gerar de novo arquiva a
// versão anterior; fechar guarda o relatório junto do ciclo.
import { Prisma, type SmVideo } from '@prisma/client'
import { prisma } from './prisma'
import { DOSSIE_PADRAO, lerDossie, type Dossie } from './smCentralDossie'
import {
  DIAS_META, ETAPA_DO_PERIODO, HORARIOS_PADRAO, checklistDoCiclo, diasDeProducao, gerarCalendario, repetidos, type Periodo, type StatusVideo,
} from './smCentralModelos'
import { gerarCodigo, notificar } from './smPautas'

const OFFSET_MS = 3 * 3600e3

export const mesDe = (d: Date) => new Date(d.getTime() - OFFSET_MS).toISOString().slice(0, 7)
export const hojeBelem = (d = new Date()) => new Date(d.getTime() - OFFSET_MS).toISOString().slice(0, 10)
export const proximoMes = (mes: string) => { const [a, m] = mes.split('-').map(Number); return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}` }
export const mesAnterior = (mes: string) => { const [a, m] = mes.split('-').map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}` }
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const nomeMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`

// ---------- Dossiê ----------

export async function dossieVigente(usuarioId: string) {
  const v = await prisma.smDossie.findFirst({ where: { usuarioId, status: 'VIGENTE' }, orderBy: { versao: 'desc' } })
  if (v) return { ...v, dossie: lerDossie(v.conteudo) }
  const criado = await prisma.smDossie.upsert({
    where: { usuarioId_versao: { usuarioId, versao: 1 } },
    create: { usuarioId, versao: 1, status: 'VIGENTE', conteudo: DOSSIE_PADRAO as unknown as Prisma.InputJsonValue, criadoPor: 'SISTEMA', nota: 'Versão inicial a partir do prompt mestre da Central.' },
    update: {},
  })
  return { ...criado, dossie: lerDossie(criado.conteudo) }
}

export async function proximaVersaoDossie(usuarioId: string): Promise<number> {
  const u = await prisma.smDossie.findFirst({ where: { usuarioId }, orderBy: { versao: 'desc' }, select: { versao: true } })
  return (u?.versao ?? 0) + 1
}

// ---------- Ciclo ----------

export interface Consideracoes { temasContinuar: string[]; temasMudar: string[]; perguntas: number; aprendizados: string[]; deCiclo: string | null }

/** O que o fechamento do mês anterior deixou para o novo calendário. */
async function consideracoesDoAnterior(usuarioId: string, mes: string): Promise<Consideracoes> {
  const anterior = await prisma.smCiclo.findFirst({ where: { usuarioId, mes: mesAnterior(mes), status: { in: ['FECHADO', 'APROVADO', 'RASCUNHO'] } }, orderBy: { versao: 'desc' }, select: { id: true, relatorio: true } })
  const rel = (anterior?.relatorio ?? null) as null | { temasContinuar?: Array<{ tema: string }>; temasMudar?: Array<{ tema: string }> }
  const aprendizados = await prisma.smCentralItem.findMany({ where: { usuarioId, tipo: 'APRENDIZADO' }, orderBy: { criadoEm: 'desc' }, take: 8, select: { texto: true } })
  return {
    temasContinuar: rel?.temasContinuar?.map(t => t.tema) ?? [],
    temasMudar: rel?.temasMudar?.map(t => t.tema) ?? [],
    perguntas: await prisma.smCentralItem.count({ where: { usuarioId, tipo: 'PERGUNTA', usadoEm: null } }),
    aprendizados: aprendizados.map(a => a.texto),
    deCiclo: anterior?.id ?? null,
  }
}

/**
 * Gera o calendário do mês (ou uma nova versão dele). A versão anterior do
 * mesmo mês fica ARQUIVADA, com tudo dentro; um mês FECHADO não é regerado.
 */
export async function criarCiclo(usuarioId: string, mes: string, o: { dias?: string[]; origem: 'MANUAL' | 'AUTOMATICO'; geradoPor: string }) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new ErroCentral(400, 'Mês inválido (use AAAA-MM)')
  const fechado = await prisma.smCiclo.findFirst({ where: { usuarioId, mes, status: 'FECHADO' }, select: { id: true } })
  if (fechado) throw new ErroCentral(409, `O ciclo de ${nomeMes(mes)} já foi fechado: o histórico não é regerado.`)
  const dias = (o.dias?.length ? [...new Set(o.dias)].sort() : diasDeProducao(mes))
  if (dias.length < 1 || dias.length > 31 || dias.some(d => !d.startsWith(mes))) throw new ErroCentral(400, 'Os dias de produção precisam ser do mês do ciclo')
  const dos = await dossieVigente(usuarioId)
  const consideracoes = await consideracoesDoAnterior(usuarioId, mes)
  const perguntas = await prisma.smCentralItem.findMany({ where: { usuarioId, tipo: 'PERGUNTA', usadoEm: null }, orderBy: [{ ocorrencias: 'desc' }, { criadoEm: 'asc' }], take: dias.length, select: { id: true, texto: true } })
  const videos = gerarCalendario({ mes, dias, dossie: dos.dossie, perguntasReais: perguntas })
  const ultima = await prisma.smCiclo.findFirst({ where: { usuarioId, mes }, orderBy: { versao: 'desc' }, select: { versao: true } })
  return prisma.$transaction(async tx => {
    await tx.smCiclo.updateMany({ where: { usuarioId, mes, status: { in: ['RASCUNHO', 'APROVADO'] } }, data: { status: 'ARQUIVADO' } })
    const ciclo = await tx.smCiclo.create({
      data: {
        usuarioId, mes, versao: (ultima?.versao ?? 0) + 1, dossieId: dos.id, dias, horarios: HORARIOS_PADRAO as unknown as Prisma.InputJsonValue,
        origem: o.origem, geradoPor: o.geradoPor, consideracoes: consideracoes as unknown as Prisma.InputJsonValue,
      },
    })
    await tx.smVideo.createMany({
      data: videos.map(v => ({
        cicloId: ciclo.id, codigo: v.codigo, semana: v.semana, diaCiclo: v.diaCiclo, data: v.data, horario: v.horario, periodo: v.periodo, ordem: v.ordem, etapa: v.etapa,
        tema: v.tema, temaChave: v.temaChave, pilar: v.pilar, formato: v.formato, alvoTipo: v.alvoTipo, alvo: v.alvo, lente: v.lente, lenteMotivo: v.lenteMotivo, persona: v.persona,
        objetivo: v.objetivo, titulo: v.roteiro.titulo, gancho: v.roteiro.gancho, contexto: v.roteiro.contexto, desenvolvimento: v.roteiro.desenvolvimento, valor: v.roteiro.valor,
        cta: v.roteiro.cta, gravacao: v.roteiro.gravacao, cenas: v.roteiro.cenas, textosTela: v.roteiro.textosTela, duracaoSeg: v.roteiro.duracaoSeg, legenda: v.roteiro.legenda,
        provaNecessaria: v.roteiro.provaNecessaria, pendenteConfirmacao: v.roteiro.pendenteConfirmacao, status: 'PLANEJADO', roteiroOrigem: 'MODELO',
      })),
    })
    // Pergunta real que virou vídeo: fica marcada para não ser usada de novo.
    const comPergunta = videos.filter(v => v.perguntaId)
    if (comPergunta.length) {
      const criados = await tx.smVideo.findMany({ where: { cicloId: ciclo.id, codigo: { in: comPergunta.map(v => v.codigo) } }, select: { id: true, codigo: true } })
      const porCodigo = new Map(criados.map(c => [c.codigo, c.id]))
      for (const v of comPergunta) await tx.smCentralItem.update({ where: { id: v.perguntaId! }, data: { usadoEm: porCodigo.get(v.codigo) ?? null } })
    }
    return ciclo
  }, { timeout: 20_000 })
}

export class ErroCentral extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

/** Ajustar os dias de produção sem mudar a quantidade: cada dia do ciclo vai para a nova data. */
export async function ajustarDias(cicloId: string, dias: string[]) {
  const ciclo = await prisma.smCiclo.findUniqueOrThrow({ where: { id: cicloId } })
  const atuais = ciclo.dias as string[]
  const novos = [...new Set(dias)].sort()
  if (novos.length !== atuais.length) throw new ErroCentral(409, `O ciclo tem ${atuais.length} dias de produção. Para mudar a quantidade (a meta-base é ${DIAS_META} dias e 180 vídeos), gere uma nova versão do mês com os dias desejados.`)
  if (novos.some(d => !d.startsWith(ciclo.mes))) throw new ErroCentral(400, 'Os dias de produção precisam ser do mês do ciclo')
  await prisma.$transaction([
    ...novos.map((d, i) => prisma.smVideo.updateMany({ where: { cicloId, diaCiclo: i + 1, pautaId: null }, data: { data: d } })),
    prisma.smCiclo.update({ where: { id: cicloId }, data: { dias: novos } }),
  ])
}

// ---------- Status ----------

const DA_PAUTA: Record<string, StatusVideo> = {
  IDEIA: 'PRONTO_GRAVAR', ROTEIRO: 'PRONTO_GRAVAR', GRAVACAO: 'PRONTO_GRAVAR', EDICAO: 'EM_EDICAO', APROVACAO: 'PRONTO_PUBLICAR', AGENDADO: 'AGENDADO', PUBLICADO: 'PUBLICADO',
}

/** Status de verdade: na Produção, quem manda é a pauta (o vídeo não "avança" sozinho). */
export function statusEfetivo(v: { status: string; pautaId: string | null }, pauta?: { status: string } | null): string {
  if (v.status === 'ANALISADO') return 'ANALISADO'
  if (v.pautaId && pauta) {
    const s = DA_PAUTA[pauta.status] ?? v.status
    // Gravado à mão no vídeo (antes da pauta andar) continua valendo.
    if (s === 'PRONTO_GRAVAR' && v.status === 'GRAVADO') return 'GRAVADO'
    return s
  }
  return v.status
}

/** Etapas detalhadas pedidas no prompt (roteiro, gravação, edição, aprovação, publicação). */
export function etapasDoVideo(status: string, roteiroOrigem: string) {
  const ordem = ['PLANEJADO', 'ROTEIRIZADO', 'AGUARDANDO_APROVACAO', 'APROVADO', 'PRONTO_GRAVAR', 'GRAVADO', 'EM_EDICAO', 'PRONTO_PUBLICAR', 'AGENDADO', 'PUBLICADO', 'ANALISADO']
  const i = ordem.indexOf(status)
  const passou = (s: string) => i >= ordem.indexOf(s)
  return {
    roteiro: passou('ROTEIRIZADO') ? 'Pronto' : roteiroOrigem === 'MODELO' ? 'Roteiro-base (revisar)' : 'Em revisão',
    aprovacao: passou('APROVADO') ? 'Aprovado' : status === 'AGUARDANDO_APROVACAO' ? 'Aguardando' : 'Não enviado',
    gravacao: passou('GRAVADO') ? 'Gravado' : passou('PRONTO_GRAVAR') ? 'Pronto para gravar' : 'Não iniciada',
    edicao: passou('PRONTO_PUBLICAR') ? 'Editado' : status === 'EM_EDICAO' ? 'Em edição' : 'Não iniciada',
    publicacao: passou('PUBLICADO') ? 'Publicado' : status === 'AGENDADO' ? 'Agendado' : 'Não publicado',
  }
}

// ---------- Métricas reais ----------

export interface MetricasVideo {
  disponivel: boolean
  alcance?: number; visualizacoes?: number; curtidas?: number; comentarios?: number; salvamentos?: number; compartilhamentos?: number; visitasPerfil?: number
  tempoMedioSeg?: number | null; taxaPulo?: number | null; retencao?: number | null; duracaoSeg?: number | null
  conversas?: number; leads?: number; vendas?: number
  manuais?: Record<string, number>
  permalink?: string | null
  miniatura?: string | null
}

/** Métricas do post de cada vídeo publicado (pela pauta) e a atribuição pelo código/mídia. */
export async function metricasDosVideos(usuarioId: string, videos: Array<Pick<SmVideo, 'id' | 'pautaId' | 'metricasManuais' | 'permalink'>>): Promise<Map<string, MetricasVideo>> {
  const pautaIds = videos.map(v => v.pautaId).filter((x): x is string => !!x)
  const pautas = pautaIds.length ? await prisma.smPauta.findMany({ where: { id: { in: pautaIds } }, select: { id: true, codigo: true, igMediaId: true, permalink: true } }) : []
  const porPauta = new Map(pautas.map(p => [p.id, p]))
  const midiaIds = pautas.map(p => p.igMediaId).filter((x): x is string => !!x)
  const codigos = pautas.map(p => p.codigo).filter((x): x is string => !!x)
  const [midias, leads, conversas] = await Promise.all([
    midiaIds.length ? prisma.socialMediaMidia.findMany({ where: { instagramMediaId: { in: midiaIds } } }) : Promise.resolve([]),
    midiaIds.length || codigos.length
      ? prisma.lead.findMany({ where: { usuarioId, OR: [{ postCode: { in: codigos } }, { midiaId: { in: midiaIds } }] }, select: { postCode: true, midiaId: true, estagio: true } })
      : Promise.resolve([]),
    midiaIds.length || codigos.length
      ? prisma.smConversa.findMany({ where: { usuarioId, OR: [{ postCode: { in: codigos } }, { midiaIgId: { in: midiaIds } }] }, select: { postCode: true, midiaIgId: true } })
      : Promise.resolve([]),
  ])
  const midiaPor = new Map(midias.map(m => [m.instagramMediaId, m]))
  const out = new Map<string, MetricasVideo>()
  for (const v of videos) {
    const manuais = (v.metricasManuais ?? undefined) as Record<string, number> | undefined
    const p = v.pautaId ? porPauta.get(v.pautaId) : null
    const m = p?.igMediaId ? midiaPor.get(p.igMediaId) : null
    if (!m) { out.set(v.id, { disponivel: false, manuais, permalink: v.permalink ?? p?.permalink ?? null }); continue }
    const doPost = (pc: string | null, mid: string | null) => (!!p?.codigo && pc === p.codigo) || (!!p?.igMediaId && mid === p.igMediaId)
    const ls = leads.filter(l => doPost(l.postCode, l.midiaId))
    const retencao = m.tempoMedioAssistidoSeg != null && m.duracaoSeg ? Math.min(1, m.tempoMedioAssistidoSeg / m.duracaoSeg) : null
    out.set(v.id, {
      disponivel: true, alcance: m.alcance, visualizacoes: m.visualizacoes, curtidas: m.curtidas, comentarios: m.comentarios, salvamentos: m.salvamentos,
      compartilhamentos: m.compartilhamentos, visitasPerfil: m.visitasPerfil, tempoMedioSeg: m.tempoMedioAssistidoSeg, taxaPulo: m.taxaPulo, retencao, duracaoSeg: m.duracaoSeg,
      conversas: conversas.filter(c => doPost(c.postCode, c.midiaIgId)).length, leads: ls.length, vendas: ls.filter(l => l.estagio === 'FECHADO').length,
      manuais, permalink: m.urlPermalink ?? p?.permalink ?? v.permalink ?? null,
      miniatura: m.miniaturaLocal ?? m.thumbnailUrl ?? (m.tipo !== 'VIDEO' ? m.urlMidia : null) ?? null,
    })
  }
  return out
}

/** Nota do vídeo pelo objetivo da etapa (seção 22): não julga tudo por visualização. */
export function notaDoVideo(etapa: string, m: MetricasVideo): number | null {
  if (!m.disponivel) return null
  const n = (x?: number | null) => x ?? 0
  if (etapa === 'TOPO') return n(m.alcance) + 20 * n(m.compartilhamentos) + 5 * n(m.comentarios) + (m.retencao != null ? Math.round(m.retencao * 100) : 0)
  if (etapa === 'MEIO') return 10 * n(m.salvamentos) + 5 * n(m.comentarios) + 5 * n(m.compartilhamentos) + n(m.manuais?.mensagens) * 10
  return 1000 * n(m.vendas) + 100 * n(m.leads) + 30 * n(m.conversas) + 50 * (n(m.manuais?.visitasAgendadas) + n(m.manuais?.avaliacoesSolicitadas) + n(m.manuais?.propostas))
}

export const CRITERIO_DA_ETAPA: Record<string, string> = {
  TOPO: 'alcance, compartilhamentos, comentários e retenção',
  MEIO: 'salvamentos, comentários, compartilhamentos e dúvidas recebidas',
  FUNDO: 'conversas, leads e vendas atribuídos ao post, visitas, avaliações e propostas',
}

// ---------- Ciclo completo (lista + painel + checklist) ----------

const CAMPOS_LISTA = {
  id: true, codigo: true, semana: true, diaCiclo: true, data: true, horario: true, periodo: true, ordem: true, etapa: true, tema: true, temaChave: true, pilar: true, formato: true,
  alvoTipo: true, alvo: true, lente: true, persona: true, objetivo: true, titulo: true, gancho: true, cta: true, status: true, roteiroOrigem: true, pendenteConfirmacao: true,
  confirmadoEm: true, provaNecessaria: true, provaId: true, pautaId: true, permalink: true, responsavel: true, metricasManuais: true, resultado: true, aprendizado: true,
  ajusteComentario: true, contexto: true, desenvolvimento: true, valor: true, gravacao: true,
} as const

export async function cicloCompleto(usuarioId: string, cicloId: string) {
  const ciclo = await prisma.smCiclo.findFirst({ where: { id: cicloId, usuarioId }, include: { dossie: { select: { versao: true } } } })
  if (!ciclo) return null
  const videos = await prisma.smVideo.findMany({ where: { cicloId }, select: CAMPOS_LISTA, orderBy: [{ diaCiclo: 'asc' }, { horario: 'asc' }] })
  const pautas = await prisma.smPauta.findMany({ where: { id: { in: videos.map(v => v.pautaId).filter((x): x is string => !!x) } }, select: { id: true, status: true } })
  const pautaPor = new Map(pautas.map(p => [p.id, p]))
  const metricas = await metricasDosVideos(usuarioId, videos)
  const provas = await prisma.smProva.findMany({ where: { usuarioId }, select: { id: true, situacao: true, validoAte: true } })
  const hoje = new Date()
  const provasAprovadas = new Set(provas.filter(p => p.situacao === 'APROVADO' && (!p.validoAte || p.validoAte >= hoje)).map(p => p.id))
  const lista = videos.map(v => {
    const status = statusEfetivo(v, v.pautaId ? pautaPor.get(v.pautaId) : null)
    const m = metricas.get(v.id) ?? { disponivel: false }
    const { contexto: _c, desenvolvimento: _d, valor: _v, gravacao: _g, ...resto } = v
    return { ...resto, status, etapas: etapasDoVideo(status, v.roteiroOrigem), metricas: m, nota: notaDoVideo(v.etapa, m), provaOk: v.provaId ? provasAprovadas.has(v.provaId) : null }
  })
  const rep = repetidos(videos)
  const checklist = checklistDoCiclo({
    dias: ciclo.dias as string[],
    videos: videos.map(v => ({ ...v, status: lista.find(x => x.id === v.id)!.status })),
    repeticoes: rep.length, provasAprovadas, historicoPreservado: true,
  })
  return { ciclo: { ...ciclo, dossieVersao: ciclo.dossie.versao }, videos: lista, painel: painelDoCiclo(lista, ciclo.dias as string[]), checklist, repetidos: rep }
}

type VideoLista = { id: string; codigo: string; data: string; semana: number; periodo: string; etapa: string; tema: string; titulo: string; status: string; roteiroOrigem: string; pendenteConfirmacao: string | null; confirmadoEm: Date | null; provaNecessaria: string | null; provaId: string | null; provaOk: boolean | null; metricas: MetricasVideo; resultado: string | null; aprendizado: string | null }

const ORDEM = ['PLANEJADO', 'ROTEIRIZADO', 'AGUARDANDO_APROVACAO', 'APROVADO', 'PRONTO_GRAVAR', 'GRAVADO', 'EM_EDICAO', 'PRONTO_PUBLICAR', 'AGENDADO', 'PUBLICADO', 'ANALISADO']
const chegou = (s: string, alvo: string) => ORDEM.indexOf(s) >= ORDEM.indexOf(alvo)

/** Painel (seção 26): só contagens dos dados do ciclo, sem estimativa. */
export function painelDoCiclo(v: VideoLista[], dias: string[]) {
  const hoje = hojeBelem()
  const tot = (f: (x: VideoLista) => boolean) => v.filter(f).length
  const progresso = (grupo: (x: VideoLista) => string) => {
    const m = new Map<string, { total: number; publicados: number; roteirizados: number; aprovados: number }>()
    for (const x of v) {
      const g = grupo(x); const a = m.get(g) ?? { total: 0, publicados: 0, roteirizados: 0, aprovados: 0 }
      a.total++; if (chegou(x.status, 'PUBLICADO')) a.publicados++; if (chegou(x.status, 'ROTEIRIZADO')) a.roteirizados++; if (chegou(x.status, 'APROVADO')) a.aprovados++
      m.set(g, a)
    }
    return Object.fromEntries(m)
  }
  const proximaSemana = v.filter(x => x.data >= hoje && x.data <= somaDias(hoje, 7))
  const atrasados = v.filter(x => x.data < hoje && !chegou(x.status, 'PUBLICADO'))
  return {
    totais: {
      planejado: v.length, roteirizado: tot(x => chegou(x.status, 'ROTEIRIZADO')), aprovado: tot(x => chegou(x.status, 'APROVADO')), gravado: tot(x => chegou(x.status, 'GRAVADO')),
      editado: tot(x => chegou(x.status, 'PRONTO_PUBLICAR')), agendado: tot(x => chegou(x.status, 'AGENDADO')), publicado: tot(x => chegou(x.status, 'PUBLICADO')),
      pendente: tot(x => !chegou(x.status, 'PUBLICADO')), analisado: tot(x => x.status === 'ANALISADO'),
    },
    porSemana: progresso(x => `Semana ${x.semana}`), porPeriodo: progresso(x => x.periodo), porEtapa: progresso(x => x.etapa),
    semRoteiroRevisado: tot(x => x.roteiroOrigem === 'MODELO' && !chegou(x.status, 'ROTEIRIZADO')),
    semProva: tot(x => !!x.provaNecessaria && !x.provaOk),
    aguardandoAprovacao: tot(x => x.status === 'AGUARDANDO_APROVACAO'),
    pendentesComerciais: tot(x => !!x.pendenteConfirmacao && !x.confirmadoEm),
    comResultado: tot(x => x.metricas.disponivel || !!x.resultado),
    atrasados: atrasados.length,
    diasProducao: dias.length,
    aprendizados: v.filter(x => x.aprendizado).slice(-5).map(x => ({ codigo: x.codigo, texto: x.aprendizado })),
    prioridades: [
      ...(proximaSemana.filter(x => x.pendenteConfirmacao && !x.confirmadoEm).length ? [`Confirmar ${proximaSemana.filter(x => x.pendenteConfirmacao && !x.confirmadoEm).length} informações comerciais dos próximos 7 dias`] : []),
      ...(proximaSemana.filter(x => !chegou(x.status, 'APROVADO')).length ? [`Revisar e aprovar ${proximaSemana.filter(x => !chegou(x.status, 'APROVADO')).length} roteiros dos próximos 7 dias`] : []),
      ...(proximaSemana.filter(x => x.provaNecessaria && !x.provaOk).length ? [`Separar provas para ${proximaSemana.filter(x => x.provaNecessaria && !x.provaOk).length} vídeos dos próximos 7 dias`] : []),
      ...(atrasados.length ? [`${atrasados.length} vídeos com data passada ainda não publicados`] : []),
    ],
  }
}

const somaDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10)

// ---------- Produção ----------

const PILAR_DA_ETAPA: Record<string, string> = { TOPO: 'EDUCACAO', MEIO: 'BASTIDORES', FUNDO: 'ESTOQUE' }

/** Leva o vídeo para a Produção como pauta (gravação, edição, aprovação e publicação seguem por lá). */
export async function enviarParaProducao(usuarioId: string, videoId: string, ator: 'GESTOR' | 'SOCIAL_MEDIA') {
  const v = await prisma.smVideo.findFirst({ where: { id: videoId, ciclo: { usuarioId } } })
  if (!v) throw new ErroCentral(404, 'Vídeo não encontrado')
  if (v.pautaId) throw new ErroCentral(409, 'Esse vídeo já está na Produção')
  if (!chegou(v.status, 'APROVADO')) throw new ErroCentral(409, 'Aprove o roteiro antes de mandar para a Produção')
  if (v.pendenteConfirmacao && !v.confirmadoEm) throw new ErroCentral(409, `Antes de gravar, confirme: ${v.pendenteConfirmacao}`)
  const agendadoPara = new Date(`${v.data}T${v.horario}:00-03:00`)
  const pauta = await prisma.smPauta.create({
    data: {
      usuarioId, titulo: v.titulo.slice(0, 120), pilar: PILAR_DA_ETAPA[v.etapa], formato: 'REELS', etapaFunil: v.etapa, status: 'ROTEIRO', ordem: Date.now(),
      origem: 'CALENDARIO', origemRef: `central:${v.id}`, gancho: v.gancho.slice(0, 500), retencao: `${v.contexto}\n\n${v.desenvolvimento}`.slice(0, 1000),
      recompensa: v.valor.slice(0, 500), cta: v.cta.slice(0, 300), legenda: v.legenda.slice(0, 2200), agendadoPara: agendadoPara > new Date() ? agendadoPara : null, criadoPor: ator,
    },
  })
  if (pauta.agendadoPara) await prisma.smPauta.update({ where: { id: pauta.id }, data: { codigo: await gerarCodigo(usuarioId, { ...pauta, agendadoPara: pauta.agendadoPara }) } })
  await prisma.smVideo.update({ where: { id: v.id }, data: { pautaId: pauta.id, status: 'PRONTO_GRAVAR' } })
  return pauta
}

// ---------- Fechamento (seção 23) ----------

export async function fechamento(usuarioId: string, cicloId: string) {
  const c = await cicloCompleto(usuarioId, cicloId)
  if (!c) return null
  const comNota = c.videos.filter(v => v.nota != null)
  const porEtapa = (e: string) => comNota.filter(v => v.etapa === e).sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0))
  const resumo = (v: (typeof c.videos)[number]) => ({ id: v.id, codigo: v.codigo, titulo: v.titulo, tema: v.tema, formato: v.formato, metricas: v.metricas })
  const melhores: Record<string, unknown[]> = {}, piores: Record<string, unknown[]> = {}
  for (const e of ['TOPO', 'MEIO', 'FUNDO']) {
    const l = porEtapa(e)
    melhores[e] = l.slice(0, 3).map(resumo)
    piores[e] = l.length > 3 ? l.slice(-3).reverse().map(resumo) : []
  }
  // Temas: média da nota por etapa comparada com a mediana da etapa (fato observado).
  const temas = new Map<string, { tema: string; etapa: string; notas: number[] }>()
  for (const v of comNota) { const k = `${v.etapa}|${v.temaChave}`; const t = temas.get(k) ?? { tema: v.tema, etapa: v.etapa, notas: [] }; t.notas.push(v.nota!); temas.set(k, t) }
  const mediana = (n: number[]) => { const s = [...n].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0 }
  const medEtapa = Object.fromEntries(['TOPO', 'MEIO', 'FUNDO'].map(e => [e, mediana(porEtapa(e).map(v => v.nota!))]))
  const lt = [...temas.values()].filter(t => t.notas.length >= 2).map(t => ({ ...t, media: t.notas.reduce((a, b) => a + b, 0) / t.notas.length }))
  const temasContinuar = lt.filter(t => t.media > medEtapa[t.etapa]).map(t => ({ tema: t.tema, etapa: t.etapa, videos: t.notas.length }))
  const temasMudar = lt.filter(t => t.media < medEtapa[t.etapa]).map(t => ({ tema: t.tema, etapa: t.etapa, videos: t.notas.length }))
  const [perguntas, objecoes, ganchos, aprendizados] = await Promise.all([
    prisma.smCentralItem.findMany({ where: { usuarioId, tipo: 'PERGUNTA', usadoEm: null }, orderBy: { ocorrencias: 'desc' }, take: 15 }),
    prisma.smCentralItem.findMany({ where: { usuarioId, tipo: 'OBJECAO' }, orderBy: { ocorrencias: 'desc' }, take: 10 }),
    prisma.smCentralItem.findMany({ where: { usuarioId, tipo: 'GANCHO' }, orderBy: { criadoEm: 'desc' }, take: 10 }),
    prisma.smCentralItem.findMany({ where: { usuarioId, tipo: 'APRENDIZADO' }, orderBy: { criadoEm: 'desc' }, take: 15 }),
  ])
  const oportunidades = c.videos.filter(v => v.etapa === 'FUNDO' && ((v.metricas.leads ?? 0) > 0 || (v.metricas.conversas ?? 0) > 0)).map(resumo)
  const dos = await prisma.smDossie.findUnique({ where: { id: c.ciclo.dossieId } })
  const d = dos ? lerDossie(dos.conteudo) : DOSSIE_PADRAO
  const publicados = c.videos.filter(v => chegou(v.status, 'PUBLICADO')).length
  const recomendacoes: Array<{ texto: string; natureza: 'FATO' | 'HIPOTESE' | 'SUGESTAO' }> = []
  for (const t of temasContinuar.slice(0, 3)) recomendacoes.push({ texto: `Continuar "${t.tema}" no ${t.etapa.toLowerCase()} de funil, com novos ângulos (ficou acima da mediana da etapa em ${t.videos} vídeos).`, natureza: 'SUGESTAO' })
  for (const t of temasMudar.slice(0, 3)) recomendacoes.push({ texto: `Mudar a abordagem de "${t.tema}" no ${t.etapa.toLowerCase()} de funil (ficou abaixo da mediana da etapa).`, natureza: 'SUGESTAO' })
  if (perguntas.length) recomendacoes.push({ texto: `${perguntas.length} perguntas reais ainda não viraram conteúdo: entram como vídeos de meio de funil no próximo calendário.`, natureza: 'FATO' })
  if (comNota.length < 10) recomendacoes.push({ texto: 'Poucos vídeos com métricas: as comparações deste mês ainda não permitem conclusões firmes.', natureza: 'FATO' })
  return {
    geradoEm: new Date().toISOString(), mes: c.ciclo.mes, versao: c.ciclo.versao,
    fatos: { planejados: c.videos.length, publicados, comMetricas: comNota.length, criterios: CRITERIO_DA_ETAPA },
    melhores, piores, temasContinuar, temasMudar,
    perguntas: perguntas.map(p => ({ id: p.id, texto: p.texto, ocorrencias: p.ocorrencias })),
    objecoes: objecoes.map(o => ({ texto: o.texto, ocorrencias: o.ocorrencias })),
    ganchosTestar: ganchos.map(g => ({ texto: g.texto, resultado: g.resultado })),
    aprendizados: aprendizados.map(a => ({ texto: a.texto, natureza: a.natureza })),
    oportunidades,
    hipotesesNaoValidadas: d.crencas.slice(0, 8),
    recomendacoes,
    avisos: [
      'Vendas só contam quando o lead ou a venda carregam o código do post ou o id da mídia: publicar antes de uma venda não prova que o vídeo causou a venda.',
      ...(c.videos.some(v => v.metricas.disponivel) ? [] : ['Nenhum vídeo do ciclo tem métricas do Instagram ainda (só aparecem depois de publicado pela Produção e sincronizado).']),
    ],
  }
}

// ---------- Automação (seção 24) ----------

/**
 * Rodada do cron de hora em hora: no primeiro dia do mês (ou depois, se
 * ainda não existir), gera o calendário do mês para quem já usa a Central,
 * a partir do dossiê vigente e do fechamento anterior. Fica em RASCUNHO até
 * a aprovação humana. Roteiros com IA: pela tela ("Gerar roteiros").
 */
export async function rodarCentral(agora = new Date()) {
  const mes = mesDe(agora)
  const usuarios = await prisma.smCiclo.findMany({ distinct: ['usuarioId'], select: { usuarioId: true } })
  let gerados = 0
  for (const { usuarioId } of usuarios) {
    const existe = await prisma.smCiclo.findFirst({ where: { usuarioId, mes }, select: { id: true } })
    if (existe) continue
    try {
      await criarCiclo(usuarioId, mes, { origem: 'AUTOMATICO', geradoPor: 'SISTEMA' })
      gerados++
      for (const dest of ['GESTOR', 'SOCIAL_MEDIA'] as const) {
        await notificar(usuarioId, dest, 'CENTRAL_CICLO', `central:${mes}`, `Calendário de ${nomeMes(mes)} gerado`,
          'A Central gerou os 180 vídeos do mês a partir do dossiê vigente e do fechamento anterior. Revise e aprove na Central de Conteúdo.', { href: '/pro-labore/sm/central' })
      }
    } catch (e) { console.error('[central] geração automática', e) }
  }
  return { centralGerados: gerados }
}

export const ETAPA_DE = (p: string) => ETAPA_DO_PERIODO[p as Periodo]
