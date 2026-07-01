import { ITimeRepository, IUsuarioAdminRepository, IAuditLog } from '../ports/Repositories'

export interface EditarTimeInput {
  timeId: string
  nome?: string
  descricao?: string
  liderId?: string
  adicionarMembros?: string[]
  removerMembros?: string[]
  atorId: string
  agora: string
}

export class EditarTimeUseCase {
  constructor(
    private readonly timeRepo: ITimeRepository,
    private readonly usuarioRepo: IUsuarioAdminRepository,
    private readonly audit: IAuditLog,
  ) {}

  async execute(input: EditarTimeInput): Promise<void> {
    const time = await this.timeRepo.findById(input.timeId)
    if (!time) throw new Error(`EditarTime: time ${input.timeId} não encontrado`)

    time.editar({ nome: input.nome, descricao: input.descricao, liderId: input.liderId }, input.agora)

    for (const uid of input.adicionarMembros ?? []) {
      time.adicionarMembro(uid, input.agora)
    }
    for (const uid of input.removerMembros ?? []) {
      time.removerMembro(uid, input.agora)
    }

    await this.timeRepo.save(time)

    await this.audit.registrar({
      tipo: 'time.editado',
      empresaId: time.empresaId,
      atorId: input.atorId,
      alvoId: time.id,
      ocorridoEm: input.agora,
    })
  }
}
