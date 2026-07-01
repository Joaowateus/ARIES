import { bootstrapCap03 } from '../../src/bootstrap'

const AGORA = '2026-01-01T00:00:00.000Z'
const OP_ID = '00000000-0000-0000-0000-000000000001'

async function qualificarOp(cap03: ReturnType<typeof bootstrapCap03>) {
  return cap03.qualificarOportunidade.execute({
    oportunidadeId: OP_ID,
    criteriosAtendidos: ['BUDGET', 'AUTHORITY', 'NEED'],
    observacoes: 'forte fit',
    qualificadoPor: 'rep-001',
    agora: AGORA,
  })
}

const fecharInput = {
  oportunidadeId: OP_ID,
  clienteId: 'cli-001',
  valorTotal: 72_000,
  mrr: 6_000,
  cicloDias: 45,
  dataInicio: '2026-02-01T00:00:00.000Z',
  dataFim: '2027-02-01T00:00:00.000Z',
  formaPagamento: 'MENSAL' as const,
  responsavelCsId: 'cs-001',
  fechadoPor: 'rep-001',
  agora: AGORA,
}

describe('FecharVendaUseCase', () => {
  let cap03: ReturnType<typeof bootstrapCap03>

  beforeEach(() => { cap03 = bootstrapCap03() })

  it('fecha venda ganho após qualificação', async () => {
    await qualificarOp(cap03)
    const result = await cap03.fecharVenda.execute(fecharInput)

    expect(result.dealClose.resultado).toBe('GANHA')
    expect(result.dealClose.valorTotal).toBe(72_000)
    expect(result.eventPayload.mrr).toBe(6_000)
    expect(result.eventPayload.responsavel_cs_id).toBe('cs-001')
  })

  it('RN-Q04: falha sem qualificação prévia', async () => {
    await expect(cap03.fecharVenda.execute(fecharInput)).rejects.toThrow('RN-Q04')
  })

  it('RN-Q04: falha se qualificação está DESQUALIFICADA', async () => {
    // Qualificação com apenas 1 critério → DESQUALIFICADA
    await cap03.qualificarOportunidade.execute({
      oportunidadeId: OP_ID,
      criteriosAtendidos: ['BUDGET'],
      observacoes: '',
      qualificadoPor: 'rep-001',
      agora: AGORA,
    }).catch(() => {
      // RN-Q01 vai lançar antes, então forçamos direto no repo
    })

    // Inserir diretamente desqualificada
    const { QualificationRecord } = await import('../../src/domain/entities/QualificationRecord')
    const record = QualificationRecord.reconstitute({
      id: '00000000-0000-0000-0000-000000000099',
      oportunidadeId: OP_ID,
      status: 'DESQUALIFICADA',
      criteriosAtendidos: ['BUDGET'],
      scoreQualificacao: 25,
      observacoes: '',
      qualificadoPor: 'rep-001',
      criadoEm: AGORA,
      atualizadoEm: AGORA,
    })
    await cap03.qualRepo.save(record)

    await expect(cap03.fecharVenda.execute(fecharInput)).rejects.toThrow('RN-Q04')
  })

  it('é idempotente: segunda chamada retorna mesmo deal', async () => {
    await qualificarOp(cap03)
    const r1 = await cap03.fecharVenda.execute(fecharInput)
    const r2 = await cap03.fecharVenda.execute(fecharInput)
    expect(r1.dealClose.id).toBe(r2.dealClose.id)
  })

  it('eventPayload tem estrutura ADR-0006 completa', async () => {
    await qualificarOp(cap03)
    const { eventPayload } = await cap03.fecharVenda.execute(fecharInput)

    expect(eventPayload).toMatchObject({
      oportunidade_id: OP_ID,
      cliente_id: 'cli-001',
      valor_total: 72_000,
      mrr: 6_000,
      responsavel_cs_id: 'cs-001',
      forma_pagamento: 'MENSAL',
    })
  })
})

describe('RegistrarPerdaUseCase', () => {
  let cap03: ReturnType<typeof bootstrapCap03>

  beforeEach(() => { cap03 = bootstrapCap03() })

  it('registra perda com motivo e concorrente', async () => {
    const result = await cap03.registrarPerda.execute({
      oportunidadeId: OP_ID,
      clienteId: 'cli-001',
      valorTotal: 50_000,
      cicloDias: 60,
      motivoPerda: 'preço 30% acima do orçamento',
      concorrenteVencedorId: 'conc-001',
      fechadoPor: 'rep-001',
      agora: AGORA,
    })

    expect(result.dealClose.resultado).toBe('PERDIDA')
    expect(result.eventPayload.motivo_perda).toBe('preço 30% acima do orçamento')
    expect(result.eventPayload.concorrente_vencedor_id).toBe('conc-001')
  })

  it('RN-Q03: falha sem motivo de perda', async () => {
    await expect(
      cap03.registrarPerda.execute({
        oportunidadeId: OP_ID,
        clienteId: 'cli-001',
        valorTotal: 50_000,
        cicloDias: 60,
        motivoPerda: '',
        fechadoPor: 'rep-001',
        agora: AGORA,
      }),
    ).rejects.toThrow('RN-Q03')
  })
})
