import { IcpScore } from '../../../domain/value-objects/IcpScore'
import { IIcpRepository } from '../../ports/repositories'
import { rn06_icpContratoOperacional } from '../../../domain/rules/BusinessRules'

export interface AvaliarProspectInput {
  atributos: Record<string, string | number | string[]>
}

export interface AvaliarProspectOutput {
  score: number
  tier: string
  icpVersao: string
  icpId: string
}

export class AvaliarProspectIcpUseCase {
  constructor(private readonly icpRepo: IIcpRepository) {}

  async execute(input: AvaliarProspectInput): Promise<AvaliarProspectOutput> {
    const icp = await this.icpRepo.findActive()
    if (!icp) throw new Error('Nenhum ICP ativo encontrado')

    rn06_icpContratoOperacional(icp)

    const score: IcpScore = icp.calcularScore(input.atributos)
    return {
      score: score.numeric,
      tier: score.tier,
      icpVersao: icp.versao,
      icpId: icp.id,
    }
  }
}
