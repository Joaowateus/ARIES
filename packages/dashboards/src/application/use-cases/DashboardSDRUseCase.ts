import { DashboardSDR, LeadParaAcao } from '../../domain/view-models/DashboardSDR'
import { IPipelineDataSource } from '../ports/DataSources'

export class DashboardSDRUseCase {
  constructor(private readonly pipeline: IPipelineDataSource) {}

  async execute(empresaId: string, sdrId: string, sdrNome: string, periodo: string, agora: string): Promise<DashboardSDR> {
    const [todasOportunidades, vendasNoPeriodo, leadsQualificados] = await Promise.all([
      this.pipeline.findOportunidadesPorResponsavel(empresaId, sdrId),
      this.pipeline.findVendasNoPeriodo(empresaId, periodo),
      this.pipeline.countLeadsQualificados(empresaId, periodo),
    ])

    const agora_ = new Date(agora)

    const leadsAbertos = todasOportunidades.filter(o =>
      ['PROSPECCAO', 'QUALIFICACAO'].includes(o.estagio)
    )

    const leadsTransferidos = todasOportunidades.filter(o =>
      ['PROPOSTA', 'NEGOCIACAO', 'FECHAMENTO'].includes(o.estagio)
    ).length

    const taxaQualificacao = leadsAbertos.length > 0
      ? Math.round((leadsQualificados / (leadsAbertos.length + leadsQualificados)) * 100)
      : 0

    const leadsParaFollowUp: LeadParaAcao[] = leadsAbertos
      .map(o => ({
        oportunidadeId: o.id,
        nomeEmpresa: o.nomeEmpresa,
        estagio: o.estagio,
        diasSemMovimento: Math.round((agora_.getTime() - new Date(o.atualizadaEm).getTime()) / 86400000),
        proximaAcaoSugerida: o.estagio === 'PROSPECCAO' ? 'Fazer primeira abordagem' : 'Realizar reunião de qualificação BANT',
      }))
      .sort((a, b) => b.diasSemMovimento - a.diasSemMovimento)
      .slice(0, 10)

    const leadsSemMovimento3Dias = leadsAbertos.filter(o => {
      const dias = (agora_.getTime() - new Date(o.atualizadaEm).getTime()) / 86400000
      return dias >= 3
    }).length

    const taxaBant = leadsAbertos.length > 0
      ? Math.round((leadsAbertos.filter(o => o.qualificada).length / leadsAbertos.length) * 100)
      : 0

    return {
      periodo,
      geradoEm: agora,
      sdrId,
      sdrNome,
      leadsAbertos: leadsAbertos.length,
      leadsQualificadosNoMes: leadsQualificados,
      leadsTransferidosParaAE: leadsTransferidos,
      taxaQualificacao,
      metaLeads: 20,  // padrão — em produção viria da ConfiguracaoSistema do CAP-09
      atingimentoMeta: Math.round((leadsQualificados / 20) * 100),
      leadsParaFollowUp,
      leadsSemMovimento3Dias,
      taxaBant,
      cicloMedioQualificacaoDias: leadsAbertos.length > 0
        ? Math.round(leadsAbertos.reduce((s, o) =>
            s + (agora_.getTime() - new Date(o.criadaEm).getTime()) / 86400000, 0
          ) / leadsAbertos.length)
        : 0,
    }
  }
}
