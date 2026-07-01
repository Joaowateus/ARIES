import { ForecastEntry, ForecastEntryProps } from '../../domain/entities/ForecastEntry'
import { IContractRepository, IForecastRepository } from '../ports/repositories'

export interface AtualizarForecastInput {
  periodo: string   // YYYY-MM
  agora: string
}

export interface AtualizarForecastOutput {
  entry: ForecastEntryProps
  eventPayload: {
    forecast_id: string
    periodo: string
    mrr_ativo: number
    arr_ativo: number
    quantidade_contratos: number
    calculado_em: string
  }
}

export class AtualizarForecastUseCase {
  constructor(
    private readonly contratoRepo: IContractRepository,
    private readonly forecastRepo: IForecastRepository,
  ) {}

  async execute(input: AtualizarForecastInput): Promise<AtualizarForecastOutput> {
    const ativos = await this.contratoRepo.findAtivos()

    const mrrAtivo = ativos.reduce((sum, c) => sum + c.mrr, 0)
    const arrAtivo = mrrAtivo * 12

    const entry = ForecastEntry.create({
      periodo: input.periodo,
      mrrAtivo,
      arrAtivo,
      quantidadeContratos: ativos.length,
      calculadoEm: input.agora,
    })

    await this.forecastRepo.save(entry)

    return {
      entry: entry.toObject(),
      eventPayload: {
        forecast_id: entry.id,
        periodo: entry.periodo,
        mrr_ativo: entry.mrrAtivo,
        arr_ativo: entry.arrAtivo,
        quantidade_contratos: entry.quantidadeContratos,
        calculado_em: entry.calculadoEm,
      },
    }
  }
}
