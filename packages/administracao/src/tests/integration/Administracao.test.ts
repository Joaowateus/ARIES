import { bootstrapAdministracao } from '../../bootstrap'
import { possuiPermissao, RBAC } from '../../domain/rules/Rbac'

const EMPRESA_ID = 'empresa-tech-solutions-001'
const ADMIN_ID   = 'usuario-admin-fundador-001'
const AGORA      = '2026-07-01T09:00:00.000Z'

describe('Sprint 3 — Administração: estrutura organizacional e controle de acesso', () => {
  let app: ReturnType<typeof bootstrapAdministracao>

  beforeEach(() => { app = bootstrapAdministracao() })

  // ─── Critério 1: Criar empresa (representada por criar o admin fundador) ──────
  describe('1. Criar empresa e admin inicial', () => {
    it('convida o primeiro usuário como ADMINISTRADOR em status PENDENTE', async () => {
      const result = await app.useCases.convidarUsuario.execute({
        empresaId: EMPRESA_ID,
        nome: 'Joao Admin',
        email: 'joao@techsolutions.com',
        papel: 'ADMINISTRADOR',
        convidadoPor: ADMIN_ID,
        agora: AGORA,
      })
      expect(result.status).toBe('PENDENTE')
      expect(result.email).toBe('joao@techsolutions.com')
    })

    it('convite idempotente: segundo convite para o mesmo email retorna o existente', async () => {
      const r1 = await app.useCases.convidarUsuario.execute({
        empresaId: EMPRESA_ID, nome: 'Joao Admin', email: 'joao@techsolutions.com',
        papel: 'ADMINISTRADOR', convidadoPor: ADMIN_ID, agora: AGORA,
      })
      const r2 = await app.useCases.convidarUsuario.execute({
        empresaId: EMPRESA_ID, nome: 'Joao Admin', email: 'joao@techsolutions.com',
        papel: 'ADMINISTRADOR', convidadoPor: ADMIN_ID, agora: AGORA,
      })
      expect(r1.usuarioId).toBe(r2.usuarioId)
      // apenas 1 evento publicado (o segundo não publicou)
      expect(app.events.findByTipo('usuario.convidado')).toHaveLength(1)
    })
  })

  // ─── Critério 2 & 3: Filiais e times ──────────────────────────────────────────
  describe('2. Criar filiais', () => {
    it('cria filial São Paulo com estado e cidade', async () => {
      const filial = await app.useCases.criarFilial.execute({
        empresaId: EMPRESA_ID, nome: 'Filial São Paulo', cidade: 'São Paulo', estado: 'SP',
        atorId: ADMIN_ID, agora: AGORA,
      })
      expect(filial.status).toBe('ATIVA')
      expect(filial.cidade).toBe('São Paulo')
      expect(filial.equipeIds).toHaveLength(0)
    })

    it('edita filial e vincula time', async () => {
      const filial = await app.useCases.criarFilial.execute({
        empresaId: EMPRESA_ID, nome: 'Filial RJ', atorId: ADMIN_ID, agora: AGORA,
      })
      const time = await app.useCases.criarTime.execute({
        empresaId: EMPRESA_ID, nome: 'Time RJ', atorId: ADMIN_ID, agora: AGORA,
      })

      await app.useCases.editarFilial.execute({
        filialId: filial.id, vincularEquipes: [time.id], atorId: ADMIN_ID, agora: AGORA,
      })

      const filiais = await app.repos.filialRepo.findByEmpresa(EMPRESA_ID)
      const filialAtualizada = filiais.find(f => f.id === filial.id)!
      expect(filialAtualizada.toObject().equipeIds).toContain(time.id)
    })

    it('desativa filial', async () => {
      const filial = await app.useCases.criarFilial.execute({
        empresaId: EMPRESA_ID, nome: 'Filial Sul', atorId: ADMIN_ID, agora: AGORA,
      })
      await app.useCases.desativarFilial.execute({ filialId: filial.id, atorId: ADMIN_ID, agora: AGORA })
      const filialBd = await app.repos.filialRepo.findById(filial.id)
      expect(filialBd!.status).toBe('INATIVA')
    })
  })

  describe('3. Criar e gerenciar equipes', () => {
    it('cria time de vendas com lider', async () => {
      const time = await app.useCases.criarTime.execute({
        empresaId: EMPRESA_ID, nome: 'Time Vendas SP', liderId: 'gerente-001',
        atorId: ADMIN_ID, agora: AGORA,
      })
      expect(time.status).toBe('ATIVO')
      expect(time.liderId).toBe('gerente-001')
      expect(time.membroIds).toHaveLength(0)
    })

    it('adiciona membros ao time', async () => {
      const time = await app.useCases.criarTime.execute({
        empresaId: EMPRESA_ID, nome: 'Time CS', atorId: ADMIN_ID, agora: AGORA,
      })
      await app.useCases.editarTime.execute({
        timeId: time.id, adicionarMembros: ['user-a', 'user-b'], atorId: ADMIN_ID, agora: AGORA,
      })
      const timeBd = await app.repos.timeRepo.findById(time.id)
      expect(timeBd!.toObject().membroIds).toEqual(['user-a', 'user-b'])
    })

    it('adicão de membro é idempotente', async () => {
      const time = await app.useCases.criarTime.execute({
        empresaId: EMPRESA_ID, nome: 'Time SDR', atorId: ADMIN_ID, agora: AGORA,
      })
      await app.useCases.editarTime.execute({
        timeId: time.id, adicionarMembros: ['user-x'], atorId: ADMIN_ID, agora: AGORA,
      })
      await app.useCases.editarTime.execute({
        timeId: time.id, adicionarMembros: ['user-x'], atorId: ADMIN_ID, agora: AGORA,
      })
      const timeBd = await app.repos.timeRepo.findById(time.id)
      expect(timeBd!.toObject().membroIds).toHaveLength(1)
    })

    it('desativa time', async () => {
      const time = await app.useCases.criarTime.execute({
        empresaId: EMPRESA_ID, nome: 'Time Antigo', atorId: ADMIN_ID, agora: AGORA,
      })
      await app.useCases.desativarTime.execute({ timeId: time.id, atorId: ADMIN_ID, agora: AGORA })
      const timeBd = await app.repos.timeRepo.findById(time.id)
      expect(timeBd!.status).toBe('INATIVO')
    })
  })

  // ─── Critério 4 & 5: Convidar e definir papéis ───────────────────────────────
  describe('4 & 5. Convidar usuários e definir papéis', () => {
    it('convida 5 usuários com papéis distintos e todos ficam PENDENTE', async () => {
      const usuarios = [
        { nome: 'Ana Vendedora', email: 'ana@ts.com',    papel: 'VENDEDOR'       as const },
        { nome: 'Bruno SDR',     email: 'bruno@ts.com',  papel: 'SDR'            as const },
        { nome: 'Carlos Gestor', email: 'carlos@ts.com', papel: 'GERENTE_COMERCIAL' as const },
        { nome: 'Diana CS',      email: 'diana@ts.com',  papel: 'CS'             as const },
        { nome: 'Eduardo Fin',   email: 'edu@ts.com',    papel: 'FINANCEIRO'     as const },
      ]
      for (const u of usuarios) {
        const r = await app.useCases.convidarUsuario.execute({
          ...u, empresaId: EMPRESA_ID, convidadoPor: ADMIN_ID, agora: AGORA,
        })
        expect(r.status).toBe('PENDENTE')
      }
      const todos = await app.useCases.consultarUsuarios.execute({ empresaId: EMPRESA_ID })
      expect(todos.total).toBe(5)
    })

    it('altera papel de VENDEDOR para SUPERVISOR após ativação', async () => {
      const { usuarioId } = await app.useCases.convidarUsuario.execute({
        empresaId: EMPRESA_ID, nome: 'Pedro', email: 'pedro@ts.com',
        papel: 'VENDEDOR', convidadoPor: ADMIN_ID, agora: AGORA,
      })
      await app.useCases.ativarUsuario.execute({ usuarioId, atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.alterarPapel.execute({ usuarioId, novoPapel: 'SUPERVISOR', atorId: ADMIN_ID, agora: AGORA })

      const usuario = await app.repos.usuarioRepo.findById(usuarioId)
      expect(usuario!.papel).toBe('SUPERVISOR')

      const eventoAlteracao = app.events.findByTipo('usuario.papel.alterado')
      expect(eventoAlteracao[0].payload).toMatchObject({ de: 'VENDEDOR', para: 'SUPERVISOR' })
    })
  })

  // ─── Critério 6: Login (ativar usuário = primeiro acesso) ─────────────────────
  describe('6. Fazer login — ativar usuário (primeiro acesso)', () => {
    it('usuário PENDENTE é ativado e status muda para ATIVO', async () => {
      const { usuarioId } = await app.useCases.convidarUsuario.execute({
        empresaId: EMPRESA_ID, nome: 'Fernanda', email: 'fernanda@ts.com',
        papel: 'VENDEDOR', convidadoPor: ADMIN_ID, agora: AGORA,
      })

      await app.useCases.ativarUsuario.execute({ usuarioId, atorId: ADMIN_ID, agora: AGORA })

      const usuario = await app.repos.usuarioRepo.findById(usuarioId)
      expect(usuario!.status).toBe('ATIVO')
      expect(usuario!.toObject().ativadoEm).toBe(AGORA)
    })

    it('não é possível ativar usuário já ATIVO', async () => {
      const { usuarioId } = await app.useCases.convidarUsuario.execute({
        empresaId: EMPRESA_ID, nome: 'Gil', email: 'gil@ts.com',
        papel: 'SDR', convidadoPor: ADMIN_ID, agora: AGORA,
      })
      await app.useCases.ativarUsuario.execute({ usuarioId, atorId: ADMIN_ID, agora: AGORA })
      await expect(
        app.useCases.ativarUsuario.execute({ usuarioId, atorId: ADMIN_ID, agora: AGORA })
      ).rejects.toThrow('não é possível ativar')
    })
  })

  // ─── Critério 7: Controle de acesso por papel (RBAC) ──────────────────────────
  describe('7. Restringir acesso conforme papel', () => {
    let vendedorId: string
    let sdrId: string
    let gerenteId: string
    let financeiroId: string

    beforeEach(async () => {
      const v = await app.useCases.convidarUsuario.execute({ empresaId: EMPRESA_ID, nome: 'Ana', email: 'ana@ts.com', papel: 'VENDEDOR', convidadoPor: ADMIN_ID, agora: AGORA })
      const s = await app.useCases.convidarUsuario.execute({ empresaId: EMPRESA_ID, nome: 'Bruno', email: 'b@ts.com', papel: 'SDR', convidadoPor: ADMIN_ID, agora: AGORA })
      const g = await app.useCases.convidarUsuario.execute({ empresaId: EMPRESA_ID, nome: 'Carlos', email: 'c@ts.com', papel: 'GERENTE_COMERCIAL', convidadoPor: ADMIN_ID, agora: AGORA })
      const f = await app.useCases.convidarUsuario.execute({ empresaId: EMPRESA_ID, nome: 'Eduardo', email: 'e@ts.com', papel: 'FINANCEIRO', convidadoPor: ADMIN_ID, agora: AGORA })
      vendedorId = v.usuarioId; sdrId = s.usuarioId; gerenteId = g.usuarioId; financeiroId = f.usuarioId
      for (const id of [vendedorId, sdrId, gerenteId, financeiroId]) {
        await app.useCases.ativarUsuario.execute({ usuarioId: id, atorId: ADMIN_ID, agora: AGORA })
      }
    })

    it('VENDEDOR pode acessar dashboard:vendedor mas não dashboard:executivo', async () => {
      const pode = await app.useCases.verificarPermissao.execute({ usuarioId: vendedorId, permissao: 'dashboard:vendedor' })
      const naoPode = await app.useCases.verificarPermissao.execute({ usuarioId: vendedorId, permissao: 'dashboard:executivo' })
      expect(pode.permitido).toBe(true)
      expect(naoPode.permitido).toBe(false)
    })

    it('SDR pode escrever no pipeline mas não convidar usuários', async () => {
      const pode = await app.useCases.verificarPermissao.execute({ usuarioId: sdrId, permissao: 'pipeline:escrever' })
      const naoPode = await app.useCases.verificarPermissao.execute({ usuarioId: sdrId, permissao: 'usuarios:convidar' })
      expect(pode.permitido).toBe(true)
      expect(naoPode.permitido).toBe(false)
    })

    it('GERENTE_COMERCIAL pode criar times mas não criar filiais', async () => {
      const pode = await app.useCases.verificarPermissao.execute({ usuarioId: gerenteId, permissao: 'times:criar' })
      const naoPode = await app.useCases.verificarPermissao.execute({ usuarioId: gerenteId, permissao: 'filiais:criar' })
      expect(pode.permitido).toBe(true)
      expect(naoPode.permitido).toBe(false)
    })

    it('FINANCEIRO pode ver dashboard:executivo mas não escrever no pipeline', async () => {
      const pode = await app.useCases.verificarPermissao.execute({ usuarioId: financeiroId, permissao: 'dashboard:executivo' })
      const naoPode = await app.useCases.verificarPermissao.execute({ usuarioId: financeiroId, permissao: 'pipeline:escrever' })
      expect(pode.permitido).toBe(true)
      expect(naoPode.permitido).toBe(false)
    })

    it('usuário INATIVO não tem nenhuma permissão', async () => {
      await app.useCases.desativarUsuario.execute({ usuarioId: vendedorId, atorId: ADMIN_ID, agora: AGORA })
      const result = await app.useCases.verificarPermissao.execute({ usuarioId: vendedorId, permissao: 'pipeline:ler' })
      expect(result.permitido).toBe(false)
      expect(result.permissoesDisponiveis).toHaveLength(0)
    })

    it('ADMINISTRADOR tem acesso a todas as permissões', async () => {
      const adminId = (await app.useCases.convidarUsuario.execute({
        empresaId: EMPRESA_ID, nome: 'Admin', email: 'admin@ts.com',
        papel: 'ADMINISTRADOR', convidadoPor: ADMIN_ID, agora: AGORA,
      })).usuarioId
      await app.useCases.ativarUsuario.execute({ usuarioId: adminId, atorId: ADMIN_ID, agora: AGORA })

      const permissoesAdmin = RBAC['ADMINISTRADOR']
      for (const perm of ['usuarios:convidar', 'times:criar', 'filiais:criar', 'dashboard:executivo', 'pipeline:escrever'] as const) {
        const r = await app.useCases.verificarPermissao.execute({ usuarioId: adminId, permissao: perm })
        expect(r.permitido).toBe(true)
      }
      expect(permissoesAdmin.length).toBeGreaterThan(15)
    })

    it('LEITOR pode consultar mas não pode escrever nada', async () => {
      const leitId = (await app.useCases.convidarUsuario.execute({
        empresaId: EMPRESA_ID, nome: 'Leitor', email: 'leitor@ts.com',
        papel: 'LEITOR', convidadoPor: ADMIN_ID, agora: AGORA,
      })).usuarioId
      await app.useCases.ativarUsuario.execute({ usuarioId: leitId, atorId: ADMIN_ID, agora: AGORA })

      expect(possuiPermissao('LEITOR', 'pipeline:ler')).toBe(true)
      expect(possuiPermissao('LEITOR', 'pipeline:escrever')).toBe(false)
      expect(possuiPermissao('LEITOR', 'propostas:escrever')).toBe(false)
      expect(possuiPermissao('LEITOR', 'usuarios:convidar')).toBe(false)
    })
  })

  // ─── Critério 8: Auditoria ────────────────────────────────────────────────────
  describe('8. Auditar todas as ações', () => {
    it('registra evento de auditoria para cada ação administrativa', async () => {
      const { usuarioId } = await app.useCases.convidarUsuario.execute({
        empresaId: EMPRESA_ID, nome: 'Teste Auditoria', email: 'audit@ts.com',
        papel: 'VENDEDOR', convidadoPor: ADMIN_ID, agora: AGORA,
      })
      await app.useCases.ativarUsuario.execute({ usuarioId, atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.alterarPapel.execute({ usuarioId, novoPapel: 'SUPERVISOR', atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.desativarUsuario.execute({ usuarioId, atorId: ADMIN_ID, agora: AGORA })
      const time = await app.useCases.criarTime.execute({ empresaId: EMPRESA_ID, nome: 'T1', atorId: ADMIN_ID, agora: AGORA })
      const filial = await app.useCases.criarFilial.execute({ empresaId: EMPRESA_ID, nome: 'F1', atorId: ADMIN_ID, agora: AGORA })

      const logs = await app.audit.findByEmpresa(EMPRESA_ID)
      const tipos = logs.map(l => l.tipo)

      expect(tipos).toContain('usuario.convidado')
      expect(tipos).toContain('usuario.ativado')
      expect(tipos).toContain('usuario.papel.alterado')
      expect(tipos).toContain('usuario.desativado')
      expect(tipos).toContain('time.criado')
      expect(tipos).toContain('filial.criada')
      expect(logs.length).toBeGreaterThanOrEqual(6)
    })

    it('auditoria registra atorId e alvoId corretamente', async () => {
      const { usuarioId } = await app.useCases.convidarUsuario.execute({
        empresaId: EMPRESA_ID, nome: 'Alvo', email: 'alvo@ts.com',
        papel: 'SDR', convidadoPor: ADMIN_ID, agora: AGORA,
      })
      const logs = await app.audit.findByEmpresa(EMPRESA_ID)
      const convite = logs.find(l => l.tipo === 'usuario.convidado')!
      expect(convite.atorId).toBe(ADMIN_ID)
      expect(convite.alvoId).toBe(usuarioId)
    })

    it('eventos CUE publicados correspondem às ações auditadas', async () => {
      await app.useCases.convidarUsuario.execute({ empresaId: EMPRESA_ID, nome: 'A', email: 'a@ts.com', papel: 'SDR', convidadoPor: ADMIN_ID, agora: AGORA })
      await app.useCases.criarTime.execute({ empresaId: EMPRESA_ID, nome: 'Time A', atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.criarFilial.execute({ empresaId: EMPRESA_ID, nome: 'Filial A', atorId: ADMIN_ID, agora: AGORA })

      expect(app.events.findByTipo('usuario.convidado')).toHaveLength(1)
      expect(app.events.findByTipo('time.criado')).toHaveLength(1)
      expect(app.events.findByTipo('filial.criada')).toHaveLength(1)
    })
  })

  // ─── Fluxo completo end-to-end ────────────────────────────────────────────────
  describe('Fluxo completo: empresa → filial → time → usuário → acesso → auditoria', () => {
    it('executa o critério de aceite completo da Sprint 3', async () => {
      // 1. Criar empresa (representada pelo admin)
      const admin = await app.useCases.convidarUsuario.execute({
        empresaId: EMPRESA_ID, nome: 'João CEO', email: 'ceo@ts.com',
        papel: 'ADMINISTRADOR', convidadoPor: 'sistema', agora: AGORA,
      })
      await app.useCases.ativarUsuario.execute({ usuarioId: admin.usuarioId, atorId: 'sistema', agora: AGORA })

      // 2. Criar filial
      const filialSP = await app.useCases.criarFilial.execute({
        empresaId: EMPRESA_ID, nome: 'Filial São Paulo', cidade: 'São Paulo', estado: 'SP',
        atorId: admin.usuarioId, agora: AGORA,
      })
      expect(filialSP.status).toBe('ATIVA')

      // 3. Criar equipe
      const timeVendas = await app.useCases.criarTime.execute({
        empresaId: EMPRESA_ID, nome: 'Time Vendas SP',
        atorId: admin.usuarioId, agora: AGORA,
      })
      await app.useCases.editarFilial.execute({
        filialId: filialSP.id, vincularEquipes: [timeVendas.id], atorId: admin.usuarioId, agora: AGORA,
      })

      // 4. Convidar usuários
      const vendedor = await app.useCases.convidarUsuario.execute({
        empresaId: EMPRESA_ID, nome: 'Ana Vendedora', email: 'ana@ts.com',
        papel: 'VENDEDOR', equipeId: timeVendas.id, filialId: filialSP.id,
        convidadoPor: admin.usuarioId, agora: AGORA,
      })
      const sdr = await app.useCases.convidarUsuario.execute({
        empresaId: EMPRESA_ID, nome: 'Bruno SDR', email: 'bruno@ts.com',
        papel: 'SDR', equipeId: timeVendas.id, filialId: filialSP.id,
        convidadoPor: admin.usuarioId, agora: AGORA,
      })

      // 5. Definir papéis (já definidos no convite; promover Bruno a AE)
      await app.useCases.ativarUsuario.execute({ usuarioId: vendedor.usuarioId, atorId: admin.usuarioId, agora: AGORA })
      await app.useCases.ativarUsuario.execute({ usuarioId: sdr.usuarioId, atorId: admin.usuarioId, agora: AGORA })
      await app.useCases.alterarPapel.execute({ usuarioId: sdr.usuarioId, novoPapel: 'VENDEDOR', atorId: admin.usuarioId, agora: AGORA })

      // 6. Login verificado via status ATIVO
      const anaUser = await app.repos.usuarioRepo.findById(vendedor.usuarioId)
      expect(anaUser!.status).toBe('ATIVO')

      // 7. Restringir acesso
      const anaVePipeline = await app.useCases.verificarPermissao.execute({ usuarioId: vendedor.usuarioId, permissao: 'pipeline:ler' })
      const anaNaoCriaFilial = await app.useCases.verificarPermissao.execute({ usuarioId: vendedor.usuarioId, permissao: 'filiais:criar' })
      expect(anaVePipeline.permitido).toBe(true)
      expect(anaNaoCriaFilial.permitido).toBe(false)

      // 8. Auditoria completa
      const logs = await app.audit.findByEmpresa(EMPRESA_ID)
      const tiposAuditados = new Set(logs.map(l => l.tipo))
      expect(tiposAuditados.has('usuario.convidado')).toBe(true)
      expect(tiposAuditados.has('usuario.ativado')).toBe(true)
      expect(tiposAuditados.has('usuario.papel.alterado')).toBe(true)
      expect(tiposAuditados.has('time.criado')).toBe(true)
      expect(tiposAuditados.has('filial.criada')).toBe(true)
      expect(logs.length).toBeGreaterThanOrEqual(8)
    })
  })
})
