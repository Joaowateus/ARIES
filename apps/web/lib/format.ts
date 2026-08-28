export function formatMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatPct(valor: number): string {
  return `${Math.round(valor * 100)}%`
}

/** Formato compacto pra valores grandes em espaço apertado: R$1,69M, R$146,3mil. */
export function formatMoedaCompacta(valor: number): string {
  const abs = Math.abs(valor)
  const sinal = valor < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sinal}R$${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}M`
  if (abs >= 1_000) return `${sinal}R$${(abs / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}mil`
  return formatMoeda(valor)
}
