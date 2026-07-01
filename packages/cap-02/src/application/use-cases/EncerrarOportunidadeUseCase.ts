import { OpportunityProps } from '../../domain/entities/Opportunity'
import { IOpportunityRepository } from '../ports/repositories'

export interface EncerrarInput {
  opId: string
  resultado: 'ganha' | 'perdida' | 'cancelada'
  motivo: string
  concorrenteVencedorId?: string
  agora: string
}

export class EncerrarOportunidadeUseCase {
  constructor(private readonly repo: IOpportunityRepository) {}

  async execute(input: EncerrarInput): Promise<OpportunityProps> {
    const op = await this.repo.findById(input.opId)
    if (!op) throw new Error(`Opportunity não encontrada: ${input.opId}`)

    if (input.resultado === 'ganha') {
      op.marcarGanha(input.motivo, input.agora)
    } else if (input.resultado === 'perdida') {
      op.marcarPerdida(input.motivo, input.concorrenteVencedorId, input.agora)
    } else {
      op.cancelar(input.motivo, input.agora)
    }

    await this.repo.save(op)
    return op.toObject()
  }
}
