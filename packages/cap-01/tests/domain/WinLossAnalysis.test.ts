import { WinLossAnalysis, detectarPadrao } from '../../src/domain/entities/WinLossAnalysis'
import { WinLossResult } from '../../src/domain/value-objects/WinLossResult'

const AGORA = '2026-01-01T00:00:00.000Z'

function makeAnalise(overrides?: object): WinLossAnalysis {
  return WinLossAnalysis.create({
    oportunidadeId: 'op-001',
    eventoOrigemId: 'evt-001',
    agora: AGORA,
    ...overrides,
  })
}

describe('WinLossAnalysis', () => {
  it('cria análise com status PENDENTE_ANALISE', () => {
    const a = makeAnalise()
    expect(a.status).toBe('PENDENTE_ANALISE')
    expect(a.oportunidadeId).toBe('op-001')
  })

  it('rejeita sem oportunidadeId', () => {
    expect(() => makeAnalise({ oportunidadeId: '' })).toThrow('oportunidadeId')
  })

  describe('transições', () => {
    it('PENDENTE → EM_ANALISE', () => {
      const a = makeAnalise()
      a.iniciarAnalise(AGORA)
      expect(a.status).toBe('EM_ANALISE')
    })

    it('submeter preenche campos e muda para ANALISADA', () => {
      const a = makeAnalise()
      a.iniciarAnalise(AGORA)
      const result = WinLossResult.lost('PRECO', 'Concorrente X')
      a.submeter({
        result,
        fatoresNegativos: ['preço alto'],
        fatoresPositivos: [],
        sinaisDeAlertaIgnorados: [],
        aprendizados: ['revisar pricing'],
        validadoPor: 'gestor-1',
        agora: AGORA,
      })
      expect(a.status).toBe('ANALISADA')
      expect(a.result).toBeDefined()
      expect(a.estaCompleta()).toBe(true)
    })

    it('ANALISADA → INSIGHTS_PUBLICADOS', () => {
      const a = makeAnalise()
      a.submeter({
        result: WinLossResult.won('PRECO_COMPETITIVO'),
        fatoresNegativos: [],
        fatoresPositivos: ['bom preço'],
        sinaisDeAlertaIgnorados: [],
        aprendizados: [],
        validadoPor: 'g1',
        agora: AGORA,
      })
      a.publicarInsights(AGORA)
      expect(a.status).toBe('INSIGHTS_PUBLICADOS')
    })

    it('descartar requer motivo', () => {
      const a = makeAnalise()
      expect(() => a.descartar('', AGORA)).toThrow('motivo')
    })

    it('não pode descartar análise ANALISADA', () => {
      const a = makeAnalise()
      a.submeter({
        result: WinLossResult.won('PRECO_COMPETITIVO'),
        fatoresNegativos: [],
        fatoresPositivos: [],
        sinaisDeAlertaIgnorados: [],
        aprendizados: [],
        validadoPor: 'g1',
        agora: AGORA,
      })
      expect(() => a.descartar('motivo', AGORA)).toThrow('concluída')
    })
  })

  describe('diasPendente', () => {
    it('retorna dias corretos', () => {
      const a = makeAnalise()
      const depois = '2026-01-15T00:00:00.000Z'
      expect(a.diasPendente(depois)).toBe(14)
    })

    it('retorna 0 para análise concluída', () => {
      const a = makeAnalise()
      a.submeter({
        result: WinLossResult.won('PRECO_COMPETITIVO'),
        fatoresNegativos: [],
        fatoresPositivos: [],
        sinaisDeAlertaIgnorados: [],
        aprendizados: [],
        validadoPor: 'g1',
        agora: AGORA,
      })
      expect(a.diasPendente('2026-02-01T00:00:00.000Z')).toBe(0)
    })
  })

  describe('detectarPadrao', () => {
    it('detecta padrão recorrente de PRECO', () => {
      const analises = Array.from({ length: 4 }, (_, i) => {
        const a = WinLossAnalysis.create({ oportunidadeId: `op-${i}`, eventoOrigemId: `e-${i}`, agora: AGORA })
        a.submeter({
          result: WinLossResult.lost('PRECO'),
          fatoresNegativos: [],
          fatoresPositivos: [],
          sinaisDeAlertaIgnorados: [],
          aprendizados: [],
          validadoPor: 'g1',
          agora: AGORA,
        })
        return a
      })
      const padroes = detectarPadrao(analises)
      expect(padroes).toHaveLength(1)
      expect(padroes[0].tipoRazao).toBe('PRECO')
      expect(padroes[0].ocorrencias).toBe(4)
    })

    it('não detecta padrão com menos de 3 ocorrências', () => {
      const analises = Array.from({ length: 2 }, (_, i) => {
        const a = WinLossAnalysis.create({ oportunidadeId: `op-${i}`, eventoOrigemId: `e-${i}`, agora: AGORA })
        a.submeter({
          result: WinLossResult.lost('PRECO'),
          fatoresNegativos: [],
          fatoresPositivos: [],
          sinaisDeAlertaIgnorados: [],
          aprendizados: [],
          validadoPor: 'g1',
          agora: AGORA,
        })
        return a
      })
      expect(detectarPadrao(analises)).toHaveLength(0)
    })
  })
})
