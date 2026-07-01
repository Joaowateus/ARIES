import { KpiSnapshot, KpiNome, KpiDominio } from '../../domain/entities/KpiSnapshot'
import { IKpiSnapshotRepository } from '../ports/repositories'

export interface RegistrarKpiInput {
  kpiNome: KpiNome
  dominio: KpiDominio
  periodo: string
  valor: number
  agora: string
  ultimosPeriodosBaseline?: number  // default 3
}

export interface RegistrarKpiOutput {
  snapshot: ReturnType<KpiSnapshot['toObject']>
  possuiAnomalia: boolean
}

export class RegistrarKpiUseCase {
  constructor(private readonly repo: IKpiSnapshotRepository) {}

  async execute(input: RegistrarKpiInput): Promise<RegistrarKpiOutput> {
    const periodos = input.ultimosPeriodosBaseline ?? 3
    const baseline = await this.repo.findBaseline(input.kpiNome, periodos)

    const snapshot = KpiSnapshot.create({
      kpiNome: input.kpiNome,
      dominio: input.dominio,
      periodo: input.periodo,
      valor: input.valor,
      baseline: baseline > 0 ? baseline : undefined,
      registradoEm: input.agora,
    })

    await this.repo.save(snapshot)

    return {
      snapshot: snapshot.toObject(),
      possuiAnomalia: snapshot.possuiAnomalia(),
    }
  }
}
