/**
 * CORE-02 — Logging Engine
 * Sistema único de logs estruturados. Toda execução gera rastreabilidade completa.
 * Nenhum console.log direto — sempre via Logger.
 */

import { Time } from '@soe/core-time'
import { Identity } from '@soe/core-identity'

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, CRITICAL: 4,
}

export interface LogEntry {
  timestamp: string       // UTC ISO 8601
  level: LogLevel
  message: string
  correlationId?: string
  requestId?: string
  traceId?: string
  engine?: string         // ENG-XX que gerou o log
  cap?: string            // CAP-XX que gerou o log
  event?: string          // Tipo do evento CUE relacionado
  userId?: string
  tenantId?: string
  origin?: string         // Componente de origem
  destination?: string    // Componente de destino
  payload?: Record<string, unknown>
  errorCode?: string
  durationMs?: number
  component: string       // Obrigatório — quem emitiu o log
}

export interface LogContext {
  component: string
  engine?: string
  cap?: string
  requestId?: string
}

export interface ILogger {
  debug(message: string, payload?: Record<string, unknown>): void
  info(message: string, payload?: Record<string, unknown>): void
  warn(message: string, payload?: Record<string, unknown>): void
  error(message: string, payload?: Record<string, unknown>): void
  critical(message: string, payload?: Record<string, unknown>): void
  /** Cria logger filho com contexto adicional (não sobrescreve o pai) */
  child(ctx: Partial<LogContext>): ILogger
  /** Para testes: captura logs em memória */
  entries(): LogEntry[]
}

type LogSink = (entry: LogEntry) => void

function defaultSink(entry: LogEntry): void {
  // Produção: JSON estruturado para stdout (compatível com qualquer agregador)
  // Em test: silencioso por padrão (testes capturam via Logger.entries())
  if (process.env['NODE_ENV'] === 'test') return
  process.stdout.write(JSON.stringify(entry) + '\n')
}

class LoggerImpl implements ILogger {
  private readonly captured: LogEntry[] = []

  constructor(
    private readonly ctx: LogContext,
    private readonly minLevel: LogLevel = 'INFO',
    private readonly sink: LogSink = defaultSink,
  ) {}

  private emit(level: LogLevel, message: string, payload?: Record<string, unknown>): void {
    if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.minLevel]) return

    const execCtx = Identity.executionContext()
    const entry: LogEntry = {
      timestamp: Time.nowISO(),
      level,
      message,
      component: this.ctx.component,
      engine: this.ctx.engine,
      cap: this.ctx.cap,
      requestId: this.ctx.requestId ?? execCtx?.requestId,
      correlationId: execCtx?.correlationId,
      traceId: execCtx?.traceId,
      userId: execCtx?.user?.userId,
      tenantId: execCtx?.user?.tenantId,
      payload,
    }

    // Remove campos undefined para JSON limpo
    for (const key of Object.keys(entry) as (keyof LogEntry)[]) {
      if (entry[key] === undefined) delete entry[key]
    }

    this.captured.push(entry)
    this.sink(entry)
  }

  debug(message: string, payload?: Record<string, unknown>): void { this.emit('DEBUG', message, payload) }
  info(message: string, payload?: Record<string, unknown>): void { this.emit('INFO', message, payload) }
  warn(message: string, payload?: Record<string, unknown>): void { this.emit('WARN', message, payload) }
  error(message: string, payload?: Record<string, unknown>): void { this.emit('ERROR', message, payload) }
  critical(message: string, payload?: Record<string, unknown>): void { this.emit('CRITICAL', message, payload) }

  child(ctx: Partial<LogContext>): ILogger {
    return new LoggerImpl(
      { ...this.ctx, ...ctx },
      this.minLevel,
      (entry) => {
        this.captured.push(entry)
        this.sink(entry)
      },
    )
  }

  entries(): LogEntry[] {
    return [...this.captured]
  }
}

/** Fábrica — cada componente cria seu próprio Logger com seu nome */
export function createLogger(ctx: LogContext, options?: { minLevel?: LogLevel }): ILogger {
  const minLevel = options?.minLevel
    ?? (process.env['SOE_LOG_LEVEL'] as LogLevel | undefined)
    ?? (process.env['NODE_ENV'] === 'production' ? 'INFO' : 'DEBUG')
  return new LoggerImpl(ctx, minLevel)
}

/** Logger raiz para uso no próprio kernel */
export const KernelLogger = createLogger({ component: 'kernel' })
