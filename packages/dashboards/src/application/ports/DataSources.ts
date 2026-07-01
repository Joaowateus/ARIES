/**
 * DataSources — contratos de leitura para os dashboards.
 *
 * Cada fonte representa um CAP. Em produção, conectam a bancos reais.
 * Em testes, são implementações in-memory com dados semeados.
 */

export interface OportunidadeResumo {
  id: string
  empresaId: string
  responsavelId: string
  nomeEmpresa: string
  valor: number
  estagio: string
  qualificada: boolean
  criadaEm: string
  atualizadaEm: string
}

export interface VendaRealizada {
  id: string
  empresaId: string
  responsavelId: string
  valorContrato: number
  mrr: number
  fechadaEm: string
  periodo: string
}

export interface PropostaResumo {
  id: string
  empresaId: string
  responsavelId: string
  oportunidadeId: string
  nomeEmpresa: string
  valorBruto: number
  status: string
  criadaEm: string
  atualizadoEm: string
}

export interface ClienteResumo {
  id: string
  empresaId: string
  nomeEmpresa: string
  status: string
  healthScore: number
  mrr: number
  responsavelCSId?: string
}

export interface VendedorPerformanceResumo {
  vendedorId: string
  nome: string
  cargo: string
  metaReceita: number
  receitaRealizada: number
  oportunidadesAtivas: number
  propostasEnviadas: number
  alertaBaixaPerformance: boolean
  periodo: string
}

export interface DiagnosticoResumo {
  id: string
  empresaId: string
  classificacao: string
  status: string
  impactoFinanceiroEstimado: number
  mupTotal: number
  periodo: string
}

export interface AtribuicaoResumo {
  id: string
  empresaId: string
  vendedorId: string
  vendedorNome: string
  descricaoAcao: string
  prazoIso: string
  status: string
}

export interface KpiResumo {
  kpiNome: string
  dominio: string
  valor: number
  baseline?: number
  periodo: string
  possuiAnomalia: boolean
}

// Fonte de dados do CAP-02 (Pipeline)
export interface IPipelineDataSource {
  findOportunidadesAtivas(empresaId: string): Promise<OportunidadeResumo[]>
  findOportunidadesPorResponsavel(empresaId: string, responsavelId: string): Promise<OportunidadeResumo[]>
  findVendasNoPeriodo(empresaId: string, periodo: string): Promise<VendaRealizada[]>
  countLeadsQualificados(empresaId: string, periodo: string): Promise<number>
}

// Fonte de dados do CAP-06 (Propostas)
export interface IPropostaDataSource {
  findPropostasAtivas(empresaId: string): Promise<PropostaResumo[]>
  findPropostasPorResponsavel(empresaId: string, responsavelId: string): Promise<PropostaResumo[]>
  countAguardandoAprovacao(empresaId: string): Promise<number>
}

// Fonte de dados do CAP-04/05 (Receita e Clientes)
export interface IReceitaClienteDataSource {
  getMRRAtual(empresaId: string): Promise<number>
  getMRRPeriodoAnterior(empresaId: string): Promise<number>
  getChurnRate(empresaId: string, periodo: string): Promise<number>
  findClientesAtivos(empresaId: string): Promise<ClienteResumo[]>
}

// Fonte de dados do CAP-07 (Equipe)
export interface IEquipeDataSource {
  findPerformancesNoPeriodo(empresaId: string, periodo: string): Promise<VendedorPerformanceResumo[]>
  findAtribuicoesPendentes(empresaId: string): Promise<AtribuicaoResumo[]>
}

// Fonte de dados do CAP-08 (Diagnósticos e KPIs)
export interface IDiagnosticoDataSource {
  findDiagnosticosAbertos(empresaId: string): Promise<DiagnosticoResumo[]>
  findKpisNoPeriodo(empresaId: string, periodo: string): Promise<KpiResumo[]>
}
