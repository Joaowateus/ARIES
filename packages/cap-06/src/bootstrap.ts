import { InMemoryCommercialPolicyRepository } from './infrastructure/repositories/InMemoryCommercialPolicyRepository'
import { InMemoryProposalRepository } from './infrastructure/repositories/InMemoryProposalRepository'
import { InMemoryApprovalRequestRepository } from './infrastructure/repositories/InMemoryApprovalRequestRepository'
import { DefinirPoliticaUseCase } from './application/use-cases/DefinirPoliticaUseCase'
import { CriarPropostaUseCase } from './application/use-cases/CriarPropostaUseCase'
import { AprovarPropostaUseCase } from './application/use-cases/AprovarPropostaUseCase'
import { ReprovarPropostaUseCase } from './application/use-cases/ReprovarPropostaUseCase'
import { EnviarPropostaUseCase } from './application/use-cases/EnviarPropostaUseCase'

export interface Cap06Container {
  repos: {
    policy: InMemoryCommercialPolicyRepository
    proposal: InMemoryProposalRepository
    approval: InMemoryApprovalRequestRepository
  }
  useCases: {
    definirPolitica: DefinirPoliticaUseCase
    criarProposta: CriarPropostaUseCase
    aprovarProposta: AprovarPropostaUseCase
    reprovarProposta: ReprovarPropostaUseCase
    enviarProposta: EnviarPropostaUseCase
  }
}

export function bootstrapCap06(): Cap06Container {
  const policyRepo = new InMemoryCommercialPolicyRepository()
  const proposalRepo = new InMemoryProposalRepository()
  const approvalRepo = new InMemoryApprovalRequestRepository()

  return {
    repos: { policy: policyRepo, proposal: proposalRepo, approval: approvalRepo },
    useCases: {
      definirPolitica: new DefinirPoliticaUseCase(policyRepo),
      criarProposta: new CriarPropostaUseCase(policyRepo, proposalRepo, approvalRepo),
      aprovarProposta: new AprovarPropostaUseCase(proposalRepo, approvalRepo),
      reprovarProposta: new ReprovarPropostaUseCase(proposalRepo, approvalRepo),
      enviarProposta: new EnviarPropostaUseCase(proposalRepo),
    },
  }
}
