// Nomes exibidos e conversões de data do espaço do Social Media. Datas no
// horário de Brasília/Belém (UTC-3, sem horário de verão), como em toda a
// especificação.
import type { SmColuna, SmFormato, SmOrigem, SmPilar } from '@/lib/proLaboreApi'
import type { Pilar } from './componentes'

export const PILAR_ROTULO: Record<SmPilar, string> = { ESTOQUE: 'Estoque', PROVA: 'Prova social', EDUCACAO: 'Educação', BASTIDORES: 'Bastidores' }
export const PILAR_CHIP: Record<SmPilar, Pilar> = { ESTOQUE: 'estoque', PROVA: 'prova', EDUCACAO: 'educacao', BASTIDORES: 'bastidores' }
export const FORMATO_ROTULO: Record<SmFormato, string> = { REELS: 'Reels', CARROSSEL: 'Carrossel', FOTO: 'Foto', STORY: 'Story' }
export const ORIGEM_ROTULO: Record<SmOrigem, string> = { MANUAL: 'Manual', ESTOQUE: 'Estoque', VENDA: 'Venda no CRM', INSIGHT: 'Insight', AUDIENCIA: 'Audiência', CALENDARIO: 'Calendário' }
export const COLUNA_ROTULO: Record<SmColuna, string> = { IDEIA: 'Ideias', ROTEIRO: 'Roteiro', GRAVACAO: 'Gravação', EDICAO: 'Edição', APROVACAO: 'Aprovação', AGENDADO: 'Agendado' }
export const COLUNAS: SmColuna[] = ['IDEIA', 'ROTEIRO', 'GRAVACAO', 'EDICAO', 'APROVACAO', 'AGENDADO']

const OFFSET_MS = 3 * 3600 * 1000
const pad = (n: number) => String(n).padStart(2, '0')

/** ISO -> 'YYYY-MM-DDTHH:mm' em Belém (para <input type="datetime-local">). */
export function isoParaLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() - OFFSET_MS)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** 'YYYY-MM-DDTHH:mm' em Belém -> ISO. */
export function localParaIso(local: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return null
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + OFFSET_MS).toISOString()
}

/** ISO -> 'YYYY-MM-DD' em Belém (para <input type="date">). */
export function isoParaData(iso: string | null): string {
  return isoParaLocal(iso).slice(0, 10)
}

/** 'YYYY-MM-DD' -> ISO do meio-dia em Belém (prazo de um dia inteiro). */
export function dataParaIso(data: string): string | null {
  return data ? localParaIso(`${data}T12:00`) : null
}

export function chaveDia(iso: string | Date): string {
  return isoParaLocal(typeof iso === 'string' ? iso : iso.toISOString()).slice(0, 10)
}

/** "hoje 17:00", "amanhã 09:30", "14/10 11:30" ou só "14/10". */
export function quandoCurto(iso: string, comHora = true, agora = new Date()): string {
  const alvo = chaveDia(iso)
  const hoje = chaveDia(agora)
  const amanha = chaveDia(new Date(agora.getTime() + 864e5))
  const local = isoParaLocal(iso)
  const hora = comHora ? ` ${local.slice(11, 16)}` : ''
  if (alvo === hoje) return `hoje${hora}`
  if (alvo === amanha) return `amanhã${hora}`
  return `${local.slice(8, 10)}/${local.slice(5, 7)}${hora}`
}
