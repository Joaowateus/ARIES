// Jornada de compra de 10 etapas (ARIES 2.0, PDF 01): etapas, fases,
// motivos de perda por etapa e o destino que o sistema aplica a cada motivo.
export const ETAPAS = ['LEAD', 'ABORDADO', 'LEVANTAMENTO', 'MQL', 'SQL', 'NEGOCIACAO', 'PROPOSTA', 'AGENDAMENTO', 'VISITA', 'VENDA'] as const
export type Etapa = typeof ETAPAS[number]
export const NOME_ETAPA: Record<Etapa, string> = {
  LEAD: 'Lead', ABORDADO: 'Abordado', LEVANTAMENTO: 'Levantamento de necessidades', MQL: 'MQL (Simulação)', SQL: 'SQL (Aprovado)',
  NEGOCIACAO: 'Negociação', PROPOSTA: 'Proposta', AGENDAMENTO: 'Agendamento', VISITA: 'Visita confirmada', VENDA: 'Venda',
}
export type Fase = 'PRE_VENDA' | 'VENDA' | 'FECHAMENTO'
export const faseDa = (e: Etapa): Fase => (ETAPAS.indexOf(e) <= 4 ? 'PRE_VENDA' : e === 'VENDA' ? 'FECHAMENTO' : 'VENDA')

// Motivos de perda (lista fechada por etapa, seção 4 do PDF 01).
export const NOME_MOTIVO: Record<string, string> = {
  CONTATO_INVALIDO: 'Contato inválido', NAO_E_LEAD: 'Não é lead',
  NUNCA_RESPONDEU: 'Nunca respondeu', SEM_INTERESSE: 'Sem interesse',
  SEM_CNH: 'Sem CNH e sem previsão de tirar', SEM_ENTRADA: 'Sem condição de entrada', SO_PESQUISANDO: 'Só pesquisando preço', DESISTIU: 'Desistiu',
  NAO_AUTORIZOU: 'Não autorizou a análise', RECUSADO_TODOS_BANCOS: 'Recusado em todos os bancos', DESISTIU_SIMULACAO: 'Desistiu depois da simulação (parcela alta)',
  APROVACAO_VENCEU: 'Aprovação venceu', DESISTIU_APROVACAO: 'Desistiu depois da aprovação', COMPROU_OUTRO_LUGAR: 'Comprou em outro lugar',
  ACHOU_CARO: 'Achou caro', MOTO_INDISPONIVEL: 'Moto indisponível',
  NAO_ACEITOU_CONDICAO: 'Não aceitou a condição', PAROU_DE_RESPONDER: 'Parou de responder',
  FALTOU_NAO_REMARCOU: 'Faltou e não remarcou',
  NAO_GOSTOU_MOTO: 'Não gostou da moto', CONDICAO_NAO_FECHOU: 'A condição não fechou na loja', DOCUMENTACAO_PENDENTE: 'Documentação pendente sem solução',
  CANCELADA_DESISTENCIA: 'Venda cancelada por desistência', CREDITO_NAO_LIBERADO: 'Crédito não liberado na formalização', ERRO_REGISTRO: 'Venda cancelada por erro de registro',
  PEDIU_NAO_CONTATO: 'Pediu para não ser contatado',
  OUTRO_ANTERIOR_MIGRACAO: 'Outro (anterior à migração)',
}
export const MOTIVOS_DA_ETAPA: Record<Etapa, string[]> = {
  LEAD: ['CONTATO_INVALIDO', 'NAO_E_LEAD'],
  ABORDADO: ['NUNCA_RESPONDEU', 'SEM_INTERESSE'],
  LEVANTAMENTO: ['SEM_CNH', 'SEM_ENTRADA', 'SO_PESQUISANDO', 'DESISTIU'],
  MQL: ['NAO_AUTORIZOU', 'RECUSADO_TODOS_BANCOS', 'DESISTIU_SIMULACAO'],
  SQL: ['APROVACAO_VENCEU', 'DESISTIU_APROVACAO', 'COMPROU_OUTRO_LUGAR'],
  NEGOCIACAO: ['ACHOU_CARO', 'MOTO_INDISPONIVEL', 'COMPROU_OUTRO_LUGAR', 'DESISTIU'],
  PROPOSTA: ['NAO_ACEITOU_CONDICAO', 'APROVACAO_VENCEU', 'COMPROU_OUTRO_LUGAR', 'PAROU_DE_RESPONDER'],
  AGENDAMENTO: ['FALTOU_NAO_REMARCOU', 'DESISTIU'],
  VISITA: ['NAO_GOSTOU_MOTO', 'CONDICAO_NAO_FECHOU', 'DESISTIU', 'DOCUMENTACAO_PENDENTE'],
  VENDA: ['CANCELADA_DESISTENCIA', 'CREDITO_NAO_LIBERADO', 'ERRO_REGISTRO'],
}

// Destino da perda (seção 5): quem registra escolhe só o motivo.
export type DestinoPerda = 'DESCARTADA' | 'ENCERRADA' | 'REATIVACAO_SEM_RESPOSTA' | 'REATIVACAO_INTERESSE' | 'REATIVACAO_NEGOCIACAO' | 'REATIVACAO_RETOMADA' | 'REATIVACAO_OUTRO'
export const NOME_DESTINO: Record<DestinoPerda, string> = {
  DESCARTADA: 'Não conta como perda', ENCERRADA: 'Encerrada',
  REATIVACAO_SEM_RESPOSTA: 'Reativação · sem resposta', REATIVACAO_INTERESSE: 'Reativação · interesse não convertido',
  REATIVACAO_NEGOCIACAO: 'Reativação · negociação interrompida', REATIVACAO_RETOMADA: 'Reativação · oportunidade de retomada',
  REATIVACAO_OUTRO: 'Reativação · outro (anterior à migração)',
}
const DESTINOS: Record<DestinoPerda, string[]> = {
  DESCARTADA: ['NAO_E_LEAD', 'ERRO_REGISTRO'],
  ENCERRADA: ['CONTATO_INVALIDO', 'SEM_INTERESSE', 'PEDIU_NAO_CONTATO'],
  REATIVACAO_SEM_RESPOSTA: ['NUNCA_RESPONDEU', 'PAROU_DE_RESPONDER', 'FALTOU_NAO_REMARCOU'],
  REATIVACAO_INTERESSE: ['SO_PESQUISANDO', 'SEM_CNH', 'SEM_ENTRADA', 'ACHOU_CARO', 'NAO_GOSTOU_MOTO'],
  REATIVACAO_NEGOCIACAO: ['DESISTIU', 'DESISTIU_SIMULACAO', 'NAO_ACEITOU_CONDICAO', 'CONDICAO_NAO_FECHOU', 'DOCUMENTACAO_PENDENTE', 'APROVACAO_VENCEU', 'DESISTIU_APROVACAO', 'CANCELADA_DESISTENCIA'],
  REATIVACAO_RETOMADA: ['RECUSADO_TODOS_BANCOS', 'CREDITO_NAO_LIBERADO', 'MOTO_INDISPONIVEL', 'COMPROU_OUTRO_LUGAR'],
  REATIVACAO_OUTRO: ['OUTRO_ANTERIOR_MIGRACAO'],
}
/**
 * Destino do motivo. "Desistiu depois da simulação" não está na tabela do
 * PDF: o dono decidiu Reativação · negociação interrompida (06/11/2026).
 * "Não autorizou a análise" também não está e fica sem destino (null) até
 * o dono decidir.
 */
export function destinoDoMotivo(motivo: string): DestinoPerda | null {
  for (const [d, ms] of Object.entries(DESTINOS)) if (ms.includes(motivo)) return d as DestinoPerda
  return null
}
