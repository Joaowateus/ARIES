import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { calcularPrecificacao, lucroLiquidoReal, diasEmEstoque, obterParametros as obterParametrosBase } from '../lib/precificacao'
import { ETAPAS_FUNIL_ORDEM, ESTAGIO_LABEL, ESTAGIO_VENDA_FECHADA, tempoMedioPorEtapa } from '../lib/funil'

const router = Router()

function inicioDoMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), 1)
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

  const ganhasPeriodo = oportunidadesPeriodo.filter(o => o.statusFinal === ESTAGIO_VENDA_FECHADA).length
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
  const simulacoes = historicoPeriodo.filter(h => h.estagioNovo === 'SQL').length
  const fechamentos = historicoPeriodo.filter(h => h.estagioNovo === ESTAGIO_VENDA_FECHADA).length

  // --- Funil (distribuição atual do pipeline ativo) ---
  const contagemAtual: Record<string, number> = {}
  for (const op of todasOportunidades) contagemAtual[op.estagio] = (contagemAtual[op.estagio] ?? 0) + 1

  const tempoMedio = tempoMedioPorEtapa(historicoPeriodo)
  const baseFunil = contagemAtual.NOVO_LEAD ?? 0
  const funil = ETAPAS_FUNIL_ORDEM.map(estagio => ({
    estagio,
    label: ESTAGIO_LABEL[estagio],
    quantidade: contagemAtual[estagio] ?? 0,
    conversaoDoTopo: baseFunil > 0 ? (contagemAtual[estagio] ?? 0) / baseFunil : 0,
    tempoMedioDias: tempoMedio.has(estagio) ? Math.round(tempoMedio.get(estagio)! * 10) / 10 : null,
  }))

  const recentes = todasOportunidades
    .sort((a, b) => new Date(b.atualizadaEm).getTime() - new Date(a.atualizadaEm).getTime())
    .slice(0, 5)
    .map(o => ({ id: o.id, nomeCliente: o.nomeCliente, estagio: o.estagio, valor: o.valor }))

  res.json({
    periodo: { inicio: inicioPeriodo, fim: agora, label: 'Este mês' },
    resumo: { faturamento, vendas: vendasPeriodo, conversao, ticketMedio, lucro },
    segundaLinha: { leads, simulacoes, fechamentos },
    funil,
    recentes,
  })
})

export default router
