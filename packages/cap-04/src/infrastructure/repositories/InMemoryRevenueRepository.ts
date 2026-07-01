import { RevenueRecord } from '../../domain/entities/RevenueRecord'
import { IRevenueRepository } from '../../application/ports/repositories'

export class InMemoryRevenueRepository implements IRevenueRepository {
  private store = new Map<string, RevenueRecord>()

  async save(record: RevenueRecord): Promise<void> {
    this.store.set(record.id, record)
  }

  async findById(id: string): Promise<RevenueRecord | null> {
    return this.store.get(id) ?? null
  }

  async findByContrato(contratoId: string): Promise<RevenueRecord[]> {
    return [...this.store.values()].filter(r => r.contratoId === contratoId)
  }

  async findByContratoPeriodo(contratoId: string, periodo: string): Promise<RevenueRecord | null> {
    return (
      [...this.store.values()].find(
        r => r.contratoId === contratoId && r.periodo === periodo && r.tipo === 'RECORRENTE',
      ) ?? null
    )
  }

  async findAll(): Promise<RevenueRecord[]> {
    return [...this.store.values()]
  }
}
