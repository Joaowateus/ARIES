// Contagem única de follows (19/11): a mesma regra no menu ("Para hoje" e o
// selo do Funil) e na faixa do Funil (apps/web/.../_follow/contagem.ts).
// - atrasado: follow pendente com data/hora antes de agora;
// - hoje: follow pendente com data de hoje (Brasília) e ainda não vencido;
// - só leads em andamento (sem venda e não perdidos), no escopo de quem vê.
import type { Prisma } from '@prisma/client'

const DIA = 864e5
const OFFSET_BR = 3 * 3600e3

/** Fim do dia de hoje em Brasília (00:00 de amanhã). */
export function fimDoDiaBR(agora: Date): Date {
  return new Date(Math.floor((agora.getTime() - OFFSET_BR) / DIA) * DIA + OFFSET_BR + DIA)
}

export type SituacaoFollow = 'ATRASADO' | 'HOJE' | 'FUTURO'
export function situacaoDoFollow(agendadoPara: Date, agora: Date): SituacaoFollow {
  if (agendadoPara.getTime() < agora.getTime()) return 'ATRASADO'
  return agendadoPara.getTime() < fimDoDiaBR(agora).getTime() ? 'HOJE' : 'FUTURO'
}

export function contarFollows(follows: Array<{ agendadoPara: Date }>, agora: Date): { hoje: number; atrasados: number } {
  let hoje = 0, atrasados = 0
  for (const f of follows) {
    const s = situacaoDoFollow(f.agendadoPara, agora)
    if (s === 'ATRASADO') atrasados++
    else if (s === 'HOJE') hoje++
  }
  return { hoje, atrasados }
}

/** Lead em andamento: sem venda e não perdido. */
export const LEAD_EM_ANDAMENTO: Prisma.LeadWhereInput = { vendaId: null, perdidoEm: null, estagio: { notIn: ['PERDIDO', 'FECHADO'] } }
