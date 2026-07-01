import { Vendedor, VendedorProps, CargoVendedor } from '../../domain/entities/Vendedor'
import { IVendedorRepository } from '../../application/ports/repositories'

export class InMemoryVendedorRepository implements IVendedorRepository {
  private store: VendedorProps[] = []

  async save(v: Vendedor): Promise<void> {
    const idx = this.store.findIndex(s => s.id === v.id)
    if (idx >= 0) this.store[idx] = v.toObject()
    else this.store.push(v.toObject())
  }

  async findById(id: string): Promise<Vendedor | null> {
    const f = this.store.find(s => s.id === id)
    return f ? Vendedor.reconstitute(f) : null
  }

  async findByEmail(email: string): Promise<Vendedor | null> {
    const f = this.store.find(s => s.email === email)
    return f ? Vendedor.reconstitute(f) : null
  }

  async findAtivos(): Promise<Vendedor[]> {
    return this.store.filter(s => s.status === 'ATIVO').map(s => Vendedor.reconstitute(s))
  }

  async findByCargo(cargo: CargoVendedor): Promise<Vendedor[]> {
    return this.store.filter(s => s.cargo === cargo).map(s => Vendedor.reconstitute(s))
  }

  async findAll(): Promise<Vendedor[]> {
    return this.store.map(s => Vendedor.reconstitute(s))
  }

  clear(): void { this.store = [] }
}
