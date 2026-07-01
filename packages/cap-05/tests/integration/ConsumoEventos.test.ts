import { bootstrapCap05 } from '../../src/bootstrap'
import { MARCOS_OBRIGATORIOS } from '../../src/domain/entities/Onboarding'
import {
  ClienteCriadoPayload,
  OnboardingIniciadoPayload,
  OnboardingConcluidoPayload,
  HealthAlteradoPayload,
} from '../../src/infrastructure/events/cap05-events'

const eventoOportunidadeGanha = {
  oportunidade_id: 'op-int-001',
  deal_close_id: 'dc-int-001',
  cliente_id: 'cli-int-001',
  valor_total: 36000,
  mrr: 3000,
  segmento_id: 'seg-tech',
  data_inicio: '2026-02-01',
  data_fim: '2027-01-31',
  forma_pagamento: 'MENSAL',
  condicoes_json: {},
  responsavel_cs_id: 'cs-int-001',
  fechado_por: 'vendedor-int-001',
  fechado_em: '2026-01-20T14:00:00Z',
}

const eventoContratoCriado = {
  contrato_id: 'ctr-int-001',
  oportunidade_id: 'op-int-001',
  cliente_id: 'cli-int-001',
  valor_total: 36000,
  mrr: 3000,
  arr: 36000,
  data_inicio: '2026-02-01',
  data_fim: '2027-01-31',
  forma_pagamento: 'MENSAL',
}

describe('Consumo de eventos → CAP-05', () => {
  it('cap03.oportunidade.ganha cria cliente ONBOARDING com healthScore=70', async () => {
    const cap05 = bootstrapCap05()
    const out = await cap05.handlers.oportunidadeGanha.handle(eventoOportunidadeGanha, '2026-02-01T10:00:00Z')

    expect(out.customer.status).toBe('ONBOARDING')
    expect(out.customer.healthScore).toBe(70)
    expect(out.customer.clienteId).toBe('cli-int-001')
    expect(out.onboarding.status).toBe('PENDENTE')
  })

  it('payload cap05.cliente.criado é válido conforme CUE', async () => {
    const cap05 = bootstrapCap05()
    const out = await cap05.handlers.oportunidadeGanha.handle(eventoOportunidadeGanha, '2026-02-01T10:00:00Z')

    const result = ClienteCriadoPayload.safeParse(out.customerEventPayload)
    expect(result.success).toBe(true)
  })

  it('payload cap05.onboarding.iniciado é válido conforme CUE', async () => {
    const cap05 = bootstrapCap05()
    const out = await cap05.handlers.oportunidadeGanha.handle(eventoOportunidadeGanha, '2026-02-01T10:00:00Z')

    const result = OnboardingIniciadoPayload.safeParse(out.onboardingEventPayload)
    expect(result.success).toBe(true)
  })

  it('cap04.contrato.criado vincula contratoId ao cliente', async () => {
    const cap05 = bootstrapCap05()
    await cap05.handlers.oportunidadeGanha.handle(eventoOportunidadeGanha, '2026-02-01T10:00:00Z')
    await cap05.handlers.contratoCriado.handle(eventoContratoCriado, '2026-02-01T10:01:00Z')

    const customer = await cap05.repos.customer.findByOportunidade('op-int-001')
    expect(customer?.contratoId).toBe('ctr-int-001')
  })

  it('idempotência: cap03 event processado duas vezes não duplica cliente', async () => {
    const cap05 = bootstrapCap05()
    const agora = '2026-02-01T10:00:00Z'

    const out1 = await cap05.handlers.oportunidadeGanha.handle(eventoOportunidadeGanha, agora)
    const out2 = await cap05.handlers.oportunidadeGanha.handle(eventoOportunidadeGanha, agora)

    expect(out1.customer.id).toBe(out2.customer.id)
    expect(await cap05.repos.customer.findAll()).toHaveLength(1)
  })

  it('fluxo completo: oportunidade ganha → cliente → onboarding concluído → ativo', async () => {
    const cap05 = bootstrapCap05()
    const agora = '2026-02-01T10:00:00Z'

    // Consumir evento CAP-03
    const { onboarding } = await cap05.handlers.oportunidadeGanha.handle(eventoOportunidadeGanha, agora)

    // Concluir todos os marcos
    const ob = await cap05.repos.onboarding.findById(onboarding.id)
    for (const marco of MARCOS_OBRIGATORIOS) ob!.concluirMarco(marco, agora)
    await cap05.repos.onboarding.save(ob!)

    // Finalizar onboarding → ativa cliente automaticamente
    const finalOut = await cap05.useCases.finalizarOnboarding.execute({
      onboardingId: onboarding.id,
      agora: '2026-04-01T00:00:00Z',
    })

    expect(finalOut.customer.status).toBe('ATIVO')

    // Validar payload CUE: cap05.onboarding.concluido
    const result = OnboardingConcluidoPayload.safeParse(finalOut.eventPayload)
    expect(result.success).toBe(true)

    // Health score update
    const healthOut = await cap05.useCases.atualizarHealthScore.execute({
      customerId: finalOut.customer.id,
      score: 90,
      fatores: ['Go-live bem-sucedido'],
      agora: '2026-04-01T00:01:00Z',
    })

    const healthResult = HealthAlteradoPayload.safeParse(healthOut.eventPayload)
    expect(healthResult.success).toBe(true)
  })
})
