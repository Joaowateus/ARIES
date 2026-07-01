import { WinLossAnalysis, WinLossAnalysisProps } from '../../../domain/entities/WinLossAnalysis'
import { WinLossResult } from '../../../domain/value-objects/WinLossResult'
import { IWinLossRepository } from '../../ports/repositories'

export interface RegistrarWinLossInput {
  oportunidadeId: string
  segmentoId?: string
  valorEstimado?: number
  cicloDias?: number
  eventoOrigemId: string
  agora: string
}

export class RegistrarWinLossUseCase {
  constructor(private readonly repo: IWinLossRepository) {}

  async execute(input: RegistrarWinLossInput): Promise<WinLossAnalysisProps> {
    const existente = await this.repo.findByOportunidade(input.oportunidadeId)
    if (existente) return existente.toObject()

    const analise = WinLossAnalysis.create({
      oportunidadeId: input.oportunidadeId,
      segmentoId: input.segmentoId,
      valorEstimado: input.valorEstimado,
      cicloDias: input.cicloDias,
      eventoOrigemId: input.eventoOrigemId,
      agora: input.agora,
    })

    await this.repo.save(analise)
    return analise.toObject()
  }
}
