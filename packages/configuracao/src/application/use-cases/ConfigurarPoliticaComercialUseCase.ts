/**
 * Wrapper que adiciona validação de segmento, auditoria e eventos ao
 * DefinirPoliticaUseCase do CAP-06. A lógica de negócio (alçadas, margem mínima)
 * permanece exclusivamente em CommercialPolicy do CAP-06.
 */
import { ICommercialPolicyRepository, DefinirPoliticaUseCase, CommercialPolicyProps } from '@soe/cap-06'
import { ISegmentoRepository, IConfiguracaoAuditLog } from '../ports/Repositories'
import { IConfiguracaoEventPublisher } from '../ports/IEventPublisher'

export interface ConfigurarPoliticaComercialInput {
  nome: string
  segmentoId?: string
  descontoMaxN1: number
  descontoMaxN2: number
  descontoMaxN3: number
  margemMinimaPercent: number
  empresaId: string
  criadoPor: string
  agora: string
}

export class ConfigurarPoliticaComercialUseCase {
  private readonly definirPolitica: DefinirPoliticaUseCase

  constructor(
    private readonly policyRepo: ICommercialPolicyRepository,
    private readonly segmentoRepo: ISegmentoRepository,
    private readonly audit: IConfiguracaoAuditLog,
    private readonly events: IConfiguracaoEventPublisher,
  ) {
    this.definirPolitica = new DefinirPoliticaUseCase(policyRepo)
  }

  async execute(input: ConfigurarPoliticaComercialInput): Promise<CommercialPolicyProps> {
    if (input.segmentoId) {
      const segmento = await this.segmentoRepo.findById(input.segmentoId)
      if (!segmento) throw new Error(`ConfigurarPoliticaComercial: segmento ${input.segmentoId} não encontrado`)
      if (segmento.status === 'INATIVO') throw new Error('ConfigurarPoliticaComercial: segmento inativo')
    }

    const { policy } = await this.definirPolitica.execute({
      nome: input.nome,
      segmentoId: input.segmentoId,
      descontoMaxN1: input.descontoMaxN1,
      descontoMaxN2: input.descontoMaxN2,
      descontoMaxN3: input.descontoMaxN3,
      margemMinimaPercent: input.margemMinimaPercent,
      criadoPor: input.criadoPor,
      agora: input.agora,
    })

    await this.audit.registrar({
      tipo: 'politica_comercial.configurada',
      empresaId: input.empresaId,
      atorId: input.criadoPor,
      alvoId: policy.id,
      detalhe: { nome: input.nome, segmentoId: input.segmentoId, margemMinimaPercent: input.margemMinimaPercent },
      ocorridoEm: input.agora,
    })

    await this.events.publish({
      tipo: 'politica_comercial.configurada',
      empresaId: input.empresaId,
      ocorridoEm: input.agora,
      payload: { policyId: policy.id, nome: input.nome, segmentoId: input.segmentoId },
    })

    return policy
  }
}
