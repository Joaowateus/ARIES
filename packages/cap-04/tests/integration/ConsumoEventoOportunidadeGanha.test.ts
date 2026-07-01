import { bootstrapCap04 } from '../../src/bootstrap'
import { ContratoCriadoPayload } from '../../src/infrastructure/events/cap04-events'

const eventoOportunidadeGanha = {
  oportunidade_id: 'op-integration-01',
  deal_close_id: 'dc-integration-01',
  cliente_id: 'cli-integration-01',
  valor_total: 36000,
  mrr: 3000,
  segmento_id: 'seg-tech',
  data_inicio: '2026-02-01',
  data_fim: '2027-01-31',
  forma_pagamento: 'MENSAL',
  condicoes_json: { desconto_percentual: 10 },
  responsavel_cs_id: 'cs-integration-01',
  fechado_por: 'vendedor-01',
  fechado_em: '2026-01-15T14:00:00Z',
}

describe('Consumo cap03.oportunidade.ganha → cap04', () => {
  it('transforma evento em contrato ATIVO via OportunidadeGanhaHandler', async () => {
    const cap04 = bootstrapCap04()
    const agora = '2026-01-15T14:00:00Z'

    const out = await cap04.handlers.oportunidadeGanha.handle(eventoOportunidadeGanha, agora)

    expect(out.contract.status).toBe('ATIVO')
    expect(out.contract.oportunidadeId).toBe('op-integration-01')
    expect(out.contract.mrr).toBe(3000)
    expect(out.contract.arr).toBe(36000)
  })

  it('eventPayload gerado pelo handler é válido conforme CUE (cap04.contrato.criado)', async () => {
    const cap04 = bootstrapCap04()
    const out = await cap04.handlers.oportunidadeGanha.handle(
      eventoOportunidadeGanha,
      '2026-01-15T14:00:00Z',
    )

    const result = ContratoCriadoPayload.safeParse(out.eventPayload)
    expect(result.success).toBe(true)
  })

  it('idempotência: handler chamado duas vezes com mesmo evento retorna o mesmo contrato', async () => {
    const cap04 = bootstrapCap04()
    const agora = '2026-01-15T14:00:00Z'

    const out1 = await cap04.handlers.oportunidadeGanha.handle(eventoOportunidadeGanha, agora)
    const out2 = await cap04.handlers.oportunidadeGanha.handle(eventoOportunidadeGanha, agora)

    expect(out1.contract.id).toBe(out2.contract.id)
    const todos = await cap04.repos.contrato.findAll()
    expect(todos).toHaveLength(1)
  })

  it('fluxo completo: venda ganha → contrato → receita recorrente → forecast', async () => {
    const cap04 = bootstrapCap04()
    const agora = '2026-01-15T14:00:00Z'

    // 1. Consumir evento CAP-03
    const contratoOut = await cap04.handlers.oportunidadeGanha.handle(eventoOportunidadeGanha, agora)
    const contratoId = contratoOut.contract.id

    // 2. Registrar receita recorrente do primeiro mês
    const receitaOut = await cap04.useCases.registrarReceitaRecorrente.execute({
      contratoId,
      clienteId: 'cli-integration-01',
      valor: 3000,
      periodo: '2026-02',
      descricao: 'MRR fev/2026',
      agora: '2026-02-01T00:00:00Z',
    })

    expect(receitaOut.record.valor).toBe(3000)
    expect(receitaOut.record.periodo).toBe('2026-02')

    // 3. Atualizar forecast
    const forecastOut = await cap04.useCases.atualizarForecast.execute({
      periodo: '2026-02',
      agora: '2026-02-01T00:00:00Z',
    })

    expect(forecastOut.entry.mrrAtivo).toBe(3000)
    expect(forecastOut.entry.arrAtivo).toBe(36000)
    expect(forecastOut.entry.quantidadeContratos).toBe(1)
  })
})
