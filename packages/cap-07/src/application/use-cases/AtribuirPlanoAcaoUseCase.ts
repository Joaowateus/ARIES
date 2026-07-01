import { AtribuicaoPlano } from '../../domain/entities/AtribuicaoPlano'
import { IVendedorRepository, IAtribuicaoPlanoRepository } from '../ports/repositories'

export interface AtribuicaoInput {
  planoAcaoId: string
  acaoId: string
  vendedorId: string
  descricaoAcao: string
  prazoIso: string
  criterioSucesso: string
  agora: string
}

export interface AtribuirPlanoAcaoOutput {
  atribuicoes: ReturnType<AtribuicaoPlano['toObject']>[]
}

export class AtribuirPlanoAcaoUseCase {
  constructor(
    private readonly vendedorRepo: IVendedorRepository,
    private readonly atribuicaoRepo: IAtribuicaoPlanoRepository,
  ) {}

  async execute(input: AtribuicaoInput): Promise<ReturnType<AtribuicaoPlano['toObject']>> {
    const vendedor = await this.vendedorRepo.findById(input.vendedorId)
    if (!vendedor) throw new Error(`Vendedor ${input.vendedorId} não encontrado`)
    if (vendedor.status !== 'ATIVO') throw new Error(`Vendedor ${input.vendedorId} não está ativo`)

    const atribuicao = AtribuicaoPlano.create(input)
    await this.atribuicaoRepo.save(atribuicao)
    return atribuicao.toObject()
  }
}
