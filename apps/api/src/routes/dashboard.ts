import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { calcularPrecificacao, lucroLiquidoReal, diasEmEstoque, obterParametros as obterParametrosBase } from '../lib/precificacao'

const router = Router()

// Ordem do funil comercial atual. "PERDIDO" é um ramo de saída, não faz parte
// da sequência linear de conversão.
const ETAPAS_FUNIL = [
  { estagio: 'NOVO_LEAD', label: 'Novo Lead' },
  { estagio: 'CONTATO', label: 'Contato' },
  { estagio: 'VISITA_AGENDADA', label: 'Visita Agendada' },
  { estagio: 'PROPOSTA', label: 'Proposta' },
  { estagio: 'NEGOCIACAO', label: 'Negociação' },
  { estagio: 'GANHO', label: 'Ganho' },
]

function inicioDoMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), 1)
}

/** Tempo médio (em dias) que oportunidades passam em cada etapa antes de sair dela. */
function tempoMedioPorEtapa(historico: { oportunidadeId: string; estagioNovo: string; criadoEm: Date }[]) {
  const porOportunidade = new Map<string, { estagioNovo: string; criadoEm: Date }[]>()
  for (const h of historico) {
    if (!porOportunidade.has(h.oportunidadeId)) porOportunidade.set(h.oportunidadeId, [])
    porOportunidade.get(h.oportunidadeId)!.push(h)
  }

  const duracoesPorEtapa = new Map<string, number[]>()
  for (const entradas of porOportunidade.values()) {
    entradas.sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime())
    for (let i = 0; i < entradas.length - 1; i++) {
      const dias = (entradas[i + 1].criadoEm.getTime() - entradas[i].criadoEm.getTime()) / (24 * 60 * 60 * 1000)
      const etapa = entradas[i].estagioNovo
      if (!duracoesPorEtapa.has(etapa)) duracoesPorEtapa.set(etapa, [])
      duracoesPorEtapa.get(etapa)!.push(dias)
    }
  }

  const media = new Map<string, number>()
  for (const [etapa, duracoes] of duracoesPorEtapa) {
    media.set(etapa, duracoes.reduce((a, b) => a + b, 0) / duracoes.length)
  }
  return media
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const agora = new Date()
  const inicioPeriodo = inicioDoMes(agora)

  const [
    todasOportunidades,
    oportunidadesPeriodo,
    historicoPeriodo,
    contratosPeriodo,
    params,
  ] = await Promise.all([
    prisma.oportunidade.findMany({ where: { empresaId } }),
    prisma.oportunidade.findMany({
      where: { empresaId, fechadaEm: { gte: inicioPeriodo, lte: agora } },
      select: { estagio: true, statusFinal: true },
    }),
    prisma.estagioHistorico.findMany({
      where: { empresaId, criadoEm: { gte: inicioPeriodo } },
      select: { oportunidadeId: true, estagioNovo: true, criadoEm: true },
    }),
    prisma.contrato.findMany({
      where: { empresaId, status: { not: 'CANCELADO' }, criadoEm: { gte: inicioPeriodo, lte: agora } },
      include: { unidade: true },
    }),
    obterParametrosBase(prisma, empresaId),
  ])

  // --- Resumo executivo (mês corrente) ---
  const vendasPeriodo = contratosPeriodo.length
  const faturamento = contratosPeriodo.reduce((soma, c) => soma + c.valorTotal, 0)
  const ticketMedio = vendasPeriodo > 0 ? faturamento / vendasPeriodo : 0

  const ganhasPeriodo = oportunidadesPeriodo.filter(o => o.statusFinal === 'GANHO').length
  const perdidasPeriodo = oportunidadesPeriodo.filter(o => o.statusFinal === 'PERDIDO').length
  const conversao = ganhasPeriodo + perdidasPeriodo > 0 ? ganhasPeriodo / (ganhasPeriodo + perdidasPeriodo) : 0

  let lucro = 0
  for (const c of contratosPeriodo) {
    if (!c.unidade || c.unidade.valorCompra == null) continue
    const resultado = calcularPrecificacao({ ...c.unidade, valorCompra: c.unidade.valorCompra }, params)
    const dias = diasEmEstoque(c.unidade.dataCompra, c.criadoEm) ?? 0
    lucro += lucroLiquidoReal({
      precoVendido: c.valorTotal,
      custoBaseProvisionado: resultado.custoBase,
      custoFinanceiroProvisionado: resultado.custoFinanceiroProvisionado,
      valorCompra: c.unidade.valorCompra,
      diasReais: dias,
      marketingReal: c.unidade.marketingInvestido ?? 0,
      params,
    })
  }

  // --- Segunda linha (eventos do funil no período, via trilha de estágio) ---
  const leads = historicoPeriodo.filter(h => h.estagioNovo === 'NOVO_LEAD').length
  const agendamentos = historicoPeriodo.filter(h => h.estagioNovo === 'VISITA_AGENDADA').length
  const fechamentos = historicoPeriodo.filter(h => h.estagioNovo === 'GANHO').length

  // --- Funil (distribuição atual do pipeline ativo) ---
  const contagemAtual: Record<string, number> = {}
  for (const op of todasOportunidades) contagemAtual[op.estagio] = (contagemAtual[op.estagio] ?? 0) + 1

  const tempoMedio = tempoMedioPorEtapa(historicoPeriodo)
  const baseFunil = contagemAtual.NOVO_LEAD ?? 0
  const funil = ETAPAS_FUNIL.map(etapa => ({
    estagio: etapa.estagio,
    label: etapa.label,
    quantidade: contagemAtual[etapa.estagio] ?? 0,
    conversaoDoTopo: baseFunil > 0 ? (contagemAtual[etapa.estagio] ?? 0) / baseFunil : 0,
    tempoMedioDias: tempoMedio.has(etapa.estagio) ? Math.round(tempoMedio.get(etapa.estagio)! * 10) / 10 : null,
  }))

  const recentes = todasOportunidades
    .sort((a, b) => new Date(b.atualizadaEm).getTime() - new Date(a.atualizadaEm).getTime())
    .slice(0, 5)
    .map(o => ({ id: o.id, nomeCliente: o.nomeCliente, estagio: o.estagio, valor: o.valor }))

  res.json({
    periodo: { inicio: inicioPeriodo, fim: agora, label: 'Este mês' },
    resumo: { faturamento, vendas: vendasPeriodo, conversao, ticketMedio, lucro },
    segundaLinha: { leads, agendamentos, fechamentos },
    funil,
    recentes,
  })
})

export default router
