import { Produto, ProdutoProps, StatusProduto } from '../../domain/entities/Produto'
import { Meta, MetaProps, TipoMeta } from '../../domain/entities/Meta'
import { MotivoPerdaCatalogo, MotivoPerdaCatalogoProps } from '../../domain/entities/MotivoPerdaCatalogo'
import { Segmento, SegmentoProps } from '../../domain/entities/Segmento'
import {
  IProdutoRepository,
  IMetaRepository,
  IMotivoPerdaCatalogoRepository,
  ISegmentoRepository,
  IConfiguracaoAuditLog,
} from '../../application/ports/Repositories'

export class InMemoryProdutoRepository implements IProdutoRepository {
  private store = new Map<string, ProdutoProps>()

  async save(produto: Produto): Promise<void> { this.store.set(produto.id, produto.toObject()) }
  async findById(id: string): Promise<Produto | undefined> {
    const p = this.store.get(id); return p ? Produto.reconstitute(p) : undefined
  }
  async findByEmpresa(empresaId: string, filtros?: { status?: StatusProduto }): Promise<Produto[]> {
    return Array.from(this.store.values())
      .filter(p => p.empresaId === empresaId && (!filtros?.status || p.status === filtros.status))
      .map(p => Produto.reconstitute(p))
  }
}

export class InMemoryMetaRepository implements IMetaRepository {
  private store = new Map<string, MetaProps>()

  async save(meta: Meta): Promise<void> { this.store.set(meta.id, meta.toObject()) }
  async findById(id: string): Promise<Meta | undefined> {
    const p = this.store.get(id); return p ? Meta.reconstitute(p) : undefined
  }
  async findByAlvo(empresaId: string, tipo: TipoMeta, alvoId: string): Promise<Meta[]> {
    return Array.from(this.store.values())
      .filter(p => p.empresaId === empresaId && p.tipo === tipo && p.alvoId === alvoId)
      .map(p => Meta.reconstitute(p))
  }
  async findByEmpresa(empresaId: string): Promise<Meta[]> {
    return Array.from(this.store.values())
      .filter(p => p.empresaId === empresaId)
      .map(p => Meta.reconstitute(p))
  }
}

export class InMemoryMotivoPerdaCatalogoRepository implements IMotivoPerdaCatalogoRepository {
  private store = new Map<string, MotivoPerdaCatalogoProps>()

  async save(m: MotivoPerdaCatalogo): Promise<void> { this.store.set(m.id, m.toObject()) }
  async findById(id: string): Promise<MotivoPerdaCatalogo | undefined> {
    const p = this.store.get(id); return p ? MotivoPerdaCatalogo.reconstitute(p) : undefined
  }
  async findByEmpresa(empresaId: string): Promise<MotivoPerdaCatalogo[]> {
    return Array.from(this.store.values()).filter(p => p.empresaId === empresaId).map(p => MotivoPerdaCatalogo.reconstitute(p))
  }
  async findAtivos(empresaId: string): Promise<MotivoPerdaCatalogo[]> {
    return Array.from(this.store.values()).filter(p => p.empresaId === empresaId && p.status === 'ATIVO').map(p => MotivoPerdaCatalogo.reconstitute(p))
  }
}

export class InMemorySegmentoRepository implements ISegmentoRepository {
  private store = new Map<string, SegmentoProps>()

  async save(s: Segmento): Promise<void> { this.store.set(s.id, s.toObject()) }
  async findById(id: string): Promise<Segmento | undefined> {
    const p = this.store.get(id); return p ? Segmento.reconstitute(p) : undefined
  }
  async findByEmpresa(empresaId: string): Promise<Segmento[]> {
    return Array.from(this.store.values()).filter(p => p.empresaId === empresaId).map(p => Segmento.reconstitute(p))
  }
  async findAtivos(empresaId: string): Promise<Segmento[]> {
    return Array.from(this.store.values()).filter(p => p.empresaId === empresaId && p.status === 'ATIVO').map(p => Segmento.reconstitute(p))
  }
}

type AuditEntry = { tipo: string; empresaId: string; atorId: string; alvoId: string; detalhe?: Record<string, unknown>; ocorridoEm: string }

export class InMemoryConfiguracaoAuditLog implements IConfiguracaoAuditLog {
  entries: AuditEntry[] = []

  async registrar(evento: AuditEntry): Promise<void> { this.entries.push(evento) }
  async findByEmpresa(empresaId: string): Promise<AuditEntry[]> {
    return this.entries.filter(e => e.empresaId === empresaId)
  }
}
