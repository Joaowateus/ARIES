/**
 * CORE-03 — Error Engine
 * Todos os erros do SOE seguem esta hierarquia. Nenhum componente lança
 * erros genéricos — sempre uma subclasse SOEError com código e categoria.
 */

export type ErrorCategory =
  | 'BUSINESS'        // Regra de negócio violada (ex: limite de crédito excedido)
  | 'VALIDATION'      // Dado de entrada inválido (ex: CPF malformado)
  | 'INFRASTRUCTURE'  // Falha de sistema externo (ex: banco de dados offline)
  | 'SECURITY'        // Violação de acesso ou identidade
  | 'GOVERNANCE'      // Violação de regra arquitetural ou de governança (ENG-12)
  | 'UNEXPECTED'      // Erro não antecipado (sempre logar como CRITICAL)

export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface SOEErrorMetadata {
  /** Código único no formato COMPONENTE-NNN (ex: ENG11-042, CAP03-007) */
  code: string
  category: ErrorCategory
  /** Mensagem técnica para logs internos */
  technicalMessage: string
  /** Mensagem legível para o usuário final */
  friendlyMessage: string
  /** O que o chamador deve fazer para resolver */
  recommendedAction: string
  severity: ErrorSeverity
  /** Tipo de evento CUE a publicar quando este erro ocorre (opcional) */
  publishedEvent?: string | undefined
  /** Dados de contexto adicionais para diagnóstico */
  context?: Record<string, unknown> | undefined
}

/** Classe base de todos os erros do SOE */
export abstract class SOEError extends Error {
  readonly code: string
  readonly category: ErrorCategory
  readonly technicalMessage: string
  readonly friendlyMessage: string
  readonly recommendedAction: string
  readonly severity: ErrorSeverity
  readonly publishedEvent?: string
  readonly context?: Record<string, unknown>
  readonly timestamp: string

  constructor(meta: SOEErrorMetadata) {
    super(meta.technicalMessage)
    this.name = this.constructor.name
    this.code = meta.code
    this.category = meta.category
    this.technicalMessage = meta.technicalMessage
    this.friendlyMessage = meta.friendlyMessage
    this.recommendedAction = meta.recommendedAction
    this.severity = meta.severity
    this.publishedEvent = meta.publishedEvent
    this.context = meta.context
    this.timestamp = new Date().toISOString()

    // Preserva o stack trace em V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  toJSON(): SOEErrorMetadata & { timestamp: string; stack?: string } {
    return {
      code: this.code,
      category: this.category,
      technicalMessage: this.technicalMessage,
      friendlyMessage: this.friendlyMessage,
      recommendedAction: this.recommendedAction,
      severity: this.severity,
      publishedEvent: this.publishedEvent,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    }
  }
}

/**
 * Regra de negócio violada.
 * Ex: tentativa de fechar oportunidade sem proposta aprovada.
 */
export class BusinessError extends SOEError {
  constructor(
    code: string,
    technicalMessage: string,
    friendlyMessage: string,
    recommendedAction: string,
    opts?: Partial<Pick<SOEErrorMetadata, 'severity' | 'publishedEvent' | 'context'>>,
  ) {
    super({
      code,
      category: 'BUSINESS',
      technicalMessage,
      friendlyMessage,
      recommendedAction,
      severity: opts?.severity ?? 'MEDIUM',
      publishedEvent: opts?.publishedEvent,
      context: opts?.context,
    })
  }
}

/**
 * Dado de entrada inválido.
 * Ex: campo obrigatório ausente, formato de data incorreto.
 */
export class ValidationError extends SOEError {
  readonly fields: Record<string, string[]>

  constructor(
    code: string,
    technicalMessage: string,
    friendlyMessage: string,
    fields: Record<string, string[]> = {},
    opts?: Partial<Pick<SOEErrorMetadata, 'severity' | 'context'>>,
  ) {
    super({
      code,
      category: 'VALIDATION',
      technicalMessage,
      friendlyMessage,
      recommendedAction: 'Corrija os campos indicados e tente novamente.',
      severity: opts?.severity ?? 'LOW',
      context: { ...opts?.context, fields },
    })
    this.fields = fields
  }
}

/**
 * Falha de infraestrutura (banco, cache, serviço externo).
 * Deve gerar alerta automático — não expor detalhes ao usuário final.
 */
export class InfrastructureError extends SOEError {
  constructor(
    code: string,
    technicalMessage: string,
    opts?: Partial<Pick<SOEErrorMetadata, 'severity' | 'publishedEvent' | 'context'>>,
  ) {
    super({
      code,
      category: 'INFRASTRUCTURE',
      technicalMessage,
      friendlyMessage: 'Ocorreu um erro interno. Nossa equipe foi notificada.',
      recommendedAction: 'Verificar logs de infraestrutura e health check do componente.',
      severity: opts?.severity ?? 'HIGH',
      publishedEvent: opts?.publishedEvent,
      context: opts?.context,
    })
  }
}

/**
 * Violação de segurança: acesso não autorizado, token inválido, permissão ausente.
 */
export class SecurityError extends SOEError {
  constructor(
    code: string,
    technicalMessage: string,
    friendlyMessage: string,
    opts?: Partial<Pick<SOEErrorMetadata, 'severity' | 'publishedEvent' | 'context'>>,
  ) {
    super({
      code,
      category: 'SECURITY',
      technicalMessage,
      friendlyMessage,
      recommendedAction: 'Verificar permissões do usuário e validade da sessão.',
      severity: opts?.severity ?? 'HIGH',
      publishedEvent: opts?.publishedEvent,
      context: opts?.context,
    })
  }
}

/**
 * Violação de regra arquitetural ou de governança (detectada pela ENG-12).
 * Geralmente bloqueia a operação completamente.
 */
export class GovernanceError extends SOEError {
  constructor(
    code: string,
    technicalMessage: string,
    friendlyMessage: string,
    recommendedAction: string,
    opts?: Partial<Pick<SOEErrorMetadata, 'severity' | 'publishedEvent' | 'context'>>,
  ) {
    super({
      code,
      category: 'GOVERNANCE',
      technicalMessage,
      friendlyMessage,
      recommendedAction,
      severity: opts?.severity ?? 'CRITICAL',
      publishedEvent: opts?.publishedEvent,
      context: opts?.context,
    })
  }
}

/**
 * Erro não antecipado. Sempre logado como CRITICAL.
 * Nunca deve chegar ao usuário final em produção.
 */
export class UnexpectedError extends SOEError {
  readonly originalError?: Error

  constructor(originalError: unknown, code = 'SYS-000', context?: Record<string, unknown>) {
    const original = originalError instanceof Error ? originalError : new Error(String(originalError))
    super({
      code,
      category: 'UNEXPECTED',
      technicalMessage: `Unexpected error: ${original.message}`,
      friendlyMessage: 'Ocorreu um erro inesperado. Por favor, tente novamente.',
      recommendedAction: 'Investigar logs com correlação_id. Abrir incidente se recorrente.',
      severity: 'CRITICAL',
      context: { ...context, originalMessage: original.message },
    })
    this.originalError = original
  }
}

/** Type guard para SOEError */
export function isSOEError(err: unknown): err is SOEError {
  return err instanceof SOEError
}

/** Converte qualquer erro para SOEError sem perder informação */
export function toSOEError(err: unknown): SOEError {
  if (isSOEError(err)) return err
  return new UnexpectedError(err)
}
