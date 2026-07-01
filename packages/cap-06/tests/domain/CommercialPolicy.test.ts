import { CommercialPolicy } from '../../src/domain/entities/CommercialPolicy'

const base = {
  nome: 'Política Global 2026',
  descontoMaxN1: 5,
  descontoMaxN2: 10,
  descontoMaxN3: 20,
  margemMinimaPercent: 15,
  criadoPor: 'admin',
  agora: '2026-01-01T00:00:00Z',
}

describe('CommercialPolicy entity', () => {
  it('cria política com status ATIVA', () => {
    const p = CommercialPolicy.create(base)
    expect(p.status).toBe('ATIVA')
    expect(p.descontoMaxN1).toBe(5)
    expect(p.descontoMaxN3).toBe(20)
  })

  it('rejeita descontos com hierarquia inválida (N1 >= N2)', () => {
    expect(() =>
      CommercialPolicy.create({ ...base, descontoMaxN1: 10, descontoMaxN2: 10 }),
    ).toThrow('descontoMaxN1 deve ser menor que descontoMaxN2')
  })

  it('rejeita descontos com hierarquia inválida (N2 >= N3)', () => {
    expect(() =>
      CommercialPolicy.create({ ...base, descontoMaxN2: 20, descontoMaxN3: 20 }),
    ).toThrow('descontoMaxN2 deve ser menor que descontoMaxN3')
  })

  it('rejeita margemMinimaPercent negativa', () => {
    expect(() =>
      CommercialPolicy.create({ ...base, margemMinimaPercent: -1 }),
    ).toThrow('negativa')
  })

  it('alcadaNecessaria retorna N1 para desconto <= descontoMaxN1', () => {
    const p = CommercialPolicy.create(base)
    expect(p.alcadaNecessaria(5)).toBe('N1')
    expect(p.alcadaNecessaria(0)).toBe('N1')
  })

  it('alcadaNecessaria retorna N2 para desconto entre N1 e N2', () => {
    const p = CommercialPolicy.create(base)
    expect(p.alcadaNecessaria(8)).toBe('N2')
  })

  it('alcadaNecessaria retorna N3 para desconto entre N2 e N3', () => {
    const p = CommercialPolicy.create(base)
    expect(p.alcadaNecessaria(15)).toBe('N3')
  })

  it('alcadaNecessaria retorna N4 para desconto acima de N3', () => {
    const p = CommercialPolicy.create(base)
    expect(p.alcadaNecessaria(25)).toBe('N4')
  })

  it('inativar muda status para INATIVA', () => {
    const p = CommercialPolicy.create(base)
    p.inativar('2026-06-01T00:00:00Z')
    expect(p.status).toBe('INATIVA')
  })
})
