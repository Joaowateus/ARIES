import { ProposalProps } from '../../domain/entities/Proposal'
import { IProposalRepository } from '../ports/repositories'

export interface EnviarPropostaInput {
  propostaId: string
  agora: string
}

export interface EnviarPropostaOutput {
  proposal: ProposalProps
  eventPayload: {
    proposta_id: string
    oportunidade_id: string
    cliente_id: string
    valor_liquido: number
    percentual_desconto: number
    enviada_em: string
  }
}

export class EnviarPropostaUseCase {
  constructor(private readonly proposalRepo: IProposalRepository) {}

  async execute(input: EnviarPropostaInput): Promise<EnviarPropostaOutput> {
    const proposal = await this.proposalRepo.findById(input.propostaId)
    if (!proposal) throw new Error(`Proposta ${input.propostaId} não encontrada`)

    // RN-G05 enforced in proposal.enviar()
    proposal.enviar(input.agora)
    await this.proposalRepo.save(proposal)

    return {
      proposal: proposal.toObject(),
      eventPayload: {
        proposta_id: proposal.id,
        oportunidade_id: proposal.oportunidadeId,
        cliente_id: proposal.clienteId,
        valor_liquido: proposal.valorLiquido,
        percentual_desconto: proposal.percentualDesconto,
        enviada_em: proposal.enviadaEm!,
      },
    }
  }
}
