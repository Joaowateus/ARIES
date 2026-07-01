import { CriarIcpUseCase } from '../../src/application/use-cases/icp/CriarIcpUseCase'
import { AtivarIcpUseCase } from '../../src/application/use-cases/icp/AtivarIcpUseCase'
import { AvaliarProspectIcpUseCase } from '../../src/application/use-cases/icp/AvaliarProspectIcpUseCase'
import { InMemoryIcpRepository } from '../../src/infrastructure/repositories/InMemoryIcpRepository'

const AGORA = '2026-01-01T00:00:00.000Z'

const criterioFirmo = { dimensao: 'funcionarios', operador: 'entre' as const, valores: ['10', '500'], peso: 0.6 }
const criterioComport = { dimensao: 'maturidade_digital', operador: 'igual' as const, valor: 'alta', peso: 0.4 }

describe('CriarIcpUseCase', () => {
  let repo: InMemoryIcpRepository
  let criarUc: CriarIcpUseCase
  let ativarUc: AtivarIcpUseCase
  let avaliarUc: AvaliarProspectIcpUseCase

  beforeEach(() => {
    repo = new InMemoryIcpRepository()
    criarUc = new CriarIcpUseCase(repo)
    ativarUc = new AtivarIcpUseCase(repo)
    avaliarUc = new AvaliarProspectIcpUseCase(repo)
  })

  it('cria ICP e salva no repositório', async () => {
    const result = await criarUc.execute({
      versao: '1.0.0',
      validoAPartir: AGORA,
      criteriosFirmograficos: [criterioFirmo],
      criteriosComportamentais: [criterioComport],
      exclusoesAbsolutas: [],
      fonteDeCalibracao: 'dados_2025',
      ultimaCalibracao: AGORA,
      proximaRevisao: '2026-05-01T00:00:00.000Z',
      criadoPor: 'user-1',
      agora: AGORA,
    })

    expect(result.id).toBeDefined()
    expect(result.status).toBe('RASCUNHO')
    expect(result.versao).toBe('1.0.0')
    expect(await repo.findById(result.id)).not.toBeNull()
  })

  it('RN-02: rejeita versão inválida', async () => {
    await expect(
      criarUc.execute({
        versao: '1.0',
        validoAPartir: AGORA,
        criteriosFirmograficos: [criterioFirmo],
        criteriosComportamentais: [criterioComport],
        exclusoesAbsolutas: [],
        fonteDeCalibracao: 'x',
        ultimaCalibracao: AGORA,
        proximaRevisao: AGORA,
        criadoPor: 'u1',
        agora: AGORA,
      }),
    ).rejects.toThrow('RN-02')
  })

  it('ativar ICP descontinua o anterior', async () => {
    const v1 = await criarUc.execute({
      versao: '1.0.0',
      validoAPartir: AGORA,
      criteriosFirmograficos: [criterioFirmo],
      criteriosComportamentais: [criterioComport],
      exclusoesAbsolutas: [],
      fonteDeCalibracao: 'x',
      ultimaCalibracao: AGORA,
      proximaRevisao: AGORA,
      criadoPor: 'u1',
      agora: AGORA,
    })
    await ativarUc.execute(v1.id, AGORA)

    const v2 = await criarUc.execute({
      versao: '2.0.0',
      validoAPartir: AGORA,
      criteriosFirmograficos: [criterioFirmo],
      criteriosComportamentais: [criterioComport],
      exclusoesAbsolutas: [],
      fonteDeCalibracao: 'x',
      ultimaCalibracao: AGORA,
      proximaRevisao: AGORA,
      criadoPor: 'u1',
      agora: AGORA,
    })
    await ativarUc.execute(v2.id, AGORA)

    const anterior = await repo.findById(v1.id)
    expect(anterior?.status).toBe('DESCONTINUADO')

    const novo = await repo.findById(v2.id)
    expect(novo?.status).toBe('ATIVO')
  })

  it('avaliar prospect usa ICP ativo', async () => {
    const icp = await criarUc.execute({
      versao: '1.0.0',
      validoAPartir: AGORA,
      criteriosFirmograficos: [criterioFirmo],
      criteriosComportamentais: [criterioComport],
      exclusoesAbsolutas: [],
      fonteDeCalibracao: 'x',
      ultimaCalibracao: AGORA,
      proximaRevisao: AGORA,
      criadoPor: 'u1',
      agora: AGORA,
    })
    await ativarUc.execute(icp.id, AGORA)

    const result = await avaliarUc.execute({
      atributos: { funcionarios: 50, maturidade_digital: 'alta' },
    })

    expect(result.score).toBe(10)
    expect(result.tier).toBe('ICP_FORTE')
    expect(result.icpVersao).toBe('1.0.0')
  })
})
