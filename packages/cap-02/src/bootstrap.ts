import { InMemoryOpportunityRepository } from './infrastructure/repositories/InMemoryOpportunityRepository'
import { CriarOportunidadeUseCase } from './application/use-cases/CriarOportunidadeUseCase'
import { AvancarEstagioUseCase } from './application/use-cases/AvancarEstagioUseCase'
import { EncerrarOportunidadeUseCase } from './application/use-cases/EncerrarOportunidadeUseCase'
import { ConsultarPipelineUseCase } from './application/use-cases/ConsultarPipelineUseCase'

export interface Cap02Container {
  opRepo: InMemoryOpportunityRepository
  criarOportunidade: CriarOportunidadeUseCase
  avancarEstagio: AvancarEstagioUseCase
  encerrarOportunidade: EncerrarOportunidadeUseCase
  consultarPipeline: ConsultarPipelineUseCase
}

export function bootstrapCap02(): Cap02Container {
  const opRepo = new InMemoryOpportunityRepository()

  return {
    opRepo,
    criarOportunidade: new CriarOportunidadeUseCase(opRepo),
    avancarEstagio: new AvancarEstagioUseCase(opRepo),
    encerrarOportunidade: new EncerrarOportunidadeUseCase(opRepo),
    consultarPipeline: new ConsultarPipelineUseCase(opRepo),
  }
}
