import { CommercialPolicy } from '../../domain/entities/CommercialPolicy'
import { Proposal } from '../../domain/entities/Proposal'
import { ApprovalRequest } from '../../domain/entities/ApprovalRequest'

export interface ICommercialPolicyRepository {
  save(policy: CommercialPolicy): Promise<void>
  findById(id: string): Promise<CommercialPolicy | null>
  findAtiva(segmentoId?: string): Promise<CommercialPolicy | null>
  findAll(): Promise<CommercialPolicy[]>
}

export interface IProposalRepository {
  save(proposal: Proposal): Promise<void>
  findById(id: string): Promise<Proposal | null>
  findAtivaByOportunidade(oportunidadeId: string): Promise<Proposal | null>
  findByOportunidade(oportunidadeId: string): Promise<Proposal[]>
  findAll(): Promise<Proposal[]>
}

export interface IApprovalRequestRepository {
  save(request: ApprovalRequest): Promise<void>
  findById(id: string): Promise<ApprovalRequest | null>
  findPendenteByProposta(propostaId: string): Promise<ApprovalRequest | null>
  findByProposta(propostaId: string): Promise<ApprovalRequest[]>
}
