import { MarketSegment, MarketSegmentProps } from '../../../domain/entities/MarketSegment'
import { ISegmentRepository } from '../../ports/repositories'

export type CriarSegmentoInput = Omit<MarketSegmentProps, 'id' | 'status' | 'criadoEm' | 'atualizadoEm'> & {
  agora: string
}

export class CriarSegmentoUseCase {
  constructor(private readonly repo: ISegmentRepository) {}

  async execute(input: CriarSegmentoInput): Promise<MarketSegmentProps> {
    const segment = MarketSegment.create(input)
    await this.repo.save(segment)
    return segment.toObject()
  }
}
