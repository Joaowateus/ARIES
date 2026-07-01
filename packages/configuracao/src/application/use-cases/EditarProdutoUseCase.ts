import { IProdutoRepository, IConfiguracaoAuditLog } from '../ports/Repositories'

export interface EditarProdutoInput {
  produtoId: string
  nome?: string
  categoria?: string
  precoBase?: number
  custo?: number
  margemMinima?: number
  atorId: string
  agora: string
}

export class EditarProdutoUseCase {
  constructor(
    private readonly repo: IProdutoRepository,
    private readonly audit: IConfiguracaoAuditLog,
  ) {}

  async execute(input: EditarProdutoInput): Promise<void> {
    const produto = await this.repo.findById(input.produtoId)
    if (!produto) throw new Error(`EditarProduto: produto ${input.produtoId} não encontrado`)

    produto.editar({
      nome: input.nome,
      categoria: input.categoria,
      precoBase: input.precoBase,
      custo: input.custo,
      margemMinima: input.margemMinima,
    }, input.agora)

    await this.repo.save(produto)

    await this.audit.registrar({
      tipo: 'produto.editado',
      empresaId: produto.empresaId,
      atorId: input.atorId,
      alvoId: produto.id,
      ocorridoEm: input.agora,
    })
  }
}
