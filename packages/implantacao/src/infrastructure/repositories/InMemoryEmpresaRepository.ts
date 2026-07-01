import { Empresa, EmpresaProps } from '../../domain/entities/Empresa'
import { IEmpresaRepository } from '../../application/ports/repositories'

export class InMemoryEmpresaRepository implements IEmpresaRepository {
  private store: EmpresaProps[] = []

  async save(e: Empresa): Promise<void> {
    const idx = this.store.findIndex(s => s.id === e.id)
    if (idx >= 0) this.store[idx] = e.toObject()
    else this.store.push(e.toObject())
  }

  async findById(id: string): Promise<Empresa | null> {
    const f = this.store.find(s => s.id === id)
    return f ? Empresa.reconstitute(f) : null
  }

  async findByCnpj(cnpj: string): Promise<Empresa | null> {
    const limpo = cnpj.replace(/\D/g, '')
    const f = this.store.find(s => s.cnpj === limpo)
    return f ? Empresa.reconstitute(f) : null
  }

  async findAll(): Promise<Empresa[]> {
    return this.store.map(s => Empresa.reconstitute(s))
  }

  clear(): void { this.store = [] }
}
