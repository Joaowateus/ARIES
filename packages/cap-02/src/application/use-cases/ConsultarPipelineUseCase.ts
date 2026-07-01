import { OpportunityProps, OpportunityStage } from '../../domain/entities/Opportunity'
import { IOpportunityRepository } from '../ports/repositories'

export interface PipelineSnapshot {
  porEstagio: Record<OpportunityStage, { quantidade: number; valorTotal: number }>
  totalAtivas: number
  valorTotalPipeline: number
}

export class ConsultarPipelineUseCase {
  constructor(private readonly repo: IOpportunityRepository) {}

  async execute(): Promise<PipelineSnapshot> {
    const todas = await this.repo.findAll()

    const porEstagio = {} as Record<OpportunityStage, { quantidade: number; valorTotal: number }>
    const estagios: OpportunityStage[] = [
      'PROSPECCAO', 'QUALIFICACAO', 'PROPOSTA', 'NEGOCIACAO', 'GANHA', 'PERDIDA', 'CANCELADA',
    ]
    for (const e of estagios) {
      porEstagio[e] = { quantidade: 0, valorTotal: 0 }
    }

    let totalAtivas = 0
    let valorTotalPipeline = 0

    for (const op of todas) {
      porEstagio[op.estagio].quantidade++
      porEstagio[op.estagio].valorTotal += op.valorEstimado
      if (!op.estaEncerrada()) {
        totalAtivas++
        valorTotalPipeline += op.valorEstimado
      }
    }

    return { porEstagio, totalAtivas, valorTotalPipeline }
  }
}
