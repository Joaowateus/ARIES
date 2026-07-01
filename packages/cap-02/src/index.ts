export { Opportunity } from './domain/entities/Opportunity'
export type { OpportunityProps, OpportunityStage, OpportunityPriority } from './domain/entities/Opportunity'

export * from './domain/rules/BusinessRules'

export type { IOpportunityRepository } from './application/ports/repositories'

export { CriarOportunidadeUseCase } from './application/use-cases/CriarOportunidadeUseCase'
export type { CriarOportunidadeInput } from './application/use-cases/CriarOportunidadeUseCase'
export { AvancarEstagioUseCase } from './application/use-cases/AvancarEstagioUseCase'
export { EncerrarOportunidadeUseCase } from './application/use-cases/EncerrarOportunidadeUseCase'
export type { EncerrarInput } from './application/use-cases/EncerrarOportunidadeUseCase'
export { ConsultarPipelineUseCase } from './application/use-cases/ConsultarPipelineUseCase'
export type { PipelineSnapshot } from './application/use-cases/ConsultarPipelineUseCase'

export { InMemoryOpportunityRepository } from './infrastructure/repositories/InMemoryOpportunityRepository'
export { CAP02_EVENT_TYPES } from './infrastructure/events/cap02-events'

export { bootstrapCap02 } from './bootstrap'
export type { Cap02Container } from './bootstrap'
