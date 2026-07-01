import { CustomerInteraction, CustomerInteractionProps, InteractionTipo } from '../../domain/entities/CustomerInteraction'
import { ICustomerRepository, ICustomerInteractionRepository } from '../ports/repositories'

export interface RegistrarInteracaoInput {
  customerId: string
  tipo: InteractionTipo
  descricao: string
  realizadoPor: string
  agora: string
}

export interface RegistrarInteracaoOutput {
  interaction: CustomerInteractionProps
}

export class RegistrarInteracaoUseCase {
  constructor(
    private readonly customerRepo: ICustomerRepository,
    private readonly interactionRepo: ICustomerInteractionRepository,
  ) {}

  async execute(input: RegistrarInteracaoInput): Promise<RegistrarInteracaoOutput> {
    const customer = await this.customerRepo.findById(input.customerId)
    if (!customer) throw new Error(`Customer ${input.customerId} não encontrado`)

    const interaction = CustomerInteraction.create({
      customerId: input.customerId,
      tipo: input.tipo,
      descricao: input.descricao,
      realizadoPor: input.realizadoPor,
      realizadoEm: input.agora,
    })

    await this.interactionRepo.save(interaction)

    return { interaction: interaction.toObject() }
  }
}
