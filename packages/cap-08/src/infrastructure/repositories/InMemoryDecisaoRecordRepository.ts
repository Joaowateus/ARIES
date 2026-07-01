import { DecisaoRecord, DecisaoRecordProps } from '../../domain/entities/DecisaoRecord'
import { ClassificacaoDiagnostico } from '../../domain/entities/Diagnostico'
import { IDecisaoRecordRepository } from '../../application/ports/repositories'

export class InMemoryDecisaoRecordRepository implements IDecisaoRecordRepository {
  private store: DecisaoRecordProps[] = []

  async save(record: DecisaoRecord): Promise<void> {
    const idx = this.store.findIndex(r => r.id === record.id)
    if (idx >= 0) this.store[idx] = record.toObject()
    else this.store.push(record.toObject())
  }

  async findById(id: string): Promise<DecisaoRecord | null> {
    const found = this.store.find(r => r.id === id)
    return found ? DecisaoRecord.reconstitute(found) : null
  }

  async findByClassificacao(classificacao: ClassificacaoDiagnostico): Promise<DecisaoRecord[]> {
    return this.store.filter(r => r.classificacao === classificacao).map(r => DecisaoRecord.reconstitute(r))
  }

  async findFechados(): Promise<DecisaoRecord[]> {
    return this.store.filter(r => !!r.fechadoEm).map(r => DecisaoRecord.reconstitute(r))
  }

  async findAll(): Promise<DecisaoRecord[]> {
    return this.store.map(r => DecisaoRecord.reconstitute(r))
  }

  clear(): void { this.store = [] }
}
