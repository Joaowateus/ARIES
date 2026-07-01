import { InMemoryQualificationRepository } from './infrastructure/repositories/InMemoryQualificationRepository'
import { InMemoryDealCloseRepository } from './infrastructure/repositories/InMemoryDealCloseRepository'
import { QualificarOportunidadeUseCase } from './application/use-cases/QualificarOportunidadeUseCase'
import { FecharVendaUseCase } from './application/use-cases/FecharVendaUseCase'
import { RegistrarPerdaUseCase } from './application/use-cases/RegistrarPerdaUseCase'

export interface Cap03Container {
  qualRepo: InMemoryQualificationRepository
  dealRepo: InMemoryDealCloseRepository
  qualificarOportunidade: QualificarOportunidadeUseCase
  fecharVenda: FecharVendaUseCase
  registrarPerda: RegistrarPerdaUseCase
}

export function bootstrapCap03(): Cap03Container {
  const qualRepo = new InMemoryQualificationRepository()
  const dealRepo = new InMemoryDealCloseRepository()

  return {
    qualRepo,
    dealRepo,
    qualificarOportunidade: new QualificarOportunidadeUseCase(qualRepo),
    fecharVenda: new FecharVendaUseCase(qualRepo, dealRepo),
    registrarPerda: new RegistrarPerdaUseCase(qualRepo, dealRepo),
  }
}
