import { Customer } from '../entities/Customer'
import { Onboarding } from '../entities/Onboarding'

/** RN-C01: cliente deve ser criado com clienteId preenchido (vindo do CRM/CAP-03). */
export function rn_c01_clienteIdObrigatorio(clienteId: string): void {
  if (!clienteId?.trim()) throw new Error('RN-C01: clienteId é obrigatório para criar cliente')
}

/** RN-C02: onboarding deve ser criado imediatamente após o cliente. */
export function rn_c02_onboardingAutomatico(onboardingCriado: boolean): void {
  if (!onboardingCriado) throw new Error('RN-C02: onboarding deve ser iniciado automaticamente com o cliente')
}

/** RN-C03: apenas um onboarding ativo por contrato/oportunidade. */
export function rn_c03_onboardingUnico(jaExiste: boolean, oportunidadeId: string): void {
  if (jaExiste) {
    throw new Error(`RN-C03: já existe um onboarding ativo para a oportunidade ${oportunidadeId}`)
  }
}

/** RN-C04: health score inicial é definido automaticamente (70). */
export function rn_c04_healthScoreInicial(score: number): void {
  if (score !== 70) {
    throw new Error('RN-C04: health score inicial deve ser 70')
  }
}

/** RN-C05: onboarding só pode ser finalizado com todos os marcos obrigatórios completos. */
export function rn_c05_marcosObrigatorios(onboarding: Onboarding): void {
  if (!onboarding.todosMarcosCompletos()) {
    const faltando = onboarding.marcosRestantes().join(', ')
    throw new Error(`RN-C05: marcos obrigatórios pendentes: ${faltando}`)
  }
}

/** RN-C06: status do cliente atualizado automaticamente ao concluir onboarding. */
export function rn_c06_ativarAposOnboarding(customer: Customer, onboarding: Onboarding): void {
  if (onboarding.status !== 'CONCLUIDO') {
    throw new Error('RN-C06: cliente só pode ser ativado após onboarding concluído')
  }
  if (!customer.emOnboarding()) {
    throw new Error(`RN-C06: cliente deve estar em ONBOARDING para ser ativado (atual: ${customer.status})`)
  }
}

/** RN-C07: apenas clientes ATIVO ou ONBOARDING podem ser encerrados. */
export function rn_c07_encerrarCliente(customer: Customer): void {
  if (!customer.estaAtivo() && !customer.emOnboarding()) {
    throw new Error(`RN-C07: apenas clientes ATIVO ou ONBOARDING podem ser encerrados (atual: ${customer.status})`)
  }
}
