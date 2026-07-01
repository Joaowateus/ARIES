import { RegraGovernanca, RegraGovernancaProps, TipoRegra } from '../../domain/entities/RegraGovernanca'
import { IRegraGovernancaRepository } from '../../application/ports/repositories'

export class InMemoryRegraGovernancaRepository implements IRegraGovernancaRepository {
  private store: RegraGovernancaProps[] = []

  async save(r: RegraGovernanca): Promise<void> {
    const idx = this.store.findIndex(s => s.id === r.id)
    if (idx >= 0) this.store[idx] = r.toObject()
    else this.store.push(r.toObject())
  }

  async findById(id: string): Promise<RegraGovernanca | null> {
    const f = this.store.find(s => s.id === id)
    return f ? RegraGovernanca.reconstitute(f) : null
  }

  async findByTipo(tipo: TipoRegra): Promise<RegraGovernanca[]> {
    return this.store.filter(s => s.tipo === tipo).map(s => RegraGovernanca.reconstitute(s))
  }

  async findAtivas(): Promise<RegraGovernanca[]> {
    return this.store.filter(s => s.ativo).map(s => RegraGovernanca.reconstitute(s))
  }

  clear(): void { this.store = [] }
}
