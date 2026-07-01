import { ActionPlan, ActionPlanProps } from '../../domain/entities/ActionPlan'
import { IActionPlanRepository } from '../../application/ports/repositories'

export class InMemoryActionPlanRepository implements IActionPlanRepository {
  private store: ActionPlanProps[] = []

  async save(plan: ActionPlan): Promise<void> {
    const idx = this.store.findIndex(p => p.id === plan.id)
    if (idx >= 0) this.store[idx] = plan.toObject()
    else this.store.push(plan.toObject())
  }

  async findById(id: string): Promise<ActionPlan | null> {
    const found = this.store.find(p => p.id === id)
    return found ? ActionPlan.reconstitute(found) : null
  }

  async findByDiagnostico(diagnosticoId: string): Promise<ActionPlan | null> {
    const found = this.store.find(p => p.diagnosticoId === diagnosticoId)
    return found ? ActionPlan.reconstitute(found) : null
  }

  async findAtivos(): Promise<ActionPlan[]> {
    return this.store.filter(p => p.status === 'ATIVO').map(p => ActionPlan.reconstitute(p))
  }

  clear(): void { this.store = [] }
}
