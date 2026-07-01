import { AtribuicaoPlano, AtribuicaoPlanoProps } from '../../domain/entities/AtribuicaoPlano'
import { IAtribuicaoPlanoRepository } from '../../application/ports/repositories'

export class InMemoryAtribuicaoPlanoRepository implements IAtribuicaoPlanoRepository {
  private store: AtribuicaoPlanoProps[] = []

  async save(a: AtribuicaoPlano): Promise<void> {
    const idx = this.store.findIndex(s => s.id === a.id)
    if (idx >= 0) this.store[idx] = a.toObject()
    else this.store.push(a.toObject())
  }

  async findById(id: string): Promise<AtribuicaoPlano | null> {
    const f = this.store.find(s => s.id === id)
    return f ? AtribuicaoPlano.reconstitute(f) : null
  }

  async findByVendedor(vendedorId: string): Promise<AtribuicaoPlano[]> {
    return this.store.filter(s => s.vendedorId === vendedorId).map(s => AtribuicaoPlano.reconstitute(s))
  }

  async findByPlano(planoAcaoId: string): Promise<AtribuicaoPlano[]> {
    return this.store.filter(s => s.planoAcaoId === planoAcaoId).map(s => AtribuicaoPlano.reconstitute(s))
  }

  async findPendentes(): Promise<AtribuicaoPlano[]> {
    return this.store.filter(s => s.status === 'PENDENTE').map(s => AtribuicaoPlano.reconstitute(s))
  }

  clear(): void { this.store = [] }
}
