// Venda confirmada pelo dono (PDF 01, etapa 10; decisão aprovada): a venda
// registrada pelo vendedor fica "aguardando confirmação" e não conta em
// faturamento, comissão nem Dashboard até o dono confirmar. Toda leitura de
// vendas que não diz a situação passa a ver só as confirmadas (middleware);
// quem precisa das outras (lista de Vendas, confirmação) pede explicitamente.
import type { Prisma } from '@prisma/client'

export const SITUACOES_VISIVEIS = { situacao: { in: ['CONFIRMADA', 'AGUARDANDO_CONFIRMACAO'] } }
const LEITURAS = new Set(['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy'])

const temSituacao = (w: unknown): boolean => {
  if (!w || typeof w !== 'object') return false
  const o = w as Record<string, unknown>
  if ('situacao' in o) return true
  return ['AND', 'OR'].some(k => Array.isArray(o[k]) && (o[k] as unknown[]).some(temSituacao)) || (!!o.AND && !Array.isArray(o.AND) && temSituacao(o.AND))
}

export const middlewareVendaConfirmada: Prisma.Middleware = async (params, next) => {
  if (params.model === 'Venda' && LEITURAS.has(params.action)) {
    const a = (params.args ??= {}) as { where?: unknown }
    if (!temSituacao(a.where)) a.where = a.where ? { AND: [a.where, { situacao: 'CONFIRMADA' }] } : { situacao: 'CONFIRMADA' }
  }
  return next(params)
}
