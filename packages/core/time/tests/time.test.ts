import { createTimeEngine } from '../src/index'

describe('CORE-07 TimeEngine', () => {
  const time = createTimeEngine()

  afterEach(() => time.resetSimulation())

  test('now() retorna Date válido próximo ao momento atual', () => {
    const before = Date.now()
    const result = time.nowMs()
    const after = Date.now()
    expect(result).toBeGreaterThanOrEqual(before)
    expect(result).toBeLessThanOrEqual(after)
  })

  test('nowISO() retorna string ISO 8601', () => {
    expect(time.nowISO()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  test('simulate() congela o relógio', () => {
    const fixed = new Date('2026-01-15T10:00:00.000Z')
    time.simulate(fixed)
    expect(time.nowISO()).toBe('2026-01-15T10:00:00.000Z')
    expect(time.isSimulated()).toBe(true)
  })

  test('resetSimulation() volta ao relógio real', () => {
    time.simulate(new Date('2000-01-01'))
    time.resetSimulation()
    expect(time.isSimulated()).toBe(false)
    expect(time.nowMs()).toBeGreaterThan(new Date('2020-01-01').getTime())
  })

  test('isBusinessDay() identifica dias úteis', () => {
    const monday = new Date('2026-07-06T12:00:00Z') // segunda
    const sunday = new Date('2026-07-05T12:00:00Z') // domingo
    expect(time.isBusinessDay(monday)).toBe(true)
    expect(time.isBusinessDay(sunday)).toBe(false)
  })

  test('isBusinessDay() respeita feriados', () => {
    const monday = new Date('2026-07-06T12:00:00Z')
    expect(time.isBusinessDay(monday, { holidays: ['2026-07-06'] })).toBe(false)
  })

  test('addBusinessDays() pula fim de semana', () => {
    const friday = new Date('2026-07-03T12:00:00Z') // sexta
    const result = time.addBusinessDays(friday, 1)
    expect(result.toISOString().slice(0, 10)).toBe('2026-07-06') // segunda
  })

  test('businessDaysBetween() conta apenas dias úteis', () => {
    const from = new Date('2026-07-06T00:00:00Z') // segunda
    const to = new Date('2026-07-10T00:00:00Z')   // sexta
    expect(time.businessDaysBetween(from, to)).toBe(4)
  })

  test('startOfDay() e endOfDay() retornam limites corretos', () => {
    const date = new Date('2026-06-15T14:30:00Z')
    expect(time.startOfDay(date).toISOString()).toBe('2026-06-15T00:00:00.000Z')
    expect(time.endOfDay(date).toISOString()).toBe('2026-06-15T23:59:59.999Z')
  })

  test('toDBString() retorna ISO 8601', () => {
    const date = new Date('2026-01-01T00:00:00.000Z')
    expect(time.toDBString(date)).toBe('2026-01-01T00:00:00.000Z')
  })
})
