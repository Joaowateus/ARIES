import { KpiSnapshot, KpiNome } from '../entities/KpiSnapshot'
import { ClassificacaoDiagnostico, Hipotese } from '../entities/Diagnostico'

/** RN-D01: todo evento operacional relevante deve gerar ao menos um KpiSnapshot. */
export function rn_d01_kpiObrigatorio(snapshots: KpiSnapshot[]): void {
  if (snapshots.length === 0) {
    throw new Error('RN-D01: ao menos um KpiSnapshot é obrigatório para gerar diagnóstico')
  }
}

/** RN-D02: diagnóstico exige ao menos uma anomalia detectada. */
export function rn_d02_anomaliaDetectada(snapshots: KpiSnapshot[]): void {
  const comAnomalia = snapshots.filter(s => s.possuiAnomalia())
  if (comAnomalia.length === 0) {
    throw new Error('RN-D02: nenhuma anomalia detectada nos KPIs fornecidos')
  }
}

/**
 * Engine de Diagnóstico — regra de classificação baseada nos KPIs afetados.
 *
 * Heurísticas derivadas dos padrões operacionais do Commercial OS:
 * - taxa_fechamento ↓ + ciclo_medio_dias ↑ → NEGOCIACAO
 * - taxa_conversao_pipeline ↓ (sem queda de fechamento) → DEMANDA ou ICP
 * - desconto_medio_percentual ↑ + taxa_aprovacao_propostas ↓ → PRECO
 * - health_score_medio ↓ + churn_rate ↑ → RETENCAO
 * - onboarding_conclusao_rate ↓ → EXECUCAO
 * - queda sistêmica em múltiplos KPIs → MERCADO
 */
export function rn_d_classificarAnomalia(kpisAfetados: KpiNome[]): ClassificacaoDiagnostico {
  const has = (...k: KpiNome[]) => k.some(kpi => kpisAfetados.includes(kpi))

  if (has('taxa_conversao_pipeline') && !has('taxa_fechamento')) {
    // queda no topo do funil sem queda no fechamento → ICP se health_score afetado, senão DEMANDA
    return has('health_score_medio') && !has('churn_rate') ? 'ICP' : 'DEMANDA'
  }
  if (has('health_score_medio', 'churn_rate')) return 'RETENCAO'
  if (has('desconto_medio_percentual', 'taxa_aprovacao_propostas')) return 'PRECO'
  if (has('taxa_fechamento', 'ciclo_medio_dias')) return 'NEGOCIACAO'
  if (has('onboarding_conclusao_rate')) return 'EXECUCAO'
  // múltiplos domínios afetados simultaneamente → mercado
  return 'MERCADO'
}

/** Gera hipóteses ordenadas por confiança para uma classificação. */
export function rn_d_gerarHipoteses(
  classificacao: ClassificacaoDiagnostico,
  kpisAfetados: KpiNome[],
): Hipotese[] {
  const mapa: Record<ClassificacaoDiagnostico, Hipotese[]> = {
    DEMANDA: [
      { descricao: 'Volume de leads insuficiente no topo do funil', confianca: 80, evidencias: ['taxa_conversao_pipeline'] },
      { descricao: 'Canais de aquisição com desempenho abaixo do esperado', confianca: 60, evidencias: ['taxa_conversao_pipeline'] },
    ],
    PRECO: [
      { descricao: 'Política de descontos sendo utilizada além do planejado', confianca: 85, evidencias: ['desconto_medio_percentual'] },
      { descricao: 'Percepção de valor baixa pelo mercado-alvo', confianca: 55, evidencias: ['taxa_aprovacao_propostas'] },
    ],
    NEGOCIACAO: [
      { descricao: 'Vendedores com dificuldade na etapa de negociação', confianca: 75, evidencias: ['taxa_fechamento', 'ciclo_medio_dias'] },
      { descricao: 'Processo de negociação sem script ou metodologia padronizada', confianca: 65, evidencias: ['ciclo_medio_dias'] },
    ],
    ICP: [
      { descricao: 'Leads fora do perfil ideal de cliente', confianca: 80, evidencias: ['taxa_conversao_pipeline', 'health_score_medio'] },
      { descricao: 'Critérios de qualificação BANT mal calibrados', confianca: 60, evidencias: ['taxa_conversao_pipeline'] },
    ],
    EXECUCAO: [
      { descricao: 'Processo de onboarding com gargalos operacionais', confianca: 85, evidencias: ['onboarding_conclusao_rate'] },
      { descricao: 'Time de CS sobrecarregado ou sem processo definido', confianca: 70, evidencias: ['onboarding_conclusao_rate'] },
    ],
    MERCADO: [
      { descricao: 'Fatores macroeconômicos ou competitivos afetando múltiplos KPIs', confianca: 60, evidencias: kpisAfetados },
      { descricao: 'Mudança de comportamento do cliente no segmento', confianca: 50, evidencias: kpisAfetados },
    ],
    RETENCAO: [
      { descricao: 'Clientes sem acompanhamento adequado de CS pós-onboarding', confianca: 80, evidencias: ['health_score_medio', 'churn_rate'] },
      { descricao: 'Produto não entregando o valor prometido na venda', confianca: 65, evidencias: ['health_score_medio'] },
    ],
  }

  return mapa[classificacao] ?? []
}

/**
 * RN-D03: prioriza diagnósticos abertos usando MUP score.
 * Retorna IDs ordenados do maior para o menor impacto.
 */
export function rn_d03_priorizarMup<T extends { id: string; mupScore: { total: number } }>(
  diagnosticos: T[],
): T[] {
  return [...diagnosticos].sort((a, b) => b.mupScore.total - a.mupScore.total)
}

/** RN-D06: verifica se existe histórico similar antes de criar novo plano. */
export function rn_d06_verificarHistorico(
  classificacao: ClassificacaoDiagnostico,
  historico: Array<{ classificacao: string; resultado?: string }>,
): { temHistorico: boolean; decisoesEfetivas: number; decisoesInefetivas: number } {
  const similar = historico.filter(h => h.classificacao === classificacao)
  const efetivas = similar.filter(h => h.resultado === 'EFETIVO').length
  const inefetivas = similar.filter(h => h.resultado === 'INEFETIVO').length
  return { temHistorico: similar.length > 0, decisoesEfetivas: efetivas, decisoesInefetivas: inefetivas }
}
