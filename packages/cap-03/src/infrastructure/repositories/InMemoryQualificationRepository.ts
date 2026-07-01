import { QualificationRecord, QualificationRecordProps } from '../../domain/entities/QualificationRecord'
import { IQualificationRepository } from '../../application/ports/repositories'

export class InMemoryQualificationRepository implements IQualificationRepository {
  private store = new Map<string, QualificationRecordProps>()

  async save(record: QualificationRecord): Promise<void> {
    this.store.set(record.id, record.toObject())
  }

  async findById(id: string): Promise<QualificationRecord | null> {
    const props = this.store.get(id)
    return props ? QualificationRecord.reconstitute(props) : null
  }

  async findByOportunidade(oportunidadeId: string): Promise<QualificationRecord | null> {
    for (const props of this.store.values()) {
      if (props.oportunidadeId === oportunidadeId) return QualificationRecord.reconstitute(props)
    }
    return null
  }

  clear(): void { this.store.clear() }
}
