/**
 * CORE-09 — Health Engine
 * Centraliza health checks de todos os componentes do SOE.
 * Calcula o ISA (Índice de Saúde Arquitetural) conforme ENG-12.
 * Endpoint /health responde com o estado agregado.
 */

import { Time } from '@soe/core-time'
import { createLogger } from '@soe/core-logger'
import { Config } from '@soe/core-config'

const log = createLogger({ component: 'core-health', engine: 'core-09' })

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'

export interface ComponentHealth {
  component: string
  version: string
  status: HealthStatus
  latencyMs?: number
  /** Dependências diretas e seus estados */
  dependencies: DependencyHealth[]
  lastHeartbeat: string
  /** Estado operacional descritivo (ex: 'Processando 42 eventos/s') */
  operationalState: string
  metadata?: Record<string, unknown>
}

export interface DependencyHealth {
  name: string
  status: HealthStatus
  latencyMs?: number
  error?: string
}

export type HealthChecker = () => Promise<ComponentHealth>

export interface HealthCheckResult {
  status: HealthStatus
  /** ISA — Índice de Saúde Arquitetural: (saudáveis / total) × 100 */
  isa: number
  components: ComponentHealth[]
  checkedAt: string
  totalComponents: number
  healthyComponents: number
}

export interface IHealthEngine {
  /** Registra um componente para monitoramento */
  register(componentId: string, checker: HealthChecker): void
  /** Remove registro de um componente */
  unregister(componentId: string): void
  /** Executa health check de um componente específico */
  checkOne(componentId: string): Promise<ComponentHealth>
  /** Executa health check de todos os componentes registrados */
  checkAll(): Promise<HealthCheckResult>
  /** Retorna o ISA atual (cached do último checkAll()) */
  currentISA(): number
  /** Lista de componentes registrados */
  registeredComponents(): string[]
}

class HealthEngineImpl implements IHealthEngine {
  private readonly checkers = new Map<string, HealthChecker>()
  private lastISA = 100

  register(componentId: string, checker: HealthChecker): void {
    this.checkers.set(componentId, checker)
    log.debug(`Health checker registered: ${componentId}`)
  }

  unregister(componentId: string): void {
    this.checkers.delete(componentId)
  }

  async checkOne(componentId: string): Promise<ComponentHealth> {
    const checker = this.checkers.get(componentId)
    if (!checker) {
      return {
        component: componentId,
        version: 'unknown',
        status: 'UNHEALTHY',
        dependencies: [],
        lastHeartbeat: Time.nowISO(),
        operationalState: 'Not registered',
      }
    }

    const start = Time.nowMs()
    try {
      const result = await checker()
      return { ...result, latencyMs: Time.nowMs() - start }
    } catch (err) {
      return {
        component: componentId,
        version: 'unknown',
        status: 'UNHEALTHY',
        latencyMs: Time.nowMs() - start,
        dependencies: [],
        lastHeartbeat: Time.nowISO(),
        operationalState: `Check failed: ${String(err)}`,
      }
    }
  }

  async checkAll(): Promise<HealthCheckResult> {
    const componentIds = [...this.checkers.keys()]
    const results = await Promise.all(componentIds.map((id) => this.checkOne(id)))

    const healthy = results.filter((r) => r.status === 'HEALTHY').length
    const isa = componentIds.length === 0 ? 100 : (healthy / componentIds.length) * 100
    this.lastISA = isa

    const overallStatus = this.resolveStatus(isa)

    const isaTarget = Config.mup().isaTarget
    if (isa < isaTarget) {
      log.warn(`ISA below target: ${isa.toFixed(1)}% (target: ${isaTarget}%)`)
    }

    return {
      status: overallStatus,
      isa,
      components: results,
      checkedAt: Time.nowISO(),
      totalComponents: componentIds.length,
      healthyComponents: healthy,
    }
  }

  currentISA(): number {
    return this.lastISA
  }

  registeredComponents(): string[] {
    return [...this.checkers.keys()]
  }

  private resolveStatus(isa: number): HealthStatus {
    // Limites conforme PARAM-HEALTH-SCORE-LIMIARES no ENG-12
    if (isa >= 97) return 'HEALTHY'
    if (isa >= 90) return 'DEGRADED'
    return 'UNHEALTHY'
  }
}

/** Singleton global */
export const Health: IHealthEngine = new HealthEngineImpl()

/** Helper para criar um checker simples */
export function simpleChecker(
  component: string,
  version: string,
  check: () => Promise<void>,
  dependencies: DependencyHealth[] = [],
): HealthChecker {
  return async () => {
    const start = Date.now()
    try {
      await check()
      return {
        component,
        version,
        status: 'HEALTHY',
        latencyMs: Date.now() - start,
        dependencies,
        lastHeartbeat: Time.nowISO(),
        operationalState: 'Operational',
      }
    } catch (err) {
      return {
        component,
        version,
        status: 'UNHEALTHY',
        latencyMs: Date.now() - start,
        dependencies,
        lastHeartbeat: Time.nowISO(),
        operationalState: `Error: ${String(err)}`,
      }
    }
  }
}
