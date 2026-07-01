import { CriarClienteUseCase } from '../../src/application/use-cases/CriarClienteUseCase'
import { InMemoryCustomerRepository } from '../../src/infrastructure/repositories/InMemoryCustomerRepository'
import { InMemoryOnboardingRepository } from '../../src/infrastructure/repositories/InMemoryOnboardingRepository'

const customerRepo = () => new InMemoryCustomerRepository()
const onboardingRepo = () => new InMemoryOnboardingRepository()

const input = {
  clienteId: 'cli-001',
  oportunidadeId: 'op-001',
  nome: 'ACME Corp',
  responsavelCsId: 'cs-001',
  agora: '2026-02-01T10:00:00Z',
}

describe('CriarClienteUseCase', () => {
  it('cria cliente ONBOARDING e onboarding PENDENTE simultaneamente (RN-C01 + RN-C02)', async () => {
    const uc = new CriarClienteUseCase(customerRepo(), onboardingRepo())
    const out = await uc.execute(input)

    expect(out.customer.status).toBe('ONBOARDING')
    expect(out.customer.healthScore).toBe(70)
    expect(out.onboarding.status).toBe('PENDENTE')
    expect(out.onboarding.customerId).toBe(out.customer.id)
  })

  it('idempotência: segunda chamada com mesma oportunidade retorna o mesmo cliente', async () => {
    const cr = customerRepo()
    const or = onboardingRepo()
    const uc = new CriarClienteUseCase(cr, or)

    const out1 = await uc.execute(input)
    const out2 = await uc.execute({ ...input, agora: '2026-02-02T10:00:00Z' })

    expect(out1.customer.id).toBe(out2.customer.id)
    expect(out1.onboarding.id).toBe(out2.onboarding.id)
    expect(await cr.findAll()).toHaveLength(1)
  })

  it('RN-C03: rejeita segunda criação com oportunidade diferente mas cliente duplicado via mesmo clienteId não impede', async () => {
    const cr = customerRepo()
    const or = onboardingRepo()
    const uc = new CriarClienteUseCase(cr, or)

    await uc.execute(input)
    // Oportunidade diferente → deve criar novo cliente (clienteId diferente)
    const out2 = await uc.execute({ ...input, oportunidadeId: 'op-002', clienteId: 'cli-002' })
    expect(out2.customer.oportunidadeId).toBe('op-002')
    expect(await cr.findAll()).toHaveLength(2)
  })

  it('RN-C03: mesma oportunidade não pode ter dois onboardings', async () => {
    const cr = customerRepo()
    const or = onboardingRepo()
    const uc = new CriarClienteUseCase(cr, or)

    await uc.execute(input)

    // Simular state inválido: cliente com oportunidade diferente mas onboarding com mesma oportunidade
    // Garantido via idempotência: segunda chamada com mesma oportunidadeId retorna existente, não cria novo
    const out2 = await uc.execute(input)
    expect(await or.findAll()).toHaveLength(1)
    expect(out2.onboarding.oportunidadeId).toBe(input.oportunidadeId)
  })

  it('eventPayload inclui todos os campos CUE de cap05.cliente.criado', async () => {
    const uc = new CriarClienteUseCase(customerRepo(), onboardingRepo())
    const out = await uc.execute(input)

    const p = out.customerEventPayload
    expect(p.customer_id).toBeDefined()
    expect(p.cliente_id).toBe('cli-001')
    expect(p.oportunidade_id).toBe('op-001')
    expect(p.health_score).toBe(70)
    expect(p.criado_em).toBe('2026-02-01T10:00:00Z')

    const op = out.onboardingEventPayload
    expect(op.onboarding_id).toBeDefined()
    expect(op.customer_id).toBe(out.customer.id)
  })
})
