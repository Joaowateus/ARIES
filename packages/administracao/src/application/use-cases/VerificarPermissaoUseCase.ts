import { IUsuarioAdminRepository } from '../ports/Repositories'
import { Permissao, possuiPermissao, permissoesDoRole } from '../../domain/rules/Rbac'

export interface VerificarPermissaoInput {
  usuarioId: string
  permissao: Permissao
}

export interface VerificarPermissaoOutput {
  permitido: boolean
  papel: string
  permissoesDisponiveis: Permissao[]
}

export class VerificarPermissaoUseCase {
  constructor(private readonly repo: IUsuarioAdminRepository) {}

  async execute(input: VerificarPermissaoInput): Promise<VerificarPermissaoOutput> {
    const usuario = await this.repo.findById(input.usuarioId)
    if (!usuario) throw new Error(`VerificarPermissao: usuário ${input.usuarioId} não encontrado`)

    if (usuario.status !== 'ATIVO') {
      return { permitido: false, papel: usuario.papel, permissoesDisponiveis: [] }
    }

    return {
      permitido: possuiPermissao(usuario.papel, input.permissao),
      papel: usuario.papel,
      permissoesDisponiveis: permissoesDoRole(usuario.papel),
    }
  }
}
