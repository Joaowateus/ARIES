import { Produto, TipoProduto, ProdutoProps } from '../../domain/entities/Produto'
import { IProdutoRepository, IConfiguracaoAuditLog } from '../ports/Repositories'
import { IConfiguracaoEventPublisher } from '../ports/IEventPublisher'

export interface CriarProdutoInput {
  empresaId: string
  nome: string
  tipo: TipoProduto
  categoria: string
  precoBase: number
  custo: number
  margemMinima: number
  atorId: string
  agora: string
}

export class CriarProdutoUseCase {
  constructor(
    private readonly repo: IProdutoRepository,
    private readonly audit: IConfiguracaoAuditLog,
    private readonly events: IConfiguracaoEventPublisher,
  ) {}

  async execute(input: CriarProdutoInput): Promise<ProdutoProps> {
    const produto = Produto.create({
      empresaId: input.empresaId,
      nome: input.nome,
      tipo: input.tipo,
      categoria: input.categoria,
      precoBase: input.precoBase,
      custo: input.custo,
      margemMinima: input.margemMinima,
      agora: input.agora,
    })

    await this.repo.save(produto)

    await this.audit.registrar({
      tipo: 'produto.criado',
      empresaId: input.empresaId,
      atorId: input.atorId,
      alvoId: produto.id,
      detalhe: { nome: input.nome, tipo: input.tipo, precoBase: input.precoBase },
      ocorridoEm: input.agora,
    })

    await this.events.publish({
      tipo: 'produto.criado',
      empresaId: input.empresaId,
      ocorridoEm: input.agora,
      payload: { produtoId: produto.id, nome: input.nome, tipo: input.tipo },
    })

    return produto.toObject()
  }
}
