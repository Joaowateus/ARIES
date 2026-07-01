import { RegistrarContratoUseCase } from '../../src/application/use-cases/RegistrarContratoUseCase'
import { InMemoryContractRepository } from '../../src/infrastructure/repositories/InMemoryContractRepository'

const repo = () => new InMemoryContractRepository()

const input = {
  oportunidadeId: 'op-1',
  dealCloseId: 'dc-1',
  clienteId: 'cli-1',
  valorTotal: 24000,
  mrr: 2000,
  dataInicio: '2026-01-01',
  dataFim: '2026-12-31',
  formaPagamento: 'MENSAL' as const,
  condicoesJson: { desconto: 0 },
  responsavelCsId: 'cs-1',
  criadoPor: 'user-1',
  agora: '2026-01-01T10:00:00Z',
}

describe('RegistrarContratoUseCase', () => {
  it('cria contrato e retorna eventPayload com arr correto', async () => {
    const uc = new RegistrarContratoUseCase(repo())
    const out = await uc.execute(input)

    expect(out.contract.status).toBe('ATIVO')
    expect(out.contract.arr).toBe(24000)
    expect(out.eventPayload.arr).toBe(24000)
    expect(out.eventPayload.oportunidade_id).toBe('op-1')
    expect(out.eventPayload.mrr).toBe(2000)
  })

  it('idempotência: segunda chamada com mesma oportunidade retorna contrato existente', async () => {
    const r = repo()
    const uc = new RegistrarContratoUseCase(r)

    const out1 = await uc.execute(input)
    const out2 = await uc.execute({ ...input, agora: '2026-02-01T00:00:00Z' })

    expect(out1.contract.id).toBe(out2.contract.id)
    expect(await r.findAll()).toHaveLength(1)
  })

  it('eventPayload inclui todos os campos CUE obrigatórios', async () => {
    const uc = new RegistrarContratoUseCase(repo())
    const out = await uc.execute(input)

    const p = out.eventPayload
    expect(p.contrato_id).toBeDefined()
    expect(p.oportunidade_id).toBeDefined()
    expect(p.cliente_id).toBeDefined()
    expect(p.valor_total).toBeDefined()
    expect(p.mrr).toBeDefined()
    expect(p.arr).toBeDefined()
    expect(p.data_inicio).toBeDefined()
    expect(p.data_fim).toBeDefined()
    expect(p.forma_pagamento).toBeDefined()
  })
})
