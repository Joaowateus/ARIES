import { Opportunity, OpportunityStage } from '../../domain/entities/Opportunity'

export interface IOpportunityRepository {
  save(op: Opportunity): Promise<void>
  findById(id: string): Promise<Opportunity | null>
  findByCliente(clienteId: string): Promise<Opportunity[]>
  findByEstagio(estagio: OpportunityStage): Promise<Opportunity[]>
  findAtivas(): Promise<Opportunity[]>
  findAll(): Promise<Opportunity[]>
}
