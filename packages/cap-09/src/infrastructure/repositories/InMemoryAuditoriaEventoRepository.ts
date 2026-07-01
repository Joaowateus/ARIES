import { AuditoriaEvento, AuditoriaEventoProps, CategoriaAuditoria } from '../../domain/entities/AuditoriaEvento'
import { IAuditoriaEventoRepository } from '../../application/ports/repositories'

export class InMemoryAuditoriaEventoRepository implements IAuditoriaEventoRepository {
  private store: AuditoriaEventoProps[] = []

  async save(e: AuditoriaEvento): Promise<void> {
    this.store.push(e.toObject())
  }

  async findByEntidade(entidadeTipo: string, entidadeId: string): Promise<AuditoriaEvento[]> {
    return this.store
      .filter(s => s.entidadeTipo === entidadeTipo && s.entidadeId === entidadeId)
      .map(s => AuditoriaEvento.reconstitute(s))
  }

  async findByCategoria(categoria: CategoriaAuditoria): Promise<AuditoriaEvento[]> {
    return this.store.filter(s => s.categoria === categoria).map(s => AuditoriaEvento.reconstitute(s))
  }

  async findByPeriodo(de: string, ate: string): Promise<AuditoriaEvento[]> {
    return this.store
      .filter(s => s.ocorridoEm >= de && s.ocorridoEm <= ate)
      .map(s => AuditoriaEvento.reconstitute(s))
  }

  getAll(): AuditoriaEventoProps[] { return [...this.store] }
  clear(): void { this.store = [] }
}
