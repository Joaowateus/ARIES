import { AlertaView, AlertaFiltros } from '../../view-models/AlertaView'
import { DiagnosticoView, DiagnosticoFiltros } from '../../view-models/DiagnosticoView'
import { PlanoAcaoView, PlanoAcaoFiltros } from '../../view-models/PlanoAcaoView'
import { DecisaoView, DecisaoFiltros } from '../../view-models/DecisaoView'
import { AuditoriaView, AuditoriaFiltros } from '../../view-models/AuditoriaView'

export interface IAlertaDataSource {
  findAlertas(filtros: AlertaFiltros): Promise<AlertaView[]>
}

export interface IDiagnosticoViewDataSource {
  findDiagnosticos(filtros: DiagnosticoFiltros): Promise<DiagnosticoView[]>
  findById(id: string): Promise<DiagnosticoView | undefined>
}

export interface IPlanoAcaoViewDataSource {
  findPlanos(filtros: PlanoAcaoFiltros): Promise<PlanoAcaoView[]>
  findByDiagnostico(diagnosticoId: string): Promise<PlanoAcaoView | undefined>
}

export interface IDecisaoViewDataSource {
  findDecisoes(filtros: DecisaoFiltros): Promise<DecisaoView[]>
  findByDiagnostico(diagnosticoId: string): Promise<DecisaoView | undefined>
}

export interface IAuditoriaViewDataSource {
  findEventos(filtros: AuditoriaFiltros): Promise<AuditoriaView[]>
}
