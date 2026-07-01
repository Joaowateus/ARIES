import { QualificationRecord } from '../../src/domain/entities/QualificationRecord'

const AGORA = '2026-01-01T00:00:00.000Z'

describe('QualificationRecord', () => {
  it('cria QUALIFICADA com ≥ 2 critérios BANT', () => {
    const r = QualificationRecord.create({
      oportunidadeId: 'op-001',
      criteriosAtendidos: ['BUDGET', 'NEED'],
      observacoes: 'cliente tem verba e dor clara',
      qualificadoPor: 'rep-001',
      agora: AGORA,
    })
    expect(r.status).toBe('QUALIFICADA')
    expect(r.scoreQualificacao).toBe(50) // 2/4 * 100
    expect(r.estaQualificada()).toBe(true)
  })

  it('cria DESQUALIFICADA com < 2 critérios', () => {
    const r = QualificationRecord.create({
      oportunidadeId: 'op-002',
      criteriosAtendidos: ['BUDGET'],
      observacoes: 'só tem budget, sem dor definida',
      qualificadoPor: 'rep-001',
      agora: AGORA,
    })
    expect(r.status).toBe('DESQUALIFICADA')
    expect(r.scoreQualificacao).toBe(25)
    expect(r.estaQualificada()).toBe(false)
  })

  it('score 100% com todos os 4 critérios', () => {
    const r = QualificationRecord.create({
      oportunidadeId: 'op-003',
      criteriosAtendidos: ['BUDGET', 'AUTHORITY', 'NEED', 'TIMELINE'],
      observacoes: 'BANT completo',
      qualificadoPor: 'rep-001',
      agora: AGORA,
    })
    expect(r.scoreQualificacao).toBe(100)
    expect(r.status).toBe('QUALIFICADA')
  })

  it('rejeita oportunidadeId vazio', () => {
    expect(() =>
      QualificationRecord.create({
        oportunidadeId: '',
        criteriosAtendidos: ['BUDGET', 'NEED'],
        observacoes: '',
        qualificadoPor: 'rep-001',
        agora: AGORA,
      }),
    ).toThrow('oportunidadeId')
  })

  it('rejeita qualificadoPor vazio', () => {
    expect(() =>
      QualificationRecord.create({
        oportunidadeId: 'op-001',
        criteriosAtendidos: ['BUDGET', 'NEED'],
        observacoes: '',
        qualificadoPor: '',
        agora: AGORA,
      }),
    ).toThrow('qualificadoPor')
  })
})
