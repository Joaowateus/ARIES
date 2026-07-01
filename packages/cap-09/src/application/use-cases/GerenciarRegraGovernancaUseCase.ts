import { RegraGovernanca, TipoRegra } from '../../domain/entities/RegraGovernanca'
import { AuditoriaEvento } from '../../domain/entities/AuditoriaEvento'
import { IRegraGovernancaRepository, IAuditoriaEventoRepository } from '../ports/repositories'

export interface CriarRegraInput {
  tipo: TipoRegra
  nome: string
  descricao: string
  criterioAtivacao: string
  acaoResultante: string
  parametros: Record<string, unknown>
  criadoPor: string
  agora: string
}

export class GerenciarRegraGovernancaUseCase {
  constructor(
    private readonly regraRepo: IRegraGovernancaRepository,
    private readonly auditoriaRepo: IAuditoriaEventoRepository,
  ) {}

  async criar(input: CriarRegraInput): Promise<ReturnType<RegraGovernanca['toObject']>> {
    const regra = RegraGovernanca.create({
      tipo: input.tipo,
      nome: input.nome,
      descricao: input.descricao,
      criterioAtivacao: input.criterioAtivacao,
      acaoResultante: input.acaoResultante,
      parametros: input.parametros,
      ativo: true,
      agora: input.agora,
    })
    await this.regraRepo.save(regra)

    await this.auditoriaRepo.save(AuditoriaEvento.create({
      categoria: 'GOVERNANCA',
      acao: 'REGRA_CRIADA',
      entidadeTipo: 'RegraGovernanca',
      entidadeId: regra.id,
      realizadoPor: input.criadoPor,
      payload: { tipo: input.tipo, nome: input.nome },
      ocorridoEm: input.agora,
    }))

    return regra.toObject()
  }

  async atualizarParametros(regraId: string, parametros: Record<string, unknown>, alteradoPor: string, agora: string): Promise<ReturnType<RegraGovernanca['toObject']>> {
    const regra = await this.regraRepo.findById(regraId)
    if (!regra) throw new Error(`Regra ${regraId} não encontrada`)

    regra.atualizarParametros(parametros, agora)
    await this.regraRepo.save(regra)

    await this.auditoriaRepo.save(AuditoriaEvento.create({
      categoria: 'GOVERNANCA',
      acao: 'REGRA_ATUALIZADA',
      entidadeTipo: 'RegraGovernanca',
      entidadeId: regra.id,
      realizadoPor: alteradoPor,
      payload: { parametros },
      ocorridoEm: agora,
    }))

    return regra.toObject()
  }

  async listarAtivas(): Promise<ReturnType<RegraGovernanca['toObject']>[]> {
    const regras = await this.regraRepo.findAtivas()
    return regras.map(r => r.toObject())
  }
}
