/**
 * DashboardExecutivo — visão do CEO/Diretor.
 *
 * Responde: "A empresa está crescendo ou encolhendo? Onde está o risco?"
 */

export interface MetricaFinanceira {
  valor: number
  variacaoPercent: number   // vs período anterior
  tendencia: 'CRESCENDO' | 'ESTAVEL' | 'CAINDO'
}

export interface AlertaAtivo {
  tipo: string
  descricao: string
  impactoEstimado: number
  urgencia: 'ALTA' | 'MEDIA' | 'BAIXA'
}

export interface DashboardExecutivo {
  periodo: string
  geradoEm: string

  // Saúde financeira
  mrr: MetricaFinanceira
  arr: MetricaFinanceira
  churnRate: MetricaFinanceira
  receitaNoMes: number

  // Pipeline comercial
  oportunidadesAtivas: number
  valorPipelineTotal: number
  taxaConversaoGlobal: number
  forecastMes: number

  // Clientes
  totalClientesAtivos: number
  healthScoreMedio: number
  clientesEmRisco: number   // health < 40

  // Inteligência (CAP-08)
  diagnosticosAbertos: number
  diagnosticosCriticos: number
  alertasAtivos: AlertaAtivo[]

  // Equipe
  performanceMediaEquipe: number   // % atingimento médio das metas
  vendedoresAbaixoDaMeta: number
}
