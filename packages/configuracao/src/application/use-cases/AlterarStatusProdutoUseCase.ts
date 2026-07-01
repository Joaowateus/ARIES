import { IProdutoRepository, IConfiguracaoAuditLog } from '../ports/Repositories'
import { IConfiguracaoEventPublisher } from '../ports/IEventPublisher'

export type AcaoStatusProduto = 'ATIVAR' | 'DESATIVAR' | 'ARQUIVAR'

export interface AlterarStatusProdutoInput {
  produtoId: string
  acao: AcaoStatusProduto
  atorId: string
  agora: string
}

export class AlterarStatusProdutoUseCase {
  constructor(
    private readonly repo: IProdutoRepository,
    private readonly audit: IConfiguracaoAuditLog,
    private readonly events: IConfiguracaoEventPublisher,
  ) {}

  async execute(input: AlterarStatusProdutoInput): Promise<void> {
    const produto = await this.repo.findById(input.produtoId)
    if (!produto) throw new Error(`AlterarStatusProduto: produto ${input.produtoId} não encontrado`)

    if (input.acao === 'ATIVAR') produto.ativar(input.agora)
    else if (input.acao === 'DESATIVAR') produto.desativar(input.agora)
    else produto.arquivar(input.agora)

    await this.repo.save(produto)

    const tipo = `produto.${input.acao.toLowerCase()}`
    await this.audit.registrar({
      tipo,
      empresaId: produto.empresaId,
      atorId: input.atorId,
      alvoId: produto.id,
      ocorridoEm: input.agora,
    })

    await this.events.publish({
      tipo,
      empresaId: produto.empresaId,
      ocorridoEm: input.agora,
      payload: { produtoId: produto.id, status: produto.status },
    })
  }
}
