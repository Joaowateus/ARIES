import { ConfiguracaoSistema, CategoriaCofiguracao } from '../../domain/entities/ConfiguracaoSistema'
import { RegraGovernanca, TipoRegra } from '../../domain/entities/RegraGovernanca'
import { AuditoriaEvento, CategoriaAuditoria } from '../../domain/entities/AuditoriaEvento'

export interface IConfiguracaoSistemaRepository {
  save(config: ConfiguracaoSistema): Promise<void>
  findById(id: string): Promise<ConfiguracaoSistema | null>
  findByChave(chave: string): Promise<ConfiguracaoSistema | null>
  findByCategoria(categoria: CategoriaCofiguracao): Promise<ConfiguracaoSistema[]>
  findAtivas(): Promise<ConfiguracaoSistema[]>
}

export interface IRegraGovernancaRepository {
  save(regra: RegraGovernanca): Promise<void>
  findById(id: string): Promise<RegraGovernanca | null>
  findByTipo(tipo: TipoRegra): Promise<RegraGovernanca[]>
  findAtivas(): Promise<RegraGovernanca[]>
}

export interface IAuditoriaEventoRepository {
  save(evento: AuditoriaEvento): Promise<void>
  findByEntidade(entidadeTipo: string, entidadeId: string): Promise<AuditoriaEvento[]>
  findByCategoria(categoria: CategoriaAuditoria): Promise<AuditoriaEvento[]>
  findByPeriodo(de: string, ate: string): Promise<AuditoriaEvento[]>
}
