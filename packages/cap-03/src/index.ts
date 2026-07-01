export { QualificationRecord } from './domain/entities/QualificationRecord'
export type { QualificationRecordProps, QualificationCriteria, QualificationStatus } from './domain/entities/QualificationRecord'

export { DealClose } from './domain/entities/DealClose'
export type { DealCloseProps, DealResult, FormaPagamento } from './domain/entities/DealClose'

export * from './domain/rules/BusinessRules'

export type { IQualificationRepository, IDealCloseRepository } from './application/ports/repositories'

export { QualificarOportunidadeUseCase } from './application/use-cases/QualificarOportunidadeUseCase'
export type { QualificarOportunidadeInput } from './application/use-cases/QualificarOportunidadeUseCase'
export { FecharVendaUseCase } from './application/use-cases/FecharVendaUseCase'
export type { FecharVendaInput, FecharVendaOutput } from './application/use-cases/FecharVendaUseCase'
export { RegistrarPerdaUseCase } from './application/use-cases/RegistrarPerdaUseCase'
export type { RegistrarPerdaInput, RegistrarPerdaOutput } from './application/use-cases/RegistrarPerdaUseCase'

export { InMemoryQualificationRepository } from './infrastructure/repositories/InMemoryQualificationRepository'
export { InMemoryDealCloseRepository } from './infrastructure/repositories/InMemoryDealCloseRepository'

export { CAP03_EVENT_TYPES } from './infrastructure/events/cap03-events'
export type { OportunidadeGanhaPayloadType, OportunidadePerdidaPayloadType } from './infrastructure/events/cap03-events'

export { bootstrapCap03 } from './bootstrap'
export type { Cap03Container } from './bootstrap'
