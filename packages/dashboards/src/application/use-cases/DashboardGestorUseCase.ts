import { DashboardGestor, PerformanceIndividual, AcaoPendente } from '../../domain/view-models/DashboardGestor'
import { IEquipeDataSource } from '../ports/DataSources'

export class DashboardGestorUseCase {
  constructor(private readonly equipe: IEquipeDataSource) {}

  async execute(empresaId: string, periodo: string, agora: string): Promise<DashboardGestor> {
    const [performances, atribuicoes] = await Promise.all([
      this.equipe.findPerformancesNoPeriodo(empresaId, periodo),
      this.equipe.findAtribuicoesPendentes(empresaId),
    ])

    const agora_ = new Date(agora)

    const ranking: PerformanceIndividual[] = performances
      .map(p => {
        const taxaAtingimento = p.metaReceita > 0
          ? Math.round(p.receitaRealizada / p.metaReceita * 100)
          : 0
        return {
          vendedorId: p.vendedorId,
          nome: p.nome,
          cargo: p.cargo,
          posicaoRanking: 0,  // preenchido abaixo
          metaReceita: p.metaReceita,
          receitaRealizada: p.receitaRealizada,
          taxaAtingimento,
          classificacao: taxaAtingimento >= 100 ? 'ACIMA' : taxaAtingimento >= 80 ? 'DENTRO' : 'ABAIXO' as any,
          oportunidadesAtivas: p.oportunidadesAtivas,
          propostasEnviadas: p.propostasEnviadas,
          fechamentosNoMes: 0,
          alertaBaixaPerformance: p.alertaBaixaPerformance,
          planoAcaoAtivo: atribuicoes.some(a => a.vendedorId === p.vendedorId),
        }
      })
      .sort((a, b) => b.taxaAtingimento - a.taxaAtingimento)
      .map((p, idx) => ({ ...p, posicaoRanking: idx + 1 }))

    const acoesEnriquecidas = atribuicoes.map(a => {
      const prazo = new Date(a.prazoIso)
      const diasAteVencimento = Math.round((prazo.getTime() - agora_.getTime()) / 86400000)
      return {
        descricao: a.descricaoAcao,
        responsavelNome: a.vendedorNome,
        prazoIso: a.prazoIso,
        diasAteVencimento,
        atrasada: diasAteVencimento < 0,
      }
    })

    const taxas = ranking.map(r => r.taxaAtingimento)
    const performanceMediaEquipe = taxas.length > 0
      ? Math.round(taxas.reduce((s, t) => s + t, 0) / taxas.length)
      : 0

    const vendedoresComAlerta = ranking.filter(r => r.alertaBaixaPerformance)

    return {
      periodo,
      geradoEm: agora,
      totalVendedores: performances.length,
      vendedoresAtivos: performances.length,
      performanceMediaEquipe,
      ranking,
      acoesEmExecucao: atribuicoes.filter(a => a.status === 'EM_EXECUCAO').length,
      acoesPendentes: atribuicoes.filter(a => a.status === 'PENDENTE').length,
      acoesAtrasadas: acoesEnriquecidas.filter(a => a.atrasada).length,
      proximasAcoes: acoesEnriquecidas.sort((a, b) => a.diasAteVencimento - b.diasAteVencimento).slice(0, 5),
      vendedoresComAlerta: vendedoresComAlerta.length,
      nomesEmAlerta: vendedoresComAlerta.map(v => v.nome),
    }
  }
}
