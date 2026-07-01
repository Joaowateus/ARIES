import { Produto, StatusProduto } from '../../domain/entities/Produto'
import { Meta, TipoMeta } from '../../domain/entities/Meta'
import { MotivoPerdaCatalogo } from '../../domain/entities/MotivoPerdaCatalogo'
import { Segmento } from '../../domain/entities/Segmento'

export interface IProdutoRepository {
  save(produto: Produto): Promise<void>
  findById(id: string): Promise<Produto | undefined>
  findByEmpresa(empresaId: string, filtros?: { status?: StatusProduto }): Promise<Produto[]>
}

export interface IMetaRepository {
  save(meta: Meta): Promise<void>
  findById(id: string): Promise<Meta | undefined>
  findByAlvo(empresaId: string, tipo: TipoMeta, alvoId: string): Promise<Meta[]>
  findByEmpresa(empresaId: string): Promise<Meta[]>
}

export interface IMotivoPerdaCatalogoRepository {
  save(motivo: MotivoPerdaCatalogo): Promise<void>
  findById(id: string): Promise<MotivoPerdaCatalogo | undefined>
  findByEmpresa(empresaId: string): Promise<MotivoPerdaCatalogo[]>
  findAtivos(empresaId: string): Promise<MotivoPerdaCatalogo[]>
}

export interface ISegmentoRepository {
  save(segmento: Segmento): Promise<void>
  findById(id: string): Promise<Segmento | undefined>
  findByEmpresa(empresaId: string): Promise<Segmento[]>
  findAtivos(empresaId: string): Promise<Segmento[]>
}

export interface IConfiguracaoAuditLog {
  registrar(evento: { tipo: string; empresaId: string; atorId: string; alvoId: string; detalhe?: Record<string, unknown>; ocorridoEm: string }): Promise<void>
  findByEmpresa(empresaId: string): Promise<Array<{ tipo: string; empresaId: string; atorId: string; alvoId: string; detalhe?: Record<string, unknown>; ocorridoEm: string }>>
}
