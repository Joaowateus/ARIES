'use client'

// Etiquetas da jornada que o Assistente põe no lead pela conversa do WhatsApp.
export const ROTULO_ETIQUETA: Record<string, string> = {
  QUENTE: 'Quente',
  FINANCIAMENTO: 'Financiamento',
  A_VISTA: 'À vista',
  TEM_TROCA: 'Tem troca',
  SEM_ENTRADA: 'Sem entrada',
  PEDIU_SIMULACAO: 'Pediu simulação',
  OBJECAO_PRECO: 'Objeção de preço',
  PEDIU_VISITA: 'Pediu visita',
  SUMIU_24H: 'Sumiu há 24h',
}
// Ordem de importância para quando não cabem todas.
export const ORDEM_ETIQUETAS = ['QUENTE', 'PEDIU_SIMULACAO', 'PEDIU_VISITA', 'SUMIU_24H', 'OBJECAO_PRECO', 'FINANCIAMENTO', 'A_VISTA', 'TEM_TROCA', 'SEM_ENTRADA']

export function EtiquetasLead({ etiquetas, max = 9 }: { etiquetas: string[] | null | undefined; max?: number }) {
  const lista = [...(etiquetas ?? [])].sort((a, b) => ORDEM_ETIQUETAS.indexOf(a) - ORDEM_ETIQUETAS.indexOf(b))
  if (!lista.length) return null
  const resto = lista.length - max
  return (
    <span className="pl-as-etiquetas" data-etiquetas>
      {lista.slice(0, max).map(e => <span key={e} className={`pl-as-etiqueta ${e.toLowerCase()}`}>{ROTULO_ETIQUETA[e] ?? e}</span>)}
      {resto > 0 && <span className="pl-as-etiqueta" title={lista.slice(max).map(e => ROTULO_ETIQUETA[e] ?? e).join(', ')}>+{resto}</span>}
    </span>
  )
}
