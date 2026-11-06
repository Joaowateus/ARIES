// Metas e premissas da jornada (PDF 01, seção 4): tempo máximo por etapa,
// critérios do Levantamento, faltas até a perda e prazos do Pós-venda.
// Tempo máximo inicial (decisão aprovada): Lead, Abordado, Negociação e
// Proposta pelo histórico da loja; Levantamento, MQL, SQL e Visita sem
// limite até haver 30 dias de histórico (aí o valor calculado é sugerido para
// aprovação); Agendamento vai até a data marcada; SQL avisa pela validade da
// aprovação. Proposta usa limite mais curto que a Negociação.
import { prisma } from './prisma'
import { ETAPAS, type Etapa } from './etapasJornada'
import { CRITERIOS_PADRAO, type CriterioLevantamento } from './jornadaRegras'

export type Unidade = 'MINUTOS' | 'HORAS' | 'DIAS'
export interface TempoMaximo { valor: number | null; unidade: Unidade; fonte: 'HISTORICO' | 'APROVADO' | 'SEM_LIMITE' | 'DATA_MARCADA' | 'VALIDADE'; sugerido?: number | null }
const MIN = 60_000, HORA = 60 * MIN, DIA = 24 * HORA
const UNIDADE: Record<Etapa, Unidade> = { LEAD: 'MINUTOS', ABORDADO: 'DIAS', LEVANTAMENTO: 'DIAS', MQL: 'DIAS', SQL: 'HORAS', NEGOCIACAO: 'DIAS', PROPOSTA: 'DIAS', AGENDAMENTO: 'DIAS', VISITA: 'DIAS', VENDA: 'DIAS' }
const EM_MS: Record<Unidade, number> = { MINUTOS: MIN, HORAS: HORA, DIAS: DIA }
const PELO_HISTORICO: Etapa[] = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA']
const DEPOIS_DE_30_DIAS: Etapa[] = ['LEVANTAMENTO', 'MQL', 'VISITA']

/** Percentil 75 do tempo na etapa: a partir daí o lead conta como parado. */
function p75(v: number[]) { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * 0.75))] }

async function historico(usuarioId: string) {
  const linhas = await prisma.$queryRaw<Array<{ etapa: string; ms: number; desde: Date }>>`
    SELECT h."estagioNovo" AS etapa, EXTRACT(EPOCH FROM (h."saiuEm" - h."criadoEm")) * 1000 AS ms, h."criadoEm" AS desde
    FROM "pro_labore_lead_estagio_historico" h JOIN "pro_labore_leads" l ON l.id = h."leadId"
    WHERE l."usuarioId" = ${usuarioId} AND h."saiuEm" IS NOT NULL AND h."saiuEm" > h."criadoEm"`
  const por = new Map<string, { ms: number[]; primeiro: number }>()
  for (const l of linhas) {
    const e = por.get(l.etapa) ?? { ms: [], primeiro: Infinity }
    e.ms.push(Number(l.ms)); e.primeiro = Math.min(e.primeiro, new Date(l.desde).getTime()); por.set(l.etapa, e)
  }
  return por
}

export async function premissas(usuarioId: string) {
  const [p, hist] = await Promise.all([
    prisma.parametroLiquidez.findUnique({ where: { usuarioId }, select: { jornadaTemposMaximos: true, jornadaCriteriosLevantamento: true, jornadaFaltasAtePerda: true, posVendaPrazos: true } }),
    historico(usuarioId),
  ])
  const salvos = (p?.jornadaTemposMaximos ?? {}) as Partial<Record<Etapa, TempoMaximo>>
  const tempos = {} as Record<Etapa, TempoMaximo>
  for (const e of ETAPAS) {
    const u = UNIDADE[e]
    const h = hist.get(e)
    const calc = h ? p75(h.ms) : null
    const calculado = calc != null ? Math.max(1, Math.round(calc / EM_MS[u])) : null
    const s = salvos[e]
    if (s && s.fonte === 'APROVADO') { tempos[e] = { ...s, sugerido: calculado }; continue }
    if (e === 'AGENDAMENTO') { tempos[e] = { valor: null, unidade: u, fonte: 'DATA_MARCADA' }; continue }
    if (e === 'SQL') { tempos[e] = { valor: null, unidade: u, fonte: 'VALIDADE', sugerido: calculado }; continue }
    if (e === 'VENDA') { tempos[e] = { valor: null, unidade: u, fonte: 'SEM_LIMITE' }; continue }
    if (PELO_HISTORICO.includes(e)) { tempos[e] = { valor: calculado, unidade: u, fonte: calculado != null ? 'HISTORICO' : 'SEM_LIMITE' }; continue }
    const trintaDias = !!h && Date.now() - h.primeiro >= 30 * DIA
    tempos[e] = { valor: null, unidade: u, fonte: 'SEM_LIMITE', sugerido: DEPOIS_DE_30_DIAS.includes(e) && trintaDias ? calculado : null }
  }
  // Proposta com limite mais curto que a Negociação.
  if (tempos.PROPOSTA.fonte === 'HISTORICO' && tempos.NEGOCIACAO.valor != null && tempos.PROPOSTA.valor != null && tempos.PROPOSTA.valor >= tempos.NEGOCIACAO.valor) tempos.PROPOSTA.valor = Math.max(1, tempos.NEGOCIACAO.valor - 1)
  const c = p?.jornadaCriteriosLevantamento as unknown
  return {
    temposMaximos: tempos,
    criteriosLevantamento: (Array.isArray(c) && c.length ? c : CRITERIOS_PADRAO) as CriterioLevantamento[],
    faltasAtePerda: p?.jornadaFaltasAtePerda ?? 2,
    posVendaPrazos: { entrega: 3, documentacao: 15, primeiraRevisao: 180, ...((p?.posVendaPrazos ?? {}) as object) },
  }
}

/** Tempo máximo em ms por etapa (null = sem limite), para os cards. */
export async function limitesEmMs(usuarioId: string) {
  const { temposMaximos } = await premissas(usuarioId)
  return Object.fromEntries(ETAPAS.map(e => [e, temposMaximos[e].valor != null ? temposMaximos[e].valor! * EM_MS[temposMaximos[e].unidade] : null])) as Record<Etapa, number | null>
}

export async function salvarPremissas(usuarioId: string, d: { temposMaximos?: Partial<Record<Etapa, { valor: number | null; unidade: Unidade }>>; criteriosLevantamento?: CriterioLevantamento[]; faltasAtePerda?: number; posVendaPrazos?: { entrega: number; documentacao: number; primeiraRevisao: number } }) {
  const atual = await prisma.parametroLiquidez.findUnique({ where: { usuarioId }, select: { jornadaTemposMaximos: true } })
  const tempos = { ...((atual?.jornadaTemposMaximos ?? {}) as object) } as Record<string, TempoMaximo>
  for (const [e, t] of Object.entries(d.temposMaximos ?? {})) if (t) tempos[e] = { valor: t.valor, unidade: t.unidade, fonte: 'APROVADO' }
  await prisma.parametroLiquidez.upsert({
    where: { usuarioId },
    create: { usuarioId, jornadaTemposMaximos: tempos as object, ...(d.criteriosLevantamento ? { jornadaCriteriosLevantamento: d.criteriosLevantamento } : {}), ...(d.faltasAtePerda ? { jornadaFaltasAtePerda: d.faltasAtePerda } : {}), ...(d.posVendaPrazos ? { posVendaPrazos: d.posVendaPrazos } : {}) },
    update: { jornadaTemposMaximos: tempos as object, ...(d.criteriosLevantamento ? { jornadaCriteriosLevantamento: d.criteriosLevantamento } : {}), ...(d.faltasAtePerda ? { jornadaFaltasAtePerda: d.faltasAtePerda } : {}), ...(d.posVendaPrazos ? { posVendaPrazos: d.posVendaPrazos } : {}) },
  })
  return premissas(usuarioId)
}
