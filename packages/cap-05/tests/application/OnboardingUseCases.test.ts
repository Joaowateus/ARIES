import { bootstrapCap05 } from '../../src/bootstrap'
import { MARCOS_OBRIGATORIOS } from '../../src/domain/entities/Onboarding'

const clienteInput = {
  clienteId: 'cli-001',
  oportunidadeId: 'op-001',
  nome: 'ACME Corp',
  responsavelCsId: 'cs-001',
  agora: '2026-02-01T10:00:00Z',
}

async function setupComCliente() {
  const cap05 = bootstrapCap05()
  const { customer, onboarding } = await cap05.useCases.criarCliente.execute(clienteInput)
  return { cap05, customer, onboarding }
}

describe('IniciarOnboardingUseCase', () => {
  it('inicia onboarding PENDENTE', async () => {
    const { cap05, onboarding } = await setupComCliente()
    const out = await cap05.useCases.iniciarOnboarding.execute({
      onboardingId: onboarding.id,
      agora: '2026-02-02T10:00:00Z',
    })
    expect(out.onboarding.status).toBe('EM_PROGRESSO')
  })

  it('rejeita onboarding inexistente', async () => {
    const cap05 = bootstrapCap05()
    await expect(
      cap05.useCases.iniciarOnboarding.execute({ onboardingId: 'x', agora: '2026-02-02T10:00:00Z' }),
    ).rejects.toThrow('não encontrado')
  })
})

describe('RegistrarInteracaoUseCase', () => {
  it('registra interação para cliente existente', async () => {
    const { cap05, customer } = await setupComCliente()
    const out = await cap05.useCases.registrarInteracao.execute({
      customerId: customer.id,
      tipo: 'REUNIAO',
      descricao: 'Kickoff meeting realizado',
      realizadoPor: 'cs-001',
      agora: '2026-02-05T14:00:00Z',
    })
    expect(out.interaction.tipo).toBe('REUNIAO')
    expect(out.interaction.customerId).toBe(customer.id)
  })

  it('rejeita interação para cliente inexistente', async () => {
    const cap05 = bootstrapCap05()
    await expect(
      cap05.useCases.registrarInteracao.execute({
        customerId: 'x',
        tipo: 'EMAIL',
        descricao: 'Desc',
        realizadoPor: 'cs-001',
        agora: '2026-02-05T00:00:00Z',
      }),
    ).rejects.toThrow('não encontrado')
  })
})

describe('AtualizarHealthScoreUseCase', () => {
  it('atualiza health score e retorna eventPayload com nivel', async () => {
    const { cap05, customer } = await setupComCliente()
    const out = await cap05.useCases.atualizarHealthScore.execute({
      customerId: customer.id,
      score: 85,
      fatores: ['NPS alto', 'Onboarding no prazo'],
      agora: '2026-03-01T00:00:00Z',
    })
    expect(out.health.score).toBe(85)
    expect(out.health.nivel).toBe('EXCELENTE') // 85 >= 85 → EXCELENTE
    expect(out.eventPayload.score_anterior).toBe(70)
    expect(out.eventPayload.score_novo).toBe(85)
  })

  it('calcula nivel CRITICO para score < 20', async () => {
    const { cap05, customer } = await setupComCliente()
    const out = await cap05.useCases.atualizarHealthScore.execute({
      customerId: customer.id,
      score: 15,
      fatores: ['Sem resposta há 30 dias'],
      agora: '2026-03-01T00:00:00Z',
    })
    expect(out.health.nivel).toBe('CRITICO')
  })
})

describe('FinalizarOnboardingUseCase', () => {
  it('RN-C05: rejeita finalização sem todos os marcos', async () => {
    const { cap05, onboarding } = await setupComCliente()
    await expect(
      cap05.useCases.finalizarOnboarding.execute({
        onboardingId: onboarding.id,
        agora: '2026-03-01T00:00:00Z',
      }),
    ).rejects.toThrow('RN-C05')
  })

  it('RN-C05 + RN-C06: finaliza onboarding e ativa cliente automaticamente', async () => {
    const { cap05, customer, onboarding } = await setupComCliente()
    const agora = '2026-02-01T10:00:00Z'

    // Completar todos os marcos obrigatórios via IniciarOnboarding + concluirMarco direto
    const ob = await cap05.repos.onboarding.findById(onboarding.id)
    for (const marco of MARCOS_OBRIGATORIOS) ob!.concluirMarco(marco, agora)
    await cap05.repos.onboarding.save(ob!)

    const out = await cap05.useCases.finalizarOnboarding.execute({
      onboardingId: onboarding.id,
      agora: '2026-04-01T00:00:00Z',
    })

    expect(out.onboarding.status).toBe('CONCLUIDO')
    expect(out.customer.status).toBe('ATIVO')
    expect(out.eventPayload.onboarding_id).toBe(onboarding.id)
    expect(out.eventPayload.customer_id).toBe(customer.id)
  })
})

describe('EncerrarRelacionamentoUseCase', () => {
  it('encerra cliente ONBOARDING com motivo', async () => {
    const { cap05, customer } = await setupComCliente()
    const out = await cap05.useCases.encerrarRelacionamento.execute({
      customerId: customer.id,
      motivo: 'Cliente cancelou antes do go-live',
      agora: '2026-03-01T00:00:00Z',
    })
    expect(out.customer.status).toBe('ENCERRADO')
    expect(out.eventPayload.motivo).toBe('Cliente cancelou antes do go-live')
  })

  it('RN-C07: não pode encerrar cliente já encerrado', async () => {
    const { cap05, customer } = await setupComCliente()
    await cap05.useCases.encerrarRelacionamento.execute({
      customerId: customer.id,
      motivo: 'Motivo',
      agora: '2026-03-01T00:00:00Z',
    })
    await expect(
      cap05.useCases.encerrarRelacionamento.execute({
        customerId: customer.id,
        motivo: 'Outro motivo',
        agora: '2026-04-01T00:00:00Z',
      }),
    ).rejects.toThrow('RN-C07')
  })
})
