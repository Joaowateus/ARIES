import { Observability } from '../src/index'

describe('CORE-10 Observability', () => {
  describe('Metrics', () => {
    test('counter() registra sample com tipo counter', () => {
      Observability.metrics.counter('events_published_total', 1, { producer: 'cap-03' })
      const samples = Observability.metrics.samples()
      const sample = samples.find((s) => s.name === 'events_published_total')
      expect(sample).toBeDefined()
      expect(sample!.type).toBe('counter')
      expect(sample!.labels['producer']).toBe('cap-03')
    })

    test('gauge() registra valor pontual', () => {
      Observability.metrics.gauge('queue_depth', 42, { queue: 'main' })
      const sample = Observability.metrics.samples().find((s) => s.name === 'queue_depth')
      expect(sample!.value).toBe(42)
      expect(sample!.type).toBe('gauge')
    })

    test('histogram() registra distribuição', () => {
      Observability.metrics.histogram('request_duration_ms', 123, { endpoint: '/health' })
      const sample = Observability.metrics.samples().find((s) => s.name === 'request_duration_ms')
      expect(sample!.value).toBe(123)
      expect(sample!.type).toBe('histogram')
    })

    test('toPrometheusText() gera formato válido', () => {
      Observability.metrics.counter('test_total', 5)
      const text = Observability.metrics.toPrometheusText()
      expect(text).toContain('# TYPE test_total counter')
      expect(text).toContain('test_total 5')
    })
  })

  describe('Tracer', () => {
    test('withSpan() registra span com durationMs', async () => {
      await Observability.tracer.withSpan('test-operation', async (span) => {
        span.setAttribute('key', 'value')
        await new Promise((r) => setTimeout(r, 5))
      })
      const spans = Observability.tracer.spans()
      const span = spans.find((s) => s.name === 'test-operation')
      expect(span).toBeDefined()
      expect(span!.status).toBe('ok')
      expect(span!.durationMs).toBeGreaterThanOrEqual(5)
      expect(span!.attributes['key']).toBe('value')
    })

    test('withSpan() registra erro e relança exceção', async () => {
      await expect(
        Observability.tracer.withSpan('failing-op', async () => {
          throw new Error('test error')
        }),
      ).rejects.toThrow('test error')

      const span = Observability.tracer.spans().find((s) => s.name === 'failing-op')
      expect(span!.status).toBe('error')
      expect(span!.error).toBe('test error')
    })
  })

  describe('measureDuration()', () => {
    test('registra histogram com status ok', async () => {
      await Observability.measureDuration('db_query_ms', async () => 'result', { table: 'oportunidades' })
      const sample = Observability.metrics.samples().find(
        (s) => s.name === 'db_query_ms' && s.labels['status'] === 'ok',
      )
      expect(sample).toBeDefined()
    })

    test('registra erro e relança exceção', async () => {
      await expect(
        Observability.measureDuration('db_query_ms', async () => { throw new Error('timeout') }),
      ).rejects.toThrow('timeout')
      const errSample = Observability.metrics.samples().find(
        (s) => s.name === 'db_query_ms' && s.labels['status'] === 'error',
      )
      expect(errSample).toBeDefined()
    })
  })
})
