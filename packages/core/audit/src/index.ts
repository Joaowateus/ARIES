/**
 * CORE-06 — Audit Engine
 * Toda alteração persistida gera auditoria automática (append-only, conforme ADR-0013).
 * Registro nunca é modificado — correções são novos registros que referenciam o original.
 */

import { v4 as uuidv4 } from 'uuid'
import { Time } from '@soe/core-time'
import { Identity } from '@soe/core-identity'
import { EventPublisher } from '@soe/core-events'
import { createLogger } from '@soe/core-logger'

const log = createLogger({ component: 'core-audit', engine: 'core-06' })

export type AuditAction =
  | 'CREATE'       // Entidade criada
  | 'UPDATE'       // Campo(s) alterado(s)
  | 'DELETE'       // Entidade removida (soft ou hard)
  | 'STATE_CHANGE' // Transição de estado/etapa
  | 'CORRECTION'   // Correção de registro anterior (referencia audit_id_original)

export interface AuditEntry {
  audit_id: string
  entity_type: string              // ex: 'oportunidade', 'processo', 'decisao'
  entity_id: string
  action: AuditAction
  before?: Record<string, unknown> // Estado antes (undefined para CREATE)
  after?: Record<string, unknown>  // Estado depois (undefined para DELETE)
  changed_by: string               // userId ou 'system:<component>'
  changed_at: string               // UTC ISO — imutável após criação
  reason?: string                  // Justificativa (obrigatória para CORRECTION)
  origin: string                   // Componente que originou a alteração
  correlacao_id?: string
  related_event_id?: string        // event_id do evento CUE relacionado
  related_rfc?: string             // ID do RFC quando alteração é arquitetural
  /** Referência ao registro corrigido (somente para action=CORRECTION) */
  corrects_audit_id?: string
}

export type AuditEntryInput = Omit<AuditEntry, 'audit_id' | 'changed_by' | 'changed_at' | 'correlacao_id'>

/** Interface de persistência — plugável (in-memory para testes, Postgres em produção) */
export interface IAuditStore {
  save(entry: AuditEntry): Promise<void>
  findByEntity(entityType: string, entityId: string): Promise<AuditEntry[]>
}

export interface IAuditEngine {
  record(input: AuditEntryInput): Promise<AuditEntry>
  /**
   * Executa operação com auditoria automática de before/after.
   * Captura o estado antes, executa fn(), captura o estado depois, registra.
   */
  wrap<T>(
    context: { entityType: string; entityId: string; action: AuditAction; origin: string; reason?: string },
    getState: () => Promise<Record<string, unknown> | undefined>,
    fn: () => Promise<T>,
  ): Promise<T>
  findByEntity(entityType: string, entityId: string): Promise<AuditEntry[]>
}

// ── In-memory store (padrão para dev/testes) ──────────────────────────────

export class InMemoryAuditStore implements IAuditStore {
  private readonly store: AuditEntry[] = []

  async save(entry: AuditEntry): Promise<void> {
    this.store.push(entry)
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditEntry[]> {
    return this.store.filter((e) => e.entity_type === entityType && e.entity_id === entityId)
  }

  all(): AuditEntry[] { return [...this.store] }
  clear(): void { this.store.length = 0 }
}

// ── Implementação ──────────────────────────────────────────────────────────

class AuditEngineImpl implements IAuditEngine {
  constructor(private readonly store: IAuditStore) {}

  async record(input: AuditEntryInput): Promise<AuditEntry> {
    if (input.action === 'CORRECTION' && !input.corrects_audit_id) {
      throw new Error('AUDIT-001: CORRECTION action requires corrects_audit_id')
    }
    if (input.action === 'CORRECTION' && !input.reason) {
      throw new Error('AUDIT-002: CORRECTION action requires reason')
    }

    const user = Identity.currentUser()
    const entry: AuditEntry = {
      ...input,
      audit_id: uuidv4(),
      changed_by: user?.userId ?? `system:${input.origin}`,
      changed_at: Time.nowISO(),
      correlacao_id: Identity.correlationId(),
    }

    await this.store.save(entry)

    log.debug(`Audit recorded: ${entry.action} on ${entry.entity_type}/${entry.entity_id}`, {
      audit_id: entry.audit_id,
    })

    // Publica evento de auditoria para ENG-06 (rastreabilidade via barramento)
    try {
      await EventPublisher.publish({
        event_type: 'auditoria.registro_criado',
        schema_version: '1.0.0',
        correlacao_id: entry.correlacao_id ?? entry.audit_id,
        producer: 'core-audit',
        payload: {
          audit_id: entry.audit_id,
          entity_type: entry.entity_type,
          entity_id: entry.entity_id,
          action: entry.action,
          changed_by: entry.changed_by,
          changed_at: entry.changed_at,
        },
      })
    } catch (err) {
      // Falha na publicação não deve bloquear a auditoria — o registro já foi salvo
      log.warn('Failed to publish audit event — record was saved', {
        audit_id: entry.audit_id,
        error: String(err),
      })
    }

    return entry
  }

  async wrap<T>(
    context: { entityType: string; entityId: string; action: AuditAction; origin: string; reason?: string },
    getState: () => Promise<Record<string, unknown> | undefined>,
    fn: () => Promise<T>,
  ): Promise<T> {
    const before = await getState()
    const result = await fn()
    const after = await getState()

    await this.record({
      entity_type: context.entityType,
      entity_id: context.entityId,
      action: context.action,
      before,
      after,
      origin: context.origin,
      reason: context.reason,
    })

    return result
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditEntry[]> {
    return this.store.findByEntity(entityType, entityId)
  }
}

export const DefaultAuditStore = new InMemoryAuditStore()

/** Singleton global — store substituído por Postgres no bootstrap de produção */
export const Audit: IAuditEngine = new AuditEngineImpl(DefaultAuditStore)

export function createAuditEngine(store: IAuditStore): IAuditEngine {
  return new AuditEngineImpl(store)
}
