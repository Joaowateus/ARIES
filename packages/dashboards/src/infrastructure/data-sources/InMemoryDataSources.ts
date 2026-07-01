/**
 * InMemory data sources para testes e desenvolvimento.
 *
 * Em produção, cada DataSource consulta o banco de dados real do respectivo CAP.
 * Aqui, os dados são semeados diretamente para validar a lógica dos dashboards.
 */

import {
  IPipelineDataSource,
  IPropostaDataSource,
  IReceitaClienteDataSource,
  IEquipeDataSource,
  IDiagnosticoDataSource,
  OportunidadeResumo,
  VendaRealizada,
  PropostaResumo,
  ClienteResumo,
  VendedorPerformanceResumo,
  DiagnosticoResumo,
  AtribuicaoResumo,
  KpiResumo,
} from '../../application/ports/DataSources'

export class InMemoryPipelineDataSource implements IPipelineDataSource {
  oportunidades: OportunidadeResumo[] = []
  vendas: VendaRealizada[] = []

  async findOportunidadesAtivas(empresaId: string): Promise<OportunidadeResumo[]> {
    return this.oportunidades.filter(o => o.empresaId === empresaId)
  }
  async findOportunidadesPorResponsavel(empresaId: string, responsavelId: string): Promise<OportunidadeResumo[]> {
    return this.oportunidades.filter(o => o.empresaId === empresaId && o.responsavelId === responsavelId)
  }
  async findVendasNoPeriodo(empresaId: string, periodo: string): Promise<VendaRealizada[]> {
    return this.vendas.filter(v => v.empresaId === empresaId && v.periodo === periodo)
  }
  async countLeadsQualificados(empresaId: string, periodo: string): Promise<number> {
    return this.oportunidades.filter(o => o.empresaId === empresaId && o.qualificada).length
  }
}

export class InMemoryPropostaDataSource implements IPropostaDataSource {
  propostas: PropostaResumo[] = []

  async findPropostasAtivas(empresaId: string): Promise<PropostaResumo[]> {
    return this.propostas.filter(p => p.empresaId === empresaId && p.status !== 'CANCELADA')
  }
  async findPropostasPorResponsavel(empresaId: string, responsavelId: string): Promise<PropostaResumo[]> {
    return this.propostas.filter(p => p.empresaId === empresaId && p.responsavelId === responsavelId)
  }
  async countAguardandoAprovacao(empresaId: string): Promise<number> {
    return this.propostas.filter(p => p.empresaId === empresaId && p.status === 'EM_APROVACAO').length
  }
}

export class InMemoryReceitaClienteDataSource implements IReceitaClienteDataSource {
  mrrAtual: number = 0
  mrrAnterior: number = 0
  churnRate: number = 0
  clientes: ClienteResumo[] = []

  async getMRRAtual(empresaId: string): Promise<number> { return this.mrrAtual }
  async getMRRPeriodoAnterior(empresaId: string): Promise<number> { return this.mrrAnterior }
  async getChurnRate(empresaId: string, periodo: string): Promise<number> { return this.churnRate }
  async findClientesAtivos(empresaId: string): Promise<ClienteResumo[]> {
    return this.clientes.filter(c => c.empresaId === empresaId)
  }
}

export class InMemoryEquipeDataSource implements IEquipeDataSource {
  performances: VendedorPerformanceResumo[] = []
  atribuicoes: AtribuicaoResumo[] = []

  async findPerformancesNoPeriodo(empresaId: string, periodo: string): Promise<VendedorPerformanceResumo[]> {
    return this.performances.filter(p => p.periodo === periodo)
  }
  async findAtribuicoesPendentes(empresaId: string): Promise<AtribuicaoResumo[]> {
    return this.atribuicoes.filter(a => a.empresaId === empresaId && ['PENDENTE', 'EM_EXECUCAO'].includes(a.status))
  }
}

export class InMemoryDiagnosticoDataSource implements IDiagnosticoDataSource {
  diagnosticos: DiagnosticoResumo[] = []
  kpis: KpiResumo[] = []

  async findDiagnosticosAbertos(empresaId: string): Promise<DiagnosticoResumo[]> {
    return this.diagnosticos.filter(d => d.empresaId === empresaId && ['ABERTO', 'EM_TRATAMENTO'].includes(d.status))
  }
  async findKpisNoPeriodo(empresaId: string, periodo: string): Promise<KpiResumo[]> {
    return this.kpis.filter(k => k.periodo === periodo)
  }
}
