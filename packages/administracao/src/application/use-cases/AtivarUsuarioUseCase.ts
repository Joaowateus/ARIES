import { IUsuarioAdminRepository, IAuditLog } from '../ports/Repositories'
import { IEventPublisher } from '../ports/IEventPublisher'

export interface AtivarUsuarioInput {
  usuarioId: string
  atorId: string
  agora: string
}

export class AtivarUsuarioUseCase {
  constructor(
    private readonly repo: IUsuarioAdminRepository,
    private readonly audit: IAuditLog,
    private readonly events: IEventPublisher,
  ) {}

  async execute(input: AtivarUsuarioInput): Promise<void> {
    const usuario = await this.repo.findById(input.usuarioId)
    if (!usuario) throw new Error(`AtivarUsuario: usuário ${input.usuarioId} não encontrado`)

    usuario.ativar(input.agora)
    await this.repo.save(usuario)

    await this.audit.registrar({
      tipo: 'usuario.ativado',
      empresaId: usuario.empresaId,
      atorId: input.atorId,
      alvoId: usuario.id,
      ocorridoEm: input.agora,
    })

    await this.events.publish({
      tipo: 'usuario.ativado',
      empresaId: usuario.empresaId,
      ocorridoEm: input.agora,
      payload: { usuarioId: usuario.id, email: usuario.email },
    })
  }
}
