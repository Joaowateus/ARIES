// Formatação da aba Tráfego (moeda da conta de anúncios, %, números).
export function moeda(v: number | null | undefined, codigo = 'BRL', casas = 2): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: codigo, minimumFractionDigits: casas, maximumFractionDigits: casas })
}
export function pct(v: number | null | undefined, casas = 1): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
}
export function num(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Math.round(v).toLocaleString('pt-BR')
}
export function compacto(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1_000_000) return `${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (a >= 10_000) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return Math.round(v).toLocaleString('pt-BR')
}
export function tempoDesde(iso: string | null): string {
  if (!iso) return 'nunca'
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}
export const ROTULO_RESULTADO: Record<string, string> = { conversas: 'conversas', leads: 'leads', lpv: 'visualizações', cliquesLink: 'cliques' }
// "Leads no CRM" -> "leads no CRM" (só a primeira letra, preserva siglas).
export const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
