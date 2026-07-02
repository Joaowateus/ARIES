import { v4 as uuidv4 } from 'uuid'
import { bootstrapInteligencia } from '../../bootstrap'
import { KpiSnapshotProps, DiagnosticoProps, ActionPlanProps, DecisaoRecordProps } from '@soe/cap-08'
import { AuditoriaEventoProps } from '@soe/cap-09'

// ─── Cenário: Tech Solutions Ltda — Julho 2026 ─────────────────────────────
// Incidente NEGOCIACAO: taxa_fechamento caiu 42% em relação ao baseline.
// O ciclo médio aumentou. O diagnóstico classificou como NEGOCIACAO.
// Foi criado um plano com 3 ações. Uma decisão foi tomada e registrada como EFETIVO.

const PERIODO = '2026-07'
const AGORA   = '2026-07-01T09:00:00.000Z'

const DIAG_ID  = uuidv4()
const PLANO_ID = uuidv4()
const DEC_ID   = uuidv4()
const SNAP1_ID = uuidv4()
const SNAP2_ID = uuidv4()
const SNAP3_ID = uuidv4()  // sem anomalia (background noise)

const ACAO1_ID = uuidv4()
const ACAO2_ID = uuidv4()
const ACAO3_ID = uuidv4()

const snapshots: KpiSnapshotProps[] = [
  {
    id: SNAP1_ID,
    kpiNome: 'taxa_fechamento',
    dominio: 'VENDAS',
    valor: 12,
    baseline: 22,
    periodo: PERIODO,
    anomalia: { detectada: true, desvioPercent: 45.45, direcao: 'QUEDA', severidade: 'CRITICA' },
    registradoEm: AGORA,
  },
  {
    id: SNAP2_ID,
    kpiNome: 'ciclo_medio_dias',
    dominio: 'VENDAS',
    valor: 38,
    baseline: 25,
    periodo: PERIODO,
    anomalia: { detectada: true, desvioPercent: 52, direcao: 'ALTA', severidade: 'CRITICA' },
    registradoEm: AGORA,
  },
  {
    id: SNAP3_ID,
    kpiNome: 'mrr_total',
    dominio: 'RECEITA',
    valor: 45000,
    baseline: 44000,
    periodo: PERIODO,
    anomalia: undefined,   // sem anomalia
    registradoEm: AGORA,
  },
]

const diagnostico: DiagnosticoProps = {
  id: DIAG_ID,
  periodo: PERIODO,
  kpisAfetados: ['taxa_fechamento', 'ciclo_medio_dias'],
  classificacao: 'NEGOCIACAO',
  hipoteses: [
    {
      descricao: 'Pipeline acumula oportunidades em negociação sem avanço — equipe precisa de playbook de fechamento',
      confianca: 85,
      evidencias: ['taxa_fechamento -45%', 'ciclo_medio_dias +52%'],
    },
    {
      descricao: 'Condições de mercado desfavoráveis atrasando decisão de compra',
      confianca: 40,
      evidencias: ['ciclo_medio_dias +52%'],
    },
  ],
  impactoFinanceiroEstimado: 180000,
  mupScore: { impacto: 8, urgencia: 9, esforco: 4, bloqueadores: 7, total: 7.9 },
  status: 'RESOLVIDO',
  planoAcaoId: PLANO_ID,
  geradoEm: AGORA,
  atualizadoEm: '2026-07-15T10:00:00.000Z',
  resolvidoEm: '2026-07-28T00:00:00.000Z',
}

const plano: ActionPlanProps = {
  id: PLANO_ID,
  diagnosticoId: DIAG_ID,
  titulo: 'Plano de Correção — Negociação Jul/26',
  status: 'CONCLUIDO',
  criadoPor: 'gerente-carlos-001',
  criadoEm: '2026-07-03T09:00:00.000Z',
  atualizadoEm: '2026-07-25T09:00:00.000Z',
  concluidoEm: '2026-07-25T09:00:00.000Z',
  acoes: [
    {
      id: ACAO1_ID,
      descricao: 'Treinar equipe em técnicas de fechamento (SPIN Selling)',
      responsavelId: 'gerente-carlos-001',
      prazoIso: '2026-07-10',
      criterioSucesso: 'Todos os vendedores AE certificados na metodologia',
      status: 'CONCLUIDA',
      resultadoReal: 'Treinamento concluído — 4 AEs certificados',
      concluidaEm: '2026-07-09T18:00:00.000Z',
    },
    {
      id: ACAO2_ID,
      descricao: 'Implementar daily de pipeline com foco em oportunidades > 30 dias paradas',
      responsavelId: 'gerente-carlos-001',
      prazoIso: '2026-07-07',
      criterioSucesso: 'Daily operando por 3 semanas consecutivas',
      status: 'CONCLUIDA',
      resultadoReal: 'Daily iniciada em 06/07 — mantida por 3 semanas',
      concluidaEm: '2026-07-25T09:00:00.000Z',
    },
    {
      id: ACAO3_ID,
      descricao: 'Revisar proposta das 5 oportunidades com ciclo > 45 dias',
      responsavelId: 'ana-vendedora-001',
      prazoIso: '2026-07-12',
      criterioSucesso: '≥ 3 oportunidades avançadas ou descartadas',
      status: 'CONCLUIDA',
      resultadoReal: '3 oportunidades fechadas + 2 descartadas com motivo registrado',
      concluidaEm: '2026-07-11T17:00:00.000Z',
    },
  ],
}

const decisao: DecisaoRecordProps = {
  id: DEC_ID,
  diagnosticoId: DIAG_ID,
  planoAcaoId: PLANO_ID,
  classificacao: 'NEGOCIACAO',
  periodo: PERIODO,
  decisaoTomada: 'Aplicar playbook SPIN Selling + daily de pipeline + revisão imediata de oportunidades paradas',
  resultadoEsperado: 'Recuperar taxa de fechamento para ≥ 18% em 30 dias',
  resultadoReal: 'Taxa de fechamento atingiu 21% em 25 dias',
  resultado: 'EFETIVO',
  aprendizado: {
    insight: 'Oportunidades sem movimento > 20 dias têm 85% de probabilidade de perda — intervenção precoce é crítica',
    recomendacao: 'Criar alerta automático para oportunidades sem atualização há 15 dias',
    alterarPlaybook: true,
    alteracaoSugerida: 'Adicionar gatilho de alerta em 15 dias sem movimento no CAP-08 (threshold LEVE)',
  },
  registradoEm: '2026-07-03T09:00:00.000Z',
  fechadoEm: '2026-07-28T00:00:00.000Z',
}

const auditoria: AuditoriaEventoProps[] = [
  { id: uuidv4(), categoria: 'CONFIGURACAO', acao: 'DIAGNOSTICO_GERADO', entidadeTipo: 'Diagnostico', entidadeId: DIAG_ID, realizadoPor: 'sistema-cap-08', payload: { classificacao: 'NEGOCIACAO' }, ocorridoEm: AGORA },
  { id: uuidv4(), categoria: 'CONFIGURACAO', acao: 'PLANO_CRIADO', entidadeTipo: 'ActionPlan', entidadeId: PLANO_ID, realizadoPor: 'gerente-carlos-001', payload: { diagnosticoId: DIAG_ID }, ocorridoEm: '2026-07-03T09:00:00.000Z' },
  { id: uuidv4(), categoria: 'GOVERNANCA', acao: 'DECISAO_REGISTRADA', entidadeTipo: 'DecisaoRecord', entidadeId: DEC_ID, realizadoPor: 'gerente-carlos-001', payload: { decisao: 'SPIN Selling' }, ocorridoEm: '2026-07-03T09:30:00.000Z' },
  { id: uuidv4(), categoria: 'DADO_SENSIVEL', acao: 'PROPOSTA_REVISADA', entidadeTipo: 'Empresa', entidadeId: 'empresa-001', realizadoPor: 'ana-vendedora-001', payload: {}, ocorridoEm: '2026-07-11T17:00:00.000Z' },
  { id: uuidv4(), categoria: 'ACESSO', acao: 'LOGIN', entidadeTipo: 'Sessao', entidadeId: 'sess-001', realizadoPor: 'gerente-carlos-001', payload: {}, ocorridoEm: '2026-07-01T08:00:00.000Z' },
]

// ─── Setup ────────────────────────────────────────────────────────────────────

describe('Sprint 5 — Centro de Inteligência: surface layer sobre CAP-08 e CAP-09', () => {
  let app: ReturnType<typeof bootstrapInteligencia>

  beforeEach(() => {
    app = bootstrapInteligencia()
    app.sources.alertaSource.snapshots = snapshots
    app.sources.diagnosticoSource.diagnosticos = [diagnostico]
    app.sources.planoSource.planos = [plano]
    app.sources.decisaoSource.decisoes = [decisao]
    app.sources.auditoriaSource.eventos = auditoria
  })

  // ─── Critério 1: Centro de Alertas ────────────────────────────────────────
  describe('1. Centro de Alertas', () => {
    it('retorna apenas snapshots com anomalia detectada (exclui MRR sem anomalia)', async () => {
      const result = await app.useCases.consultarAlertas.execute()
      expect(result.total).toBe(2)
      expect(result.alertas.every(a => a.severidade !== undefined)).toBe(true)
    })

    it('ordena alertas CRITICA primeiro', async () => {
      const result = await app.useCases.consultarAlertas.execute()
      expect(result.alertas[0].severidade).toBe('CRITICA')
    })

    it('sumariza por severidade', async () => {
      const result = await app.useCases.consultarAlertas.execute()
      expect(result.porSeveridade.CRITICA).toBe(2)
      expect(result.porSeveridade.LEVE).toBe(0)
    })

    it('filtra por período', async () => {
      const result = await app.useCases.consultarAlertas.execute({ periodo: '2026-06' })
      expect(result.total).toBe(0)
    })

    it('filtra por domínio', async () => {
      const result = await app.useCases.consultarAlertas.execute({ dominio: 'RECEITA' })
      expect(result.total).toBe(0) // RECEITA/MRR não tem anomalia
    })

    it('filtra por severidade CRITICA', async () => {
      const result = await app.useCases.consultarAlertas.execute({ severidade: ['CRITICA'] })
      expect(result.total).toBe(2)
      expect(result.alertas.every(a => a.severidade === 'CRITICA')).toBe(true)
    })
  })

  // ─── Critério 2: Centro de Diagnósticos ──────────────────────────────────
  describe('2. Centro de Diagnósticos', () => {
    it('retorna diagnóstico com hipótese principal (maior confiança)', async () => {
      const result = await app.useCases.consultarDiagnosticos.execute()
      expect(result.total).toBe(1)
      expect(result.diagnosticos[0].hipotesePrincipal.confianca).toBe(85)
    })

    it('expõe MUP score completo e classificação', async () => {
      const result = await app.useCases.consultarDiagnosticos.execute()
      const d = result.diagnosticos[0]
      expect(d.mupScore.total).toBe(7.9)
      expect(d.classificacao).toBe('NEGOCIACAO')
    })

    it('ordena por prioridade (rank 1 = maior MUP)', async () => {
      const result = await app.useCases.consultarDiagnosticos.execute()
      expect(result.diagnosticos[0].prioridade).toBe(1)
    })

    it('conta por status', async () => {
      const result = await app.useCases.consultarDiagnosticos.execute()
      expect(result.resolvidos).toBe(1)
      expect(result.abertos).toBe(0)
    })

    it('filtra por status ABERTO', async () => {
      const result = await app.useCases.consultarDiagnosticos.execute({ status: ['ABERTO'] })
      expect(result.total).toBe(0)
    })

    it('busca diagnóstico por id', async () => {
      const d = await app.sources.diagnosticoSource.findById(DIAG_ID)
      expect(d!.id).toBe(DIAG_ID)
      expect(d!.kpisAfetados).toContain('taxa_fechamento')
    })
  })

  // ─── Critério 3: Centro de Planos de Ação ────────────────────────────────
  describe('3. Centro de Planos de Ação', () => {
    it('retorna plano com % concluído calculado', async () => {
      const result = await app.useCases.acompanharPlanos.execute()
      expect(result.total).toBe(1)
      expect(result.planos[0].percentualConcluido).toBe(100)
    })

    it('conta por status', async () => {
      const result = await app.useCases.acompanharPlanos.execute()
      expect(result.concluidos).toBe(1)
      expect(result.ativos).toBe(0)
    })

    it('filtra por status ATIVO retorna vazio', async () => {
      const result = await app.useCases.acompanharPlanos.execute({ status: ['ATIVO'] })
      expect(result.total).toBe(0)
    })

    it('plano expõe responsável e 3 ações com critérios de sucesso', async () => {
      const result = await app.useCases.acompanharPlanos.execute()
      const plano = result.planos[0]
      expect(plano.criadoPor).toBe('gerente-carlos-001')
      expect(plano.acoes).toHaveLength(3)
      expect(plano.acoes.every(a => !!a.criterioSucesso)).toBe(true)
    })

    it('plano concluído tem concluidoEm preenchido', async () => {
      const result = await app.useCases.acompanharPlanos.execute()
      expect(result.planos[0].concluidoEm).toBe('2026-07-25T09:00:00.000Z')
    })
  })

  // ─── Critério 4: Centro de Decisões ──────────────────────────────────────
  describe('4. Centro de Decisões', () => {
    it('retorna decisão com resultado EFETIVO', async () => {
      const result = await app.useCases.consultarDecisoes.execute()
      expect(result.total).toBe(1)
      expect(result.decisoes[0].resultado).toBe('EFETIVO')
    })

    it('calcula taxa de efetividade 100%', async () => {
      const result = await app.useCases.consultarDecisoes.execute()
      expect(result.taxaEfetividade).toBe(100)
      expect(result.efetivas).toBe(1)
    })

    it('expõe justificativa e resultado real', async () => {
      const result = await app.useCases.consultarDecisoes.execute()
      const d = result.decisoes[0]
      expect(d.decisaoTomada).toContain('SPIN Selling')
      expect(d.resultadoReal).toContain('21%')
    })

    it('filtra por classificação NEGOCIACAO', async () => {
      const result = await app.useCases.consultarDecisoes.execute({ classificacao: 'NEGOCIACAO' })
      expect(result.total).toBe(1)
    })

    it('filtra por resultado PARCIAL retorna vazio', async () => {
      const result = await app.useCases.consultarDecisoes.execute({ resultado: 'PARCIAL' })
      expect(result.total).toBe(0)
    })
  })

  // ─── Critério 5: Centro de Auditoria ────────────────────────────────────
  describe('5. Centro de Auditoria', () => {
    it('retorna 5 eventos de auditoria de múltiplos módulos', async () => {
      const result = await app.useCases.consultarAuditoria.execute()
      expect(result.total).toBe(5)
    })

    it('ordena por data decrescente', async () => {
      const result = await app.useCases.consultarAuditoria.execute()
      for (let i = 1; i < result.eventos.length; i++) {
        expect(result.eventos[i - 1].ocorridoEm >= result.eventos[i].ocorridoEm).toBe(true)
      }
    })

    it('agrupa por módulo (CAP-08 e Implantação presentes)', async () => {
      const result = await app.useCases.consultarAuditoria.execute()
      expect(result.porModulo['CAP-08']).toBeGreaterThanOrEqual(2)
      expect(result.porModulo['Implantação']).toBeGreaterThanOrEqual(1)
    })

    it('filtra por realizadoPor', async () => {
      const result = await app.useCases.consultarAuditoria.execute({ realizadoPor: 'gerente-carlos-001' })
      expect(result.total).toBe(3) // plano + decisão + login
    })

    it('filtra por categoria GOVERNANCA', async () => {
      const result = await app.useCases.consultarAuditoria.execute({ categoria: 'GOVERNANCA' })
      expect(result.total).toBe(1)
      expect(result.eventos[0].acao).toBe('DECISAO_REGISTRADA')
    })

    it('filtra por entidadeTipo ActionPlan', async () => {
      const result = await app.useCases.consultarAuditoria.execute({ entidadeTipo: 'ActionPlan' })
      expect(result.total).toBe(1)
      expect(result.eventos[0].entidadeId).toBe(PLANO_ID)
    })
  })

  // ─── Critério 6: Timeline do Incidente ───────────────────────────────────
  describe('6. Rastrear timeline completa de um incidente', () => {
    it('monta o ciclo completo: alerta → diagnóstico → plano → decisão → aprendizado', async () => {
      const timeline = await app.useCases.rastrearTimeline.execute(DIAG_ID)

      expect(timeline.incidenteId).toBe(DIAG_ID)
      expect(timeline.alerta).toBeDefined()
      expect(timeline.diagnostico).toBeDefined()
      expect(timeline.planoAcao).toBeDefined()
      expect(timeline.decisao).toBeDefined()
      expect(timeline.aprendizado).toBeDefined()
    })

    it('responde: O que aconteceu? — alerta com KPI e desvio', async () => {
      const { alerta } = await app.useCases.rastrearTimeline.execute(DIAG_ID)
      expect(alerta!.kpiNome).toBe('taxa_fechamento')
      expect(alerta!.desvioPercent).toBeGreaterThan(40)
      expect(alerta!.direcao).toBe('QUEDA')
    })

    it('responde: Por que aconteceu? — hipótese principal com 85% confiança', async () => {
      const { diagnostico } = await app.useCases.rastrearTimeline.execute(DIAG_ID)
      expect(diagnostico.hipotesePrincipal.confianca).toBe(85)
      expect(diagnostico.hipotesePrincipal.descricao).toContain('playbook de fechamento')
    })

    it('responde: Qual o impacto? — R$180k estimado', async () => {
      const { diagnostico } = await app.useCases.rastrearTimeline.execute(DIAG_ID)
      expect(diagnostico.impactoFinanceiroEstimado).toBe(180000)
    })

    it('responde: Quem está responsável? — gerente-carlos e ana-vendedora', async () => {
      const { planoAcao } = await app.useCases.rastrearTimeline.execute(DIAG_ID)
      expect(planoAcao!.criadoPor).toBe('gerente-carlos-001')
      const responsaveis = planoAcao!.acoes.map(a => a.responsavelId)
      expect(responsaveis).toContain('ana-vendedora-001')
    })

    it('responde: O que está sendo feito? — 3 ações todas concluídas', async () => {
      const { planoAcao } = await app.useCases.rastrearTimeline.execute(DIAG_ID)
      expect(planoAcao!.acoes).toHaveLength(3)
      expect(planoAcao!.percentualConcluido).toBe(100)
      expect(planoAcao!.acoes.every(a => a.status === 'CONCLUIDA')).toBe(true)
    })

    it('responde: Qual decisão foi tomada? — SPIN Selling + daily', async () => {
      const { decisao } = await app.useCases.rastrearTimeline.execute(DIAG_ID)
      expect(decisao!.decisaoTomada).toContain('SPIN Selling')
      expect(decisao!.decisaoTomada).toContain('daily')
    })

    it('responde: Qual foi o resultado? — EFETIVO, 21% em 25 dias', async () => {
      const { decisao } = await app.useCases.rastrearTimeline.execute(DIAG_ID)
      expect(decisao!.resultado).toBe('EFETIVO')
      expect(decisao!.resultadoReal).toContain('21%')
    })

    it('responde: O que o sistema aprendeu? — insight e recomendação', async () => {
      const { aprendizado } = await app.useCases.rastrearTimeline.execute(DIAG_ID)
      expect(aprendizado!.insight).toContain('85%')
      expect(aprendizado!.recomendacao).toContain('15 dias')
      expect(aprendizado!.alterarPlaybook).toBe(true)
    })

    it('status global reflete o diagnóstico (RESOLVIDO)', async () => {
      const timeline = await app.useCases.rastrearTimeline.execute(DIAG_ID)
      expect(timeline.statusGlobal).toBe('RESOLVIDO')
    })

    it('lança erro para diagnóstico inexistente', async () => {
      await expect(app.useCases.rastrearTimeline.execute('id-inexistente'))
        .rejects.toThrow('não encontrado')
    })
  })

  // ─── Critério 7 & 8: Sem lógica duplicada, dados exclusivos dos CAPs ─────
  describe('7 & 8. Sem lógica de negócio duplicada — dados exclusivos dos CAPs', () => {
    it('não recalcula MUP — usa exatamente o valor persistido pelo CAP-08', async () => {
      const result = await app.useCases.consultarDiagnosticos.execute()
      // O mupScore.total (7.9) foi calculado pelo CAP-08, não recalculado aqui
      expect(result.diagnosticos[0].mupScore.total).toBe(7.9)
    })

    it('não reclassifica anomalia — usa severidade persistida pelo CAP-08', async () => {
      const result = await app.useCases.consultarAlertas.execute()
      // CRITICA foi calculada pelo CAP-08 (detectarAnomalia), não pelo inteligencia
      expect(result.alertas.every(a => ['LEVE', 'MODERADA', 'CRITICA'].includes(a.severidade))).toBe(true)
    })

    it('não recomputa aprendizado — usa exatamente o que o CAP-08 registrou', async () => {
      const timeline = await app.useCases.rastrearTimeline.execute(DIAG_ID)
      // O aprendizado é o mesmo objeto que o CAP-08 registrou em DecisaoRecord
      expect(timeline.aprendizado!.alteracaoSugerida).toContain('CAP-08')
    })

    it('timeline agrega sem transformar — todos os IDs batem com os originais', async () => {
      const timeline = await app.useCases.rastrearTimeline.execute(DIAG_ID)
      expect(timeline.diagnostico.id).toBe(DIAG_ID)
      expect(timeline.planoAcao!.id).toBe(PLANO_ID)
      expect(timeline.decisao!.id).toBe(DEC_ID)
    })
  })
})
