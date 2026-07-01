import { Competitor } from '../../src/domain/entities/Competitor'

const AGORA = '2026-01-01T00:00:00.000Z'

function makeCompetitor(overrides?: object): Competitor {
  return Competitor.create({
    nome: 'Acme Corp',
    tier: 'direto',
    posicionamento: 'líder de mercado em PME',
    pontosFrotes: ['suporte 24h', 'preço baixo'],
    pontosFracos: ['integração limitada'],
    comoVencer: ['destacar integrações nativas'],
    fonteUltimaAtualizacao: 'pesquisa',
    ultimaAtualizacao: AGORA,
    criadoPor: 'user-1',
    agora: AGORA,
    ...overrides,
  })
}

describe('Competitor', () => {
  it('cria com status ATIVO', () => {
    const c = makeCompetitor()
    expect(c.status).toBe('ATIVO')
    expect(c.nome).toBe('Acme Corp')
  })

  it('rejeita nome vazio', () => {
    expect(() => makeCompetitor({ nome: '' })).toThrow('nome')
  })

  describe('verificarFreshness', () => {
    it('muda para DESATUALIZADO após 181 dias', () => {
      const c = makeCompetitor()
      const depois = '2026-07-01T00:00:00.000Z'
      c.verificarFreshness(depois)
      expect(c.status).toBe('DESATUALIZADO')
    })

    it('permanece ATIVO antes de 180 dias', () => {
      const c = makeCompetitor()
      const depois = '2026-04-01T00:00:00.000Z'
      c.verificarFreshness(depois)
      expect(c.status).toBe('ATIVO')
    })
  })

  describe('atualizar', () => {
    it('volta para ATIVO ao atualizar concorrente DESATUALIZADO', () => {
      const c = makeCompetitor()
      const depois = '2026-07-01T00:00:00.000Z'
      c.verificarFreshness(depois)
      expect(c.status).toBe('DESATUALIZADO')

      c.atualizar({ posicionamento: 'nova posição' }, 'pesquisa', depois)
      expect(c.status).toBe('ATIVO')
    })

    it('rejeita atualização de concorrente DESCONTINUADO', () => {
      const c = makeCompetitor()
      c.descontinuar(AGORA)
      expect(() => c.atualizar({ posicionamento: 'x' }, 'pesquisa', AGORA)).toThrow('descontinuado')
    })
  })

  describe('atualizarWinRate', () => {
    it('aceita valores entre 0 e 100', () => {
      const c = makeCompetitor()
      c.atualizarWinRate(65, AGORA)
      expect(c.winRateContra).toBe(65)
    })

    it('rejeita valores fora do range', () => {
      const c = makeCompetitor()
      expect(() => c.atualizarWinRate(101, AGORA)).toThrow('winRate')
      expect(() => c.atualizarWinRate(-1, AGORA)).toThrow('winRate')
    })
  })

  it('descontinuar muda status', () => {
    const c = makeCompetitor()
    c.descontinuar(AGORA)
    expect(c.status).toBe('DESCONTINUADO')
  })
})
