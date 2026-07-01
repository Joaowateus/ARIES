import { ContractProps } from '../../domain/entities/Contract'
import { IContractRepository } from '../ports/repositories'

export interface EncerrarContratoInput {
  contratoId: string
  agora: string
}

export interface EncerrarContratoOutput {
  contract: ContractProps
  eventPayload: {
    contrato_id: string
    oportunidade_id: string
    cliente_id: string
    encerrado_em: string
  }
}

export class EncerrarContratoUseCase {
  constructor(private readonly repo: IContractRepository) {}

  async execute(input: EncerrarContratoInput): Promise<EncerrarContratoOutput> {
    const contract = await this.repo.findById(input.contratoId)
    if (!contract) throw new Error(`Contrato ${input.contratoId} não encontrado`)

    contract.encerrar(input.agora)
    await this.repo.save(contract)

    return {
      contract: contract.toObject(),
      eventPayload: {
        contrato_id: contract.id,
        oportunidade_id: contract.oportunidadeId,
        cliente_id: contract.clienteId,
        encerrado_em: contract.toObject().encerradoEm!,
      },
    }
  }
}
