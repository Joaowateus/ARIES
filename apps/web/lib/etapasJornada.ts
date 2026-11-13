// Nomes da jornada de 10 etapas (PDF 01) para as telas. A regra fica na API.
import type { EtapaJornada } from './proLaboreApi'

export const ETAPAS_JORNADA: EtapaJornada[] = ['LEAD', 'ABORDADO', 'LEVANTAMENTO', 'MQL', 'SQL', 'NEGOCIACAO', 'PROPOSTA', 'AGENDAMENTO', 'VISITA', 'VENDA']
export const NOME_ETAPA: Record<EtapaJornada, string> = {
  LEAD: 'Lead', ABORDADO: 'Abordado', LEVANTAMENTO: 'Levantamento', MQL: 'MQL (Simulação)', SQL: 'SQL (Aprovado)',
  NEGOCIACAO: 'Negociação', PROPOSTA: 'Proposta', AGENDAMENTO: 'Agendamento', VISITA: 'Visita confirmada', VENDA: 'Venda',
}
export const FASES: Array<{ id: 'PRE_VENDA' | 'VENDA' | 'FECHAMENTO'; nome: string; etapas: EtapaJornada[] }> = [
  { id: 'PRE_VENDA', nome: 'Pré-venda', etapas: ['LEAD', 'ABORDADO', 'LEVANTAMENTO', 'MQL', 'SQL'] },
  { id: 'VENDA', nome: 'Venda', etapas: ['NEGOCIACAO', 'PROPOSTA', 'AGENDAMENTO', 'VISITA'] },
  { id: 'FECHAMENTO', nome: 'Fechamento', etapas: ['VENDA'] },
]
export const NOME_MOTIVO: Record<string, string> = {
  CONTATO_INVALIDO: 'Contato inválido', NAO_E_LEAD: 'Não é lead', NUNCA_RESPONDEU: 'Nunca respondeu', SEM_INTERESSE: 'Sem interesse',
  SEM_CNH: 'Sem CNH e sem previsão de tirar', SEM_ENTRADA: 'Sem condição de entrada', SO_PESQUISANDO: 'Só pesquisando preço', DESISTIU: 'Desistiu',
  NAO_AUTORIZOU: 'Não autorizou a análise', RECUSADO_TODOS_BANCOS: 'Recusado em todos os bancos', DESISTIU_SIMULACAO: 'Desistiu depois da simulação (parcela alta)',
  APROVACAO_VENCEU: 'Aprovação venceu', DESISTIU_APROVACAO: 'Desistiu depois da aprovação', COMPROU_OUTRO_LUGAR: 'Comprou em outro lugar',
  ACHOU_CARO: 'Achou caro', MOTO_INDISPONIVEL: 'Moto indisponível', NAO_ACEITOU_CONDICAO: 'Não aceitou a condição', PAROU_DE_RESPONDER: 'Parou de responder', OUTRO: 'Outro motivo',
  FALTOU_NAO_REMARCOU: 'Faltou e não remarcou', NAO_GOSTOU_MOTO: 'Não gostou da moto', CONDICAO_NAO_FECHOU: 'A condição não fechou na loja',
  DOCUMENTACAO_PENDENTE: 'Documentação pendente sem solução', CANCELADA_DESISTENCIA: 'Venda cancelada por desistência',
  CREDITO_NAO_LIBERADO: 'Crédito não liberado na formalização', ERRO_REGISTRO: 'Venda cancelada por erro de registro',
  PEDIU_NAO_CONTATO: 'Pediu para não ser contatado', OUTRO_ANTERIOR_MIGRACAO: 'Outro (anterior à migração)',
}
export const NOME_DESTINO: Record<string, string> = {
  DESCARTADA: 'não conta como perda', ENCERRADA: 'encerrada', REATIVACAO_SEM_RESPOSTA: 'Reativação · sem resposta',
  REATIVACAO_INTERESSE: 'Reativação · interesse não convertido', REATIVACAO_NEGOCIACAO: 'Reativação · negociação interrompida',
  REATIVACAO_RETOMADA: 'Reativação · oportunidade de retomada', REATIVACAO_OUTRO: 'Reativação · outro (anterior à migração)',
}
