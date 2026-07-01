/**
 * CORE-04 — Event Publisher
 * Publicador oficial do CUE. Nenhum módulo publica eventos diretamente no barramento.
 * Garante: validação de schema, event_id único, correlação, retry e dead letter.
 *
 * O transport (Kafka/RabbitMQ/NATS/in-memory) é plugável via IEventTransport.
 * Sprint 1 decidirá e registrará o transport de produção.
 */

import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { Time } from '@soe/core-time'
import { createLogger } from '@soe/core-logger'
import { Identity } from '@soe/core-identity'
import { GovernanceError, InfrastructureError } from '@soe/core-errors'
import { Validation, CommonSchemas } from '@soe/core-validation'

const log = createLogger({ component: 'core-events', engine: 'core-04' })

// ── Contrato do evento SOE (conforme CUE) ──────────────────────────────────

export const SOEEventSchema = z.object({
  event_id: CommonSchemas.uuid,
  event_type: CommonSchemas.eventType,
  schema_version: CommonSchemas.semver,
  published_at: CommonSchemas.isoDatetime,
  correlacao_id: CommonSchemas.correlationId,
  producer: z.string().min(1),
  payload: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
})

export type SOEEvent<T extends Record<string, unknown> = Record<string, unknown>> = Omit<
  z.infer<typeof SOEEventSchema>,
  'payload'
> & { payload: T }

/** Input para publicação — event_id e published_at são gerados automaticamente */
export type PublishInput<T extends Record<string, unknown> = Record<string, unknown>> = Omit<
  SOEEvent<T>,
  'event_id' | 'published_at'
>

// ── Contrato do transport ──────────────────────────────────────────────────

export interface DeadLetterEntry {
  event: SOEEvent
  error: string
  attempts: number
  lastAttemptAt: string
}

export interface IEventTransport {
  publish(event: SOEEvent): Promise<void>
  onDeadLetter?(entry: DeadLetterEntry): Promise<void>
}

// ── Configuração do publisher ──────────────────────────────────────────────

export interface EventPublisherOptions {
  maxRetries?: number
  retryDelayMs?: number
  /** Se true, eventos com event_id já vistos nas últimas 24h são silenciosamente descartados */
  deduplicationEnabled?: boolean
}

// ── Registro de schemas CUE ───────────────────────────────────────────────

type PayloadSchema = z.ZodType<Record<string, unknown>>
const registeredSchemas = new Map<string, PayloadSchema>()

export function registerEventSchema(eventType: string, schema: PayloadSchema): void {
  registeredSchemas.set(eventType, schema)
}

// ── Implementação do publisher ─────────────────────────────────────────────

const seenEventIds = new Map<string, number>() // event_id → timestamp
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000

function purgeExpiredEventIds(): void {
  const cutoff = Date.now() - DEDUP_WINDOW_MS
  for (const [id, ts] of seenEventIds.entries()) {
    if (ts < cutoff) seenEventIds.delete(id)
  }
}

export interface IEventPublisher {
  publish<T extends Record<string, unknown>>(input: PublishInput<T>): Promise<SOEEvent<T>>
  publishBatch<T extends Record<string, unknown>>(inputs: PublishInput<T>[]): Promise<SOEEvent<T>[]>
  /** Substitui o transport (usado em testes e no bootstrap de infra) */
  setTransport(transport: IEventTransport): void
}

class EventPublisherImpl implements IEventPublisher {
  private transport: IEventTransport
  private readonly opts: Required<EventPublisherOptions>

  constructor(transport: IEventTransport, opts: EventPublisherOptions = {}) {
    this.transport = transport
    this.opts = {
      maxRetries: opts.maxRetries ?? 3,
      retryDelayMs: opts.retryDelayMs ?? 500,
      deduplicationEnabled: opts.deduplicationEnabled ?? true,
    }
  }

  setTransport(transport: IEventTransport): void {
    this.transport = transport
  }

  async publish<T extends Record<string, unknown>>(input: PublishInput<T>): Promise<SOEEvent<T>> {
    // 1. Gera event_id e published_at
    const event: SOEEvent<T> = {
      ...input,
      event_id: uuidv4(),
      published_at: Time.nowISO(),
      correlacao_id: input.correlacao_id ?? Identity.correlationId() ?? uuidv4(),
    }

    // 2. Valida envelope obrigatório (CUE contrato)
    const envelopeResult = Validation.schema(SOEEventSchema).validate(event)
    if (!envelopeResult.valid) {
      throw new GovernanceError(
        'CUE-001',
        `Event envelope invalid: ${envelopeResult.errors.map((e) => `${e.field}: ${e.message}`).join('; ')}`,
        'Evento rejeitado por violação do contrato CUE.',
        'Verifique os campos obrigatórios do envelope e abra RFC se o schema precisar mudar.',
        { publishedEvent: 'sistema.violacao_cue_detectada' },
      )
    }

    // 3. Valida payload contra schema registrado (se existir)
    const payloadSchema = registeredSchemas.get(event.event_type)
    if (payloadSchema) {
      const payloadResult = Validation.schema(payloadSchema).validate(event.payload)
      if (!payloadResult.valid) {
        throw new GovernanceError(
          'CUE-002',
          `Payload for "${event.event_type}" invalid: ${payloadResult.errors.map((e) => `${e.field}: ${e.message}`).join('; ')}`,
          'Payload do evento não corresponde ao schema registrado no CUE.',
          'Corrija o payload ou atualize o schema via RFC.',
          { publishedEvent: 'sistema.violacao_cue_detectada', context: { eventType: event.event_type } },
        )
      }
    }

    // 4. Deduplicação
    if (this.opts.deduplicationEnabled) {
      purgeExpiredEventIds()
      if (seenEventIds.has(event.event_id)) {
        log.warn('Duplicate event_id detected — discarding', { event_id: event.event_id })
        return event
      }
      seenEventIds.set(event.event_id, Date.now())
    }

    // 5. Publica com retry exponencial
    await this.publishWithRetry(event)

    log.debug(`Event published: ${event.event_type}`, {
      event_id: event.event_id,
      correlacao_id: event.correlacao_id,
    })

    return event
  }

  async publishBatch<T extends Record<string, unknown>>(inputs: PublishInput<T>[]): Promise<SOEEvent<T>[]> {
    return Promise.all(inputs.map((input) => this.publish(input)))
  }

  private async publishWithRetry(event: SOEEvent): Promise<void> {
    let lastError: Error | undefined
    let delay = this.opts.retryDelayMs

    for (let attempt = 1; attempt <= this.opts.maxRetries; attempt++) {
      try {
        await this.transport.publish(event)
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        log.warn(`Event publish attempt ${attempt} failed`, {
          event_id: event.event_id,
          error: lastError.message,
        })
        if (attempt < this.opts.maxRetries) {
          await sleep(delay)
          delay *= 2
        }
      }
    }

    // Dead letter
    const dlEntry: DeadLetterEntry = {
      event,
      error: lastError?.message ?? 'unknown',
      attempts: this.opts.maxRetries,
      lastAttemptAt: Time.nowISO(),
    }

    log.error(`Event sent to dead letter after ${this.opts.maxRetries} attempts`, {
      event_id: event.event_id,
      event_type: event.event_type,
    })

    try {
      await this.transport.onDeadLetter?.(dlEntry)
    } catch {
      // Dead letter handler failure must not throw
    }

    throw new InfrastructureError(
      'EVENT-001',
      `Failed to publish event ${event.event_type} after ${this.opts.maxRetries} attempts: ${lastError?.message}`,
      { severity: 'HIGH', publishedEvent: 'sistema.falha_publicacao_evento' },
    )
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── In-memory transport (desenvolvimento e testes) ─────────────────────────

export class InMemoryTransport implements IEventTransport {
  private readonly published: SOEEvent[] = []
  private readonly deadLetters: DeadLetterEntry[] = []
  private failNext = false

  async publish(event: SOEEvent): Promise<void> {
    if (this.failNext) {
      this.failNext = false
      throw new Error('Simulated transport failure')
    }
    this.published.push(event)
  }

  async onDeadLetter(entry: DeadLetterEntry): Promise<void> {
    this.deadLetters.push(entry)
  }

  simulateFailure(): void { this.failNext = true }
  events(): SOEEvent[] { return [...this.published] }
  deadLetterEvents(): DeadLetterEntry[] { return [...this.deadLetters] }
  clear(): void { this.published.length = 0; this.deadLetters.length = 0 }
}

/** Transport padrão (in-memory). Substituído pelo bootstrap de infra em produção. */
export const DefaultTransport = new InMemoryTransport()

/** Singleton global do publisher */
export const EventPublisher: IEventPublisher = new EventPublisherImpl(DefaultTransport, {
  maxRetries: 3,
  retryDelayMs: 100,
})
