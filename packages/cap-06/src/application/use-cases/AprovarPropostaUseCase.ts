import { ProposalProps } from '../../domain/entities/Proposal'
import { nivelMaiorQue } from '../../domain/rules/BusinessRules'
import { NivelAlcada } from '../../domain/entities/CommercialPolicy'
import { IProposalRepository, IApprovalRequestRepository } from '../ports/repositories'

export interface AprovarPropostaInput {
  propostaId: string
  aprovadoPor: string
  alcadaAprovador: NivelAlcada
  motivo: string
  agora: string
}

export interface AprovarPropostaOutput {
  proposal: ProposalProps
  eventPayload: {
    proposta_id: string
    oportunidade_id: string
    aprovado_por: string
    alcada_aprovador: NivelAlcada
    aprovado_em: string
  }
}

export class AprovarPropostaUseCase {
  constructor(
    private readonly proposalRepo: IProposalRepository,
    private readonly approvalRepo: IApprovalRequestRepository,
  ) {}

  async execute(input: AprovarPropostaInput): Promise<AprovarPropostaOutput> {
    const proposal = await this.proposalRepo.findById(input.propostaId)
    if (!proposal) throw new Error(`Proposta ${input.propostaId} não encontrada`)

    const approvalReq = await this.approvalRepo.findPendenteByProposta(input.propostaId)
    if (!approvalReq) throw new Error(`Nenhuma aprovação pendente para proposta ${input.propostaId}`)

    // Verificar se o aprovador tem alçada suficiente
    if (nivelMaiorQue(approvalReq.nivelNecessario, input.alcadaAprovador)) {
      throw new Error(
        `Aprovador com alçada ${input.alcadaAprovador} não tem autoridade para aprovar. Necessário: ${approvalReq.nivelNecessario}`,
      )
    }

    approvalReq.aprovar(input.aprovadoPor, input.motivo, input.agora)
    proposal.aprovar(input.agora)

    await this.approvalRepo.save(approvalReq)
    await this.proposalRepo.save(proposal)

    return {
      proposal: proposal.toObject(),
      eventPayload: {
        proposta_id: proposal.id,
        oportunidade_id: proposal.oportunidadeId,
        aprovado_por: input.aprovadoPor,
        alcada_aprovador: input.alcadaAprovador,
        aprovado_em: input.agora,
      },
    }
  }
}
