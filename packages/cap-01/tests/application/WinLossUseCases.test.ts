import { RegistrarWinLossUseCase } from '../../src/application/use-cases/win-loss/RegistrarWinLossUseCase'
import { SubmeterAnaliseWinLossUseCase } from '../../src/application/use-cases/win-loss/SubmeterAnaliseWinLossUseCase'
import { InMemoryWinLossRepository } from '../../src/infrastructure/repositories/InMemoryWinLossRepository'
import { WinLossResult } from '../../src/domain/value-objects/WinLossResult'

const AGORA = '2026-01-01T00:00:00.000Z'

describe('Win/Loss Use Cases', () => {
  let repo: InMemoryWinLossRepository
  let registrar: RegistrarWinLossUseCase
  let submeter: SubmeterAnaliseWinLossUseCase

  beforeEach(() => {
    repo = new InMemoryWinLossRepository()
    registrar = new RegistrarWinLossUseCase(repo)
    submeter = new SubmeterAnaliseWinLossUseCase(repo)
  })

  it('registra análise para oportunidade', async () => {
    const result = await registrar.execute({
      oportunidadeId: 'op-001',
      eventoOrigemId: 'evt-001',
      agora: AGORA,
    })

    expect(result.status).toBe('PENDENTE_ANALISE')
    expect(result.oportunidadeId).toBe('op-001')
  })

  it('idempotente: registrar mesma oportunidade retorna existente', async () => {
    const r1 = await registrar.execute({ oportunidadeId: 'op-001', eventoOrigemId: 'e1', agora: AGORA })
    const r2 = await registrar.execute({ oportunidadeId: 'op-001', eventoOrigemId: 'e2', agora: AGORA })
    expect(r1.id).toBe(r2.id)
  })

  it('submeter análise muda status para ANALISADA', async () => {
    const reg = await registrar.execute({ oportunidadeId: 'op-002', eventoOrigemId: 'e1', agora: AGORA })

    const sub = await submeter.execute({
      analiseId: reg.id,
      result: WinLossResult.lost('PRECO', 'Concorrente Y'),
      fatoresNegativos: ['preço'],
      fatoresPositivos: [],
      sinaisDeAlertaIgnorados: [],
      aprendizados: ['revisar proposta de valor'],
      validadoPor: 'gestor-1',
      agora: AGORA,
    })

    expect(sub.status).toBe('ANALISADA')
  })

  it('RN-08: rejeita aprendizados com nomeação individual', async () => {
    const reg = await registrar.execute({ oportunidadeId: 'op-003', eventoOrigemId: 'e1', agora: AGORA })

    await expect(
      submeter.execute({
        analiseId: reg.id,
        result: WinLossResult.lost('PRECO'),
        fatoresNegativos: [],
        fatoresPositivos: [],
        sinaisDeAlertaIgnorados: [],
        aprendizados: ['O Sr. João falhou na negociação'],
        validadoPor: 'g1',
        agora: AGORA,
      }),
    ).rejects.toThrow('RN-08')
  })
})
