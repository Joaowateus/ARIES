import { v4 as uuidv4 } from 'uuid'

export type StatusSegmento = 'ATIVO' | 'INATIVO'

export interface SegmentoProps {
  id: string
  empresaId: string
  nome: string
  descricao?: string
  status: StatusSegmento
  criadoEm: string
  atualizadoEm: string
}

export class Segmento {
  private constructor(private props: SegmentoProps) {}

  static create(params: Pick<SegmentoProps, 'empresaId' | 'nome' | 'descricao'> & { agora: string }): Segmento {
    if (!params.nome.trim()) throw new Error('Segmento: nome obrigatório')
    return new Segmento({
      id: uuidv4(),
      empresaId: params.empresaId,
      nome: params.nome.trim(),
      descricao: params.descricao,
      status: 'ATIVO',
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: SegmentoProps): Segmento {
    return new Segmento(props)
  }

  editar(params: { nome?: string; descricao?: string }, agora: string): void {
    if (params.nome !== undefined) {
      if (!params.nome.trim()) throw new Error('Segmento: nome não pode ser vazio')
      this.props.nome = params.nome.trim()
    }
    if (params.descricao !== undefined) this.props.descricao = params.descricao
    this.props.atualizadoEm = agora
  }

  ativar(agora: string): void {
    if (this.props.status === 'ATIVO') throw new Error('Segmento: já está ativo')
    this.props.status = 'ATIVO'
    this.props.atualizadoEm = agora
  }

  desativar(agora: string): void {
    if (this.props.status === 'INATIVO') throw new Error('Segmento: já está inativo')
    this.props.status = 'INATIVO'
    this.props.atualizadoEm = agora
  }

  get id(): string { return this.props.id }
  get empresaId(): string { return this.props.empresaId }
  get nome(): string { return this.props.nome }
  get status(): StatusSegmento { return this.props.status }

  toObject(): SegmentoProps { return { ...this.props } }
}
