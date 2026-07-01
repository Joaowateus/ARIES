/**
 * DashboardVendedor — visão do Account Executive.
 *
 * Responde: "O que fechar hoje? Onde estou na meta? Qual proposta está em risco?"
 */

export interface OportunidadePrioritaria {
  id: string
  nomeEmpresa: string
  valor: number
  estagio: string
  probabilidade: number
  diasNaEtapa: number
  alertas: string[]   // ex: "3 dias sem contato", "proposta vencendo em 2 dias"
}

export interface PropostaEmAberto {
  id: string
  nomeEmpresa: string
  valor: number
  status: string
  diasAguardando: number
}

export interface DashboardVendedor {
  periodo: string
  geradoEm: string
  vendedorId: string
  vendedorNome: string

  // Meta do mês
  metaReceita: number
  receitaRealizada: number
  taxaAtingimento: number
  classificacao: 'ABAIXO' | 'DENTRO' | 'ACIMA'
  faltaParaMeta: number
  diasRestantesNoMes: number

  // Pipeline pessoal
  oportunidadesAtivas: number
  valorPipelineTotal: number
  oportunidadesPrioritarias: OportunidadePrioritaria[]

  // Propostas
  propostasEmAberto: PropostaEmAberto[]
  propostasAguardandoResposta: number

  // Fechamentos no mês
  fechamentosNoMes: number
  receitaFechadaNoMes: number
  ticketMedio: number

  // Foco do dia — o que fazer agora
  acoesPendentesHoje: number
}
