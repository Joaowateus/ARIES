/**
 * CORE-05 — Identity Layer
 * Abstração de identidade e propagação de contexto via AsyncLocalStorage.
 * Toda ação no SOE conhece quem está executando — automaticamente.
 */

import { AsyncLocalStorage } from 'async_hooks'

/** Hierarquia de decisão conforme ADR-0011 / ENG-11 */
export type DecisionLevel = 'D0' | 'D1' | 'D2' | 'D3' | 'D4'

export interface UserContext {
  userId: string
  name: string
  /** Cargo dentro da organização (ex: "Gerente Comercial") */
  role: string
  /** Nível máximo de decisão autorizado */
  decisionLevel: DecisionLevel
  /** Lista de permissões granulares (ex: ['cap03:write', 'eng11:escalate']) */
  permissions: string[]
  /** ID do tenant para preparação multi-tenant */
  tenantId: string
  /** Metadados adicionais de contexto */
  context: Record<string, unknown>
}

/** Contexto de execução que flui por toda a call chain */
export interface ExecutionContext {
  user?: UserContext
  correlationId: string
  requestId?: string
  traceId?: string
}

export interface IIdentityLayer {
  /** Retorna o usuário atual (undefined se não autenticado) */
  currentUser(): UserContext | undefined
  /** Retorna o usuário atual — lança se não autenticado */
  requireUser(): UserContext
  /** Retorna o contexto de execução completo */
  executionContext(): ExecutionContext | undefined
  /** Retorna o correlation ID da execução atual */
  correlationId(): string | undefined
  /** Verifica se o usuário tem uma permissão específica */
  hasPermission(permission: string): boolean
  /** Verifica se o usuário pode tomar decisão no nível indicado */
  canDecide(level: DecisionLevel): boolean
  /** Executa função dentro de um contexto de identidade (para testes e middlewares) */
  runAs<T>(ctx: ExecutionContext, fn: () => T | Promise<T>): Promise<T>
  /** Cria um contexto de sistema (ações automáticas sem usuário humano) */
  systemContext(correlationId: string, component: string): ExecutionContext
}

const DECISION_HIERARCHY: Record<DecisionLevel, number> = {
  D0: 0, D1: 1, D2: 2, D3: 3, D4: 4,
}

const storage = new AsyncLocalStorage<ExecutionContext>()

class IdentityLayerImpl implements IIdentityLayer {
  currentUser(): UserContext | undefined {
    return storage.getStore()?.user
  }

  requireUser(): UserContext {
    const user = this.currentUser()
    if (!user) {
      throw new Error('IDENTITY-001: No authenticated user in execution context. Use Identity.runAs() to set context.')
    }
    return user
  }

  executionContext(): ExecutionContext | undefined {
    return storage.getStore()
  }

  correlationId(): string | undefined {
    return storage.getStore()?.correlationId
  }

  hasPermission(permission: string): boolean {
    const user = this.currentUser()
    if (!user) return false
    return user.permissions.includes(permission) || user.permissions.includes('*')
  }

  canDecide(level: DecisionLevel): boolean {
    const user = this.currentUser()
    if (!user) return false
    return DECISION_HIERARCHY[user.decisionLevel] >= DECISION_HIERARCHY[level]
  }

  async runAs<T>(ctx: ExecutionContext, fn: () => T | Promise<T>): Promise<T> {
    return storage.run(ctx, async () => {
      return await fn()
    })
  }

  systemContext(correlationId: string, component: string): ExecutionContext {
    return {
      correlationId,
      user: {
        userId: `system:${component}`,
        name: `System/${component}`,
        role: 'SYSTEM',
        decisionLevel: 'D0',
        permissions: [],
        tenantId: 'system',
        context: { component, automated: true },
      },
    }
  }
}

/** Singleton global */
export const Identity: IIdentityLayer = new IdentityLayerImpl()

/** Usuário especial para contexto de sistema (ações automatizadas) */
export function systemUser(component: string): UserContext {
  return {
    userId: `system:${component}`,
    name: `System/${component}`,
    role: 'SYSTEM',
    decisionLevel: 'D0',
    permissions: [],
    tenantId: 'system',
    context: { component, automated: true },
  }
}
