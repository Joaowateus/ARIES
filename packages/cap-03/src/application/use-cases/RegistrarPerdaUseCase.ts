import { DealClose, DealCloseProps } from '../../domain/entities/DealClose'
import { IQualificationRepository, IDealCloseRepository } from '../ports/repositories'

export interface RegistrarPerdaInput {
  oportunidadeId: string
  clienteId: string
  valorTotal: number
  segmentoId?: string
  cicloDias: number
  motivoPerda: string
  concorrenteVencedorId?: string
  fechadoPor: string
  agora: string
}

export interface RegistrarPerdaOutput {
  dealClose: DealCloseProps
  eventPayload: {
    oportunidade_id: string
    cliente_id: string
    valor_estimado: number
    segmento_id?: string
    ciclo_dias: number
    motivo_perda: string
    concorrente_vencedor_id?: string
    fechado_por: string
    fechado_em: string
  }
}

export class RegistrarPerdaUseCase {
  constructor(
    private readonly qualRepo: IQualificationRepository,
    private readonly dealRepo: IDealCloseRepository,
  ) {}

  async execute(input: RegistrarPerdaInput): Promise<RegistrarPerdaOutput> {
    const existente = await this.dealRepo.findByOportunidade(input.oportunidadeId)
    if (existente) {
      return {
        dealClose: existente.toObject(),
        eventPayload: this.buildLostPayload(existente, input),
      }
    }

    const qualificacao = await this.qualRepo.findByOportunidade(input.oportunidadeId)
    const qualificationId = qualificacao?.id ?? 'sem-qualificacao'

    const dealClose = DealClose.criarPerdida({
      oportunidadeId: input.oportunidadeId,
      clienteId: input.clienteId,
      valorTotal: input.valorTotal,
      segmentoId: input.segmentoId,
      cicloDias: input.cicloDias,
      motivoPerda: input.motivoPerda,
      concorrenteVencedorId: input.concorrenteVencedorId,
      qualificationId,
      fechadoPor: input.fechadoPor,
      agora: input.agora,
    })

    await this.dealRepo.save(dealClose)

    return {
      dealClose: dealClose.toObject(),
      eventPayload: this.buildLostPayload(dealClose, input),
    }
  }

  private buildLostPayload(deal: DealClose, input: RegistrarPerdaInput) {
    return {
      oportunidade_id: deal.oportunidadeId,
      cliente_id: deal.clienteId,
      valor_estimado: deal.valorTotal,
      segmento_id: deal.segmentoId,
      ciclo_dias: deal.cicloDias,
      motivo_perda: deal.motivoPerda ?? input.motivoPerda,
      concorrente_vencedor_id: deal.concorrenteVencedorId,
      fechado_por: deal.fechadoPor,
      fechado_em: deal.fechadoEm,
    }
  }
}
