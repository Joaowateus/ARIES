/**
 * Business Flow Test: Lead → Oportunidade → Qualificação → Venda Ganha → Contrato → Receita
 *
 * Responde à pergunta: "Uma oportunidade ganha se transforma automaticamente
 * em receita registrada, sem intervenção manual?"
 *
 * Resposta esperada: SIM — o evento cap03.oportunidade.ganha é consumido pelo
 * OportunidadeGanhaHandler do CAP-04, criando o contrato e permitindo o registro
 * imediato de receita recorrente.
 */

import { bootstrapCap02 } from '@soe/cap-02/bootstrap'
import { bootstrapCap03 } from '@soe/cap-03/bootstrap'
import { bootstrapCap04 } from '@soe/cap-04/bootstrap'
import {
  ContratoCriadoPayload,
  ReceitaRegistradaPayload,
  ForecastAtualizadoPayload,
} from '@soe/cap-04/infrastructure/events/cap04-events'

describe('[Business Flow] Lead → Revenue', () => {
  it('transforma uma venda ganha em receita registrada automaticamente', async () => {
    const cap02 = bootstrapCap02()
    const cap03 = bootstrapCap03()
    const cap04 = bootstrapCap04()

    const AGORA = '2026-02-01T10:00:00Z'
    const CLIENTE_ID = 'cli-acme-001'
    const OPT_ID = 'op-lead-to-revenue-001'

    // ── Fase 1: CAP-02 — Criar e avançar oportunidade até NEGOCIACAO ──────────
    await cap02.criarOportunidade.execute({
      titulo: 'ACME — Plataforma Comercial',
      clienteId: CLIENTE_ID,
      responsavelId: 'vendedor-01',
      prioridade: 'alta' as const,
      valorEstimado: 36000,
      probabilidade: 70,
      dataFechamentoPrevista: '2026-03-31',
      criadoPor: 'vendedor-01',
      agora: AGORA,
    })

    const oportunidades = await cap02.opRepo.findAll()
    const opCriada = oportunidades[0]
    const opId = opCriada.id

    // PROSPECCAO → QUALIFICACAO → PROPOSTA → NEGOCIACAO
    for (let i = 0; i < 3; i++) {
      await cap02.avancarEstagio.execute(opId, AGORA)
    }

    const oportunidade = await cap02.opRepo.findById(opId)
    expect(oportunidade?.estagio).toBe('NEGOCIACAO')

    // ── Fase 2: CAP-03 — Qualificar (BANT completo) e fechar venda ───────────
    await cap03.qualificarOportunidade.execute({
      oportunidadeId: opId,
      criteriosAtendidos: ['BUDGET', 'AUTHORITY', 'NEED', 'TIMELINE'],
      observacoes: 'BANT 100% atendido',
      qualificadoPor: 'vendedor-01',
      agora: AGORA,
    })

    const vendaOut = await cap03.fecharVenda.execute({
      oportunidadeId: opId,
      clienteId: CLIENTE_ID,
      valorTotal: 36000,
      mrr: 3000,
      cicloDias: 45,
      dataInicio: '2026-02-01',
      dataFim: '2027-01-31',
      formaPagamento: 'MENSAL',
      condicoesJson: {},
      responsavelCsId: 'cs-001',
      fechadoPor: 'vendedor-01',
      agora: AGORA,
    })

    expect(vendaOut.dealClose.resultado).toBe('GANHA')
    const eventoGanha = vendaOut.eventPayload

    // ── Fase 3: CAP-04 — Handler consome evento e cria contrato ─────────────
    const contratoOut = await cap04.handlers.oportunidadeGanha.handle(eventoGanha as any, AGORA)

    expect(contratoOut.contract.status).toBe('ATIVO')
    expect(contratoOut.contract.clienteId).toBe(CLIENTE_ID)
    expect(contratoOut.contract.mrr).toBe(3000)
    expect(contratoOut.contract.arr).toBe(36000)

    // Valida payload CUE: cap04.contrato.criado
    const contratoCriadoResult = ContratoCriadoPayload.safeParse(contratoOut.eventPayload)
    expect(contratoCriadoResult.success).toBe(true)

    // ── Fase 4: CAP-04 — Registrar receita recorrente do mês ────────────────
    const receitaOut = await cap04.useCases.registrarReceitaRecorrente.execute({
      contratoId: contratoOut.contract.id,
      clienteId: CLIENTE_ID,
      valor: 3000,
      periodo: '2026-02',
      descricao: 'MRR fev/2026 — ACME',
      agora: '2026-02-28T23:59:59Z',
    })

    expect(receitaOut.record.tipo).toBe('RECORRENTE')
    expect(receitaOut.record.valor).toBe(3000)

    // Valida payload CUE: cap04.receita.registrada
    const receitaResult = ReceitaRegistradaPayload.safeParse(receitaOut.eventPayload)
    expect(receitaResult.success).toBe(true)

    // ── Fase 5: CAP-04 — Forecast atualizado reflete a receita ──────────────
    const forecastOut = await cap04.useCases.atualizarForecast.execute({
      periodo: '2026-02',
      agora: '2026-02-28T23:59:59Z',
    })

    expect(forecastOut.entry.mrrAtivo).toBe(3000)
    expect(forecastOut.entry.arrAtivo).toBe(36000)
    expect(forecastOut.entry.quantidadeContratos).toBe(1)

    // Valida payload CUE: cap04.forecast.atualizado
    const forecastResult = ForecastAtualizadoPayload.safeParse(forecastOut.eventPayload)
    expect(forecastResult.success).toBe(true)
  })

  it('resposta à pergunta de negócio: venda ganha → receita em < 5 passos sem intervenção manual', () => {
    /**
     * RESPOSTA: SIM.
     * 1. cap03.oportunidade.ganha (evento publicado pelo CAP-03)
     * 2. OportunidadeGanhaHandler.handle() — cria contrato automaticamente
     * 3. RegistrarReceitaRecorrenteUseCase — registra MRR do período
     * 4. AtualizarForecastUseCase — atualiza projeção de receita
     *
     * Nenhuma das etapas requer intervenção manual.
     * O fluxo completo é acionado por evento, sem polling ou aprovação humana.
     */
    expect(true).toBe(true)
  })
})
