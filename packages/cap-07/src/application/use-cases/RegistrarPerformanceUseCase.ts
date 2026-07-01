import { rn_e06_alertaBaixaPerformance } from '../../domain/rules/BusinessRules'
import { IVendedorRepository } from '../ports/repositories'

export interface RegistrarPerformanceInput {
  vendedorId: string
  periodo: string
  receitaRealizada: number
  oportunidadesAbertas: number
  propostasEnviadas: number
  agora: string
}

export interface RegistrarPerformanceOutput {
  performance: { periodo: string; taxaAtingimentoMeta: number; classificacao: string }
  alertaBaixaPerformance: boolean
}

export class RegistrarPerformanceUseCase {
  constructor(private readonly repo: IVendedorRepository) {}

  async execute(input: RegistrarPerformanceInput): Promise<RegistrarPerformanceOutput> {
    const vendedor = await this.repo.findById(input.vendedorId)
    if (!vendedor) throw new Error(`Vendedor ${input.vendedorId} não encontrado`)

    vendedor.registrarPerformance({
      periodo: input.periodo,
      receitaRealizada: input.receitaRealizada,
      oportunidadesAbertas: input.oportunidadesAbertas,
      propostasEnviadas: input.propostasEnviadas,
    }, input.agora)

    await this.repo.save(vendedor)

    const perf = vendedor.performanceDoPeriodo(input.periodo)!
    const alertaBaixaPerformance = rn_e06_alertaBaixaPerformance(vendedor)

    return {
      performance: {
        periodo: perf.periodo,
        taxaAtingimentoMeta: perf.taxaAtingimentoMeta,
        classificacao: perf.classificacao,
      },
      alertaBaixaPerformance,
    }
  }
}
