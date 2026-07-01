/**
 * Teste de integração: Lead → Pipeline → Qualificação → Fechamento
 *
 * Prova que CAP-02 e CAP-03 colaboram corretamente via contratos de dados,
 * e que o evento cap03.oportunidade.ganha tem o payload completo (ADR-0006)
 * necessário para CAP-04 (receita) e CAP-05 (onboarding) agirem sem queries.
 *
 * Este é o PRIMEIRO FLUXO DE NEGÓCIO COMPLETO do Commercial OS.
 */

import { bootstrapCap02 } from '../../../cap-02/src/bootstrap'
import { bootstrapCap03 } from '../../src/bootstrap'
import { OportunidadeGanhaPayload } from '../../src/infrastructure/events/cap03-events'

const AGORA = '2026-01-15T00:00:00.000Z'

describe('[INTEGRAÇÃO] Fluxo: Lead → Pipeline → Qualificação → Fechamento', () => {
  let cap02: ReturnType<typeof bootstrapCap02>
  let cap03: ReturnType<typeof bootstrapCap03>

  beforeEach(() => {
    cap02 = bootstrapCap02()
    cap03 = bootstrapCap03()
  })

  it('executa o ciclo de venda completo e gera evento oportunidade.ganha', async () => {
    // ── FASE 1: CAP-02 — Criar oportunidade no pipeline ──────────────────────
    const op = await cap02.criarOportunidade.execute({
      titulo: 'Enterprise Deal — TechCorp',
      clienteId: 'cli-techcorp',
      responsavelId: 'rep-joao',
      prioridade: 'alta',
      valorEstimado: 120_000,
      segmentoId: 'seg-enterprise',
      probabilidade: 40,
      dataFechamentoPrevista: '2026-03-31T00:00:00.000Z',
      criadoPor: 'rep-joao',
      agora: AGORA,
    })

    expect(op.estagio).toBe('PROSPECCAO')

    // ── FASE 2: CAP-02 — Avançar pelos estágios do pipeline ─────────────────
    await cap02.avancarEstagio.execute(op.id, AGORA)    // → QUALIFICACAO
    await cap02.avancarEstagio.execute(op.id, AGORA)    // → PROPOSTA
    await cap02.avancarEstagio.execute(op.id, AGORA)    // → NEGOCIACAO

    const opEmNegociacao = await cap02.opRepo.findById(op.id)
    expect(opEmNegociacao?.estagio).toBe('NEGOCIACAO')

    // ── FASE 3: CAP-03 — Qualificar a oportunidade (BANT) ────────────────────
    const qualificacao = await cap03.qualificarOportunidade.execute({
      oportunidadeId: op.id,
      criteriosAtendidos: ['BUDGET', 'AUTHORITY', 'NEED', 'TIMELINE'],
      observacoes: 'BANT 100%: CFO engajado, orçamento aprovado, go-live Q2',
      qualificadoPor: 'rep-joao',
      agora: AGORA,
    })

    expect(qualificacao.status).toBe('QUALIFICADA')
    expect(qualificacao.scoreQualificacao).toBe(100)

    // ── FASE 4: CAP-03 — Fechar a venda ─────────────────────────────────────
    const { dealClose, eventPayload } = await cap03.fecharVenda.execute({
      oportunidadeId: op.id,
      clienteId: 'cli-techcorp',
      valorTotal: 120_000,
      mrr: 10_000,
      segmentoId: 'seg-enterprise',
      cicloDias: 45,
      dataInicio: '2026-04-01T00:00:00.000Z',
      dataFim: '2027-04-01T00:00:00.000Z',
      formaPagamento: 'MENSAL',
      condicoesJson: { desconto: '5%', sla: '99.9%' },
      responsavelCsId: 'cs-maria',
      fechadoPor: 'rep-joao',
      agora: AGORA,
    })

    expect(dealClose.resultado).toBe('GANHA')
    expect(dealClose.mrr).toBe(10_000)

    // ── FASE 5: Sincronizar encerramento no CAP-02 ───────────────────────────
    await cap02.encerrarOportunidade.execute({
      opId: op.id,
      resultado: 'ganha',
      motivo: 'Contrato assinado — Enterprise Deal TechCorp',
      agora: AGORA,
    })

    const opFinal = await cap02.opRepo.findById(op.id)
    expect(opFinal?.estagio).toBe('GANHA')
    expect(opFinal?.estaEncerrada()).toBe(true)

    // ── FASE 6: Validar payload ADR-0006 ─────────────────────────────────────
    // Payload deve ser auto-contido: CAP-04 e CAP-05 podem agir sem queries
    const parseResult = OportunidadeGanhaPayload.safeParse(eventPayload)
    expect(parseResult.success).toBe(true)

    expect(eventPayload).toMatchObject({
      oportunidade_id: op.id,
      cliente_id: 'cli-techcorp',
      valor_total: 120_000,
      mrr: 10_000,
      segmento_id: 'seg-enterprise',
      responsavel_cs_id: 'cs-maria',
      forma_pagamento: 'MENSAL',
      data_inicio: '2026-04-01T00:00:00.000Z',
      data_fim: '2027-04-01T00:00:00.000Z',
    })

    // Confirma campos que CAP-04 precisa para criar contrato
    expect(eventPayload.valor_total).toBeGreaterThan(0)
    expect(eventPayload.mrr).toBeGreaterThan(0)
    expect(eventPayload.data_inicio).toBeDefined()

    // Confirma campos que CAP-05 precisa para iniciar onboarding
    expect(eventPayload.responsavel_cs_id).toBeDefined()
    expect(eventPayload.cliente_id).toBeDefined()
  })

  it('fluxo de perda: CAP-02 avança → CAP-03 registra perda → evento perdida', async () => {
    const op = await cap02.criarOportunidade.execute({
      titulo: 'SMB Deal — SmallCo',
      clienteId: 'cli-smallco',
      responsavelId: 'rep-ana',
      prioridade: 'media',
      valorEstimado: 18_000,
      probabilidade: 50,
      dataFechamentoPrevista: '2026-02-28T00:00:00.000Z',
      criadoPor: 'rep-ana',
      agora: AGORA,
    })

    await cap02.avancarEstagio.execute(op.id, AGORA) // → QUALIFICACAO
    await cap02.avancarEstagio.execute(op.id, AGORA) // → PROPOSTA

    const { dealClose, eventPayload } = await cap03.registrarPerda.execute({
      oportunidadeId: op.id,
      clienteId: 'cli-smallco',
      valorTotal: 18_000,
      cicloDias: 30,
      motivoPerda: 'Concorrente com 40% de desconto no ano',
      concorrenteVencedorId: 'conc-rival',
      fechadoPor: 'rep-ana',
      agora: AGORA,
    })

    await cap02.encerrarOportunidade.execute({
      opId: op.id,
      resultado: 'perdida',
      motivo: eventPayload.motivo_perda,
      concorrenteVencedorId: 'conc-rival',
      agora: AGORA,
    })

    expect(dealClose.resultado).toBe('PERDIDA')
    expect(eventPayload.motivo_perda).toBe('Concorrente com 40% de desconto no ano')
    expect(eventPayload.concorrente_vencedor_id).toBe('conc-rival')

    const opFinal = await cap02.opRepo.findById(op.id)
    expect(opFinal?.estagio).toBe('PERDIDA')
    expect(opFinal?.estaEncerrada()).toBe(true)
  })

  it('pipeline reflete corretamente após múltiplos fechamentos', async () => {
    // Criar 3 oportunidades
    const ops = await Promise.all([
      cap02.criarOportunidade.execute({ titulo: 'Deal A', clienteId: 'c1', responsavelId: 'r1', prioridade: 'alta', valorEstimado: 50_000, probabilidade: 70, dataFechamentoPrevista: AGORA, criadoPor: 'r1', agora: AGORA }),
      cap02.criarOportunidade.execute({ titulo: 'Deal B', clienteId: 'c2', responsavelId: 'r1', prioridade: 'media', valorEstimado: 30_000, probabilidade: 40, dataFechamentoPrevista: AGORA, criadoPor: 'r1', agora: AGORA }),
      cap02.criarOportunidade.execute({ titulo: 'Deal C', clienteId: 'c3', responsavelId: 'r1', prioridade: 'baixa', valorEstimado: 20_000, probabilidade: 20, dataFechamentoPrevista: AGORA, criadoPor: 'r1', agora: AGORA }),
    ])

    // Fechar A (ganha) e B (perdida), deixar C ativa
    await cap02.encerrarOportunidade.execute({ opId: ops[0].id, resultado: 'ganha', motivo: 'ok', agora: AGORA })
    await cap02.encerrarOportunidade.execute({ opId: ops[1].id, resultado: 'perdida', motivo: 'preço', agora: AGORA })

    const snapshot = await cap02.consultarPipeline.execute()

    expect(snapshot.totalAtivas).toBe(1)
    expect(snapshot.valorTotalPipeline).toBe(20_000)    // só Deal C
    expect(snapshot.porEstagio['GANHA'].quantidade).toBe(1)
    expect(snapshot.porEstagio['PERDIDA'].quantidade).toBe(1)
    expect(snapshot.porEstagio['PROSPECCAO'].quantidade).toBe(1)
  })
})
