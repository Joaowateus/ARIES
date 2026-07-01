import { IcpDefinition, IcpDefinitionProps } from '../../../domain/entities/IcpDefinition'
import { IcpCriteria } from '../../../domain/value-objects/IcpCriteria'
import { IIcpRepository } from '../../ports/repositories'
import { rn02_icpVersaoSemantica } from '../../../domain/rules/BusinessRules'

export interface CriarIcpInput {
  versao: string
  validoAPartir: string
  criteriosFirmograficos: Parameters<typeof IcpCriteria.create>[0][]
  criteriosComportamentais: Parameters<typeof IcpCriteria.create>[0][]
  exclusoesAbsolutas: string[]
  fonteDeCalibracao: string
  ultimaCalibracao: string
  proximaRevisao: string
  criadoPor: string
  versaoAnteriorId?: string
  agora: string
}

export class CriarIcpUseCase {
  constructor(
    private readonly icpRepo: IIcpRepository,
  ) {}

  async execute(input: CriarIcpInput): Promise<IcpDefinitionProps> {
    rn02_icpVersaoSemantica(input.versao)

    const icp = IcpDefinition.create({
      versao: input.versao,
      validoAPartir: input.validoAPartir,
      criteriosFirmograficos: input.criteriosFirmograficos.map(IcpCriteria.create),
      criteriosComportamentais: input.criteriosComportamentais.map(IcpCriteria.create),
      exclusoesAbsolutas: input.exclusoesAbsolutas,
      fonteDeCalibracao: input.fonteDeCalibracao,
      ultimaCalibracao: input.ultimaCalibracao,
      proximaRevisao: input.proximaRevisao,
      criadoPor: input.criadoPor,
      versaoAnteriorId: input.versaoAnteriorId,
      agora: input.agora,
    })

    await this.icpRepo.save(icp)
    return icp.toObject()
  }
}
