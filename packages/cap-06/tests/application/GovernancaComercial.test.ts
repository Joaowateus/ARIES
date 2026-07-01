import { bootstrapCap06 } from '../../src/bootstrap'
import {
  PropostaCriadaPayload,
  PropostaAprovadaPayload,
  PropostaReprovadaPayload,
  PropostaEnviadaPayload,
  ViolacaoDetectadaPayload,
} from '../../src/infrastructure/events/cap06-events'

const AGORA = '2026-03-01T10:00:00Z'

async function setupComPolitica(cap06 = bootstrapCap06()) {
  await cap06.useCases.definirPolitica.execute({
    nome: 'Política Global 2026',
    descontoMaxN1: 5,
    descontoMaxN2: 10,
    descontoMaxN3: 20,
    margemMinimaPercent: 15,
    criadoPor: 'admin',
    agora: AGORA,
  })
  return cap06
}

const propostaBase = {
  oportunidadeId: 'op-001',
  clienteId: 'cli-001',
  valorBruto: 60000,
  margemPercent: 40,
  responsavelId: 'vendedor-01',
  alcadaResponsavel: 'N1' as const,
  condicoesJson: {},
  criadoPor: 'vendedor-01',
  agora: AGORA,
}

describe('DefinirPoliticaUseCase', () => {
  it('cria política comercial global com alçadas', async () => {
    const cap06 = bootstrapCap06()
    const out = await cap06.useCases.definirPolitica.execute({
      nome: 'Política 2026',
      descontoMaxN1: 5,
      descontoMaxN2: 10,
      descontoMaxN3: 20,
      margemMinimaPercent: 15,
      criadoPor: 'admin',
      agora: AGORA,
    })
    expect(out.policy.status).toBe('ATIVA')
    expect(out.policy.descontoMaxN1).toBe(5)
  })

  it('inativa política anterior ao criar nova para o mesmo segmento', async () => {
    const cap06 = bootstrapCap06()
    const out1 = await cap06.useCases.definirPolitica.execute({
      nome: 'V1', descontoMaxN1: 5, descontoMaxN2: 10, descontoMaxN3: 20,
      margemMinimaPercent: 15, criadoPor: 'admin', agora: AGORA,
    })
    const out2 = await cap06.useCases.definirPolitica.execute({
      nome: 'V2', descontoMaxN1: 3, descontoMaxN2: 8, descontoMaxN3: 15,
      margemMinimaPercent: 20, criadoPor: 'admin', agora: '2026-06-01T00:00:00Z',
    })

    const antiga = await cap06.repos.policy.findById(out1.policy.id)
    expect(antiga?.status).toBe('INATIVA')
    expect(out2.policy.status).toBe('ATIVA')
  })
})

describe('CriarPropostaUseCase — proposta conforme', () => {
  it('desconto dentro da alçada N1 → RASCUNHO, sem exigir aprovação', async () => {
    const cap06 = await setupComPolitica()
    const out = await cap06.useCases.criarProposta.execute({
      ...propostaBase,
      percentualDesconto: 5,
    })

    expect(out.proposal.status).toBe('RASCUNHO')
    expect(out.proposal.valorLiquido).toBe(57000)
    expect(out.proposal.policyValidation.conforme).toBe(true)
    expect(out.approvalRequest).toBeUndefined()
  })

  it('eventPayload válido conforme CUE cap06.proposta.criada', async () => {
    const cap06 = await setupComPolitica()
    const out = await cap06.useCases.criarProposta.execute({
      ...propostaBase, percentualDesconto: 5,
    })

    const result = PropostaCriadaPayload.safeParse(out.eventPayload)
    expect(result.success).toBe(true)
  })
})

describe('CriarPropostaUseCase — proposta com violação de alçada', () => {
  it('RN-G01: desconto acima da alçada N1 → EM_APROVACAO + ApprovalRequest criado', async () => {
    const cap06 = await setupComPolitica()
    const out = await cap06.useCases.criarProposta.execute({
      ...propostaBase,
      percentualDesconto: 8, // > 5% (max N1)
    })

    expect(out.proposal.status).toBe('EM_APROVACAO')
    expect(out.proposal.policyValidation.exigeAprovacao).toBe(true)
    expect(out.approvalRequest).toBeDefined()
    expect(out.approvalRequest!.nivelNecessario).toBe('N2')
    expect(out.approvalRequest!.status).toBe('PENDENTE')
    expect(out.eventPayload.violacoes).toHaveLength(1)
  })

  it('RN-G02: margem abaixo do mínimo → EM_APROVACAO com violação de margem', async () => {
    const cap06 = await setupComPolitica()
    const out = await cap06.useCases.criarProposta.execute({
      ...propostaBase,
      percentualDesconto: 3, // dentro da alçada N1
      margemPercent: 10,     // abaixo do mínimo de 15%
    })

    expect(out.proposal.status).toBe('EM_APROVACAO')
    expect(out.proposal.policyValidation.violacoes.some(v => v.includes('RN-G02'))).toBe(true)
  })

  it('ViolacaoDetectadaPayload é válido conforme CUE', async () => {
    const cap06 = await setupComPolitica()
    const out = await cap06.useCases.criarProposta.execute({
      ...propostaBase, percentualDesconto: 8,
    })

    const violacaoPayload = {
      proposta_id: out.proposal.id,
      oportunidade_id: out.proposal.oportunidadeId,
      violacoes: out.proposal.policyValidation.violacoes,
      alcada_necessaria: out.proposal.policyValidation.alcadaNecessaria,
      alcada_responsavel: out.proposal.policyValidation.alcadaResponsavel,
      detectado_em: AGORA,
    }
    const result = ViolacaoDetectadaPayload.safeParse(violacaoPayload)
    expect(result.success).toBe(true)
  })
})

describe('CriarPropostaUseCase — RN-G03 (proposta única ativa por oportunidade)', () => {
  it('RN-G03: impede criar segunda proposta ativa para a mesma oportunidade', async () => {
    const cap06 = await setupComPolitica()
    await cap06.useCases.criarProposta.execute({ ...propostaBase, percentualDesconto: 5 })

    await expect(
      cap06.useCases.criarProposta.execute({ ...propostaBase, percentualDesconto: 3 }),
    ).rejects.toThrow('RN-G03')
  })

  it('permite criar nova proposta após cancelar a anterior', async () => {
    const cap06 = await setupComPolitica()
    const out1 = await cap06.useCases.criarProposta.execute({ ...propostaBase, percentualDesconto: 5 })
    out1.proposal // acesso ao objeto

    // Cancelar proposta via repo direto
    const p = await cap06.repos.proposal.findById(out1.proposal.id)
    p!.cancelar(AGORA)
    await cap06.repos.proposal.save(p!)

    const out2 = await cap06.useCases.criarProposta.execute({ ...propostaBase, percentualDesconto: 3, agora: '2026-03-02T00:00:00Z' })
    expect(out2.proposal.versao).toBe(2) // segunda versão
  })
})

describe('AprovarPropostaUseCase', () => {
  it('aprova proposta EM_APROVACAO com alçada suficiente', async () => {
    const cap06 = await setupComPolitica()
    const created = await cap06.useCases.criarProposta.execute({
      ...propostaBase, percentualDesconto: 8,
    })

    const out = await cap06.useCases.aprovarProposta.execute({
      propostaId: created.proposal.id,
      aprovadoPor: 'gerente-01',
      alcadaAprovador: 'N2',
      motivo: 'Desconto justificado para o cliente estratégico',
      agora: '2026-03-02T10:00:00Z',
    })

    expect(out.proposal.status).toBe('APROVADA')

    const result = PropostaAprovadaPayload.safeParse(out.eventPayload)
    expect(result.success).toBe(true)
  })

  it('rejeita aprovação com alçada insuficiente', async () => {
    const cap06 = await setupComPolitica()
    const created = await cap06.useCases.criarProposta.execute({
      ...propostaBase, percentualDesconto: 15, // requer N3
    })

    await expect(
      cap06.useCases.aprovarProposta.execute({
        propostaId: created.proposal.id,
        aprovadoPor: 'gerente-01',
        alcadaAprovador: 'N2', // N2 não tem alçada para N3
        motivo: 'Tentar aprovar',
        agora: '2026-03-02T10:00:00Z',
      }),
    ).rejects.toThrow('N2')
  })
})

describe('ReprovarPropostaUseCase', () => {
  it('reprova proposta EM_APROVACAO', async () => {
    const cap06 = await setupComPolitica()
    const created = await cap06.useCases.criarProposta.execute({
      ...propostaBase, percentualDesconto: 8,
    })

    const out = await cap06.useCases.reprovarProposta.execute({
      propostaId: created.proposal.id,
      reprovadoPor: 'gerente-01',
      alcadaAprovador: 'N2',
      motivo: 'Desconto não justificado',
      agora: '2026-03-02T10:00:00Z',
    })

    expect(out.proposal.status).toBe('REPROVADA')
    const result = PropostaReprovadaPayload.safeParse(out.eventPayload)
    expect(result.success).toBe(true)
  })
})

describe('EnviarPropostaUseCase', () => {
  it('envia proposta APROVADA ao cliente', async () => {
    const cap06 = await setupComPolitica()
    const created = await cap06.useCases.criarProposta.execute({
      ...propostaBase, percentualDesconto: 8,
    })
    await cap06.useCases.aprovarProposta.execute({
      propostaId: created.proposal.id,
      aprovadoPor: 'gerente-01',
      alcadaAprovador: 'N2',
      motivo: 'Aprovado',
      agora: '2026-03-02T10:00:00Z',
    })

    const out = await cap06.useCases.enviarProposta.execute({
      propostaId: created.proposal.id,
      agora: '2026-03-03T10:00:00Z',
    })

    expect(out.proposal.status).toBe('ENVIADA')
    const result = PropostaEnviadaPayload.safeParse(out.eventPayload)
    expect(result.success).toBe(true)
  })

  it('RN-G05: não pode enviar proposta RASCUNHO diretamente', async () => {
    const cap06 = await setupComPolitica()
    const created = await cap06.useCases.criarProposta.execute({
      ...propostaBase, percentualDesconto: 5,
    })

    await expect(
      cap06.useCases.enviarProposta.execute({
        propostaId: created.proposal.id,
        agora: '2026-03-02T10:00:00Z',
      }),
    ).rejects.toThrow('RN-G05')
  })
})
