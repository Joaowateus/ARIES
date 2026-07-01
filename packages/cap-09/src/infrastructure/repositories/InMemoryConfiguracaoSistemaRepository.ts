import { ConfiguracaoSistema, ConfiguracaoSistemaProps, CategoriaCofiguracao } from '../../domain/entities/ConfiguracaoSistema'
import { IConfiguracaoSistemaRepository } from '../../application/ports/repositories'

export class InMemoryConfiguracaoSistemaRepository implements IConfiguracaoSistemaRepository {
  private store: ConfiguracaoSistemaProps[] = []

  async save(c: ConfiguracaoSistema): Promise<void> {
    const idx = this.store.findIndex(s => s.id === c.id)
    if (idx >= 0) this.store[idx] = c.toObject()
    else this.store.push(c.toObject())
  }

  async findById(id: string): Promise<ConfiguracaoSistema | null> {
    const f = this.store.find(s => s.id === id)
    return f ? ConfiguracaoSistema.reconstitute(f) : null
  }

  async findByChave(chave: string): Promise<ConfiguracaoSistema | null> {
    const f = this.store.find(s => s.chave === chave)
    return f ? ConfiguracaoSistema.reconstitute(f) : null
  }

  async findByCategoria(categoria: CategoriaCofiguracao): Promise<ConfiguracaoSistema[]> {
    return this.store.filter(s => s.categoria === categoria).map(s => ConfiguracaoSistema.reconstitute(s))
  }

  async findAtivas(): Promise<ConfiguracaoSistema[]> {
    return this.store.filter(s => s.ativo).map(s => ConfiguracaoSistema.reconstitute(s))
  }

  clear(): void { this.store = [] }
}
