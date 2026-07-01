/**
 * Onboarding — processo de ativação do cliente após venda ganha.
 * Estados: PENDENTE → EM_PROGRESSO → CONCLUIDO
 *
 * RN-C02: onboarding criado automaticamente junto com o cliente.
 * RN-C03: apenas um onboarding ativo por contrato.
 * RN-C05: finalização exige todos os marcos obrigatórios concluídos.
 */

import { v4 as uuidv4 } from 'uuid'

export type OnboardingStatus = 'PENDENTE' | 'EM_PROGRESSO' | 'CONCLUIDO'

export type MarcoOnboarding = 'KICKOFF' | 'CONFIGURACAO' | 'TREINAMENTO' | 'GO_LIVE'

export const MARCOS_OBRIGATORIOS: readonly MarcoOnboarding[] = [
  'KICKOFF',
  'CONFIGURACAO',
  'TREINAMENTO',
  'GO_LIVE',
]

export interface OnboardingProps {
  id: string
  customerId: string
  contratoId?: string
  oportunidadeId: string
  responsavelCsId: string
  status: OnboardingStatus
  marcosCompletos: MarcoOnboarding[]
  iniciadoEm: string
  atualizadoEm: string
  concluidoEm?: string
}

export class Onboarding {
  private constructor(private props: OnboardingProps) {}

  static create(params: Omit<OnboardingProps, 'id' | 'status' | 'marcosCompletos' | 'atualizadoEm'>): Onboarding {
    return new Onboarding({
      ...params,
      id: uuidv4(),
      status: 'PENDENTE',
      marcosCompletos: [],
      atualizadoEm: params.iniciadoEm,
    })
  }

  static reconstitute(props: OnboardingProps): Onboarding {
    return new Onboarding(props)
  }

  get id(): string { return this.props.id }
  get customerId(): string { return this.props.customerId }
  get contratoId(): string | undefined { return this.props.contratoId }
  get oportunidadeId(): string { return this.props.oportunidadeId }
  get responsavelCsId(): string { return this.props.responsavelCsId }
  get status(): OnboardingStatus { return this.props.status }
  get marcosCompletos(): readonly MarcoOnboarding[] { return [...this.props.marcosCompletos] }
  get iniciadoEm(): string { return this.props.iniciadoEm }
  get atualizadoEm(): string { return this.props.atualizadoEm }
  get concluidoEm(): string | undefined { return this.props.concluidoEm }

  estaAtivo(): boolean { return this.props.status !== 'CONCLUIDO' }

  iniciar(agora: string): void {
    if (this.props.status !== 'PENDENTE') {
      throw new Error(`Onboarding: já está em ${this.props.status}`)
    }
    this.props.status = 'EM_PROGRESSO'
    this.props.atualizadoEm = agora
  }

  concluirMarco(marco: MarcoOnboarding, agora: string): void {
    if (this.props.status === 'CONCLUIDO') {
      throw new Error('Onboarding: já está concluído')
    }
    if (this.props.marcosCompletos.includes(marco)) return // idempotente
    if (this.props.status === 'PENDENTE') {
      this.props.status = 'EM_PROGRESSO'
    }
    this.props.marcosCompletos.push(marco)
    this.props.atualizadoEm = agora
  }

  todosMarcosCompletos(): boolean {
    return MARCOS_OBRIGATORIOS.every(m => this.props.marcosCompletos.includes(m))
  }

  marcosRestantes(): MarcoOnboarding[] {
    return MARCOS_OBRIGATORIOS.filter(m => !this.props.marcosCompletos.includes(m))
  }

  /** RN-C05: todos os marcos obrigatórios devem estar completos. */
  finalizar(agora: string): void {
    if (this.props.status === 'CONCLUIDO') {
      throw new Error('Onboarding: já está concluído')
    }
    if (!this.todosMarcosCompletos()) {
      const faltando = this.marcosRestantes().join(', ')
      throw new Error(`Onboarding: marcos obrigatórios pendentes: ${faltando} (RN-C05)`)
    }
    this.props.status = 'CONCLUIDO'
    this.props.concluidoEm = agora
    this.props.atualizadoEm = agora
  }

  toObject(): OnboardingProps { return { ...this.props, marcosCompletos: [...this.props.marcosCompletos] } }
}
