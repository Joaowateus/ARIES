import { rn_e05_rankingEquipe, rn_e06_alertaBaixaPerformance } from '../../domain/rules/BusinessRules'
import { IVendedorRepository } from '../ports/repositories'

export interface ConsultarRankingOutput {
  periodo: string
  ranking: Array<{
    posicao: number
    vendedorId: string
    nome: string
    taxaAtingimento: number
    classificacao: string
    alertaBaixaPerformance: boolean
  }>
}

export class ConsultarRankingUseCase {
  constructor(private readonly repo: IVendedorRepository) {}

  async execute(periodo: string): Promise<ConsultarRankingOutput> {
    const vendedores = await this.repo.findAtivos()
    const ranking = rn_e05_rankingEquipe(vendedores, periodo)

    return {
      periodo,
      ranking: ranking.map((r, idx) => {
        const vendedor = vendedores.find(v => v.id === r.vendedorId)!
        return {
          posicao: idx + 1,
          vendedorId: r.vendedorId,
          nome: r.nome,
          taxaAtingimento: r.taxaAtingimento,
          classificacao: r.classificacao,
          alertaBaixaPerformance: rn_e06_alertaBaixaPerformance(vendedor),
        }
      }),
    }
  }
}
