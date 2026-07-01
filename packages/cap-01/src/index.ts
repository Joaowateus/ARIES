// Domain entities
export { IcpDefinition } from './domain/entities/IcpDefinition'
export type { IcpDefinitionProps, IcpStatus } from './domain/entities/IcpDefinition'
export { WinLossAnalysis, detectarPadrao } from './domain/entities/WinLossAnalysis'
export type { WinLossAnalysisProps, WinLossStatus, WinLossPattern } from './domain/entities/WinLossAnalysis'
export { MarketSegment } from './domain/entities/MarketSegment'
export type { MarketSegmentProps, SegmentStatus, BuyerPersona, CommonObjection, SegmentKpiBenchmark } from './domain/entities/MarketSegment'
export { Competitor } from './domain/entities/Competitor'
export type { CompetitorProps, CompetitorStatus, CompetitorTier, UpdateSource } from './domain/entities/Competitor'
export { MarketSignal } from './domain/entities/MarketSignal'
export type { MarketSignalProps, SignalType, SignalUrgency, ImpactedElement } from './domain/entities/MarketSignal'

// Value objects
export { IcpScore } from './domain/value-objects/IcpScore'
export type { IcpTier } from './domain/value-objects/IcpScore'
export { IcpCriteria } from './domain/value-objects/IcpCriteria'
export type { IcpCriteriaProps, IcpOperator } from './domain/value-objects/IcpCriteria'
export { WinLossResult } from './domain/value-objects/WinLossResult'
export type { WinLossOutcome, WinLossReason } from './domain/value-objects/WinLossResult'

// Application ports
export type { IIcpRepository, IWinLossRepository, ISegmentRepository, ICompetitorRepository, ISignalRepository } from './application/ports/repositories'
export type { IKpiPublisher, IAlertPublisher, KpiSnapshot, AlertaPayload } from './application/ports/publishers'

// Use cases
export { CriarIcpUseCase } from './application/use-cases/icp/CriarIcpUseCase'
export { AtivarIcpUseCase } from './application/use-cases/icp/AtivarIcpUseCase'
export { AvaliarProspectIcpUseCase } from './application/use-cases/icp/AvaliarProspectIcpUseCase'
export { RegistrarWinLossUseCase } from './application/use-cases/win-loss/RegistrarWinLossUseCase'
export { SubmeterAnaliseWinLossUseCase } from './application/use-cases/win-loss/SubmeterAnaliseWinLossUseCase'
export { CriarSegmentoUseCase } from './application/use-cases/segment/CriarSegmentoUseCase'
export { CriarConcorrenteUseCase } from './application/use-cases/competitor/CriarConcorrenteUseCase'
export { RegistrarSinalUseCase } from './application/use-cases/signal/RegistrarSinalUseCase'

// Infrastructure (in-memory)
export { InMemoryIcpRepository } from './infrastructure/repositories/InMemoryIcpRepository'
export { InMemoryWinLossRepository } from './infrastructure/repositories/InMemoryWinLossRepository'
export { InMemorySegmentRepository } from './infrastructure/repositories/InMemorySegmentRepository'
export { InMemoryCompetitorRepository } from './infrastructure/repositories/InMemoryCompetitorRepository'
export { InMemorySignalRepository } from './infrastructure/repositories/InMemorySignalRepository'

// Events
export { CAP01_EVENT_TYPES } from './infrastructure/events/cap01-events'

// Business rules
export * from './domain/rules/BusinessRules'

// Bootstrap
export { bootstrapCap01 } from './bootstrap'
export type { Cap01Container } from './bootstrap'

// Event handlers
export { OportunidadeEncerradaHandler } from './infrastructure/handlers/OportunidadeEncerradaHandler'
export type { OportunidadeEncerradaPayload } from './infrastructure/handlers/OportunidadeEncerradaHandler'
