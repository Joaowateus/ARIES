import { CustomerInteraction } from '../../domain/entities/CustomerInteraction'
import { ICustomerInteractionRepository } from '../../application/ports/repositories'

export class InMemoryCustomerInteractionRepository implements ICustomerInteractionRepository {
  private store = new Map<string, CustomerInteraction>()

  async save(interaction: CustomerInteraction): Promise<void> {
    this.store.set(interaction.id, interaction)
  }

  async findByCustomer(customerId: string): Promise<CustomerInteraction[]> {
    return [...this.store.values()].filter(i => i.customerId === customerId)
  }

  async findAll(): Promise<CustomerInteraction[]> {
    return [...this.store.values()]
  }
}
