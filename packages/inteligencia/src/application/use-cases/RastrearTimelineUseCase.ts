import { TimelineView } from '../../view-models/TimelineView'
import {
  IDiagnosticoViewDataSource,
  IAlertaDataSource,
  IPlanoAcaoViewDataSource,
  IDecisaoViewDataSource,
} from '../ports/IDataSources'

export class RastrearTimelineUseCase {
  constructor(
    private readonly diagnosticoSource: IDiagnosticoViewDataSource,
    private readonly alertaSource: IAlertaDataSource,
    private readonly planoSource: IPlanoAcaoViewDataSource,
    private readonly decisaoSource: IDecisaoViewDataSource,
  ) {}

  async execute(diagnosticoId: string): Promise<TimelineView> {
    const diagnostico = await this.diagnosticoSource.findById(diagnosticoId)
    if (!diagnostico) throw new Error(`RastrearTimeline: diagnóstico ${diagnosticoId} não encontrado`)

    const [planoAcao, decisao] = await Promise.all([
      this.planoSource.findByDiagnostico(diagnosticoId),
      this.decisaoSource.findByDiagnostico(diagnosticoId),
    ])

    // O alerta que originou o diagnóstico: busca no período do diagnóstico
    const alertasNoPeriodo = await this.alertaSource.findAlertas({ periodo: diagnostico.periodo })
    const kpisAfetados = new Set(diagnostico.kpisAfetados)
    const alerta = alertasNoPeriodo.find(a => kpisAfetados.has(a.kpiNome))

    const titulo = `[${diagnostico.classificacao}] ${diagnostico.hipotesePrincipal.descricao}`

    return {
      incidenteId: diagnosticoId,
      titulo,
      statusGlobal: diagnostico.status,
      alerta,
      diagnostico,
      planoAcao,
      decisao,
      aprendizado: decisao?.aprendizado,
    }
  }
}
