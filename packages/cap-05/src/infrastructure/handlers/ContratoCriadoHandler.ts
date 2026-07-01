import { ICustomerRepository } from '../../application/ports/repositories'

/** Payload do evento cap04.contrato.criado */
export interface ContratoCriadoPayload {
  contrato_id: string
  oportunidade_id: string
  cliente_id: string
  valor_total: number
  mrr: number
  arr: number
  segmento_id?: string
  data_inicio: string
  data_fim: string
  forma_pagamento: string
}

export class ContratoCriadoHandler {
  constructor(private readonly customerRepo: ICustomerRepository) {}

  async handle(payload: ContratoCriadoPayload, agora: string): Promise<void> {
    const customer = await this.customerRepo.findByOportunidade(payload.oportunidade_id)
    if (!customer) return // cliente pode não existir se CAP-05 não consumiu o evento anterior

    customer.vincularContrato(payload.contrato_id, agora)
    await this.customerRepo.save(customer)
  }
}
