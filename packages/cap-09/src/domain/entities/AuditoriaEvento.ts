/**
 * AuditoriaEvento — registro imutável de toda ação relevante no sistema.
 *
 * RN-G05: toda operação que altera estado do sistema deve gerar um registro de auditoria.
 * Imutável por design: nenhum método de mutação exposto após criação.
 */

import { v4 as uuidv4 } from 'uuid'

export type CategoriaAuditoria =
  | 'CONFIGURACAO'
  | 'GOVERNANCA'
  | 'ACESSO'
  | 'DADO_SENSIVEL'

export interface AuditoriaEventoProps {
  id: string
  categoria: CategoriaAuditoria
  acao: string
  entidadeTipo: string
  entidadeId: string
  realizadoPor: string
  payload: Record<string, unknown>
  ocorridoEm: string
}

export class AuditoriaEvento {
  private constructor(private readonly props: AuditoriaEventoProps) {}

  static create(params: Omit<AuditoriaEventoProps, 'id'>): AuditoriaEvento {
    return new AuditoriaEvento({ ...params, id: uuidv4() })
  }

  static reconstitute(props: AuditoriaEventoProps): AuditoriaEvento {
    return new AuditoriaEvento(props)
  }

  get id(): string { return this.props.id }
  get categoria(): CategoriaAuditoria { return this.props.categoria }
  get acao(): string { return this.props.acao }
  get entidadeTipo(): string { return this.props.entidadeTipo }
  get entidadeId(): string { return this.props.entidadeId }
  get realizadoPor(): string { return this.props.realizadoPor }
  get payload(): Record<string, unknown> { return { ...this.props.payload } }
  get ocorridoEm(): string { return this.props.ocorridoEm }

  toObject(): AuditoriaEventoProps {
    return { ...this.props, payload: { ...this.props.payload } }
  }
}
