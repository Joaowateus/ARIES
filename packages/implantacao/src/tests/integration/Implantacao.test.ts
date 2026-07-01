/**
 * Teste de integração: Sprint 1 — Implantação completa de uma empresa.
 *
 * Simula o fluxo exato que um cliente percorre ao contratar o Commercial OS:
 * 1. Cria empresa + admin via wizard
 * 2. Admin faz primeiro login
 * 3. Admin convida equipe (gerente, 2 vendedores, 1 SDR)
 * 4. Cada membro faz login
 * 5. Admin conclui configuração inicial → empresa ATIVA
 *
 * North Star: ao término deste fluxo, a empresa está operacional.
 */

import { bootstrapImplantacao } from '../../bootstrap'
import {
  EmpresaCriadaPayload,
  UsuarioConvidadoPayload,
  LoginRealizadoPayload,
  EmpresaAtivadaPayload,
} from '../../infrastructure/events/implantacao-events'

describe('Sprint 1 — Implantação: empresa vai de zero a operacional', () => {
  const { useCases, repos } = bootstrapImplantacao()
  const agora = '2024-06-01T09:00:00Z'

  let empresaId: string
  let adminId: string
  let adminToken: string
  let gerenteId: string
  let vendedor1Id: string

  describe('Passo 1: Wizard de criação de empresa', () => {
    it('cria empresa Tech Ltda com admin João', async () => {
      const result = await useCases.criarEmpresaWizard.execute({
        empresa: {
          nome: 'Tech Solutions Ltda',
          cnpj: '12.345.678/0001-90',
          segmento: 'SaaS B2B',
          porte: 'ME',
        },
        admin: {
          nome: 'João Costa',
          email: 'joao@techsolutions.com',
          senha: 'Admin@2024!',
        },
        agora,
      })

      expect(result.jaExistia).toBe(false)
      expect(result.empresa.status).toBe('CONFIGURANDO')
      expect(result.empresa.cnpj).toBe('12345678000190')
      expect(result.adminUsuario.papel).toBe('ADMIN')
      expect(result.adminUsuario.status).toBe('PENDENTE_PRIMEIRO_ACESSO')
      expect((result.adminUsuario as any).senhaHash).toBeUndefined()  // senha nunca exposta

      // Valida schema CUE
      const cue: EmpresaCriadaPayload = {
        empresaId: result.empresa.id,
        nome: result.empresa.nome,
        cnpj: result.empresa.cnpj,
        segmento: result.empresa.segmento,
        porte: result.empresa.porte,
        adminId: result.adminUsuario.id,
        adminEmail: result.adminUsuario.email,
        criadaEm: result.empresa.criadaEm,
      }
      expect(() => EmpresaCriadaPayload.parse(cue)).not.toThrow()

      empresaId = result.empresa.id
      adminId = result.adminUsuario.id
    })

    it('idempotente: wizard com mesmo CNPJ retorna empresa existente', async () => {
      const result = await useCases.criarEmpresaWizard.execute({
        empresa: {
          nome: 'Tech Solutions Duplicada',
          cnpj: '12.345.678/0001-90',
          segmento: 'SaaS',
          porte: 'EPP',
        },
        admin: { nome: 'Outro Admin', email: 'outro@empresa.com', senha: '12345' },
        agora,
      })
      expect(result.jaExistia).toBe(true)
      expect(result.empresa.id).toBe(empresaId)
    })

    it('rejeita CNPJ inválido', async () => {
      await expect(useCases.criarEmpresaWizard.execute({
        empresa: { nome: 'X', cnpj: '123', segmento: 'Tech', porte: 'ME' },
        admin: { nome: 'X', email: 'x@x.com', senha: '12345' },
        agora,
      })).rejects.toThrow('14 dígitos')
    })
  })

  describe('Passo 2: Primeiro login do administrador', () => {
    it('admin faz login com as credenciais criadas no wizard', async () => {
      const result = await useCases.autenticar.execute({
        email: 'joao@techsolutions.com',
        senha: 'Admin@2024!',
        agora,
      })

      expect(result.sessao.papel).toBe('ADMIN')
      expect(result.sessao.empresaId).toBe(empresaId)
      expect(result.nomeUsuario).toBe('João Costa')
      expect(result.sessao.token).toBeTruthy()

      // Sessão deve expirar no futuro
      expect(new Date(result.sessao.expiradaEm) > new Date(agora)).toBe(true)

      // Valida schema CUE
      const cue: LoginRealizadoPayload = {
        sessaoToken: result.sessao.token,
        usuarioId: result.sessao.usuarioId,
        empresaId: result.sessao.empresaId,
        papel: result.sessao.papel as any,
        realizadoEm: agora,
      }
      expect(() => LoginRealizadoPayload.parse(cue)).not.toThrow()

      adminToken = result.sessao.token
    })

    it('sessão gerada está válida', async () => {
      const sessao = await repos.sessaoRepo.findByToken(adminToken)
      expect(sessao).not.toBeNull()
      expect(sessao!.estaValida(agora)).toBe(true)
    })

    it('rejeita senha incorreta', async () => {
      await expect(useCases.autenticar.execute({
        email: 'joao@techsolutions.com',
        senha: 'SenhaErrada',
        agora,
      })).rejects.toThrow('Credenciais inválidas')
    })

    it('rejeita email inexistente', async () => {
      await expect(useCases.autenticar.execute({
        email: 'naoexiste@empresa.com',
        senha: 'qualquer',
        agora,
      })).rejects.toThrow('Credenciais inválidas')
    })
  })

  describe('Passo 3: Admin convida a equipe', () => {
    it('convida gerente comercial', async () => {
      const result = await useCases.convidarUsuario.execute({
        empresaId,
        convidadoPorId: adminId,
        nome: 'Maria Oliveira',
        email: 'maria@techsolutions.com',
        papel: 'GERENTE',
        senhaTemporaria: 'Temp@123',
        agora,
      })

      expect(result.jaExistia).toBe(false)
      expect(result.usuario.papel).toBe('GERENTE')
      expect(result.usuario.status).toBe('PENDENTE_PRIMEIRO_ACESSO')
      expect(result.usuario.primeiroAcesso).toBe(true)

      const cue: UsuarioConvidadoPayload = {
        usuarioId: result.usuario.id,
        empresaId: result.usuario.empresaId,
        email: result.usuario.email,
        papel: result.usuario.papel,
        convidadoPorId: adminId,
        criadoEm: result.usuario.criadoEm,
      }
      expect(() => UsuarioConvidadoPayload.parse(cue)).not.toThrow()

      gerenteId = result.usuario.id
    })

    it('convida 2 vendedores e 1 SDR', async () => {
      const v1 = await useCases.convidarUsuario.execute({
        empresaId, convidadoPorId: adminId,
        nome: 'Carlos Vendas', email: 'carlos@techsolutions.com',
        papel: 'VENDEDOR', senhaTemporaria: 'Temp@123', agora,
      })
      const v2 = await useCases.convidarUsuario.execute({
        empresaId, convidadoPorId: adminId,
        nome: 'Ana Vendas', email: 'ana@techsolutions.com',
        papel: 'VENDEDOR', senhaTemporaria: 'Temp@123', agora,
      })
      const sdr = await useCases.convidarUsuario.execute({
        empresaId, convidadoPorId: adminId,
        nome: 'Bruno SDR', email: 'bruno@techsolutions.com',
        papel: 'SDR', senhaTemporaria: 'Temp@123', agora,
      })

      expect(v1.usuario.papel).toBe('VENDEDOR')
      expect(v2.usuario.papel).toBe('VENDEDOR')
      expect(sdr.usuario.papel).toBe('SDR')

      vendedor1Id = v1.usuario.id
    })

    it('idempotente: convidar mesmo email retorna usuário existente', async () => {
      const result = await useCases.convidarUsuario.execute({
        empresaId, convidadoPorId: adminId,
        nome: 'Carlos Duplicado', email: 'carlos@techsolutions.com',
        papel: 'GERENTE', senhaTemporaria: 'Outra@123', agora,
      })
      expect(result.jaExistia).toBe(true)
      expect(result.usuario.id).toBe(vendedor1Id)
    })
  })

  describe('Passo 4: Membros da equipe fazem login', () => {
    it('gerente faz login com senha temporária', async () => {
      const result = await useCases.autenticar.execute({
        email: 'maria@techsolutions.com',
        senha: 'Temp@123',
        agora,
      })
      expect(result.sessao.papel).toBe('GERENTE')
      expect(result.nomeUsuario).toBe('Maria Oliveira')
    })

    it('vendedor faz login', async () => {
      const result = await useCases.autenticar.execute({
        email: 'carlos@techsolutions.com',
        senha: 'Temp@123',
        agora,
      })
      expect(result.sessao.papel).toBe('VENDEDOR')
    })
  })

  describe('Passo 5: Admin conclui configuração e ativa empresa', () => {
    it('empresa tem 5 usuários (1 admin + 1 gerente + 2 vendedores + 1 SDR)', async () => {
      const usuarios = await repos.usuarioRepo.findByEmpresa(empresaId)
      expect(usuarios).toHaveLength(5)
    })

    it('conclui configuração inicial → empresa ATIVA', async () => {
      const result = await useCases.concluirConfiguracaoInicial.execute(empresaId, agora)

      expect(result.status).toBe('ATIVA')
      expect(result.totalUsuarios).toBe(5)

      const cue: EmpresaAtivadaPayload = {
        empresaId: result.empresaId,
        totalUsuarios: result.totalUsuarios,
        ativadaEm: agora,
      }
      expect(() => EmpresaAtivadaPayload.parse(cue)).not.toThrow()
    })

    it('empresa ATIVA não pode ser reconfigurada', async () => {
      await expect(useCases.concluirConfiguracaoInicial.execute(empresaId, agora))
        .rejects.toThrow('configuração já concluída')
    })
  })

  describe('North Star: empresa operacional ao término do sprint', () => {
    it('empresa está ATIVA com equipe completa e todos conseguem autenticar', async () => {
      const empresa = await repos.empresaRepo.findById(empresaId)
      expect(empresa!.status).toBe('ATIVA')
      expect(empresa!.configuracaoConcluida).toBe(true)

      const usuarios = await repos.usuarioRepo.findByEmpresa(empresaId)
      const papeis = usuarios.map(u => u.papel).sort()
      expect(papeis).toEqual(['ADMIN', 'GERENTE', 'SDR', 'VENDEDOR', 'VENDEDOR'])

      // Qualquer membro pode autenticar
      const login = await useCases.autenticar.execute({
        email: 'ana@techsolutions.com',
        senha: 'Temp@123',
        agora,
      })
      expect(login.sessao.token).toBeTruthy()
    })
  })
})
