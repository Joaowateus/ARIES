import { UsuarioAdministrado, PapelSistema } from '../../domain/entities/UsuarioAdministrado'
import { IUsuarioAdminRepository, IAuditLog } from '../ports/Repositories'
import { IEventPublisher } from '../ports/IEventPublisher'

export interface ConvidarUsuarioInput {
  empresaId: string
  nome: string
  email: string
  papel: PapelSistema
  equipeId?: string
  filialId?: string
  convidadoPor: string
  agora: string
}

export interface ConvidarUsuarioOutput {
  usuarioId: string
  email: string
  status: 'PENDENTE'
}

export class ConvidarUsuarioUseCase {
  constructor(
    private readonly repo: IUsuarioAdminRepository,
    private readonly audit: IAuditLog,
    private readonly events: IEventPublisher,
  ) {}

  async execute(input: ConvidarUsuarioInput): Promise<ConvidarUsuarioOutput> {
    const existente = await this.repo.findByEmail(input.empresaId, input.email)
    if (existente) {
      return { usuarioId: existente.id, email: existente.email, status: 'PENDENTE' }
    }

    const usuario = UsuarioAdministrado.create({
      empresaId: input.empresaId,
      nome: input.nome,
      email: input.email,
      papel: input.papel,
      equipeId: input.equipeId,
      filialId: input.filialId,
      convidadoPor: input.convidadoPor,
      convidadoEm: input.agora,
    })

    await this.repo.save(usuario)

    await this.audit.registrar({
      tipo: 'usuario.convidado',
      empresaId: input.empresaId,
      atorId: input.convidadoPor,
      alvoId: usuario.id,
      detalhe: { email: input.email, papel: input.papel },
      ocorridoEm: input.agora,
    })

    await this.events.publish({
      tipo: 'usuario.convidado',
      empresaId: input.empresaId,
      ocorridoEm: input.agora,
      payload: { usuarioId: usuario.id, email: input.email, papel: input.papel, convidadoPor: input.convidadoPor },
    })

    return { usuarioId: usuario.id, email: usuario.email, status: 'PENDENTE' }
  }
}
