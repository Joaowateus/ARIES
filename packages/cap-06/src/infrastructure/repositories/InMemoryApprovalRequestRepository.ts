import { ApprovalRequest } from '../../domain/entities/ApprovalRequest'
import { IApprovalRequestRepository } from '../../application/ports/repositories'

export class InMemoryApprovalRequestRepository implements IApprovalRequestRepository {
  private store = new Map<string, ApprovalRequest>()

  async save(request: ApprovalRequest): Promise<void> {
    this.store.set(request.id, request)
  }

  async findById(id: string): Promise<ApprovalRequest | null> {
    return this.store.get(id) ?? null
  }

  async findPendenteByProposta(propostaId: string): Promise<ApprovalRequest | null> {
    return (
      [...this.store.values()].find(
        r => r.propostaId === propostaId && r.status === 'PENDENTE',
      ) ?? null
    )
  }

  async findByProposta(propostaId: string): Promise<ApprovalRequest[]> {
    return [...this.store.values()].filter(r => r.propostaId === propostaId)
  }
}
