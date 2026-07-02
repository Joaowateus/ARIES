import { DiagnosticoView, DiagnosticoFiltros } from '../../view-models/DiagnosticoView'
import { IDiagnosticoViewDataSource } from '../ports/IDataSources'

export interface ConsultarDiagnosticosOutput {
  diagnosticos: DiagnosticoView[]   // sorted by prioridade (1 = highest)
  total: number
  abertos: number
  emTratamento: number
  resolvidos: number
}

export class ConsultarDiagnosticosUseCase {
  constructor(private readonly source: IDiagnosticoViewDataSource) {}

  async execute(filtros: DiagnosticoFiltros = {}): Promise<ConsultarDiagnosticosOutput> {
    const diagnosticos = await this.source.findDiagnosticos(filtros)
    return {
      diagnosticos,
      total: diagnosticos.length,
      abertos: diagnosticos.filter(d => d.status === 'ABERTO').length,
      emTratamento: diagnosticos.filter(d => d.status === 'EM_TRATAMENTO').length,
      resolvidos: diagnosticos.filter(d => d.status === 'RESOLVIDO').length,
    }
  }
}
