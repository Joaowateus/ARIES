/**
 * Customer — cliente comercial criado a partir de uma venda ganha.
 * Estados: ONBOARDING → ATIVO → CHURNED | ENCERRADO
 *
 * RN-C01: cliente criado automaticamente após cap03.oportunidade.ganha.
 * RN-C06: status atualizado conforme o progresso do onboarding.
 * RN-C07: apenas clientes ATIVO ou ONBOARDING podem ser encerrados.
 */

import { v4 as uuidv4 } from 'uuid'

export type CustomerStatus = 'ONBOARDING' | 'ATIVO' | 'CHURNED' | 'ENCERRADO'

export interface CustomerProps {
  id: string
  clienteId: string          // ID externo (vindo do CRM / CAP-03)
  oportunidadeId: string
  contratoId?: string        // preenchido após cap04.contrato.criado
  nome: string
  segmentoId?: string
  responsavelCsId: string
  status: CustomerStatus
  healthScore: number        // 0-100; definido automaticamente na criação (RN-C04)
  motivoEncerramento?: string
  criadoEm: string
  atualizadoEm: string
  ativadoEm?: string
  encerradoEm?: string
}

export class Customer {
  private constructor(private props: CustomerProps) {}

  static create(params: Omit<CustomerProps, 'id' | 'status' | 'healthScore' | 'criadoEm' | 'atualizadoEm'> & {
    agora: string
  }): Customer {
    if (!params.clienteId?.trim()) throw new Error('Customer: clienteId obrigatório (RN-C01)')
    if (!params.responsavelCsId?.trim()) throw new Error('Customer: responsavelCsId obrigatório')

    return new Customer({
      ...params,
      id: uuidv4(),
      status: 'ONBOARDING',
      healthScore: 70,   // RN-C04: score inicial padrão
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: CustomerProps): Customer {
    return new Customer(props)
  }

  get id(): string { return this.props.id }
  get clienteId(): string { return this.props.clienteId }
  get oportunidadeId(): string { return this.props.oportunidadeId }
  get contratoId(): string | undefined { return this.props.contratoId }
  get nome(): string { return this.props.nome }
  get segmentoId(): string | undefined { return this.props.segmentoId }
  get responsavelCsId(): string { return this.props.responsavelCsId }
  get status(): CustomerStatus { return this.props.status }
  get healthScore(): number { return this.props.healthScore }
  get motivoEncerramento(): string | undefined { return this.props.motivoEncerramento }
  get criadoEm(): string { return this.props.criadoEm }
  get atualizadoEm(): string { return this.props.atualizadoEm }
  get ativadoEm(): string | undefined { return this.props.ativadoEm }
  get encerradoEm(): string | undefined { return this.props.encerradoEm }

  estaAtivo(): boolean { return this.props.status === 'ATIVO' }
  emOnboarding(): boolean { return this.props.status === 'ONBOARDING' }

  vincularContrato(contratoId: string, agora: string): void {
    this.props.contratoId = contratoId
    this.props.atualizadoEm = agora
  }

  /** RN-C06: ativação automática ao concluir onboarding. */
  ativar(agora: string): void {
    if (this.props.status !== 'ONBOARDING') {
      throw new Error(`Customer: apenas clientes em ONBOARDING podem ser ativados (atual: ${this.props.status}) (RN-C06)`)
    }
    this.props.status = 'ATIVO'
    this.props.ativadoEm = agora
    this.props.atualizadoEm = agora
  }

  atualizarHealthScore(score: number, agora: string): void {
    if (score < 0 || score > 100) throw new Error('Customer: healthScore deve estar entre 0 e 100')
    this.props.healthScore = score
    this.props.atualizadoEm = agora
  }

  /** RN-C07: apenas ATIVO ou ONBOARDING podem ser encerrados. */
  encerrar(motivo: string, agora: string): void {
    if (this.props.status === 'ENCERRADO' || this.props.status === 'CHURNED') {
      throw new Error(`Customer: não é possível encerrar cliente com status ${this.props.status} (RN-C07)`)
    }
    if (!motivo?.trim()) throw new Error('Customer: motivo obrigatório para encerramento')
    this.props.status = 'ENCERRADO'
    this.props.motivoEncerramento = motivo
    this.props.encerradoEm = agora
    this.props.atualizadoEm = agora
  }

  toObject(): CustomerProps { return { ...this.props } }
}
