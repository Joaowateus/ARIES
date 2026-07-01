/**
 * DashboardGestor — visão do Gerente de Equipe.
 *
 * Responde: "Quem está performando? Quem precisa de suporte? O que está travado?"
 */

export interface PerformanceIndividual {
  vendedorId: string
  nome: string
  cargo: string
  posicaoRanking: number

  // Metas
  metaReceita: number
  receitaRealizada: number
  taxaAtingimento: number
  classificacao: 'ABAIXO' | 'DENTRO' | 'ACIMA'

  // Atividade
  oportunidadesAtivas: number
  propostasEnviadas: number
  fechamentosNoMes: number

  // Alertas
  alertaBaixaPerformance: boolean
  planoAcaoAtivo: boolean
}

export interface AcaoPendente {
  descricao: string
  responsavelNome: string
  prazoIso: string
  diasAteVencimento: number
  atrasada: boolean
}

export interface DashboardGestor {
  periodo: string
  geradoEm: string

  // Visão da equipe
  totalVendedores: number
  vendedoresAtivos: number
  performanceMediaEquipe: number

  // Ranking detalhado
  ranking: PerformanceIndividual[]

  // Planos de ação em execução (CAP-08 → CAP-07)
  acoesEmExecucao: number
  acoesPendentes: number
  acoesAtrasadas: number
  proximasAcoes: AcaoPendente[]

  // Alertas de performance
  vendedoresComAlerta: number
  nomesEmAlerta: string[]
}
