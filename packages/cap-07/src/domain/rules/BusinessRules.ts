import { Vendedor, PerformanceMensal } from '../entities/Vendedor'

/** RN-E01: todo vendedor deve ter meta definida para poder registrar performance. */
export function rn_e01_metaObrigatoria(vendedor: Vendedor, periodo: string): void {
  if (!vendedor.metaDoPeriodo(periodo)) {
    throw new Error(`RN-E01: vendedor ${vendedor.id} não possui meta para o período ${periodo}`)
  }
}

/** RN-E02: classificação de performance por faixa de atingimento. */
export function rn_e02_classificarPerformance(taxaAtingimento: number): PerformanceMensal['classificacao'] {
  if (taxaAtingimento >= 100) return 'ACIMA'
  if (taxaAtingimento >= 80) return 'DENTRO'
  return 'ABAIXO'
}

/**
 * RN-E05: ranking de performance da equipe para o período.
 * Ordena vendedores por taxa de atingimento de meta decrescente.
 */
export function rn_e05_rankingEquipe(
  vendedores: Vendedor[],
  periodo: string,
): Array<{ vendedorId: string; nome: string; taxaAtingimento: number; classificacao: PerformanceMensal['classificacao'] }> {
  return vendedores
    .map(v => {
      const perf = v.performanceDoPeriodo(periodo)
      return {
        vendedorId: v.id,
        nome: v.nome,
        taxaAtingimento: perf?.taxaAtingimentoMeta ?? 0,
        classificacao: perf?.classificacao ?? 'ABAIXO',
      }
    })
    .sort((a, b) => b.taxaAtingimento - a.taxaAtingimento)
}

/**
 * RN-E06: alerta de baixa performance — vendedores abaixo de 80% por 2+ períodos consecutivos.
 */
export function rn_e06_alertaBaixaPerformance(vendedor: Vendedor, ultimosPeriodos: number = 2): boolean {
  const perfs = [...vendedor.performances]
    .sort((a, b) => b.periodo.localeCompare(a.periodo))
    .slice(0, ultimosPeriodos)

  if (perfs.length < ultimosPeriodos) return false
  return perfs.every(p => p.classificacao === 'ABAIXO')
}
