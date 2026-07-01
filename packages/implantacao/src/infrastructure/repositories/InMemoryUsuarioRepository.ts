import { Usuario, UsuarioProps, PapelUsuario } from '../../domain/entities/Usuario'
import { IUsuarioRepository } from '../../application/ports/repositories'

export class InMemoryUsuarioRepository implements IUsuarioRepository {
  private store: UsuarioProps[] = []

  async save(u: Usuario): Promise<void> {
    const idx = this.store.findIndex(s => s.id === u.id)
    if (idx >= 0) this.store[idx] = u.toObject()
    else this.store.push(u.toObject())
  }

  async findById(id: string): Promise<Usuario | null> {
    const f = this.store.find(s => s.id === id)
    return f ? Usuario.reconstitute(f) : null
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    const f = this.store.find(s => s.email.toLowerCase() === email.toLowerCase())
    return f ? Usuario.reconstitute(f) : null
  }

  async findByEmpresa(empresaId: string): Promise<Usuario[]> {
    return this.store.filter(s => s.empresaId === empresaId).map(s => Usuario.reconstitute(s))
  }

  async findByEmpresaEPapel(empresaId: string, papel: PapelUsuario): Promise<Usuario[]> {
    return this.store
      .filter(s => s.empresaId === empresaId && s.papel === papel)
      .map(s => Usuario.reconstitute(s))
  }

  clear(): void { this.store = [] }
}
