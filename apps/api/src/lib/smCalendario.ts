// Calendário editorial (seção 5): grade do mês começando na segunda, posts
// planejados (pautas) e publicados (feed do Instagram), regras de cadência,
// mix de pilares e melhores janelas. Horário de Brasília/Belém (UTC-3).
//
// Cadência conta só o feed (posts e reels); stories aparecem mas não contam.
import { prisma } from './prisma'
import { melhoresJanelas, type JanelasResultado } from './smJanelas'

const OFFSET_MS = 3 * 3600 * 1000
const DIA_MS = 24 * 3600 * 1000
export const PILARES_MIX = ['ESTOQUE', 'PROVA', 'EDUCACAO', 'BASTIDORES'] as const
export const MIX_PADRAO: Record<(typeof PILARES_MIX)[number], number> = { ESTOQUE: 40, PROVA: 20, EDUCACAO: 25, BASTIDORES: 15 }

export interface ConfigCalendario { minDiasSemana: number; maxPostsDia: number; maxDiasSemPost: number; mixMeta: Record<string, number>; horizonteDias: number; metaLeadsSemana: number; metaRespostaMin: number; metaRetencao: number; expedienteInicio: number; expedienteFim: number; expedienteDias: string }
export const CONFIG_PADRAO: ConfigCalendario = { minDiasSemana: 4, maxPostsDia: 2, maxDiasSemPost: 2, mixMeta: { ...MIX_PADRAO }, horizonteDias: 21, metaLeadsSemana: 10, metaRespostaMin: 15, metaRetencao: 45, expedienteInicio: 8, expedienteFim: 18, expedienteDias: '1,2,3,4,5' }

export async function carregarConfig(usuarioId: string): Promise<ConfigCalendario> {
  const c = await prisma.smConfig.findUnique({ where: { usuarioId } })
  if (!c) return { ...CONFIG_PADRAO, mixMeta: { ...MIX_PADRAO } }
  const mix = { ...MIX_PADRAO, ...(c.mixMeta as Record<string, number>) }
  return {
    minDiasSemana: c.minDiasSemana, maxPostsDia: c.maxPostsDia, maxDiasSemPost: c.maxDiasSemPost, mixMeta: mix, horizonteDias: c.horizonteDias,
    metaLeadsSemana: c.metaLeadsSemana, metaRespostaMin: c.metaRespostaMin, metaRetencao: c.metaRetencao,
    expedienteInicio: c.expedienteInicio, expedienteFim: c.expedienteFim, expedienteDias: c.expedienteDias,
  }
}

/** 'YYYY-MM-DD' (Belém) do instante. */
export function diaLocal(instante: Date): string {
  return new Date(instante.getTime() - OFFSET_MS).toISOString().slice(0, 10)
}
/** Meia-noite (Belém) do dia 'YYYY-MM-DD', como instante UTC. */
function inicioDoDia(dia: string): Date {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + OFFSET_MS)
}
const somarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10)
const diaDaSemana = (dia: string) => new Date(`${dia}T00:00:00Z`).getUTCDay() // 0 = domingo
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`

export interface ItemCalendario {
  tipo: 'PAUTA' | 'INSTAGRAM'
  id: string
  instante: string
  hora: string
  formato: 'REELS' | 'CARROSSEL' | 'FOTO' | 'STORY'
  titulo: string
  pilar: string | null
  status: string // status da pauta, ou PUBLICADO para o que veio do Instagram
  contaNaCadencia: boolean
  arrastavel: boolean
  permalink: string | null
}

export interface DiaCalendario {
  data: string
  doMes: boolean
  hoje: boolean
  passado: boolean
  util: boolean
  itens: ItemCalendario[]
  postsFeed: number
  semPost: boolean
  rajada: boolean
  slotLivre: boolean
}

export type StatusRegra = 'OK' | 'AJUSTAR' | 'ATENCAO'
export interface RegraCadencia { chave: 'minDiasSemana' | 'maxPostsDia' | 'maxDiasSemPost'; status: StatusRegra; texto: string }

export interface EntradaCalendario {
  mes: string // 'YYYY-MM'
  hoje: string // 'YYYY-MM-DD'
  config: ConfigCalendario
  itens: ItemCalendario[]
  janelas: JanelasResultado
}

export function montarCalendario(e: EntradaCalendario) {
  const { mes, hoje, config } = e
  const primeiro = `${mes}-01`
  const ultimo = somarDias(`${somarDias(primeiro, 32).slice(0, 7)}-01`, -1)
  const inicioGrade = somarDias(primeiro, -((diaDaSemana(primeiro) + 6) % 7))
  const fimGrade = somarDias(ultimo, (7 - diaDaSemana(ultimo)) % 7)
  const limiteSlots = somarDias(hoje, config.horizonteDias)

  const porDia = new Map<string, ItemCalendario[]>()
  for (const it of e.itens) {
    const d = diaLocal(new Date(it.instante))
    porDia.set(d, [...(porDia.get(d) ?? []), it])
  }

  const dias: DiaCalendario[] = []
  for (let d = inicioGrade; d <= fimGrade; d = somarDias(d, 1)) {
    const itens = (porDia.get(d) ?? []).sort((a, b) => a.instante.localeCompare(b.instante))
    const postsFeed = itens.filter(i => i.contaNaCadencia).length
    const doMes = d.slice(0, 7) === mes
    const passado = d < hoje
    const util = diaDaSemana(d) >= 1 && diaDaSemana(d) <= 5
    dias.push({
      data: d, doMes, hoje: d === hoje, passado, util, itens, postsFeed,
      semPost: doMes && passado && postsFeed === 0,
      rajada: postsFeed > config.maxPostsDia,
      slotLivre: doMes && !passado && d <= limiteSlots && util && postsFeed === 0,
    })
  }
  const doMes = dias.filter(d => d.doMes)

  // --- Regras de cadência ---
  const regras: RegraCadencia[] = []
  // Máximo de posts por dia.
  const rajadasFuturas = doMes.filter(d => !d.passado && d.rajada)
  const rajadasPassadas = doMes.filter(d => d.passado && d.rajada)
  regras.push({
    chave: 'maxPostsDia',
    status: rajadasFuturas.length ? 'AJUSTAR' : rajadasPassadas.length ? 'ATENCAO' : 'OK',
    texto: rajadasFuturas.length
      ? `Máximo de ${config.maxPostsDia} posts por dia: ${rajadasFuturas.map(d => `${ddmm(d.data)} tem ${d.postsFeed}`).join(', ')}`
      : rajadasPassadas.length
        ? `Máximo de ${config.maxPostsDia} posts por dia: ${rajadasPassadas.map(d => `${ddmm(d.data)} teve ${d.postsFeed}`).join(', ')}`
        : `Máximo de ${config.maxPostsDia} posts por dia`,
  })
  // Intervalo máximo sem post: sequências vazias a partir de hoje (ou que já
  // vêm de antes e continuam abertas), até o fim do mês.
  type Trecho = { de: string; ate: string; dias: number }
  const trechos: Trecho[] = []
  for (const d of doMes) {
    const ultimo = trechos[trechos.length - 1]
    if (d.postsFeed > 0) continue
    if (ultimo && ultimo.ate === somarDias(d.data, -1)) { ultimo.ate = d.data; ultimo.dias++ }
    else trechos.push({ de: d.data, ate: d.data, dias: 1 })
  }
  const longos = trechos.filter(t => t.dias > config.maxDiasSemPost && t.ate >= hoje)
  const passadosLongos = trechos.filter(t => t.dias > config.maxDiasSemPost && t.ate < hoje)
  regras.push({
    chave: 'maxDiasSemPost',
    status: longos.length ? 'ATENCAO' : passadosLongos.length ? 'ATENCAO' : 'OK',
    texto: longos.length
      ? `Intervalo máximo de ${config.maxDiasSemPost} dias: ${longos.map(t => t.de === t.ate ? ddmm(t.de) : `${ddmm(t.de)} a ${ddmm(t.ate)}`).join(', ')} ainda ${longos.length === 1 && longos[0].dias === 1 ? 'vazio' : 'vazios'}`
      : passadosLongos.length
        ? `Intervalo máximo de ${config.maxDiasSemPost} dias: ${passadosLongos.map(t => `${ddmm(t.de)} a ${ddmm(t.ate)}`).join(', ')} ${passadosLongos.length === 1 ? 'ficou' : 'ficaram'} sem post`
        : `Intervalo máximo de ${config.maxDiasSemPost} dias sem post`,
  })
  // Mínimo de dias com post por semana (semanas que ainda dá para ajustar).
  const semanas: Array<{ inicio: string; dias: DiaCalendario[] }> = []
  for (let i = 0; i < dias.length; i += 7) semanas.push({ inicio: dias[i].data, dias: dias.slice(i, i + 7) })
  const abertas = semanas.filter(s => s.dias[6].data >= hoje && s.dias.some(d => d.doMes))
  const curtas = abertas.filter(s => s.dias.filter(d => d.postsFeed > 0).length < config.minDiasSemana)
  const fechadasCurtas = semanas.filter(s => s.dias[6].data < hoje && s.dias.some(d => d.doMes) && s.dias.filter(d => d.postsFeed > 0).length < config.minDiasSemana)
  regras.unshift({
    chave: 'minDiasSemana',
    status: curtas.length ? 'ATENCAO' : fechadasCurtas.length ? 'ATENCAO' : 'OK',
    texto: curtas.length
      ? `Mínimo de ${config.minDiasSemana} dias com post por semana: ${curtas.length === 1 ? 'semana' : 'semanas'} de ${curtas.map(s => `${ddmm(s.inicio)} (${s.dias.filter(d => d.postsFeed > 0).length})`).join(', ')}`
      : fechadasCurtas.length
        ? `Mínimo de ${config.minDiasSemana} dias com post por semana: ${fechadasCurtas.length === 1 ? 'a semana' : 'as semanas'} de ${fechadasCurtas.map(s => ddmm(s.inicio)).join(', ')} ${fechadasCurtas.length === 1 ? 'ficou' : 'ficaram'} abaixo`
        : `Mínimo de ${config.minDiasSemana} dias com post por semana`,
  })

  // --- Mix de pilares do mês (planejado + publicado, só o feed) ---
  const doMesItens = doMes.flatMap(d => d.itens).filter(i => i.contaNaCadencia)
  const comPilar = doMesItens.filter(i => i.pilar)
  const mix = PILARES_MIX.map(p => {
    const qtd = comPilar.filter(i => i.pilar === p).length
    return { pilar: p, quantidade: qtd, percentual: comPilar.length ? qtd / comPilar.length : 0, meta: (config.mixMeta[p] ?? 0) / 100 }
  })

  return {
    mes,
    hoje,
    semanas: semanas.map(s => s.dias),
    regras,
    mix: { pilares: mix, total: comPilar.length, semPilar: doMesItens.length - comPilar.length },
    janelas: e.janelas,
    config,
  }
}

const FORMATO_DO_INSTAGRAM = (formato: string | null, tipo: string): ItemCalendario['formato'] =>
  formato === 'REELS' ? 'REELS' : formato === 'STORY' ? 'STORY' : tipo === 'CAROUSEL_ALBUM' ? 'CARROSSEL' : 'FOTO'

const horaLocal = (d: Date) => new Date(d.getTime() - OFFSET_MS).toISOString().slice(11, 16)

export async function calendarioDoMes(usuarioId: string, mes: string, opcoes: { podeArrastar: boolean }, agora = new Date()) {
  const config = await carregarConfig(usuarioId)
  const primeiro = `${mes}-01`
  const inicio = inicioDoDia(somarDias(primeiro, -7))
  const fim = inicioDoDia(somarDias(primeiro, 45))
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` }, select: { id: true } })
  const [pautas, midias, janelas] = await Promise.all([
    prisma.smPauta.findMany({
      where: { usuarioId, OR: [{ agendadoPara: { gte: inicio, lt: fim } }, { publicadaEm: { gte: inicio, lt: fim } }] },
      select: { id: true, titulo: true, pilar: true, formato: true, status: true, agendadoPara: true, publicadaEm: true, igMediaId: true, permalink: true, publicacaoStatus: true },
    }),
    conta
      ? prisma.socialMediaMidia.findMany({
        // Stories do Instagram ficam de fora: somem em 24 h e não contam na cadência.
        where: { contaId: conta.id, publicadoEm: { gte: inicio, lt: fim }, NOT: { formato: { in: ['AD', 'STORY'] } } },
        select: { id: true, instagramMediaId: true, legenda: true, formato: true, tipo: true, publicadoEm: true, urlPermalink: true },
      })
      : Promise.resolve([]),
    melhoresJanelas(usuarioId, agora),
  ])
  const publicadosPorPauta = new Set(pautas.map(p => p.igMediaId).filter(Boolean))
  const itens: ItemCalendario[] = [
    ...pautas.map(p => {
      const quando = (p.status === 'PUBLICADO' ? p.publicadaEm : p.agendadoPara) ?? p.agendadoPara!
      return {
        tipo: 'PAUTA' as const, id: p.id, instante: quando.toISOString(), hora: horaLocal(quando),
        formato: p.formato as ItemCalendario['formato'], titulo: p.titulo, pilar: p.pilar, status: p.status,
        contaNaCadencia: p.formato !== 'STORY',
        arrastavel: opcoes.podeArrastar && p.status !== 'PUBLICADO' && p.publicacaoStatus !== 'PROCESSANDO',
        permalink: p.permalink,
      }
    }),
    ...midias.filter(m => !publicadosPorPauta.has(m.instagramMediaId)).map(m => {
      const formato = FORMATO_DO_INSTAGRAM(m.formato, m.tipo)
      const legenda = (m.legenda ?? '').replace(/\s+/g, ' ').trim()
      return {
        tipo: 'INSTAGRAM' as const, id: m.id, instante: m.publicadoEm.toISOString(), hora: horaLocal(m.publicadoEm),
        formato, titulo: legenda ? (legenda.length > 60 ? `${legenda.slice(0, 57)}…` : legenda) : 'Post sem legenda', pilar: null,
        status: 'PUBLICADO', contaNaCadencia: formato !== 'STORY', arrastavel: false, permalink: m.urlPermalink,
      }
    }),
  ]
  return montarCalendario({ mes, hoje: diaLocal(agora), config, itens, janelas })
}
