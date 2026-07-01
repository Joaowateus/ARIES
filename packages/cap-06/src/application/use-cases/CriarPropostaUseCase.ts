import { Proposal, ProposalProps } from '../../domain/entities/Proposal'
import { ApprovalRequest, ApprovalRequestProps } from '../../domain/entities/ApprovalRequest'
import { NivelAlcada } from '../../domain/entities/CommercialPolicy'
import { rn_g_validarContraPolitica, rn_g03_propostaUnicaAtiva } from '../../domain/rules/BusinessRules'
import {
  ICommercialPolicyRepository,
  IProposalRepository,
  IApprovalRequestRepository,
} from '../ports/repositories'

export interface CriarPropostaInput {
  oportunidadeId: string
  clienteId: string
  valorBruto: number
  percentualDesconto: number
  margemPercent: number
  responsavelId: string
  alcadaResponsavel: NivelAlcada
  condicoesJson: Record<string, unknown>
  segmentoId?: string
  criadoPor: string
  agora: string
}

export interface CriarPropostaOutput {
  proposal: ProposalProps
  approvalRequest?: ApprovalRequestProps
  eventPayload: {
    proposta_id: string
    oportunidade_id: string
    status: string
    valor_liquido: number
    percentual_desconto: number
    conforme: boolean
    violacoes: string[]
    exige_aprovacao: boolean
    criado_em: string
  }
}

export class CriarPropostaUseCase {
  constructor(
    private readonly policyRepo: ICommercialPolicyRepository,
    private readonly proposalRepo: IProposalRepository,
    private readonly approvalRepo: IApprovalRequestRepository,
  ) {}

  async execute(input: CriarPropostaInput): Promise<CriarPropostaOutput> {
    // RN-G03: não pode existir proposta ativa para esta oportunidade
    const ativa = await this.proposalRepo.findAtivaByOportunidade(input.oportunidadeId)
    rn_g03_propostaUnicaAtiva(!!ativa, input.oportunidadeId)

    // Busca política vigente (por segmento ou global)
    const policy =
      (await this.policyRepo.findAtiva(input.segmentoId)) ??
      (await this.policyRepo.findAtiva(undefined))

    if (!policy) throw new Error('Nenhuma política comercial ativa encontrada')

    // RN-G01 + RN-G02 + RN-G06: validação contra política
    const policyValidation = rn_g_validarContraPolitica(
      policy,
      input.valorBruto,
      input.percentualDesconto,
      input.margemPercent,
      input.alcadaResponsavel,
    )

    // Versão é a contagem de propostas da oportunidade + 1
    const historico = await this.proposalRepo.findByOportunidade(input.oportunidadeId)
    const versao = historico.length + 1

    const proposal = Proposal.create({
      oportunidadeId: input.oportunidadeId,
      clienteId: input.clienteId,
      policyId: policy.id,
      versao,
      status: 'RASCUNHO', // será sobrescrito em Proposal.create conforme exigeAprovacao
      valorBruto: input.valorBruto,
      percentualDesconto: input.percentualDesconto,
      margemPercent: input.margemPercent,
      responsavelId: input.responsavelId,
      alcadaResponsavel: input.alcadaResponsavel,
      policyValidation,
      condicoesJson: input.condicoesJson,
      criadoPor: input.criadoPor,
      agora: input.agora,
    })

    await this.proposalRepo.save(proposal)

    // RN-G04: criar solicitação de aprovação automaticamente se necessário
    let approvalRequest: ApprovalRequest | undefined
    if (policyValidation.exigeAprovacao) {
      approvalRequest = ApprovalRequest.create({
        propostaId: proposal.id,
        oportunidadeId: input.oportunidadeId,
        nivelNecessario: policyValidation.alcadaNecessaria,
        violacoes: policyValidation.violacoes,
        solicitadoPor: input.responsavelId,
        criadoEm: input.agora,
      })
      await this.approvalRepo.save(approvalRequest)
    }

    return {
      proposal: proposal.toObject(),
      approvalRequest: approvalRequest?.toObject(),
      eventPayload: {
        proposta_id: proposal.id,
        oportunidade_id: proposal.oportunidadeId,
        status: proposal.status,
        valor_liquido: proposal.valorLiquido,
        percentual_desconto: proposal.percentualDesconto,
        conforme: policyValidation.conforme,
        violacoes: policyValidation.violacoes,
        exige_aprovacao: policyValidation.exigeAprovacao,
        criado_em: proposal.criadoEm,
      },
    }
  }
}
