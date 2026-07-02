import { PlanoAcaoView, PlanoAcaoFiltros } from '../../view-models/PlanoAcaoView'
import { IPlanoAcaoViewDataSource } from '../ports/IDataSources'

export interface AcompanharPlanosOutput {
  planos: PlanoAcaoView[]
  total: number
  ativos: number
  concluidos: number
  cancelados: number
  percentualMedioAtivos: number
}

export class AcompanharPlanosAcaoUseCase {
  constructor(private readonly source: IPlanoAcaoViewDataSource) {}

  async execute(filtros: PlanoAcaoFiltros = {}): Promise<AcompanharPlanosOutput> {
    const planos = await this.source.findPlanos(filtros)
    const ativos = planos.filter(p => p.status === 'ATIVO')
    const mediaAtivos = ativos.length > 0
      ? Math.round(ativos.reduce((s, p) => s + p.percentualConcluido, 0) / ativos.length)
      : 0
    return {
      planos,
      total: planos.length,
      ativos: ativos.length,
      concluidos: planos.filter(p => p.status === 'CONCLUIDO').length,
      cancelados: planos.filter(p => p.status === 'CANCELADO').length,
      percentualMedioAtivos: mediaAtivos,
    }
  }
}
