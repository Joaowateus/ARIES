/**
 * RevenueRecord — registro de receita reconhecida (recorrente ou única).
 * RN-R05: receita recorrente de um período é idempotente por (contratoId, periodo).
 */

import { v4 as uuidv4 } from 'uuid'

export type RevenueType = 'RECORRENTE' | 'UNICA'

export interface RevenueRecordProps {
  id: string
  contratoId: string
  clienteId: string
  tipo: RevenueType
  valor: number
  periodo: string        // formato YYYY-MM (ex: "2026-02") para RECORRENTE
  descricao: string
  reconhecidoEm: string
}

export class RevenueRecord {
  private constructor(private props: RevenueRecordProps) {}

  static create(params: Omit<RevenueRecordProps, 'id'>): RevenueRecord {
    if (params.valor <= 0) throw new Error('RevenueRecord: valor deve ser > 0')
    if (!params.contratoId) throw new Error('RevenueRecord: contratoId obrigatório')
    if (params.tipo === 'RECORRENTE' && !/^\d{4}-\d{2}$/.test(params.periodo)) {
      throw new Error('RevenueRecord: período RECORRENTE deve seguir formato YYYY-MM')
    }
    return new RevenueRecord({ ...params, id: uuidv4() })
  }

  static reconstitute(props: RevenueRecordProps): RevenueRecord {
    return new RevenueRecord(props)
  }

  get id(): string { return this.props.id }
  get contratoId(): string { return this.props.contratoId }
  get clienteId(): string { return this.props.clienteId }
  get tipo(): RevenueType { return this.props.tipo }
  get valor(): number { return this.props.valor }
  get periodo(): string { return this.props.periodo }
  get descricao(): string { return this.props.descricao }
  get reconhecidoEm(): string { return this.props.reconhecidoEm }

  toObject(): RevenueRecordProps { return { ...this.props } }
}
