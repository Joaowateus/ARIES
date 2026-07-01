import { Contract } from '../../src/domain/entities/Contract'

const base = {
  oportunidadeId: 'op-1',
  dealCloseId: 'dc-1',
  clienteId: 'cli-1',
  valorTotal: 12000,
  mrr: 1000,
  dataInicio: '2026-01-01',
  dataFim: '2026-12-31',
  formaPagamento: 'MENSAL' as const,
  condicoesJson: {},
  responsavelCsId: 'cs-1',
  criadoPor: 'user-1',
  agora: '2026-01-01T00:00:00Z',
}

describe('Contract entity', () => {
  it('cria contrato ATIVO com arr = mrr * 12', () => {
    const c = Contract.create(base)
    expect(c.status).toBe('ATIVO')
    expect(c.arr).toBe(12000)
    expect(c.estaAtivo()).toBe(true)
  })

  it('RN-R01: rejeita dataFim <= dataInicio', () => {
    expect(() =>
      Contract.create({ ...base, dataFim: '2025-12-31' }),
    ).toThrow('RN-R01')
  })

  it('RN-R02: rejeita valorTotal <= 0', () => {
    expect(() =>
      Contract.create({ ...base, valorTotal: 0 }),
    ).toThrow('RN-R02')
  })

  it('RN-R03: rejeita mrr <= 0 para não-UNICO', () => {
    expect(() =>
      Contract.create({ ...base, mrr: 0 }),
    ).toThrow('RN-R03')
  })

  it('permite mrr = 0 para UNICO', () => {
    const c = Contract.create({ ...base, formaPagamento: 'UNICO', mrr: 0 })
    expect(c.status).toBe('ATIVO')
    expect(c.arr).toBe(0)
  })

  it('encerra contrato ATIVO', () => {
    const c = Contract.create(base)
    c.encerrar('2026-12-31T00:00:00Z')
    expect(c.status).toBe('ENCERRADO')
    expect(c.estaAtivo()).toBe(false)
  })

  it('RN-R06: não pode encerrar contrato já encerrado', () => {
    const c = Contract.create(base)
    c.encerrar('2026-12-31T00:00:00Z')
    expect(() => c.encerrar('2027-01-01T00:00:00Z')).toThrow('RN-R06')
  })

  it('cancela contrato ATIVO com motivo', () => {
    const c = Contract.create(base)
    c.cancelar('Cliente desistiu', '2026-06-01T00:00:00Z')
    expect(c.status).toBe('CANCELADO')
    expect(c.motivoCancelamento).toBe('Cliente desistiu')
  })

  it('RN-R04: cancela sem motivo lança erro', () => {
    const c = Contract.create(base)
    expect(() => c.cancelar('', '2026-06-01T00:00:00Z')).toThrow('RN-R04')
  })

  it('RN-R06: não pode cancelar contrato CANCELADO', () => {
    const c = Contract.create(base)
    c.cancelar('Motivo', '2026-06-01T00:00:00Z')
    expect(() => c.cancelar('Outro', '2026-07-01T00:00:00Z')).toThrow('RN-R06')
  })

  it('diasRestantes retorna 0 após data de fim', () => {
    const c = Contract.create(base)
    expect(c.diasRestantes('2027-01-01T00:00:00Z')).toBe(0)
  })

  it('diasRestantes retorna valor positivo antes do fim', () => {
    const c = Contract.create(base)
    const dias = c.diasRestantes('2026-01-01T00:00:00Z')
    expect(dias).toBeGreaterThan(300)
  })

  it('toObject retorna cópia imutável', () => {
    const c = Contract.create(base)
    const obj = c.toObject()
    expect(obj.status).toBe('ATIVO')
    expect(obj.id).toBe(c.id)
  })
})
