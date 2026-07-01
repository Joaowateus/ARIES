import { z } from 'zod'
import { Validation, SOEValidationError, CommonSchemas, type ValidationRule } from '../src/index'

describe('CORE-08 Validation Framework', () => {
  describe('schema()', () => {
    const PersonSchema = z.object({ name: z.string().min(2), age: z.number().min(0) })
    const validator = Validation.schema(PersonSchema)

    test('validate() retorna valid=true para dado correto', () => {
      const result = validator.validate({ name: 'Ana', age: 30 })
      expect(result.valid).toBe(true)
      expect(result.data).toEqual({ name: 'Ana', age: 30 })
      expect(result.errors).toHaveLength(0)
    })

    test('validate() retorna erros com caminhos de campo', () => {
      const result = validator.validate({ name: 'A', age: -1 })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
      expect(result.errors.some((e) => e.field === 'name')).toBe(true)
      expect(result.errors.some((e) => e.field === 'age')).toBe(true)
    })

    test('parse() retorna dado válido', () => {
      expect(validator.parse({ name: 'Ana', age: 30 })).toEqual({ name: 'Ana', age: 30 })
    })

    test('parse() lança SOEValidationError para dado inválido', () => {
      expect(() => validator.parse({ name: 'A', age: -1 })).toThrow(SOEValidationError)
    })
  })

  describe('rules()', () => {
    interface Order { value: number; discount: number }

    const discountRule: ValidationRule<Order> = (o) => {
      if (o.discount > o.value * 0.5) {
        return { field: 'discount', message: 'Desconto não pode ser maior que 50% do valor', code: 'DISCOUNT_LIMIT' }
      }
      return null
    }

    const positiveValueRule: ValidationRule<Order> = (o) => {
      if (o.value <= 0) return { field: 'value', message: 'Valor deve ser positivo' }
      return null
    }

    const validator = Validation.rules([discountRule, positiveValueRule])

    test('retorna válido quando todas as regras passam', () => {
      expect(validator.validate({ value: 100, discount: 40 }).valid).toBe(true)
    })

    test('retorna erros quando regra falha', () => {
      const result = validator.validate({ value: 100, discount: 60 })
      expect(result.valid).toBe(false)
      expect(result.errors[0]?.field).toBe('discount')
    })
  })

  describe('compose()', () => {
    test('combina schema e regras customizadas', () => {
      const schema = Validation.schema(z.object({ cpf: z.string().length(11) }))
      const rule = Validation.rules<{ cpf: string }>([
        (v) => /^\d+$/.test(v.cpf) ? null : { field: 'cpf', message: 'CPF deve conter apenas dígitos' },
      ])
      const composed = Validation.compose(schema, rule)

      expect(composed.validate({ cpf: '12345678901' }).valid).toBe(true)
      expect(composed.validate({ cpf: '123456789AB' }).valid).toBe(false)
      expect(composed.validate({ cpf: '123' }).valid).toBe(false)
    })
  })

  describe('CommonSchemas', () => {
    test('uuid valida formato correto', () => {
      expect(CommonSchemas.uuid.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true)
      expect(CommonSchemas.uuid.safeParse('nao-uuid').success).toBe(false)
    })

    test('semver valida formato correto', () => {
      expect(CommonSchemas.semver.safeParse('1.0.0').success).toBe(true)
      expect(CommonSchemas.semver.safeParse('1.0.0-beta.1').success).toBe(true)
      expect(CommonSchemas.semver.safeParse('1.0').success).toBe(false)
    })

    test('eventType valida formato dominio.acao', () => {
      expect(CommonSchemas.eventType.safeParse('oportunidade.ganha').success).toBe(true)
      expect(CommonSchemas.eventType.safeParse('invalido').success).toBe(false)
    })
  })
})
