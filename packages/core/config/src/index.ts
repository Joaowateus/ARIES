/**
 * CORE-01 — Configuration Engine
 * Centraliza toda configuração. Zero constantes hardcoded fora deste módulo.
 * Fonte primária: variáveis de ambiente. Suporte a overrides programáticos (testes).
 */

import { z } from 'zod'

export type Environment = 'development' | 'staging' | 'production' | 'test'

export interface MUPWeights {
  impacto: number       // I — peso do impacto no negócio
  urgencia: number      // U — peso da urgência operacional
  frequencia: number    // F — peso da frequência de ocorrência
  tendencia: number     // T — peso da tendência (piora/melhora)
  reversibilidade: number // R — peso da reversibilidade
}

export const MUP_MODES = {
  padrao: { impacto: 0.30, urgencia: 0.25, frequencia: 0.20, tendencia: 0.15, reversibilidade: 0.10 },
  crise_financeira: { impacto: 0.40, urgencia: 0.25, frequencia: 0.15, tendencia: 0.10, reversibilidade: 0.10 },
  crescimento_acelerado: { impacto: 0.30, urgencia: 0.20, frequencia: 0.25, tendencia: 0.20, reversibilidade: 0.05 },
  auditoria_intensiva: { impacto: 0.25, urgencia: 0.20, frequencia: 0.20, tendencia: 0.15, reversibilidade: 0.20 },
} as const satisfies Record<string, MUPWeights>

export type MUPMode = keyof typeof MUP_MODES

export interface ConfigNamespace {
  /** Ambiente de execução */
  environment: Environment
  /** Feature flags — habilitam/desabilitam funcionalidades sem deploy */
  featureFlags: Record<string, boolean>
  /** Parâmetros sistêmicos globais da plataforma */
  systemic: Record<string, unknown>
  /** Parâmetros por engine (keyed por engine ID: 'eng-01', 'eng-11', etc.) */
  engines: Record<string, Record<string, unknown>>
  /** Parâmetros por módulo CAP (keyed por CAP ID: 'cap-01', etc.) */
  caps: Record<string, Record<string, unknown>>
  /** Parâmetros do Scheduler */
  scheduler: Record<string, unknown>
  /** Configuração da MUP (Matriz Universal de Priorização) */
  mup: { mode: MUPMode; weights: MUPWeights; isaTarget: number }
  /** Parâmetros do FOB (Framework Operacional Universal) */
  fob: Record<string, unknown>
}

export interface IConfigEngine {
  /** Ambiente atual */
  env(): Environment
  /** Verifica ambiente */
  is(env: Environment): boolean
  /** Lê variável de ambiente (retorna undefined se ausente) */
  get<T = string>(key: string): T | undefined
  /** Lê variável de ambiente — lança se ausente */
  require<T = string>(key: string): T
  /** Lê variável de ambiente com fallback */
  getOr<T = string>(key: string, defaultValue: T): T
  /** Feature flag — false se não definida */
  flag(name: string): boolean
  /** Parâmetros de uma engine específica */
  forEngine<T = Record<string, unknown>>(engineId: string): T
  /** Parâmetros de um módulo CAP específico */
  forCap<T = Record<string, unknown>>(capId: string): T
  /** Configuração MUP atual */
  mup(): ConfigNamespace['mup']
  /** Parâmetros do Scheduler */
  scheduler(): Record<string, unknown>
  /** Parâmetros do FOB */
  fob(): Record<string, unknown>
  /** Valida um valor usando schema Zod — lança ConfigError se inválido */
  validate<T>(value: unknown, schema: z.ZodType<T>): T
  /** Para testes: sobrescreve uma chave */
  override(key: string, value: unknown): void
  /** Para testes: remove todos os overrides */
  clearOverrides(): void
}

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly key: string,
  ) {
    super(message)
    this.name = 'ConfigError'
  }
}

class ConfigEngineImpl implements IConfigEngine {
  private overrides: Map<string, unknown> = new Map()

  private raw(key: string): string | undefined {
    if (this.overrides.has(key)) return String(this.overrides.get(key))
    return process.env[key]
  }

  env(): Environment {
    const val = this.raw('SOE_ENV') ?? this.raw('NODE_ENV') ?? 'development'
    const valid: Environment[] = ['development', 'staging', 'production', 'test']
    return valid.includes(val as Environment) ? (val as Environment) : 'development'
  }

  is(env: Environment): boolean {
    return this.env() === env
  }

  get<T = string>(key: string): T | undefined {
    const val = this.raw(key)
    return val !== undefined ? (val as unknown as T) : undefined
  }

  require<T = string>(key: string): T {
    const val = this.raw(key)
    if (val === undefined || val === '') {
      throw new ConfigError(`Required config key "${key}" is not set`, key)
    }
    return val as unknown as T
  }

  getOr<T = string>(key: string, defaultValue: T): T {
    const val = this.raw(key)
    return val !== undefined ? (val as unknown as T) : defaultValue
  }

  flag(name: string): boolean {
    const val = this.raw(`SOE_FLAG_${name.toUpperCase()}`) ?? this.raw(name)
    if (val === undefined) return false
    return val === 'true' || val === '1' || val === 'yes'
  }

  forEngine<T = Record<string, unknown>>(engineId: string): T {
    const prefix = `SOE_ENGINE_${engineId.toUpperCase().replace(/-/g, '_')}_`
    return this.extractNamespace<T>(prefix)
  }

  forCap<T = Record<string, unknown>>(capId: string): T {
    const prefix = `SOE_CAP_${capId.toUpperCase().replace(/-/g, '_')}_`
    return this.extractNamespace<T>(prefix)
  }

  mup(): ConfigNamespace['mup'] {
    const mode = (this.raw('SOE_MUP_MODE') ?? 'padrao') as MUPMode
    const weights = MUP_MODES[mode] ?? MUP_MODES.padrao
    const isaTarget = Number(this.raw('SOE_ISA_TARGET') ?? '97')
    return { mode, weights, isaTarget }
  }

  scheduler(): Record<string, unknown> {
    return this.extractNamespace('SOE_SCHEDULER_')
  }

  fob(): Record<string, unknown> {
    return this.extractNamespace('SOE_FOB_')
  }

  validate<T>(value: unknown, schema: z.ZodType<T>): T {
    const result = schema.safeParse(value)
    if (!result.success) {
      throw new ConfigError(
        `Config validation failed: ${result.error.message}`,
        'schema_validation',
      )
    }
    return result.data
  }

  override(key: string, value: unknown): void {
    this.overrides.set(key, value)
  }

  clearOverrides(): void {
    this.overrides.clear()
  }

  private extractNamespace<T>(prefix: string): T {
    const result: Record<string, unknown> = {}
    // First pass: env vars
    for (const [k, v] of Object.entries(process.env)) {
      if (k.startsWith(prefix) && v !== undefined) {
        const shortKey = k.slice(prefix.length).toLowerCase()
        result[shortKey] = v
      }
    }
    // Second pass: overrides (take precedence)
    for (const [k, v] of this.overrides.entries()) {
      if (k.startsWith(prefix)) {
        const shortKey = k.slice(prefix.length).toLowerCase()
        result[shortKey] = v
      }
    }
    return result as T
  }
}

/** Singleton global — importe e use diretamente */
export const Config: IConfigEngine = new ConfigEngineImpl()

/** Para testes que precisam de instância isolada */
export function createConfigEngine(): IConfigEngine {
  return new ConfigEngineImpl()
}
