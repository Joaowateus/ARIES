import { bootstrapCap02 } from '../../src/bootstrap'

const AGORA = '2026-01-01T00:00:00.000Z'

function makeInput(overrides?: object) {
  return {
    titulo: 'Oportunidade Teste',
    clienteId: 'cli-001',
    responsavelId: 'rep-001',
    prioridade: 'media' as const,
    valorEstimado: 20_000,
    probabilidade: 25,
    dataFechamentoPrevista: '2026-06-30T00:00:00.000Z',
    criadoPor: 'rep-001',
    agora: AGORA,
    ...overrides,
  }
}

describe('Pipeline Use Cases', () => {
  let cap02: ReturnType<typeof bootstrapCap02>

  beforeEach(() => {
    cap02 = bootstrapCap02()
  })

  it('CriarOportunidade: cria e persiste oportunidade', async () => {
    const result = await cap02.criarOportunidade.execute(makeInput())
    expect(result.id).toBeDefined()
    expect(result.estagio).toBe('PROSPECCAO')

    const found = await cap02.opRepo.findById(result.id)
    expect(found).not.toBeNull()
  })

  it('AvancarEstagio: avança estágio da oportunidade', async () => {
    const op = await cap02.criarOportunidade.execute(makeInput())
    const avancada = await cap02.avancarEstagio.execute(op.id, AGORA)
    expect(avancada.estagio).toBe('QUALIFICACAO')
  })

  it('AvancarEstagio: falha se oportunidade não existe', async () => {
    await expect(cap02.avancarEstagio.execute('inexistente', AGORA)).rejects.toThrow('não encontrada')
  })

  it('EncerrarOportunidade: marca como ganha', async () => {
    const op = await cap02.criarOportunidade.execute(makeInput())
    const encerrada = await cap02.encerrarOportunidade.execute({
      opId: op.id,
      resultado: 'ganha',
      motivo: 'cliente assinou',
      agora: AGORA,
    })
    expect(encerrada.estagio).toBe('GANHA')
    expect(encerrada.encerradoEm).toBe(AGORA)
  })

  it('EncerrarOportunidade: marca como perdida com concorrente', async () => {
    const op = await cap02.criarOportunidade.execute(makeInput())
    const encerrada = await cap02.encerrarOportunidade.execute({
      opId: op.id,
      resultado: 'perdida',
      motivo: 'preço inviável',
      concorrenteVencedorId: 'conc-001',
      agora: AGORA,
    })
    expect(encerrada.estagio).toBe('PERDIDA')
    expect(encerrada.concorrenteVencedorId).toBe('conc-001')
  })

  it('ConsultarPipeline: snapshot por estágio', async () => {
    await cap02.criarOportunidade.execute(makeInput({ valorEstimado: 10_000 }))
    await cap02.criarOportunidade.execute(makeInput({ valorEstimado: 20_000 }))
    const op3 = await cap02.criarOportunidade.execute(makeInput({ valorEstimado: 5_000 }))
    await cap02.avancarEstagio.execute(op3.id, AGORA)

    const snapshot = await cap02.consultarPipeline.execute()
    expect(snapshot.totalAtivas).toBe(3)
    expect(snapshot.valorTotalPipeline).toBe(35_000)
    expect(snapshot.porEstagio['PROSPECCAO'].quantidade).toBe(2)
    expect(snapshot.porEstagio['QUALIFICACAO'].quantidade).toBe(1)
  })

  it('ConsultarPipeline: oportunidades encerradas não contam no total ativo', async () => {
    const op = await cap02.criarOportunidade.execute(makeInput())
    await cap02.encerrarOportunidade.execute({
      opId: op.id, resultado: 'ganha', motivo: 'ok', agora: AGORA,
    })
    const snapshot = await cap02.consultarPipeline.execute()
    expect(snapshot.totalAtivas).toBe(0)
    expect(snapshot.valorTotalPipeline).toBe(0)
    expect(snapshot.porEstagio['GANHA'].quantidade).toBe(1)
  })
})
