/**
 * Bootstrap do CAP-01 — Inteligência de Mercado.
 * Wire-up de todas as dependências do módulo.
 */

import { InMemoryIcpRepository } from './infrastructure/repositories/InMemoryIcpRepository'
import { InMemoryWinLossRepository } from './infrastructure/repositories/InMemoryWinLossRepository'
import { InMemorySegmentRepository } from './infrastructure/repositories/InMemorySegmentRepository'
import { InMemoryCompetitorRepository } from './infrastructure/repositories/InMemoryCompetitorRepository'
import { InMemorySignalRepository } from './infrastructure/repositories/InMemorySignalRepository'

import { CriarIcpUseCase } from './application/use-cases/icp/CriarIcpUseCase'
import { AtivarIcpUseCase } from './application/use-cases/icp/AtivarIcpUseCase'
import { AvaliarProspectIcpUseCase } from './application/use-cases/icp/AvaliarProspectIcpUseCase'
import { RegistrarWinLossUseCase } from './application/use-cases/win-loss/RegistrarWinLossUseCase'
import { SubmeterAnaliseWinLossUseCase } from './application/use-cases/win-loss/SubmeterAnaliseWinLossUseCase'
import { CriarSegmentoUseCase } from './application/use-cases/segment/CriarSegmentoUseCase'
import { CriarConcorrenteUseCase } from './application/use-cases/competitor/CriarConcorrenteUseCase'
import { RegistrarSinalUseCase } from './application/use-cases/signal/RegistrarSinalUseCase'
import { OportunidadeEncerradaHandler } from './infrastructure/handlers/OportunidadeEncerradaHandler'

export interface Cap01Container {
  // Repositories
  icpRepo: InMemoryIcpRepository
  winLossRepo: InMemoryWinLossRepository
  segmentRepo: InMemorySegmentRepository
  competitorRepo: InMemoryCompetitorRepository
  signalRepo: InMemorySignalRepository

  // Use cases
  criarIcp: CriarIcpUseCase
  ativarIcp: AtivarIcpUseCase
  avaliarProspect: AvaliarProspectIcpUseCase
  registrarWinLoss: RegistrarWinLossUseCase
  submeterAnalise: SubmeterAnaliseWinLossUseCase
  criarSegmento: CriarSegmentoUseCase
  criarConcorrente: CriarConcorrenteUseCase
  registrarSinal: RegistrarSinalUseCase

  // Event handlers
  oportunidadeEncerradaHandler: OportunidadeEncerradaHandler
}

export function bootstrapCap01(): Cap01Container {
  const icpRepo = new InMemoryIcpRepository()
  const winLossRepo = new InMemoryWinLossRepository()
  const segmentRepo = new InMemorySegmentRepository()
  const competitorRepo = new InMemoryCompetitorRepository()
  const signalRepo = new InMemorySignalRepository()

  const criarIcp = new CriarIcpUseCase(icpRepo)
  const ativarIcp = new AtivarIcpUseCase(icpRepo)
  const avaliarProspect = new AvaliarProspectIcpUseCase(icpRepo)
  const registrarWinLoss = new RegistrarWinLossUseCase(winLossRepo)
  const submeterAnalise = new SubmeterAnaliseWinLossUseCase(winLossRepo)
  const criarSegmento = new CriarSegmentoUseCase(segmentRepo)
  const criarConcorrente = new CriarConcorrenteUseCase(competitorRepo)
  const registrarSinal = new RegistrarSinalUseCase(signalRepo)

  const oportunidadeEncerradaHandler = new OportunidadeEncerradaHandler(registrarWinLoss)

  return {
    icpRepo,
    winLossRepo,
    segmentRepo,
    competitorRepo,
    signalRepo,
    criarIcp,
    ativarIcp,
    avaliarProspect,
    registrarWinLoss,
    submeterAnalise,
    criarSegmento,
    criarConcorrente,
    registrarSinal,
    oportunidadeEncerradaHandler,
  }
}
