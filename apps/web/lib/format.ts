export function formatMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatPct(valor: number): string {
  return `${Math.round(valor * 100)}%`
}
