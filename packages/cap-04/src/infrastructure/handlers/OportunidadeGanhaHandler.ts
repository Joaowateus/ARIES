import { RegistrarContratoUseCase } from '../../application/use-cases/RegistrarContratoUseCase'

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
  constructor(private readonly registrarContrato: RegistrarContratoUseCase) {}

  async handle(payload: OportunidadeGanhaPayload, agora: string) {
    return this.registrarContrato.execute({
      oportunidadeId: payload.oportunidade_id,
      dealCloseId: payload.deal_close_id,
      clienteId: payload.cliente_id,
      valorTotal: payload.valor_total,
      mrr: payload.mrr,
      segmentoId: payload.segmento_id,
      dataInicio: payload.data_inicio,
      dataFim: payload.data_fim,
      formaPagamento: payload.forma_pagamento as any,
      condicoesJson: payload.condicoes_json,
      responsavelCsId: payload.responsavel_cs_id,
      criadoPor: payload.fechado_por,
      agora,
    })
  }
}
