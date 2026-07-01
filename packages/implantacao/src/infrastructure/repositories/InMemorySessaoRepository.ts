import { Sessao, SessaoProps } from '../../domain/entities/Sessao'
import { ISessaoRepository } from '../../application/ports/repositories'

export class InMemorySessaoRepository implements ISessaoRepository {
  private store: SessaoProps[] = []

  async save(s: Sessao): Promise<void> {
    const idx = this.store.findIndex(x => x.id === s.id)
    if (idx >= 0) this.store[idx] = s.toObject()
    else this.store.push(s.toObject())
  }

  async findByToken(token: string): Promise<Sessao | null> {
    const f = this.store.find(s => s.token === token)
    return f ? Sessao.reconstitute(f) : null
  }

  async findByUsuario(usuarioId: string): Promise<Sessao[]> {
    return this.store.filter(s => s.usuarioId === usuarioId).map(s => Sessao.reconstitute(s))
  }

  async invalidarTodasDoUsuario(usuarioId: string, agora: string): Promise<void> {
    for (const s of this.store.filter(x => x.usuarioId === usuarioId && !x.invalidadaEm)) {
      s.invalidadaEm = agora
    }
  }

  clear(): void { this.store = [] }
}
