import { InMemoryContractRepository } from './infrastructure/repositories/InMemoryContractRepository'
import { InMemoryRevenueRepository } from './infrastructure/repositories/InMemoryRevenueRepository'
import { InMemoryForecastRepository } from './infrastructure/repositories/InMemoryForecastRepository'
import { RegistrarContratoUseCase } from './application/use-cases/RegistrarContratoUseCase'
import { RegistrarReceitaRecorrenteUseCase } from './application/use-cases/RegistrarReceitaRecorrenteUseCase'
import { RegistrarReceitaUnicaUseCase } from './application/use-cases/RegistrarReceitaUnicaUseCase'
import { AtualizarForecastUseCase } from './application/use-cases/AtualizarForecastUseCase'
import { EncerrarContratoUseCase } from './application/use-cases/EncerrarContratoUseCase'
import { CancelarContratoUseCase } from './application/use-cases/CancelarContratoUseCase'
import { OportunidadeGanhaHandler } from './infrastructure/handlers/OportunidadeGanhaHandler'

export interface Cap04Container {
  repos: {
    contrato: InMemoryContractRepository
    revenue: InMemoryRevenueRepository
    forecast: InMemoryForecastRepository
  }
  useCases: {
    registrarContrato: RegistrarContratoUseCase
    registrarReceitaRecorrente: RegistrarReceitaRecorrenteUseCase
    registrarReceitaUnica: RegistrarReceitaUnicaUseCase
    atualizarForecast: AtualizarForecastUseCase
    encerrarContrato: EncerrarContratoUseCase
    cancelarContrato: CancelarContratoUseCase
  }
  handlers: {
    oportunidadeGanha: OportunidadeGanhaHandler
  }
}

export function bootstrapCap04(): Cap04Container {
  const contratoRepo = new InMemoryContractRepository()
  const revenueRepo = new InMemoryRevenueRepository()
  const forecastRepo = new InMemoryForecastRepository()

  const registrarContrato = new RegistrarContratoUseCase(contratoRepo)
  const registrarReceitaRecorrente = new RegistrarReceitaRecorrenteUseCase(contratoRepo, revenueRepo)
  const registrarReceitaUnica = new RegistrarReceitaUnicaUseCase(contratoRepo, revenueRepo)
  const atualizarForecast = new AtualizarForecastUseCase(contratoRepo, forecastRepo)
  const encerrarContrato = new EncerrarContratoUseCase(contratoRepo)
  const cancelarContrato = new CancelarContratoUseCase(contratoRepo)

  const oportunidadeGanha = new OportunidadeGanhaHandler(registrarContrato)

  return {
    repos: { contrato: contratoRepo, revenue: revenueRepo, forecast: forecastRepo },
    useCases: {
      registrarContrato,
      registrarReceitaRecorrente,
      registrarReceitaUnica,
      atualizarForecast,
      encerrarContrato,
      cancelarContrato,
    },
    handlers: { oportunidadeGanha },
  }
}
