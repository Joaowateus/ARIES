import {
  BusinessError,
  ValidationError,
  InfrastructureError,
  SecurityError,
  GovernanceError,
  UnexpectedError,
  isSOEError,
  toSOEError,
} from '../src/index'

describe('CORE-03 Error Engine', () => {
  test('BusinessError tem categoria BUSINESS e severidade MEDIUM padrão', () => {
    const err = new BusinessError('CAP03-001', 'tech msg', 'friendly msg', 'action')
    expect(err.category).toBe('BUSINESS')
    expect(err.severity).toBe('MEDIUM')
    expect(err.code).toBe('CAP03-001')
    expect(isSOEError(err)).toBe(true)
  })

  test('ValidationError carrega campos inválidos', () => {
    const err = new ValidationError('CAP03-002', 'invalid', 'friendly', {
      email: ['formato inválido'],
    })
    expect(err.category).toBe('VALIDATION')
    expect(err.fields.email).toContain('formato inválido')
    expect(err.severity).toBe('LOW')
  })

  test('InfrastructureError não expõe detalhes ao usuário', () => {
    const err = new InfrastructureError('SYS-DB-001', 'Connection timeout to postgres:5432')
    expect(err.friendlyMessage).toMatch(/equipe foi notificada/)
    expect(err.severity).toBe('HIGH')
  })

  test('SecurityError tem severidade HIGH por padrão', () => {
    const err = new SecurityError('SEC-001', 'Unauthorized', 'Acesso negado')
    expect(err.category).toBe('SECURITY')
    expect(err.severity).toBe('HIGH')
  })

  test('GovernanceError tem severidade CRITICAL por padrão', () => {
    const err = new GovernanceError('GOV-001', 'RFC obrigatório', 'Bloqueado', 'Abrir RFC')
    expect(err.category).toBe('GOVERNANCE')
    expect(err.severity).toBe('CRITICAL')
  })

  test('UnexpectedError encapsula erro original', () => {
    const original = new Error('explosão inesperada')
    const err = new UnexpectedError(original)
    expect(err.originalError).toBe(original)
    expect(err.category).toBe('UNEXPECTED')
    expect(err.severity).toBe('CRITICAL')
  })

  test('UnexpectedError encapsula string como erro', () => {
    const err = new UnexpectedError('string de erro')
    expect(err.originalError?.message).toBe('string de erro')
  })

  test('toSOEError retorna SOEError existente sem encapsular', () => {
    const original = new BusinessError('CAP-001', 'tech', 'friendly', 'action')
    expect(toSOEError(original)).toBe(original)
  })

  test('toSOEError converte erro desconhecido em UnexpectedError', () => {
    const result = toSOEError(new Error('boom'))
    expect(result).toBeInstanceOf(UnexpectedError)
  })

  test('isSOEError retorna false para erro nativo', () => {
    expect(isSOEError(new Error('nativo'))).toBe(false)
  })

  test('toJSON() inclui todos os campos necessários', () => {
    const err = new BusinessError('CAP-001', 'tech', 'friendly', 'action', {
      publishedEvent: 'sistema.erro_detectado',
    })
    const json = err.toJSON()
    expect(json.code).toBe('CAP-001')
    expect(json.category).toBe('BUSINESS')
    expect(json.publishedEvent).toBe('sistema.erro_detectado')
    expect(json.timestamp).toBeDefined()
  })
})
