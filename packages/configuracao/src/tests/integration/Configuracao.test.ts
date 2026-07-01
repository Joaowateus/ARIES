import { bootstrapConfiguracao } from '../../bootstrap'

const EMPRESA_ID = 'empresa-tech-solutions-001'
const ADMIN_ID   = 'usuario-admin-001'
const AGORA      = '2026-07-01T09:00:00.000Z'

describe('Sprint 4 — Configuração: empresa define como opera antes de iniciar vendas', () => {
  let app: ReturnType<typeof bootstrapConfiguracao>

  beforeEach(() => { app = bootstrapConfiguracao() })

  // ─── Critério 1: Produtos e serviços ─────────────────────────────────────────
  describe('1. Catálogo de Produtos e Serviços', () => {
    it('cria produto em status RASCUNHO com margem calculada', async () => {
      const produto = await app.useCases.criarProduto.execute({
        empresaId: EMPRESA_ID, nome: 'CRM Plus', tipo: 'SERVICO', categoria: 'Software',
        precoBase: 1000, custo: 200, margemMinima: 30,
        atorId: ADMIN_ID, agora: AGORA,
      })
      expect(produto.status).toBe('RASCUNHO')
      expect(produto.tipo).toBe('SERVICO')
    })

    it('margem calculada é (precoBase - custo) / precoBase * 100', async () => {
      const produto = await app.useCases.criarProduto.execute({
        empresaId: EMPRESA_ID, nome: 'Licença Anual', tipo: 'PRODUTO', categoria: 'Licença',
        precoBase: 1200, custo: 300, margemMinima: 40,
        atorId: ADMIN_ID, agora: AGORA,
      })
      const entity = await app.repos.produtoRepo.findById(produto.id)
      expect(entity!.margemAtual()).toBe(75) // (1200-300)/1200*100
    })

    it('rejeita produto com custo >= precoBase', async () => {
      await expect(app.useCases.criarProduto.execute({
        empresaId: EMPRESA_ID, nome: 'Inválido', tipo: 'PRODUTO', categoria: 'X',
        precoBase: 100, custo: 100, margemMinima: 10,
        atorId: ADMIN_ID, agora: AGORA,
      })).rejects.toThrow('custo deve ser menor')
    })

    it('ciclo completo: RASCUNHO → ATIVO → INATIVO → ATIVO → ARQUIVADO', async () => {
      const prod = await app.useCases.criarProduto.execute({
        empresaId: EMPRESA_ID, nome: 'Módulo BI', tipo: 'SERVICO', categoria: 'Analytics',
        precoBase: 500, custo: 100, margemMinima: 20, atorId: ADMIN_ID, agora: AGORA,
      })
      await app.useCases.alterarStatusProduto.execute({ produtoId: prod.id, acao: 'ATIVAR', atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.alterarStatusProduto.execute({ produtoId: prod.id, acao: 'DESATIVAR', atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.alterarStatusProduto.execute({ produtoId: prod.id, acao: 'ATIVAR', atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.alterarStatusProduto.execute({ produtoId: prod.id, acao: 'ARQUIVAR', atorId: ADMIN_ID, agora: AGORA })

      const final = await app.repos.produtoRepo.findById(prod.id)
      expect(final!.status).toBe('ARQUIVADO')
    })

    it('edita preço e nome do produto', async () => {
      const prod = await app.useCases.criarProduto.execute({
        empresaId: EMPRESA_ID, nome: 'Produto Antigo', tipo: 'PRODUTO', categoria: 'Cat',
        precoBase: 100, custo: 50, margemMinima: 20, atorId: ADMIN_ID, agora: AGORA,
      })
      await app.useCases.editarProduto.execute({ produtoId: prod.id, nome: 'Produto Novo', precoBase: 150, atorId: ADMIN_ID, agora: AGORA })
      const atualizado = await app.repos.produtoRepo.findById(prod.id)
      expect(atualizado!.toObject().nome).toBe('Produto Novo')
      expect(atualizado!.toObject().precoBase).toBe(150)
    })

    it('lista produtos filtrando por status', async () => {
      await app.useCases.criarProduto.execute({ empresaId: EMPRESA_ID, nome: 'A', tipo: 'PRODUTO', categoria: 'X', precoBase: 100, custo: 50, margemMinima: 10, atorId: ADMIN_ID, agora: AGORA })
      const b = await app.useCases.criarProduto.execute({ empresaId: EMPRESA_ID, nome: 'B', tipo: 'SERVICO', categoria: 'Y', precoBase: 200, custo: 80, margemMinima: 20, atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.alterarStatusProduto.execute({ produtoId: b.id, acao: 'ATIVAR', atorId: ADMIN_ID, agora: AGORA })

      const ativos = await app.repos.produtoRepo.findByEmpresa(EMPRESA_ID, { status: 'ATIVO' })
      const todos  = await app.repos.produtoRepo.findByEmpresa(EMPRESA_ID)
      expect(ativos).toHaveLength(1)
      expect(todos).toHaveLength(2)
    })
  })

  // ─── Critério 2: Política Comercial (reutiliza CAP-06) ───────────────────────
  describe('2. Política Comercial — reutilizando CAP-06', () => {
    it('configura política global com alçadas N1/N2/N3 e margem mínima', async () => {
      const policy = await app.useCases.configurarPolitica.execute({
        empresaId: EMPRESA_ID, nome: 'Política Padrão 2026',
        descontoMaxN1: 5, descontoMaxN2: 15, descontoMaxN3: 30,
        margemMinimaPercent: 20, criadoPor: ADMIN_ID, agora: AGORA,
      })
      expect(policy.status).toBe('ATIVA')
      expect(policy.descontoMaxN1).toBe(5)
      expect(policy.margemMinimaPercent).toBe(20)
    })

    it('rejeita N1 >= N2 (regra do CAP-06 preservada)', async () => {
      await expect(app.useCases.configurarPolitica.execute({
        empresaId: EMPRESA_ID, nome: 'Política Inválida',
        descontoMaxN1: 20, descontoMaxN2: 15, descontoMaxN3: 30,
        margemMinimaPercent: 10, criadoPor: ADMIN_ID, agora: AGORA,
      })).rejects.toThrow('descontoMaxN1 deve ser menor que descontoMaxN2')
    })

    it('nova política para mesmo segmento inativa a anterior', async () => {
      const segmento = await app.useCases.segmento.criar({ empresaId: EMPRESA_ID, nome: 'Premium', atorId: ADMIN_ID, agora: AGORA })

      const p1 = await app.useCases.configurarPolitica.execute({
        empresaId: EMPRESA_ID, nome: 'Política Premium v1', segmentoId: segmento.id,
        descontoMaxN1: 5, descontoMaxN2: 10, descontoMaxN3: 20,
        margemMinimaPercent: 25, criadoPor: ADMIN_ID, agora: AGORA,
      })
      const p2 = await app.useCases.configurarPolitica.execute({
        empresaId: EMPRESA_ID, nome: 'Política Premium v2', segmentoId: segmento.id,
        descontoMaxN1: 7, descontoMaxN2: 12, descontoMaxN3: 25,
        margemMinimaPercent: 22, criadoPor: ADMIN_ID, agora: AGORA,
      })

      const anterior = await app.repos.policyRepo.findById(p1.id)
      expect(anterior!.status).toBe('INATIVA')
      expect(p2.status).toBe('ATIVA')
    })

    it('rejeita política com segmentoId de segmento inexistente', async () => {
      await expect(app.useCases.configurarPolitica.execute({
        empresaId: EMPRESA_ID, nome: 'Inválida', segmentoId: 'segmento-inexistente',
        descontoMaxN1: 5, descontoMaxN2: 10, descontoMaxN3: 20,
        margemMinimaPercent: 10, criadoPor: ADMIN_ID, agora: AGORA,
      })).rejects.toThrow('segmento')
    })

    it('alcadaNecessaria do CAP-06 funciona com política configurada', async () => {
      await app.useCases.configurarPolitica.execute({
        empresaId: EMPRESA_ID, nome: 'Política Base',
        descontoMaxN1: 5, descontoMaxN2: 15, descontoMaxN3: 30,
        margemMinimaPercent: 20, criadoPor: ADMIN_ID, agora: AGORA,
      })
      const policyAtiva = await app.repos.policyRepo.findAtiva()
      expect(policyAtiva!.alcadaNecessaria(3)).toBe('N1')
      expect(policyAtiva!.alcadaNecessaria(10)).toBe('N2')
      expect(policyAtiva!.alcadaNecessaria(20)).toBe('N3')
      expect(policyAtiva!.alcadaNecessaria(35)).toBe('N4')
    })
  })

  // ─── Critério 3: Metas em todos os níveis ────────────────────────────────────
  describe('3. Metas Comerciais — todos os níveis organizacionais', () => {
    it('cria metas para empresa, filial, equipe e vendedor no mesmo período', async () => {
      const metas = await Promise.all([
        app.useCases.criarMeta.execute({ empresaId: EMPRESA_ID, tipo: 'EMPRESA', alvoId: EMPRESA_ID, periodicidade: 'MENSAL', periodo: '2026-07', valorMeta: 500000, atorId: ADMIN_ID, agora: AGORA }),
        app.useCases.criarMeta.execute({ empresaId: EMPRESA_ID, tipo: 'FILIAL', alvoId: 'filial-sp-001', periodicidade: 'MENSAL', periodo: '2026-07', valorMeta: 200000, atorId: ADMIN_ID, agora: AGORA }),
        app.useCases.criarMeta.execute({ empresaId: EMPRESA_ID, tipo: 'EQUIPE', alvoId: 'equipe-vendas-001', periodicidade: 'MENSAL', periodo: '2026-07', valorMeta: 100000, atorId: ADMIN_ID, agora: AGORA }),
        app.useCases.criarMeta.execute({ empresaId: EMPRESA_ID, tipo: 'VENDEDOR', alvoId: 'ana-001', periodicidade: 'MENSAL', periodo: '2026-07', valorMeta: 30000, atorId: ADMIN_ID, agora: AGORA }),
      ])
      expect(metas.map(m => m.tipo)).toEqual(['EMPRESA', 'FILIAL', 'EQUIPE', 'VENDEDOR'])
      expect(metas.every(m => m.status === 'ATIVA')).toBe(true)
    })

    it('meta trimestral com período Q3', async () => {
      const meta = await app.useCases.criarMeta.execute({
        empresaId: EMPRESA_ID, tipo: 'EMPRESA', alvoId: EMPRESA_ID,
        periodicidade: 'TRIMESTRAL', periodo: '2026-Q3', valorMeta: 1500000,
        atorId: ADMIN_ID, agora: AGORA,
      })
      expect(meta.periodicidade).toBe('TRIMESTRAL')
      expect(meta.periodo).toBe('2026-Q3')
    })

    it('revisa meta com histórico de revisões', async () => {
      const meta = await app.useCases.criarMeta.execute({
        empresaId: EMPRESA_ID, tipo: 'VENDEDOR', alvoId: 'bruno-001',
        periodicidade: 'MENSAL', periodo: '2026-07', valorMeta: 20000,
        atorId: ADMIN_ID, agora: AGORA,
      })
      await app.useCases.revisarMeta.execute({ metaId: meta.id, novoValor: 25000, motivo: 'Prospecção nova conta Enterprise', atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.revisarMeta.execute({ metaId: meta.id, novoValor: 22000, motivo: 'Ajuste após análise de pipeline', atorId: ADMIN_ID, agora: AGORA })

      const metaBd = await app.repos.metaRepo.findById(meta.id)
      const obj = metaBd!.toObject()
      expect(obj.valorMeta).toBe(22000)
      expect(obj.status).toBe('REVISADA')
      expect(obj.historico).toHaveLength(2)
      expect(obj.historico[0].valorAnterior).toBe(20000)
      expect(obj.historico[1].valorAnterior).toBe(25000)
    })

    it('encerra meta — não pode revisar depois', async () => {
      const meta = await app.useCases.criarMeta.execute({
        empresaId: EMPRESA_ID, tipo: 'EMPRESA', alvoId: EMPRESA_ID,
        periodicidade: 'ANUAL', periodo: '2025', valorMeta: 3000000,
        atorId: ADMIN_ID, agora: AGORA,
      })
      await app.useCases.encerrarMeta.execute({ metaId: meta.id, atorId: ADMIN_ID, agora: AGORA })
      await expect(
        app.useCases.revisarMeta.execute({ metaId: meta.id, novoValor: 3500000, motivo: 'Tentativa pós-encerramento', atorId: ADMIN_ID, agora: AGORA })
      ).rejects.toThrow('encerrada')
    })

    it('rejeita meta com valorMeta <= 0', async () => {
      await expect(app.useCases.criarMeta.execute({
        empresaId: EMPRESA_ID, tipo: 'VENDEDOR', alvoId: 'x', periodicidade: 'MENSAL',
        periodo: '2026-07', valorMeta: 0, atorId: ADMIN_ID, agora: AGORA,
      })).rejects.toThrow('valorMeta deve ser positivo')
    })
  })

  // ─── Critério 4: Motivos de Perda sem hardcode ────────────────────────────────
  describe('4. Catálogo de Motivos de Perda — administrável sem código', () => {
    it('cadastra os 6 motivos padrão todos como ATIVO', async () => {
      const descricoes = ['Preço', 'Concorrência', 'Timing', 'Sem orçamento', 'Sem decisão', 'Não respondeu']
      for (const d of descricoes) {
        await app.useCases.motivoPerda.criar({ empresaId: EMPRESA_ID, descricao: d, atorId: ADMIN_ID, agora: AGORA })
      }
      const ativos = await app.useCases.motivoPerda.listarAtivos(EMPRESA_ID)
      expect(ativos).toHaveLength(6)
      expect(ativos.map(m => m.descricao)).toEqual(expect.arrayContaining(descricoes))
    })

    it('edita descrição de um motivo', async () => {
      const motivo = await app.useCases.motivoPerda.criar({ empresaId: EMPRESA_ID, descricao: 'Desconto insuficiente', atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.motivoPerda.editar({ motivoId: motivo.id, descricao: 'Preço acima do mercado', atorId: ADMIN_ID, agora: AGORA })
      const atualizado = await app.repos.motivoRepo.findById(motivo.id)
      expect(atualizado!.descricao).toBe('Preço acima do mercado')
    })

    it('desativa e reativa motivo de perda', async () => {
      const motivo = await app.useCases.motivoPerda.criar({ empresaId: EMPRESA_ID, descricao: 'Timing', atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.motivoPerda.desativar({ motivoId: motivo.id, atorId: ADMIN_ID, agora: AGORA })
      const inativos = await app.repos.motivoRepo.findByEmpresa(EMPRESA_ID)
      expect(inativos.find(m => m.id === motivo.id)!.status).toBe('INATIVO')

      await app.useCases.motivoPerda.ativar({ motivoId: motivo.id, atorId: ADMIN_ID, agora: AGORA })
      const ativos = await app.useCases.motivoPerda.listarAtivos(EMPRESA_ID)
      expect(ativos.find(m => m.id === motivo.id)).toBeDefined()
    })
  })

  // ─── Critério 5: Segmentos Comerciais ────────────────────────────────────────
  describe('5. Segmentos Comerciais — reutilizáveis pelos CAPs', () => {
    it('cria 5 segmentos padrão todos como ATIVO', async () => {
      const nomes = ['Pessoa Física', 'Pessoa Jurídica', 'Varejo', 'Atacado', 'Premium']
      for (const nome of nomes) {
        await app.useCases.segmento.criar({ empresaId: EMPRESA_ID, nome, atorId: ADMIN_ID, agora: AGORA })
      }
      const ativos = await app.useCases.segmento.listar(EMPRESA_ID, true)
      expect(ativos).toHaveLength(5)
    })

    it('edita nome e descrição de segmento', async () => {
      const seg = await app.useCases.segmento.criar({ empresaId: EMPRESA_ID, nome: 'Corporate', atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.segmento.editar({ segmentoId: seg.id, nome: 'Enterprise', descricao: 'Clientes com >500 funcionários', atorId: ADMIN_ID, agora: AGORA })
      const atualizado = await app.repos.segmentoRepo.findById(seg.id)
      expect(atualizado!.nome).toBe('Enterprise')
      expect(atualizado!.toObject().descricao).toBe('Clientes com >500 funcionários')
    })

    it('desativa segmento e impede uso em nova política', async () => {
      const seg = await app.useCases.segmento.criar({ empresaId: EMPRESA_ID, nome: 'Obsoleto', atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.segmento.desativar({ segmentoId: seg.id, atorId: ADMIN_ID, agora: AGORA })

      await expect(app.useCases.configurarPolitica.execute({
        empresaId: EMPRESA_ID, nome: 'Política Obsoleta', segmentoId: seg.id,
        descontoMaxN1: 5, descontoMaxN2: 10, descontoMaxN3: 20,
        margemMinimaPercent: 15, criadoPor: ADMIN_ID, agora: AGORA,
      })).rejects.toThrow('segmento inativo')
    })

    it('segmento sem descrição é válido', async () => {
      const seg = await app.useCases.segmento.criar({ empresaId: EMPRESA_ID, nome: 'SMB', atorId: ADMIN_ID, agora: AGORA })
      expect(seg.status).toBe('ATIVO')
      expect(seg.descricao).toBeUndefined()
    })
  })

  // ─── Critério 6 & 7: Persistência e auditoria ────────────────────────────────
  describe('6 & 7. Persistência e auditoria de todas as configurações', () => {
    it('todas as ações geram registro de auditoria', async () => {
      const prod = await app.useCases.criarProduto.execute({ empresaId: EMPRESA_ID, nome: 'P1', tipo: 'PRODUTO', categoria: 'C', precoBase: 100, custo: 40, margemMinima: 20, atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.alterarStatusProduto.execute({ produtoId: prod.id, acao: 'ATIVAR', atorId: ADMIN_ID, agora: AGORA })
      const meta = await app.useCases.criarMeta.execute({ empresaId: EMPRESA_ID, tipo: 'VENDEDOR', alvoId: 'v1', periodicidade: 'MENSAL', periodo: '2026-07', valorMeta: 10000, atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.revisarMeta.execute({ metaId: meta.id, novoValor: 12000, motivo: 'Revisão Q3', atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.motivoPerda.criar({ empresaId: EMPRESA_ID, descricao: 'Preço', atorId: ADMIN_ID, agora: AGORA })
      const seg = await app.useCases.segmento.criar({ empresaId: EMPRESA_ID, nome: 'SMB', atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.configurarPolitica.execute({ empresaId: EMPRESA_ID, nome: 'Base', descontoMaxN1: 5, descontoMaxN2: 10, descontoMaxN3: 25, margemMinimaPercent: 20, criadoPor: ADMIN_ID, agora: AGORA })

      const logs = await app.audit.findByEmpresa(EMPRESA_ID)
      const tipos = logs.map(l => l.tipo)
      expect(tipos).toContain('produto.criado')
      expect(tipos).toContain('produto.ativar')
      expect(tipos).toContain('meta.criada')
      expect(tipos).toContain('meta.revisada')
      expect(tipos).toContain('motivo_perda.criado')
      expect(tipos).toContain('segmento.criado')
      expect(tipos).toContain('politica_comercial.configurada')
    })

    it('todos os eventos CUE são publicados', async () => {
      await app.useCases.criarProduto.execute({ empresaId: EMPRESA_ID, nome: 'P2', tipo: 'SERVICO', categoria: 'S', precoBase: 200, custo: 80, margemMinima: 10, atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.criarMeta.execute({ empresaId: EMPRESA_ID, tipo: 'EMPRESA', alvoId: EMPRESA_ID, periodicidade: 'ANUAL', periodo: '2026', valorMeta: 2000000, atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.motivoPerda.criar({ empresaId: EMPRESA_ID, descricao: 'Concorrência', atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.segmento.criar({ empresaId: EMPRESA_ID, nome: 'Varejo', atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.configurarPolitica.execute({ empresaId: EMPRESA_ID, nome: 'Geral', descontoMaxN1: 3, descontoMaxN2: 8, descontoMaxN3: 20, margemMinimaPercent: 15, criadoPor: ADMIN_ID, agora: AGORA })

      expect(app.events.findByTipo('produto.criado')).toHaveLength(1)
      expect(app.events.findByTipo('meta.criada')).toHaveLength(1)
      expect(app.events.findByTipo('motivo_perda.criado')).toHaveLength(1)
      expect(app.events.findByTipo('segmento.criado')).toHaveLength(1)
      expect(app.events.findByTipo('politica_comercial.configurada')).toHaveLength(1)
    })
  })

  // ─── Critério 8: CAPs existentes sem regressão ───────────────────────────────
  describe('8. CAPs existentes consomem configuração sem duplicar lógica', () => {
    it('CommercialPolicy do CAP-06 aplica alçadas sem re-implementação em configuracao', async () => {
      const policy = await app.useCases.configurarPolitica.execute({
        empresaId: EMPRESA_ID, nome: 'Política Integração',
        descontoMaxN1: 5, descontoMaxN2: 15, descontoMaxN3: 30,
        margemMinimaPercent: 20, criadoPor: ADMIN_ID, agora: AGORA,
      })
      // alcadaNecessaria é lógica do CAP-06, não do configuracao
      const policyEntity = await app.repos.policyRepo.findById(policy.id)
      expect(policyEntity!.alcadaNecessaria(4)).toBe('N1')
      expect(policyEntity!.alcadaNecessaria(14)).toBe('N2')
      expect(policyEntity!.alcadaNecessaria(29)).toBe('N3')
      expect(policyEntity!.alcadaNecessaria(31)).toBe('N4')
    })

    it('segmento criado em configuracao pode ser referenciado por CommercialPolicy', async () => {
      const segmento = await app.useCases.segmento.criar({ empresaId: EMPRESA_ID, nome: 'Enterprise', descricao: 'Grandes contas', atorId: ADMIN_ID, agora: AGORA })
      const policy = await app.useCases.configurarPolitica.execute({
        empresaId: EMPRESA_ID, nome: 'Política Enterprise', segmentoId: segmento.id,
        descontoMaxN1: 10, descontoMaxN2: 20, descontoMaxN3: 35,
        margemMinimaPercent: 15, criadoPor: ADMIN_ID, agora: AGORA,
      })
      expect(policy.segmentoId).toBe(segmento.id)
      const policyAtiva = await app.repos.policyRepo.findAtiva(segmento.id)
      expect(policyAtiva!.id).toBe(policy.id)
    })
  })

  // ─── Fluxo completo ─────────────────────────────────────────────────────────
  describe('Fluxo completo: admin configura empresa antes de iniciar operação', () => {
    it('executa todos os critérios de aceite em sequência', async () => {
      // 1. Cadastrar produtos
      const crm = await app.useCases.criarProduto.execute({ empresaId: EMPRESA_ID, nome: 'CRM Enterprise', tipo: 'SERVICO', categoria: 'Software', precoBase: 2000, custo: 400, margemMinima: 30, atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.alterarStatusProduto.execute({ produtoId: crm.id, acao: 'ATIVAR', atorId: ADMIN_ID, agora: AGORA })
      expect((await app.repos.produtoRepo.findById(crm.id))!.status).toBe('ATIVO')

      // 2. Definir segmentos e política comercial
      const segSMB = await app.useCases.segmento.criar({ empresaId: EMPRESA_ID, nome: 'SMB', atorId: ADMIN_ID, agora: AGORA })
      const segEnt = await app.useCases.segmento.criar({ empresaId: EMPRESA_ID, nome: 'Enterprise', atorId: ADMIN_ID, agora: AGORA })
      const politicaSMB = await app.useCases.configurarPolitica.execute({ empresaId: EMPRESA_ID, nome: 'Política SMB', segmentoId: segSMB.id, descontoMaxN1: 5, descontoMaxN2: 10, descontoMaxN3: 20, margemMinimaPercent: 25, criadoPor: ADMIN_ID, agora: AGORA })
      const politicaEnt = await app.useCases.configurarPolitica.execute({ empresaId: EMPRESA_ID, nome: 'Política Enterprise', segmentoId: segEnt.id, descontoMaxN1: 10, descontoMaxN2: 20, descontoMaxN3: 35, margemMinimaPercent: 15, criadoPor: ADMIN_ID, agora: AGORA })
      expect(politicaSMB.status).toBe('ATIVA')
      expect(politicaEnt.status).toBe('ATIVA')

      // 3. Configurar metas
      await app.useCases.criarMeta.execute({ empresaId: EMPRESA_ID, tipo: 'EMPRESA', alvoId: EMPRESA_ID, periodicidade: 'MENSAL', periodo: '2026-07', valorMeta: 500000, atorId: ADMIN_ID, agora: AGORA })
      await app.useCases.criarMeta.execute({ empresaId: EMPRESA_ID, tipo: 'VENDEDOR', alvoId: 'ana-001', periodicidade: 'MENSAL', periodo: '2026-07', valorMeta: 30000, atorId: ADMIN_ID, agora: AGORA })

      // 4. Motivos de perda sem hardcode
      for (const d of ['Preço', 'Concorrência', 'Timing', 'Sem orçamento', 'Sem decisão', 'Não respondeu']) {
        await app.useCases.motivoPerda.criar({ empresaId: EMPRESA_ID, descricao: d, atorId: ADMIN_ID, agora: AGORA })
      }
      expect(await app.useCases.motivoPerda.listarAtivos(EMPRESA_ID)).toHaveLength(6)

      // 5. Tudo auditado
      const logs = await app.audit.findByEmpresa(EMPRESA_ID)
      expect(logs.length).toBeGreaterThanOrEqual(12)
      const tiposUnicos = new Set(logs.map(l => l.tipo))
      expect(tiposUnicos.size).toBeGreaterThanOrEqual(5)
    })
  })
})
