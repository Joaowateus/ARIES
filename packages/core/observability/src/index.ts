/**
 * CORE-10 — Observability
 * Métricas, tracing distribuído e correlação.
 * As interfaces são agnósticas de backend — Prometheus/OTEL plugável via Sprint 6.
 */

import { Time } from '@soe/core-time'
import { Identity } from '@soe/core-identity'
import { createLogger } from '@soe/core-logger'

const log = createLogger({ component: 'core-observability', engine: 'core-10' })

// ── Métricas ───────────────────────────────────────────────────────────────

export type MetricLabels = Record<string, string>

export interface MetricSample {
  name: string
  value: number
  labels: MetricLabels
  timestamp: string
  type: 'counter' | 'gauge' | 'histogram'
}

export interface IMetrics {
  /** Incrementa um contador (monotonicamente crescente) */
  counter(name: string, value?: number, labels?: MetricLabels): void
  /** Define um valor pontual (pode subir ou descer) */
  gauge(name: string, value: number, labels?: MetricLabels): void
  /** Registra uma observação de distribuição (latências, tamanhos) */
  histogram(name: string, value: number, labels?: MetricLabels): void
  /** Retorna todas as amostras (para exportação/testes) */
  samples(): MetricSample[]
  /** Exporta no formato Prometheus text */
  toPrometheusText(): string
}

// ── Tracing ────────────────────────────────────────────────────────────────

export interface SpanContext {
  traceId: string
  spanId: string
  parentSpanId?: string | undefined
  correlationId?: string | undefined
}

export interface SpanRecord {
  name: string
  traceId: string
  spanId: string
  parentSpanId?: string | undefined
  correlationId?: string | undefined
  startedAt: string
  endedAt?: string | undefined
  durationMs?: number | undefined
  status: 'running' | 'ok' | 'error'
  error?: string | undefined
  attributes: Record<string, unknown>
}

export interface ISpan {
  readonly context: SpanContext
  setAttribute(key: string, value: unknown): void
  end(error?: Error): void
  record(): SpanRecord
}

export interface ITracer {
  startSpan(name: string, parent?: SpanContext): ISpan
  withSpan<T>(name: string, fn: (span: ISpan) => Promise<T>): Promise<T>
  spans(): SpanRecord[]
}

// ── Observability Context ──────────────────────────────────────────────────

export interface IObservabilityEngine {
  metrics: IMetrics
  tracer: ITracer
  /** Mede o tempo de execução de uma função e registra como histogram */
  measureDuration<T>(metricName: string, fn: () => Promise<T>, labels?: MetricLabels): Promise<T>
}

// ── Implementações in-memory (dev/testes) ─────────────────────────────────

class InMemoryMetrics implements IMetrics {
  private readonly data: MetricSample[] = []

  counter(name: string, value = 1, labels: MetricLabels = {}): void {
    this.data.push({ name, value, labels, timestamp: Time.nowISO(), type: 'counter' })
  }

  gauge(name: string, value: number, labels: MetricLabels = {}): void {
    this.data.push({ name, value, labels, timestamp: Time.nowISO(), type: 'gauge' })
  }

  histogram(name: string, value: number, labels: MetricLabels = {}): void {
    this.data.push({ name, value, labels, timestamp: Time.nowISO(), type: 'histogram' })
  }

  samples(): MetricSample[] { return [...this.data] }

  toPrometheusText(): string {
    const lines: string[] = []
    const grouped = new Map<string, MetricSample[]>()
    for (const s of this.data) {
      const existing = grouped.get(s.name) ?? []
      existing.push(s)
      grouped.set(s.name, existing)
    }

    for (const [name, samples] of grouped.entries()) {
      const latest = samples[samples.length - 1]!
      lines.push(`# TYPE ${name} ${latest.type}`)
      const labelStr = Object.entries(latest.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',')
      lines.push(`${name}${labelStr ? `{${labelStr}}` : ''} ${latest.value}`)
    }
    return lines.join('\n')
  }
}

function generateId(length = 16): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

class InMemorySpan implements ISpan {
  readonly context: SpanContext
  private readonly startedAt: string
  private readonly attributes: Record<string, unknown> = {}
  private endedAt?: string
  private error?: Error | undefined

  constructor(name: string, parent?: SpanContext) {
    const correlationId = Identity.correlationId()
    this.context = {
      traceId: parent?.traceId ?? generateId(32),
      spanId: generateId(16),
      parentSpanId: parent?.spanId,
      correlationId: correlationId ?? parent?.correlationId,
    }
    this.startedAt = Time.nowISO()
    this.attributes['name'] = name
  }

  setAttribute(key: string, value: unknown): void {
    this.attributes[key] = value
  }

  end(error?: Error): void {
    this.endedAt = Time.nowISO()
    this.error = error
  }

  record(): SpanRecord {
    const start = new Date(this.startedAt).getTime()
    const end = this.endedAt ? new Date(this.endedAt).getTime() : undefined
    return {
      name: String(this.attributes['name'] ?? 'unknown'),
      traceId: this.context.traceId,
      spanId: this.context.spanId,
      parentSpanId: this.context.parentSpanId,
      correlationId: this.context.correlationId,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      durationMs: end !== undefined ? end - start : undefined,
      status: this.error ? 'error' : this.endedAt ? 'ok' : 'running',
      error: this.error?.message,
      attributes: { ...this.attributes },
    }
  }
}

class InMemoryTracer implements ITracer {
  private readonly spanRecords: SpanRecord[] = []

  startSpan(name: string, parent?: SpanContext): ISpan {
    return new InMemorySpan(name, parent)
  }

  async withSpan<T>(name: string, fn: (span: ISpan) => Promise<T>): Promise<T> {
    const span = this.startSpan(name)
    try {
      const result = await fn(span)
      span.end()
      this.spanRecords.push(span.record())
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      span.end(error)
      this.spanRecords.push(span.record())
      log.error(`Span "${name}" ended with error`, { error: error.message })
      throw err
    }
  }

  spans(): SpanRecord[] { return [...this.spanRecords] }
}

class ObservabilityEngineImpl implements IObservabilityEngine {
  readonly metrics: IMetrics = new InMemoryMetrics()
  readonly tracer: ITracer = new InMemoryTracer()

  async measureDuration<T>(metricName: string, fn: () => Promise<T>, labels: MetricLabels = {}): Promise<T> {
    const start = Time.nowMs()
    try {
      const result = await fn()
      this.metrics.histogram(metricName, Time.nowMs() - start, { ...labels, status: 'ok' })
      return result
    } catch (err) {
      this.metrics.histogram(metricName, Time.nowMs() - start, { ...labels, status: 'error' })
      this.metrics.counter(`${metricName}_errors_total`, 1, labels)
      throw err
    }
  }
}

/** Singleton global */
export const Observability: IObservabilityEngine = new ObservabilityEngineImpl()
