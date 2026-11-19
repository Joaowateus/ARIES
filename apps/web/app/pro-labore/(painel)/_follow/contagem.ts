// Contagem única de follows (19/11). Mesma regra da API (lib/contagemFollows.ts),
// usada no "Para hoje" e no selo do Funil (que vêm da API) e na faixa do Funil:
// - atrasado: follow pendente com data/hora antes de agora;
// - hoje: follow pendente com data de hoje (Brasília) e ainda não vencido;
// - só leads em andamento (sem venda, não perdidos), no escopo de quem vê.
import type { Lead } from '@/lib/proLaboreApi'

const DIA = 864e5
const OFFSET_BR = 3 * 3600e3
export const fimDoDiaBR = (agora: Date) => new Date(Math.floor((agora.getTime() - OFFSET_BR) / DIA) * DIA + OFFSET_BR + DIA)

export type SituacaoFollow = 'ATRASADO' | 'HOJE' | 'FUTURO'
export function situacaoDoFollow(agendadoPara: string | Date, agora: Date): SituacaoFollow {
  const t = new Date(agendadoPara).getTime()
  if (t < agora.getTime()) return 'ATRASADO'
  return t < fimDoDiaBR(agora).getTime() ? 'HOJE' : 'FUTURO'
}

/** Lead em andamento: sem venda e não perdido (os que o SDR só acompanha ficam de fora). */
export const emAndamento = (l: Lead) => !l.vendaId && !l.perdidoEm && l.estagio !== 'PERDIDO' && l.estagio !== 'FECHADO' && !l.somenteLeitura

export function contarFollows(leads: Lead[], agora = new Date()): { hoje: number; atrasados: number } {
  let hoje = 0, atrasados = 0
  for (const l of leads) {
    if (!emAndamento(l)) continue
    for (const f of l.follows ?? []) {
      const s = situacaoDoFollow(f.agendadoPara, agora)
      if (s === 'ATRASADO') atrasados++
      else if (s === 'HOJE') hoje++
    }
  }
  return { hoje, atrasados }
}

/** O lead tem algum follow nessa situação? (filtro da faixa) */
export const temFollow = (l: Lead, s: SituacaoFollow, agora = new Date()) => emAndamento(l) && (l.follows ?? []).some(f => situacaoDoFollow(f.agendadoPara, agora) === s)
