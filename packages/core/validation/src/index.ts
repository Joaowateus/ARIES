/**
 * CORE-08 — Validation Framework
 * Centraliza todas as validações. Nenhuma validação espalhada em módulos.
 * Suporta: schema (Zod), regras de domínio, cross-field e business validation.
 */

import { z } from 'zod'

export { z }

export interface FieldError {
  field: string
  message: string
  code?: string
}

export interface ValidationResult<T = unknown> {
  valid: boolean
  data?: T
  errors: FieldError[]
}

export type ValidationRule<T> = (value: T) => FieldError | FieldError[] | null | undefined

export interface IValidator<T> {
  validate(value: unknown): ValidationResult<T>
  /** Valida e retorna o dado ou lança ValidationError */
  parse(value: unknown): T
  /** Compõe este validator com outro (AND — ambos devem passar) */
  and(other: IValidator<T>): IValidator<T>
}

/** Erro de validação lançado por Validator.parse() */
export class SOEValidationError extends Error {
  constructor(
    public readonly errors: FieldError[],
    public readonly code = 'VALIDATION-001',
  ) {
    super(`Validation failed: ${errors.map((e) => `${e.field}: ${e.message}`).join('; ')}`)
    this.name = 'SOEValidationError'
  }
}

class ZodValidator<T> implements IValidator<T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  validate(value: unknown): ValidationResult<T> {
    const result = this.schema.safeParse(value)
    if (result.success) {
      return { valid: true, data: result.data, errors: [] }
    }
    const errors: FieldError[] = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '_root',
      message: issue.message,
      code: issue.code,
    }))
    return { valid: false, errors }
  }

  parse(value: unknown): T {
    const result = this.validate(value)
    if (!result.valid) throw new SOEValidationError(result.errors)
    return result.data as T
  }

  and(other: IValidator<T>): IValidator<T> {
    return new ComposedValidator([this, other])
  }
}

class RulesValidator<T> implements IValidator<T> {
  constructor(private readonly rules: ValidationRule<T>[]) {}

  validate(value: unknown): ValidationResult<T> {
    const errors: FieldError[] = []
    for (const rule of this.rules) {
      const result = rule(value as T)
      if (result === null || result === undefined) continue
      if (Array.isArray(result)) errors.push(...result)
      else errors.push(result)
    }
    return { valid: errors.length === 0, data: errors.length === 0 ? (value as T) : undefined, errors }
  }

  parse(value: unknown): T {
    const result = this.validate(value)
    if (!result.valid) throw new SOEValidationError(result.errors)
    return result.data as T
  }

  and(other: IValidator<T>): IValidator<T> {
    return new ComposedValidator([this, other])
  }
}

class ComposedValidator<T> implements IValidator<T> {
  constructor(private readonly validators: IValidator<T>[]) {}

  validate(value: unknown): ValidationResult<T> {
    const allErrors: FieldError[] = []
    let lastData: T | undefined

    for (const validator of this.validators) {
      const result = validator.validate(value)
      allErrors.push(...result.errors)
      if (result.data !== undefined) lastData = result.data
    }

    return {
      valid: allErrors.length === 0,
      data: allErrors.length === 0 ? lastData : undefined,
      errors: allErrors,
    }
  }

  parse(value: unknown): T {
    const result = this.validate(value)
    if (!result.valid) throw new SOEValidationError(result.errors)
    return result.data as T
  }

  and(other: IValidator<T>): IValidator<T> {
    return new ComposedValidator([...this.validators, other])
  }
}

export interface IValidationFramework {
  /** Validador baseado em schema Zod */
  schema<T>(schema: z.ZodType<T>): IValidator<T>
  /** Validador baseado em regras de domínio */
  rules<T>(rules: ValidationRule<T>[]): IValidator<T>
  /** Combina múltiplos validadores (todos devem passar) */
  compose<T>(...validators: IValidator<T>[]): IValidator<T>
}

class ValidationFrameworkImpl implements IValidationFramework {
  schema<T>(schema: z.ZodType<T>): IValidator<T> {
    return new ZodValidator(schema)
  }

  rules<T>(rules: ValidationRule<T>[]): IValidator<T> {
    return new RulesValidator(rules)
  }

  compose<T>(...validators: IValidator<T>[]): IValidator<T> {
    return new ComposedValidator(validators)
  }
}

/** Singleton global */
export const Validation: IValidationFramework = new ValidationFrameworkImpl()

// ── Schemas utilitários reutilizáveis ──────────────────────────────────────

export const CommonSchemas = {
  /** UUID v4 */
  uuid: z.string().uuid(),
  /** ISO 8601 datetime string */
  isoDatetime: z.string().datetime({ offset: true }),
  /** Versão SemVer */
  semver: z.string().regex(/^\d+\.\d+\.\d+(-[\w.]+)?$/, 'Deve ser SemVer (ex: 1.2.3)'),
  /** Código de correlação */
  correlationId: z.string().min(1).max(128),
  /** Tipo de evento CUE (ex: 'oportunidade.ganha') */
  eventType: z.string().regex(/^[\w-]+\.[\w_.-]+$/, 'Formato: dominio.acao'),
  /** Nível de decisão */
  decisionLevel: z.enum(['D0', 'D1', 'D2', 'D3', 'D4']),
  /** Paginação */
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
  }),
} as const
