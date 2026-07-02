import { AlertaView, AlertaFiltros } from '../../view-models/AlertaView'
import { IAlertaDataSource } from '../ports/IDataSources'

export interface ConsultarAlertasOutput {
  alertas: AlertaView[]
  total: number
  porSeveridade: { LEVE: number; MODERADA: number; CRITICA: number }
}

export class ConsultarAlertasUseCase {
  constructor(private readonly source: IAlertaDataSource) {}

  async execute(filtros: AlertaFiltros = {}): Promise<ConsultarAlertasOutput> {
    const alertas = await this.source.findAlertas(filtros)
    const sorted = [...alertas].sort((a, b) => {
      const ordem = { CRITICA: 0, MODERADA: 1, LEVE: 2 }
      return ordem[a.severidade] - ordem[b.severidade]
    })
    return {
      alertas: sorted,
      total: sorted.length,
      porSeveridade: {
        LEVE: sorted.filter(a => a.severidade === 'LEVE').length,
        MODERADA: sorted.filter(a => a.severidade === 'MODERADA').length,
        CRITICA: sorted.filter(a => a.severidade === 'CRITICA').length,
      },
    }
  }
}
