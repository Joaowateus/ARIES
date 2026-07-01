import {
  rn_d_classificarAnomalia,
  rn_d_gerarHipoteses,
  rn_d03_priorizarMup,
  rn_d06_verificarHistorico,
} from '../../domain/rules/BusinessRules'

describe('rn_d_classificarAnomalia', () => {
  it('classifies RETENCAO when health_score and churn_rate affected', () => {
    expect(rn_d_classificarAnomalia(['health_score_medio', 'churn_rate'])).toBe('RETENCAO')
  })

  it('classifies PRECO when discount and approval affected', () => {
    expect(rn_d_classificarAnomalia(['desconto_medio_percentual', 'taxa_aprovacao_propostas'])).toBe('PRECO')
  })

  it('classifies NEGOCIACAO when taxa_fechamento and ciclo_medio_dias affected', () => {
    expect(rn_d_classificarAnomalia(['taxa_fechamento', 'ciclo_medio_dias'])).toBe('NEGOCIACAO')
  })

  it('classifies EXECUCAO when only onboarding_conclusao_rate affected', () => {
    expect(rn_d_classificarAnomalia(['onboarding_conclusao_rate'])).toBe('EXECUCAO')
  })

  it('classifies DEMANDA when pipeline drops without fechamento drop', () => {
    expect(rn_d_classificarAnomalia(['taxa_conversao_pipeline'])).toBe('DEMANDA')
  })

  it('classifies ICP when pipeline drops with health_score affected', () => {
    expect(rn_d_classificarAnomalia(['taxa_conversao_pipeline', 'health_score_medio'])).toBe('ICP')
  })

  it('classifies MERCADO as fallback', () => {
    expect(rn_d_classificarAnomalia(['mrr_total'])).toBe('MERCADO')
  })
})

describe('rn_d_gerarHipoteses', () => {
  it('returns 2 hypotheses for each classification', () => {
    const classifications = ['DEMANDA', 'PRECO', 'NEGOCIACAO', 'ICP', 'EXECUCAO', 'MERCADO', 'RETENCAO'] as const
    for (const c of classifications) {
      const h = rn_d_gerarHipoteses(c, [])
      expect(h.length).toBe(2)
    }
  })

  it('returns hypotheses ordered by confianca descending', () => {
    const h = rn_d_gerarHipoteses('PRECO', ['desconto_medio_percentual'])
    expect(h[0].confianca).toBeGreaterThanOrEqual(h[1].confianca)
  })
})

describe('rn_d03_priorizarMup', () => {
  it('sorts by mupScore.total descending', () => {
    const items = [
      { id: 'a', mupScore: { total: 5 } },
      { id: 'b', mupScore: { total: 9 } },
      { id: 'c', mupScore: { total: 3 } },
    ]
    const sorted = rn_d03_priorizarMup(items)
    expect(sorted.map(i => i.id)).toEqual(['b', 'a', 'c'])
  })
})

describe('rn_d06_verificarHistorico', () => {
  it('returns temHistorico=false when no similar decisions', () => {
    const r = rn_d06_verificarHistorico('PRECO', [{ classificacao: 'DEMANDA', resultado: 'EFETIVO' }])
    expect(r.temHistorico).toBe(false)
  })

  it('counts efetivas and inefetivas correctly', () => {
    const historico = [
      { classificacao: 'PRECO', resultado: 'EFETIVO' },
      { classificacao: 'PRECO', resultado: 'INEFETIVO' },
      { classificacao: 'PRECO', resultado: 'EFETIVO' },
    ]
    const r = rn_d06_verificarHistorico('PRECO', historico)
    expect(r.temHistorico).toBe(true)
    expect(r.decisoesEfetivas).toBe(2)
    expect(r.decisoesInefetivas).toBe(1)
  })
})
