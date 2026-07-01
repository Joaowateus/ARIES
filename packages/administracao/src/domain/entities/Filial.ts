import { v4 as uuidv4 } from 'uuid'

export type StatusFilial = 'ATIVA' | 'INATIVA'

export interface FilialProps {
  id: string
  empresaId: string
  nome: string
  cidade?: string
  estado?: string
  equipeIds: string[]
  status: StatusFilial
  criadaEm: string
  atualizadaEm: string
}

export class Filial {
  private constructor(private props: FilialProps) {}

  static create(params: Pick<FilialProps, 'empresaId' | 'nome' | 'cidade' | 'estado'> & { agora: string }): Filial {
    if (!params.nome.trim()) throw new Error('Filial: nome obrigatório')
    return new Filial({
      id: uuidv4(),
      empresaId: params.empresaId,
      nome: params.nome.trim(),
      cidade: params.cidade,
      estado: params.estado,
      equipeIds: [],
      status: 'ATIVA',
      criadaEm: params.agora,
      atualizadaEm: params.agora,
    })
  }

  static reconstitute(props: FilialProps): Filial {
    return new Filial(props)
  }

  editar(params: { nome?: string; cidade?: string; estado?: string }, agora: string): void {
    if (this.props.status === 'INATIVA') throw new Error('Filial: filial inativa não pode ser editada')
    if (params.nome !== undefined) {
      if (!params.nome.trim()) throw new Error('Filial: nome não pode ser vazio')
      this.props.nome = params.nome.trim()
    }
    if (params.cidade !== undefined) this.props.cidade = params.cidade
    if (params.estado !== undefined) this.props.estado = params.estado
    this.props.atualizadaEm = agora
  }

  desativar(agora: string): void {
    if (this.props.status === 'INATIVA') throw new Error('Filial: já está inativa')
    this.props.status = 'INATIVA'
    this.props.atualizadaEm = agora
  }

  vincularEquipe(equipeId: string, agora: string): void {
    if (this.props.status === 'INATIVA') throw new Error('Filial: filial inativa')
    if (!this.props.equipeIds.includes(equipeId)) {
      this.props.equipeIds = [...this.props.equipeIds, equipeId]
      this.props.atualizadaEm = agora
    }
  }

  desvincularEquipe(equipeId: string, agora: string): void {
    this.props.equipeIds = this.props.equipeIds.filter(id => id !== equipeId)
    this.props.atualizadaEm = agora
  }

  get id(): string { return this.props.id }
  get empresaId(): string { return this.props.empresaId }
  get status(): StatusFilial { return this.props.status }

  toObject(): FilialProps { return { ...this.props, equipeIds: [...this.props.equipeIds] } }
}
