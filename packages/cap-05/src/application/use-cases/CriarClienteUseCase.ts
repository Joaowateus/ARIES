import { Customer, CustomerProps } from '../../domain/entities/Customer'
import { Onboarding, OnboardingProps } from '../../domain/entities/Onboarding'
import { rn_c03_onboardingUnico } from '../../domain/rules/BusinessRules'
import { ICustomerRepository, IOnboardingRepository } from '../ports/repositories'

export interface CriarClienteInput {
  clienteId: string
  oportunidadeId: string
  nome: string
  segmentoId?: string
  responsavelCsId: string
  agora: string
}

export interface CriarClienteOutput {
  customer: CustomerProps
  onboarding: OnboardingProps
  customerEventPayload: {
    customer_id: string
    cliente_id: string
    oportunidade_id: string
    nome: string
    responsavel_cs_id: string
    health_score: number
    criado_em: string
  }
  onboardingEventPayload: {
    onboarding_id: string
    customer_id: string
    oportunidade_id: string
    responsavel_cs_id: string
    iniciado_em: string
  }
}

export class CriarClienteUseCase {
  constructor(
    private readonly customerRepo: ICustomerRepository,
    private readonly onboardingRepo: IOnboardingRepository,
  ) {}

  async execute(input: CriarClienteInput): Promise<CriarClienteOutput> {
    // Idempotência: mesma oportunidade → mesmo cliente
    const existente = await this.customerRepo.findByOportunidade(input.oportunidadeId)
    if (existente) {
      const onboardingExistente = await this.onboardingRepo.findByOportunidade(input.oportunidadeId)
      return this.buildOutput(existente, onboardingExistente!)
    }

    // RN-C03: não pode existir onboarding para esta oportunidade
    const onboardingExistente = await this.onboardingRepo.findByOportunidade(input.oportunidadeId)
    rn_c03_onboardingUnico(!!onboardingExistente, input.oportunidadeId)

    // RN-C01: criar cliente (healthScore=70 definido em Customer.create — RN-C04)
    const customer = Customer.create({
      clienteId: input.clienteId,
      oportunidadeId: input.oportunidadeId,
      nome: input.nome,
      segmentoId: input.segmentoId,
      responsavelCsId: input.responsavelCsId,
      agora: input.agora,
    })

    // RN-C02: criar onboarding automaticamente
    const onboarding = Onboarding.create({
      customerId: customer.id,
      oportunidadeId: input.oportunidadeId,
      responsavelCsId: input.responsavelCsId,
      iniciadoEm: input.agora,
    })

    await this.customerRepo.save(customer)
    await this.onboardingRepo.save(onboarding)

    return this.buildOutput(customer, onboarding)
  }

  private buildOutput(customer: Customer, onboarding: Onboarding): CriarClienteOutput {
    return {
      customer: customer.toObject(),
      onboarding: onboarding.toObject(),
      customerEventPayload: {
        customer_id: customer.id,
        cliente_id: customer.clienteId,
        oportunidade_id: customer.oportunidadeId,
        nome: customer.nome,
        responsavel_cs_id: customer.responsavelCsId,
        health_score: customer.healthScore,
        criado_em: customer.criadoEm,
      },
      onboardingEventPayload: {
        onboarding_id: onboarding.id,
        customer_id: onboarding.customerId,
        oportunidade_id: onboarding.oportunidadeId,
        responsavel_cs_id: onboarding.responsavelCsId,
        iniciado_em: onboarding.iniciadoEm,
      },
    }
  }
}
