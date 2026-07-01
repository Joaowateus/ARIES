import { IMetaRepository, IConfiguracaoAuditLog } from '../ports/Repositories'

export interface EncerrarMetaInput {
  metaId: string
  atorId: string
  agora: string
}

export class EncerrarMetaUseCase {
  constructor(
    private readonly repo: IMetaRepository,
    private readonly audit: IConfiguracaoAuditLog,
  ) {}

  async execute(input: EncerrarMetaInput): Promise<void> {
    const meta = await this.repo.findById(input.metaId)
    if (!meta) throw new Error(`EncerrarMeta: meta ${input.metaId} não encontrada`)

    meta.encerrar(input.agora)
    await this.repo.save(meta)

    await this.audit.registrar({
      tipo: 'meta.encerrada',
      empresaId: meta.empresaId,
      atorId: input.atorId,
      alvoId: meta.id,
      ocorridoEm: input.agora,
    })
  }
}
