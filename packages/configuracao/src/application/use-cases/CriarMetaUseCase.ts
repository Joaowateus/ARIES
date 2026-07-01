import { Meta, TipoMeta, PeriodicidadeMeta, MetaProps } from '../../domain/entities/Meta'
import { IMetaRepository, IConfiguracaoAuditLog } from '../ports/Repositories'
import { IConfiguracaoEventPublisher } from '../ports/IEventPublisher'

export interface CriarMetaInput {
  empresaId: string
  tipo: TipoMeta
  alvoId: string
  periodicidade: PeriodicidadeMeta
  periodo: string
  valorMeta: number
  atorId: string
  agora: string
}

export class CriarMetaUseCase {
  constructor(
    private readonly repo: IMetaRepository,
    private readonly audit: IConfiguracaoAuditLog,
    private readonly events: IConfiguracaoEventPublisher,
  ) {}

  async execute(input: CriarMetaInput): Promise<MetaProps> {
    const meta = Meta.create({
      empresaId: input.empresaId,
      tipo: input.tipo,
      alvoId: input.alvoId,
      periodicidade: input.periodicidade,
      periodo: input.periodo,
      valorMeta: input.valorMeta,
      agora: input.agora,
    })

    await this.repo.save(meta)

    await this.audit.registrar({
      tipo: 'meta.criada',
      empresaId: input.empresaId,
      atorId: input.atorId,
      alvoId: meta.id,
      detalhe: { tipo: input.tipo, alvoId: input.alvoId, periodo: input.periodo, valorMeta: input.valorMeta },
      ocorridoEm: input.agora,
    })

    await this.events.publish({
      tipo: 'meta.criada',
      empresaId: input.empresaId,
      ocorridoEm: input.agora,
      payload: { metaId: meta.id, tipo: input.tipo, alvoId: input.alvoId, valorMeta: input.valorMeta },
    })

    return meta.toObject()
  }
}
