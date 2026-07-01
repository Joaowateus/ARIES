import { KpiSnapshot, KpiNome, KpiSnapshotProps } from '../../domain/entities/KpiSnapshot'
import { IKpiSnapshotRepository } from '../../application/ports/repositories'

export class InMemoryKpiSnapshotRepository implements IKpiSnapshotRepository {
  private store: KpiSnapshotProps[] = []

  async save(snapshot: KpiSnapshot): Promise<void> {
    const idx = this.store.findIndex(s => s.id === snapshot.id)
    if (idx >= 0) this.store[idx] = snapshot.toObject()
    else this.store.push(snapshot.toObject())
  }

  async findByPeriodo(periodo: string): Promise<KpiSnapshot[]> {
    return this.store.filter(s => s.periodo === periodo).map(s => KpiSnapshot.reconstitute(s))
  }

  async findByKpi(kpiNome: KpiNome, periodos?: string[]): Promise<KpiSnapshot[]> {
    return this.store
      .filter(s => s.kpiNome === kpiNome && (!periodos || periodos.includes(s.periodo)))
      .map(s => KpiSnapshot.reconstitute(s))
  }

  async findComAnomalia(periodo: string): Promise<KpiSnapshot[]> {
    return this.store
      .filter(s => s.periodo === periodo && s.anomalia !== undefined)
      .map(s => KpiSnapshot.reconstitute(s))
  }

  async findBaseline(kpiNome: KpiNome, ultimosPeriodos: number): Promise<number> {
    const snapshots = this.store
      .filter(s => s.kpiNome === kpiNome)
      .sort((a, b) => (b.registradoEm ?? '').localeCompare(a.registradoEm ?? ''))
      .slice(0, ultimosPeriodos)

    if (snapshots.length === 0) return 0
    return snapshots.reduce((sum, s) => sum + s.valor, 0) / snapshots.length
  }

  getAll(): KpiSnapshotProps[] { return [...this.store] }
  clear(): void { this.store = [] }
}
