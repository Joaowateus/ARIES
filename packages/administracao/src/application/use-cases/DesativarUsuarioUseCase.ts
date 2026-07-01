import { IUsuarioAdminRepository, IAuditLog } from '../ports/Repositories'
import { IEventPublisher } from '../ports/IEventPublisher'

export interface DesativarUsuarioInput {
  usuarioId: string
  atorId: string
  agora: string
}

export class DesativarUsuarioUseCase {
  constructor(
    private readonly repo: IUsuarioAdminRepository,
    private readonly audit: IAuditLog,
    private readonly events: IEventPublisher,
  ) {}

  async execute(input: DesativarUsuarioInput): Promise<void> {
    const usuario = await this.repo.findById(input.usuarioId)
    if (!usuario) throw new Error(`DesativarUsuario: usuário ${input.usuarioId} não encontrado`)

    usuario.desativar(input.agora)
    await this.repo.save(usuario)

    await this.audit.registrar({
      tipo: 'usuario.desativado',
      empresaId: usuario.empresaId,
      atorId: input.atorId,
      alvoId: usuario.id,
      ocorridoEm: input.agora,
    })

    await this.events.publish({
      tipo: 'usuario.desativado',
      empresaId: usuario.empresaId,
      ocorridoEm: input.agora,
      payload: { usuarioId: usuario.id, email: usuario.email },
    })
  }
}
