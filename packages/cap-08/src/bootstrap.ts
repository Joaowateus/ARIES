import { InMemoryKpiSnapshotRepository } from './infrastructure/repositories/InMemoryKpiSnapshotRepository'
import { InMemoryDiagnosticoRepository } from './infrastructure/repositories/InMemoryDiagnosticoRepository'
import { InMemoryActionPlanRepository } from './infrastructure/repositories/InMemoryActionPlanRepository'
import { InMemoryDecisaoRecordRepository } from './infrastructure/repositories/InMemoryDecisaoRecordRepository'
import { RegistrarKpiUseCase } from './application/use-cases/RegistrarKpiUseCase'
import { GerarDiagnosticoUseCase } from './application/use-cases/GerarDiagnosticoUseCase'
import { PriorizarDiagnosticosUseCase } from './application/use-cases/PriorizarDiagnosticosUseCase'
import { CriarPlanoAcaoUseCase } from './application/use-cases/CriarPlanoAcaoUseCase'
import { RegistrarResultadoUseCase } from './application/use-cases/RegistrarResultadoUseCase'

export function bootstrapCap08() {
  const kpiRepo = new InMemoryKpiSnapshotRepository()
  const diagnosticoRepo = new InMemoryDiagnosticoRepository()
  const planoRepo = new InMemoryActionPlanRepository()
  const decisaoRepo = new InMemoryDecisaoRecordRepository()

  return {
    repos: { kpiRepo, diagnosticoRepo, planoRepo, decisaoRepo },
    useCases: {
      registrarKpi: new RegistrarKpiUseCase(kpiRepo),
      gerarDiagnostico: new GerarDiagnosticoUseCase(kpiRepo, diagnosticoRepo),
      priorizarDiagnosticos: new PriorizarDiagnosticosUseCase(diagnosticoRepo),
      criarPlanoAcao: new CriarPlanoAcaoUseCase(diagnosticoRepo, planoRepo, decisaoRepo),
      registrarResultado: new RegistrarResultadoUseCase(diagnosticoRepo, planoRepo, decisaoRepo),
    },
  }
}
