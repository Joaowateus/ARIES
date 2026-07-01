import { MarketSegment, MarketSegmentProps } from '../../domain/entities/MarketSegment'
import { ISegmentRepository } from '../../application/ports/repositories'

export class InMemorySegmentRepository implements ISegmentRepository {
  private store = new Map<string, MarketSegmentProps>()

  async save(segment: MarketSegment): Promise<void> {
    this.store.set(segment.id, segment.toObject())
  }

  async findById(id: string): Promise<MarketSegment | null> {
    const props = this.store.get(id)
    return props ? MarketSegment.reconstitute(props) : null
  }

  async findAtivos(): Promise<MarketSegment[]> {
    return [...this.store.values()]
      .filter((p) => p.status === 'ATIVO')
      .map(MarketSegment.reconstitute)
  }

  async findAll(): Promise<MarketSegment[]> {
    return [...this.store.values()].map(MarketSegment.reconstitute)
  }

  clear(): void { this.store.clear() }
}
