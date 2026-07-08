import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requirePapel } from '../middleware/auth'
import {
  calcularPrecificacao,
  diasEmEstoque,
  faseCiclo,
  classificacaoSaude,
  precoSugerido,
  lucroLiquidoReal,
  PARAMETROS_PADRAO,
  ParametrosPrecificacao,
  SAUDE,
} from '../lib/precificacao'

const router = Router()

const PAPEIS_GESTAO = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL']

async function obterParametros(empresaId: string): Promise<ParametrosPrecificacao & { id: string }> {
  const existente = await prisma.parametroPrecificacao.findUnique({ where: { empresaId } })
  if (existente) return existente
  return prisma.parametroPrecificacao.create({ data: { empresaId, ...PARAMETROS_PADRAO } })
}

// ---------------------------------------------------------------------------
// Parâmetros (Pilar 9 — apenas gestão pode alterar; fonte única de verdade)
// ---------------------------------------------------------------------------

router.get('/parametros', requireAuth, async (req: Request, res: Response) => {
  const parametros = await obterParametros(req.user!.empresaId)
  res.json(parametros)
})

const parametrosSchema = z.object({
  margemEstrategica: z.number().min(0).max(0.95),
  margemComercial: z.number().min(0).max(0.95),
  margemNegociacao: z.number().min(0).max(0.95),
  margemLP: z.number().min(0).max(0.95),
  impostosPct: z.number().min(0).max(0.95),
  comissaoPadraoPct: z.number().min(0).max(0.95),
  marketingProvisionadoPct: z.number().min(0).max(0.95),
  reservaFinanceiraPct: z.number().min(0).max(0.95),
  taxaFinanceiraMensal: z.number().min(0).max(1),
  taxaOportunidadeMensal: z.number().min(0).max(1),
  diasEstoqueMeta: z.number().int().min(1).max(365),
  custoOperacionalRateio: z.number().min(0),
  fase1MaxDias: z.number().int().min(1),
  fase2MaxDias: z.number().int().min(1),
  fase3MaxDias: z.number().int().min(1),
  saudePremiumMaxDias: z.number().int().min(1),
  saudeSaudavelMaxDias: z.number().int().min(1),
  saudeAtencaoMaxDias: z.number().int().min(1),
}).partial()

router.put('/parametros', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const parse = parametrosSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const atual = await obterParametros(req.user!.empresaId)
  const proposto = { ...atual, ...parse.data }
  const somaFixa =
    proposto.impostosPct + proposto.comissaoPadraoPct + proposto.marketingProvisionadoPct + proposto.reservaFinanceiraPct
  const maiorMargem = Math.max(
    proposto.margemEstrategica, proposto.margemComercial, proposto.margemNegociacao, proposto.margemLP
  )
  if (somaFixa + maiorMargem >= 1) {
    res.status(400).json({
      error: 'A soma de impostos + comissão + marketing + reserva + margem não pode atingir 100%. Ajuste os percentuais.',
    })
    return
  }

  const atualizado = await prisma.parametroPrecificacao.update({
    where: { empresaId: req.user!.empresaId },
    data: parse.data,
  })
  res.json(atualizado)
})

// ---------------------------------------------------------------------------
// Motor de precificação por unidade (Pilares 2, 3, 5, 10, 11)
// ---------------------------------------------------------------------------

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const params = await obterParametros(empresaId)

  const unidades = await prisma.unidade.findMany({
    where: { empresaId, situacao: { not: 'INATIVO' } },
    orderBy: [{ situacao: 'asc' }, { nome: 'asc' }],
  })

  const linhas = unidades.map(u => {
    if (u.valorCompra == null) {
      return {
        id: u.id,
        nome: u.nome,
        situacao: u.situacao,
        dadosIncompletos: true,
        mensagem: 'Cadastre o valor de compra para calcular a precificação desta moto.',
      }
    }

    const resultado = calcularPrecificacao(
      {
        valorCompra: u.valorCompra,
        custoRevisao: u.custoRevisao,
        custoEstetica: u.custoEstetica,
        custoDocumentacao: u.custoDocumentacao,
        custoFrete: u.custoFrete,
        custoCombustivel: u.custoCombustivel,
        custoAcessorios: u.custoAcessorios,
        custoOutros: u.custoOutros,
      },
      params
    )

    const dias = diasEmEstoque(u.dataCompra)
    const fase = faseCiclo(dias, params)
    const saude = classificacaoSaude(dias, params)
    const sugerido = precoSugerido(dias, params, resultado)

    return {
      id: u.id,
      nome: u.nome,
      situacao: u.situacao,
      dadosIncompletos: false,
      dataCompra: u.dataCompra,
      diasEmEstoque: dias,
      fase,
      classificacaoSaude: saude,
      capitalParado: u.situacao !== 'VENDIDA' && [SAUDE.ATENCAO, SAUDE.CRITICO].includes(saude as never) ? u.valorCompra : 0,
      ...resultado,
      precoSugeridoHoje: sugerido,
      revisaoGerencialObrigatoria: (dias ?? 0) > params.fase3MaxDias,
    }
  })

  res.json(linhas)
})

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const params = await obterParametros(empresaId)
  const u = await prisma.unidade.findFirst({ where: { id: String(req.params.id), empresaId } })
  if (!u) {
    res.status(404).json({ error: 'Moto não encontrada' })
    return
  }
  if (u.valorCompra == null) {
    res.json({ id: u.id, nome: u.nome, dadosIncompletos: true })
    return
  }
  const resultado = calcularPrecificacao({ ...u, valorCompra: u.valorCompra }, params)
  const dias = diasEmEstoque(u.dataCompra)
  res.json({
    id: u.id,
    nome: u.nome,
    dadosIncompletos: false,
    diasEmEstoque: dias,
    fase: faseCiclo(dias, params),
    classificacaoSaude: classificacaoSaude(dias, params),
    precoSugeridoHoje: precoSugerido(dias, params, resultado),
    ...resultado,
  })
})

// ---------------------------------------------------------------------------
// Cadastro de custos (Pilar 8) — quem pode lançar compra/custos de uma moto
// ---------------------------------------------------------------------------

const custosSchema = z.object({
  dataCompra: z.coerce.date().optional(),
  valorCompra: z.number().positive().optional(),
  custoRevisao: z.number().min(0).optional(),
  custoEstetica: z.number().min(0).optional(),
  custoDocumentacao: z.number().min(0).optional(),
  custoFrete: z.number().min(0).optional(),
  custoCombustivel: z.number().min(0).optional(),
  custoAcessorios: z.number().min(0).optional(),
  custoOutros: z.number().min(0).optional(),
  marketingInvestido: z.number().min(0).optional(),
})

router.patch('/:id/custos', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const parse = custosSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const atualizado = await prisma.unidade.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    data: parse.data,
  })
  if (!atualizado.count) {
    res.status(404).json({ error: 'Moto não encontrada' })
    return
  }
  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// KPIs consolidados (Pilar 13 — Dashboard Executivo)
// ---------------------------------------------------------------------------

router.get('/relatorios/kpis', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const params = await obterParametros(empresaId)

  const [unidades, contratos] = await Promise.all([
    prisma.unidade.findMany({ where: { empresaId, situacao: { not: 'INATIVO' } } }),
    prisma.contrato.findMany({
      where: { empresaId, status: { not: 'CANCELADO' } },
      include: { unidade: true },
    }),
  ])

  let capitalInvestido = 0
  let capitalParado = 0
  let motosAcima90 = 0
  let motosCriticas = 0
  let motosPremium = 0

  for (const u of unidades) {
    if (u.valorCompra == null) continue
    if (u.situacao !== 'VENDIDA') capitalInvestido += u.valorCompra
    const dias = diasEmEstoque(u.dataCompra)
    const saude = classificacaoSaude(dias, params)
    if (saude === SAUDE.CRITICO) { motosCriticas++; if (u.situacao !== 'VENDIDA') capitalParado += u.valorCompra }
    if (saude === SAUDE.ATENCAO && u.situacao !== 'VENDIDA') capitalParado += u.valorCompra
    if (saude === SAUDE.PREMIUM) motosPremium++
    if ((dias ?? 0) > params.fase3MaxDias) motosAcima90++
  }

  const vendasComDados = contratos
    .filter(c => c.unidade?.valorCompra != null)
    .map(c => {
      const u = c.unidade!
      const resultado = calcularPrecificacao({ ...u, valorCompra: u.valorCompra! }, params)
      const dias = diasEmEstoque(u.dataCompra, c.criadoEm) ?? 0
      const lucro = lucroLiquidoReal({
        precoVendido: c.valorTotal,
        custoBaseProvisionado: resultado.custoBase,
        custoFinanceiroProvisionado: resultado.custoFinanceiroProvisionado,
        valorCompra: u.valorCompra!,
        diasReais: dias,
        marketingReal: u.marketingInvestido ?? 0,
        params,
      })
      return {
        precoVendido: c.valorTotal,
        precoComercial: resultado.precoComercial,
        lp: resultado.lp,
        lucro,
        margemRealizada: lucro / c.valorTotal,
        diasEstoque: dias,
      }
    })

  const n = vendasComDados.length
  const media = (fn: (v: (typeof vendasComDados)[number]) => number) =>
    n ? vendasComDados.reduce((acc, v) => acc + fn(v), 0) / n : 0

  res.json({
    lucroMedioPorMotoVendida: media(v => v.lucro),
    margemLiquidaMediaRealizada: media(v => v.margemRealizada),
    descontoMedioPraticado: media(v => (v.precoComercial - v.precoVendido) / v.precoComercial),
    capitalInvestidoTotal: capitalInvestido,
    capitalParado,
    tempoMedioEstoqueVendidas: media(v => v.diasEstoque),
    motosAcima90Dias: motosAcima90,
    motosEstoqueCritico: motosCriticas,
    motosEstoquePremium: motosPremium,
    pctVendasPrecoComercialOuAcima: n ? vendasComDados.filter(v => v.precoVendido >= v.precoComercial).length / n : 0,
    vendasAbaixoDoLP: vendasComDados.filter(v => v.precoVendido < v.lp).length,
    totalVendasAnalisadas: n,
  })
})

// ---------------------------------------------------------------------------
// Ranking de vendedores (Pilar 7)
// ---------------------------------------------------------------------------

router.get('/relatorios/ranking-vendedores', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const params = await obterParametros(empresaId)

  const contratos = await prisma.contrato.findMany({
    where: { empresaId, status: { not: 'CANCELADO' }, vendedorId: { not: null } },
    include: { unidade: true, vendedor: { select: { id: true, nome: true } } },
  })

  const porVendedor = new Map<string, {
    vendedorId: string
    nome: string
    vendas: { precoVendido: number; precoComercial: number; lucro: number; margem: number }[]
  }>()

  for (const c of contratos) {
    if (!c.vendedor || !c.unidade || c.unidade.valorCompra == null) continue
    const resultado = calcularPrecificacao({ ...c.unidade, valorCompra: c.unidade.valorCompra }, params)
    const dias = diasEmEstoque(c.unidade.dataCompra, c.criadoEm) ?? 0
    const lucro = lucroLiquidoReal({
      precoVendido: c.valorTotal,
      custoBaseProvisionado: resultado.custoBase,
      custoFinanceiroProvisionado: resultado.custoFinanceiroProvisionado,
      valorCompra: c.unidade.valorCompra,
      diasReais: dias,
      marketingReal: c.unidade.marketingInvestido ?? 0,
      params,
    })

    const entry = porVendedor.get(c.vendedor.id) ?? { vendedorId: c.vendedor.id, nome: c.vendedor.nome, vendas: [] }
    entry.vendas.push({
      precoVendido: c.valorTotal,
      precoComercial: resultado.precoComercial,
      lucro,
      margem: lucro / c.valorTotal,
    })
    porVendedor.set(c.vendedor.id, entry)
  }

  const linhas = [...porVendedor.values()].map(v => {
    const n = v.vendas.length
    const ticketMedio = v.vendas.reduce((a, x) => a + x.precoVendido, 0) / n
    const descontoMedio = v.vendas.reduce((a, x) => a + (x.precoComercial - x.precoVendido) / x.precoComercial, 0) / n
    const margemMedia = v.vendas.reduce((a, x) => a + x.margem, 0) / n
    const lucroTotal = v.vendas.reduce((a, x) => a + x.lucro, 0)
    const pctPrecoCheio = v.vendas.filter(x => x.precoVendido >= x.precoComercial).length / n
    return {
      vendedorId: v.vendedorId,
      nome: v.nome,
      qtdeVendas: n,
      ticketMedio,
      descontoMedio,
      margemLiquidaMediaRealizada: margemMedia,
      lucroTotalEntregue: lucroTotal,
      pctVendasPrecoCheioOuAcima: pctPrecoCheio,
    }
  })

  const porLucro = [...linhas].sort((a, b) => b.lucroTotalEntregue - a.lucroTotalEntregue)
  const porVolume = [...linhas].sort((a, b) => b.qtdeVendas - a.qtdeVendas)
  const rankingFinanceiro = new Map(porLucro.map((l, i) => [l.vendedorId, i + 1]))
  const rankingComercial = new Map(porVolume.map((l, i) => [l.vendedorId, i + 1]))

  res.json(
    linhas
      .map(l => ({
        ...l,
        rankingFinanceiro: rankingFinanceiro.get(l.vendedorId)!,
        rankingComercial: rankingComercial.get(l.vendedorId)!,
      }))
      .sort((a, b) => a.rankingFinanceiro - b.rankingFinanceiro)
  )
})

// ---------------------------------------------------------------------------
// Governança (Pilar 9) — histórico de alterações de preço
// ---------------------------------------------------------------------------

router.get('/historico/:unidadeId', requireAuth, async (req: Request, res: Response) => {
  const historico = await prisma.historicoPrecificacao.findMany({
    where: { empresaId: req.user!.empresaId, unidadeId: String(req.params.unidadeId) },
    include: {
      solicitante: { select: { id: true, nome: true } },
      aprovador: { select: { id: true, nome: true } },
    },
    orderBy: { criadoEm: 'desc' },
  })
  res.json(historico)
})

const historicoSchema = z.object({
  unidadeId: z.string(),
  precoNovo: z.number().positive(),
  motivo: z.string().min(5, 'Descreva o motivo da alteração (mínimo 5 caracteres)'),
  margemUtilizada: z.enum(['ESTRATEGICA', 'COMERCIAL', 'NEGOCIACAO', 'LP', 'MANUAL']).default('MANUAL'),
  aprovadorId: z.string().optional(),
})

router.post('/historico', requireAuth, async (req: Request, res: Response) => {
  const parse = historicoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const empresaId = req.user!.empresaId
  const { unidadeId, precoNovo, motivo, margemUtilizada, aprovadorId } = parse.data

  const unidade = await prisma.unidade.findFirst({ where: { id: unidadeId, empresaId } })
  if (!unidade) {
    res.status(404).json({ error: 'Moto não encontrada' })
    return
  }

  // Nível de aprovação (Pilar 9.3): calculado a partir do corredor de preços vigente.
  let nivelAprovacao = 'N0'
  if (unidade.valorCompra != null) {
    const params = await obterParametros(empresaId)
    const resultado = calcularPrecificacao({ ...unidade, valorCompra: unidade.valorCompra }, params)
    if (precoNovo < resultado.lp) nivelAprovacao = 'N3'
    else if (precoNovo < resultado.precoNegociacao) nivelAprovacao = 'N2'
    else if (precoNovo < resultado.precoComercial) nivelAprovacao = 'N1'

    if ((nivelAprovacao === 'N2' || nivelAprovacao === 'N3') && !aprovadorId) {
      res.status(400).json({
        error: `Alteração de nível ${nivelAprovacao} exige um aprovador registrado (Pilar 9 — Matriz de Aprovação).`,
      })
      return
    }
  }

  const registro = await prisma.historicoPrecificacao.create({
    data: {
      empresaId,
      unidadeId,
      precoAnterior: unidade.precoBase ?? null,
      precoNovo,
      motivo,
      margemUtilizada,
      nivelAprovacao,
      solicitanteId: req.user!.sub,
      aprovadorId: aprovadorId ?? null,
    },
  })

  await prisma.unidade.update({ where: { id: unidadeId }, data: { precoBase: precoNovo } })

  res.status(201).json(registro)
})

export default router
