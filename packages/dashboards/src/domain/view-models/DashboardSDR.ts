/**
 * DashboardSDR — visão do Sales Development Rep.
 *
 * Responde: "Quantos leads qualifiquei? Quais estão prontos para o AE? Estou na meta?"
 */

export interface LeadParaAcao {
  oportunidadeId: string
  nomeEmpresa: string
  estagio: string
  diasSemMovimento: number
  proximaAcaoSugerida: string
}

export interface DashboardSDR {
  periodo: string
  geradoEm: string
  sdrId: string
  sdrNome: string

  // Volume de atividade
  leadsAbertos: number
  leadsQualificadosNoMes: number
  leadsTransferidosParaAE: number
  taxaQualificacao: number   // % leads que viram oportunidades qualificadas

  // Meta
  metaLeads: number
  atingimentoMeta: number    // %

  // Próximas ações — o que fazer agora
  leadsParaFollowUp: LeadParaAcao[]
  leadsSemMovimento3Dias: number

  // Qualidade do funil
  taxaBant: number           // % leads com BANT completo
  cicloMedioQualificacaoDias: number
}
