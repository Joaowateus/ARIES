import { QualificationRecord, QualificationRecordProps, QualificationCriteria } from '../../domain/entities/QualificationRecord'
import { IQualificationRepository } from '../ports/repositories'
import { rn_q01_minimoBANT } from '../../domain/rules/BusinessRules'

export interface QualificarOportunidadeInput {
  oportunidadeId: string
  criteriosAtendidos: QualificationCriteria[]
  observacoes: string
  qualificadoPor: string
  agora: string
}

export class QualificarOportunidadeUseCase {
  constructor(private readonly repo: IQualificationRepository) {}

  async execute(input: QualificarOportunidadeInput): Promise<QualificationRecordProps> {
    // Validar RN-Q01 antes de criar — dá mensagem específica mesmo quando score < 2
    rn_q01_minimoBANT(input.criteriosAtendidos)

    // Idempotência: se já existe qualificação para a oportunidade, retorna existente
    const existente = await this.repo.findByOportunidade(input.oportunidadeId)
    if (existente) return existente.toObject()

    const record = QualificationRecord.create(input)
    await this.repo.save(record)
    return record.toObject()
  }
}
