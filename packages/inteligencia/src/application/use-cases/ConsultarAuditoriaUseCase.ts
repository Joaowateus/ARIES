import { AuditoriaView, AuditoriaFiltros } from '../../view-models/AuditoriaView'
import { IAuditoriaViewDataSource } from '../ports/IDataSources'

export interface ConsultarAuditoriaOutput {
  eventos: AuditoriaView[]
  total: number
  porModulo: Record<string, number>
  porCategoria: Record<string, number>
}

export class ConsultarAuditoriaUseCase {
  constructor(private readonly source: IAuditoriaViewDataSource) {}

  async execute(filtros: AuditoriaFiltros = {}): Promise<ConsultarAuditoriaOutput> {
    const eventos = await this.source.findEventos(filtros)
    const sorted = [...eventos].sort((a, b) => b.ocorridoEm.localeCompare(a.ocorridoEm))

    const porModulo: Record<string, number> = {}
    const porCategoria: Record<string, number> = {}
    for (const e of sorted) {
      porModulo[e.modulo] = (porModulo[e.modulo] ?? 0) + 1
      porCategoria[e.categoria] = (porCategoria[e.categoria] ?? 0) + 1
    }

    return { eventos: sorted, total: sorted.length, porModulo, porCategoria }
  }
}
