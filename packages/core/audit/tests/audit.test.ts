import { createAuditEngine, InMemoryAuditStore } from '../src/index'
import { InMemoryTransport, EventPublisher } from '@soe/core-events'
import { Identity, type UserContext } from '@soe/core-identity'

const testUser: UserContext = {
  userId: 'usr-001',
  name: 'Ana',
  role: 'Manager',
  decisionLevel: 'D2',
  permissions: [],
  tenantId: 'tenant-001',
  context: {},
}

describe('CORE-06 Audit Engine', () => {
  const store = new InMemoryAuditStore()
  const audit = createAuditEngine(store)
  const transport = new InMemoryTransport()

  beforeEach(() => {
    store.clear()
    transport.clear()
    EventPublisher.setTransport(transport)
  })

  test('record() cria entrada com campos obrigatórios', async () => {
    await Identity.runAs({ correlationId: 'corr-001', user: testUser }, async () => {
      const entry = await audit.record({
        entity_type: 'oportunidade',
        entity_id: 'opp-001',
        action: 'CREATE',
        after: { valor: 50000, status: 'aberta' },
        origin: 'cap-03',
      })

      expect(entry.audit_id).toMatch(/^[0-9a-f-]{36}$/)
      expect(entry.changed_by).toBe('usr-001')
      expect(entry.changed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(entry.correlacao_id).toBe('corr-001')
      expect(entry.entity_type).toBe('oportunidade')
    })
  })

  test('record() publica evento auditoria.registro_criado', async () => {
    await Identity.runAs({ correlationId: 'corr-001', user: testUser }, async () => {
      await audit.record({
        entity_type: 'processo',
        entity_id: 'proc-001',
        action: 'STATE_CHANGE',
        before: { status: 'em_andamento' },
        after: { status: 'concluido' },
        origin: 'eng-01',
      })
    })
    expect(transport.events().some((e: { event_type: string }) => e.event_type === 'auditoria.registro_criado')).toBe(true)
  })

  test('record() com CORRECTION requer corrects_audit_id e reason', async () => {
    await expect(
      audit.record({
        entity_type: 'oportunidade',
        entity_id: 'opp-001',
        action: 'CORRECTION',
        origin: 'cap-03',
        // sem corrects_audit_id
      }),
    ).rejects.toThrow('AUDIT-001')

    await expect(
      audit.record({
        entity_type: 'oportunidade',
        entity_id: 'opp-001',
        action: 'CORRECTION',
        corrects_audit_id: 'audit-abc',
        origin: 'cap-03',
        // sem reason
      }),
    ).rejects.toThrow('AUDIT-002')
  })

  test('wrap() captura before e after automaticamente', async () => {
    let state = { status: 'aberta', valor: 1000 }
    const getState = async () => ({ ...state })

    await Identity.runAs({ correlationId: 'corr-w01', user: testUser }, async () => {
      await audit.wrap(
        { entityType: 'oportunidade', entityId: 'opp-002', action: 'UPDATE', origin: 'cap-03' },
        getState,
        async () => {
          state = { status: 'qualificada', valor: 1000 }
        },
      )
    })

    const entries = await audit.findByEntity('oportunidade', 'opp-002')
    expect(entries).toHaveLength(1)
    expect(entries[0]!.before).toEqual({ status: 'aberta', valor: 1000 })
    expect(entries[0]!.after).toEqual({ status: 'qualificada', valor: 1000 })
  })

  test('findByEntity() retorna apenas registros da entidade solicitada', async () => {
    await Identity.runAs({ correlationId: 'corr-001', user: testUser }, async () => {
      await audit.record({ entity_type: 'opp', entity_id: 'A', action: 'CREATE', origin: 'test' })
      await audit.record({ entity_type: 'opp', entity_id: 'B', action: 'CREATE', origin: 'test' })
      await audit.record({ entity_type: 'opp', entity_id: 'A', action: 'UPDATE', origin: 'test' })
    })

    const entriesA = await audit.findByEntity('opp', 'A')
    expect(entriesA).toHaveLength(2)
    expect(entriesA.every((e) => e.entity_id === 'A')).toBe(true)
  })

  test('audit_id é único para cada registro', async () => {
    await Identity.runAs({ correlationId: 'corr-001', user: testUser }, async () => {
      const e1 = await audit.record({ entity_type: 'x', entity_id: '1', action: 'CREATE', origin: 'test' })
      const e2 = await audit.record({ entity_type: 'x', entity_id: '1', action: 'UPDATE', origin: 'test' })
      expect(e1.audit_id).not.toBe(e2.audit_id)
    })
  })
})
