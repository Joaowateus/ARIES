import { Competitor, CompetitorProps } from '../../domain/entities/Competitor'
import { ICompetitorRepository } from '../../application/ports/repositories'

export class InMemoryCompetitorRepository implements ICompetitorRepository {
  private store = new Map<string, CompetitorProps>()

  async save(competitor: Competitor): Promise<void> {
    this.store.set(competitor.id, competitor.toObject())
  }

  async findById(id: string): Promise<Competitor | null> {
    const props = this.store.get(id)
    return props ? Competitor.reconstitute(props) : null
  }

  async findAtivos(): Promise<Competitor[]> {
    return [...this.store.values()]
      .filter((p) => p.status === 'ATIVO')
      .map(Competitor.reconstitute)
  }

  async findAll(): Promise<Competitor[]> {
    return [...this.store.values()].map(Competitor.reconstitute)
  }

  clear(): void { this.store.clear() }
}
