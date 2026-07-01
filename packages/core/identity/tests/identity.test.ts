import { Identity, systemUser, type UserContext } from '../src/index'

const managerUser: UserContext = {
  userId: 'usr-001',
  name: 'Ana Silva',
  role: 'Gerente Comercial',
  decisionLevel: 'D2',
  permissions: ['cap03:write', 'cap04:read', 'eng11:escalate'],
  tenantId: 'tenant-abc',
  context: {},
}

describe('CORE-05 Identity Layer', () => {
  test('currentUser() retorna undefined fora de contexto', () => {
    expect(Identity.currentUser()).toBeUndefined()
  })

  test('requireUser() lança fora de contexto', () => {
    expect(() => Identity.requireUser()).toThrow('IDENTITY-001')
  })

  test('runAs() propaga usuário para o contexto de execução', async () => {
    const ctx = { correlationId: 'corr-001', user: managerUser }
    const result = await Identity.runAs(ctx, () => Identity.currentUser())
    expect(result?.userId).toBe('usr-001')
  })

  test('correlationId() retorna o ID do contexto', async () => {
    const ctx = { correlationId: 'corr-xyz', user: managerUser }
    const id = await Identity.runAs(ctx, () => Identity.correlationId())
    expect(id).toBe('corr-xyz')
  })

  test('hasPermission() verifica permissões existentes', async () => {
    const ctx = { correlationId: 'corr-001', user: managerUser }
    await Identity.runAs(ctx, async () => {
      expect(Identity.hasPermission('cap03:write')).toBe(true)
      expect(Identity.hasPermission('cap03:admin')).toBe(false)
    })
  })

  test('canDecide() respeita hierarquia D0-D4', async () => {
    const ctx = { correlationId: 'corr-001', user: managerUser } // D2
    await Identity.runAs(ctx, async () => {
      expect(Identity.canDecide('D0')).toBe(true)
      expect(Identity.canDecide('D1')).toBe(true)
      expect(Identity.canDecide('D2')).toBe(true)
      expect(Identity.canDecide('D3')).toBe(false)
      expect(Identity.canDecide('D4')).toBe(false)
    })
  })

  test('systemUser() cria contexto automático sem permissões de negócio', () => {
    const sys = systemUser('eng-11')
    expect(sys.userId).toBe('system:eng-11')
    expect(sys.decisionLevel).toBe('D0')
    expect(sys.context['automated']).toBe(true)
  })

  test('runAs() isola contextos aninhados', async () => {
    const outer = { correlationId: 'outer', user: managerUser }
    const inner = {
      correlationId: 'inner',
      user: { ...managerUser, userId: 'usr-002' },
    }

    const outerResult = await Identity.runAs(outer, async () => {
      const innerResult = await Identity.runAs(inner, () => Identity.currentUser()?.userId)
      const outerUserId = Identity.currentUser()?.userId
      return { outerUserId, innerResult }
    })

    expect(outerResult.outerUserId).toBe('usr-001')
    expect(outerResult.innerResult).toBe('usr-002')
  })

  test('contexto não vaza entre execuções paralelas', async () => {
    const ctxA = { correlationId: 'A', user: { ...managerUser, userId: 'A' } }
    const ctxB = { correlationId: 'B', user: { ...managerUser, userId: 'B' } }

    const [a, b] = await Promise.all([
      Identity.runAs(ctxA, async () => {
        await new Promise((r) => setTimeout(r, 5))
        return Identity.currentUser()?.userId
      }),
      Identity.runAs(ctxB, async () => {
        await new Promise((r) => setTimeout(r, 5))
        return Identity.currentUser()?.userId
      }),
    ])

    expect(a).toBe('A')
    expect(b).toBe('B')
  })
})
