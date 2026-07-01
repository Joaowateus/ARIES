import { MarketSignal } from '../../src/domain/entities/MarketSignal'

const AGORA = '2026-01-01T00:00:00.000Z'

function makeSignal(overrides?: object): MarketSignal {
  return MarketSignal.create({
    tipo: 'REGULATORIO',
    descricao: 'Nova regulamentação LGPD para dados comerciais',
    urgencia: 'alta',
    elementosImpactados: ['ICP', 'POSICIONAMENTO'],
    segmentosImpactados: ['seg-001'],
    fonteDaInformacao: 'DOU 2026-01-01',
    acaoRequerida: 'IMEDIATA',
    criadoPor: 'user-1',
    agora: AGORA,
    ...overrides,
  })
}

describe('MarketSignal', () => {
  it('cria sinal com campos corretos', () => {
    const s = makeSignal()
    expect(s.tipo).toBe('REGULATORIO')
    expect(s.urgencia).toBe('alta')
    expect(s.elementosImpactados).toHaveLength(2)
  })

  it('RN-09: rejeita sem elementosImpactados', () => {
    expect(() => makeSignal({ elementosImpactados: [] })).toThrow('RN-09')
  })

  it('rejeita descrição vazia', () => {
    expect(() => makeSignal({ descricao: '' })).toThrow('descrição')
  })

  it('esCritico retorna true para alta e critica', () => {
    const alta = makeSignal({ urgencia: 'alta' })
    const critica = makeSignal({ urgencia: 'critica' })
    const media = makeSignal({ urgencia: 'media' })

    expect(alta.esCritico()).toBe(true)
    expect(critica.esCritico()).toBe(true)
    expect(media.esCritico()).toBe(false)
  })

  it('marcarProcessado define campos corretos', () => {
    const s = makeSignal()
    s.marcarProcessado('analista-1', AGORA)
    expect(s.processadoEm).toBe(AGORA)
  })
})
