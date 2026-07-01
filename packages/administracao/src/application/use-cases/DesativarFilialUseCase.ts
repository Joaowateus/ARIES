import { IFilialRepository, IAuditLog } from '../ports/Repositories'

export interface DesativarFilialInput {
  filialId: string
  atorId: string
  agora: string
}

export class DesativarFilialUseCase {
  constructor(
    private readonly repo: IFilialRepository,
    private readonly audit: IAuditLog,
  ) {}

  async execute(input: DesativarFilialInput): Promise<void> {
    const filial = await this.repo.findById(input.filialId)
    if (!filial) throw new Error(`DesativarFilial: filial ${input.filialId} não encontrada`)

    filial.desativar(input.agora)
    await this.repo.save(filial)

    await this.audit.registrar({
      tipo: 'filial.desativada',
      empresaId: filial.empresaId,
      atorId: input.atorId,
      alvoId: filial.id,
      ocorridoEm: input.agora,
    })
  }
}
