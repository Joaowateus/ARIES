import { Diagnostico } from '../../domain/entities/Diagnostico'
import { rn_d03_priorizarMup } from '../../domain/rules/BusinessRules'
import { IDiagnosticoRepository } from '../ports/repositories'

export interface PriorizarDiagnosticosOutput {
  diagnosticos: ReturnType<Diagnostico['toObject']>[]
  totalAbertos: number
}

export class PriorizarDiagnosticosUseCase {
  constructor(private readonly diagnosticoRepo: IDiagnosticoRepository) {}

  async execute(): Promise<PriorizarDiagnosticosOutput> {
    const abertos = await this.diagnosticoRepo.findAbertos()
    const priorizados = rn_d03_priorizarMup(
      abertos.map(d => ({ id: d.id, mupScore: d.mupScore, _entity: d })),
    )

    return {
      diagnosticos: priorizados.map(p => p._entity.toObject()),
      totalAbertos: abertos.length,
    }
  }
}
