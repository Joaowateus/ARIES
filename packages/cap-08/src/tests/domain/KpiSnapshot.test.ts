import { KpiSnapshot, detectarAnomalia } from '../../domain/entities/KpiSnapshot'

describe('detectarAnomalia', () => {
  it('returns undefined when no baseline', () => {
    expect(detectarAnomalia(100, undefined)).toBeUndefined()
  })

  it('returns undefined when deviation < 10%', () => {
    expect(detectarAnomalia(95, 100)).toBeUndefined()
  })

  it('returns LEVE when deviation >= 10% and < 20%', () => {
    const a = detectarAnomalia(82, 100)
    expect(a?.severidade).toBe('LEVE')
    expect(a?.desvioPercent).toBeCloseTo(18)
  })

  it('returns MODERADA when deviation >= 20% and < 35%', () => {
    const a = detectarAnomalia(75, 100)
    expect(a?.severidade).toBe('MODERADA')
  })

  it('returns CRITICA when deviation >= 35%', () => {
    const a = detectarAnomalia(60, 100)
    expect(a?.severidade).toBe('CRITICA')
  })
})

describe('KpiSnapshot', () => {
  it('creates without anomaly when no baseline', () => {
    const s = KpiSnapshot.create({
      kpiNome: 'taxa_fechamento',
      dominio: 'VENDAS',
      periodo: '2024-01',
      valor: 30,
      registradoEm: '2024-01-31T00:00:00Z',
    })
    expect(s.possuiAnomalia()).toBe(false)
  })

  it('detects anomaly when value deviates from baseline', () => {
    const s = KpiSnapshot.create({
      kpiNome: 'taxa_fechamento',
      dominio: 'VENDAS',
      periodo: '2024-02',
      valor: 15,
      baseline: 30,
      registradoEm: '2024-02-29T00:00:00Z',
    })
    expect(s.possuiAnomalia()).toBe(true)
    expect(s.anomalia?.severidade).toBe('CRITICA')
  })

  it('reconstitutes correctly', () => {
    const s = KpiSnapshot.create({
      kpiNome: 'churn_rate',
      dominio: 'CS',
      periodo: '2024-01',
      valor: 5,
      baseline: 3,
      registradoEm: '2024-01-31T00:00:00Z',
    })
    const r = KpiSnapshot.reconstitute(s.toObject())
    expect(r.id).toBe(s.id)
    expect(r.possuiAnomalia()).toBe(s.possuiAnomalia())
  })
})
