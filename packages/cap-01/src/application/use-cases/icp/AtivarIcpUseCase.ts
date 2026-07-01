import { IcpDefinitionProps } from '../../../domain/entities/IcpDefinition'
import { IIcpRepository } from '../../ports/repositories'

export class AtivarIcpUseCase {
  constructor(private readonly icpRepo: IIcpRepository) {}

  async execute(icpId: string, agora: string): Promise<IcpDefinitionProps> {
    const icp = await this.icpRepo.findById(icpId)
    if (!icp) throw new Error(`ICP não encontrado: ${icpId}`)

    const ativo = await this.icpRepo.findActive()
    if (ativo && ativo.id !== icpId) {
      ativo.descontinuar(agora)
      await this.icpRepo.save(ativo)
    }

    if (icp.status === 'RASCUNHO') icp.submeterParaRevisao(agora)
    if (icp.status === 'EM_REVISAO') icp.aprovar(agora)
    icp.ativar(agora)

    await this.icpRepo.save(icp)
    return icp.toObject()
  }
}
