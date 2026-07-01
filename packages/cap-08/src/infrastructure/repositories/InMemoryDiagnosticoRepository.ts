import { Diagnostico, DiagnosticoProps, ClassificacaoDiagnostico } from '../../domain/entities/Diagnostico'
import { IDiagnosticoRepository } from '../../application/ports/repositories'

export class InMemoryDiagnosticoRepository implements IDiagnosticoRepository {
  private store: DiagnosticoProps[] = []

  async save(diagnostico: Diagnostico): Promise<void> {
    const idx = this.store.findIndex(d => d.id === diagnostico.id)
    if (idx >= 0) this.store[idx] = diagnostico.toObject()
    else this.store.push(diagnostico.toObject())
  }

  async findById(id: string): Promise<Diagnostico | null> {
    const found = this.store.find(d => d.id === id)
    return found ? Diagnostico.reconstitute(found) : null
  }

  async findAbertos(): Promise<Diagnostico[]> {
    return this.store
      .filter(d => d.status === 'ABERTO' || d.status === 'EM_TRATAMENTO')
      .map(d => Diagnostico.reconstitute(d))
  }

  async findByClassificacao(classificacao: ClassificacaoDiagnostico): Promise<Diagnostico[]> {
    return this.store.filter(d => d.classificacao === classificacao).map(d => Diagnostico.reconstitute(d))
  }

  async findByPeriodo(periodo: string): Promise<Diagnostico[]> {
    return this.store.filter(d => d.periodo === periodo).map(d => Diagnostico.reconstitute(d))
  }

  async findAll(): Promise<Diagnostico[]> {
    return this.store.map(d => Diagnostico.reconstitute(d))
  }

  clear(): void { this.store = [] }
}
