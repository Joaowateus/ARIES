import { WinLossAnalysis, WinLossAnalysisProps } from '../../domain/entities/WinLossAnalysis'
import { IWinLossRepository } from '../../application/ports/repositories'

export class InMemoryWinLossRepository implements IWinLossRepository {
  private store = new Map<string, WinLossAnalysisProps>()

  async save(analysis: WinLossAnalysis): Promise<void> {
    this.store.set(analysis.id, analysis.toObject())
  }

  async findById(id: string): Promise<WinLossAnalysis | null> {
    const props = this.store.get(id)
    return props ? WinLossAnalysis.reconstitute(props) : null
  }

  async findByOportunidade(oportunidadeId: string): Promise<WinLossAnalysis | null> {
    for (const props of this.store.values()) {
      if (props.oportunidadeId === oportunidadeId) return WinLossAnalysis.reconstitute(props)
    }
    return null
  }

  async findPendentes(): Promise<WinLossAnalysis[]> {
    return [...this.store.values()]
      .filter((p) => p.status === 'PENDENTE_ANALISE' || p.status === 'EM_ANALISE')
      .map(WinLossAnalysis.reconstitute)
  }

  async findAll(): Promise<WinLossAnalysis[]> {
    return [...this.store.values()].map(WinLossAnalysis.reconstitute)
  }

  clear(): void { this.store.clear() }
}
