import { CustomerHealth } from '../../domain/entities/CustomerHealth'
import { ICustomerHealthRepository } from '../../application/ports/repositories'

export class InMemoryCustomerHealthRepository implements ICustomerHealthRepository {
  private store = new Map<string, CustomerHealth[]>()

  async save(health: CustomerHealth): Promise<void> {
    const list = this.store.get(health.customerId) ?? []
    list.push(health)
    this.store.set(health.customerId, list)
  }

  async findLatestByCustomer(customerId: string): Promise<CustomerHealth | null> {
    const list = this.store.get(customerId)
    if (!list || list.length === 0) return null
    return list[list.length - 1]
  }

  async findAllByCustomer(customerId: string): Promise<CustomerHealth[]> {
    return this.store.get(customerId) ?? []
  }
}
