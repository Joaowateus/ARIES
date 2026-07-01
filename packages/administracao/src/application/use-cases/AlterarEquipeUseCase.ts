import { IUsuarioAdminRepository, ITimeRepository, IAuditLog } from '../ports/Repositories'

export interface AlterarEquipeInput {
  usuarioId: string
  equipeId: string | undefined
  atorId: string
  agora: string
}

export class AlterarEquipeUseCase {
  constructor(
    private readonly usuarioRepo: IUsuarioAdminRepository,
    private readonly timeRepo: ITimeRepository,
    private readonly audit: IAuditLog,
  ) {}

  async execute(input: AlterarEquipeInput): Promise<void> {
    const usuario = await this.usuarioRepo.findById(input.usuarioId)
    if (!usuario) throw new Error(`AlterarEquipe: usuário ${input.usuarioId} não encontrado`)

    if (input.equipeId) {
      const time = await this.timeRepo.findById(input.equipeId)
      if (!time) throw new Error(`AlterarEquipe: time ${input.equipeId} não encontrado`)
      if (time.status === 'INATIVO') throw new Error('AlterarEquipe: time inativo')
    }

    usuario.alterarEquipe(input.equipeId, input.agora)
    await this.usuarioRepo.save(usuario)

    await this.audit.registrar({
      tipo: 'usuario.equipe.alterada',
      empresaId: usuario.empresaId,
      atorId: input.atorId,
      alvoId: usuario.id,
      detalhe: { equipeId: input.equipeId },
      ocorridoEm: input.agora,
    })
  }
}
