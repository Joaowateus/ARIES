import { z } from 'zod'
import { EventPublisher, InMemoryTransport, registerEventSchema } from '../src/index'
import { GovernanceError as GovErr } from '@soe/core-errors'

describe('CORE-04 Event Publisher', () => {
  const transport = new InMemoryTransport()

  beforeEach(() => {
    transport.clear()
    EventPublisher.setTransport(transport)
  })

  const validInput = {
    event_type: 'oportunidade.ganha',
    schema_version: '1.0.0',
    correlacao_id: 'corr-001',
    producer: 'cap-03',
    payload: { oportunidade_id: 'opp-123', valor: 50000 },
  }

  test('publish() gera event_id e published_at automaticamente', async () => {
    const event = await EventPublisher.publish(validInput)
    expect(event.event_id).toMatch(/^[0-9a-f-]{36}$/)
    expect(event.published_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('publish() entrega evento ao transport', async () => {
    await EventPublisher.publish(validInput)
    expect(transport.events()).toHaveLength(1)
    expect(transport.events()[0]!.event_type).toBe('oportunidade.ganha')
  })

  test('publish() rejeita evento sem producer (violação CUE)', async () => {
    const bad = { ...validInput, producer: '' }
    await expect(EventPublisher.publish(bad)).rejects.toBeInstanceOf(GovErr)
  })

  test('publish() rejeita event_type com formato inválido', async () => {
    const bad = { ...validInput, event_type: 'sem-ponto' }
    await expect(EventPublisher.publish(bad)).rejects.toBeInstanceOf(GovErr)
  })

  test('publish() valida payload quando schema está registrado', async () => {
    registerEventSchema(
      'pedido.criado',
      z.object({ pedido_id: z.string(), valor: z.number().positive() }) as z.ZodType<Record<string, unknown>>,
    )

    const validPayload = { ...validInput, event_type: 'pedido.criado', payload: { pedido_id: 'p-001', valor: 100 } }
    await expect(EventPublisher.publish(validPayload)).resolves.toBeDefined()

    const invalidPayload = { ...validInput, event_type: 'pedido.criado', payload: { pedido_id: 'p-001', valor: -1 } }
    await expect(EventPublisher.publish(invalidPayload)).rejects.toBeInstanceOf(GovErr)
  })

  test('publishBatch() publica múltiplos eventos', async () => {
    const batch = [
      { ...validInput, correlacao_id: 'corr-001' },
      { ...validInput, correlacao_id: 'corr-002' },
    ]
    const events = await EventPublisher.publishBatch(batch)
    expect(events).toHaveLength(2)
    expect(transport.events()).toHaveLength(2)
    // Cada evento tem event_id único
    const ids = new Set(events.map((e) => e.event_id))
    expect(ids.size).toBe(2)
  })
})
