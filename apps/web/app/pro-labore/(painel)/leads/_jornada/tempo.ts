// Tempo na etapa e a regra oficial de "parado" (19/11): a mesma do dicionário
// (`leads_parados` em apps/api/src/lib/metricas.ts) — lead aberto há mais tempo
// que o tempo máximo da sua etapa (Metas e premissas). É ela que pinta o tempo
// do cartão de vermelho, conta os parados da faixa e filtra "Só parados".
import type { EtapaJornada, Lead, PremissasJornada } from '@/lib/proLaboreApi'

const MS_MIN = 60_000, MS_HORA = 3_600_000, MS_DIA = 24 * MS_HORA
const MS: Record<string, number> = { MINUTOS: MS_MIN, HORAS: MS_HORA, DIAS: MS_DIA }

/** Duração legível: "12 min", "5 h", "13 d" (curto, no cartão) ou "10 h 24 min" (longo, no title). */
export function duracao(ms: number, longo = false): string {
  const min = Math.max(0, Math.floor(ms / MS_MIN))
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  if (h < 24) return longo && m ? `${h} h ${m} min` : `${h} h`
  const d = Math.floor(h / 24), hr = h % 24
  return longo && hr ? `${d} d ${hr} h` : `${d} d`
}

export const desdeEtapa = (l: Lead) => new Date(l.entrouNaEtapaEm ?? l.criadoEm).getTime()
export const tempoNaEtapa = (l: Lead, agora = Date.now()) => duracao(agora - desdeEtapa(l))

/** Passou do tempo máximo da etapa? null quando a etapa não tem máximo ou o lead não tem data de entrada na etapa. */
export function estourou(l: Lead, p: PremissasJornada | null, agora = Date.now()): { parado: boolean; max: string; maxMs: number } | null {
  if (!l.etapa || !l.entrouNaEtapaEm) return null
  const t = p?.temposMaximos[l.etapa as EtapaJornada]
  if (!t || t.valor == null) return null
  const maxMs = t.valor * MS[t.unidade]
  return { parado: agora - desdeEtapa(l) > maxMs, max: duracao(maxMs, true), maxMs }
}

/** Parado pela regra oficial: em andamento e acima do máximo da etapa. */
export const paradoOficial = (l: Lead, p: PremissasJornada | null, agora = Date.now()) =>
  !l.vendaId && !l.perdidoEm && l.estagio !== 'PERDIDO' && !l.somenteLeitura && !!estourou(l, p, agora)?.parado
