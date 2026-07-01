import { Competitor, CompetitorProps } from '../../../domain/entities/Competitor'
import { ICompetitorRepository } from '../../ports/repositories'
import { rn05_minimoTresConcorrentes } from '../../../domain/rules/BusinessRules'

export type CriarConcorrenteInput = Omit<CompetitorProps, 'id' | 'status' | 'criadoEm' | 'atualizadoEm'> & {
  agora: string
}

export class CriarConcorrenteUseCase {
  constructor(private readonly repo: ICompetitorRepository) {}

  async execute(input: CriarConcorrenteInput): Promise<CompetitorProps> {
    const competitor = Competitor.create(input)
    await this.repo.save(competitor)
    return competitor.toObject()
  }
}
