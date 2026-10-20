// Gasto com anúncios por mês, com uma regra só para o sistema todo (Dashboard,
// Indicadores, Plano de Crescimento e Central): com a conta do Tráfego
// (Meta Ads) conectada e dias sincronizados no mês, vale o gasto real das
// campanhas, somado dia a dia; sem isso, o valor digitado em Indicadores.
import { prisma } from './prisma'

export type FonteGasto = 'TRAFEGO' | 'MANUAL' | 'NENHUM'
export interface GastoDoMes {
  mes: string // AAAA-MM
  valor: number
  fonte: FonteGasto
  trafego: number | null // soma das campanhas no mês (null = sem dias sincronizados)
  manual: number | null // valor digitado em Indicadores
  diasComDados: number
  atualizadoEm: string | null // última sincronização do Tráfego
}

const arred = (v: number) => Math.round(v * 100) / 100
const mesesEntre = (de: string, ate: string) => {
  const out: string[] = []
  let [a, m] = de.split('-').map(Number)
  const [aFim, mFim] = ate.split('-').map(Number)
  while (a < aFim || (a === aFim && m <= mFim)) {
    out.push(`${a}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; a++ }
  }
  return out
}
const ultimoDia = (mes: string) => { const [a, m] = mes.split('-').map(Number); return new Date(Date.UTC(a, m, 0)) }

/** Gasto de cada mês entre `deMes` e `ateMes` (AAAA-MM, inclusive). */
export async function gastosDoPeriodo(usuarioId: string, deMes: string, ateMes: string): Promise<Map<string, GastoDoMes>> {
  const inicio = new Date(`${deMes}-01T00:00:00Z`), fim = ultimoDia(ateMes)
  const [conta, manuais] = await Promise.all([
    prisma.trafegoConta.findUnique({ where: { usuarioId }, select: { id: true, ultimaSincronizacaoEm: true } }),
    prisma.gastoAnuncioMensal.findMany({ where: { usuarioId, mesReferencia: { gte: inicio, lte: fim } } }),
  ])
  const porDia = conta
    ? await prisma.trafegoInsightDiario.groupBy({ by: ['data'], where: { contaId: conta.id, data: { gte: inicio, lte: fim } }, _sum: { gasto: true } })
    : []
  const trafego = new Map<string, { soma: number; dias: number }>()
  for (const d of porDia) {
    const k = d.data.toISOString().slice(0, 7)
    const t = trafego.get(k) ?? { soma: 0, dias: 0 }
    t.soma += d._sum.gasto ?? 0; t.dias++
    trafego.set(k, t)
  }
  const manual = new Map(manuais.map(g => [g.mesReferencia.toISOString().slice(0, 7), g.valor]))
  const atualizadoEm = conta?.ultimaSincronizacaoEm?.toISOString() ?? null
  const out = new Map<string, GastoDoMes>()
  for (const mes of mesesEntre(deMes, ateMes)) {
    const t = trafego.get(mes), mn = manual.get(mes) ?? null
    const fonte: FonteGasto = t ? 'TRAFEGO' : mn != null ? 'MANUAL' : 'NENHUM'
    out.set(mes, {
      mes, fonte, valor: arred(t ? t.soma : mn ?? 0), trafego: t ? arred(t.soma) : null, manual: mn, diasComDados: t?.dias ?? 0, atualizadoEm,
    })
  }
  return out
}

export async function gastoDoMes(usuarioId: string, mes: string): Promise<GastoDoMes> {
  return (await gastosDoPeriodo(usuarioId, mes, mes)).get(mes)!
}
