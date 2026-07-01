import { DealClose } from '../../src/domain/entities/DealClose'

const AGORA = '2026-01-01T00:00:00.000Z'

const baseGanha = {
  oportunidadeId: '00000000-0000-0000-0000-000000000001',
  clienteId: 'cli-001',
  valorTotal: 60_000,
  mrr: 5_000,
  cicloDias: 45,
  dataInicio: '2026-02-01T00:00:00.000Z',
  dataFim: '2027-02-01T00:00:00.000Z',
  formaPagamento: 'MENSAL' as const,
  responsavelCsId: 'cs-001',
  qualificationId: 'qual-001',
  fechadoPor: 'rep-001',
  agora: AGORA,
}

describe('DealClose', () => {
  describe('criarGanha', () => {
    it('cria fechamento ganho com campos corretos', () => {
      const dc = DealClose.criarGanha(baseGanha)
      expect(dc.resultado).toBe('GANHA')
      expect(dc.valorTotal).toBe(60_000)
      expect(dc.mrr).toBe(5_000)
      expect(dc.foiGanha()).toBe(true)
    })

    it('RN-Q02: rejeita valorTotal ≤ 0', () => {
      expect(() => DealClose.criarGanha({ ...baseGanha, valorTotal: 0 })).toThrow('RN-Q02')
      expect(() => DealClose.criarGanha({ ...baseGanha, valorTotal: -1 })).toThrow('RN-Q02')
    })

    it('RN-Q05: rejeita sem responsavelCsId', () => {
      expect(() => DealClose.criarGanha({ ...baseGanha, responsavelCsId: '' })).toThrow('RN-Q05')
    })

    it('toEventPayload retorna payload ADR-0006 completo', () => {
      const dc = DealClose.criarGanha(baseGanha)
      const payload = dc.toEventPayload()
      expect(payload.oportunidade_id).toBe(baseGanha.oportunidadeId)
      expect(payload.valor_total).toBe(60_000)
      expect(payload.mrr).toBe(5_000)
      expect(payload.responsavel_cs_id).toBe('cs-001')
      expect(payload.forma_pagamento).toBe('MENSAL')
      expect(payload.data_inicio).toBe(baseGanha.dataInicio)
      expect(payload.data_fim).toBe(baseGanha.dataFim)
    })
  })

  describe('criarPerdida', () => {
    it('cria fechamento perdido com motivo', () => {
      const dc = DealClose.criarPerdida({
        oportunidadeId: '00000000-0000-0000-0000-000000000002',
        clienteId: 'cli-002',
        valorTotal: 30_000,
        cicloDias: 60,
        motivoPerda: 'preço acima do orçamento do cliente',
        concorrenteVencedorId: 'conc-001',
        qualificationId: 'qual-002',
        fechadoPor: 'rep-001',
        agora: AGORA,
      })
      expect(dc.resultado).toBe('PERDIDA')
      expect(dc.mrr).toBe(0)
      expect(dc.foiGanha()).toBe(false)
      expect(dc.motivoPerda).toBe('preço acima do orçamento do cliente')
    })

    it('RN-Q03: rejeita motivoPerda vazio', () => {
      expect(() =>
        DealClose.criarPerdida({
          oportunidadeId: '00000000-0000-0000-0000-000000000003',
          clienteId: 'cli-003',
          valorTotal: 10_000,
          cicloDias: 30,
          motivoPerda: '',
          qualificationId: 'qual-003',
          fechadoPor: 'rep-001',
          agora: AGORA,
        }),
      ).toThrow('RN-Q03')
    })
  })
})
