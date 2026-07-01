import { Proposal } from '../../domain/entities/Proposal'
import { IProposalRepository } from '../../application/ports/repositories'

export class InMemoryProposalRepository implements IProposalRepository {
  private store = new Map<string, Proposal>()

  async save(proposal: Proposal): Promise<void> {
    this.store.set(proposal.id, proposal)
  }

  async findById(id: string): Promise<Proposal | null> {
    return this.store.get(id) ?? null
  }

  async findAtivaByOportunidade(oportunidadeId: string): Promise<Proposal | null> {
    return (
      [...this.store.values()].find(
        p => p.oportunidadeId === oportunidadeId && p.estaAtiva(),
      ) ?? null
    )
  }

  async findByOportunidade(oportunidadeId: string): Promise<Proposal[]> {
    return [...this.store.values()].filter(p => p.oportunidadeId === oportunidadeId)
  }

  async findAll(): Promise<Proposal[]> {
    return [...this.store.values()]
  }
}
