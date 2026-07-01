import { IMetaRepository, IConfiguracaoAuditLog } from '../ports/Repositories'
import { IConfiguracaoEventPublisher } from '../ports/IEventPublisher'

export interface RevisarMetaInput {
  metaId: string
  novoValor: number
  motivo: string
  atorId: string
  agora: string
}

export class RevisarMetaUseCase {
  constructor(
    private readonly repo: IMetaRepository,
    private readonly audit: IConfiguracaoAuditLog,
    private readonly events: IConfiguracaoEventPublisher,
  ) {}

  async execute(input: RevisarMetaInput): Promise<void> {
    const meta = await this.repo.findById(input.metaId)
    if (!meta) throw new Error(`RevisarMeta: meta ${input.metaId} não encontrada`)

    meta.revisar(input.novoValor, input.motivo, input.agora)
    await this.repo.save(meta)

    await this.audit.registrar({
      tipo: 'meta.revisada',
      empresaId: meta.empresaId,
      atorId: input.atorId,
      alvoId: meta.id,
      detalhe: { novoValor: input.novoValor, motivo: input.motivo },
      ocorridoEm: input.agora,
    })

    await this.events.publish({
      tipo: 'meta.revisada',
      empresaId: meta.empresaId,
      ocorridoEm: input.agora,
      payload: { metaId: meta.id, novoValor: input.novoValor },
    })
  }
}
