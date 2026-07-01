import { Health, simpleChecker, type ComponentHealth } from '../src/index'

describe('CORE-09 Health Engine', () => {
  beforeEach(() => {
    // Limpa checkers entre testes
    for (const id of Health.registeredComponents()) {
      Health.unregister(id)
    }
  })

  const healthyChecker = simpleChecker('test-component', '1.0.0', async () => {})
  const unhealthyChecker = async (): Promise<ComponentHealth> => ({
    component: 'broken',
    version: '1.0.0',
    status: 'UNHEALTHY',
    dependencies: [],
    lastHeartbeat: new Date().toISOString(),
    operationalState: 'Database connection refused',
  })

  test('checkAll() com zero componentes retorna ISA 100', async () => {
    const result = await Health.checkAll()
    expect(result.isa).toBe(100)
    expect(result.status).toBe('HEALTHY')
  })

  test('checkOne() retorna UNHEALTHY para componente não registrado', async () => {
    const result = await Health.checkOne('inexistente')
    expect(result.status).toBe('UNHEALTHY')
    expect(result.operationalState).toContain('Not registered')
  })

  test('register() + checkAll() com componente saudável', async () => {
    Health.register('comp-a', healthyChecker)
    const result = await Health.checkAll()
    expect(result.totalComponents).toBe(1)
    expect(result.healthyComponents).toBe(1)
    expect(result.isa).toBe(100)
    expect(result.status).toBe('HEALTHY')
  })

  test('ISA cai quando componente não está saudável', async () => {
    Health.register('comp-a', healthyChecker)
    Health.register('comp-b', unhealthyChecker)
    const result = await Health.checkAll()
    expect(result.isa).toBe(50)
    expect(result.status).toBe('UNHEALTHY') // < 80%
    expect(result.healthyComponents).toBe(1)
    expect(result.totalComponents).toBe(2)
  })

  test('ISA = 100 quando todos saudáveis', async () => {
    Health.register('a', healthyChecker)
    Health.register('b', healthyChecker)
    Health.register('c', healthyChecker)
    const result = await Health.checkAll()
    expect(result.isa).toBe(100)
  })

  test('checker que lança exceção retorna UNHEALTHY', async () => {
    Health.register('crash', async () => { throw new Error('boom') })
    const result = await Health.checkOne('crash')
    expect(result.status).toBe('UNHEALTHY')
    expect(result.operationalState).toContain('boom')
  })

  test('currentISA() reflete o último checkAll()', async () => {
    Health.register('x', healthyChecker)
    await Health.checkAll()
    expect(Health.currentISA()).toBe(100)
  })

  test('checkedAt está no formato ISO', async () => {
    const result = await Health.checkAll()
    expect(result.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
