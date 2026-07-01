import { ProposalProps } from '../../domain/entities/Proposal'
import { NivelAlcada } from '../../domain/entities/CommercialPolicy'
import { IProposalRepository, IApprovalRequestRepository } from '../ports/repositories'

export interface ReprovarPropostaInput {
  propostaId: string
  reprovadoPor: string
  alcadaAprovador: NivelAlcada
  motivo: string
  agora: string
}

export interface ReprovarPropostaOutput {
  proposal: ProposalProps
  eventPayload: {
    proposta_id: string
    oportunidade_id: string
    reprovado_por: string
    motivo: string
    reprovado_em: string
  }
}

export class ReprovarPropostaUseCase {
  constructor(
    private readonly proposalRepo: IProposalRepository,
    private readonly approvalRepo: IApprovalRequestRepository,
  ) {}

  async execute(input: ReprovarPropostaInput): Promise<ReprovarPropostaOutput> {
    const proposal = await this.proposalRepo.findById(input.propostaId)
    if (!proposal) throw new Error(`Proposta ${input.propostaId} não encontrada`)

    const approvalReq = await this.approvalRepo.findPendenteByProposta(input.propostaId)
    if (!approvalReq) throw new Error(`Nenhuma aprovação pendente para proposta ${input.propostaId}`)

    approvalReq.reprovar(input.reprovadoPor, input.motivo, input.agora)
    proposal.reprovar(input.motivo, input.agora)

    await this.approvalRepo.save(approvalReq)
    await this.proposalRepo.save(proposal)

    return {
      proposal: proposal.toObject(),
      eventPayload: {
        proposta_id: proposal.id,
        oportunidade_id: proposal.oportunidadeId,
        reprovado_por: input.reprovadoPor,
        motivo: input.motivo,
        reprovado_em: input.agora,
      },
    }
  }
}
