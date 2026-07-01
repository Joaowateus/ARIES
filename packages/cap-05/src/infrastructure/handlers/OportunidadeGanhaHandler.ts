import { CriarClienteUseCase } from '../../application/use-cases/CriarClienteUseCase'

/** Payload do evento cap03.oportunidade.ganha (ADR-0006) */
export interface OportunidadeGanhaPayload {
  oportunidade_id: string
  deal_close_id: string
  cliente_id: string
  valor_total: number
  mrr: number
  segmento_id?: string
  data_inicio: string
  data_fim: string
  forma_pagamento: string
  condicoes_json: Record<string, unknown>
  responsavel_cs_id: string
  fechado_por: string
  fechado_em: string
}

export class OportunidadeGanhaHandler {
  constructor(private readonly criarCliente: CriarClienteUseCase) {}

  async handle(payload: OportunidadeGanhaPayload, agora: string) {
    return this.criarCliente.execute({
      clienteId: payload.cliente_id,
      oportunidadeId: payload.oportunidade_id,
      nome: `Cliente ${payload.cliente_id}`,
      segmentoId: payload.segmento_id,
      responsavelCsId: payload.responsavel_cs_id,
      agora,
    })
  }
}
