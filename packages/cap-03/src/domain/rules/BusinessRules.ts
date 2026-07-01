import { QualificationRecord, QualificationCriteria } from '../entities/QualificationRecord'

/** RN-Q01: ao menos 2 critérios BANT atendidos para qualificar. */
export function rn_q01_minimoBANT(criterios: QualificationCriteria[]): void {
  if (criterios.length < 2) {
    throw new Error(`RN-Q01: ao menos 2 critérios BANT obrigatórios para qualificar (recebidos: ${criterios.length})`)
  }
}

/** RN-Q02: valor > 0 para fechar como ganha — verificado em DealClose.criarGanha. */
export function rn_q02_valorPositivo(valor: number): void {
  if (valor <= 0) throw new Error('RN-Q02: valorTotal deve ser > 0 para fechamento ganho')
}

/** RN-Q03: motivo obrigatório ao perder — verificado em DealClose.criarPerdida. */
export function rn_q03_motivoPerda(motivo: string): void {
  if (!motivo?.trim()) throw new Error('RN-Q03: motivoPerda obrigatório no fechamento perdido')
}

/** RN-Q04: oportunidade deve estar qualificada antes de fechar. */
export function rn_q04_qualificacaoObrigatoria(record: QualificationRecord): void {
  if (!record.estaQualificada()) {
    throw new Error(
      `RN-Q04: oportunidade deve estar qualificada para fechar (status atual: ${record.status})`,
    )
  }
}

/** RN-Q05: responsável de CS obrigatório ao fechar ganho — verificado em DealClose.criarGanha. */
export function rn_q05_csObrigatorio(responsavelCsId: string): void {
  if (!responsavelCsId?.trim()) {
    throw new Error('RN-Q05: responsavelCsId obrigatório no fechamento ganho')
  }
}
