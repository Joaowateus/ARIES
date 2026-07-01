/**
 * Usuario — membro de uma empresa com papel e acesso ao Commercial OS.
 *
 * Papéis definem o que cada usuário pode ver e fazer no sistema.
 * O primeiro usuário de uma empresa recebe papel ADMIN automaticamente.
 */

import { v4 as uuidv4 } from 'uuid'

export type PapelUsuario = 'ADMIN' | 'GERENTE' | 'VENDEDOR' | 'SDR' | 'CS' | 'FINANCEIRO'
export type StatusUsuario = 'ATIVO' | 'INATIVO' | 'PENDENTE_PRIMEIRO_ACESSO'

export interface UsuarioProps {
  id: string
  empresaId: string
  nome: string
  email: string
  senhaHash: string
  papel: PapelUsuario
  status: StatusUsuario
  primeiroAcesso: boolean
  ultimoLoginEm?: string
  criadoEm: string
  atualizadoEm: string
}

export class Usuario {
  private constructor(private props: UsuarioProps) {}

  static create(params: Omit<UsuarioProps, 'id' | 'status' | 'primeiroAcesso' | 'criadoEm' | 'atualizadoEm'> & { agora: string }): Usuario {
    if (!params.nome?.trim()) throw new Error('Usuario: nome obrigatório')
    if (!params.email?.trim() || !params.email.includes('@')) throw new Error('Usuario: email inválido')
    if (!params.senhaHash?.trim()) throw new Error('Usuario: senhaHash obrigatória')

    return new Usuario({
      ...params,
      id: uuidv4(),
      status: 'PENDENTE_PRIMEIRO_ACESSO',
      primeiroAcesso: true,
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: UsuarioProps): Usuario {
    return new Usuario(props)
  }

  get id(): string { return this.props.id }
  get empresaId(): string { return this.props.empresaId }
  get nome(): string { return this.props.nome }
  get email(): string { return this.props.email }
  get senhaHash(): string { return this.props.senhaHash }
  get papel(): PapelUsuario { return this.props.papel }
  get status(): StatusUsuario { return this.props.status }
  get primeiroAcesso(): boolean { return this.props.primeiroAcesso }
  get ultimoLoginEm(): string | undefined { return this.props.ultimoLoginEm }
  get criadoEm(): string { return this.props.criadoEm }
  get atualizadoEm(): string { return this.props.atualizadoEm }

  registrarLogin(agora: string): void {
    if (this.props.status === 'INATIVO') throw new Error('Usuario: usuário inativo não pode fazer login')
    this.props.primeiroAcesso = false
    this.props.status = 'ATIVO'
    this.props.ultimoLoginEm = agora
    this.props.atualizadoEm = agora
  }

  alterarSenha(novaSenhaHash: string, agora: string): void {
    if (!novaSenhaHash?.trim()) throw new Error('Usuario: senhaHash inválida')
    this.props.senhaHash = novaSenhaHash
    this.props.primeiroAcesso = false
    this.props.atualizadoEm = agora
  }

  inativar(agora: string): void {
    this.props.status = 'INATIVO'
    this.props.atualizadoEm = agora
  }

  temPermissao(papeis: PapelUsuario[]): boolean {
    return papeis.includes(this.props.papel)
  }

  toObject(): UsuarioProps {
    return { ...this.props }
  }
}
