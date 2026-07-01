/**
 * DashboardComercial — visão do Gerente Comercial.
 *
 * Responde: "O funil está saudável? Onde estão os gargalos? O que fechar hoje?"
 */

export interface EtapaPipeline {
  nome: string
  totalOportunidades: number
  valorTotal: number
  taxaConversaoEtapa: number
}

export interface PropostaRecente {
  oportunidadeNome: string
  valorBruto: number
  status: string
  diasEmAberto: number
}

export interface VendedorResumido {
  nome: string
  taxaAtingimentoMeta: number
  classificacao: 'ABAIXO' | 'DENTRO' | 'ACIMA'
  oportunidadesAtivas: number
}

export interface DashboardComercial {
  periodo: string
  geradoEm: string

  // Pipeline
  totalOportunidadesAtivas: number
  valorTotalPipeline: number
  etapas: EtapaPipeline[]
  cicloMedioDias: number

  // Fechamentos
  vendasNoMes: number
  receitaFechadaNoMes: number
  taxaFechamento: number
  ticketMedioFechado: number

  // Propostas
  propostasEmAberto: number
  propostasAguardandoAprovacao: number
  propostasRecentes: PropostaRecente[]

  // Forecast
  forecastConservador: number   // 50% das oportunidades qualificadas
  forecastOtimista: number      // 80% das oportunidades qualificadas

  // Equipe (resumo — detalhe no DashboardGestor)
  vendedores: VendedorResumido[]
  vendedoresAbaixoDaMeta: number
}
