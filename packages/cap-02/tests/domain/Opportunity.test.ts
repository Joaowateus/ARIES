import { Opportunity } from '../../src/domain/entities/Opportunity'

const AGORA = '2026-01-01T00:00:00.000Z'

function makeOp(overrides?: object): Opportunity {
  return Opportunity.create({
    titulo: 'Venda Enterprise Acme',
    clienteId: 'cli-001',
    responsavelId: 'rep-001',
    prioridade: 'alta',
    valorEstimado: 50_000,
    probabilidade: 30,
    dataFechamentoPrevista: '2026-03-31T00:00:00.000Z',
    criadoPor: 'rep-001',
    agora: AGORA,
    ...overrides,
  })
}

describe('Opportunity', () => {
  it('cria com estágio PROSPECCAO', () => {
    const op = makeOp()
    expect(op.estagio).toBe('PROSPECCAO')
    expect(op.estaEncerrada()).toBe(false)
    expect(op.historiocoEstagios).toHaveLength(1)
  })

  it('RN-P04: rejeita sem responsavelId', () => {
    expect(() => makeOp({ responsavelId: '' })).toThrow('RN-P04')
  })

  it('RN-P03: rejeita valor negativo', () => {
    expect(() => makeOp({ valorEstimado: -1 })).toThrow('RN-P03')
  })

  it('rejeita título vazio', () => {
    expect(() => makeOp({ titulo: '' })).toThrow('título')
  })

  describe('avancarEstagio', () => {
    it('avança do PROSPECCAO para QUALIFICACAO', () => {
      const op = makeOp()
      op.avancarEstagio(AGORA)
      expect(op.estagio).toBe('QUALIFICACAO')
      expect(op.historiocoEstagios).toHaveLength(2)
    })

    it('avança por todos os estágios até NEGOCIACAO', () => {
      const op = makeOp()
      op.avancarEstagio(AGORA)
      op.avancarEstagio(AGORA)
      op.avancarEstagio(AGORA)
      expect(op.estagio).toBe('NEGOCIACAO')
    })

    it('NEGOCIACAO não avança mais — deve usar marcarGanha/Perdida', () => {
      const op = makeOp()
      op.avancarEstagio(AGORA)
      op.avancarEstagio(AGORA)
      op.avancarEstagio(AGORA)
      expect(() => op.avancarEstagio(AGORA)).toThrow()
    })
  })

  describe('marcarGanha', () => {
    it('encerra oportunidade como GANHA', () => {
      const op = makeOp()
      op.marcarGanha('cliente assinou contrato', AGORA)
      expect(op.estagio).toBe('GANHA')
      expect(op.estaEncerrada()).toBe(true)
      expect(op.encerradoEm).toBe(AGORA)
    })

    it('RN-P02: ganha não pode ser alterada', () => {
      const op = makeOp()
      op.marcarGanha('ok', AGORA)
      expect(() => op.avancarEstagio(AGORA)).toThrow('RN-P02')
    })
  })

  describe('marcarPerdida', () => {
    it('encerra como PERDIDA com motivo obrigatório', () => {
      const op = makeOp()
      op.marcarPerdida('preço mais alto que concorrente', 'conc-001', AGORA)
      expect(op.estagio).toBe('PERDIDA')
      expect(op.concorrenteVencedorId).toBe('conc-001')
    })

    it('rejeita sem motivo', () => {
      const op = makeOp()
      expect(() => op.marcarPerdida('', undefined, AGORA)).toThrow('motivo')
    })
  })

  describe('cancelar', () => {
    it('cancela com motivo', () => {
      const op = makeOp()
      op.cancelar('cliente saiu do mercado', AGORA)
      expect(op.estagio).toBe('CANCELADA')
    })

    it('rejeita cancelamento sem motivo', () => {
      const op = makeOp()
      expect(() => op.cancelar('', AGORA)).toThrow('motivo')
    })
  })

  describe('cicloEmDias', () => {
    it('calcula ciclo em dias corretamente', () => {
      const op = makeOp()
      const depois = '2026-01-31T00:00:00.000Z'
      op.marcarGanha('ok', depois)
      expect(op.cicloEmDias(depois)).toBe(30)
    })
  })

  describe('atualizarProbabilidade', () => {
    it('aceita 0-100', () => {
      const op = makeOp()
      op.atualizarProbabilidade(75, AGORA)
      expect(op.probabilidade).toBe(75)
    })

    it('rejeita fora do range', () => {
      const op = makeOp()
      expect(() => op.atualizarProbabilidade(101, AGORA)).toThrow()
      expect(() => op.atualizarProbabilidade(-1, AGORA)).toThrow()
    })
  })
})
