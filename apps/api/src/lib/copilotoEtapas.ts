// Etapas do funil para o Copiloto, sem dependência de banco (usadas pelas
// regras puras e pelos testes).
export const ESTAGIOS_ABERTOS = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA'] as const
const RANK: Record<string, number> = { LEAD: 0, ABORDADO: 1, NEGOCIACAO: 2, PROPOSTA: 3, FECHADO: 4 }
export const rankEstagio = (e: string | null | undefined) => (e && e in RANK ? RANK[e] : -1)
/** Dias sem movimento a partir dos quais o lead conta como parado, por estágio. */
export const PARADO_APOS: Record<string, number> = { LEAD: 1, ABORDADO: 3, NEGOCIACAO: 4, PROPOSTA: 3 }

export function primeiroNome(n: string | null | undefined): string {
  const p = (n ?? '').trim().split(/\s+/)[0]
  if (!p) return 'Cliente'
  // "BRENDA" ou "brenda" viram "Brenda"; "McCarthy" fica como está.
  return p === p.toUpperCase() || p === p.toLowerCase() ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p
}
