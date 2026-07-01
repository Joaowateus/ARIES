/**
 * QualificationRecord — avaliação de qualificação de uma oportunidade.
 * Critérios BANT simplificados: Budget, Authority, Need, Timeline.
 * RN-Q01: qualificação exige ao menos 2 critérios BANT atendidos.
 * RN-Q04: oportunidade deve estar qualificada antes de avançar para proposta.
 */

import { v4 as uuidv4 } from 'uuid'

export type QualificationCriteria = 'BUDGET' | 'AUTHORITY' | 'NEED' | 'TIMELINE'
export type QualificationStatus = 'RASCUNHO' | 'QUALIFICADA' | 'DESQUALIFICADA'

export interface QualificationRecordProps {
  id: string
  oportunidadeId: string
  status: QualificationStatus
  criteriosAtendidos: QualificationCriteria[]
  scoreQualificacao: number         // 0-100, calculado: (criterios / 4) * 100
  observacoes: string
  qualificadoPor: string
  motivoDesqualificacao?: string
  criadoEm: string
  atualizadoEm: string
}

export class QualificationRecord {
  private constructor(private props: QualificationRecordProps) {}

  static create(params: {
    oportunidadeId: string
    criteriosAtendidos: QualificationCriteria[]
    observacoes: string
    qualificadoPor: string
    agora: string
  }): QualificationRecord {
    if (!params.oportunidadeId) throw new Error('QualificationRecord: oportunidadeId obrigatório')
    if (!params.qualificadoPor) throw new Error('QualificationRecord: qualificadoPor obrigatório')

    const score = Math.round((params.criteriosAtendidos.length / 4) * 100)
    const status: QualificationStatus =
      params.criteriosAtendidos.length >= 2 ? 'QUALIFICADA' : 'DESQUALIFICADA'

    return new QualificationRecord({
      id: uuidv4(),
      oportunidadeId: params.oportunidadeId,
      status,
      criteriosAtendidos: [...params.criteriosAtendidos],
      scoreQualificacao: score,
      observacoes: params.observacoes,
      qualificadoPor: params.qualificadoPor,
      criadoEm: params.agora,
      atualizadoEm: params.agora,
    })
  }

  static reconstitute(props: QualificationRecordProps): QualificationRecord {
    return new QualificationRecord(props)
  }

  get id(): string { return this.props.id }
  get oportunidadeId(): string { return this.props.oportunidadeId }
  get status(): QualificationStatus { return this.props.status }
  get criteriosAtendidos(): QualificationCriteria[] { return [...this.props.criteriosAtendidos] }
  get scoreQualificacao(): number { return this.props.scoreQualificacao }
  get observacoes(): string { return this.props.observacoes }
  get qualificadoPor(): string { return this.props.qualificadoPor }
  get motivoDesqualificacao(): string | undefined { return this.props.motivoDesqualificacao }
  get criadoEm(): string { return this.props.criadoEm }

  estaQualificada(): boolean { return this.props.status === 'QUALIFICADA' }

  /** RN-Q01 */
  static minimoBANTAtendido(criterios: QualificationCriteria[]): boolean {
    return criterios.length >= 2
  }

  toObject(): QualificationRecordProps {
    return { ...this.props, criteriosAtendidos: [...this.props.criteriosAtendidos] }
  }
}
