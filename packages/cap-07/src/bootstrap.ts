import { InMemoryVendedorRepository } from './infrastructure/repositories/InMemoryVendedorRepository'
import { InMemoryMetaEquipeRepository } from './infrastructure/repositories/InMemoryMetaEquipeRepository'
import { InMemoryAtribuicaoPlanoRepository } from './infrastructure/repositories/InMemoryAtribuicaoPlanoRepository'
import { CadastrarVendedorUseCase } from './application/use-cases/CadastrarVendedorUseCase'
import { DefinirMetaUseCase } from './application/use-cases/DefinirMetaUseCase'
import { RegistrarPerformanceUseCase } from './application/use-cases/RegistrarPerformanceUseCase'
import { AtribuirPlanoAcaoUseCase } from './application/use-cases/AtribuirPlanoAcaoUseCase'
import { ConsultarRankingUseCase } from './application/use-cases/ConsultarRankingUseCase'

export function bootstrapCap07() {
  const vendedorRepo = new InMemoryVendedorRepository()
  const metaEquipeRepo = new InMemoryMetaEquipeRepository()
  const atribuicaoRepo = new InMemoryAtribuicaoPlanoRepository()

  return {
    repos: { vendedorRepo, metaEquipeRepo, atribuicaoRepo },
    useCases: {
      cadastrarVendedor: new CadastrarVendedorUseCase(vendedorRepo),
      definirMeta: new DefinirMetaUseCase(vendedorRepo, metaEquipeRepo),
      registrarPerformance: new RegistrarPerformanceUseCase(vendedorRepo),
      atribuirPlanoAcao: new AtribuirPlanoAcaoUseCase(vendedorRepo, atribuicaoRepo),
      consultarRanking: new ConsultarRankingUseCase(vendedorRepo),
    },
  }
}
