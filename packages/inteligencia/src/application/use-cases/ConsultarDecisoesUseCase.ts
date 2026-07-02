import { DecisaoView, DecisaoFiltros } from '../../view-models/DecisaoView'
import { IDecisaoViewDataSource } from '../ports/IDataSources'

export interface ConsultarDecisoesOutput {
  decisoes: DecisaoView[]
  total: number
  abertas: number
  fechadas: number
  efetivas: number
  parciais: number
  inefetivas: number
  taxaEfetividade: number   // % das fechadas que foram EFETIVO
}

export class ConsultarDecisoesUseCase {
  constructor(private readonly source: IDecisaoViewDataSource) {}

  async execute(filtros: DecisaoFiltros = {}): Promise<ConsultarDecisoesOutput> {
    const decisoes = await this.source.findDecisoes(filtros)
    const fechadas = decisoes.filter(d => d.estaFechada)
    const efetivas = fechadas.filter(d => d.resultado === 'EFETIVO').length
    return {
      decisoes,
      total: decisoes.length,
      abertas: decisoes.filter(d => !d.estaFechada).length,
      fechadas: fechadas.length,
      efetivas,
      parciais: fechadas.filter(d => d.resultado === 'PARCIAL').length,
      inefetivas: fechadas.filter(d => d.resultado === 'INEFETIVO').length,
      taxaEfetividade: fechadas.length > 0 ? Math.round(efetivas / fechadas.length * 100) : 0,
    }
  }
}
