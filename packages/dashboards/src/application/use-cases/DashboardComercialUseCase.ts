import { DashboardComercial, EtapaPipeline, PropostaRecente, VendedorResumido } from '../../domain/view-models/DashboardComercial'
import { IPipelineDataSource, IPropostaDataSource, IEquipeDataSource } from '../ports/DataSources'

const ETAPAS_ORDEM = ['PROSPECCAO', 'QUALIFICACAO', 'PROPOSTA', 'NEGOCIACAO', 'FECHAMENTO']

export class DashboardComercialUseCase {
  constructor(
    private readonly pipeline: IPipelineDataSource,
    private readonly proposta: IPropostaDataSource,
    private readonly equipe: IEquipeDataSource,
  ) {}

  async execute(empresaId: string, periodo: string, agora: string): Promise<DashboardComercial> {
    const [oportunidades, vendas, propostas, performances, aguardandoAprovacao] = await Promise.all([
      this.pipeline.findOportunidadesAtivas(empresaId),
      this.pipeline.findVendasNoPeriodo(empresaId, periodo),
      this.proposta.findPropostasAtivas(empresaId),
      this.equipe.findPerformancesNoPeriodo(empresaId, periodo),
      this.proposta.countAguardandoAprovacao(empresaId),
    ])

    const valorPipelineTotal = oportunidades.reduce((s, o) => s + o.valor, 0)
    const receitaFechadaNoMes = vendas.reduce((s, v) => s + v.valorContrato, 0)
    const taxaFechamento = (oportunidades.length + vendas.length) > 0
      ? Math.round((vendas.length / (oportunidades.length + vendas.length)) * 100)
      : 0
    const ticketMedioFechado = vendas.length > 0
      ? Math.round(receitaFechadaNoMes / vendas.length)
      : 0

    // Etapas do pipeline
    const etapas: EtapaPipeline[] = ETAPAS_ORDEM.map(etapa => {
      const nessa = oportunidades.filter(o => o.estagio === etapa)
      return {
        nome: etapa,
        totalOportunidades: nessa.length,
        valorTotal: nessa.reduce((s, o) => s + o.valor, 0),
        taxaConversaoEtapa: 0,  // calculado com histórico, simplificado aqui
      }
    }).filter(e => e.totalOportunidades > 0)

    // Ciclo médio em dias
    const agora_ = new Date(agora)
    const cicloMedioDias = oportunidades.length > 0
      ? Math.round(
          oportunidades.reduce((s, o) => s + (agora_.getTime() - new Date(o.criadaEm).getTime()) / 86400000, 0)
          / oportunidades.length
        )
      : 0

    // Forecast
    const valorQualificadas = oportunidades.filter(o => o.qualificada).reduce((s, o) => s + o.valor, 0)
    const forecastConservador = Math.round(valorQualificadas * 0.5)
    const forecastOtimista = Math.round(valorQualificadas * 0.8)

    // Propostas recentes
    const propostasRecentes: PropostaRecente[] = propostas.slice(0, 5).map(p => ({
      oportunidadeNome: p.nomeEmpresa,
      valorBruto: p.valorBruto,
      status: p.status,
      diasEmAberto: Math.round((agora_.getTime() - new Date(p.criadaEm).getTime()) / 86400000),
    }))

    // Vendedores
    const vendedores: VendedorResumido[] = performances.map(p => ({
      nome: p.nome,
      taxaAtingimentoMeta: p.metaReceita > 0 ? Math.round(p.receitaRealizada / p.metaReceita * 100) : 0,
      classificacao: p.receitaRealizada >= p.metaReceita ? 'ACIMA'
        : p.receitaRealizada >= p.metaReceita * 0.8 ? 'DENTRO' : 'ABAIXO',
      oportunidadesAtivas: p.oportunidadesAtivas,
    }))

    return {
      periodo,
      geradoEm: agora,
      totalOportunidadesAtivas: oportunidades.length,
      valorTotalPipeline: valorPipelineTotal,
      etapas,
      cicloMedioDias,
      vendasNoMes: vendas.length,
      receitaFechadaNoMes,
      taxaFechamento,
      ticketMedioFechado,
      propostasEmAberto: propostas.length,
      propostasAguardandoAprovacao: aguardandoAprovacao,
      propostasRecentes,
      forecastConservador,
      forecastOtimista,
      vendedores,
      vendedoresAbaixoDaMeta: vendedores.filter(v => v.classificacao === 'ABAIXO').length,
    }
  }
}
