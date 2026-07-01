/**
 * ApprovalRequest — solicitação de aprovação para proposta fora da alçada.
 * Criada automaticamente quando Proposal entra em EM_APROVACAO.
 */

import { v4 as uuidv4 } from 'uuid'
import { NivelAlcada } from './CommercialPolicy'

export type ApprovalStatus = 'PENDENTE' | 'APROVADO' | 'REPROVADO'

export interface ApprovalRequestProps {
  id: string
  propostaId: string
  oportunidadeId: string
  nivelNecessario: NivelAlcada
  violacoes: string[]
  status: ApprovalStatus
  solicitadoPor: string
  resolvidoPor?: string
  motivoResolucao?: string
  criadoEm: string
  resolvidoEm?: string
}

export class ApprovalRequest {
  private constructor(private props: ApprovalRequestProps) {}

  static create(params: Omit<ApprovalRequestProps, 'id' | 'status' | 'resolvidoPor' | 'motivoResolucao' | 'resolvidoEm'>): ApprovalRequest {
    return new ApprovalRequest({ ...params, id: uuidv4(), status: 'PENDENTE' })
  }

  static reconstitute(props: ApprovalRequestProps): ApprovalRequest {
    return new ApprovalRequest(props)
  }

  get id(): string { return this.props.id }
  get propostaId(): string { return this.props.propostaId }
  get oportunidadeId(): string { return this.props.oportunidadeId }
  get nivelNecessario(): NivelAlcada { return this.props.nivelNecessario }
  get violacoes(): readonly string[] { return [...this.props.violacoes] }
  get status(): ApprovalStatus { return this.props.status }
  get solicitadoPor(): string { return this.props.solicitadoPor }
  get resolvidoPor(): string | undefined { return this.props.resolvidoPor }
  get motivoResolucao(): string | undefined { return this.props.motivoResolucao }
  get criadoEm(): string { return this.props.criadoEm }
  get resolvidoEm(): string | undefined { return this.props.resolvidoEm }

  aprovar(resolvidoPor: string, motivo: string, agora: string): void {
    this.assertPendente()
    this.props.status = 'APROVADO'
    this.props.resolvidoPor = resolvidoPor
    this.props.motivoResolucao = motivo
    this.props.resolvidoEm = agora
  }

  reprovar(resolvidoPor: string, motivo: string, agora: string): void {
    this.assertPendente()
    if (!motivo?.trim()) throw new Error('ApprovalRequest: motivo de reprovação obrigatório')
    this.props.status = 'REPROVADO'
    this.props.resolvidoPor = resolvidoPor
    this.props.motivoResolucao = motivo
    this.props.resolvidoEm = agora
  }

  private assertPendente(): void {
    if (this.props.status !== 'PENDENTE') {
      throw new Error(`ApprovalRequest: já resolvido com status ${this.props.status}`)
    }
  }

  toObject(): ApprovalRequestProps { return { ...this.props, violacoes: [...this.props.violacoes] } }
}
