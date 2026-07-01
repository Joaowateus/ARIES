import { Contract, ContractProps, FormaPagamento } from '../../domain/entities/Contract'
import { IContractRepository } from '../ports/repositories'

/** Input derivado diretamente do payload ADR-0006 de cap03.oportunidade.ganha. */
export interface RegistrarContratoInput {
  oportunidadeId: string
  dealCloseId: string
  clienteId: string
  valorTotal: number
  mrr: number
  segmentoId?: string
  dataInicio: string
  dataFim: string
  formaPagamento: FormaPagamento
  condicoesJson: Record<string, unknown>
  responsavelCsId: string
  criadoPor: string
  agora: string
}

export interface RegistrarContratoOutput {
  contract: ContractProps
  /** Payload para publicar cap04.contrato.criado */
  eventPayload: {
    contrato_id: string
    oportunidade_id: string
    cliente_id: string
    valor_total: number
    mrr: number
    arr: number
    segmento_id?: string
    data_inicio: string
    data_fim: string
    forma_pagamento: FormaPagamento
  }
}

export class RegistrarContratoUseCase {
  constructor(private readonly repo: IContractRepository) {}

  async execute(input: RegistrarContratoInput): Promise<RegistrarContratoOutput> {
    // Idempotência: mesma oportunidade → mesmo contrato
    const existente = await this.repo.findByOportunidade(input.oportunidadeId)
    if (existente) {
      return this.buildOutput(existente)
    }

    const contract = Contract.create({
      oportunidadeId: input.oportunidadeId,
      dealCloseId: input.dealCloseId,
      clienteId: input.clienteId,
      valorTotal: input.valorTotal,
      mrr: input.mrr,
      segmentoId: input.segmentoId,
      dataInicio: input.dataInicio,
      dataFim: input.dataFim,
      formaPagamento: input.formaPagamento,
      condicoesJson: input.condicoesJson,
      responsavelCsId: input.responsavelCsId,
      criadoPor: input.criadoPor,
      agora: input.agora,
    })

    await this.repo.save(contract)
    return this.buildOutput(contract)
  }

  private buildOutput(contract: Contract): RegistrarContratoOutput {
    return {
      contract: contract.toObject(),
      eventPayload: {
        contrato_id: contract.id,
        oportunidade_id: contract.oportunidadeId,
        cliente_id: contract.clienteId,
        valor_total: contract.valorTotal,
        mrr: contract.mrr,
        arr: contract.arr,
        segmento_id: contract.segmentoId,
        data_inicio: contract.dataInicio,
        data_fim: contract.dataFim,
        forma_pagamento: contract.formaPagamento,
      },
    }
  }
}
