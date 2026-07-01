import { RegistrarContratoUseCase } from '../../src/application/use-cases/RegistrarContratoUseCase'
import { RegistrarReceitaRecorrenteUseCase } from '../../src/application/use-cases/RegistrarReceitaRecorrenteUseCase'
import { RegistrarReceitaUnicaUseCase } from '../../src/application/use-cases/RegistrarReceitaUnicaUseCase'
import { AtualizarForecastUseCase } from '../../src/application/use-cases/AtualizarForecastUseCase'
import { EncerrarContratoUseCase } from '../../src/application/use-cases/EncerrarContratoUseCase'
import { CancelarContratoUseCase } from '../../src/application/use-cases/CancelarContratoUseCase'
import { InMemoryContractRepository } from '../../src/infrastructure/repositories/InMemoryContractRepository'
import { InMemoryRevenueRepository } from '../../src/infrastructure/repositories/InMemoryRevenueRepository'
import { InMemoryForecastRepository } from '../../src/infrastructure/repositories/InMemoryForecastRepository'

function setup() {
  const contratoRepo = new InMemoryContractRepository()
  const revenueRepo = new InMemoryRevenueRepository()
  const forecastRepo = new InMemoryForecastRepository()
  return {
    contratoRepo,
    revenueRepo,
    forecastRepo,
    registrarContrato: new RegistrarContratoUseCase(contratoRepo),
    registrarRecorrente: new RegistrarReceitaRecorrenteUseCase(contratoRepo, revenueRepo),
    registrarUnica: new RegistrarReceitaUnicaUseCase(contratoRepo, revenueRepo),
    atualizarForecast: new AtualizarForecastUseCase(contratoRepo, forecastRepo),
    encerrar: new EncerrarContratoUseCase(contratoRepo),
    cancelar: new CancelarContratoUseCase(contratoRepo),
  }
}

const contratoInput = {
  oportunidadeId: 'op-1',
  dealCloseId: 'dc-1',
  clienteId: 'cli-1',
  valorTotal: 12000,
  mrr: 1000,
  dataInicio: '2026-01-01',
  dataFim: '2026-12-31',
  formaPagamento: 'MENSAL' as const,
  condicoesJson: {},
  responsavelCsId: 'cs-1',
  criadoPor: 'user-1',
  agora: '2026-01-01T10:00:00Z',
}

describe('RegistrarReceitaRecorrenteUseCase', () => {
  it('registra receita recorrente de um contrato ATIVO', async () => {
    const ctx = setup()
    const { contract } = await ctx.registrarContrato.execute(contratoInput)

    const out = await ctx.registrarRecorrente.execute({
      contratoId: contract.id,
      clienteId: 'cli-1',
      valor: 1000,
      periodo: '2026-01',
      descricao: 'MRR jan/2026',
      agora: '2026-01-31T23:59:59Z',
    })

    expect(out.record.tipo).toBe('RECORRENTE')
    expect(out.record.valor).toBe(1000)
    expect(out.eventPayload.tipo).toBe('RECORRENTE')
    expect(out.eventPayload.periodo).toBe('2026-01')
  })

  it('RN-R05: segundo registro no mesmo período lança erro', async () => {
    const ctx = setup()
    const { contract } = await ctx.registrarContrato.execute(contratoInput)

    const receitaInput = {
      contratoId: contract.id,
      clienteId: 'cli-1',
      valor: 1000,
      periodo: '2026-01',
      descricao: 'MRR jan/2026',
      agora: '2026-01-31T23:59:59Z',
    }

    await ctx.registrarRecorrente.execute(receitaInput)
    await expect(ctx.registrarRecorrente.execute(receitaInput)).rejects.toThrow('RN-R05')
  })

  it('rejeita contrato inexistente', async () => {
    const ctx = setup()
    await expect(
      ctx.registrarRecorrente.execute({
        contratoId: 'inexistente',
        clienteId: 'cli-1',
        valor: 1000,
        periodo: '2026-01',
        descricao: 'MRR',
        agora: '2026-01-01T00:00:00Z',
      }),
    ).rejects.toThrow('não encontrado')
  })

  it('RN-R06: rejeita receita em contrato ENCERRADO', async () => {
    const ctx = setup()
    const { contract } = await ctx.registrarContrato.execute(contratoInput)
    await ctx.encerrar.execute({ contratoId: contract.id, agora: '2026-06-01T00:00:00Z' })

    await expect(
      ctx.registrarRecorrente.execute({
        contratoId: contract.id,
        clienteId: 'cli-1',
        valor: 1000,
        periodo: '2026-06',
        descricao: 'MRR',
        agora: '2026-06-30T00:00:00Z',
      }),
    ).rejects.toThrow('RN-R06')
  })
})

describe('RegistrarReceitaUnicaUseCase', () => {
  it('registra receita única em contrato ATIVO', async () => {
    const ctx = setup()
    const { contract } = await ctx.registrarContrato.execute(contratoInput)

    const out = await ctx.registrarUnica.execute({
      contratoId: contract.id,
      clienteId: 'cli-1',
      valor: 500,
      descricao: 'Taxa de implantação',
      agora: '2026-01-15T10:00:00Z',
    })

    expect(out.record.tipo).toBe('UNICA')
    expect(out.record.valor).toBe(500)
    expect(out.eventPayload.tipo).toBe('UNICA')
    expect(out.eventPayload.periodo).toBe('2026-01')
  })
})

describe('AtualizarForecastUseCase', () => {
  it('calcula forecast com contratos ativos', async () => {
    const ctx = setup()

    await ctx.registrarContrato.execute({ ...contratoInput, oportunidadeId: 'op-1' })
    await ctx.registrarContrato.execute({
      ...contratoInput,
      oportunidadeId: 'op-2',
      mrr: 2000,
      valorTotal: 24000,
    })

    const out = await ctx.atualizarForecast.execute({
      periodo: '2026-01',
      agora: '2026-01-01T00:00:00Z',
    })

    expect(out.entry.mrrAtivo).toBe(3000)
    expect(out.entry.arrAtivo).toBe(36000)
    expect(out.entry.quantidadeContratos).toBe(2)
    expect(out.eventPayload.periodo).toBe('2026-01')
  })

  it('exclui contratos encerrados do forecast', async () => {
    const ctx = setup()
    const { contract } = await ctx.registrarContrato.execute(contratoInput)
    await ctx.encerrar.execute({ contratoId: contract.id, agora: '2026-06-01T00:00:00Z' })

    const out = await ctx.atualizarForecast.execute({
      periodo: '2026-06',
      agora: '2026-06-01T00:00:00Z',
    })

    expect(out.entry.mrrAtivo).toBe(0)
    expect(out.entry.quantidadeContratos).toBe(0)
  })
})

describe('EncerrarContratoUseCase', () => {
  it('encerra contrato ATIVO', async () => {
    const ctx = setup()
    const { contract } = await ctx.registrarContrato.execute(contratoInput)

    const out = await ctx.encerrar.execute({
      contratoId: contract.id,
      agora: '2026-12-31T23:59:59Z',
    })

    expect(out.contract.status).toBe('ENCERRADO')
    expect(out.eventPayload.encerrado_em).toBeDefined()
  })

  it('rejeita encerramento de contrato inexistente', async () => {
    const ctx = setup()
    await expect(ctx.encerrar.execute({ contratoId: 'x', agora: '2026-01-01T00:00:00Z' })).rejects.toThrow(
      'não encontrado',
    )
  })
})

describe('CancelarContratoUseCase', () => {
  it('cancela contrato ATIVO com motivo', async () => {
    const ctx = setup()
    const { contract } = await ctx.registrarContrato.execute(contratoInput)

    const out = await ctx.cancelar.execute({
      contratoId: contract.id,
      motivo: 'Cliente em churn',
      agora: '2026-06-01T00:00:00Z',
    })

    expect(out.contract.status).toBe('CANCELADO')
    expect(out.eventPayload.motivo).toBe('Cliente em churn')
  })
})
