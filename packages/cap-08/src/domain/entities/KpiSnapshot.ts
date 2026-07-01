/**
 * KpiSnapshot — medição pontual de um KPI operacional.
 *
 * Produzido pelos CAPs ao publicar eventos e ingerido pela Engine de Observabilidade.
 * A anomalia é detectada comparando o valor atual com o baseline histórico.
 * RN-D01: todo evento operacional relevante deve gerar ao menos um KpiSnapshot.
 */

import { v4 as uuidv4 } from 'uuid'

export type KpiDominio = 'VENDAS' | 'RECEITA' | 'CS' | 'PROPOSTAS' | 'PIPELINE'

export type KpiNome =
  | 'taxa_conversao_pipeline'
  | 'taxa_fechamento'
  | 'mrr_total'
  | 'arr_total'
  | 'ciclo_medio_dias'
  | 'health_score_medio'
  | 'onboarding_conclusao_rate'
  | 'taxa_aprovacao_propostas'
  | 'desconto_medio_percentual'
  | 'churn_rate'

export interface AnomaliaDetectada {
  detectada: boolean
  desvioPercent: number
  direcao: 'QUEDA' | 'ALTA'
  severidade: 'LEVE' | 'MODERADA' | 'CRITICA'
}

export interface KpiSnapshotProps {
  id: string
  kpiNome: KpiNome
  dominio: KpiDominio
  valor: number
  baseline?: number
  periodo: string
  anomalia?: AnomaliaDetectada
  registradoEm: string
}

const LIMIAR_LEVE = 10
const LIMIAR_MODERADA = 20
const LIMIAR_CRITICA = 35

export function detectarAnomalia(valor: number, baseline: number | undefined): AnomaliaDetectada | undefined {
  if (baseline === undefined || baseline === 0) return undefined
  const desvioPercent = Math.abs(((valor - baseline) / baseline) * 100)
  if (desvioPercent < LIMIAR_LEVE) return undefined

  const direcao: 'QUEDA' | 'ALTA' = valor < baseline ? 'QUEDA' : 'ALTA'
  let severidade: 'LEVE' | 'MODERADA' | 'CRITICA' = 'LEVE'
  if (desvioPercent >= LIMIAR_CRITICA) severidade = 'CRITICA'
  else if (desvioPercent >= LIMIAR_MODERADA) severidade = 'MODERADA'

  return { detectada: true, desvioPercent, direcao, severidade }
}

export class KpiSnapshot {
  private constructor(private props: KpiSnapshotProps) {}

  static create(params: Omit<KpiSnapshotProps, 'id' | 'anomalia'>): KpiSnapshot {
    const anomalia = detectarAnomalia(params.valor, params.baseline)
    return new KpiSnapshot({ ...params, id: uuidv4(), anomalia })
  }

  static reconstitute(props: KpiSnapshotProps): KpiSnapshot {
    return new KpiSnapshot(props)
  }

  get id(): string { return this.props.id }
  get kpiNome(): KpiNome { return this.props.kpiNome }
  get dominio(): KpiDominio { return this.props.dominio }
  get valor(): number { return this.props.valor }
  get baseline(): number | undefined { return this.props.baseline }
  get periodo(): string { return this.props.periodo }
  get anomalia(): AnomaliaDetectada | undefined { return this.props.anomalia ? { ...this.props.anomalia } : undefined }
  get registradoEm(): string { return this.props.registradoEm }

  possuiAnomalia(): boolean { return !!this.props.anomalia?.detectada }

  toObject(): KpiSnapshotProps {
    return { ...this.props, anomalia: this.props.anomalia ? { ...this.props.anomalia } : undefined }
  }
}
