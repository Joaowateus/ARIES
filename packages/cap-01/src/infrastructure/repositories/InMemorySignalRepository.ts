import { MarketSignal, MarketSignalProps } from '../../domain/entities/MarketSignal'
import { ISignalRepository } from '../../application/ports/repositories'

export class InMemorySignalRepository implements ISignalRepository {
  private store = new Map<string, MarketSignalProps>()

  async save(signal: MarketSignal): Promise<void> {
    this.store.set(signal.id, signal.toObject())
  }

  async findById(id: string): Promise<MarketSignal | null> {
    const props = this.store.get(id)
    return props ? MarketSignal.reconstitute(props) : null
  }

  async findNaoProcessados(): Promise<MarketSignal[]> {
    return [...this.store.values()]
      .filter((p) => !p.processadoEm)
      .map(MarketSignal.reconstitute)
  }

  async findAll(): Promise<MarketSignal[]> {
    return [...this.store.values()].map(MarketSignal.reconstitute)
  }

  clear(): void { this.store.clear() }
}
