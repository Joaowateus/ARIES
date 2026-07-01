import { OpportunityProps } from '../../domain/entities/Opportunity'
import { IOpportunityRepository } from '../ports/repositories'

export class AvancarEstagioUseCase {
  constructor(private readonly repo: IOpportunityRepository) {}

  async execute(opId: string, agora: string): Promise<OpportunityProps> {
    const op = await this.repo.findById(opId)
    if (!op) throw new Error(`Opportunity não encontrada: ${opId}`)
    op.avancarEstagio(agora)
    await this.repo.save(op)
    return op.toObject()
  }
}
