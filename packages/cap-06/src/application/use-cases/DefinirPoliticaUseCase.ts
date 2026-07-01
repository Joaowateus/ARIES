import { CommercialPolicy, CommercialPolicyProps } from '../../domain/entities/CommercialPolicy'
import { ICommercialPolicyRepository } from '../ports/repositories'

export interface DefinirPoliticaInput {
  nome: string
  segmentoId?: string
  descontoMaxN1: number
  descontoMaxN2: number
  descontoMaxN3: number
  margemMinimaPercent: number
  criadoPor: string
  agora: string
}

export interface DefinirPoliticaOutput {
  policy: CommercialPolicyProps
}

export class DefinirPoliticaUseCase {
  constructor(private readonly repo: ICommercialPolicyRepository) {}

  async execute(input: DefinirPoliticaInput): Promise<DefinirPoliticaOutput> {
    // Inativar a política anterior do mesmo segmento (se existir)
    const anterior = await this.repo.findAtiva(input.segmentoId)
    if (anterior) {
      anterior.inativar(input.agora)
      await this.repo.save(anterior)
    }

    const policy = CommercialPolicy.create(input)
    await this.repo.save(policy)

    return { policy: policy.toObject() }
  }
}
