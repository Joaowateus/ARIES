import { ContractProps } from '../../domain/entities/Contract'
import { IContractRepository } from '../ports/repositories'

export interface CancelarContratoInput {
  contratoId: string
  motivo: string
  agora: string
}

export interface CancelarContratoOutput {
  contract: ContractProps
  eventPayload: {
    contrato_id: string
    oportunidade_id: string
    cliente_id: string
    motivo: string
    cancelado_em: string
  }
}

export class CancelarContratoUseCase {
  constructor(private readonly repo: IContractRepository) {}

  async execute(input: CancelarContratoInput): Promise<CancelarContratoOutput> {
    const contract = await this.repo.findById(input.contratoId)
    if (!contract) throw new Error(`Contrato ${input.contratoId} não encontrado`)

    contract.cancelar(input.motivo, input.agora)
    await this.repo.save(contract)

    const props = contract.toObject()

    return {
      contract: props,
      eventPayload: {
        contrato_id: contract.id,
        oportunidade_id: contract.oportunidadeId,
        cliente_id: contract.clienteId,
        motivo: props.motivoCancelamento!,
        cancelado_em: input.agora,
      },
    }
  }
}
