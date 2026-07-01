/**
 * ForecastEntry — snapshot de receita projetada a partir de contratos ATIVO.
 * Calculado sob demanda; não possui estados — é sempre uma leitura.
 */

import { v4 as uuidv4 } from 'uuid'

export interface ForecastEntryProps {
  id: string
  periodo: string          // YYYY-MM
  mrrAtivo: number         // soma dos MRRs de contratos ATIVO
  arrAtivo: number         // mrrAtivo * 12
  quantidadeContratos: number
  calculadoEm: string
}

export class ForecastEntry {
  private constructor(private props: ForecastEntryProps) {}

  static create(params: Omit<ForecastEntryProps, 'id'>): ForecastEntry {
    return new ForecastEntry({ ...params, id: uuidv4() })
  }

  static reconstitute(props: ForecastEntryProps): ForecastEntry {
    return new ForecastEntry(props)
  }

  get id(): string { return this.props.id }
  get periodo(): string { return this.props.periodo }
  get mrrAtivo(): number { return this.props.mrrAtivo }
  get arrAtivo(): number { return this.props.arrAtivo }
  get quantidadeContratos(): number { return this.props.quantidadeContratos }
  get calculadoEm(): string { return this.props.calculadoEm }

  toObject(): ForecastEntryProps { return { ...this.props } }
}
