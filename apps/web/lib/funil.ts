// Funil comercial único — espelha apps/api/src/lib/funil.ts

export const ESTAGIO_LABEL: Record<string, string> = {
  NOVO_LEAD: 'Leads',
  NAO_RESPONDEU: 'Não Responderam',
  FOLLOW_1_DIA: 'Follow',
  RESPONDEU: 'Responderam',
  MQL: 'MQL',
  SQL: 'SQL',
  COMPRADO: 'Compraram',
  PROCESSO_ADMINISTRATIVO: 'Processo Administrativo',
  PERDIDO: 'Perdido',
}

export const ESTAGIO_COR: Record<string, string> = {
  NOVO_LEAD: 'bg-gray-100 text-gray-700',
  NAO_RESPONDEU: 'bg-red-50 text-red-600',
  FOLLOW_1_DIA: 'bg-amber-100 text-amber-700',
  RESPONDEU: 'bg-blue-100 text-blue-700',
  MQL: 'bg-purple-100 text-purple-700',
  SQL: 'bg-yellow-100 text-yellow-700',
  COMPRADO: 'bg-green-100 text-green-700',
  PROCESSO_ADMINISTRATIVO: 'bg-emerald-100 text-emerald-700',
  PERDIDO: 'bg-red-100 text-red-700',
}

export const ESTAGIO_COR_COLUNA: Record<string, string> = {
  NOVO_LEAD: 'bg-gray-100 border-gray-300',
  NAO_RESPONDEU: 'bg-red-50 border-red-200',
  FOLLOW_1_DIA: 'bg-amber-50 border-amber-300',
  RESPONDEU: 'bg-blue-50 border-blue-300',
  MQL: 'bg-purple-50 border-purple-300',
  SQL: 'bg-yellow-50 border-yellow-300',
  COMPRADO: 'bg-green-50 border-green-300',
  PROCESSO_ADMINISTRATIVO: 'bg-emerald-50 border-emerald-300',
  PERDIDO: 'bg-red-50 border-red-300',
}

/** Sequência linear de conversão — exclui PERDIDO, que é saída de qualquer etapa. */
export const ETAPAS_FUNIL_ORDEM = [
  'NOVO_LEAD',
  'NAO_RESPONDEU',
  'FOLLOW_1_DIA',
  'RESPONDEU',
  'MQL',
  'SQL',
  'COMPRADO',
  'PROCESSO_ADMINISTRATIVO',
] as const

export const ESTAGIO_VENDA_FECHADA = 'COMPRADO'

export const COLUNAS_KANBAN = [
  ...ETAPAS_FUNIL_ORDEM.map(id => ({ id, label: ESTAGIO_LABEL[id], cor: ESTAGIO_COR_COLUNA[id] })),
  { id: 'PERDIDO', label: '❌ Perdido', cor: ESTAGIO_COR_COLUNA.PERDIDO },
]
