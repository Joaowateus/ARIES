import { MarketSegment } from '../../src/domain/entities/MarketSegment'

const AGORA = '2026-01-01T00:00:00.000Z'

function makeSegment(overrides?: object): MarketSegment {
  return MarketSegment.create({
    nome: 'PME Industria',
    criteriosEntrada: ['funcionarios >= 10', 'setor = industria'],
    propostaDeValorPrincipal: 'Automação de vendas',
    personasCompradoras: [],
    perguntasDeQualificacao: ['Qual CRM usa?'],
    objecoesComuns: [],
    kpisBenchmark: { winRateEsperado: 35 },
    criadoPor: 'user-1',
    agora: AGORA,
    ...overrides,
  })
}

describe('MarketSegment', () => {
  it('cria com status PROPOSTO', () => {
    const s = makeSegment()
    expect(s.status).toBe('PROPOSTO')
    expect(s.nome).toBe('PME Industria')
  })

  it('rejeita nome vazio', () => {
    expect(() => makeSegment({ nome: '' })).toThrow('nome')
  })

  it('rejeita sem critérios de entrada', () => {
    expect(() => makeSegment({ criteriosEntrada: [] })).toThrow('critério de entrada')
  })

  describe('transições de estado', () => {
    it('PROPOSTO → VALIDADO → ATIVO', () => {
      const s = makeSegment()
      s.validar(AGORA)
      expect(s.status).toBe('VALIDADO')
      s.ativar(AGORA)
      expect(s.status).toBe('ATIVO')
    })

    it('ATIVO → EM_REVISAO → ATIVO', () => {
      const s = makeSegment()
      s.validar(AGORA)
      s.ativar(AGORA)
      s.iniciarRevisao(AGORA)
      expect(s.status).toBe('EM_REVISAO')
      s.ativar(AGORA)
      expect(s.status).toBe('ATIVO')
    })

    it('qualquer estado → DESCONTINUADO', () => {
      const s = makeSegment()
      s.descontinuar(AGORA)
      expect(s.status).toBe('DESCONTINUADO')
    })

    it('DESCONTINUADO → descontinuar é idempotente', () => {
      const s = makeSegment()
      s.descontinuar(AGORA)
      s.descontinuar(AGORA)
      expect(s.status).toBe('DESCONTINUADO')
    })

    it('rejeita ativar sem passar por VALIDADO', () => {
      const s = makeSegment()
      expect(() => s.ativar(AGORA)).toThrow('PROPOSTO')
    })
  })

  it('atualiza perguntas de qualificação', () => {
    const s = makeSegment()
    s.atualizarPerguntasDeQualificacao(['Nova pergunta'], AGORA)
    expect(s.perguntasDeQualificacao).toContain('Nova pergunta')
  })
})
