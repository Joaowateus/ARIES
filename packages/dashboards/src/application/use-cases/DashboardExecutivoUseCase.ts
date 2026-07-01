import { DashboardExecutivo, MetricaFinanceira, AlertaAtivo } from '../../domain/view-models/DashboardExecutivo'
import {
  IPipelineDataSource,
  IReceitaClienteDataSource,
  IEquipeDataSource,
  IDiagnosticoDataSource,
} from '../ports/DataSources'

export class DashboardExecutivoUseCase {
  constructor(
    private readonly pipeline: IPipelineDataSource,
    private readonly receitaCliente: IReceitaClienteDataSource,
    private readonly equipe: IEquipeDataSource,
    private readonly diagnostico: IDiagnosticoDataSource,
  ) {}

  async execute(empresaId: string, periodo: string, agora: string): Promise<DashboardExecutivo> {
    const [
      oportunidades,
      vendas,
      clientes,
      performances,
      diagnosticos,
      kpis,
      mrrAtual,
      mrrAnterior,
      churnRate,
    ] = await Promise.all([
      this.pipeline.findOportunidadesAtivas(empresaId),
      this.pipeline.findVendasNoPeriodo(empresaId, periodo),
      this.receitaCliente.findClientesAtivos(empresaId),
      this.equipe.findPerformancesNoPeriodo(empresaId, periodo),
      this.diagnostico.findDiagnosticosAbertos(empresaId),
      this.diagnostico.findKpisNoPeriodo(empresaId, periodo),
      this.receitaCliente.getMRRAtual(empresaId),
      this.receitaCliente.getMRRPeriodoAnterior(empresaId),
      this.receitaCliente.getChurnRate(empresaId, periodo),
    ])

    const variacaoMrr = mrrAnterior > 0
      ? ((mrrAtual - mrrAnterior) / mrrAnterior) * 100
      : 0

    const mrr: MetricaFinanceira = {
      valor: mrrAtual,
      variacaoPercent: Math.round(variacaoMrr * 10) / 10,
      tendencia: variacaoMrr > 2 ? 'CRESCENDO' : variacaoMrr < -2 ? 'CAINDO' : 'ESTAVEL',
    }

    const receitaNoMes = vendas.reduce((s, v) => s + v.valorContrato, 0)
    const valorPipelineTotal = oportunidades.reduce((s, o) => s + o.valor, 0)
    const taxaConversaoGlobal = oportunidades.length > 0
      ? Math.round((vendas.length / (oportunidades.length + vendas.length)) * 100)
      : 0
    const forecastMes = Math.round(valorPipelineTotal * 0.3)  // 30% do pipeline como estimativa conservadora

    const clientesEmRisco = clientes.filter(c => c.healthScore < 40).length
    const healthScoreMedio = clientes.length > 0
      ? Math.round(clientes.reduce((s, c) => s + c.healthScore, 0) / clientes.length)
      : 0

    const diagnosticosCriticos = diagnosticos.filter(d => d.mupTotal >= 7).length

    const alertasAtivos: AlertaAtivo[] = []
    if (clientesEmRisco > 0) {
      alertasAtivos.push({
        tipo: 'RETENCAO',
        descricao: `${clientesEmRisco} cliente(s) com health score crítico (< 40)`,
        impactoEstimado: clientes.filter(c => c.healthScore < 40).reduce((s, c) => s + c.mrr, 0),
        urgencia: 'ALTA',
      })
    }
    for (const d of diagnosticos.filter(d => d.mupTotal >= 7).slice(0, 3)) {
      alertasAtivos.push({
        tipo: d.classificacao,
        descricao: `Diagnóstico crítico: ${d.classificacao} — impacto estimado R$ ${d.impactoFinanceiroEstimado.toLocaleString('pt-BR')}`,
        impactoEstimado: d.impactoFinanceiroEstimado,
        urgencia: 'ALTA',
      })
    }

    const taxasAtingimento = performances.map(p => p.receitaRealizada / (p.metaReceita || 1) * 100)
    const performanceMediaEquipe = taxasAtingimento.length > 0
      ? Math.round(taxasAtingimento.reduce((s, t) => s + t, 0) / taxasAtingimento.length)
      : 0
    const vendedoresAbaixoDaMeta = performances.filter(p => p.receitaRealizada / (p.metaReceita || 1) < 0.8).length

    return {
      periodo,
      geradoEm: agora,
      mrr,
      arr: { valor: mrrAtual * 12, variacaoPercent: mrr.variacaoPercent, tendencia: mrr.tendencia },
      churnRate: { valor: churnRate, variacaoPercent: 0, tendencia: churnRate > 5 ? 'CAINDO' : 'ESTAVEL' },
      receitaNoMes,
      oportunidadesAtivas: oportunidades.length,
      valorPipelineTotal,
      taxaConversaoGlobal,
      forecastMes,
      totalClientesAtivos: clientes.filter(c => c.status === 'ATIVO').length,
      healthScoreMedio,
      clientesEmRisco,
      diagnosticosAbertos: diagnosticos.length,
      diagnosticosCriticos,
      alertasAtivos,
      performanceMediaEquipe,
      vendedoresAbaixoDaMeta,
    }
  }
}
