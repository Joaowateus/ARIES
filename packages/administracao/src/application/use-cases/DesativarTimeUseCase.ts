import { ITimeRepository, IAuditLog } from '../ports/Repositories'

export interface DesativarTimeInput {
  timeId: string
  atorId: string
  agora: string
}

export class DesativarTimeUseCase {
  constructor(
    private readonly repo: ITimeRepository,
    private readonly audit: IAuditLog,
  ) {}

  async execute(input: DesativarTimeInput): Promise<void> {
    const time = await this.repo.findById(input.timeId)
    if (!time) throw new Error(`DesativarTime: time ${input.timeId} não encontrado`)

    time.desativar(input.agora)
    await this.repo.save(time)

    await this.audit.registrar({
      tipo: 'time.desativado',
      empresaId: time.empresaId,
      atorId: input.atorId,
      alvoId: time.id,
      ocorridoEm: input.agora,
    })
  }
}
