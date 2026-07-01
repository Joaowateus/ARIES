import { v4 as uuidv4 } from 'uuid'

export type TipoProduto = 'PRODUTO' | 'SERVICO'
export type StatusProduto = 'RASCUNHO' | 'ATIVO' | 'INATIVO' | 'ARQUIVADO'

export interface ProdutoProps {
  id: string
  empresaId: string
  nome: string
  tipo: TipoProduto
  categoria: string
  precoBase: number
  custo: number
  margemMinima: number   // % mínima aceitável para venda com desconto
  status: StatusProduto
  criadoEm: string
  atualizadoEm: string
}

export class Produto {
  private constructor(private props: ProdutoProps) {}

  static create(params: Omit<ProdutoProps, 'id' | 'status' | 'criadoEm' | 'atualizadoEm'> & { agora: string }): Produto {
    if (!params.nome.trim()) throw new Error('Produto: nome obrigatório')
    if (params.precoBase <= 0) throw new Error('Produto: precoBase deve ser positivo')
    if (params.custo < 0) throw new Error('Produto: custo não pode ser negativo')
    if (params.custo >= params.precoBase) throw new Error('Produto: custo deve ser menor que o precoBase')
    if (params.margemMinima < 0 || params.margemMinima >= 100) throw new Error('Produto: margemMinima inválida')
    return new Produto({
      ...params,
      id: uuidv4(),
      status: 'RASCUNHO',
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: ProdutoProps): Produto {
    return new Produto(props)
  }

  editar(params: Partial<Pick<ProdutoProps, 'nome' | 'categoria' | 'precoBase' | 'custo' | 'margemMinima'>>, agora: string): void {
    if (this.props.status === 'ARQUIVADO') throw new Error('Produto: produto arquivado não pode ser editado')
    if (params.nome !== undefined && !params.nome.trim()) throw new Error('Produto: nome não pode ser vazio')
    const novoPreco = params.precoBase ?? this.props.precoBase
    const novoCusto = params.custo ?? this.props.custo
    if (novoCusto >= novoPreco) throw new Error('Produto: custo deve ser menor que o precoBase')
    Object.assign(this.props, params)
    this.props.atualizadoEm = agora
  }

  ativar(agora: string): void {
    if (!['RASCUNHO', 'INATIVO'].includes(this.props.status)) {
      throw new Error(`Produto: não é possível ativar produto ${this.props.status}`)
    }
    this.props.status = 'ATIVO'
    this.props.atualizadoEm = agora
  }

  desativar(agora: string): void {
    if (this.props.status !== 'ATIVO') throw new Error('Produto: só é possível desativar produto ATIVO')
    this.props.status = 'INATIVO'
    this.props.atualizadoEm = agora
  }

  arquivar(agora: string): void {
    if (this.props.status === 'ARQUIVADO') throw new Error('Produto: já está arquivado')
    this.props.status = 'ARQUIVADO'
    this.props.atualizadoEm = agora
  }

  get id(): string { return this.props.id }
  get empresaId(): string { return this.props.empresaId }
  get status(): StatusProduto { return this.props.status }

  margemAtual(): number {
    return Math.round((this.props.precoBase - this.props.custo) / this.props.precoBase * 100 * 100) / 100
  }

  toObject(): ProdutoProps { return { ...this.props } }
}
