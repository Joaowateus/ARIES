import { CustomerProps } from '../../domain/entities/Customer'
import { OnboardingProps } from '../../domain/entities/Onboarding'
import { rn_c06_ativarAposOnboarding } from '../../domain/rules/BusinessRules'
import { ICustomerRepository, IOnboardingRepository } from '../ports/repositories'

export interface FinalizarOnboardingInput {
  onboardingId: string
  agora: string
}

export interface FinalizarOnboardingOutput {
  onboarding: OnboardingProps
  customer: CustomerProps
  eventPayload: {
    onboarding_id: string
    customer_id: string
    oportunidade_id: string
    concluido_em: string
  }
}

export class FinalizarOnboardingUseCase {
  constructor(
    private readonly customerRepo: ICustomerRepository,
    private readonly onboardingRepo: IOnboardingRepository,
  ) {}

  async execute(input: FinalizarOnboardingInput): Promise<FinalizarOnboardingOutput> {
    const onboarding = await this.onboardingRepo.findById(input.onboardingId)
    if (!onboarding) throw new Error(`Onboarding ${input.onboardingId} não encontrado`)

    // RN-C05: validates all mandatory milestones inside finalizar()
    onboarding.finalizar(input.agora)

    const customer = await this.customerRepo.findById(onboarding.customerId)
    if (!customer) throw new Error(`Customer ${onboarding.customerId} não encontrado`)

    // RN-C06: ativar cliente automaticamente ao concluir onboarding
    rn_c06_ativarAposOnboarding(customer, onboarding)
    customer.ativar(input.agora)

    await this.onboardingRepo.save(onboarding)
    await this.customerRepo.save(customer)

    return {
      onboarding: onboarding.toObject(),
      customer: customer.toObject(),
      eventPayload: {
        onboarding_id: onboarding.id,
        customer_id: customer.id,
        oportunidade_id: onboarding.oportunidadeId,
        concluido_em: onboarding.concluidoEm!,
      },
    }
  }
}
