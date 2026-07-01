import { KpiSnapshot, KpiNome, KpiDominio } from '../../domain/entities/KpiSnapshot'
import { Diagnostico, ClassificacaoDiagnostico } from '../../domain/entities/Diagnostico'
import { ActionPlan } from '../../domain/entities/ActionPlan'
import { DecisaoRecord } from '../../domain/entities/DecisaoRecord'

export interface IKpiSnapshotRepository {
  save(snapshot: KpiSnapshot): Promise<void>
  findByPeriodo(periodo: string): Promise<KpiSnapshot[]>
  findByKpi(kpiNome: KpiNome, periodos?: string[]): Promise<KpiSnapshot[]>
  findComAnomalia(periodo: string): Promise<KpiSnapshot[]>
  findBaseline(kpiNome: KpiNome, ultimosPeriodos: number): Promise<number>
}

export interface IDiagnosticoRepository {
  save(diagnostico: Diagnostico): Promise<void>
  findById(id: string): Promise<Diagnostico | null>
  findAbertos(): Promise<Diagnostico[]>
  findByClassificacao(classificacao: ClassificacaoDiagnostico): Promise<Diagnostico[]>
  findByPeriodo(periodo: string): Promise<Diagnostico[]>
  findAll(): Promise<Diagnostico[]>
}

export interface IActionPlanRepository {
  save(plan: ActionPlan): Promise<void>
  findById(id: string): Promise<ActionPlan | null>
  findByDiagnostico(diagnosticoId: string): Promise<ActionPlan | null>
  findAtivos(): Promise<ActionPlan[]>
}

export interface IDecisaoRecordRepository {
  save(record: DecisaoRecord): Promise<void>
  findById(id: string): Promise<DecisaoRecord | null>
  findByClassificacao(classificacao: ClassificacaoDiagnostico): Promise<DecisaoRecord[]>
  findFechados(): Promise<DecisaoRecord[]>
  findAll(): Promise<DecisaoRecord[]>
}
