import { DealClose, DealCloseProps, FormaPagamento } from '../../domain/entities/DealClose'
import { IQualificationRepository, IDealCloseRepository } from '../ports/repositories'
import { rn_q04_qualificacaoObrigatoria } from '../../domain/rules/BusinessRules'

export interface FecharVendaInput {
  oportunidadeId: string
  clienteId: string
  valorTotal: number
  mrr: number
  segmentoId?: string
  cicloDias: number
  dataInicio: string
  dataFim: string
  formaPagamento: FormaPagamento
  condicoesJson?: Record<string, unknown>
  responsavelCsId: string
  fechadoPor: string
  agora: string
}

export interface FecharVendaOutput {
  dealClose: DealCloseProps
  /** Payload pronto para publicar como cap03.oportunidade.ganha (ADR-0006) */
  eventPayload: ReturnType<DealClose['toEventPayload']>
}

export class FecharVendaUseCase {
  constructor(
    private readonly qualRepo: IQualificationRepository,
    private readonly dealRepo: IDealCloseRepository,
  ) {}

  async execute(input: FecharVendaInput): Promise<FecharVendaOutput> {
    // RN-Q04: qualificação prévia obrigatória
    const qualificacao = await this.qualRepo.findByOportunidade(input.oportunidadeId)
    if (!qualificacao) {
      throw new Error(`RN-Q04: oportunidade ${input.oportunidadeId} não possui qualificação registrada`)
    }
    rn_q04_qualificacaoObrigatoria(qualificacao)

    // Idempotência: se já fechou, retorna o existente
    const existente = await this.dealRepo.findByOportunidade(input.oportunidadeId)
    if (existente) {
      return { dealClose: existente.toObject(), eventPayload: existente.toEventPayload() }
    }

    const dealClose = DealClose.criarGanha({
      ...input,
      qualificationId: qualificacao.id,
    })

    await this.dealRepo.save(dealClose)

    return {
      dealClose: dealClose.toObject(),
      eventPayload: dealClose.toEventPayload(),
    }
  }
}
