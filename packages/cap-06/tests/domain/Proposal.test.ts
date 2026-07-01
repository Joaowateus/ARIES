import { Proposal } from '../../src/domain/entities/Proposal'

const conformeValidation = {
  conforme: true,
  violacoes: [],
  alcadaNecessaria: 'N1' as const,
  alcadaResponsavel: 'N1' as const,
  exigeAprovacao: false,
}

const violacaoValidation = {
  conforme: false,
  violacoes: ['RN-G01: desconto requer N2, responsável tem N1'],
  alcadaNecessaria: 'N2' as const,
  alcadaResponsavel: 'N1' as const,
  exigeAprovacao: true,
}

const base = {
  oportunidadeId: 'op-001',
  clienteId: 'cli-001',
  policyId: 'pol-001',
  versao: 1,
  status: 'RASCUNHO' as const,
  valorBruto: 60000,
  percentualDesconto: 5,
  margemPercent: 40,
  responsavelId: 'vendedor-01',
  alcadaResponsavel: 'N1' as const,
  policyValidation: conformeValidation,
  condicoesJson: {},
  criadoPor: 'vendedor-01',
  agora: '2026-03-01T10:00:00Z',
}

describe('Proposal entity', () => {
  it('cria proposta RASCUNHO quando conforme com a política', () => {
    const p = Proposal.create(base)
    expect(p.status).toBe('RASCUNHO')
    expect(p.valorLiquido).toBe(57000) // 60000 * (1 - 0.05)
    expect(p.versao).toBe(1)
  })

  it('RN-G04: cria proposta EM_APROVACAO quando há violação de política', () => {
    const p = Proposal.create({ ...base, policyValidation: violacaoValidation })
    expect(p.status).toBe('EM_APROVACAO')
  })

  it('rejeita valorBruto <= 0', () => {
    expect(() => Proposal.create({ ...base, valorBruto: 0 })).toThrow('valorBruto')
  })

  it('rejeita percentualDesconto >= 100', () => {
    expect(() => Proposal.create({ ...base, percentualDesconto: 100 })).toThrow('percentualDesconto')
  })

  it('calcula valorLiquido corretamente para desconto de 10%', () => {
    const p = Proposal.create({ ...base, percentualDesconto: 10 })
    expect(p.valorLiquido).toBeCloseTo(54000)
  })

  it('estaAtiva retorna true para RASCUNHO, EM_APROVACAO, APROVADA', () => {
    const rascunho = Proposal.create(base)
    expect(rascunho.estaAtiva()).toBe(true)

    const emAprov = Proposal.create({ ...base, policyValidation: violacaoValidation })
    expect(emAprov.estaAtiva()).toBe(true)
  })

  it('aprovar transita de EM_APROVACAO para APROVADA', () => {
    const p = Proposal.create({ ...base, policyValidation: violacaoValidation })
    p.aprovar('2026-03-02T10:00:00Z')
    expect(p.status).toBe('APROVADA')
  })

  it('não pode aprovar proposta RASCUNHO', () => {
    const p = Proposal.create(base)
    expect(() => p.aprovar('2026-03-02T10:00:00Z')).toThrow('EM_APROVACAO')
  })

  it('reprovar transita de EM_APROVACAO para REPROVADA com motivo', () => {
    const p = Proposal.create({ ...base, policyValidation: violacaoValidation })
    p.reprovar('Desconto muito elevado para o segmento', '2026-03-02T10:00:00Z')
    expect(p.status).toBe('REPROVADA')
    expect(p.motivoReprovacao).toBe('Desconto muito elevado para o segmento')
  })

  it('RN-G05: não pode enviar proposta RASCUNHO', () => {
    const p = Proposal.create(base)
    expect(() => p.enviar('2026-03-03T10:00:00Z')).toThrow('RN-G05')
  })

  it('envia proposta APROVADA ao cliente', () => {
    const p = Proposal.create({ ...base, policyValidation: violacaoValidation })
    p.aprovar('2026-03-02T10:00:00Z')
    p.enviar('2026-03-03T10:00:00Z')
    expect(p.status).toBe('ENVIADA')
    expect(p.enviadaEm).toBe('2026-03-03T10:00:00Z')
  })

  it('cancelar proposta RASCUNHO', () => {
    const p = Proposal.create(base)
    p.cancelar('2026-03-02T10:00:00Z')
    expect(p.status).toBe('CANCELADA')
    expect(p.estaAtiva()).toBe(false)
  })

  it('não pode cancelar proposta ENVIADA', () => {
    const p = Proposal.create({ ...base, policyValidation: violacaoValidation })
    p.aprovar('2026-03-02T10:00:00Z')
    p.enviar('2026-03-03T10:00:00Z')
    expect(() => p.cancelar('2026-03-04T10:00:00Z')).toThrow('ENVIADA')
  })
})
