import { Empresa } from '../../domain/entities/Empresa'
import { Usuario, PapelUsuario } from '../../domain/entities/Usuario'
import { Sessao } from '../../domain/entities/Sessao'

export interface IEmpresaRepository {
  save(empresa: Empresa): Promise<void>
  findById(id: string): Promise<Empresa | null>
  findByCnpj(cnpj: string): Promise<Empresa | null>
  findAll(): Promise<Empresa[]>
}

export interface IUsuarioRepository {
  save(usuario: Usuario): Promise<void>
  findById(id: string): Promise<Usuario | null>
  findByEmail(email: string): Promise<Usuario | null>
  findByEmpresa(empresaId: string): Promise<Usuario[]>
  findByEmpresaEPapel(empresaId: string, papel: PapelUsuario): Promise<Usuario[]>
}

export interface ISessaoRepository {
  save(sessao: Sessao): Promise<void>
  findByToken(token: string): Promise<Sessao | null>
  findByUsuario(usuarioId: string): Promise<Sessao[]>
  invalidarTodasDoUsuario(usuarioId: string, agora: string): Promise<void>
}
