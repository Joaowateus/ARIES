import { Customer } from '../../domain/entities/Customer'
import { ICustomerRepository } from '../../application/ports/repositories'

export class InMemoryCustomerRepository implements ICustomerRepository {
  private store = new Map<string, Customer>()
  private byClienteId = new Map<string, string>()
  private byOportunidade = new Map<string, string>()

  async save(customer: Customer): Promise<void> {
    this.store.set(customer.id, customer)
    this.byClienteId.set(customer.clienteId, customer.id)
    this.byOportunidade.set(customer.oportunidadeId, customer.id)
  }

  async findById(id: string): Promise<Customer | null> {
    return this.store.get(id) ?? null
  }

  async findByClienteId(clienteId: string): Promise<Customer | null> {
    const id = this.byClienteId.get(clienteId)
    return id ? (this.store.get(id) ?? null) : null
  }

  async findByOportunidade(oportunidadeId: string): Promise<Customer | null> {
    const id = this.byOportunidade.get(oportunidadeId)
    return id ? (this.store.get(id) ?? null) : null
  }

  async findAtivos(): Promise<Customer[]> {
    return [...this.store.values()].filter(c => c.estaAtivo())
  }

  async findAll(): Promise<Customer[]> {
    return [...this.store.values()]
  }
}
