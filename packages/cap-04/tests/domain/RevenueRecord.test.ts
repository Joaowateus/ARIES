import { RevenueRecord } from '../../src/domain/entities/RevenueRecord'

const base = {
  contratoId: 'ctr-1',
  clienteId: 'cli-1',
  tipo: 'RECORRENTE' as const,
  valor: 1000,
  periodo: '2026-01',
  descricao: 'MRR janeiro/2026',
  reconhecidoEm: '2026-01-01T00:00:00Z',
}

describe('RevenueRecord entity', () => {
  it('cria registro recorrente com período válido', () => {
    const r = RevenueRecord.create(base)
    expect(r.tipo).toBe('RECORRENTE')
    expect(r.periodo).toBe('2026-01')
    expect(r.valor).toBe(1000)
  })

  it('rejeita valor <= 0', () => {
    expect(() => RevenueRecord.create({ ...base, valor: 0 })).toThrow('valor deve ser > 0')
  })

  it('rejeita contratoId vazio', () => {
    expect(() => RevenueRecord.create({ ...base, contratoId: '' })).toThrow('contratoId obrigatório')
  })

  it('rejeita período RECORRENTE com formato inválido', () => {
    expect(() => RevenueRecord.create({ ...base, periodo: '2026/01' })).toThrow('YYYY-MM')
  })

  it('aceita receita UNICA sem validação de período', () => {
    const r = RevenueRecord.create({ ...base, tipo: 'UNICA', periodo: '2026-01' })
    expect(r.tipo).toBe('UNICA')
  })

  it('reconstitute preserva props', () => {
    const r = RevenueRecord.create(base)
    const r2 = RevenueRecord.reconstitute(r.toObject())
    expect(r2.id).toBe(r.id)
    expect(r2.valor).toBe(1000)
  })
})
