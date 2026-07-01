import { v4 as uuidv4 } from 'uuid'

export type StatusMotivoPerdaCatalogo = 'ATIVO' | 'INATIVO'

export interface MotivoPerdaCatalogoProps {
  id: string
  empresaId: string
  descricao: string
  status: StatusMotivoPerdaCatalogo
  criadoEm: string
  atualizadoEm: string
}

export class MotivoPerdaCatalogo {
  private constructor(private props: MotivoPerdaCatalogoProps) {}

  static create(params: Pick<MotivoPerdaCatalogoProps, 'empresaId' | 'descricao'> & { agora: string }): MotivoPerdaCatalogo {
    if (!params.descricao.trim()) throw new Error('MotivoPerdaCatalogo: descricao obrigatória')
    return new MotivoPerdaCatalogo({
      id: uuidv4(),
      empresaId: params.empresaId,
      descricao: params.descricao.trim(),
      status: 'ATIVO',
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: MotivoPerdaCatalogoProps): MotivoPerdaCatalogo {
    return new MotivoPerdaCatalogo(props)
  }

  editar(descricao: string, agora: string): void {
    if (!descricao.trim()) throw new Error('MotivoPerdaCatalogo: descricao não pode ser vazia')
    this.props.descricao = descricao.trim()
    this.props.atualizadoEm = agora
  }

  ativar(agora: string): void {
    if (this.props.status === 'ATIVO') throw new Error('MotivoPerdaCatalogo: já está ativo')
    this.props.status = 'ATIVO'
    this.props.atualizadoEm = agora
  }

  desativar(agora: string): void {
    if (this.props.status === 'INATIVO') throw new Error('MotivoPerdaCatalogo: já está inativo')
    this.props.status = 'INATIVO'
    this.props.atualizadoEm = agora
  }

  get id(): string { return this.props.id }
  get empresaId(): string { return this.props.empresaId }
  get descricao(): string { return this.props.descricao }
  get status(): StatusMotivoPerdaCatalogo { return this.props.status }

  toObject(): MotivoPerdaCatalogoProps { return { ...this.props } }
}
