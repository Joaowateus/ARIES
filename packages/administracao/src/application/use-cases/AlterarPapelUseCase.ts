import { PapelSistema } from '../../domain/entities/UsuarioAdministrado'
import { IUsuarioAdminRepository, IAuditLog } from '../ports/Repositories'
import { IEventPublisher } from '../ports/IEventPublisher'

export interface AlterarPapelInput {
  usuarioId: string
  novoPapel: PapelSistema
  atorId: string
  agora: string
}

export class AlterarPapelUseCase {
  constructor(
    private readonly repo: IUsuarioAdminRepository,
    private readonly audit: IAuditLog,
    private readonly events: IEventPublisher,
  ) {}

  async execute(input: AlterarPapelInput): Promise<void> {
    const usuario = await this.repo.findById(input.usuarioId)
    if (!usuario) throw new Error(`AlterarPapel: usuário ${input.usuarioId} não encontrado`)

    const papelAnterior = usuario.papel
    usuario.alterarPapel(input.novoPapel, input.agora)
    await this.repo.save(usuario)

    await this.audit.registrar({
      tipo: 'usuario.papel.alterado',
      empresaId: usuario.empresaId,
      atorId: input.atorId,
      alvoId: usuario.id,
      detalhe: { de: papelAnterior, para: input.novoPapel },
      ocorridoEm: input.agora,
    })

    await this.events.publish({
      tipo: 'usuario.papel.alterado',
      empresaId: usuario.empresaId,
      ocorridoEm: input.agora,
      payload: { usuarioId: usuario.id, de: papelAnterior, para: input.novoPapel },
    })
  }
}
