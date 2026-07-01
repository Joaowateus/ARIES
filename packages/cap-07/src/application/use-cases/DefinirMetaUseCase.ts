import { MetaEquipe, DistribuicaoMeta } from '../../domain/entities/MetaEquipe'
import { IVendedorRepository, IMetaEquipeRepository } from '../ports/repositories'

export interface DefinirMetaInput {
  periodo: string
  metaTotalReceita: number
  distribuicao: DistribuicaoMeta[]
  agora: string
}

export interface DefinirMetaOutput {
  metaEquipe: ReturnType<MetaEquipe['toObject']>
  vendedoresAtualizados: number
}

export class DefinirMetaUseCase {
  constructor(
    private readonly vendedorRepo: IVendedorRepository,
    private readonly metaEquipeRepo: IMetaEquipeRepository,
  ) {}

  async execute(input: DefinirMetaInput): Promise<DefinirMetaOutput> {
    const metaEquipe = MetaEquipe.create(input)
    await this.metaEquipeRepo.save(metaEquipe)

    let vendedoresAtualizados = 0
    for (const dist of input.distribuicao) {
      const vendedor = await this.vendedorRepo.findById(dist.vendedorId)
      if (!vendedor) continue

      vendedor.definirMeta({
        periodo: input.periodo,
        metaReceita: dist.metaReceita,
        metaOportunidades: 0,
        metaPropostas: 0,
      }, input.agora)
      await this.vendedorRepo.save(vendedor)
      vendedoresAtualizados++
    }

    return { metaEquipe: metaEquipe.toObject(), vendedoresAtualizados }
  }
}
