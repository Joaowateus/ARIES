import { MotivoPerdaCatalogo, MotivoPerdaCatalogoProps } from '../../domain/entities/MotivoPerdaCatalogo'
import { IMotivoPerdaCatalogoRepository, IConfiguracaoAuditLog } from '../ports/Repositories'
import { IConfiguracaoEventPublisher } from '../ports/IEventPublisher'

export class GerenciarMotivoPerdaUseCase {
  constructor(
    private readonly repo: IMotivoPerdaCatalogoRepository,
    private readonly audit: IConfiguracaoAuditLog,
    private readonly events: IConfiguracaoEventPublisher,
  ) {}

  async criar(params: { empresaId: string; descricao: string; atorId: string; agora: string }): Promise<MotivoPerdaCatalogoProps> {
    const motivo = MotivoPerdaCatalogo.create({ empresaId: params.empresaId, descricao: params.descricao, agora: params.agora })
    await this.repo.save(motivo)
    await this.audit.registrar({ tipo: 'motivo_perda.criado', empresaId: params.empresaId, atorId: params.atorId, alvoId: motivo.id, detalhe: { descricao: params.descricao }, ocorridoEm: params.agora })
    await this.events.publish({ tipo: 'motivo_perda.criado', empresaId: params.empresaId, ocorridoEm: params.agora, payload: { motivoId: motivo.id, descricao: params.descricao } })
    return motivo.toObject()
  }

  async editar(params: { motivoId: string; descricao: string; atorId: string; agora: string }): Promise<void> {
    const motivo = await this.repo.findById(params.motivoId)
    if (!motivo) throw new Error(`GerenciarMotivoPerda: motivo ${params.motivoId} não encontrado`)
    motivo.editar(params.descricao, params.agora)
    await this.repo.save(motivo)
    await this.audit.registrar({ tipo: 'motivo_perda.editado', empresaId: motivo.empresaId, atorId: params.atorId, alvoId: motivo.id, ocorridoEm: params.agora })
  }

  async ativar(params: { motivoId: string; atorId: string; agora: string }): Promise<void> {
    const motivo = await this.repo.findById(params.motivoId)
    if (!motivo) throw new Error(`GerenciarMotivoPerda: motivo ${params.motivoId} não encontrado`)
    motivo.ativar(params.agora)
    await this.repo.save(motivo)
    await this.audit.registrar({ tipo: 'motivo_perda.ativado', empresaId: motivo.empresaId, atorId: params.atorId, alvoId: motivo.id, ocorridoEm: params.agora })
  }

  async desativar(params: { motivoId: string; atorId: string; agora: string }): Promise<void> {
    const motivo = await this.repo.findById(params.motivoId)
    if (!motivo) throw new Error(`GerenciarMotivoPerda: motivo ${params.motivoId} não encontrado`)
    motivo.desativar(params.agora)
    await this.repo.save(motivo)
    await this.audit.registrar({ tipo: 'motivo_perda.desativado', empresaId: motivo.empresaId, atorId: params.atorId, alvoId: motivo.id, ocorridoEm: params.agora })
  }

  async listarAtivos(empresaId: string): Promise<MotivoPerdaCatalogoProps[]> {
    const ativos = await this.repo.findAtivos(empresaId)
    return ativos.map(m => m.toObject())
  }
}
