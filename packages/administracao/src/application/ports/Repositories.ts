import { UsuarioAdministrado, PapelSistema, StatusUsuarioAdmin } from '../../domain/entities/UsuarioAdministrado'
import { Time } from '../../domain/entities/Time'
import { Filial } from '../../domain/entities/Filial'

export interface IUsuarioAdminRepository {
  save(usuario: UsuarioAdministrado): Promise<void>
  findById(id: string): Promise<UsuarioAdministrado | undefined>
  findByEmail(empresaId: string, email: string): Promise<UsuarioAdministrado | undefined>
  findByEmpresa(empresaId: string, filtros?: { status?: StatusUsuarioAdmin; papel?: PapelSistema }): Promise<UsuarioAdministrado[]>
}

export interface ITimeRepository {
  save(time: Time): Promise<void>
  findById(id: string): Promise<Time | undefined>
  findByEmpresa(empresaId: string): Promise<Time[]>
}

export interface IFilialRepository {
  save(filial: Filial): Promise<void>
  findById(id: string): Promise<Filial | undefined>
  findByEmpresa(empresaId: string): Promise<Filial[]>
}

export interface IAuditLog {
  registrar(evento: { tipo: string; empresaId: string; atorId: string; alvoId: string; detalhe?: Record<string, unknown>; ocorridoEm: string }): Promise<void>
  findByEmpresa(empresaId: string): Promise<Array<{ tipo: string; empresaId: string; atorId: string; alvoId: string; detalhe?: Record<string, unknown>; ocorridoEm: string }>>
}
