// PDF 06 · correções 1, 2 e 5: todo número que sai do ARIES em texto (Lente,
// Recomendações, Daily, WhatsApp) usa o formato brasileiro, com a unidade, e
// quantidade de vendas é sempre inteira.
import type { Unidade } from './metricas'

export const num = (v: number, casas = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas })
export const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2, maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2 })

/** Valor de uma ficha do dicionário com a unidade, no formato brasileiro. */
export function fmtValor(v: number | null | undefined, unidade: Unidade | string): string {
  if (v == null || !Number.isFinite(v)) return '—'
  switch (unidade) {
    case 'BRL': return moeda(v)
    case 'PCT': return `${num(v, Math.abs(v) < 10 ? 2 : 1)}%`
    case 'MIN': return v >= 120 ? `${num(v / 60, 1)} h` : `${Math.round(v)} min`
    case 'DIAS': return `${num(v, 1)} ${v === 1 ? 'dia' : 'dias'}`
    case 'X': return `${num(v, 2)}x`
    default: return num(v, 1)
  }
}

/** "1 venda", "3 vendas": quantidade de vendas sempre inteira (arredonda para cima). */
export const vendasTxt = (n: number) => { const k = Math.max(0, Math.ceil(n - 1e-9)); return `${k} ${k === 1 ? 'venda' : 'vendas'}` }

/**
 * Correção 5: em vez de "0,4 venda por dia", o ritmo em vendas inteiras.
 * faltamVendas: vendas que faltam para a meta; diasUteis: dias úteis que restam.
 */
export function ritmoEmVendas(faltamVendas: number | null, diasUteis: number, previsaoCobre: boolean): string {
  if (previsaoCobre || faltamVendas == null || faltamVendas <= 0) return 'Meta no ritmo'
  const faltam = Math.ceil(faltamVendas - 1e-9)
  if (diasUteis <= 0) return `faltam ${vendasTxt(faltam)} e o mês acabou`
  if (faltam < diasUteis) {
    const cada = Math.max(1, Math.floor(diasUteis / faltam))
    return cada === 1 ? `faltam ${vendasTxt(faltam)} em ${diasUteis} dias úteis` : `1 venda a cada ${cada} dias úteis (faltam ${vendasTxt(faltam)} em ${diasUteis} dias úteis)`
  }
  return `faltam ${vendasTxt(faltam)} em ${diasUteis} dias úteis`
}

/** Dias úteis (segunda a sábado, como o expediente padrão) de amanhã... ou de hoje até o fim do mês. */
export function diasUteisRestantes(hoje: string, incluirHoje = true, diasDaSemana: number[] = [1, 2, 3, 4, 5, 6]): number {
  const d = new Date(`${hoje}T12:00:00Z`)
  const fim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12))
  let n = 0
  for (let x = new Date(d.getTime() + (incluirHoje ? 0 : 86_400_000)); x <= fim; x = new Date(x.getTime() + 86_400_000)) if (diasDaSemana.includes(x.getUTCDay())) n++
  return n
}

/** PDF 06 · correção 7: primeiro nome, a não ser que dois da lista tenham o mesmo primeiro nome (aí, o nome completo). */
export function nomesDistintos(lista: Array<{ id: string; nome: string | null }>): Map<string, string> {
  const primeiro = (s: string | null) => (s ?? '').trim().split(/\s+/)[0] || ''
  const cont = new Map<string, number>()
  for (const p of lista) { const k = primeiro(p.nome).toLowerCase(); cont.set(k, (cont.get(k) ?? 0) + 1) }
  return new Map(lista.map(p => [p.id, (cont.get(primeiro(p.nome).toLowerCase()) ?? 0) > 1 ? (p.nome ?? '').trim() : primeiro(p.nome)]))
}
