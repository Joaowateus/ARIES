import { ConfiguracaoSistema, CategoriaCofiguracao } from '../../domain/entities/ConfiguracaoSistema'
import { AuditoriaEvento } from '../../domain/entities/AuditoriaEvento'
import { IConfiguracaoSistemaRepository, IAuditoriaEventoRepository } from '../ports/repositories'

export interface CriarConfiguracaoInput {
  categoria: CategoriaCofiguracao
  chave: string
  valor: unknown
  descricao: string
  critica?: boolean
  criadoPor: string
  agora: string
}

export interface AtualizarConfiguracaoInput {
  chave: string
  novoValor: unknown
  alteradoPor: string
  motivo: string
  agora: string
}

export class GerenciarConfiguracaoUseCase {
  constructor(
    private readonly configRepo: IConfiguracaoSistemaRepository,
    private readonly auditoriaRepo: IAuditoriaEventoRepository,
  ) {}

  async criar(input: CriarConfiguracaoInput): Promise<ReturnType<ConfiguracaoSistema['toObject']>> {
    const existente = await this.configRepo.findByChave(input.chave)
    if (existente) return existente.toObject()

    const config = ConfiguracaoSistema.create({
      categoria: input.categoria,
      chave: input.chave,
      valor: input.valor,
      descricao: input.descricao,
      critica: input.critica ?? false,
      ativo: true,
      agora: input.agora,
    })
    await this.configRepo.save(config)

    await this.auditoriaRepo.save(AuditoriaEvento.create({
      categoria: 'CONFIGURACAO',
      acao: 'CRIADA',
      entidadeTipo: 'ConfiguracaoSistema',
      entidadeId: config.id,
      realizadoPor: input.criadoPor,
      payload: { chave: input.chave, valor: input.valor },
      ocorridoEm: input.agora,
    }))

    return config.toObject()
  }

  async atualizar(input: AtualizarConfiguracaoInput): Promise<ReturnType<ConfiguracaoSistema['toObject']>> {
    const config = await this.configRepo.findByChave(input.chave)
    if (!config) throw new Error(`Configuração '${input.chave}' não encontrada`)

    config.atualizar(input.novoValor, input.alteradoPor, input.motivo, input.agora)
    await this.configRepo.save(config)

    await this.auditoriaRepo.save(AuditoriaEvento.create({
      categoria: 'CONFIGURACAO',
      acao: 'ATUALIZADA',
      entidadeTipo: 'ConfiguracaoSistema',
      entidadeId: config.id,
      realizadoPor: input.alteradoPor,
      payload: { chave: input.chave, motivo: input.motivo, novoValor: input.novoValor },
      ocorridoEm: input.agora,
    }))

    return config.toObject()
  }

  async buscar(chave: string): Promise<ReturnType<ConfiguracaoSistema['toObject']> | null> {
    const config = await this.configRepo.findByChave(chave)
    return config ? config.toObject() : null
  }

  async listarPorCategoria(categoria: CategoriaCofiguracao): Promise<ReturnType<ConfiguracaoSistema['toObject']>[]> {
    const configs = await this.configRepo.findByCategoria(categoria)
    return configs.map(c => c.toObject())
  }
}
