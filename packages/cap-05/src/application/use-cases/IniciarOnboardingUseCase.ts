import { OnboardingProps } from '../../domain/entities/Onboarding'
import { ICustomerRepository, IOnboardingRepository } from '../ports/repositories'

export interface IniciarOnboardingInput {
  onboardingId: string
  agora: string
}

export interface IniciarOnboardingOutput {
  onboarding: OnboardingProps
}

export class IniciarOnboardingUseCase {
  constructor(
    private readonly customerRepo: ICustomerRepository,
    private readonly onboardingRepo: IOnboardingRepository,
  ) {}

  async execute(input: IniciarOnboardingInput): Promise<IniciarOnboardingOutput> {
    const onboarding = await this.onboardingRepo.findById(input.onboardingId)
    if (!onboarding) throw new Error(`Onboarding ${input.onboardingId} não encontrado`)

    onboarding.iniciar(input.agora)
    await this.onboardingRepo.save(onboarding)

    return { onboarding: onboarding.toObject() }
  }
}
