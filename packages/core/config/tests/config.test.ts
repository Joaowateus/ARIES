import { z } from 'zod'
import { createConfigEngine, ConfigError, MUP_MODES } from '../src/index'

describe('CORE-01 ConfigEngine', () => {
  const cfg = createConfigEngine()

  afterEach(() => cfg.clearOverrides())

  test('env() retorna development por padrão', () => {
    expect(['development', 'test']).toContain(cfg.env())
  })

  test('get() retorna undefined para chave inexistente', () => {
    expect(cfg.get('SOE_CHAVE_INEXISTENTE_XYZ')).toBeUndefined()
  })

  test('require() lança ConfigError para chave ausente', () => {
    expect(() => cfg.require('SOE_CHAVE_INEXISTENTE_XYZ')).toThrow(ConfigError)
  })

  test('getOr() retorna fallback quando chave ausente', () => {
    expect(cfg.getOr('SOE_CHAVE_INEXISTENTE_XYZ', 'default')).toBe('default')
  })

  test('override() e clearOverrides() funcionam', () => {
    cfg.override('SOE_TEST_KEY', 'valor-teste')
    expect(cfg.get('SOE_TEST_KEY')).toBe('valor-teste')
    cfg.clearOverrides()
    expect(cfg.get('SOE_TEST_KEY')).toBeUndefined()
  })

  test('flag() retorna false para flag não definida', () => {
    expect(cfg.flag('FEATURE_INEXISTENTE')).toBe(false)
  })

  test('flag() retorna true para "true" e "1"', () => {
    cfg.override('SOE_FLAG_MINHA_FEATURE', 'true')
    expect(cfg.flag('MINHA_FEATURE')).toBe(true)
    cfg.override('SOE_FLAG_MINHA_FEATURE', '1')
    expect(cfg.flag('MINHA_FEATURE')).toBe(true)
  })

  test('mup() retorna modo padrão quando SOE_MUP_MODE ausente', () => {
    const mup = cfg.mup()
    expect(mup.mode).toBe('padrao')
    expect(mup.weights).toEqual(MUP_MODES.padrao)
  })

  test('mup() lê modo via override', () => {
    cfg.override('SOE_MUP_MODE', 'crise_financeira')
    const mup = cfg.mup()
    expect(mup.mode).toBe('crise_financeira')
    expect(mup.weights.impacto).toBe(0.40)
  })

  test('validate() com schema Zod válido retorna valor parseado', () => {
    const schema = z.object({ porta: z.number() })
    expect(cfg.validate({ porta: 3000 }, schema)).toEqual({ porta: 3000 })
  })

  test('validate() lança ConfigError para schema inválido', () => {
    const schema = z.object({ porta: z.number() })
    expect(() => cfg.validate({ porta: 'nao-numero' }, schema)).toThrow(ConfigError)
  })
})
