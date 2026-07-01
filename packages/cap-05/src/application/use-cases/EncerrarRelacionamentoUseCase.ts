import { CustomerProps } from '../../domain/entities/Customer'
import { rn_c07_encerrarCliente } from '../../domain/rules/BusinessRules'
import { ICustomerRepository } from '../ports/repositories'

export interface EncerrarRelacionamentoInput {
  customerId: string
  motivo: string
  agora: string
}

export interface EncerrarRelacionamentoOutput {
  customer: CustomerProps
  eventPayload: {
    customer_id: string
    cliente_id: string
    oportunidade_id: string
    motivo: string
    encerrado_em: string
  }
}

export class EncerrarRelacionamentoUseCase {
  constructor(private readonly customerRepo: ICustomerRepository) {}

  async execute(input: EncerrarRelacionamentoInput): Promise<EncerrarRelacionamentoOutput> {
    const customer = await this.customerRepo.findById(input.customerId)
    if (!customer) throw new Error(`Customer ${input.customerId} não encontrado`)

    rn_c07_encerrarCliente(customer)
    customer.encerrar(input.motivo, input.agora)
    await this.customerRepo.save(customer)

    return {
      customer: customer.toObject(),
      eventPayload: {
        customer_id: customer.id,
        cliente_id: customer.clienteId,
        oportunidade_id: customer.oportunidadeId,
        motivo: input.motivo,
        encerrado_em: input.agora,
      },
    }
  }
}
