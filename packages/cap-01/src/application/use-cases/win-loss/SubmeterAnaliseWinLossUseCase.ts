import { WinLossAnalysisProps } from '../../../domain/entities/WinLossAnalysis'
import { WinLossResult } from '../../../domain/value-objects/WinLossResult'
import { IWinLossRepository } from '../../ports/repositories'
import { rn08_semNomeacaoIndividual } from '../../../domain/rules/BusinessRules'

export interface SubmeterAnaliseInput {
  analiseId: string
  result: WinLossResult
  fatoresNegativos: string[]
  fatoresPositivos: string[]
  sinaisDeAlertaIgnorados: string[]
  aprendizados: string[]
  validadoPor: string
  iaSugestaoJson?: Record<string, unknown>
  agora: string
}

export class SubmeterAnaliseWinLossUseCase {
  constructor(private readonly repo: IWinLossRepository) {}

  async execute(input: SubmeterAnaliseInput): Promise<WinLossAnalysisProps> {
    const analise = await this.repo.findById(input.analiseId)
    if (!analise) throw new Error(`WinLossAnalysis não encontrada: ${input.analiseId}`)

    const violacoes = rn08_semNomeacaoIndividual(input.aprendizados)
    if (violacoes.length > 0) {
      throw new Error(
        `RN-08: aprendizados não podem nomear indivíduos como causa: ${violacoes.join('; ')}`,
      )
    }

    analise.submeter({
      result: input.result,
      fatoresNegativos: input.fatoresNegativos,
      fatoresPositivos: input.fatoresPositivos,
      sinaisDeAlertaIgnorados: input.sinaisDeAlertaIgnorados,
      aprendizados: input.aprendizados,
      validadoPor: input.validadoPor,
      iaSugestaoJson: input.iaSugestaoJson,
      agora: input.agora,
    })

    await this.repo.save(analise)
    return analise.toObject()
  }
}
