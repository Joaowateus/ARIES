/**
 * DealClose — registro de fechamento de oportunidade.
 * ADR-0006: payload enriquecido e auto-contido para `oportunidade.ganha`.
 * RN-Q02: valor_total > 0 para fechar como ganha.
 * RN-Q03: motivo de perda obrigatório ao fechar como perdida.
 * RN-Q05: formaPagamento obrigatória em fechamento ganho.
 */

import { v4 as uuidv4 } from 'uuid'

export type DealResult = 'GANHA' | 'PERDIDA'
export type FormaPagamento = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'UNICO'

export interface DealCloseProps {
  id: string
  oportunidadeId: string
  clienteId: string
  resultado: DealResult
  valorTotal: number
  mrr: number                      // Monthly Recurring Revenue
  segmentoId?: string
  cicloDias: number
  dataInicio?: string
  dataFim?: string
  formaPagamento?: FormaPagamento
  condicoesJson?: Record<string, unknown>
  responsavelCsId?: string         // CS rep para onboarding
  motivoPerda?: string
  concorrenteVencedorId?: string
  qualificationId: string
  fechadoPor: string
  fechadoEm: string
}

export class DealClose {
  private constructor(private props: DealCloseProps) {}

  static criarGanha(params: {
    oportunidadeId: string
    clienteId: string
    valorTotal: number
    mrr: number
    segmentoId?: string
    cicloDias: number
    dataInicio: string
    dataFim: string
    formaPagamento: FormaPagamento
    condicoesJson?: Record<string, unknown>
    responsavelCsId: string
    qualificationId: string
    fechadoPor: string
    agora: string
  }): DealClose {
    if (params.valorTotal <= 0) {
      throw new Error('DealClose: valorTotal deve ser > 0 para fechamento ganho (RN-Q02)')
    }
    if (!params.responsavelCsId) {
      throw new Error('DealClose: responsavelCsId obrigatório no fechamento ganho (RN-Q05)')
    }
    return new DealClose({
      id: uuidv4(),
      oportunidadeId: params.oportunidadeId,
      clienteId: params.clienteId,
      resultado: 'GANHA',
      valorTotal: params.valorTotal,
      mrr: params.mrr,
      segmentoId: params.segmentoId,
      cicloDias: params.cicloDias,
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      formaPagamento: params.formaPagamento,
      condicoesJson: params.condicoesJson,
      responsavelCsId: params.responsavelCsId,
      qualificationId: params.qualificationId,
      fechadoPor: params.fechadoPor,
      fechadoEm: params.agora,
    })
  }

  static criarPerdida(params: {
    oportunidadeId: string
    clienteId: string
    valorTotal: number
    segmentoId?: string
    cicloDias: number
    motivoPerda: string
    concorrenteVencedorId?: string
    qualificationId: string
    fechadoPor: string
    agora: string
  }): DealClose {
    if (!params.motivoPerda?.trim()) {
      throw new Error('DealClose: motivoPerda obrigatório no fechamento perdido (RN-Q03)')
    }
    return new DealClose({
      id: uuidv4(),
      oportunidadeId: params.oportunidadeId,
      clienteId: params.clienteId,
      resultado: 'PERDIDA',
      valorTotal: params.valorTotal,
      mrr: 0,
      segmentoId: params.segmentoId,
      cicloDias: params.cicloDias,
      motivoPerda: params.motivoPerda,
      concorrenteVencedorId: params.concorrenteVencedorId,
      qualificationId: params.qualificationId,
      fechadoPor: params.fechadoPor,
      fechadoEm: params.agora,
    })
  }

  static reconstitute(props: DealCloseProps): DealClose {
    return new DealClose(props)
  }

  get id(): string { return this.props.id }
  get oportunidadeId(): string { return this.props.oportunidadeId }
  get clienteId(): string { return this.props.clienteId }
  get resultado(): DealResult { return this.props.resultado }
  get valorTotal(): number { return this.props.valorTotal }
  get mrr(): number { return this.props.mrr }
  get segmentoId(): string | undefined { return this.props.segmentoId }
  get cicloDias(): number { return this.props.cicloDias }
  get dataInicio(): string | undefined { return this.props.dataInicio }
  get dataFim(): string | undefined { return this.props.dataFim }
  get formaPagamento(): FormaPagamento | undefined { return this.props.formaPagamento }
  get condicoesJson(): Record<string, unknown> | undefined { return this.props.condicoesJson }
  get responsavelCsId(): string | undefined { return this.props.responsavelCsId }
  get motivoPerda(): string | undefined { return this.props.motivoPerda }
  get concorrenteVencedorId(): string | undefined { return this.props.concorrenteVencedorId }
  get qualificationId(): string { return this.props.qualificationId }
  get fechadoPor(): string { return this.props.fechadoPor }
  get fechadoEm(): string { return this.props.fechadoEm }

  foiGanha(): boolean { return this.props.resultado === 'GANHA' }

  toObject(): DealCloseProps { return { ...this.props } }

  /** Payload enriquecido para o evento oportunidade.ganha (ADR-0006) */
  toEventPayload() {
    return {
      oportunidade_id: this.props.oportunidadeId,
      deal_close_id: this.props.id,
      cliente_id: this.props.clienteId,
      valor_total: this.props.valorTotal,
      mrr: this.props.mrr,
      segmento_id: this.props.segmentoId,
      ciclo_dias: this.props.cicloDias,
      data_inicio: this.props.dataInicio,
      data_fim: this.props.dataFim,
      forma_pagamento: this.props.formaPagamento,
      condicoes_json: this.props.condicoesJson ?? {},
      responsavel_cs_id: this.props.responsavelCsId,
      fechado_por: this.props.fechadoPor,
      fechado_em: this.props.fechadoEm,
    }
  }
}
