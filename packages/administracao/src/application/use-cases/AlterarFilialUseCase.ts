import { IUsuarioAdminRepository, IFilialRepository, IAuditLog } from '../ports/Repositories'

export interface AlterarFilialInput {
  usuarioId: string
  filialId: string | undefined
  atorId: string
  agora: string
}

export class AlterarFilialUseCase {
  constructor(
    private readonly usuarioRepo: IUsuarioAdminRepository,
    private readonly filialRepo: IFilialRepository,
    private readonly audit: IAuditLog,
  ) {}

  async execute(input: AlterarFilialInput): Promise<void> {
    const usuario = await this.usuarioRepo.findById(input.usuarioId)
    if (!usuario) throw new Error(`AlterarFilial: usuário ${input.usuarioId} não encontrado`)

    if (input.filialId) {
      const filial = await this.filialRepo.findById(input.filialId)
      if (!filial) throw new Error(`AlterarFilial: filial ${input.filialId} não encontrada`)
      if (filial.status === 'INATIVA') throw new Error('AlterarFilial: filial inativa')
    }

    usuario.alterarFilial(input.filialId, input.agora)
    await this.usuarioRepo.save(usuario)

    await this.audit.registrar({
      tipo: 'usuario.filial.alterada',
      empresaId: usuario.empresaId,
      atorId: input.atorId,
      alvoId: usuario.id,
      detalhe: { filialId: input.filialId },
      ocorridoEm: input.agora,
    })
  }
}
