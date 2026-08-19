/**
 * Funil comercial único (CRM individual + Dashboard + Metas + Precificação
 * leem daqui). Substitui o funil antigo de 7 etapas.
 */

export const ESTAGIOS = [
  'NOVO_LEAD',
  'NAO_RESPONDEU',
  'FOLLOW_1_DIA',
  'RESPONDEU',
  'SQL',
  'MQL',
  'COMPRADO',
  'PROCESSO_ADMINISTRATIVO',
  'PERDIDO',
] as const

export type Estagio = (typeof ESTAGIOS)[number]

export const ESTAGIO_LABEL: Record<string, string> = {
  NOVO_LEAD: 'Leads',
  NAO_RESPONDEU: 'Não Responderam',
  FOLLOW_1_DIA: 'Follow — 01 dia',
  RESPONDEU: 'Responderam',
  SQL: 'SQL — Simulação',
  MQL: 'MQL — Qualificados',
  COMPRADO: 'Compraram',
  PROCESSO_ADMINISTRATIVO: 'Processo Administrativo',
  PERDIDO: 'Perdido',
}

/** Sequência linear de conversão — exclui PERDIDO, que é saída de qualquer etapa. */
export const ETAPAS_FUNIL_ORDEM = [
  'NOVO_LEAD',
  'NAO_RESPONDEU',
  'FOLLOW_1_DIA',
  'RESPONDEU',
  'SQL',
  'MQL',
  'COMPRADO',
  'PROCESSO_ADMINISTRATIVO',
] as const

/** Estágio em que a venda é considerada fechada — gera Contrato. */
export const ESTAGIO_VENDA_FECHADA: Estagio = 'COMPRADO'

export const ESTAGIOS_FINAIS: readonly Estagio[] = ['COMPRADO', 'PERDIDO']

/** Metas de conversão padrão por etapa (seed inicial de MetaFunilEtapa). */
export const METAS_FUNIL_PADRAO: Record<string, { metaPct: number; tipoMeta: 'MINIMO' | 'MAXIMO_PERDA' }> = {
  NAO_RESPONDEU: { metaPct: 0.1, tipoMeta: 'MAXIMO_PERDA' },
  RESPONDEU: { metaPct: 0.9, tipoMeta: 'MINIMO' },
  SQL: { metaPct: 0.7, tipoMeta: 'MINIMO' },
  MQL: { metaPct: 0.2, tipoMeta: 'MINIMO' },
  COMPRADO: { metaPct: 0.2, tipoMeta: 'MINIMO' },
  PROCESSO_ADMINISTRATIVO: { metaPct: 1.0, tipoMeta: 'MINIMO' },
}
