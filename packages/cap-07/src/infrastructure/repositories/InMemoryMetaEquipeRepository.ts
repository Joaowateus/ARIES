import { MetaEquipe, MetaEquipeProps } from '../../domain/entities/MetaEquipe'
import { IMetaEquipeRepository } from '../../application/ports/repositories'

export class InMemoryMetaEquipeRepository implements IMetaEquipeRepository {
  private store: MetaEquipeProps[] = []

  async save(m: MetaEquipe): Promise<void> {
    const idx = this.store.findIndex(s => s.id === m.id)
    if (idx >= 0) this.store[idx] = m.toObject()
    else this.store.push(m.toObject())
  }

  async findByPeriodo(periodo: string): Promise<MetaEquipe | null> {
    const f = this.store.find(s => s.periodo === periodo)
    return f ? MetaEquipe.reconstitute(f) : null
  }

  async findAll(): Promise<MetaEquipe[]> {
    return this.store.map(s => MetaEquipe.reconstitute(s))
  }

  clear(): void { this.store = [] }
}
