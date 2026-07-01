import { v4 as uuidv4 } from 'uuid'

export type StatusUsuarioAdmin = 'PENDENTE' | 'ATIVO' | 'INATIVO' | 'BLOQUEADO'

export type PapelSistema =
  | 'ADMINISTRADOR'
  | 'DIRETOR_COMERCIAL'
  | 'GERENTE_COMERCIAL'
  | 'SUPERVISOR'
  | 'SDR'
  | 'VENDEDOR'
  | 'CS'
  | 'FINANCEIRO'
  | 'LEITOR'

export interface UsuarioAdministradoProps {
  id: string
  empresaId: string
  nome: string
  email: string
  papel: PapelSistema
  status: StatusUsuarioAdmin
  equipeId?: string
  filialId?: string
  convidadoPor: string
  convidadoEm: string
  ativadoEm?: string
  desativadoEm?: string
  papelAlteradoEm?: string
  equipeAlteradaEm?: string
  filialAlteradaEm?: string
}

export class UsuarioAdministrado {
  private constructor(private props: UsuarioAdministradoProps) {}

  static create(params: Omit<UsuarioAdministradoProps, 'id' | 'status' | 'ativadoEm' | 'desativadoEm' | 'papelAlteradoEm' | 'equipeAlteradaEm' | 'filialAlteradaEm'>): UsuarioAdministrado {
    if (!params.nome.trim()) throw new Error('UsuarioAdministrado: nome obrigatório')
    if (!params.email.trim() || !params.email.includes('@')) throw new Error('UsuarioAdministrado: email inválido')
    return new UsuarioAdministrado({ ...params, id: uuidv4(), status: 'PENDENTE' })
  }

  static reconstitute(props: UsuarioAdministradoProps): UsuarioAdministrado {
    return new UsuarioAdministrado(props)
  }

  ativar(agora: string): void {
    if (!['PENDENTE', 'INATIVO'].includes(this.props.status)) {
      throw new Error(`UsuarioAdministrado: não é possível ativar usuário ${this.props.status}`)
    }
    this.props.status = 'ATIVO'
    this.props.ativadoEm = agora
  }

  desativar(agora: string): void {
    if (this.props.status !== 'ATIVO') {
      throw new Error(`UsuarioAdministrado: não é possível desativar usuário ${this.props.status}`)
    }
    this.props.status = 'INATIVO'
    this.props.desativadoEm = agora
  }

  bloquear(agora: string): void {
    if (!['ATIVO', 'INATIVO'].includes(this.props.status)) {
      throw new Error(`UsuarioAdministrado: não é possível bloquear usuário ${this.props.status}`)
    }
    this.props.status = 'BLOQUEADO'
    this.props.desativadoEm = agora
  }

  alterarPapel(novoPapel: PapelSistema, agora: string): void {
    if (this.props.status === 'BLOQUEADO') throw new Error('UsuarioAdministrado: usuário bloqueado')
    this.props.papel = novoPapel
    this.props.papelAlteradoEm = agora
  }

  alterarEquipe(equipeId: string | undefined, agora: string): void {
    if (this.props.status === 'BLOQUEADO') throw new Error('UsuarioAdministrado: usuário bloqueado')
    this.props.equipeId = equipeId
    this.props.equipeAlteradaEm = agora
  }

  alterarFilial(filialId: string | undefined, agora: string): void {
    if (this.props.status === 'BLOQUEADO') throw new Error('UsuarioAdministrado: usuário bloqueado')
    this.props.filialId = filialId
    this.props.filialAlteradaEm = agora
  }

  get id(): string { return this.props.id }
  get empresaId(): string { return this.props.empresaId }
  get email(): string { return this.props.email }
  get status(): StatusUsuarioAdmin { return this.props.status }
  get papel(): PapelSistema { return this.props.papel }

  toObject(): UsuarioAdministradoProps { return { ...this.props } }
}
