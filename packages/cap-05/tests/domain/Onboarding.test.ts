import { Onboarding, MARCOS_OBRIGATORIOS } from '../../src/domain/entities/Onboarding'

const base = {
  customerId: 'cust-001',
  oportunidadeId: 'op-001',
  responsavelCsId: 'cs-001',
  iniciadoEm: '2026-02-01T10:00:00Z',
}

describe('Onboarding entity', () => {
  it('cria onboarding em status PENDENTE sem marcos completos', () => {
    const o = Onboarding.create(base)
    expect(o.status).toBe('PENDENTE')
    expect(o.marcosCompletos).toHaveLength(0)
    expect(o.todosMarcosCompletos()).toBe(false)
  })

  it('inicia onboarding PENDENTE → EM_PROGRESSO', () => {
    const o = Onboarding.create(base)
    o.iniciar('2026-02-02T10:00:00Z')
    expect(o.status).toBe('EM_PROGRESSO')
  })

  it('não pode iniciar onboarding já em progresso', () => {
    const o = Onboarding.create(base)
    o.iniciar('2026-02-02T10:00:00Z')
    expect(() => o.iniciar('2026-02-03T10:00:00Z')).toThrow('EM_PROGRESSO')
  })

  it('concluirMarco transita para EM_PROGRESSO se PENDENTE', () => {
    const o = Onboarding.create(base)
    o.concluirMarco('KICKOFF', '2026-02-05T10:00:00Z')
    expect(o.status).toBe('EM_PROGRESSO')
    expect(o.marcosCompletos).toContain('KICKOFF')
  })

  it('concluirMarco é idempotente', () => {
    const o = Onboarding.create(base)
    o.concluirMarco('KICKOFF', '2026-02-05T10:00:00Z')
    o.concluirMarco('KICKOFF', '2026-02-06T10:00:00Z')
    expect(o.marcosCompletos.filter(m => m === 'KICKOFF')).toHaveLength(1)
  })

  it('marcosRestantes lista os marcos pendentes', () => {
    const o = Onboarding.create(base)
    o.concluirMarco('KICKOFF', '2026-02-05T00:00:00Z')
    const restantes = o.marcosRestantes()
    expect(restantes).not.toContain('KICKOFF')
    expect(restantes).toContain('CONFIGURACAO')
    expect(restantes).toContain('TREINAMENTO')
    expect(restantes).toContain('GO_LIVE')
  })

  it('RN-C05: finalizar sem todos os marcos lança erro', () => {
    const o = Onboarding.create(base)
    o.concluirMarco('KICKOFF', '2026-02-05T00:00:00Z')
    expect(() => o.finalizar('2026-03-01T00:00:00Z')).toThrow('RN-C05')
  })

  it('finaliza onboarding com todos os marcos completos', () => {
    const o = Onboarding.create(base)
    const agora = '2026-02-01T10:00:00Z'
    for (const marco of MARCOS_OBRIGATORIOS) {
      o.concluirMarco(marco, agora)
    }
    o.finalizar('2026-03-01T00:00:00Z')
    expect(o.status).toBe('CONCLUIDO')
    expect(o.concluidoEm).toBe('2026-03-01T00:00:00Z')
  })

  it('não pode finalizar onboarding já concluído', () => {
    const o = Onboarding.create(base)
    const agora = '2026-02-01T10:00:00Z'
    for (const marco of MARCOS_OBRIGATORIOS) o.concluirMarco(marco, agora)
    o.finalizar('2026-03-01T00:00:00Z')
    expect(() => o.finalizar('2026-04-01T00:00:00Z')).toThrow('concluído')
  })

  it('todosMarcosCompletos retorna true após completar todos', () => {
    const o = Onboarding.create(base)
    const agora = '2026-02-01T10:00:00Z'
    for (const marco of MARCOS_OBRIGATORIOS) o.concluirMarco(marco, agora)
    expect(o.todosMarcosCompletos()).toBe(true)
  })
})
