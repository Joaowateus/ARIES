import { CustomerHealth, CustomerHealthProps } from '../../domain/entities/CustomerHealth'
import { ICustomerRepository, ICustomerHealthRepository } from '../ports/repositories'

export interface AtualizarHealthScoreInput {
  customerId: string
  score: number
  fatores: string[]
  agora: string
}

export interface AtualizarHealthScoreOutput {
  health: CustomerHealthProps
  eventPayload: {
    customer_id: string
    score_anterior: number
    score_novo: number
    nivel: string
    avaliado_em: string
  }
}

export class AtualizarHealthScoreUseCase {
  constructor(
    private readonly customerRepo: ICustomerRepository,
    private readonly healthRepo: ICustomerHealthRepository,
  ) {}

  async execute(input: AtualizarHealthScoreInput): Promise<AtualizarHealthScoreOutput> {
    const customer = await this.customerRepo.findById(input.customerId)
    if (!customer) throw new Error(`Customer ${input.customerId} não encontrado`)

    const scoreAnterior = customer.healthScore

    const health = CustomerHealth.create({
      customerId: input.customerId,
      score: input.score,
      fatores: input.fatores,
      avaliadoEm: input.agora,
    })

    customer.atualizarHealthScore(input.score, input.agora)

    await this.healthRepo.save(health)
    await this.customerRepo.save(customer)

    return {
      health: health.toObject(),
      eventPayload: {
        customer_id: customer.id,
        score_anterior: scoreAnterior,
        score_novo: input.score,
        nivel: health.nivel,
        avaliado_em: input.agora,
      },
    }
  }
}
