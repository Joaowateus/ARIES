import { DealClose, DealCloseProps } from '../../domain/entities/DealClose'
import { IDealCloseRepository } from '../../application/ports/repositories'

export class InMemoryDealCloseRepository implements IDealCloseRepository {
  private store = new Map<string, DealCloseProps>()

  async save(close: DealClose): Promise<void> {
    this.store.set(close.id, close.toObject())
  }

  async findById(id: string): Promise<DealClose | null> {
    const props = this.store.get(id)
    return props ? DealClose.reconstitute(props) : null
  }

  async findByOportunidade(oportunidadeId: string): Promise<DealClose | null> {
    for (const props of this.store.values()) {
      if (props.oportunidadeId === oportunidadeId) return DealClose.reconstitute(props)
    }
    return null
  }

  async findAll(): Promise<DealClose[]> {
    return [...this.store.values()].map(DealClose.reconstitute)
  }

  clear(): void { this.store.clear() }
}
