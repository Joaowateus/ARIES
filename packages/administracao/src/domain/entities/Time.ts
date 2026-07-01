import { v4 as uuidv4 } from 'uuid'

export type StatusTime = 'ATIVO' | 'INATIVO'

export interface TimeProps {
  id: string
  empresaId: string
  nome: string
  descricao?: string
  liderId?: string
  membroIds: string[]
  status: StatusTime
  criadoEm: string
  atualizadoEm: string
}

export class Time {
  private constructor(private props: TimeProps) {}

  static create(params: Pick<TimeProps, 'empresaId' | 'nome' | 'descricao' | 'liderId'> & { agora: string }): Time {
    if (!params.nome.trim()) throw new Error('Time: nome obrigatório')
    return new Time({
      id: uuidv4(),
      empresaId: params.empresaId,
      nome: params.nome.trim(),
      descricao: params.descricao,
      liderId: params.liderId,
      membroIds: [],
      status: 'ATIVO',
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: TimeProps): Time {
    return new Time(props)
  }

  editar(params: { nome?: string; descricao?: string; liderId?: string }, agora: string): void {
    if (this.props.status === 'INATIVO') throw new Error('Time: time inativo não pode ser editado')
    if (params.nome !== undefined) {
      if (!params.nome.trim()) throw new Error('Time: nome não pode ser vazio')
      this.props.nome = params.nome.trim()
    }
    if (params.descricao !== undefined) this.props.descricao = params.descricao
    if (params.liderId !== undefined) this.props.liderId = params.liderId
    this.props.atualizadoEm = agora
  }

  desativar(agora: string): void {
    if (this.props.status === 'INATIVO') throw new Error('Time: já está inativo')
    this.props.status = 'INATIVO'
    this.props.atualizadoEm = agora
  }

  adicionarMembro(usuarioId: string, agora: string): void {
    if (this.props.status === 'INATIVO') throw new Error('Time: time inativo')
    if (!this.props.membroIds.includes(usuarioId)) {
      this.props.membroIds = [...this.props.membroIds, usuarioId]
      this.props.atualizadoEm = agora
    }
  }

  removerMembro(usuarioId: string, agora: string): void {
    if (this.props.status === 'INATIVO') throw new Error('Time: time inativo')
    this.props.membroIds = this.props.membroIds.filter(id => id !== usuarioId)
    this.props.atualizadoEm = agora
  }

  get id(): string { return this.props.id }
  get empresaId(): string { return this.props.empresaId }
  get status(): StatusTime { return this.props.status }

  toObject(): TimeProps { return { ...this.props, membroIds: [...this.props.membroIds] } }
}
