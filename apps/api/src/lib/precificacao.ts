/**
 * Motor de Precificação — MM Negócios Veículos.
 *
 * Implementa o "método do divisor" descrito em
 * docs/05-modules/commercial/cap-06-oferta-e-precificacao/ENGENHARIA-PRECIFICACAO-MOTOS-MM.md
 * (Seção 11). Toda margem aplicada é medida sobre o PREÇO de venda, não sobre o custo —
 * por isso o preço é isolado por divisão, não por multiplicação (markup).
 */

export interface ParametrosPrecificacao {
  margemEstrategica: number
  margemComercial: number
  margemNegociacao: number
  margemLP: number
  impostosPct: number
  comissaoPadraoPct: number
  marketingProvisionadoPct: number
  reservaFinanceiraPct: number
  taxaFinanceiraMensal: number
  taxaOportunidadeMensal: number
  diasEstoqueMeta: number
  custoOperacionalRateio: number
  fase1MaxDias: number
  fase2MaxDias: number
  fase3MaxDias: number
  saudePremiumMaxDias: number
  saudeSaudavelMaxDias: number
  saudeAtencaoMaxDias: number
}

export interface UnidadeCustos {
  valorCompra: number
  custoRevisao?: number | null
  custoEstetica?: number | null
  custoDocumentacao?: number | null
  custoFrete?: number | null
  custoCombustivel?: number | null
  custoAcessorios?: number | null
  custoOutros?: number | null
}

export interface PrecificacaoResultado {
  custosDiretos: number
  custoFinanceiroProvisionado: number
  custoOperacionalRateado: number
  custoBase: number
  precoEstrategico: number
  precoComercial: number
  precoNegociacao: number
  lp: number
}

export const FASES = {
  LANCAMENTO: 'Fase 1 - Lançamento (0-30)',
  CONSOLIDACAO: 'Fase 2 - Consolidação (31-60)',
  ACELERACAO: 'Fase 3 - Aceleração de Giro (61-90)',
  ENVELHECIDO: 'Fase 4 - Estoque Envelhecido (>90)',
} as const

export const SAUDE = {
  PREMIUM: 'Estoque Premium',
  SAUDAVEL: 'Estoque Saudável',
  ATENCAO: 'Estoque Atenção',
  CRITICO: 'Estoque Crítico',
} as const

const DIA_MS = 24 * 60 * 60 * 1000

export function somaCustosDiretos(u: UnidadeCustos): number {
  return (
    (u.custoRevisao ?? 0) +
    (u.custoEstetica ?? 0) +
    (u.custoDocumentacao ?? 0) +
    (u.custoFrete ?? 0) +
    (u.custoCombustivel ?? 0) +
    (u.custoAcessorios ?? 0) +
    (u.custoOutros ?? 0)
  )
}

/** Divisor = 1 − (impostos + comissão + marketing + reserva + margem). */
export function divisor(params: ParametrosPrecificacao, margem: number): number {
  const d =
    1 -
    (params.impostosPct +
      params.comissaoPadraoPct +
      params.marketingProvisionadoPct +
      params.reservaFinanceiraPct +
      margem)
  if (d <= 0) {
    throw new Error(
      'Parâmetros de precificação inválidos: a soma de impostos + comissão + marketing + reserva + margem deve ser menor que 100%.'
    )
  }
  return d
}

export function precoPorDivisor(custoBase: number, params: ParametrosPrecificacao, margem: number): number {
  return custoBase / divisor(params, margem)
}

export function calcularPrecificacao(u: UnidadeCustos, params: ParametrosPrecificacao): PrecificacaoResultado {
  const custosDiretos = somaCustosDiretos(u)
  const custoFinanceiroProvisionado =
    u.valorCompra * params.taxaFinanceiraMensal * (params.diasEstoqueMeta / 30)
  const custoOperacionalRateado = params.custoOperacionalRateio
  const custoBase = u.valorCompra + custosDiretos + custoFinanceiroProvisionado + custoOperacionalRateado

  return {
    custosDiretos,
    custoFinanceiroProvisionado,
    custoOperacionalRateado,
    custoBase,
    precoEstrategico: precoPorDivisor(custoBase, params, params.margemEstrategica),
    precoComercial: precoPorDivisor(custoBase, params, params.margemComercial),
    precoNegociacao: precoPorDivisor(custoBase, params, params.margemNegociacao),
    lp: precoPorDivisor(custoBase, params, params.margemLP),
  }
}

/** Dias em estoque: até a data de venda (se vendida) ou até hoje. */
export function diasEmEstoque(dataCompra: Date | null | undefined, dataVenda?: Date | null): number | null {
  if (!dataCompra) return null
  const fim = dataVenda ?? new Date()
  return Math.floor((fim.getTime() - dataCompra.getTime()) / DIA_MS)
}

export function faseCiclo(dias: number | null, params: ParametrosPrecificacao): string {
  if (dias == null) return 'N/A'
  if (dias <= params.fase1MaxDias) return FASES.LANCAMENTO
  if (dias <= params.fase2MaxDias) return FASES.CONSOLIDACAO
  if (dias <= params.fase3MaxDias) return FASES.ACELERACAO
  return FASES.ENVELHECIDO
}

export function classificacaoSaude(dias: number | null, params: ParametrosPrecificacao): string {
  if (dias == null) return 'N/A'
  if (dias <= params.saudePremiumMaxDias) return SAUDE.PREMIUM
  if (dias <= params.saudeSaudavelMaxDias) return SAUDE.SAUDAVEL
  if (dias <= params.saudeAtencaoMaxDias) return SAUDE.ATENCAO
  return SAUDE.CRITICO
}

/** Preço sugerido do dia conforme a Matriz de Evolução (Pilar 10). Nunca abaixo do LP. */
export function precoSugerido(
  dias: number | null,
  params: ParametrosPrecificacao,
  resultado: PrecificacaoResultado
): number | null {
  if (dias == null) return null
  if (dias <= params.fase1MaxDias) return resultado.precoEstrategico
  if (dias <= params.fase2MaxDias) return resultado.precoComercial
  return resultado.precoNegociacao
}

export function custoFinanceiroReal(valorCompra: number, params: ParametrosPrecificacao, diasReais: number): number {
  return valorCompra * params.taxaFinanceiraMensal * (diasReais / 30)
}

export function custoOportunidadeReal(valorCompra: number, params: ParametrosPrecificacao, diasReais: number): number {
  return valorCompra * params.taxaOportunidadeMensal * (diasReais / 30)
}

/**
 * Reconciliação planejado vs. real (Seção 11.5 do manual): recalcula o lucro líquido
 * com os valores efetivos de uma venda já registrada (dias reais, marketing real).
 */
export function lucroLiquidoReal(args: {
  precoVendido: number
  custoBaseProvisionado: number
  custoFinanceiroProvisionado: number
  valorCompra: number
  diasReais: number
  marketingReal: number
  params: ParametrosPrecificacao
}): number {
  const { precoVendido, custoBaseProvisionado, custoFinanceiroProvisionado, valorCompra, diasReais, marketingReal, params } = args
  const custoBaseReal =
    custoBaseProvisionado - custoFinanceiroProvisionado + custoFinanceiroReal(valorCompra, params, diasReais)

  return (
    precoVendido -
    custoBaseReal -
    precoVendido * params.impostosPct -
    precoVendido * params.comissaoPadraoPct -
    marketingReal -
    precoVendido * params.reservaFinanceiraPct
  )
}

export const PARAMETROS_PADRAO: ParametrosPrecificacao = {
  margemEstrategica: 0.25,
  margemComercial: 0.16,
  margemNegociacao: 0.09,
  margemLP: 0.04,
  impostosPct: 0.06,
  comissaoPadraoPct: 0.03,
  marketingProvisionadoPct: 0.025,
  reservaFinanceiraPct: 0.02,
  taxaFinanceiraMensal: 0.02,
  taxaOportunidadeMensal: 0.015,
  diasEstoqueMeta: 45,
  custoOperacionalRateio: 180,
  fase1MaxDias: 30,
  fase2MaxDias: 60,
  fase3MaxDias: 90,
  saudePremiumMaxDias: 20,
  saudeSaudavelMaxDias: 45,
  saudeAtencaoMaxDias: 75,
}
