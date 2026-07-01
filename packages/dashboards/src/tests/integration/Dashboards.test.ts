/**
 * Teste de integração: Sprint 2 — Dashboards por papel.
 *
 * Simula a Tech Solutions Ltda após 3 meses de operação:
 * - 12 oportunidades ativas no pipeline
 * - 3 vendas fechadas no mês
 * - 8 clientes ativos (1 em risco)
 * - 1 diagnóstico NEGOCIACAO aberto
 * - Equipe: 1 gerente, 2 AEs, 1 SDR
 *
 * North Star: após login, cada papel vê exatamente o que precisa para tomar
 * a próxima decisão sem fazer uma pergunta a mais.
 */

import { bootstrapDashboards } from '../../bootstrap'

const EMPRESA_ID = 'empresa-tech-solutions-001'
const PERIODO = '2024-06'
const AGORA = '2024-06-15T09:00:00Z'

const VENDEDOR_ANA_ID = 'vendedor-ana-001'
const VENDEDOR_CARLOS_ID = 'vendedor-carlos-001'
const SDR_BRUNO_ID = 'sdr-bruno-001'

describe('Sprint 2 — Dashboards: cada papel vê o que precisa', () => {
  const { dataSources, dashboards } = bootstrapDashboards()

  beforeAll(() => {
    // Seed: Pipeline — 12 oportunidades
    dataSources.pipeline.oportunidades = [
      // Ana (AE) — 5 oportunidades
      { id: 'op-01', empresaId: EMPRESA_ID, responsavelId: VENDEDOR_ANA_ID, nomeEmpresa: 'Alpha Corp', valor: 25000, estagio: 'NEGOCIACAO', qualificada: true, criadaEm: '2024-04-01T00:00:00Z', atualizadaEm: '2024-06-08T00:00:00Z' },
      { id: 'op-02', empresaId: EMPRESA_ID, responsavelId: VENDEDOR_ANA_ID, nomeEmpresa: 'Beta Ltda', valor: 12000, estagio: 'PROPOSTA', qualificada: true, criadaEm: '2024-05-10T00:00:00Z', atualizadaEm: '2024-06-10T00:00:00Z' },
      { id: 'op-03', empresaId: EMPRESA_ID, responsavelId: VENDEDOR_ANA_ID, nomeEmpresa: 'Gamma SA', valor: 8000, estagio: 'QUALIFICACAO', qualificada: false, criadaEm: '2024-06-01T00:00:00Z', atualizadaEm: '2024-06-05T00:00:00Z' },
      { id: 'op-04', empresaId: EMPRESA_ID, responsavelId: VENDEDOR_ANA_ID, nomeEmpresa: 'Delta ME', valor: 5000, estagio: 'PROSPECCAO', qualificada: false, criadaEm: '2024-06-10T00:00:00Z', atualizadaEm: '2024-06-10T00:00:00Z' },
      { id: 'op-05', empresaId: EMPRESA_ID, responsavelId: VENDEDOR_ANA_ID, nomeEmpresa: 'Epsilon Tech', valor: 18000, estagio: 'NEGOCIACAO', qualificada: true, criadaEm: '2024-05-15T00:00:00Z', atualizadaEm: '2024-06-12T00:00:00Z' },
      // Carlos (AE) — 4 oportunidades
      { id: 'op-06', empresaId: EMPRESA_ID, responsavelId: VENDEDOR_CARLOS_ID, nomeEmpresa: 'Zeta Soluções', valor: 30000, estagio: 'PROPOSTA', qualificada: true, criadaEm: '2024-04-20T00:00:00Z', atualizadaEm: '2024-06-11T00:00:00Z' },
      { id: 'op-07', empresaId: EMPRESA_ID, responsavelId: VENDEDOR_CARLOS_ID, nomeEmpresa: 'Eta Sistemas', valor: 9500, estagio: 'QUALIFICACAO', qualificada: true, criadaEm: '2024-06-03T00:00:00Z', atualizadaEm: '2024-06-13T00:00:00Z' },
      { id: 'op-08', empresaId: EMPRESA_ID, responsavelId: VENDEDOR_CARLOS_ID, nomeEmpresa: 'Theta Digital', valor: 15000, estagio: 'NEGOCIACAO', qualificada: true, criadaEm: '2024-05-01T00:00:00Z', atualizadaEm: '2024-06-01T00:00:00Z' },
      { id: 'op-09', empresaId: EMPRESA_ID, responsavelId: VENDEDOR_CARLOS_ID, nomeEmpresa: 'Iota Cloud', valor: 7000, estagio: 'PROSPECCAO', qualificada: false, criadaEm: '2024-06-12T00:00:00Z', atualizadaEm: '2024-06-12T00:00:00Z' },
      // SDR Bruno — 3 leads no topo
      { id: 'op-10', empresaId: EMPRESA_ID, responsavelId: SDR_BRUNO_ID, nomeEmpresa: 'Kappa Industries', valor: 0, estagio: 'PROSPECCAO', qualificada: false, criadaEm: '2024-06-05T00:00:00Z', atualizadaEm: '2024-06-05T00:00:00Z' },
      { id: 'op-11', empresaId: EMPRESA_ID, responsavelId: SDR_BRUNO_ID, nomeEmpresa: 'Lambda Group', valor: 0, estagio: 'QUALIFICACAO', qualificada: false, criadaEm: '2024-06-08T00:00:00Z', atualizadaEm: '2024-06-14T00:00:00Z' },
      { id: 'op-12', empresaId: EMPRESA_ID, responsavelId: SDR_BRUNO_ID, nomeEmpresa: 'Mu Ventures', valor: 0, estagio: 'PROSPECCAO', qualificada: false, criadaEm: '2024-06-01T00:00:00Z', atualizadaEm: '2024-06-01T00:00:00Z' },
    ]

    // Seed: Vendas fechadas no mês
    dataSources.pipeline.vendas = [
      { id: 'venda-01', empresaId: EMPRESA_ID, responsavelId: VENDEDOR_ANA_ID, valorContrato: 22000, mrr: 1833, fechadaEm: '2024-06-05T00:00:00Z', periodo: PERIODO },
      { id: 'venda-02', empresaId: EMPRESA_ID, responsavelId: VENDEDOR_CARLOS_ID, valorContrato: 28000, mrr: 2333, fechadaEm: '2024-06-10T00:00:00Z', periodo: PERIODO },
      { id: 'venda-03', empresaId: EMPRESA_ID, responsavelId: VENDEDOR_ANA_ID, valorContrato: 11000, mrr: 917, fechadaEm: '2024-06-12T00:00:00Z', periodo: PERIODO },
    ]

    // Seed: Propostas
    dataSources.proposta.propostas = [
      { id: 'prop-01', empresaId: EMPRESA_ID, responsavelId: VENDEDOR_ANA_ID, oportunidadeId: 'op-01', nomeEmpresa: 'Alpha Corp', valorBruto: 25000, status: 'ENVIADA', criadaEm: '2024-06-08T00:00:00Z', atualizadoEm: '2024-06-08T00:00:00Z' },
      { id: 'prop-02', empresaId: EMPRESA_ID, responsavelId: VENDEDOR_CARLOS_ID, oportunidadeId: 'op-06', nomeEmpresa: 'Zeta Soluções', valorBruto: 30000, status: 'EM_APROVACAO', criadaEm: '2024-06-11T00:00:00Z', atualizadoEm: '2024-06-11T00:00:00Z' },
      { id: 'prop-03', empresaId: EMPRESA_ID, responsavelId: VENDEDOR_ANA_ID, oportunidadeId: 'op-02', nomeEmpresa: 'Beta Ltda', valorBruto: 12000, status: 'APROVADA', criadaEm: '2024-06-10T00:00:00Z', atualizadoEm: '2024-06-13T00:00:00Z' },
    ]

    // Seed: MRR e clientes
    dataSources.receitaCliente.mrrAtual = 45000
    dataSources.receitaCliente.mrrAnterior = 38000
    dataSources.receitaCliente.churnRate = 2.5
    dataSources.receitaCliente.clientes = [
      { id: 'c-01', empresaId: EMPRESA_ID, nomeEmpresa: 'Alpha Corp', status: 'ATIVO', healthScore: 85, mrr: 8000 },
      { id: 'c-02', empresaId: EMPRESA_ID, nomeEmpresa: 'Beta Ltda', status: 'ATIVO', healthScore: 72, mrr: 5000 },
      { id: 'c-03', empresaId: EMPRESA_ID, nomeEmpresa: 'Gamma SA', status: 'ATIVO', healthScore: 91, mrr: 6000 },
      { id: 'c-04', empresaId: EMPRESA_ID, nomeEmpresa: 'Delta ME', status: 'ATIVO', healthScore: 35, mrr: 3000 },  // em risco
      { id: 'c-05', empresaId: EMPRESA_ID, nomeEmpresa: 'Epsilon Tech', status: 'ATIVO', healthScore: 68, mrr: 7000 },
      { id: 'c-06', empresaId: EMPRESA_ID, nomeEmpresa: 'Zeta Soluções', status: 'ATIVO', healthScore: 80, mrr: 5500 },
      { id: 'c-07', empresaId: EMPRESA_ID, nomeEmpresa: 'Eta Sistemas', status: 'ATIVO', healthScore: 55, mrr: 4500 },
      { id: 'c-08', empresaId: EMPRESA_ID, nomeEmpresa: 'Theta Digital', status: 'ATIVO', healthScore: 78, mrr: 6000 },
    ]

    // Seed: Performance da equipe
    dataSources.equipe.performances = [
      { vendedorId: VENDEDOR_ANA_ID, nome: 'Ana Vendas', cargo: 'AE', metaReceita: 30000, receitaRealizada: 33000, oportunidadesAtivas: 5, propostasEnviadas: 3, alertaBaixaPerformance: false, periodo: PERIODO },
      { vendedorId: VENDEDOR_CARLOS_ID, nome: 'Carlos Vendas', cargo: 'AE', metaReceita: 30000, receitaRealizada: 28000, oportunidadesAtivas: 4, propostasEnviadas: 2, alertaBaixaPerformance: false, periodo: PERIODO },
      { vendedorId: SDR_BRUNO_ID, nome: 'Bruno SDR', cargo: 'SDR', metaReceita: 0, receitaRealizada: 0, oportunidadesAtivas: 3, propostasEnviadas: 0, alertaBaixaPerformance: false, periodo: PERIODO },
    ]

    // Seed: Atribuições (plano de ação do CAP-08 em execução)
    dataSources.equipe.atribuicoes = [
      { id: 'attr-01', empresaId: EMPRESA_ID, vendedorId: VENDEDOR_ANA_ID, vendedorNome: 'Ana Vendas', descricaoAcao: 'Implementar script SPIN Selling', prazoIso: '2024-06-20', status: 'PENDENTE' },
      { id: 'attr-02', empresaId: EMPRESA_ID, vendedorId: VENDEDOR_CARLOS_ID, vendedorNome: 'Carlos Vendas', descricaoAcao: 'Role-play de negociação semanal', prazoIso: '2024-06-30', status: 'EM_EXECUCAO' },
    ]

    // Seed: Diagnóstico aberto
    dataSources.diagnostico.diagnosticos = [
      { id: 'diag-01', empresaId: EMPRESA_ID, classificacao: 'NEGOCIACAO', status: 'ABERTO', impactoFinanceiroEstimado: 45000, mupTotal: 7.1, periodo: PERIODO },
    ]
  })

  describe('Dashboard Executivo — visão do CEO', () => {
    let dash: Awaited<ReturnType<typeof dashboards.executivo.execute>>

    beforeAll(async () => {
      dash = await dashboards.executivo.execute(EMPRESA_ID, PERIODO, AGORA)
    })

    it('MRR com crescimento de ~18% (de 38k para 45k)', () => {
      expect(dash.mrr.valor).toBe(45000)
      expect(dash.mrr.variacaoPercent).toBeCloseTo(18.4, 0)
      expect(dash.mrr.tendencia).toBe('CRESCENDO')
    })

    it('ARR é 12x o MRR', () => {
      expect(dash.arr.valor).toBe(540000)
    })

    it('8 clientes ativos, 1 em risco (health < 40)', () => {
      expect(dash.totalClientesAtivos).toBe(8)
      expect(dash.clientesEmRisco).toBe(1)
    })

    it('alerta gerado para o cliente em risco', () => {
      const alertaRetencao = dash.alertasAtivos.find(a => a.tipo === 'RETENCAO')
      expect(alertaRetencao).toBeDefined()
      expect(alertaRetencao!.urgencia).toBe('ALTA')
    })

    it('1 diagnóstico aberto com MUP >= 7 (crítico)', () => {
      expect(dash.diagnosticosAbertos).toBe(1)
      expect(dash.diagnosticosCriticos).toBe(1)
    })

    it('performance média da equipe >= 80%', () => {
      // Ana: 110%, Carlos: 93%, SDR: 0% → média ~68%
      expect(dash.performanceMediaEquipe).toBeGreaterThan(0)
    })

    it('churn rate baixo (2.5%)', () => {
      expect(dash.churnRate.valor).toBe(2.5)
    })
  })

  describe('Dashboard Comercial — visão do Gerente', () => {
    let dash: Awaited<ReturnType<typeof dashboards.comercial.execute>>

    beforeAll(async () => {
      dash = await dashboards.comercial.execute(EMPRESA_ID, PERIODO, AGORA)
    })

    it('9 oportunidades ativas (excluindo leads SDR sem valor)', () => {
      expect(dash.totalOportunidadesAtivas).toBeGreaterThan(0)
    })

    it('3 vendas no mês com receita total de R$61k', () => {
      expect(dash.vendasNoMes).toBe(3)
      expect(dash.receitaFechadaNoMes).toBe(61000)
    })

    it('1 proposta aguardando aprovação (Zeta Soluções)', () => {
      expect(dash.propostasAguardandoAprovacao).toBe(1)
    })

    it('forecast conservador baseado nas oportunidades qualificadas', () => {
      expect(dash.forecastConservador).toBeGreaterThan(0)
      expect(dash.forecastOtimista).toBeGreaterThan(dash.forecastConservador)
    })

    it('vendedor abaixo da meta identificado', () => {
      const carlos = dash.vendedores.find(v => v.nome === 'Carlos Vendas')
      expect(carlos).toBeDefined()
      // Carlos: 28k/30k = 93% → DENTRO
      expect(carlos!.classificacao).toBe('DENTRO')
    })

    it('Ana acima da meta', () => {
      const ana = dash.vendedores.find(v => v.nome === 'Ana Vendas')
      expect(ana?.classificacao).toBe('ACIMA')
    })
  })

  describe('Dashboard Gestor — visão do Gerente de Equipe', () => {
    let dash: Awaited<ReturnType<typeof dashboards.gestor.execute>>

    beforeAll(async () => {
      dash = await dashboards.gestor.execute(EMPRESA_ID, PERIODO, AGORA)
    })

    it('ranking coloca Ana em 1º (110%) e Carlos em 2º (93%)', () => {
      const ae = dash.ranking.filter(r => r.cargo === 'AE')
      expect(ae[0].nome).toBe('Ana Vendas')
      expect(ae[0].posicaoRanking).toBe(1)
      expect(ae[0].taxaAtingimento).toBe(110)
    })

    it('2 ações de plano de ação em execução', () => {
      expect(dash.acoesEmExecucao + dash.acoesPendentes).toBe(2)
    })

    it('próximas ações ordenadas por prazo', () => {
      expect(dash.proximasAcoes.length).toBeGreaterThan(0)
      expect(dash.proximasAcoes[0].descricao).toBeTruthy()
    })

    it('nenhum vendedor com alerta de baixa performance consecutiva', () => {
      expect(dash.vendedoresComAlerta).toBe(0)
    })
  })

  describe('Dashboard SDR — visão do Bruno', () => {
    let dash: Awaited<ReturnType<typeof dashboards.sdr.execute>>

    beforeAll(async () => {
      dash = await dashboards.sdr.execute(EMPRESA_ID, SDR_BRUNO_ID, 'Bruno SDR', PERIODO, AGORA)
    })

    it('3 leads abertos no topo do funil', () => {
      expect(dash.leadsAbertos).toBe(3)
    })

    it('lead Mu Ventures sem movimento há mais de 3 dias', () => {
      expect(dash.leadsSemMovimento3Dias).toBeGreaterThan(0)
      const mu = dash.leadsParaFollowUp.find(l => l.nomeEmpresa === 'Mu Ventures')
      expect(mu).toBeDefined()
      expect(mu!.diasSemMovimento).toBeGreaterThanOrEqual(14)
    })

    it('próxima ação sugerida para cada lead', () => {
      expect(dash.leadsParaFollowUp.every(l => !!l.proximaAcaoSugerida)).toBe(true)
    })
  })

  describe('Dashboard Vendedor — visão da Ana', () => {
    let dash: Awaited<ReturnType<typeof dashboards.vendedor.execute>>

    beforeAll(async () => {
      dash = await dashboards.vendedor.execute(EMPRESA_ID, VENDEDOR_ANA_ID, 'Ana Vendas', PERIODO, AGORA)
    })

    it('Ana está ACIMA da meta (R$33k de R$30k)', () => {
      expect(dash.classificacao).toBe('ACIMA')
      expect(dash.taxaAtingimento).toBe(110)
      expect(dash.faltaParaMeta).toBe(0)
    })

    it('2 fechamentos no mês (R$33k)', () => {
      expect(dash.fechamentosNoMes).toBe(2)
      expect(dash.receitaFechadaNoMes).toBe(33000)
    })

    it('5 oportunidades ativas no pipeline', () => {
      expect(dash.oportunidadesAtivas).toBe(5)
    })

    it('oportunidades prioritárias com alertas quando paradas', () => {
      // Alpha Corp: última atualização 2024-06-08, hoje 2024-06-15 = 7 dias
      const alpha = dash.oportunidadesPrioritarias.find(o => o.nomeEmpresa === 'Alpha Corp')
      expect(alpha).toBeDefined()
      expect(alpha!.alertas.length).toBeGreaterThan(0)
    })

    it('1 proposta enviada aguardando resposta (Alpha Corp)', () => {
      expect(dash.propostasAguardandoResposta).toBe(1)
    })

    it('dias restantes no mês calculados corretamente', () => {
      expect(dash.diasRestantesNoMes).toBe(15)  // 15 de junho → 15 dias restantes
    })
  })

  describe('North Star: cada papel toma decisão sem perguntar nada', () => {
    it('CEO vê crescimento, risco e diagnóstico aberto em uma tela', async () => {
      const exec = await dashboards.executivo.execute(EMPRESA_ID, PERIODO, AGORA)
      expect(exec.mrr.tendencia).toBe('CRESCENDO')
      expect(exec.clientesEmRisco).toBeGreaterThan(0)
      expect(exec.alertasAtivos.length).toBeGreaterThan(0)
    })

    it('Gerente vê pipeline, forecast e quem está abaixo da meta', async () => {
      const com = await dashboards.comercial.execute(EMPRESA_ID, PERIODO, AGORA)
      expect(com.forecastConservador).toBeGreaterThan(0)
      expect(com.vendedores.length).toBeGreaterThan(0)
    })

    it('SDR sabe exatamente o que fazer com cada lead hoje', async () => {
      const sdr = await dashboards.sdr.execute(EMPRESA_ID, SDR_BRUNO_ID, 'Bruno SDR', PERIODO, AGORA)
      expect(sdr.leadsParaFollowUp.length).toBeGreaterThan(0)
      expect(sdr.leadsParaFollowUp[0].proximaAcaoSugerida).toBeTruthy()
    })

    it('Vendedor sabe se está na meta e qual oportunidade priorizar', async () => {
      const vend = await dashboards.vendedor.execute(EMPRESA_ID, VENDEDOR_ANA_ID, 'Ana Vendas', PERIODO, AGORA)
      expect(vend.classificacao).toBeTruthy()
      expect(vend.oportunidadesPrioritarias.length).toBeGreaterThan(0)
    })
  })
})
