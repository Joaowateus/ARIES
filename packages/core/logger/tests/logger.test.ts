import { createLogger } from '../src/index'
import { Identity, type UserContext } from '@soe/core-identity'

const testUser: UserContext = {
  userId: 'usr-test',
  name: 'Test User',
  role: 'Dev',
  decisionLevel: 'D1',
  permissions: [],
  tenantId: 'tenant-test',
  context: {},
}

describe('CORE-02 Logging Engine', () => {
  test('info() cria entrada com campos obrigatórios', () => {
    const logger = createLogger({ component: 'cap-03' }, { minLevel: 'DEBUG' })
    logger.info('Oportunidade criada', { opportunityId: 'opp-001' })
    const entries = logger.entries()
    expect(entries).toHaveLength(1)
    const entry = entries[0]!
    expect(entry.level).toBe('INFO')
    expect(entry.message).toBe('Oportunidade criada')
    expect(entry.component).toBe('cap-03')
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(entry.payload).toEqual({ opportunityId: 'opp-001' })
  })

  test('minLevel filtra logs abaixo do nível configurado', () => {
    const logger = createLogger({ component: 'test' }, { minLevel: 'WARN' })
    logger.debug('debug msg')
    logger.info('info msg')
    logger.warn('warn msg')
    logger.error('error msg')
    expect(logger.entries()).toHaveLength(2)
    expect(logger.entries()[0]!.level).toBe('WARN')
    expect(logger.entries()[1]!.level).toBe('ERROR')
  })

  test('child() herda contexto do pai e adiciona campos extras', () => {
    const parent = createLogger({ component: 'eng-11' }, { minLevel: 'DEBUG' })
    const child = parent.child({ engine: 'eng-11', cap: 'cap-03' })
    child.info('child log')
    const entries = child.entries()
    expect(entries[0]!.engine).toBe('eng-11')
    expect(entries[0]!.cap).toBe('cap-03')
  })

  test('correlationId é injetado automaticamente do contexto de identidade', async () => {
    const logger = createLogger({ component: 'test' }, { minLevel: 'DEBUG' })
    const ctx = { correlationId: 'corr-abc123', user: testUser }
    await Identity.runAs(ctx, async () => {
      logger.info('dentro do contexto')
    })
    const entry = logger.entries()[0]!
    expect(entry.correlationId).toBe('corr-abc123')
    expect(entry.userId).toBe('usr-test')
    expect(entry.tenantId).toBe('tenant-test')
  })

  test('campos undefined não aparecem no entry', () => {
    const logger = createLogger({ component: 'test' }, { minLevel: 'DEBUG' })
    logger.info('msg sem payload')
    const entry = logger.entries()[0]!
    expect('payload' in entry).toBe(false)
    expect('engine' in entry).toBe(false)
    expect('correlationId' in entry).toBe(false)
  })

  test('entries() retorna cópia — modificar não afeta o logger', () => {
    const logger = createLogger({ component: 'test' }, { minLevel: 'DEBUG' })
    logger.info('msg')
    const entries = logger.entries()
    entries.pop()
    expect(logger.entries()).toHaveLength(1)
  })
})
