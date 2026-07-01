import { QualificationRecord } from '../../domain/entities/QualificationRecord'
import { DealClose } from '../../domain/entities/DealClose'

export interface IQualificationRepository {
  save(record: QualificationRecord): Promise<void>
  findById(id: string): Promise<QualificationRecord | null>
  findByOportunidade(oportunidadeId: string): Promise<QualificationRecord | null>
}

export interface IDealCloseRepository {
  save(close: DealClose): Promise<void>
  findById(id: string): Promise<DealClose | null>
  findByOportunidade(oportunidadeId: string): Promise<DealClose | null>
  findAll(): Promise<DealClose[]>
}
