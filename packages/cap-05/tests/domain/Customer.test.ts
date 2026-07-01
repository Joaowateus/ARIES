import { Customer } from '../../src/domain/entities/Customer'

const base = {
  clienteId: 'cli-001',
  oportunidadeId: 'op-001',
  nome: 'ACME Corp',
  responsavelCsId: 'cs-001',
  agora: '2026-02-01T10:00:00Z',
}

describe('Customer entity', () => {
  it('cria cliente com status ONBOARDING e healthScore 70 (RN-C04)', () => {
    const c = Customer.create(base)
    expect(c.status).toBe('ONBOARDING')
    expect(c.healthScore).toBe(70)
    expect(c.emOnboarding()).toBe(true)
    expect(c.estaAtivo()).toBe(false)
  })

  it('RN-C01: rejeita clienteId vazio', () => {
    expect(() => Customer.create({ ...base, clienteId: '' })).toThrow('RN-C01')
  })

  it('rejeita responsavelCsId vazio', () => {
    expect(() => Customer.create({ ...base, responsavelCsId: '' })).toThrow('responsavelCsId')
  })

  it('ativa cliente em ONBOARDING', () => {
    const c = Customer.create(base)
    c.ativar('2026-04-01T00:00:00Z')
    expect(c.status).toBe('ATIVO')
    expect(c.estaAtivo()).toBe(true)
    expect(c.ativadoEm).toBe('2026-04-01T00:00:00Z')
  })

  it('RN-C06: não pode ativar cliente já ATIVO', () => {
    const c = Customer.create(base)
    c.ativar('2026-04-01T00:00:00Z')
    expect(() => c.ativar('2026-04-02T00:00:00Z')).toThrow('RN-C06')
  })

  it('atualiza health score dentro do range válido', () => {
    const c = Customer.create(base)
    c.atualizarHealthScore(55, '2026-03-01T00:00:00Z')
    expect(c.healthScore).toBe(55)
  })

  it('rejeita health score fora de 0-100', () => {
    const c = Customer.create(base)
    expect(() => c.atualizarHealthScore(101, '2026-03-01T00:00:00Z')).toThrow('0 e 100')
    expect(() => c.atualizarHealthScore(-1, '2026-03-01T00:00:00Z')).toThrow('0 e 100')
  })

  it('encerra cliente ATIVO com motivo', () => {
    const c = Customer.create(base)
    c.ativar('2026-04-01T00:00:00Z')
    c.encerrar('Contrato expirado', '2026-12-31T00:00:00Z')
    expect(c.status).toBe('ENCERRADO')
    expect(c.motivoEncerramento).toBe('Contrato expirado')
  })

  it('RN-C07: não pode encerrar cliente já ENCERRADO', () => {
    const c = Customer.create(base)
    c.encerrar('Motivo', '2026-04-01T00:00:00Z')
    expect(() => c.encerrar('Outro', '2026-05-01T00:00:00Z')).toThrow('RN-C07')
  })

  it('vincula contratoId ao cliente', () => {
    const c = Customer.create(base)
    c.vincularContrato('ctr-001', '2026-02-01T12:00:00Z')
    expect(c.contratoId).toBe('ctr-001')
  })

  it('toObject retorna cópia com todos os campos', () => {
    const c = Customer.create({ ...base, segmentoId: 'seg-tech' })
    const obj = c.toObject()
    expect(obj.segmentoId).toBe('seg-tech')
    expect(obj.id).toBe(c.id)
  })
})
