import { Opportunity, OpportunityProps, OpportunityPriority } from '../../domain/entities/Opportunity'
import { IOpportunityRepository } from '../ports/repositories'

export interface CriarOportunidadeInput {
  titulo: string
  clienteId: string
  responsavelId: string
  prioridade: OpportunityPriority
  valorEstimado: number
  segmentoId?: string
  probabilidade: number
  dataFechamentoPrevista: string
  criadoPor: string
  agora: string
}

export class CriarOportunidadeUseCase {
  constructor(private readonly repo: IOpportunityRepository) {}

  async execute(input: CriarOportunidadeInput): Promise<OpportunityProps> {
    const op = Opportunity.create(input)
    await this.repo.save(op)
    return op.toObject()
  }
}
