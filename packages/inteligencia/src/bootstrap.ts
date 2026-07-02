import {
  InMemoryAlertaDataSource,
  InMemoryDiagnosticoViewDataSource,
  InMemoryPlanoAcaoViewDataSource,
  InMemoryDecisaoViewDataSource,
  InMemoryAuditoriaViewDataSource,
} from './infrastructure/InMemoryDataSources'
import { ConsultarAlertasUseCase } from './application/use-cases/ConsultarAlertasUseCase'
import { ConsultarDiagnosticosUseCase } from './application/use-cases/ConsultarDiagnosticosUseCase'
import { AcompanharPlanosAcaoUseCase } from './application/use-cases/AcompanharPlanosAcaoUseCase'
import { ConsultarDecisoesUseCase } from './application/use-cases/ConsultarDecisoesUseCase'
import { ConsultarAuditoriaUseCase } from './application/use-cases/ConsultarAuditoriaUseCase'
import { RastrearTimelineUseCase } from './application/use-cases/RastrearTimelineUseCase'

export function bootstrapInteligencia() {
  const alertaSource      = new InMemoryAlertaDataSource()
  const diagnosticoSource = new InMemoryDiagnosticoViewDataSource()
  const planoSource       = new InMemoryPlanoAcaoViewDataSource()
  const decisaoSource     = new InMemoryDecisaoViewDataSource()
  const auditoriaSource   = new InMemoryAuditoriaViewDataSource()

  return {
    sources: { alertaSource, diagnosticoSource, planoSource, decisaoSource, auditoriaSource },
    useCases: {
      consultarAlertas:      new ConsultarAlertasUseCase(alertaSource),
      consultarDiagnosticos: new ConsultarDiagnosticosUseCase(diagnosticoSource),
      acompanharPlanos:      new AcompanharPlanosAcaoUseCase(planoSource),
      consultarDecisoes:     new ConsultarDecisoesUseCase(decisaoSource),
      consultarAuditoria:    new ConsultarAuditoriaUseCase(auditoriaSource),
      rastrearTimeline:      new RastrearTimelineUseCase(diagnosticoSource, alertaSource, planoSource, decisaoSource),
    },
  }
}
