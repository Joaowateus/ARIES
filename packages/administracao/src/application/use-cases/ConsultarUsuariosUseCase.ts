import { PapelSistema, StatusUsuarioAdmin, UsuarioAdministradoProps } from '../../domain/entities/UsuarioAdministrado'
import { IUsuarioAdminRepository } from '../ports/Repositories'

export interface ConsultarUsuariosInput {
  empresaId: string
  status?: StatusUsuarioAdmin
  papel?: PapelSistema
}

export interface ConsultarUsuariosOutput {
  usuarios: Omit<UsuarioAdministradoProps, never>[]
  total: number
}

export class ConsultarUsuariosUseCase {
  constructor(private readonly repo: IUsuarioAdminRepository) {}

  async execute(input: ConsultarUsuariosInput): Promise<ConsultarUsuariosOutput> {
    const usuarios = await this.repo.findByEmpresa(input.empresaId, {
      status: input.status,
      papel: input.papel,
    })
    return {
      usuarios: usuarios.map(u => u.toObject()),
      total: usuarios.length,
    }
  }
}
