import { Onboarding } from '../../domain/entities/Onboarding'
import { IOnboardingRepository } from '../../application/ports/repositories'

export class InMemoryOnboardingRepository implements IOnboardingRepository {
  private store = new Map<string, Onboarding>()
  private byOportunidade = new Map<string, string>()

  async save(onboarding: Onboarding): Promise<void> {
    this.store.set(onboarding.id, onboarding)
    this.byOportunidade.set(onboarding.oportunidadeId, onboarding.id)
  }

  async findById(id: string): Promise<Onboarding | null> {
    return this.store.get(id) ?? null
  }

  async findByOportunidade(oportunidadeId: string): Promise<Onboarding | null> {
    const id = this.byOportunidade.get(oportunidadeId)
    return id ? (this.store.get(id) ?? null) : null
  }

  async findByCustomer(customerId: string): Promise<Onboarding[]> {
    return [...this.store.values()].filter(o => o.customerId === customerId)
  }

  async findAll(): Promise<Onboarding[]> {
    return [...this.store.values()]
  }
}
