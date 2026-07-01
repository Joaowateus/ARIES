import { Opportunity, OpportunityProps, OpportunityStage } from '../../domain/entities/Opportunity'
import { IOpportunityRepository } from '../../application/ports/repositories'

export class InMemoryOpportunityRepository implements IOpportunityRepository {
  private store = new Map<string, OpportunityProps>()

  async save(op: Opportunity): Promise<void> {
    this.store.set(op.id, op.toObject())
  }

  async findById(id: string): Promise<Opportunity | null> {
    const props = this.store.get(id)
    return props ? Opportunity.reconstitute(props) : null
  }

  async findByCliente(clienteId: string): Promise<Opportunity[]> {
    return [...this.store.values()]
      .filter((p) => p.clienteId === clienteId)
      .map(Opportunity.reconstitute)
  }

  async findByEstagio(estagio: OpportunityStage): Promise<Opportunity[]> {
    return [...this.store.values()]
      .filter((p) => p.estagio === estagio)
      .map(Opportunity.reconstitute)
  }

  async findAtivas(): Promise<Opportunity[]> {
    const terminais = new Set(['GANHA', 'PERDIDA', 'CANCELADA'])
    return [...this.store.values()]
      .filter((p) => !terminais.has(p.estagio))
      .map(Opportunity.reconstitute)
  }

  async findAll(): Promise<Opportunity[]> {
    return [...this.store.values()].map(Opportunity.reconstitute)
  }

  clear(): void { this.store.clear() }
}
