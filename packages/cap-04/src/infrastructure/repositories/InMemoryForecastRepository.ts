import { ForecastEntry } from '../../domain/entities/ForecastEntry'
import { IForecastRepository } from '../../application/ports/repositories'

export class InMemoryForecastRepository implements IForecastRepository {
  private store = new Map<string, ForecastEntry>()

  async save(entry: ForecastEntry): Promise<void> {
    this.store.set(entry.periodo, entry)
  }

  async findByPeriodo(periodo: string): Promise<ForecastEntry | null> {
    return this.store.get(periodo) ?? null
  }

  async findLatest(): Promise<ForecastEntry | null> {
    const entries = [...this.store.values()]
    if (entries.length === 0) return null
    return entries.sort((a, b) => b.periodo.localeCompare(a.periodo))[0]
  }
}
