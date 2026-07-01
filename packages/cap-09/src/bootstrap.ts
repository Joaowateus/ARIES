import { InMemoryConfiguracaoSistemaRepository } from './infrastructure/repositories/InMemoryConfiguracaoSistemaRepository'
import { InMemoryRegraGovernancaRepository } from './infrastructure/repositories/InMemoryRegraGovernancaRepository'
import { InMemoryAuditoriaEventoRepository } from './infrastructure/repositories/InMemoryAuditoriaEventoRepository'
import { GerenciarConfiguracaoUseCase } from './application/use-cases/GerenciarConfiguracaoUseCase'
import { GerenciarRegraGovernancaUseCase } from './application/use-cases/GerenciarRegraGovernancaUseCase'

export function bootstrapCap09() {
  const configRepo = new InMemoryConfiguracaoSistemaRepository()
  const regraRepo = new InMemoryRegraGovernancaRepository()
  const auditoriaRepo = new InMemoryAuditoriaEventoRepository()

  return {
    repos: { configRepo, regraRepo, auditoriaRepo },
    useCases: {
      gerenciarConfiguracao: new GerenciarConfiguracaoUseCase(configRepo, auditoriaRepo),
      gerenciarRegra: new GerenciarRegraGovernancaUseCase(regraRepo, auditoriaRepo),
    },
  }
}
