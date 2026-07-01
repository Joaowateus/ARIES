import { CommercialPolicy } from '../../domain/entities/CommercialPolicy'
import { ICommercialPolicyRepository } from '../../application/ports/repositories'

export class InMemoryCommercialPolicyRepository implements ICommercialPolicyRepository {
  private store = new Map<string, CommercialPolicy>()

  async save(policy: CommercialPolicy): Promise<void> {
    this.store.set(policy.id, policy)
  }

  async findById(id: string): Promise<CommercialPolicy | null> {
    return this.store.get(id) ?? null
  }

  async findAtiva(segmentoId?: string): Promise<CommercialPolicy | null> {
    const todas = [...this.store.values()].filter(p => p.status === 'ATIVA')
    if (segmentoId) {
      return todas.find(p => p.segmentoId === segmentoId) ?? null
    }
    // política global: sem segmentoId
    return todas.find(p => !p.segmentoId) ?? null
  }

  async findAll(): Promise<CommercialPolicy[]> {
    return [...this.store.values()]
  }
}
