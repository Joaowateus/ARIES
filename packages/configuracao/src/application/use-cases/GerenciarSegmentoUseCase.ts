import { Segmento, SegmentoProps } from '../../domain/entities/Segmento'
import { ISegmentoRepository, IConfiguracaoAuditLog } from '../ports/Repositories'
import { IConfiguracaoEventPublisher } from '../ports/IEventPublisher'

export class GerenciarSegmentoUseCase {
  constructor(
    private readonly repo: ISegmentoRepository,
    private readonly audit: IConfiguracaoAuditLog,
    private readonly events: IConfiguracaoEventPublisher,
  ) {}

  async criar(params: { empresaId: string; nome: string; descricao?: string; atorId: string; agora: string }): Promise<SegmentoProps> {
    const segmento = Segmento.create({ empresaId: params.empresaId, nome: params.nome, descricao: params.descricao, agora: params.agora })
    await this.repo.save(segmento)
    await this.audit.registrar({ tipo: 'segmento.criado', empresaId: params.empresaId, atorId: params.atorId, alvoId: segmento.id, detalhe: { nome: params.nome }, ocorridoEm: params.agora })
    await this.events.publish({ tipo: 'segmento.criado', empresaId: params.empresaId, ocorridoEm: params.agora, payload: { segmentoId: segmento.id, nome: params.nome } })
    return segmento.toObject()
  }

  async editar(params: { segmentoId: string; nome?: string; descricao?: string; atorId: string; agora: string }): Promise<void> {
    const segmento = await this.repo.findById(params.segmentoId)
    if (!segmento) throw new Error(`GerenciarSegmento: segmento ${params.segmentoId} não encontrado`)
    segmento.editar({ nome: params.nome, descricao: params.descricao }, params.agora)
    await this.repo.save(segmento)
    await this.audit.registrar({ tipo: 'segmento.editado', empresaId: segmento.empresaId, atorId: params.atorId, alvoId: segmento.id, ocorridoEm: params.agora })
  }

  async ativar(params: { segmentoId: string; atorId: string; agora: string }): Promise<void> {
    const segmento = await this.repo.findById(params.segmentoId)
    if (!segmento) throw new Error(`GerenciarSegmento: segmento ${params.segmentoId} não encontrado`)
    segmento.ativar(params.agora)
    await this.repo.save(segmento)
    await this.audit.registrar({ tipo: 'segmento.ativado', empresaId: segmento.empresaId, atorId: params.atorId, alvoId: segmento.id, ocorridoEm: params.agora })
  }

  async desativar(params: { segmentoId: string; atorId: string; agora: string }): Promise<void> {
    const segmento = await this.repo.findById(params.segmentoId)
    if (!segmento) throw new Error(`GerenciarSegmento: segmento ${params.segmentoId} não encontrado`)
    segmento.desativar(params.agora)
    await this.repo.save(segmento)
    await this.audit.registrar({ tipo: 'segmento.desativado', empresaId: segmento.empresaId, atorId: params.atorId, alvoId: segmento.id, ocorridoEm: params.agora })
  }

  async listar(empresaId: string, apenasAtivos = false): Promise<SegmentoProps[]> {
    const todos = apenasAtivos
      ? await this.repo.findAtivos(empresaId)
      : await this.repo.findByEmpresa(empresaId)
    return todos.map(s => s.toObject())
  }
}
