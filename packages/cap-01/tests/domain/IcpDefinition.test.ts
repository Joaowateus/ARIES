import { IcpDefinition } from '../../src/domain/entities/IcpDefinition'
import { IcpCriteria } from '../../src/domain/value-objects/IcpCriteria'

const AGORA = '2026-01-01T00:00:00.000Z'

const baseCriterioFirmo = IcpCriteria.create({
  dimensao: 'tamanho',
  operador: 'entre',
  valores: ['10', '500'],
  peso: 0.6,
})

const baseCriterioComport = IcpCriteria.create({
  dimensao: 'engajamento',
  operador: 'igual',
  valor: 'alto',
  peso: 0.4,
})

function makeIcp(overrides?: object): IcpDefinition {
  return IcpDefinition.create({
    versao: '1.0.0',
    validoAPartir: AGORA,
    criteriosFirmograficos: [baseCriterioFirmo],
    criteriosComportamentais: [baseCriterioComport],
    exclusoesAbsolutas: [],
    fonteDeCalibracao: 'win_loss_2025',
    ultimaCalibracao: AGORA,
    proximaRevisao: '2026-05-01T00:00:00.000Z',
    criadoPor: 'user-1',
    agora: AGORA,
    ...overrides,
  })
}

describe('IcpDefinition', () => {
  describe('create', () => {
    it('cria ICP com status RASCUNHO', () => {
      const icp = makeIcp()
      expect(icp.status).toBe('RASCUNHO')
      expect(icp.versao).toBe('1.0.0')
    })

    it('rejeita se pesos não somam 1.0', () => {
      expect(() =>
        IcpDefinition.create({
          versao: '1.0.0',
          validoAPartir: AGORA,
          criteriosFirmograficos: [IcpCriteria.create({ dimensao: 'x', operador: 'igual', valor: 'y', peso: 0.3 })],
          criteriosComportamentais: [],
          exclusoesAbsolutas: [],
          fonteDeCalibracao: 'x',
          ultimaCalibracao: AGORA,
          proximaRevisao: AGORA,
          criadoPor: 'u1',
          agora: AGORA,
        }),
      ).toThrow('soma dos pesos')
    })

    it('rejeita se sem critérios firmográficos', () => {
      expect(() =>
        IcpDefinition.create({
          versao: '1.0.0',
          validoAPartir: AGORA,
          criteriosFirmograficos: [],
          criteriosComportamentais: [IcpCriteria.create({ dimensao: 'x', operador: 'igual', valor: 'y', peso: 1.0 })],
          exclusoesAbsolutas: [],
          fonteDeCalibracao: 'x',
          ultimaCalibracao: AGORA,
          proximaRevisao: AGORA,
          criadoPor: 'u1',
          agora: AGORA,
        }),
      ).toThrow('firmográfico')
    })
  })

  describe('transições de estado', () => {
    it('RASCUNHO → EM_REVISAO → APROVADO → ATIVO', () => {
      const icp = makeIcp()
      icp.submeterParaRevisao(AGORA)
      expect(icp.status).toBe('EM_REVISAO')
      icp.aprovar(AGORA)
      expect(icp.status).toBe('APROVADO')
      icp.ativar(AGORA)
      expect(icp.status).toBe('ATIVO')
    })

    it('ATIVO → DESCONTINUADO', () => {
      const icp = makeIcp()
      icp.submeterParaRevisao(AGORA)
      icp.aprovar(AGORA)
      icp.ativar(AGORA)
      icp.descontinuar(AGORA)
      expect(icp.status).toBe('DESCONTINUADO')
    })

    it('rejeita transição inválida', () => {
      const icp = makeIcp()
      expect(() => icp.aprovar(AGORA)).toThrow('RASCUNHO')
    })

    it('só ATIVO pode ser descontinuado', () => {
      const icp = makeIcp()
      expect(() => icp.descontinuar(AGORA)).toThrow('ATIVO')
    })
  })

  describe('calcularScore', () => {
    it('retorna score 10 quando todos os critérios atendidos', () => {
      const icp = makeIcp()
      const score = icp.calcularScore({ tamanho: 100, engajamento: 'alto' })
      expect(score.numeric).toBe(10)
      expect(score.tier).toBe('ICP_FORTE')
    })

    it('retorna score parcial quando apenas firmográfico atendido', () => {
      const icp = makeIcp()
      const score = icp.calcularScore({ tamanho: 100, engajamento: 'baixo' })
      expect(score.numeric).toBeCloseTo(6)
      expect(score.tier).toBe('ICP_ADEQUADO')
    })

    it('retorna score 0 quando nenhum critério atendido', () => {
      const icp = makeIcp()
      const score = icp.calcularScore({ tamanho: 5000, engajamento: 'baixo' })
      expect(score.numeric).toBe(0)
      expect(score.tier).toBe('FORA_DO_ICP')
    })
  })

  describe('precisaRevisao', () => {
    it('retorna true após 120 dias', () => {
      const icp = makeIcp()
      const depois = '2026-06-01T00:00:00.000Z'
      expect(icp.precisaRevisao(depois)).toBe(true)
    })

    it('retorna false antes de 120 dias', () => {
      const icp = makeIcp()
      const depois = '2026-03-01T00:00:00.000Z'
      expect(icp.precisaRevisao(depois)).toBe(false)
    })
  })
})
