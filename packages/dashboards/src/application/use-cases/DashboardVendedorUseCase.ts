import { DashboardVendedor, OportunidadePrioritaria, PropostaEmAberto } from '../../domain/view-models/DashboardVendedor'
import { IPipelineDataSource, IPropostaDataSource, IEquipeDataSource } from '../ports/DataSources'

export class DashboardVendedorUseCase {
  constructor(
    private readonly pipeline: IPipelineDataSource,
    private readonly proposta: IPropostaDataSource,
    private readonly equipe: IEquipeDataSource,
  ) {}

  async execute(empresaId: string, vendedorId: string, vendedorNome: string, periodo: string, agora: string): Promise<DashboardVendedor> {
    const [oportunidades, vendas, propostas, performances] = await Promise.all([
      this.pipeline.findOportunidadesPorResponsavel(empresaId, vendedorId),
      this.pipeline.findVendasNoPeriodo(empresaId, periodo),
      this.proposta.findPropostasPorResponsavel(empresaId, vendedorId),
      this.equipe.findPerformancesNoPeriodo(empresaId, periodo),
    ])

    const agora_ = new Date(agora)
    const meuPerf = performances.find(p => p.vendedorId === vendedorId)

    const metaReceita = meuPerf?.metaReceita ?? 0
    const receitaRealizada = meuPerf?.receitaRealizada ?? 0
    const taxaAtingimento = metaReceita > 0 ? Math.round(receitaRealizada / metaReceita * 100) : 0
    const classificacao = taxaAtingimento >= 100 ? 'ACIMA' : taxaAtingimento >= 80 ? 'DENTRO' : 'ABAIXO'

    const minhasVendas = vendas.filter(v => v.responsavelId === vendedorId)
    const receitaFechadaNoMes = minhasVendas.reduce((s, v) => s + v.valorContrato, 0)

    const oportunidadesAtivas = oportunidades.filter(o =>
      !['FECHAMENTO'].includes(o.estagio) || o.qualificada
    )
    const valorPipelineTotal = oportunidadesAtivas.reduce((s, o) => s + o.valor, 0)

    const oportunidadesPrioritarias: OportunidadePrioritaria[] = oportunidadesAtivas
      .map(o => {
        const diasNaEtapa = Math.round((agora_.getTime() - new Date(o.atualizadaEm).getTime()) / 86400000)
        const alertas: string[] = []
        if (diasNaEtapa >= 7) alertas.push(`${diasNaEtapa} dias sem atualização`)
        if (o.estagio === 'NEGOCIACAO' && diasNaEtapa >= 5) alertas.push('Negociação parada — intervir')

        return {
          id: o.id,
          nomeEmpresa: o.nomeEmpresa,
          valor: o.valor,
          estagio: o.estagio,
          probabilidade: o.qualificada ? 60 : 20,
          diasNaEtapa,
          alertas,
        }
      })
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5)

    const propostasEmAberto: PropostaEmAberto[] = propostas
      .filter(p => ['RASCUNHO', 'EM_APROVACAO', 'APROVADA', 'ENVIADA'].includes(p.status))
      .map(p => ({
        id: p.id,
        nomeEmpresa: p.nomeEmpresa,
        valor: p.valorBruto,
        status: p.status,
        diasAguardando: Math.round((agora_.getTime() - new Date(p.criadaEm).getTime()) / 86400000),
      }))

    // Dias restantes no mês
    const fimDoMes = new Date(agora_.getFullYear(), agora_.getMonth() + 1, 0)
    const diasRestantesNoMes = Math.max(0, Math.round((fimDoMes.getTime() - agora_.getTime()) / 86400000))

    return {
      periodo,
      geradoEm: agora,
      vendedorId,
      vendedorNome,
      metaReceita,
      receitaRealizada,
      taxaAtingimento,
      classificacao,
      faltaParaMeta: Math.max(0, metaReceita - receitaRealizada),
      diasRestantesNoMes,
      oportunidadesAtivas: oportunidadesAtivas.length,
      valorPipelineTotal,
      oportunidadesPrioritarias,
      propostasEmAberto,
      propostasAguardandoResposta: propostas.filter(p => p.status === 'ENVIADA').length,
      fechamentosNoMes: minhasVendas.length,
      receitaFechadaNoMes,
      ticketMedio: minhasVendas.length > 0 ? Math.round(receitaFechadaNoMes / minhasVendas.length) : 0,
      acoesPendentesHoje: 0,  // viria das atribuições do CAP-08/07
    }
  }
}
