import { InMemoryCustomerRepository } from './infrastructure/repositories/InMemoryCustomerRepository'
import { InMemoryOnboardingRepository } from './infrastructure/repositories/InMemoryOnboardingRepository'
import { InMemoryCustomerHealthRepository } from './infrastructure/repositories/InMemoryCustomerHealthRepository'
import { InMemoryCustomerInteractionRepository } from './infrastructure/repositories/InMemoryCustomerInteractionRepository'
import { CriarClienteUseCase } from './application/use-cases/CriarClienteUseCase'
import { IniciarOnboardingUseCase } from './application/use-cases/IniciarOnboardingUseCase'
import { RegistrarInteracaoUseCase } from './application/use-cases/RegistrarInteracaoUseCase'
import { AtualizarHealthScoreUseCase } from './application/use-cases/AtualizarHealthScoreUseCase'
import { FinalizarOnboardingUseCase } from './application/use-cases/FinalizarOnboardingUseCase'
import { EncerrarRelacionamentoUseCase } from './application/use-cases/EncerrarRelacionamentoUseCase'
import { OportunidadeGanhaHandler } from './infrastructure/handlers/OportunidadeGanhaHandler'
import { ContratoCriadoHandler } from './infrastructure/handlers/ContratoCriadoHandler'

export interface Cap05Container {
  repos: {
    customer: InMemoryCustomerRepository
    onboarding: InMemoryOnboardingRepository
    health: InMemoryCustomerHealthRepository
    interaction: InMemoryCustomerInteractionRepository
  }
  useCases: {
    criarCliente: CriarClienteUseCase
    iniciarOnboarding: IniciarOnboardingUseCase
    registrarInteracao: RegistrarInteracaoUseCase
    atualizarHealthScore: AtualizarHealthScoreUseCase
    finalizarOnboarding: FinalizarOnboardingUseCase
    encerrarRelacionamento: EncerrarRelacionamentoUseCase
  }
  handlers: {
    oportunidadeGanha: OportunidadeGanhaHandler
    contratoCriado: ContratoCriadoHandler
  }
}

export function bootstrapCap05(): Cap05Container {
  const customerRepo = new InMemoryCustomerRepository()
  const onboardingRepo = new InMemoryOnboardingRepository()
  const healthRepo = new InMemoryCustomerHealthRepository()
  const interactionRepo = new InMemoryCustomerInteractionRepository()

  const criarCliente = new CriarClienteUseCase(customerRepo, onboardingRepo)
  const iniciarOnboarding = new IniciarOnboardingUseCase(customerRepo, onboardingRepo)
  const registrarInteracao = new RegistrarInteracaoUseCase(customerRepo, interactionRepo)
  const atualizarHealthScore = new AtualizarHealthScoreUseCase(customerRepo, healthRepo)
  const finalizarOnboarding = new FinalizarOnboardingUseCase(customerRepo, onboardingRepo)
  const encerrarRelacionamento = new EncerrarRelacionamentoUseCase(customerRepo)

  const oportunidadeGanha = new OportunidadeGanhaHandler(criarCliente)
  const contratoCriado = new ContratoCriadoHandler(customerRepo)

  return {
    repos: { customer: customerRepo, onboarding: onboardingRepo, health: healthRepo, interaction: interactionRepo },
    useCases: {
      criarCliente,
      iniciarOnboarding,
      registrarInteracao,
      atualizarHealthScore,
      finalizarOnboarding,
      encerrarRelacionamento,
    },
    handlers: { oportunidadeGanha, contratoCriado },
  }
}
