import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'
import { signProLaboreToken } from '../lib/jwtProLabore'
import { requireProLaboreAuth, requireDono, requireDonoOuSupervisor } from '../middleware/authProLabore'
import {
  trocarOuRenovarTokenLongo,
  buscarContaInstagram,
  buscarMidiasRecentes,
  buscarInsightsMidia,
  buscarInsightsContaHoje,
} from '../lib/instagramGraph'
import { gerarPlanoDeCrescimento, MetasCrescimento, MetricasNegocio } from '../lib/planoCrescimento'

const router = Router()

const TETO_PRO_LABORE_PADRAO = 900

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const VENDEDOR_SELECT = { id: true, nome: true, ativo: true, email: true, papel: true, tetoComissaoPorVenda: true, metaMensal: true, criadoEm: true, atualizadoEm: true } as const

// Pró-labore é sempre do dono — sacado de qualquer venda da operação,
// independente de quem vendeu. O teto é um único valor por conta, exceto
// quando o lead que originou a venda está classificado como "R"
// (renegociação) — aí usa o teto reduzido da conta, também configurável.
async function resolverTetoProLabore(usuarioId: string, tipoNegociacao?: string | null): Promise<number> {
  const parametro = await prisma.parametroLiquidez.upsert({
    where: { usuarioId },
    update: {},
    create: { usuarioId, tetoProLaborePorVenda: TETO_PRO_LABORE_PADRAO },
  })
  if (tipoNegociacao === 'R') return parametro.tetoProLaboreRenegociacao
  return parametro.tetoProLaborePorVenda
}

// Comissão é o que se paga ao vendedor daquela venda — usa o teto
// individual do vendedor quando definido, senão cai pro padrão da conta.
// Cada vendedor pode ter uma comissão diferente; sem isso, o teto era um
// valor único compartilhado por toda a operação. Numa negociação "R"
// (renegociação), o teto reduzido da conta vale sempre, mesmo se o
// vendedor tiver um teto individual definido — é uma regra da negociação,
// não do vendedor.
async function resolverTetoComissao(usuarioId: string, vendedorId?: string | null, tipoNegociacao?: string | null): Promise<number> {
  const parametro = await prisma.parametroLiquidez.upsert({
    where: { usuarioId },
    update: {},
    create: { usuarioId, tetoComissaoPadrao: TETO_PRO_LABORE_PADRAO },
  })
  if (tipoNegociacao === 'R') return parametro.tetoComissaoRenegociacao
  if (vendedorId) {
    const vendedor = await prisma.vendedor.findUnique({ where: { id: vendedorId }, select: { tetoComissaoPorVenda: true } })
    if (vendedor?.tetoComissaoPorVenda != null) return vendedor.tetoComissaoPorVenda
  }
  return parametro.tetoComissaoPadrao
}

// Datas de venda/mês de referência são conceitos de calendário puro (sem
// horário nem fuso) — por isso todo o agrupamento por mês/ano usa os
// getters/construtores UTC, nunca os locais. `new Date(y, m, d)` e
// `.getMonth()` dependem do fuso do processo que roda o código; se o
// servidor não estiver exatamente em UTC, uma venda no primeiro dia do
// mês/ano pode cair no mês anterior ou sumir do total do ano. Usando UTC
// em ponta a ponta (criação, filtro e agrupamento), o resultado é sempre
// o mesmo não importa o fuso do processo.
function primeiroDiaDoMesUTC(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1))
}

function inicioDoAnoUTC(ano: number): Date {
  return new Date(Date.UTC(ano, 0, 1))
}

function fimDoAnoUTC(ano: number): Date {
  return new Date(Date.UTC(ano, 11, 31, 23, 59, 59, 999))
}

// A conta ProLaboreUsuario (DONO) é o "tenant": toda tabela é particionada
// por usuarioId, inclusive as vendas/leads de vendedores com login próprio.
// Um vendedor autenticado usa o mesmo usuarioId do dono (pra reaproveitar
// todo o particionamento existente) mais o vendedorId, que restringe as
// consultas só aos próprios registros.
// `vendedorIdFiltro` é o filtro universal de dashboard (dono/supervisor
// inspecionando a produção de um vendedor específico) — só tem efeito pra
// quem já enxerga a equipe inteira; um VENDEDOR autenticado continua preso
// à própria produção independente do que vier nesse parâmetro.
function vendaWhereBase(req: Request, vendedorIdFiltro?: string): { usuarioId: string; vendedorId?: string } {
  const usuarioId = req.proLaboreUser!.sub
  if (req.proLaboreUser!.papel === 'VENDEDOR') {
    return { usuarioId, vendedorId: req.proLaboreUser!.vendedorId! }
  }
  if (vendedorIdFiltro) return { usuarioId, vendedorId: vendedorIdFiltro }
  return { usuarioId }
}

// --- Autenticação (usuário único/multiusuário, independente do login multi-tenant do ARIES) ---

router.get('/auth/status', async (_req: Request, res: Response) => {
  const total = await prisma.proLaboreUsuario.count()
  res.json({ existeUsuario: total > 0 })
})

const setupSchema = z.object({
  nome: z.string().min(2, 'Nome muito curto'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
})

router.post('/auth/setup', async (req: Request, res: Response) => {
  const parse = setupSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const jaExiste = await prisma.proLaboreUsuario.count()
  if (jaExiste > 0) {
    res.status(409).json({ error: 'Usuário já configurado. Faça login.' })
    return
  }

  const { nome, email, senha } = parse.data
  const senhaHash = await bcrypt.hash(senha, 10)

  const usuario = await prisma.proLaboreUsuario.create({
    data: {
      nome,
      email,
      senhaHash,
      parametro: { create: { tetoProLaborePorVenda: TETO_PRO_LABORE_PADRAO } },
    },
  })

  const token = signProLaboreToken({ sub: usuario.id, email: usuario.email, nome: usuario.nome, papel: 'DONO' })
  res.status(201).json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: 'DONO' } })
})

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(1, 'Senha obrigatória'),
})

// Login único pra dono e vendedor: primeiro tenta como dono da operação,
// depois como vendedor com acesso concedido. As duas contas nunca
// compartilham email (checado na concessão de acesso), então não há
// ambiguidade em qual delas autentica.
router.post('/auth/login', async (req: Request, res: Response) => {
  const parse = loginSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const { email, senha } = parse.data

  const usuario = await prisma.proLaboreUsuario.findUnique({ where: { email } })
  if (usuario && (await bcrypt.compare(senha, usuario.senhaHash))) {
    const token = signProLaboreToken({ sub: usuario.id, email: usuario.email, nome: usuario.nome, papel: 'DONO' })
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: 'DONO' } })
    return
  }

  const vendedor = await prisma.vendedor.findUnique({ where: { email } })
  if (vendedor?.senhaHash && vendedor.email && vendedor.ativo && (await bcrypt.compare(senha, vendedor.senhaHash))) {
    const papelVendedor = vendedor.papel === 'SUPERVISOR' ? 'SUPERVISOR' : 'VENDEDOR'
    const token = signProLaboreToken({
      sub: vendedor.usuarioId,
      email: vendedor.email,
      nome: vendedor.nome,
      papel: papelVendedor,
      vendedorId: vendedor.id,
    })
    res.json({ token, usuario: { id: vendedor.id, nome: vendedor.nome, email: vendedor.email, papel: papelVendedor, metaMensal: vendedor.metaMensal, tetoComissaoPorVenda: vendedor.tetoComissaoPorVenda } })
    return
  }

  res.status(401).json({ error: 'Email ou senha incorretos' })
})

router.get('/auth/me', requireProLaboreAuth, async (req: Request, res: Response) => {
  const { papel, vendedorId, sub } = req.proLaboreUser!

  if (papel === 'VENDEDOR' || papel === 'SUPERVISOR') {
    const vendedor = await prisma.vendedor.findUnique({
      where: { id: vendedorId },
      select: { id: true, nome: true, email: true, metaMensal: true, tetoComissaoPorVenda: true },
    })
    if (!vendedor || !vendedor.email) {
      res.status(404).json({ error: 'Vendedor não encontrado' })
      return
    }
    // Usa o papel do TOKEN, não uma busca nova no banco — é o token que
    // autoriza cada requisição, então se ele mostrasse um papel mais novo
    // que o que o resto das rotas está de fato aplicando, a pessoa veria a
    // tela de supervisor mas os dados viriam escopados como vendedor. Uma
    // promoção só entra em vigor no próximo login (novo token).
    res.json({ id: vendedor.id, nome: vendedor.nome, email: vendedor.email, papel, metaMensal: vendedor.metaMensal, tetoComissaoPorVenda: vendedor.tetoComissaoPorVenda })
    return
  }

  const usuario = await prisma.proLaboreUsuario.findUnique({
    where: { id: sub },
    select: { id: true, nome: true, email: true },
  })
  if (!usuario) {
    res.status(404).json({ error: 'Usuário não encontrado' })
    return
  }
  res.json({ ...usuario, papel: 'DONO' })
})

const recuperarSchema = z.object({
  codigo: z.string().min(1, 'Código de recuperação obrigatório'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  nome: z.string().min(2).optional(),
})

// Recuperação de acesso do dono — não precisa do email/senha antigos, só do
// código definido em PRO_LABORE_RECOVERY_SECRET (variável de ambiente do
// servidor, que só quem administra o deploy consegue ver/definir). Atualiza
// a conta existente em vez de recriar, então nenhum dado (vendas,
// vendedores etc.) é perdido.
router.post('/auth/recuperar', async (req: Request, res: Response) => {
  const segredo = process.env.PRO_LABORE_RECOVERY_SECRET
  if (!segredo) {
    res.status(503).json({ error: 'Recuperação não configurada neste servidor. Defina PRO_LABORE_RECOVERY_SECRET no ambiente e tente novamente.' })
    return
  }

  const parse = recuperarSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  if (parse.data.codigo !== segredo) {
    res.status(401).json({ error: 'Código de recuperação inválido' })
    return
  }

  const usuario = await prisma.proLaboreUsuario.findFirst()
  if (!usuario) {
    res.status(404).json({ error: 'Nenhuma conta encontrada. Use a tela de configuração inicial para criar uma.' })
    return
  }

  const senhaHash = await bcrypt.hash(parse.data.senha, 10)
  const atualizado = await prisma.proLaboreUsuario.update({
    where: { id: usuario.id },
    data: { email: parse.data.email, senhaHash, ...(parse.data.nome ? { nome: parse.data.nome } : {}) },
  })

  res.json({ ok: true, email: atualizado.email })
})

// --- Parâmetros de liquidez ---

router.get('/parametros', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parametro = await prisma.parametroLiquidez.upsert({
    where: { usuarioId: req.proLaboreUser!.sub },
    update: {},
    create: { usuarioId: req.proLaboreUser!.sub, tetoProLaborePorVenda: TETO_PRO_LABORE_PADRAO },
  })
  res.json(parametro)
})

const parametrosSchema = z.object({
  tetoProLaborePorVenda: z.number().positive('Teto deve ser positivo').optional(),
  tetoComissaoPadrao: z.number().positive('Teto deve ser positivo').optional(),
  tetoProLaboreRenegociacao: z.number().nonnegative('Teto deve ser positivo ou zero').optional(),
  tetoComissaoRenegociacao: z.number().nonnegative('Teto deve ser positivo ou zero').optional(),
  metaFaturamentoAnual: z.number().positive('Meta deve ser positiva').optional(),
  metaMensalPadrao: z.number().positive('Meta deve ser positiva').optional(),
  custoPorLeadTopo: z.number().nonnegative('Custo deve ser positivo ou zero').optional(),
  fraseMotivacional: z.string().max(280, 'Frase muito longa').optional(),
  agendaLimiarBomPct: z.number().min(0).max(100).optional(),
  agendaLimiarAtencaoPct: z.number().min(0).max(100).optional(),
  agendaLimiarEfetividadeAltaPct: z.number().min(0).max(100).optional(),
  agendaLimiarOscilacaoPct: z.number().min(0).max(100).optional(),
  agendaAlertaAderenciaPct: z.number().min(0).max(100).optional(),
  agendaAlertaDiasConsecutivos: z.number().int().positive().optional(),
  agendaAlertaQuedaEfetividadePct: z.number().min(0).max(100).optional(),
  agendaReconhecimentoSemanas: z.number().int().positive().optional(),
  motivosOcorrenciaCsv: z.string().optional(),
  metaPostagensSemanais: z.number().int().positive('Meta deve ser positiva').optional(),
  planoRoasMinimo: z.number().nonnegative('Meta deve ser positiva ou zero').optional(),
  planoRoasSaudavel: z.number().nonnegative('Meta deve ser positiva ou zero').optional(),
  planoConversaoMinimaPct: z.number().min(0).max(100).optional(),
  planoConversaoConsolidadaPct: z.number().min(0).max(100).optional(),
  planoEngajamentoMinimoPct: z.number().min(0).max(100).optional(),
  planoLeadsOrganicosMinimo: z.number().int().nonnegative('Meta deve ser positiva ou zero').optional(),
  planoConcentracaoMaximaLiderPct: z.number().min(0).max(100).optional(),
})

router.put('/parametros', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = parametrosSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const parametro = await prisma.parametroLiquidez.upsert({
    where: { usuarioId: req.proLaboreUser!.sub },
    update: parse.data,
    create: { usuarioId: req.proLaboreUser!.sub, ...parse.data },
  })
  res.json(parametro)
})

// --- Metas por etapa da jornada de compra (mesmo conceito de MetaFunilEtapa
// do CRM principal: conversão mínima, perda máxima ou custo máximo, cada
// etapa com só um tipo ativo por vez) ---

const ETAPAS_FUNIL_PL = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA', 'FECHADO'] as const

router.get('/funil-metas', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const existentes = await prisma.metaFunilProLabore.findMany({ where: { usuarioId } })
  const porEtapa = new Map(existentes.map(m => [m.etapa, m]))

  const faltando = ETAPAS_FUNIL_PL.filter(etapa => !porEtapa.has(etapa))
  if (faltando.length) {
    await prisma.$transaction(
      faltando.map(etapa =>
        prisma.metaFunilProLabore.upsert({
          where: { usuarioId_etapa: { usuarioId, etapa } },
          update: {},
          create: { usuarioId, etapa },
        })
      )
    )
    res.json(await prisma.metaFunilProLabore.findMany({ where: { usuarioId } }))
    return
  }
  res.json(existentes)
})

const metaFunilProLaboreSchema = z.object({
  metaPct: z.number().min(0).max(1).optional(),
  metaCusto: z.number().nonnegative().optional(),
  tipoMeta: z.enum(['MINIMO', 'MAXIMO_PERDA', 'MAXIMO_CUSTO']).optional(),
})

router.put('/funil-metas/:etapa', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const etapa = String(req.params.etapa)
  if (!(ETAPAS_FUNIL_PL as readonly string[]).includes(etapa)) {
    res.status(400).json({ error: 'Etapa inválida' })
    return
  }
  const parse = metaFunilProLaboreSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const meta = await prisma.metaFunilProLabore.upsert({
    where: { usuarioId_etapa: { usuarioId, etapa } },
    update: parse.data,
    create: { usuarioId, etapa, ...parse.data },
  })
  res.json(meta)
})

// --- Vendedores (leitura: dono e supervisor; gestão: exclusiva do dono) ---

router.get('/vendedores', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const vendedores = await prisma.vendedor.findMany({
    where: { usuarioId: req.proLaboreUser!.sub },
    select: VENDEDOR_SELECT,
    orderBy: { nome: 'asc' },
  })
  res.json(vendedores)
})

const criarVendedorSchema = z.object({
  nome: z.string().min(2, 'Nome muito curto'),
})

router.post('/vendedores', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = criarVendedorSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const vendedor = await prisma.vendedor.create({
    data: { usuarioId: req.proLaboreUser!.sub, nome: parse.data.nome },
    select: VENDEDOR_SELECT,
  })
  res.status(201).json(vendedor)
})

const editarVendedorSchema = z.object({
  nome: z.string().min(2).optional(),
  ativo: z.boolean().optional(),
  papel: z.enum(['VENDEDOR', 'SUPERVISOR']).optional(),
  tetoComissaoPorVenda: z.number().positive('Teto deve ser positivo').nullable().optional(),
  metaMensal: z.number().positive('Meta deve ser positiva').nullable().optional(),
})

router.patch('/vendedores/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = editarVendedorSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.vendedor.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Vendedor não encontrado' })
    return
  }
  const vendedor = await prisma.vendedor.update({ where: { id: atual.id }, data: parse.data, select: VENDEDOR_SELECT })
  res.json(vendedor)
})

router.delete('/vendedores/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.vendedor.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Vendedor não encontrado' })
    return
  }
  await prisma.vendedor.delete({ where: { id: atual.id } })
  res.json({ ok: true })
})

const concederAcessoSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
})

// Concede login individual a um vendedor já cadastrado. O email precisa ser
// único entre a conta do dono e todos os vendedores — é ele que decide, no
// login, qual das duas contas está autenticando.
router.post('/vendedores/:id/acesso', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = concederAcessoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.vendedor.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Vendedor não encontrado' })
    return
  }

  const { email, senha } = parse.data
  const [emailDoDono, emailDeOutroVendedor] = await Promise.all([
    prisma.proLaboreUsuario.findUnique({ where: { email } }),
    prisma.vendedor.findFirst({ where: { email, NOT: { id: atual.id } } }),
  ])
  if (emailDoDono || emailDeOutroVendedor) {
    res.status(409).json({ error: 'Este email já está em uso' })
    return
  }

  const senhaHash = await bcrypt.hash(senha, 10)
  const vendedor = await prisma.vendedor.update({
    where: { id: atual.id },
    data: { email, senhaHash },
    select: VENDEDOR_SELECT,
  })
  res.json(vendedor)
})

router.delete('/vendedores/:id/acesso', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.vendedor.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Vendedor não encontrado' })
    return
  }
  const vendedor = await prisma.vendedor.update({
    where: { id: atual.id },
    data: { email: null, senhaHash: null },
    select: VENDEDOR_SELECT,
  })
  res.json(vendedor)
})

// --- Vendas (cadastro exclusivo do dono — vendedor não registra a própria venda) ---

router.get('/vendas', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const { ano } = req.query
  const where: { usuarioId: string; data?: { gte: Date; lte: Date } } = { usuarioId: req.proLaboreUser!.sub }
  if (typeof ano === 'string' && /^\d{4}$/.test(ano)) {
    where.data = { gte: inicioDoAnoUTC(Number(ano)), lte: fimDoAnoUTC(Number(ano)) }
  }

  const vendas = await prisma.venda.findMany({
    where,
    include: { vendedor: { select: { id: true, nome: true } } },
    orderBy: { data: 'desc' },
  })
  res.json(vendas)
})

const criarVendaSchema = z.object({
  data: z.string().min(1, 'Data obrigatória'),
  valorVenda: z.number().positive('Valor da venda deve ser positivo'),
  valorProLabore: z.number().positive('Valor de pró-labore deve ser positivo'),
  vendedorId: z.string().optional(),
  valorComissao: z.number().min(0, 'Comissão não pode ser negativa').optional(),
  observacao: z.string().optional(),
})

router.post('/vendas', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = criarVendaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const usuarioId = req.proLaboreUser!.sub
  const { valorVenda, valorProLabore, vendedorId } = parse.data
  const valorComissao = vendedorId ? parse.data.valorComissao ?? 0 : undefined

  if (vendedorId) {
    const vendedor = await prisma.vendedor.findFirst({ where: { id: vendedorId, usuarioId } })
    if (!vendedor) {
      res.status(400).json({ error: 'Vendedor não encontrado' })
      return
    }
  }

  const tetoProLabore = await resolverTetoProLabore(usuarioId)
  if (valorProLabore > tetoProLabore) {
    res.status(400).json({ error: `O pró-labore não pode ultrapassar o teto configurado (${tetoProLabore})` })
    return
  }
  if (valorProLabore > valorVenda) {
    res.status(400).json({ error: 'O pró-labore não pode ser maior que o valor da venda' })
    return
  }

  if (valorComissao !== undefined) {
    const tetoComissao = await resolverTetoComissao(usuarioId, vendedorId)
    if (valorComissao > tetoComissao) {
      res.status(400).json({ error: `A comissão não pode ultrapassar o teto configurado (${tetoComissao})` })
      return
    }
    if (valorComissao > valorVenda) {
      res.status(400).json({ error: 'A comissão não pode ser maior que o valor da venda' })
      return
    }
  }

  const venda = await prisma.venda.create({
    data: {
      usuarioId,
      vendedorId,
      data: new Date(parse.data.data),
      valorVenda,
      valorProLabore,
      valorComissao,
      observacao: parse.data.observacao,
    },
    include: { vendedor: { select: { id: true, nome: true } } },
  })
  res.status(201).json(venda)
})

const editarVendaSchema = z.object({
  valorVenda: z.number().positive().optional(),
  valorProLabore: z.number().positive().optional(),
  vendedorId: z.string().nullable().optional(),
  valorComissao: z.number().min(0, 'Comissão não pode ser negativa').nullable().optional(),
  observacao: z.string().optional(),
})

router.patch('/vendas/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = editarVendaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.venda.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Venda não encontrada' })
    return
  }

  if (parse.data.vendedorId) {
    const vendedor = await prisma.vendedor.findFirst({ where: { id: parse.data.vendedorId, usuarioId } })
    if (!vendedor) {
      res.status(400).json({ error: 'Vendedor não encontrado' })
      return
    }
  }

  const valorVenda = parse.data.valorVenda ?? atual.valorVenda
  const valorProLabore = parse.data.valorProLabore ?? atual.valorProLabore
  const vendedorIdEfetivo = parse.data.vendedorId === undefined ? atual.vendedorId : parse.data.vendedorId
  const valorComissaoEfetivo = vendedorIdEfetivo == null
    ? undefined
    : parse.data.valorComissao === undefined ? atual.valorComissao ?? 0 : parse.data.valorComissao ?? 0

  const tetoProLabore = await resolverTetoProLabore(usuarioId)
  if (valorProLabore > tetoProLabore) {
    res.status(400).json({ error: `O pró-labore não pode ultrapassar o teto configurado (${tetoProLabore})` })
    return
  }
  if (valorProLabore > valorVenda) {
    res.status(400).json({ error: 'O pró-labore não pode ser maior que o valor da venda' })
    return
  }

  if (valorComissaoEfetivo !== undefined) {
    const tetoComissao = await resolverTetoComissao(usuarioId, vendedorIdEfetivo)
    if (valorComissaoEfetivo > tetoComissao) {
      res.status(400).json({ error: `A comissão não pode ultrapassar o teto configurado (${tetoComissao})` })
      return
    }
    if (valorComissaoEfetivo > valorVenda) {
      res.status(400).json({ error: 'A comissão não pode ser maior que o valor da venda' })
      return
    }
  }

  const venda = await prisma.venda.update({
    where: { id: atual.id },
    data: {
      valorVenda,
      valorProLabore,
      vendedorId: parse.data.vendedorId === undefined ? atual.vendedorId : parse.data.vendedorId,
      valorComissao: valorComissaoEfetivo ?? null,
      observacao: parse.data.observacao ?? atual.observacao,
    },
    include: { vendedor: { select: { id: true, nome: true } } },
  })
  res.json(venda)
})

router.delete('/vendas/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.venda.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Venda não encontrada' })
    return
  }
  await prisma.venda.delete({ where: { id: atual.id } })
  res.json({ ok: true })
})

// --- Leads / funil de vendas (esteira comercial) ---

const ESTAGIOS_LEAD = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA', 'FECHADO', 'PERDIDO'] as const
const ORDEM_ESTAGIO_LEAD = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA', 'FECHADO'] as const
const TIPOS_LEAD = ['TRAFEGO', 'ORGANICO'] as const
// P = pagamento integral (tetos normais da conta) | R = renegociação (tetos
// reduzidos, ver ParametroLiquidez.tetoProLaboreRenegociacao/tetoComissaoRenegociacao).
const TIPOS_NEGOCIACAO = ['P', 'R'] as const

function estagioAtingiu(estagioAtual: string, alvo: (typeof ORDEM_ESTAGIO_LEAD)[number]): boolean {
  if (estagioAtual === 'PERDIDO') return false
  return ORDEM_ESTAGIO_LEAD.indexOf(estagioAtual as (typeof ORDEM_ESTAGIO_LEAD)[number]) >= ORDEM_ESTAGIO_LEAD.indexOf(alvo)
}

const LEAD_INCLUDE = { vendedor: { select: { id: true, nome: true } } } as const

function leadWhereBase(req: Request, vendedorIdFiltro?: string): { usuarioId: string; vendedorId?: string } {
  const usuarioId = req.proLaboreUser!.sub
  if (req.proLaboreUser!.papel === 'VENDEDOR') {
    return { usuarioId, vendedorId: req.proLaboreUser!.vendedorId! }
  }
  if (vendedorIdFiltro) return { usuarioId, vendedorId: vendedorIdFiltro }
  return { usuarioId }
}

router.get('/leads', requireProLaboreAuth, async (req: Request, res: Response) => {
  const { estagio, tipoLead } = req.query
  const where: { usuarioId: string; vendedorId?: string; estagio?: string; tipoLead?: string } = leadWhereBase(req)
  if (typeof estagio === 'string' && (ESTAGIOS_LEAD as readonly string[]).includes(estagio)) {
    where.estagio = estagio
  }
  if (typeof tipoLead === 'string' && (TIPOS_LEAD as readonly string[]).includes(tipoLead)) {
    where.tipoLead = tipoLead
  }
  const leads = await prisma.lead.findMany({ where, include: LEAD_INCLUDE, orderBy: { criadoEm: 'desc' } })
  res.json(leads)
})

const criarLeadSchema = z.object({
  nomeCliente: z.string().min(2, 'Nome muito curto'),
  telefone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional(),
  cpf: z.string().optional(),
  endereco: z.string().optional(),
  modeloInteresse: z.string().optional(),
  observacao: z.string().optional(),
  vendedorId: z.string().optional(),
  tipoLead: z.enum(TIPOS_LEAD).optional(),
  tipoNegociacao: z.enum(TIPOS_NEGOCIACAO).optional(),
  valorNegociacao: z.number().positive('Valor da negociação deve ser maior que zero'),
})

router.post('/leads', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = criarLeadSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const usuarioId = req.proLaboreUser!.sub
  const papel = req.proLaboreUser!.papel
  let vendedorId = parse.data.vendedorId

  if (papel === 'VENDEDOR') {
    vendedorId = req.proLaboreUser!.vendedorId!
  } else if (vendedorId) {
    const vendedor = await prisma.vendedor.findFirst({ where: { id: vendedorId, usuarioId } })
    if (!vendedor) {
      res.status(400).json({ error: 'Vendedor não encontrado' })
      return
    }
  }

  const lead = await prisma.lead.create({
    data: {
      usuarioId,
      vendedorId,
      nomeCliente: parse.data.nomeCliente,
      telefone: parse.data.telefone,
      email: parse.data.email,
      cpf: parse.data.cpf,
      endereco: parse.data.endereco,
      modeloInteresse: parse.data.modeloInteresse,
      observacao: parse.data.observacao,
      tipoLead: parse.data.tipoLead,
      tipoNegociacao: parse.data.tipoNegociacao,
      valorNegociacao: parse.data.valorNegociacao,
    },
    include: LEAD_INCLUDE,
  })
  await prisma.leadEstagioHistorico.create({ data: { leadId: lead.id, estagioAnterior: null, estagioNovo: 'LEAD' } })
  res.status(201).json(lead)
})

const editarLeadSchema = z.object({
  nomeCliente: z.string().min(2).optional(),
  telefone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional(),
  cpf: z.string().optional(),
  endereco: z.string().optional(),
  modeloInteresse: z.string().optional(),
  observacao: z.string().optional(),
  vendedorId: z.string().nullable().optional(),
  tipoLead: z.enum(TIPOS_LEAD).nullable().optional(),
  tipoNegociacao: z.enum(TIPOS_NEGOCIACAO).nullable().optional(),
  valorNegociacao: z.number().positive('Valor da negociação deve ser maior que zero').optional(),
})

router.patch('/leads/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = editarLeadSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const usuarioId = req.proLaboreUser!.sub
  const papel = req.proLaboreUser!.papel
  const atual = await prisma.lead.findFirst({ where: { id: String(req.params.id), ...leadWhereBase(req) } })
  if (!atual) {
    res.status(404).json({ error: 'Lead não encontrado' })
    return
  }

  const data: {
    nomeCliente?: string; telefone?: string; email?: string; cpf?: string; endereco?: string
    modeloInteresse?: string; observacao?: string; vendedorId?: string | null; tipoLead?: string | null
    tipoNegociacao?: string | null; valorNegociacao?: number
  } = {
    nomeCliente: parse.data.nomeCliente,
    telefone: parse.data.telefone,
    email: parse.data.email,
    cpf: parse.data.cpf,
    endereco: parse.data.endereco,
    modeloInteresse: parse.data.modeloInteresse,
    observacao: parse.data.observacao,
    tipoLead: parse.data.tipoLead,
    tipoNegociacao: parse.data.tipoNegociacao,
    valorNegociacao: parse.data.valorNegociacao,
  }
  // Dono e supervisor podem reatribuir um lead a outro vendedor.
  if ((papel === 'DONO' || papel === 'SUPERVISOR') && parse.data.vendedorId !== undefined) {
    if (parse.data.vendedorId) {
      const vendedor = await prisma.vendedor.findFirst({ where: { id: parse.data.vendedorId, usuarioId } })
      if (!vendedor) {
        res.status(400).json({ error: 'Vendedor não encontrado' })
        return
      }
    }
    data.vendedorId = parse.data.vendedorId
  }

  const lead = await prisma.lead.update({ where: { id: atual.id }, data, include: LEAD_INCLUDE })
  res.json(lead)
})

const estagioLeadSchema = z.object({
  estagio: z.enum(ESTAGIOS_LEAD),
})

router.post('/leads/:id/estagio', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = estagioLeadSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const atual = await prisma.lead.findFirst({ where: { id: String(req.params.id), ...leadWhereBase(req) } })
  if (!atual) {
    res.status(404).json({ error: 'Lead não encontrado' })
    return
  }
  if (atual.estagio === parse.data.estagio) {
    res.json(atual)
    return
  }

  const fechadoEm = parse.data.estagio === 'FECHADO' || parse.data.estagio === 'PERDIDO' ? new Date() : null
  const lead = await prisma.lead.update({
    where: { id: atual.id },
    data: { estagio: parse.data.estagio, fechadoEm },
    include: LEAD_INCLUDE,
  })
  await prisma.leadEstagioHistorico.create({
    data: { leadId: atual.id, estagioAnterior: atual.estagio, estagioNovo: parse.data.estagio },
  })
  res.json(lead)
})

const converterLeadSchema = z.object({
  data: z.string().min(1, 'Data obrigatória'),
  valorVenda: z.number().positive('Valor da venda deve ser positivo'),
  valorProLabore: z.number().positive('Valor de pró-labore deve ser positivo'),
  valorComissao: z.number().min(0, 'Comissão não pode ser negativa').optional(),
  observacao: z.string().optional(),
})

// Fecha um lead gerando a venda correspondente — é a única forma "oficial"
// de fechamento, pra manter o vínculo lead→venda e não deixar o funil e as
// vendas divergirem. Marcar o estágio como FECHADO manualmente ainda é
// possível (ex: negócio fechado fora da esteira), só não cria a venda.
// Exclusivo do dono — é ele quem registra vendas e paga comissão.
router.post('/leads/:id/converter', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = converterLeadSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.lead.findFirst({ where: { id: String(req.params.id), ...leadWhereBase(req) } })
  if (!atual) {
    res.status(404).json({ error: 'Lead não encontrado' })
    return
  }
  if (atual.vendaId) {
    res.status(409).json({ error: 'Lead já convertido em venda' })
    return
  }

  const { valorVenda, valorProLabore } = parse.data
  const valorComissao = atual.vendedorId ? parse.data.valorComissao ?? 0 : undefined

  const tetoProLabore = await resolverTetoProLabore(usuarioId, atual.tipoNegociacao)
  if (valorProLabore > tetoProLabore) {
    res.status(400).json({ error: `O pró-labore não pode ultrapassar o teto configurado (${tetoProLabore})` })
    return
  }
  if (valorProLabore > valorVenda) {
    res.status(400).json({ error: 'O pró-labore não pode ser maior que o valor da venda' })
    return
  }

  if (valorComissao !== undefined) {
    const tetoComissao = await resolverTetoComissao(usuarioId, atual.vendedorId, atual.tipoNegociacao)
    if (valorComissao > tetoComissao) {
      res.status(400).json({ error: `A comissão não pode ultrapassar o teto configurado (${tetoComissao})` })
      return
    }
    if (valorComissao > valorVenda) {
      res.status(400).json({ error: 'A comissão não pode ser maior que o valor da venda' })
      return
    }
  }

  const venda = await prisma.venda.create({
    data: {
      usuarioId,
      vendedorId: atual.vendedorId,
      data: new Date(parse.data.data),
      valorVenda,
      valorProLabore,
      valorComissao,
      observacao: parse.data.observacao ?? `Convertido do lead: ${atual.nomeCliente}`,
    },
    include: { vendedor: { select: { id: true, nome: true } } },
  })

  const lead = await prisma.lead.update({
    where: { id: atual.id },
    data: { estagio: 'FECHADO', fechadoEm: new Date(), vendaId: venda.id },
    include: LEAD_INCLUDE,
  })
  await prisma.leadEstagioHistorico.create({
    data: { leadId: atual.id, estagioAnterior: atual.estagio, estagioNovo: 'FECHADO' },
  })

  res.status(201).json({ lead, venda })
})

router.delete('/leads/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const atual = await prisma.lead.findFirst({ where: { id: String(req.params.id), ...leadWhereBase(req) } })
  if (!atual) {
    res.status(404).json({ error: 'Lead não encontrado' })
    return
  }
  if (atual.vendaId) {
    res.status(409).json({ error: 'Lead já convertido em venda não pode ser excluído. Exclua a venda primeiro, se necessário.' })
    return
  }
  await prisma.leadEstagioHistorico.deleteMany({ where: { leadId: atual.id } })
  await prisma.lead.delete({ where: { id: atual.id } })
  res.json({ ok: true })
})

// --- Funil comercial mensal (cadastro manual, mantido pro histórico anterior aos Leads) ---

router.get('/funil', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const { ano } = req.query
  const usuarioId = req.proLaboreUser!.sub
  const anoNum = typeof ano === 'string' && /^\d{4}$/.test(ano) ? Number(ano) : new Date().getUTCFullYear()
  const registros = await prisma.funilMensal.findMany({
    where: { usuarioId, mesReferencia: { gte: inicioDoAnoUTC(anoNum), lte: fimDoAnoUTC(anoNum) } },
    orderBy: { mesReferencia: 'asc' },
  })
  res.json(registros)
})

const funilSchema = z.object({
  mesReferencia: z.string().min(1, 'Mês de referência obrigatório'),
  leads: z.number().int().min(0),
  abordados: z.number().int().min(0),
  negociacao: z.number().int().min(0),
  proposta: z.number().int().min(0),
})

router.put('/funil', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = funilSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const mesReferencia = primeiroDiaDoMesUTC(new Date(parse.data.mesReferencia))
  const { leads, abordados, negociacao, proposta } = parse.data

  const registro = await prisma.funilMensal.upsert({
    where: { usuarioId_mesReferencia: { usuarioId, mesReferencia } },
    update: { leads, abordados, negociacao, proposta },
    create: { usuarioId, mesReferencia, leads, abordados, negociacao, proposta },
  })
  res.json(registro)
})

// --- Gasto com anúncios mensal (cadastro manual, exclusivo do dono) ---

router.get('/gastos-anuncios', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const { ano } = req.query
  const usuarioId = req.proLaboreUser!.sub
  const anoNum = typeof ano === 'string' && /^\d{4}$/.test(ano) ? Number(ano) : new Date().getUTCFullYear()
  const registros = await prisma.gastoAnuncioMensal.findMany({
    where: { usuarioId, mesReferencia: { gte: inicioDoAnoUTC(anoNum), lte: fimDoAnoUTC(anoNum) } },
    orderBy: { mesReferencia: 'asc' },
  })
  res.json(registros)
})

const gastoAnuncioSchema = z.object({
  mesReferencia: z.string().min(1, 'Mês de referência obrigatório'),
  valor: z.number().min(0),
})

router.put('/gastos-anuncios', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = gastoAnuncioSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const mesReferencia = primeiroDiaDoMesUTC(new Date(parse.data.mesReferencia))
  const { valor } = parse.data

  const registro = await prisma.gastoAnuncioMensal.upsert({
    where: { usuarioId_mesReferencia: { usuarioId, mesReferencia } },
    update: { valor },
    create: { usuarioId, mesReferencia, valor },
  })
  res.json(registro)
})

// --- Painel: série mensal completa (KPIs, funil, ROAS, ranking de vendedores) ---

router.get('/painel', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const papel = req.proLaboreUser!.papel
  const agora = new Date()
  const { ano, vendedorId } = req.query
  const anoNum = typeof ano === 'string' && /^\d{4}$/.test(ano) ? Number(ano) : agora.getUTCFullYear()
  const ultimoMes = anoNum === agora.getUTCFullYear() ? agora.getUTCMonth() : 11

  const inicioAno = inicioDoAnoUTC(anoNum)
  const fimAno = fimDoAnoUTC(anoNum)

  // Gasto com anúncio e pró-labore são cifras pessoais do dono — nem
  // vendedor nem supervisor enxergam. Ranking por vendedor e funil manual
  // histórico já são visão de equipe: dono E supervisor veem, só o
  // vendedor comum fica restrito à própria produção (vendaWhereBase/
  // leadWhereBase já cuidam disso pra vendas e leads).
  const vejaEquipe = papel === 'DONO' || papel === 'SUPERVISOR'
  // Filtro universal (dono/supervisor inspecionando um vendedor específico
  // em todo o painel) — só existe pra quem já vê a equipe inteira; pra um
  // VENDEDOR autenticado, vendaWhereBase/leadWhereBase ignoram esse valor.
  const vendedorIdFiltro = vejaEquipe && typeof vendedorId === 'string' && vendedorId ? vendedorId : undefined

  const [vendasTodas, funilRegistros, gastosRegistros, vendedores, leadsTodos] = await Promise.all([
    prisma.venda.findMany({
      where: { ...vendaWhereBase(req), data: { gte: inicioAno, lte: fimAno } },
      include: { vendedor: { select: { id: true, nome: true } } },
    }),
    vejaEquipe
      ? prisma.funilMensal.findMany({ where: { usuarioId, mesReferencia: { gte: inicioAno, lte: fimAno } } })
      : Promise.resolve([]),
    papel === 'DONO'
      ? prisma.gastoAnuncioMensal.findMany({ where: { usuarioId, mesReferencia: { gte: inicioAno, lte: fimAno } } })
      : Promise.resolve([]),
    vejaEquipe ? prisma.vendedor.findMany({ where: { usuarioId } }) : Promise.resolve([]),
    prisma.lead.findMany({ where: { ...leadWhereBase(req), criadoEm: { gte: inicioAno, lte: fimAno } } }),
  ])

  // `vendasTodas`/`leadsTodos` já vêm restritos ao próprio vendedor quando
  // quem pede é um VENDEDOR (vendaWhereBase/leadWhereBase cuidam disso). O
  // filtro universal só entra aqui, recortando esse conjunto pros números
  // "principais" do mês — ranking, ROAS e CAC continuam usando o total da
  // equipe (`vendasTodas`) mesmo com o filtro ativo, porque gasto com
  // anúncios é da operação inteira, não dá pra atribuir a um vendedor só.
  const vendas = vendedorIdFiltro ? vendasTodas.filter(v => v.vendedorId === vendedorIdFiltro) : vendasTodas
  const leads = vendedorIdFiltro ? leadsTodos.filter(l => l.vendedorId === vendedorIdFiltro) : leadsTodos

  const vendedorPorId = new Map(vendedores.map(v => [v.id, v]))

  const meses = MESES_LABEL.slice(0, ultimoMes + 1).map((label, mes) => {
    const vendasDoMes = vendas.filter(v => v.data.getUTCMonth() === mes)
    const receita = vendasDoMes.reduce((s, v) => s + v.valorVenda, 0)
    // Pró-labore é sempre do dono — não faz sentido pra um vendedor ver o
    // quanto o dono sacou de cada venda, então some da resposta pra ele.
    const proLaboreSacado = papel === 'DONO' ? vendasDoMes.reduce((s, v) => s + v.valorProLabore, 0) : 0
    const comissaoPaga = vendasDoMes.reduce((s, v) => s + (v.valorComissao ?? 0), 0)
    const quantidadeVendas = vendasDoMes.length
    const ticketMedio = quantidadeVendas > 0 ? receita / quantidadeVendas : 0

    // ROAS/CAC usam sempre o total da equipe (vendasTodasDoMes), nunca o
    // recorte do filtro — ver comentário acima sobre `vendas`.
    const vendasTodasDoMes = vendasTodas.filter(v => v.data.getUTCMonth() === mes)
    const gastoRegistro = gastosRegistros.find(g => g.mesReferencia.getUTCMonth() === mes)
    const gastoAnuncios = papel === 'DONO' ? gastoRegistro?.valor ?? 0 : 0
    const roas = gastoAnuncios > 0 ? vendasTodasDoMes.reduce((s, v) => s + v.valorVenda, 0) / gastoAnuncios : 0
    const cac = gastoAnuncios > 0 && vendasTodasDoMes.length > 0 ? gastoAnuncios / vendasTodasDoMes.length : 0

    // Prefere o funil real (Leads) quando existe dado no mês; cai pro
    // cadastro manual (FunilMensal) só em meses anteriores à funcionalidade
    // de Leads, e só pro dono, sem filtro de vendedor ativo — o cadastro
    // manual não guarda o vendedor, então não dá pra atribuir a um só.
    const leadsDoMes = leads.filter(l => l.criadoEm.getUTCMonth() === mes)
    const funilRegistro = vendedorIdFiltro ? undefined : funilRegistros.find(f => f.mesReferencia.getUTCMonth() === mes)
    const funil =
      leadsDoMes.length > 0
        ? {
            leads: leadsDoMes.length,
            abordados: leadsDoMes.filter(l => estagioAtingiu(l.estagio, 'ABORDADO')).length,
            negociacao: leadsDoMes.filter(l => estagioAtingiu(l.estagio, 'NEGOCIACAO')).length,
            proposta: leadsDoMes.filter(l => estagioAtingiu(l.estagio, 'PROPOSTA')).length,
            fechamento: quantidadeVendas,
          }
        : {
            leads: funilRegistro?.leads ?? 0,
            abordados: funilRegistro?.abordados ?? 0,
            negociacao: funilRegistro?.negociacao ?? 0,
            proposta: funilRegistro?.proposta ?? 0,
            fechamento: quantidadeVendas,
          }
    const conversaoLeadVenda = funil.leads > 0 ? (quantidadeVendas / funil.leads) * 100 : 0

    // Ranking sempre da equipe inteira (vendasTodasDoMes) — comparar
    // vendedores é o próprio propósito do card, então o filtro universal
    // não o recorta, só destaca outras métricas do painel.
    const rankingVendedores: { id: string; nome: string; quantidadeVendas: number; receita: number; comissaoPaga: number }[] = []
    if (vejaEquipe) {
      const porVendedor = new Map<string, { id: string; nome: string; quantidadeVendas: number; receita: number; comissaoPaga: number }>()
      for (const v of vendasTodasDoMes) {
        if (!v.vendedorId) continue
        const nome = vendedorPorId.get(v.vendedorId)?.nome ?? v.vendedor?.nome ?? 'Sem nome'
        const atual = porVendedor.get(v.vendedorId) ?? { id: v.vendedorId, nome, quantidadeVendas: 0, receita: 0, comissaoPaga: 0 }
        atual.quantidadeVendas += 1
        atual.receita += v.valorVenda
        atual.comissaoPaga += v.valorComissao ?? 0
        porVendedor.set(v.vendedorId, atual)
      }
      rankingVendedores.push(...[...porVendedor.values()].sort((a, b) => b.receita - a.receita))
    }

    return {
      mes, label, ano: anoNum,
      receita, proLaboreSacado, comissaoPaga, quantidadeVendas, ticketMedio,
      gastoAnuncios, roas, cac,
      funil, conversaoLeadVenda,
      vendedores: rankingVendedores,
    }
  })

  res.json({ meses })
})

// --- Receita detalhada por período curto (hoje / 7·15·30 dias, ou personalizado) ---

const PERIODOS_RECEITA = ['hoje', '7'] as const
const MAX_DIAS_PERIODO_CUSTOM = 366

function inicioDoDiaUTC(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()))
}

// Fuso fixo (América/São Paulo, UTC-3, sem horário de verão desde 2019) só
// pra rotular a distribuição por hora de "hoje" — o app é de uma operação
// brasileira única e não guarda fuso configurável em nenhum outro lugar.
function horaBrasilia(data: Date): number {
  return (data.getUTCHours() + 21) % 24 // (UTCHours - 3 + 24) % 24
}

// Agrega vendas dia a dia entre [inicio, inicio + dias). Compartilhado pelos
// presets de dias (7/15/30) e pelo período personalizado (data início/fim),
// que só diferem em como "inicio"/"dias" são calculados.
async function agregarReceitaPorDia(req: Request, inicio: Date, dias: number, vendedorIdFiltro?: string) {
  const fim = new Date(inicio.getTime() + dias * 24 * 60 * 60 * 1000 - 1)
  const vendas = await prisma.venda.findMany({ where: { ...vendaWhereBase(req, vendedorIdFiltro), data: { gte: inicio, lte: fim } } })

  const porDia = new Map<string, { receita: number; proLabore: number; vendas: number }>()
  for (let i = 0; i < dias; i++) {
    const d = new Date(inicio.getTime() + i * 24 * 60 * 60 * 1000)
    porDia.set(d.toISOString().slice(0, 10), { receita: 0, proLabore: 0, vendas: 0 })
  }
  for (const v of vendas) {
    const chave = v.data.toISOString().slice(0, 10)
    const atual = porDia.get(chave)
    if (atual) {
      atual.receita += v.valorVenda
      atual.proLabore += v.valorProLabore
      atual.vendas += 1
    }
  }
  return {
    totalReceita: vendas.reduce((s, v) => s + v.valorVenda, 0),
    totalProLabore: vendas.reduce((s, v) => s + v.valorProLabore, 0),
    totalVendas: vendas.length,
    pontos: [...porDia.entries()].map(([iso, p]) => {
      const [, mes, dia] = iso.split('-')
      return { label: `${dia}/${mes}`, ...p }
    }),
  }
}

// Inclui valorProLabore por período — cifra pessoal do dono (sacada de
// qualquer venda) — então, diferente da maioria das rotas de leitura desse
// módulo, essa é requireDono estrito (vendedor/supervisor não acessam).
router.get('/receitas-periodo', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const { periodo, inicio, fim, vendedorId } = req.query
  // Rota exclusiva do dono (requireDono acima) — ele sempre "vê a equipe",
  // então o filtro universal (vendedor específico) vale sem checagem extra
  // de papel, igual ao /painel.
  const vendedorIdFiltro = typeof vendedorId === 'string' && vendedorId ? vendedorId : undefined

  // Período personalizado (data início/fim escolhidas no calendário) tem
  // prioridade sobre os presets — mesma granularidade diária deles, só que
  // com o intervalo escolhido em vez de fixo.
  if (typeof inicio === 'string' && typeof fim === 'string') {
    const inicioData = new Date(`${inicio}T00:00:00.000Z`)
    const fimData = new Date(`${fim}T00:00:00.000Z`)
    if (!Number.isNaN(inicioData.getTime()) && !Number.isNaN(fimData.getTime()) && fimData >= inicioData) {
      const dias = Math.min(MAX_DIAS_PERIODO_CUSTOM, Math.round((fimData.getTime() - inicioData.getTime()) / (24 * 60 * 60 * 1000)) + 1)
      res.json(await agregarReceitaPorDia(req, inicioData, dias, vendedorIdFiltro))
      return
    }
  }

  const periodoEfetivo: (typeof PERIODOS_RECEITA)[number] =
    (PERIODOS_RECEITA as readonly string[]).includes(String(periodo)) ? (periodo as (typeof PERIODOS_RECEITA)[number]) : 'hoje'

  const hojeInicio = inicioDoDiaUTC(new Date())
  const hojeFim = new Date(hojeInicio.getTime() + 24 * 60 * 60 * 1000 - 1)

  if (periodoEfetivo === 'hoje') {
    const vendas = await prisma.venda.findMany({ where: { ...vendaWhereBase(req, vendedorIdFiltro), data: { gte: hojeInicio, lte: hojeFim } } })
    // A venda só guarda a data (sem horário) — o detalhe por hora usa
    // quando ela foi CADASTRADA (criadoEm) como aproximação de quando foi
    // vendida, já que não existe outro campo com horário real.
    const porHora = Array.from({ length: 24 }, () => ({ receita: 0, proLabore: 0, vendas: 0 }))
    for (const v of vendas) {
      const h = horaBrasilia(v.criadoEm)
      porHora[h].receita += v.valorVenda
      porHora[h].proLabore += v.valorProLabore
      porHora[h].vendas += 1
    }
    res.json({
      totalReceita: vendas.reduce((s, v) => s + v.valorVenda, 0),
      totalProLabore: vendas.reduce((s, v) => s + v.valorProLabore, 0),
      totalVendas: vendas.length,
      pontos: porHora.map((p, h) => ({ label: `${String(h).padStart(2, '0')}h`, ...p })),
    })
    return
  }

  const dias = Number(periodoEfetivo)
  const inicioPreset = new Date(hojeInicio.getTime() - (dias - 1) * 24 * 60 * 60 * 1000)
  res.json(await agregarReceitaPorDia(req, inicioPreset, dias, vendedorIdFiltro))
})

// --- Agenda de trabalho (calendário, metas diárias, processos, auditorias, protocolos) ---
// Cadastrada pelo dono/supervisor pra toda a equipe seguir. Um item é único
// (uma data) ou recorrente (dias da semana, com início/fim opcionais) — a
// ocorrência de cada dia é resolvida no CLIENTE a partir dessas regras (a
// quantidade de itens é pequena, então não vale a pena materializar uma
// linha por dia no banco). O servidor só guarda as regras e as conclusões.

const AGENDA_CATEGORIAS = ['META', 'PROCESSO', 'AUDITORIA', 'PROTOCOLO', 'OUTRO', 'REUNIAO'] as const
const AGENDA_TIPOS = ['UNICO', 'RECORRENTE'] as const

// "Quem sou eu" pra fins de completude da agenda — supervisor e vendedor
// comum são ambos um registro de Vendedor (usam o vendedorId do token); o
// dono não tem Vendedor, então usa o próprio usuarioId como identificador.
function autorIdAtual(req: Request): string {
  return req.proLaboreUser!.vendedorId ?? req.proLaboreUser!.sub
}

function parseDataDiaUTC(valor: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const data = new Date(`${valor}T00:00:00.000Z`)
  return Number.isNaN(data.getTime()) ? null : data
}

const HORARIO_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

router.get('/agenda-itens', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const papel = req.proLaboreUser!.papel
  const vejaEquipe = papel === 'DONO' || papel === 'SUPERVISOR'

  const itens = await prisma.agendaItem.findMany({
    where: { usuarioId, ...(vejaEquipe ? {} : { ativo: true }) },
    orderBy: { criadoEm: 'desc' },
  })

  if (vejaEquipe) {
    res.json(itens)
    return
  }
  // Filtro de "é meu" feito em memória, não em SQL — vendedorIds é uma
  // lista em CSV, e um "contains" no banco arriscaria falso positivo por
  // substring entre ids parecidos. A lista de itens é pequena, então o
  // custo disso é irrelevante.
  const meuVendedorId = req.proLaboreUser!.vendedorId ?? null
  const meus = itens.filter(item => {
    const alvos = (item.vendedorIds ?? '').split(',').filter(Boolean)
    const temAlvo = alvos.length > 0 || item.incluiDono
    return !temAlvo || (meuVendedorId != null && alvos.includes(meuVendedorId))
  })
  res.json(meus)
})

const agendaItemSchema = z
  .object({
    titulo: z.string().min(2, 'Título muito curto'),
    descricao: z.string().max(2000).optional(),
    categoria: z.enum(AGENDA_CATEGORIAS),
    tipo: z.enum(AGENDA_TIPOS),
    data: z.string().optional(),
    diasSemana: z.array(z.number().int().min(0).max(6)).optional(),
    dataInicio: z.string().optional(),
    dataFim: z.string().optional(),
    horario: z.string().regex(HORARIO_REGEX, 'Horário inválido (use HH:mm)').optional(),
    // Sem nenhum dos dois = toda a equipe. Os dois são independentes entre
    // si (dá pra escolher vendedores específicos E o dono ao mesmo tempo).
    vendedorIds: z.array(z.string()).optional(),
    incluiDono: z.boolean().optional(),
    exigeLocalizacao: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.tipo === 'UNICO' && (!val.data || !parseDataDiaUTC(val.data))) {
      ctx.addIssue({ code: 'custom', path: ['data'], message: 'Data obrigatória pra um item único' })
    }
    if (val.tipo === 'RECORRENTE' && (!val.diasSemana || val.diasSemana.length === 0)) {
      ctx.addIssue({ code: 'custom', path: ['diasSemana'], message: 'Selecione ao menos um dia da semana' })
    }
  })

router.post('/agenda-itens', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const parse = agendaItemSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const { titulo, descricao, categoria, tipo, data, diasSemana, dataInicio, dataFim, horario, vendedorIds, incluiDono, exigeLocalizacao } = parse.data

  const idsUnicos = [...new Set(vendedorIds ?? [])]
  if (idsUnicos.length > 0) {
    const encontrados = await prisma.vendedor.count({ where: { id: { in: idsUnicos }, usuarioId } })
    if (encontrados !== idsUnicos.length) {
      res.status(404).json({ error: 'Um ou mais vendedores selecionados não foram encontrados' })
      return
    }
  }

  const item = await prisma.agendaItem.create({
    data: {
      usuarioId,
      titulo,
      descricao: descricao || undefined,
      categoria,
      tipo,
      data: tipo === 'UNICO' ? parseDataDiaUTC(data!) : undefined,
      diasSemana: tipo === 'RECORRENTE' ? diasSemana!.join(',') : undefined,
      dataInicio: dataInicio ? parseDataDiaUTC(dataInicio) ?? undefined : undefined,
      dataFim: dataFim ? parseDataDiaUTC(dataFim) ?? undefined : undefined,
      horario: horario || undefined,
      vendedorIds: idsUnicos.length > 0 ? idsUnicos.join(',') : undefined,
      incluiDono: !!incluiDono,
      exigeLocalizacao: !!exigeLocalizacao,
    },
  })
  res.status(201).json(item)
})

const agendaItemEditSchema = z.object({
  titulo: z.string().min(2, 'Título muito curto').optional(),
  descricao: z.string().max(2000).nullable().optional(),
  categoria: z.enum(AGENDA_CATEGORIAS).optional(),
  tipo: z.enum(AGENDA_TIPOS).optional(),
  data: z.string().nullable().optional(),
  diasSemana: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  dataInicio: z.string().nullable().optional(),
  dataFim: z.string().nullable().optional(),
  horario: z.string().regex(HORARIO_REGEX, 'Horário inválido (use HH:mm)').nullable().optional(),
  vendedorIds: z.array(z.string()).nullable().optional(),
  incluiDono: z.boolean().optional(),
  exigeLocalizacao: z.boolean().optional(),
  ativo: z.boolean().optional(),
})

router.patch('/agenda-itens/:id', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const parse = agendaItemEditSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.agendaItem.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Item de agenda não encontrado' })
    return
  }
  const { data, diasSemana, dataInicio, dataFim, horario, vendedorIds, ...resto } = parse.data

  const idsUnicos = vendedorIds ? [...new Set(vendedorIds)] : null
  if (idsUnicos && idsUnicos.length > 0) {
    const encontrados = await prisma.vendedor.count({ where: { id: { in: idsUnicos }, usuarioId } })
    if (encontrados !== idsUnicos.length) {
      res.status(404).json({ error: 'Um ou mais vendedores selecionados não foram encontrados' })
      return
    }
  }

  const item = await prisma.agendaItem.update({
    where: { id: atual.id },
    data: {
      ...resto,
      ...(data !== undefined ? { data: data ? parseDataDiaUTC(data) : null } : {}),
      ...(diasSemana !== undefined ? { diasSemana: diasSemana ? diasSemana.join(',') : null } : {}),
      ...(dataInicio !== undefined ? { dataInicio: dataInicio ? parseDataDiaUTC(dataInicio) : null } : {}),
      ...(dataFim !== undefined ? { dataFim: dataFim ? parseDataDiaUTC(dataFim) : null } : {}),
      ...(horario !== undefined ? { horario: horario || null } : {}),
      ...(vendedorIds !== undefined ? { vendedorIds: idsUnicos && idsUnicos.length > 0 ? idsUnicos.join(',') : null } : {}),
    },
  })
  res.json(item)
})

router.delete('/agenda-itens/:id', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.agendaItem.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Item de agenda não encontrado' })
    return
  }
  await prisma.agendaConclusao.deleteMany({ where: { agendaItemId: atual.id } })
  await prisma.agendaItem.delete({ where: { id: atual.id } })
  res.json({ ok: true })
})

// Conclusões no intervalo pedido — vendedor só vê as próprias; dono/
// supervisor vê de todo mundo (é a base do indicador de aderência da
// equipe). Sempre filtrado por item.usuarioId, pra nunca vazar entre contas.
router.get('/agenda-conclusoes', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const papel = req.proLaboreUser!.papel
  const vejaEquipe = papel === 'DONO' || papel === 'SUPERVISOR'
  const { inicio, fim } = req.query

  const inicioData = typeof inicio === 'string' ? parseDataDiaUTC(inicio) : null
  const fimData = typeof fim === 'string' ? parseDataDiaUTC(fim) : null
  if (!inicioData || !fimData) {
    res.status(400).json({ error: 'Período inválido' })
    return
  }

  const conclusoes = await prisma.agendaConclusao.findMany({
    where: {
      dataReferencia: { gte: inicioData, lte: fimData },
      item: { usuarioId },
      ...(vejaEquipe ? {} : { autorId: autorIdAtual(req) }),
    },
  })
  res.json(conclusoes)
})

// latitude/longitude são opcionais e só fazem sentido em /concluir (não em
// /iniciar) — reaproveitar o mesmo schema nos dois é seguro porque campo
// extra opcional não quebra nada, e evita duplicar validação.
const concluirSchema = z.object({
  data: z.string(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
})

// Busca o item (escopado à conta) e confirma que quem chamou é alvo dele —
// compartilhado entre /concluir e /iniciar, que têm exatamente a mesma
// regra de autorização (só mexe na própria marca, nunca na de outra
// pessoa, mesmo sendo dono/supervisor).
async function itemEAutorizacao(req: Request, itemId: string): Promise<{ item: NonNullable<Awaited<ReturnType<typeof prisma.agendaItem.findFirst>>> } | { erro: number; mensagem: string }> {
  const usuarioId = req.proLaboreUser!.sub
  const item = await prisma.agendaItem.findFirst({ where: { id: itemId, usuarioId } })
  if (!item) return { erro: 404, mensagem: 'Item de agenda não encontrado' }
  const meuVendedorId = req.proLaboreUser!.vendedorId ?? null
  const alvos = (item.vendedorIds ?? '').split(',').filter(Boolean)
  const temAlvoEspecifico = alvos.length > 0 || item.incluiDono
  if (temAlvoEspecifico) {
    const souAlvo = (item.incluiDono && req.proLaboreUser!.papel === 'DONO') || (meuVendedorId != null && alvos.includes(meuVendedorId))
    if (!souAlvo) return { erro: 403, mensagem: 'Este item é de outra pessoa' }
  }
  return { item }
}

// Marca/desmarca (alterna) a conclusão do item pra HOJE-do-ponto-de-vista-de
// quem pede, na data informada — cada pessoa só mexe na própria conclusão,
// nunca na de outra (mesmo dono/supervisor não marcam "no lugar de"
// ninguém: o valor da visão deles é acompanhar a aderência, não simulá-la).
router.post('/agenda-itens/:id/concluir', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = concluirSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const dataReferencia = parseDataDiaUTC(parse.data.data)
  if (!dataReferencia) {
    res.status(400).json({ error: 'Data inválida' })
    return
  }

  const auth = await itemEAutorizacao(req, String(req.params.id))
  if ('erro' in auth) {
    res.status(auth.erro).json({ error: auth.mensagem })
    return
  }

  const autorId = autorIdAtual(req)
  const existente = await prisma.agendaConclusao.findUnique({
    where: { agendaItemId_autorId_dataReferencia: { agendaItemId: auth.item.id, autorId, dataReferencia } },
  })

  if (existente) {
    await prisma.agendaConclusao.delete({ where: { id: existente.id } })
    res.json({ concluido: false })
    return
  }
  const { latitude, longitude } = parse.data
  const criada = await prisma.agendaConclusao.create({
    data: {
      agendaItemId: auth.item.id,
      autorId,
      dataReferencia,
      // Só grava o selo se o item realmente exige — coordenadas mandadas
      // pra um item sem exigeLocalizacao são ignoradas, não persistidas.
      ...(auth.item.exigeLocalizacao && latitude != null && longitude != null ? { latitude, longitude } : {}),
    },
  })
  res.json({ concluido: true, concluidoEm: criada.concluidoEm, latitude: criada.latitude, longitude: criada.longitude })
})

// Início da atividade — sinal independente da conclusão (ver comentário do
// model AgendaInicio), pra medir em que etapa a rotina "fura": previstas →
// iniciadas → concluídas no prazo.
router.post('/agenda-itens/:id/iniciar', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = concluirSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const dataReferencia = parseDataDiaUTC(parse.data.data)
  if (!dataReferencia) {
    res.status(400).json({ error: 'Data inválida' })
    return
  }

  const auth = await itemEAutorizacao(req, String(req.params.id))
  if ('erro' in auth) {
    res.status(auth.erro).json({ error: auth.mensagem })
    return
  }

  const autorId = autorIdAtual(req)
  const existente = await prisma.agendaInicio.findUnique({
    where: { agendaItemId_autorId_dataReferencia: { agendaItemId: auth.item.id, autorId, dataReferencia } },
  })

  if (existente) {
    await prisma.agendaInicio.delete({ where: { id: existente.id } })
    res.json({ iniciado: false })
    return
  }
  const criado = await prisma.agendaInicio.create({
    data: { agendaItemId: auth.item.id, autorId, dataReferencia },
  })
  res.json({ iniciado: true, iniciadoEm: criado.iniciadoEm })
})

// Inícios no intervalo pedido — mesma regra de visibilidade de
// /agenda-conclusoes (vendedor só vê o próprio, dono/supervisor vê a
// equipe), pra alimentar o funil de aderência.
router.get('/agenda-inicios', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const papel = req.proLaboreUser!.papel
  const vejaEquipe = papel === 'DONO' || papel === 'SUPERVISOR'
  const { inicio, fim } = req.query

  const inicioData = typeof inicio === 'string' ? parseDataDiaUTC(inicio) : null
  const fimData = typeof fim === 'string' ? parseDataDiaUTC(fim) : null
  if (!inicioData || !fimData) {
    res.status(400).json({ error: 'Período inválido' })
    return
  }

  const inicios = await prisma.agendaInicio.findMany({
    where: {
      dataReferencia: { gte: inicioData, lte: fimData },
      item: { usuarioId },
      ...(vejaEquipe ? {} : { autorId: autorIdAtual(req) }),
    },
  })
  res.json(inicios)
})

// Efetividade comercial por vendedor no período: conversão real do funil de
// Leads (abordado → fechado), não o quanto ele cumpriu a rotina da Agenda —
// as duas métricas juntas é que diferenciam quem cumpre agenda mas não
// converte de quem cumpre e converte. Não cria tabela nova: deriva de
// LeadEstagioHistorico, que já registra cada transição de estágio.
router.get('/agenda/efetividade', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const { inicio, fim } = req.query
  const inicioData = typeof inicio === 'string' ? parseDataDiaUTC(inicio) : null
  const fimData = typeof fim === 'string' ? parseDataDiaUTC(fim) : null
  if (!inicioData || !fimData) {
    res.status(400).json({ error: 'Período inválido' })
    return
  }
  const fimExclusivo = new Date(fimData.getTime() + 24 * 60 * 60 * 1000)

  const transicoes = await prisma.leadEstagioHistorico.findMany({
    where: {
      criadoEm: { gte: inicioData, lt: fimExclusivo },
      estagioNovo: { in: ['ABORDADO', 'FECHADO'] },
      lead: { usuarioId },
    },
    select: { leadId: true, estagioNovo: true, lead: { select: { vendedorId: true } } },
  })

  const porVendedor = new Map<string, { abordados: Set<string>; fechados: Set<string> }>()
  for (const t of transicoes) {
    const vendedorId = t.lead.vendedorId
    if (!vendedorId) continue
    if (!porVendedor.has(vendedorId)) porVendedor.set(vendedorId, { abordados: new Set(), fechados: new Set() })
    const bucket = porVendedor.get(vendedorId)!
    if (t.estagioNovo === 'ABORDADO') bucket.abordados.add(t.leadId)
    else bucket.fechados.add(t.leadId)
  }

  res.json(
    Array.from(porVendedor.entries()).map(([vendedorId, b]) => ({
      vendedorId,
      leadsAbordados: b.abordados.size,
      leadsFechados: b.fechados.size,
      efetividadePct: b.abordados.size > 0 ? (b.fechados.size / b.abordados.size) * 100 : 0,
    }))
  )
})

// --- Ocorrências (registro disciplinar/feedback da equipe comercial) ---

const TIPOS_OCORRENCIA = ['DISCIPLINAR', 'INEFICIENCIA_PRODUCAO', 'FEEDBACK_MELHORIA', 'FEEDBACK_POSITIVO', 'OUTROS'] as const
const GRAVIDADES_OCORRENCIA = ['LEVE', 'MODERADA', 'GRAVE', 'GRAVISSIMA'] as const
const STATUS_OCORRENCIA = ['ABERTA', 'EM_PRAZO', 'EM_VERIFICACAO', 'RESOLVIDA', 'REINCIDENTE', 'ESCALONADA', 'ENCERRADA'] as const
const MEDIDAS_DISCIPLINARES = ['NENHUMA', 'ADVERTENCIA_VERBAL', 'ADVERTENCIA_ESCRITA', 'SUSPENSAO', 'DESLIGAMENTO'] as const

const OCORRENCIA_INCLUDE = {
  vendedor: { select: { id: true, nome: true } },
  historico: { orderBy: { criadoEm: 'asc' as const } },
}

// Protocolo sequencial por conta e por ano civil (reinicia toda virada de
// ano), no formato OC-{ano}-{sequencial de 4 dígitos}. É gerado uma única
// vez na criação e nunca pode ser editado depois — é a referência que liga
// a tela ao documento assinado em papel.
async function gerarProtocoloOcorrencia(usuarioId: string): Promise<string> {
  const ano = new Date().getUTCFullYear()
  const total = await prisma.ocorrencia.count({ where: { usuarioId, protocolo: { startsWith: `OC-${ano}-` } } })
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const protocolo = `OC-${ano}-${String(total + 1 + tentativa).padStart(4, '0')}`
    const jaExiste = await prisma.ocorrencia.findUnique({ where: { protocolo } })
    if (!jaExiste) return protocolo
  }
  throw new Error('Não foi possível gerar um protocolo único para a ocorrência')
}

// Motivo digitado que ainda não está na lista da conta é adicionado
// automaticamente — assim dá pra "criar um motivo" só digitando um novo no
// formulário, sem precisar de uma tela de cadastro separada, e ele já
// aparece como sugestão da próxima vez (mesma lista usada em Configurações).
async function garantirMotivoNaLista(usuarioId: string, motivo: string): Promise<void> {
  const motivoNormalizado = motivo.trim()
  if (!motivoNormalizado) return
  const parametro = await prisma.parametroLiquidez.upsert({
    where: { usuarioId },
    update: {},
    create: { usuarioId, tetoProLaborePorVenda: TETO_PRO_LABORE_PADRAO },
  })
  const existentes = parametro.motivosOcorrenciaCsv.split(',').map(m => m.trim()).filter(Boolean)
  const jaExiste = existentes.some(m => m.toLowerCase() === motivoNormalizado.toLowerCase())
  if (jaExiste) return
  await prisma.parametroLiquidez.update({
    where: { usuarioId },
    data: { motivosOcorrenciaCsv: [...existentes, motivoNormalizado].join(',') },
  })
}

router.get('/ocorrencias', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const { vendedorId, tipo, gravidade, status, inicio, fim } = req.query

  const where: {
    usuarioId: string; vendedorId?: string; tipo?: string; gravidade?: string; status?: string
    dataOcorrencia?: { gte?: Date; lt?: Date }
  } = { usuarioId }

  if (typeof vendedorId === 'string' && vendedorId) where.vendedorId = vendedorId
  if (typeof tipo === 'string' && (TIPOS_OCORRENCIA as readonly string[]).includes(tipo)) where.tipo = tipo
  if (typeof gravidade === 'string' && (GRAVIDADES_OCORRENCIA as readonly string[]).includes(gravidade)) where.gravidade = gravidade
  if (typeof status === 'string' && (STATUS_OCORRENCIA as readonly string[]).includes(status)) where.status = status

  const inicioData = typeof inicio === 'string' ? parseDataDiaUTC(inicio) : null
  const fimData = typeof fim === 'string' ? parseDataDiaUTC(fim) : null
  if (inicioData || fimData) {
    where.dataOcorrencia = {}
    if (inicioData) where.dataOcorrencia.gte = inicioData
    if (fimData) where.dataOcorrencia.lt = new Date(fimData.getTime() + 24 * 60 * 60 * 1000)
  }

  const ocorrencias = await prisma.ocorrencia.findMany({ where, include: OCORRENCIA_INCLUDE, orderBy: { dataRegistro: 'desc' } })
  res.json(ocorrencias)
})

// Cards de resumo do topo da tela — calculados à parte da listagem pra não
// dependerem dos filtros ativos na tabela. Precisa vir antes de '/:id' pra
// não ser interpretada como um id de ocorrência.
router.get('/ocorrencias/resumo', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const agora = new Date()
  const daqui7Dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000)
  const inicioDoMes = primeiroDiaDoMesUTC(agora)

  const [abertas, prazosVencendo, reincidenciasAtivas, resolvidasNoMes] = await Promise.all([
    prisma.ocorrencia.count({ where: { usuarioId, status: { in: ['ABERTA', 'EM_PRAZO', 'EM_VERIFICACAO'] } } }),
    prisma.ocorrencia.count({
      where: { usuarioId, status: { in: ['ABERTA', 'EM_PRAZO'] }, prazoCorrecao: { not: null, lte: daqui7Dias } },
    }),
    prisma.ocorrencia.count({ where: { usuarioId, status: { in: ['REINCIDENTE', 'ESCALONADA'] } } }),
    prisma.ocorrencia.count({ where: { usuarioId, status: 'RESOLVIDA', atualizadoEm: { gte: inicioDoMes } } }),
  ])

  res.json({ abertas, prazosVencendo, reincidenciasAtivas, resolvidasNoMes })
})

// Só ocorrências desses tipos entram na régua disciplinar — feedback
// positivo e "outros" são só registro histórico, não escalonam medida.
function categoriaRegua(tipo: string): 'DISCIPLINAR' | 'DESEMPENHO' | null {
  if (tipo === 'DISCIPLINAR') return 'DISCIPLINAR'
  if (tipo === 'INEFICIENCIA_PRODUCAO') return 'DESEMPENHO'
  return null
}

// Régua sugerida (1ª leve→feedback verbal registrado, 2ª→advertência verbal,
// 3ª→advertência escrita, 4ª→suspensão, 5ª em diante→desligamento),
// separada por categoria (Disciplinar x Desempenho). O sistema só SUGERE a
// próxima medida a partir do histórico do vendedor — a decisão final de
// aplicar (ou não) é sempre manual do gestor.
const REGUA_DISCIPLINAR = ['NENHUMA', 'ADVERTENCIA_VERBAL', 'ADVERTENCIA_ESCRITA', 'SUSPENSAO', 'DESLIGAMENTO'] as const
const REGUA_DISCIPLINAR_LABEL: Record<(typeof REGUA_DISCIPLINAR)[number], string> = {
  NENHUMA: 'Feedback verbal registrado',
  ADVERTENCIA_VERBAL: 'Advertência verbal formal',
  ADVERTENCIA_ESCRITA: 'Advertência escrita',
  SUSPENSAO: 'Suspensão',
  DESLIGAMENTO: 'Desligamento',
}

// Precisa vir antes de '/:id' pra não ser interpretada como um id de ocorrência.
router.get('/ocorrencias/sugestao-medida', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const { vendedorId, tipo } = req.query
  if (typeof vendedorId !== 'string' || !vendedorId || typeof tipo !== 'string' || !tipo) {
    res.status(400).json({ error: 'vendedorId e tipo são obrigatórios' })
    return
  }

  const categoria = categoriaRegua(tipo)
  if (!categoria) {
    res.json({ aplicavel: false })
    return
  }

  const totalAnteriores = await prisma.ocorrencia.count({ where: { usuarioId, vendedorId, tipo } })
  const ordinal = totalAnteriores + 1
  const medidaSugerida = REGUA_DISCIPLINAR[Math.min(ordinal, REGUA_DISCIPLINAR.length) - 1]
  res.json({
    aplicavel: true,
    categoria,
    ordinal,
    medidaSugerida,
    descricaoSugerida: REGUA_DISCIPLINAR_LABEL[medidaSugerida],
  })
})

const criarOcorrenciaSchema = z.object({
  vendedorId: z.string().min(1, 'Vendedor obrigatório'),
  tipo: z.enum(TIPOS_OCORRENCIA),
  motivo: z.string().min(1, 'Motivo obrigatório'),
  gravidade: z.enum(GRAVIDADES_OCORRENCIA),
  descricao: z.string().min(1, 'Descrição obrigatória'),
  anexosCsv: z.string().optional(),
  dataOcorrencia: z.string().min(1, 'Data da ocorrência obrigatória'),
  registradoPor: z.string().min(1, 'Responsável pelo registro obrigatório'),
  planoDeCorrecao: z.string().optional(),
  prazoCorrecao: z.string().optional(),
  ocorrenciaAnteriorId: z.string().optional(),
})

router.post('/ocorrencias', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const parse = criarOcorrenciaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const usuarioId = req.proLaboreUser!.sub

  const vendedor = await prisma.vendedor.findFirst({ where: { id: parse.data.vendedorId, usuarioId } })
  if (!vendedor) {
    res.status(400).json({ error: 'Vendedor não encontrado' })
    return
  }

  const dataOcorrencia = parseDataDiaUTC(parse.data.dataOcorrencia)
  if (!dataOcorrencia) {
    res.status(400).json({ error: 'Data da ocorrência inválida' })
    return
  }

  const prazoCorrecao = parse.data.prazoCorrecao ? parseDataDiaUTC(parse.data.prazoCorrecao) : null
  if (parse.data.prazoCorrecao && !prazoCorrecao) {
    res.status(400).json({ error: 'Prazo de correção inválido' })
    return
  }

  if (parse.data.ocorrenciaAnteriorId) {
    const anterior = await prisma.ocorrencia.findFirst({ where: { id: parse.data.ocorrenciaAnteriorId, usuarioId } })
    if (!anterior) {
      res.status(400).json({ error: 'Ocorrência anterior (para reincidência) não encontrada' })
      return
    }
  }

  const protocolo = await gerarProtocoloOcorrencia(usuarioId)
  await garantirMotivoNaLista(usuarioId, parse.data.motivo)

  const ocorrencia = await prisma.ocorrencia.create({
    data: {
      usuarioId,
      protocolo,
      vendedorId: parse.data.vendedorId,
      tipo: parse.data.tipo,
      motivo: parse.data.motivo,
      gravidade: parse.data.gravidade,
      descricao: parse.data.descricao,
      anexosCsv: parse.data.anexosCsv,
      dataOcorrencia,
      registradoPor: parse.data.registradoPor,
      planoDeCorrecao: parse.data.planoDeCorrecao,
      prazoCorrecao,
      ocorrenciaAnteriorId: parse.data.ocorrenciaAnteriorId,
    },
  })

  await prisma.ocorrenciaHistorico.create({
    data: {
      ocorrenciaId: ocorrencia.id,
      autor: req.proLaboreUser!.nome,
      acao: `Ocorrência registrada (protocolo ${protocolo})`,
      statusAnterior: null,
      statusNovo: ocorrencia.status,
    },
  })

  const comHistorico = await prisma.ocorrencia.findUnique({ where: { id: ocorrencia.id }, include: OCORRENCIA_INCLUDE })
  res.status(201).json(comHistorico)
})

router.get('/ocorrencias/:id', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const ocorrencia = await prisma.ocorrencia.findFirst({
    where: { id: String(req.params.id), usuarioId },
    include: {
      ...OCORRENCIA_INCLUDE,
      ocorrenciaAnterior: { select: { id: true, protocolo: true, status: true, dataOcorrencia: true } },
      reincidencias: { select: { id: true, protocolo: true, status: true, dataOcorrencia: true } },
    },
  })
  if (!ocorrencia) {
    res.status(404).json({ error: 'Ocorrência não encontrada' })
    return
  }
  res.json(ocorrencia)
})

const editarOcorrenciaSchema = z.object({
  tipo: z.enum(TIPOS_OCORRENCIA).optional(),
  motivo: z.string().min(1).optional(),
  gravidade: z.enum(GRAVIDADES_OCORRENCIA).optional(),
  descricao: z.string().min(1).optional(),
  anexosCsv: z.string().nullable().optional(),
  dataOcorrencia: z.string().min(1).optional(),
  planoDeCorrecao: z.string().nullable().optional(),
  prazoCorrecao: z.string().nullable().optional(),
  status: z.enum(STATUS_OCORRENCIA).optional(),
  medidaAplicada: z.enum(MEDIDAS_DISCIPLINARES).optional(),
})

// Toda alteração pós-criação passa por aqui e cada campo relevante que
// mudar gera uma entrada em historico[] — o registro original nunca é
// sobrescrito silenciosamente, preservando o rastro de auditoria exigido
// pelo processo disciplinar. protocolo, vendedorId e dataRegistro nunca são
// editáveis (por isso nem entram no schema acima).
router.patch('/ocorrencias/:id', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const parse = editarOcorrenciaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.ocorrencia.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Ocorrência não encontrada' })
    return
  }

  const data: {
    tipo?: string; motivo?: string; gravidade?: string; descricao?: string; anexosCsv?: string | null
    dataOcorrencia?: Date; planoDeCorrecao?: string | null; prazoCorrecao?: Date | null
    status?: string; medidaAplicada?: string
  } = {}
  const autor = req.proLaboreUser!.nome
  const eventos: { autor: string; acao: string; statusAnterior?: string | null; statusNovo?: string | null }[] = []

  if (parse.data.tipo !== undefined && parse.data.tipo !== atual.tipo) {
    data.tipo = parse.data.tipo
    eventos.push({ autor, acao: `Tipo alterado de "${atual.tipo}" para "${parse.data.tipo}"` })
  }
  if (parse.data.motivo !== undefined && parse.data.motivo !== atual.motivo) {
    data.motivo = parse.data.motivo
    eventos.push({ autor, acao: `Motivo alterado de "${atual.motivo}" para "${parse.data.motivo}"` })
    await garantirMotivoNaLista(usuarioId, parse.data.motivo)
  }
  if (parse.data.gravidade !== undefined && parse.data.gravidade !== atual.gravidade) {
    data.gravidade = parse.data.gravidade
    eventos.push({ autor, acao: `Gravidade alterada de "${atual.gravidade}" para "${parse.data.gravidade}"` })
  }
  if (parse.data.descricao !== undefined && parse.data.descricao !== atual.descricao) {
    data.descricao = parse.data.descricao
    eventos.push({ autor, acao: 'Descrição da ocorrência editada' })
  }
  if (parse.data.anexosCsv !== undefined && parse.data.anexosCsv !== atual.anexosCsv) {
    data.anexosCsv = parse.data.anexosCsv
    eventos.push({ autor, acao: 'Anexos atualizados' })
  }
  if (parse.data.planoDeCorrecao !== undefined && parse.data.planoDeCorrecao !== atual.planoDeCorrecao) {
    data.planoDeCorrecao = parse.data.planoDeCorrecao
    eventos.push({ autor, acao: 'Plano de correção atualizado' })
  }
  if (parse.data.medidaAplicada !== undefined && parse.data.medidaAplicada !== atual.medidaAplicada) {
    data.medidaAplicada = parse.data.medidaAplicada
    eventos.push({ autor, acao: `Medida aplicada definida como "${parse.data.medidaAplicada}"` })
  }

  if (parse.data.dataOcorrencia !== undefined) {
    const dataOcorrencia = parseDataDiaUTC(parse.data.dataOcorrencia)
    if (!dataOcorrencia) {
      res.status(400).json({ error: 'Data da ocorrência inválida' })
      return
    }
    if (dataOcorrencia.getTime() !== atual.dataOcorrencia.getTime()) {
      data.dataOcorrencia = dataOcorrencia
      eventos.push({ autor, acao: 'Data da ocorrência corrigida' })
    }
  }

  if (parse.data.prazoCorrecao !== undefined) {
    const prazoCorrecao = parse.data.prazoCorrecao ? parseDataDiaUTC(parse.data.prazoCorrecao) : null
    if (parse.data.prazoCorrecao && !prazoCorrecao) {
      res.status(400).json({ error: 'Prazo de correção inválido' })
      return
    }
    if (prazoCorrecao?.getTime() !== atual.prazoCorrecao?.getTime()) {
      data.prazoCorrecao = prazoCorrecao
      eventos.push({ autor, acao: prazoCorrecao ? 'Prazo de correção definido/alterado' : 'Prazo de correção removido' })
    }
  }

  if (parse.data.status !== undefined && parse.data.status !== atual.status) {
    data.status = parse.data.status
    eventos.push({ autor, acao: 'Status alterado', statusAnterior: atual.status, statusNovo: parse.data.status })
  }

  if (Object.keys(data).length > 0) {
    await prisma.ocorrencia.update({ where: { id: atual.id }, data })
  }
  if (eventos.length > 0) {
    await prisma.ocorrenciaHistorico.createMany({
      data: eventos.map(e => ({
        ocorrenciaId: atual.id,
        autor: e.autor,
        acao: e.acao,
        statusAnterior: e.statusAnterior ?? null,
        statusNovo: e.statusNovo ?? null,
      })),
    })
  }

  const ocorrencia = await prisma.ocorrencia.findUnique({ where: { id: atual.id }, include: OCORRENCIA_INCLUDE })
  res.json(ocorrencia)
})

const desfechoOcorrenciaSchema = z.object({
  resultado: z.enum(['CORRIGIDO', 'NAO_CORRIGIDO']),
  encaminhamento: z.enum(['REINCIDENTE', 'ESCALONADA']).optional(),
  medidaAplicada: z.enum(MEDIDAS_DISCIPLINARES).optional(),
  observacao: z.string().optional(),
})

// Registra o desfecho da verificação de prazo: "Corrigido" fecha como
// Resolvida; "Não corrigido" exige dizer se vira Reincidente ou é
// Escalonada, junto da medida que o gestor decidiu aplicar (a régua sugerida
// em /sugestao-medida é só uma sugestão — a decisão final é sempre manual).
// Se o gestor quiser abrir uma nova ocorrência vinculada (reincidência),
// isso é feito num POST /ocorrencias normal passando ocorrenciaAnteriorId.
router.post('/ocorrencias/:id/desfecho', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const parse = desfechoOcorrenciaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  if (parse.data.resultado === 'NAO_CORRIGIDO' && !parse.data.encaminhamento) {
    res.status(400).json({ error: 'Informe se a ocorrência vira Reincidente ou é Escalonada' })
    return
  }

  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.ocorrencia.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Ocorrência não encontrada' })
    return
  }

  const novoStatus = parse.data.resultado === 'CORRIGIDO' ? 'RESOLVIDA' : parse.data.encaminhamento!
  const data: { status: string; medidaAplicada?: string } = { status: novoStatus }
  if (parse.data.medidaAplicada) data.medidaAplicada = parse.data.medidaAplicada
  await prisma.ocorrencia.update({ where: { id: atual.id }, data })

  const acaoBase = parse.data.resultado === 'CORRIGIDO'
    ? 'Desfecho registrado: plano de correção cumprido'
    : `Desfecho registrado: plano não cumprido (${parse.data.encaminhamento === 'REINCIDENTE' ? 'reincidência' : 'escalonada'})`
  await prisma.ocorrenciaHistorico.create({
    data: {
      ocorrenciaId: atual.id,
      autor: req.proLaboreUser!.nome,
      acao: parse.data.observacao ? `${acaoBase} — ${parse.data.observacao}` : acaoBase,
      statusAnterior: atual.status,
      statusNovo: novoStatus,
    },
  })

  const ocorrencia = await prisma.ocorrencia.findUnique({ where: { id: atual.id }, include: OCORRENCIA_INCLUDE })
  res.json(ocorrencia)
})

// O PDF em si é montado no cliente (não existe infra de storage de arquivo
// nesse repo) — esse endpoint só registra que o documento foi gerado
// (carimbo pra auditoria) e, se já tinha prazo de correção definido,
// avança o status de Aberta pra "Em prazo de correção", como no fluxo
// descrito: o prazo só passa a valer depois que o documento é emitido.
router.post('/ocorrencias/:id/documento', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.ocorrencia.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Ocorrência não encontrada' })
    return
  }

  const agora = new Date()
  const novoStatus = atual.status === 'ABERTA' && atual.prazoCorrecao ? 'EM_PRAZO' : atual.status

  await prisma.ocorrencia.update({
    where: { id: atual.id },
    data: { documentoGeradoEm: agora, status: novoStatus },
  })

  await prisma.ocorrenciaHistorico.create({
    data: {
      ocorrenciaId: atual.id,
      autor: req.proLaboreUser!.nome,
      acao: 'Documento de ocorrência gerado',
      statusAnterior: novoStatus !== atual.status ? atual.status : null,
      statusNovo: novoStatus !== atual.status ? novoStatus : null,
    },
  })

  const ocorrencia = await prisma.ocorrencia.findUnique({ where: { id: atual.id }, include: OCORRENCIA_INCLUDE })
  res.json(ocorrencia)
})

const assinaturaOcorrenciaSchema = z.object({
  parte: z.enum(['VENDEDOR', 'GESTOR']),
  assinado: z.boolean(),
})

// A assinatura em si acontece no papel — aqui só se registra que ela
// aconteceu (checkbox + data), mantendo o sistema como fonte da verdade
// mesmo sem armazenar o documento físico.
router.post('/ocorrencias/:id/assinatura', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const parse = assinaturaOcorrenciaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.ocorrencia.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Ocorrência não encontrada' })
    return
  }

  const agora = parse.data.assinado ? new Date() : null
  const data = parse.data.parte === 'VENDEDOR'
    ? { assinaturaVendedorOk: parse.data.assinado, assinaturaVendedorData: agora }
    : { assinaturaGestorOk: parse.data.assinado, assinaturaGestorData: agora }

  await prisma.ocorrencia.update({ where: { id: atual.id }, data })
  await prisma.ocorrenciaHistorico.create({
    data: {
      ocorrenciaId: atual.id,
      autor: req.proLaboreUser!.nome,
      acao: `Assinatura do ${parse.data.parte === 'VENDEDOR' ? 'colaborador' : 'gestor'} ${parse.data.assinado ? 'confirmada' : 'desfeita'}`,
    },
  })

  const ocorrencia = await prisma.ocorrencia.findUnique({ where: { id: atual.id }, include: OCORRENCIA_INCLUDE })
  res.json(ocorrencia)
})

// ===================== Social Media (integração real com Instagram) =====================
// Auditoria da produção da equipe a partir de dados reais puxados da
// Instagram Graph API — nada aqui é lançado manualmente.

const SOCIAL_MEDIA_SELECT = {
  id: true, instagramUserId: true, nomeUsuario: true, nomeExibicao: true, fotoUrl: true,
  seguidores: true, seguindo: true, publicacoesTotal: true, conectadoEm: true, atualizadoEm: true,
  tokenExpiraEm: true,
} as const

router.get('/social-media/conta', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const conta = await prisma.socialMediaConta.findUnique({
    where: { usuarioId: req.proLaboreUser!.sub },
    select: SOCIAL_MEDIA_SELECT,
  })
  res.json(conta)
})

const conectarSocialMediaSchema = z.object({ accessToken: z.string().min(20, 'Token inválido') })

router.post('/social-media/conectar', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = conectarSocialMediaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) {
    res.status(500).json({ error: 'Integração do Instagram não configurada no servidor.' })
    return
  }

  try {
    const tokenLongo = await trocarOuRenovarTokenLongo(appId, appSecret, parse.data.accessToken)
    const infoConta = await buscarContaInstagram(tokenLongo.accessToken)
    const conta = await prisma.socialMediaConta.upsert({
      where: { usuarioId: req.proLaboreUser!.sub },
      update: { ...infoConta, accessToken: tokenLongo.accessToken, tokenExpiraEm: tokenLongo.expiraEm },
      create: { ...infoConta, usuarioId: req.proLaboreUser!.sub, accessToken: tokenLongo.accessToken, tokenExpiraEm: tokenLongo.expiraEm },
      select: SOCIAL_MEDIA_SELECT,
    })
    res.status(201).json(conta)
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Falha ao conectar com o Instagram' })
  }
})

router.delete('/social-media/conta', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const conta = await prisma.socialMediaConta.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  if (!conta) {
    res.status(404).json({ error: 'Nenhuma conta conectada' })
    return
  }
  await prisma.socialMediaMidia.deleteMany({ where: { contaId: conta.id } })
  await prisma.socialMediaSnapshotDiario.deleteMany({ where: { contaId: conta.id } })
  await prisma.socialMediaConta.delete({ where: { id: conta.id } })
  res.status(204).end()
})

// Sincroniza mídias recentes + grava o snapshot diário de hoje. Renova o
// token automaticamente quando faltam menos de 10 dias pra expirar (dura
// ~60 dias) — sem isso, a conta ficaria desconectada sozinha com o tempo.
async function sincronizarContaSocialMedia(conta: { id: string; instagramUserId: string; accessToken: string; tokenExpiraEm: Date }) {
  let accessToken = conta.accessToken
  const diasParaExpirar = (conta.tokenExpiraEm.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (diasParaExpirar < 10 && appId && appSecret) {
    const renovado = await trocarOuRenovarTokenLongo(appId, appSecret, accessToken)
    accessToken = renovado.accessToken
    await prisma.socialMediaConta.update({ where: { id: conta.id }, data: { accessToken: renovado.accessToken, tokenExpiraEm: renovado.expiraEm } })
  }

  const infoConta = await buscarContaInstagram(accessToken)
  const midias = await buscarMidiasRecentes(conta.instagramUserId, accessToken)

  for (const midia of midias) {
    const insights = await buscarInsightsMidia(midia.instagramMediaId, accessToken)
    await prisma.socialMediaMidia.upsert({
      where: { instagramMediaId: midia.instagramMediaId },
      update: { ...midia, ...insights },
      create: { ...midia, ...insights, contaId: conta.id },
    })
  }

  const insightsHoje = await buscarInsightsContaHoje(conta.instagramUserId, accessToken)
  const hoje = inicioDoDiaUTC(new Date())
  const publicacoesNoDia = midias.filter(m => inicioDoDiaUTC(m.publicadoEm).getTime() === hoje.getTime()).length

  const ultimoSnapshot = await prisma.socialMediaSnapshotDiario.findFirst({
    where: { contaId: conta.id, data: { lt: hoje } },
    orderBy: { data: 'desc' },
  })
  const novosSeguidoresDia = ultimoSnapshot ? Math.max(0, infoConta.seguidores - ultimoSnapshot.seguidores) : 0

  await prisma.socialMediaSnapshotDiario.upsert({
    where: { contaId_data: { contaId: conta.id, data: hoje } },
    update: {
      seguidores: infoConta.seguidores,
      novosSeguidoresDia,
      alcanceContaDia: insightsHoje.alcance,
      impressoesContaDia: insightsHoje.impressoes,
      visitasPerfilDia: insightsHoje.visitasPerfil,
      publicacoesNoDia,
    },
    create: {
      contaId: conta.id,
      data: hoje,
      seguidores: infoConta.seguidores,
      novosSeguidoresDia,
      alcanceContaDia: insightsHoje.alcance,
      impressoesContaDia: insightsHoje.impressoes,
      visitasPerfilDia: insightsHoje.visitasPerfil,
      publicacoesNoDia,
    },
  })

  await prisma.socialMediaConta.update({
    where: { id: conta.id },
    data: { seguidores: infoConta.seguidores, seguindo: infoConta.seguindo, publicacoesTotal: infoConta.publicacoesTotal },
  })
}

router.post('/social-media/sincronizar', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const conta = await prisma.socialMediaConta.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  if (!conta) {
    res.status(404).json({ error: 'Nenhuma conta do Instagram conectada' })
    return
  }
  try {
    await sincronizarContaSocialMedia(conta)
    const atualizado = await prisma.socialMediaConta.findUnique({ where: { id: conta.id }, select: SOCIAL_MEDIA_SELECT })
    res.json(atualizado)
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Falha ao sincronizar com o Instagram' })
  }
})

// Chamado pelo cron externo (mesmo cron-job.org do keep-alive da API) a
// cada poucas horas — autenticado por segredo compartilhado, não por login,
// já que quem chama é um serviço externo sem sessão de usuário.
router.post('/social-media/sincronizar-cron', async (req: Request, res: Response) => {
  const segredo = req.header('x-cron-secret')
  if (!process.env.SOCIAL_MEDIA_CRON_SECRET || segredo !== process.env.SOCIAL_MEDIA_CRON_SECRET) {
    res.status(401).json({ error: 'Não autorizado' })
    return
  }
  const contas = await prisma.socialMediaConta.findMany()
  const resultados = await Promise.allSettled(contas.map(c => sincronizarContaSocialMedia(c)))
  res.json({
    total: contas.length,
    sucesso: resultados.filter(r => r.status === 'fulfilled').length,
    falhas: resultados.filter(r => r.status === 'rejected').length,
  })
})

router.get('/social-media/resumo', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const conta = await prisma.socialMediaConta.findUnique({ where: { usuarioId } })
  if (!conta) {
    res.json({ conectado: false })
    return
  }

  const { inicio, fim } = req.query
  const fimData = (typeof fim === 'string' ? parseDataDiaUTC(fim) : null) ?? inicioDoDiaUTC(new Date())
  const fimExclusivo = new Date(fimData.getTime() + 24 * 60 * 60 * 1000)
  const inicioData = (typeof inicio === 'string' ? parseDataDiaUTC(inicio) : null) ?? inicioDoDiaUTC(new Date(fimData.getTime() - 29 * 24 * 60 * 60 * 1000))

  const [midias, snapshots, parametro, leadsPeriodo] = await Promise.all([
    prisma.socialMediaMidia.findMany({
      where: { contaId: conta.id, publicadoEm: { gte: inicioData, lt: fimExclusivo } },
      orderBy: { publicadoEm: 'desc' },
    }),
    prisma.socialMediaSnapshotDiario.findMany({
      where: { contaId: conta.id, data: { gte: inicioData, lt: fimExclusivo } },
      orderBy: { data: 'asc' },
    }),
    prisma.parametroLiquidez.upsert({ where: { usuarioId }, update: {}, create: { usuarioId } }),
    prisma.lead.findMany({
      where: { usuarioId, tipoLead: 'ORGANICO', criadoEm: { gte: inicioData, lt: fimExclusivo } },
      select: { id: true, criadoEm: true, valorNegociacao: true, estagio: true },
    }),
  ])

  const semanasNoPeriodo = Math.max(1, Math.ceil((fimExclusivo.getTime() - inicioData.getTime()) / (7 * 24 * 60 * 60 * 1000)))
  const volume = {
    totalPublicacoes: midias.length,
    metaPostagensSemanais: parametro.metaPostagensSemanais,
    metaPeriodo: parametro.metaPostagensSemanais * semanasNoPeriodo,
    porTipo: ['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM'].map(tipo => ({ tipo, quantidade: midias.filter(m => m.tipo === tipo).length })),
  }

  const somaAlcance = midias.reduce((s, m) => s + m.alcance, 0)
  const engajamentoTotal = midias.reduce((s, m) => s + m.curtidas + m.comentarios + m.salvamentos + m.compartilhamentos, 0)
  const desempenho = {
    alcanceTotal: somaAlcance,
    engajamentoTotal,
    taxaEngajamento: somaAlcance > 0 ? engajamentoTotal / somaAlcance : 0,
    topPublicacoes: [...midias]
      .sort((a, b) => (b.alcance + b.curtidas) - (a.alcance + a.curtidas))
      .slice(0, 5)
      .map(m => ({
        id: m.id, tipo: m.tipo, urlPermalink: m.urlPermalink, urlMidia: m.urlMidia, publicadoEm: m.publicadoEm,
        alcance: m.alcance, curtidas: m.curtidas, comentarios: m.comentarios, salvamentos: m.salvamentos,
      })),
  }

  const novosSeguidoresPeriodo = snapshots.reduce((s, sn) => s + sn.novosSeguidoresDia, 0)
  const crescimento = {
    seguidoresAtual: conta.seguidores,
    novosSeguidoresPeriodo,
    serie: snapshots.map(sn => ({ data: sn.data, seguidores: sn.seguidores, novosSeguidoresDia: sn.novosSeguidoresDia })),
  }

  const leadsGanhos = leadsPeriodo.filter(l => l.estagio === 'FECHADO')
  const relacaoVendas = {
    leadsGerados: leadsPeriodo.length,
    leadsGanhos: leadsGanhos.length,
    valorNegociadoTotal: leadsGanhos.reduce((s, l) => s + l.valorNegociacao, 0),
  }

  const visitasPerfilPeriodo = snapshots.reduce((s, sn) => s + sn.visitasPerfilDia, 0)
  const jornada = {
    alcance: somaAlcance,
    visitasPerfil: visitasPerfilPeriodo,
    novosSeguidores: novosSeguidoresPeriodo,
    leadsGerados: leadsPeriodo.length,
  }

  res.json({
    conectado: true,
    conta: { nomeUsuario: conta.nomeUsuario, nomeExibicao: conta.nomeExibicao, fotoUrl: conta.fotoUrl, seguidores: conta.seguidores },
    periodo: { inicio: inicioData, fim: fimData },
    volume,
    desempenho,
    crescimento,
    relacaoVendas,
    jornada,
  })
})

// --- Plano de Crescimento: diagnóstico + plano de ação por regras, cruzando
// funil, vendas, ROAS e redes sociais num único retrato do momento da
// operação. Ver `lib/planoCrescimento.ts` pro motor de regras em si — esta
// rota só busca e agrega os números reais. Exclusiva do dono, porque cruza
// dado de anúncio/ROAS (já restrito a ele em qualquer outra rota).
router.get('/plano-crescimento', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const agora = new Date()
  const inicioMesAtual = primeiroDiaDoMesUTC(agora)
  const inicioMesAnterior = primeiroDiaDoMesUTC(new Date(Date.UTC(inicioMesAtual.getUTCFullYear(), inicioMesAtual.getUTCMonth() - 1, 1)))

  const [vendas, leadsMesAtual, vendedores, gastosRegistros, conta, parametro] = await Promise.all([
    prisma.venda.findMany({ where: { ...vendaWhereBase(req), data: { gte: inicioMesAnterior } } }),
    prisma.lead.findMany({ where: { ...leadWhereBase(req), criadoEm: { gte: inicioMesAtual } } }),
    prisma.vendedor.findMany({ where: { usuarioId } }),
    prisma.gastoAnuncioMensal.findMany({ where: { usuarioId, mesReferencia: { gte: inicioMesAnterior } } }),
    prisma.socialMediaConta.findUnique({ where: { usuarioId } }),
    prisma.parametroLiquidez.upsert({ where: { usuarioId }, update: {}, create: { usuarioId } }),
  ])

  const vendasMesAtual = vendas.filter(v => v.data >= inicioMesAtual)
  const vendasMesAnterior = vendas.filter(v => v.data >= inicioMesAnterior && v.data < inicioMesAtual)
  const receitaAtual = vendasMesAtual.reduce((s, v) => s + v.valorVenda, 0)
  const receitaAnterior = vendasMesAnterior.reduce((s, v) => s + v.valorVenda, 0)

  const gastoAtualRegistro = gastosRegistros.find(g => g.mesReferencia.getTime() === inicioMesAtual.getTime())
  const gastoAtual = gastoAtualRegistro?.valor ?? 0
  const roas = gastoAtual > 0 ? receitaAtual / gastoAtual : 0

  // Concentração de receita no vendedor líder: sinal de risco de depender
  // de uma única pessoa — mesmo cálculo de base do ranking do Dashboard,
  // só que aqui reduzido a "quem é o líder e quanto ele pesa no total".
  const receitaPorVendedor = new Map<string, number>()
  for (const v of vendasMesAtual) {
    if (!v.vendedorId) continue
    receitaPorVendedor.set(v.vendedorId, (receitaPorVendedor.get(v.vendedorId) ?? 0) + v.valorVenda)
  }
  const maiorReceitaVendedor = receitaPorVendedor.size > 0 ? Math.max(...receitaPorVendedor.values()) : 0
  const concentracaoMaiorVendedorPct = receitaAtual > 0 ? (maiorReceitaVendedor / receitaAtual) * 100 : 0

  const periodoDias = 30
  let socialConectado = false
  let publicacoesPeriodo = 0
  let metaPostagensPeriodo = 0
  let taxaEngajamento = 0
  let novosSeguidoresPeriodo = 0
  let leadsOrganicosPeriodo = 0

  if (conta) {
    socialConectado = true
    const fimExclusivo = new Date(inicioDoDiaUTC(agora).getTime() + 24 * 60 * 60 * 1000)
    const inicioPeriodo = new Date(fimExclusivo.getTime() - periodoDias * 24 * 60 * 60 * 1000)
    const [midias, snapshots, leadsOrganicos] = await Promise.all([
      prisma.socialMediaMidia.findMany({ where: { contaId: conta.id, publicadoEm: { gte: inicioPeriodo, lt: fimExclusivo } } }),
      prisma.socialMediaSnapshotDiario.findMany({ where: { contaId: conta.id, data: { gte: inicioPeriodo, lt: fimExclusivo } } }),
      prisma.lead.findMany({ where: { usuarioId, tipoLead: 'ORGANICO', criadoEm: { gte: inicioPeriodo, lt: fimExclusivo } }, select: { id: true } }),
    ])
    const semanasNoPeriodo = Math.max(1, Math.ceil(periodoDias / 7))
    publicacoesPeriodo = midias.length
    metaPostagensPeriodo = parametro.metaPostagensSemanais * semanasNoPeriodo
    const somaAlcance = midias.reduce((s, m) => s + m.alcance, 0)
    const engajamentoTotal = midias.reduce((s, m) => s + m.curtidas + m.comentarios + m.salvamentos + m.compartilhamentos, 0)
    taxaEngajamento = somaAlcance > 0 ? engajamentoTotal / somaAlcance : 0
    novosSeguidoresPeriodo = snapshots.reduce((s, sn) => s + sn.novosSeguidoresDia, 0)
    leadsOrganicosPeriodo = leadsOrganicos.length
  }

  const metricas: MetricasNegocio = {
    periodoDias,
    socialConectado, publicacoesPeriodo, metaPostagensPeriodo, taxaEngajamento, novosSeguidoresPeriodo, leadsOrganicosPeriodo,
    leadsAtual: leadsMesAtual.length,
    conversaoLeadVenda: leadsMesAtual.length > 0 ? (vendasMesAtual.length / leadsMesAtual.length) * 100 : 0,
    ticketMedioAtual: vendasMesAtual.length > 0 ? receitaAtual / vendasMesAtual.length : 0,
    ticketMedioAnterior: vendasMesAnterior.length > 0 ? receitaAnterior / vendasMesAnterior.length : 0,
    quantidadeVendasAtual: vendasMesAtual.length,
    quantidadeVendasAnterior: vendasMesAnterior.length,
    quantidadeVendedoresAtivos: vendedores.filter(v => v.ativo).length,
    quantidadeVendedoresComVenda: receitaPorVendedor.size,
    concentracaoMaiorVendedorPct,
    roas,
    receitaAtual,
    receitaAnterior,
  }

  const metas: MetasCrescimento = {
    roasMinimo: parametro.planoRoasMinimo,
    roasSaudavel: parametro.planoRoasSaudavel,
    conversaoMinimaPct: parametro.planoConversaoMinimaPct,
    conversaoConsolidadaPct: parametro.planoConversaoConsolidadaPct,
    engajamentoMinimoPct: parametro.planoEngajamentoMinimoPct,
    leadsOrganicosMinimo: parametro.planoLeadsOrganicosMinimo,
    concentracaoMaximaLiderPct: parametro.planoConcentracaoMaximaLiderPct,
  }

  const plano = gerarPlanoDeCrescimento(metricas, metas)

  // Registra (upsert) o retrato do mês corrente — alimenta a grade de
  // evolução mensal. O mês atual fica sempre atualizado com o estágio mais
  // recente; meses passados congelam sozinhos assim que vira o mês, porque
  // o próximo upsert já mira outra chave (usuarioId + mesReferencia).
  const pilarPorChave = new Map(plano.pilares.map(p => [p.chave, p]))
  await prisma.planoCrescimentoSnapshot.upsert({
    where: { usuarioId_mesReferencia: { usuarioId, mesReferencia: inicioMesAtual } },
    update: {
      estagioGeral: plano.estagioGeral,
      estagioAquisicao: pilarPorChave.get('aquisicao')!.estagio,
      estagioConversao: pilarPorChave.get('conversao')!.estagio,
      estagioExecucao: pilarPorChave.get('execucao')!.estagio,
      estagioFinanceiro: pilarPorChave.get('financeiro')!.estagio,
    },
    create: {
      usuarioId, mesReferencia: inicioMesAtual,
      estagioGeral: plano.estagioGeral,
      estagioAquisicao: pilarPorChave.get('aquisicao')!.estagio,
      estagioConversao: pilarPorChave.get('conversao')!.estagio,
      estagioExecucao: pilarPorChave.get('execucao')!.estagio,
      estagioFinanceiro: pilarPorChave.get('financeiro')!.estagio,
    },
  })

  // As ações sugeridas pelo motor viram itens persistidos e marcáveis — ver
  // o comentário do modelo PlanoCrescimentoAcao pra entender a `chave`
  // estável por trás disso (pilar+estágio+índice, não o texto em si, que
  // pode ter números ao vivo interpolados).
  const acoesExistentes = await prisma.planoCrescimentoAcao.findMany({ where: { usuarioId } })
  const existentePorChave = new Map(acoesExistentes.filter(a => a.chave).map(a => [a.chave as string, a]))

  const operacoesSeed: ReturnType<typeof prisma.planoCrescimentoAcao.create>[] = []
  for (const pilar of plano.pilares) {
    pilar.acoes.forEach((texto, indice) => {
      const chave = `${pilar.chave}:${pilar.estagio}:${indice}`
      const existente = existentePorChave.get(chave)
      if (!existente) {
        operacoesSeed.push(prisma.planoCrescimentoAcao.create({ data: { usuarioId, pilar: pilar.chave, chave, texto, origem: 'SUGERIDA' } }))
      } else if (!existente.editadoManualmente && existente.texto !== texto) {
        operacoesSeed.push(prisma.planoCrescimentoAcao.update({ where: { id: existente.id }, data: { texto } }))
      }
    })
  }
  if (operacoesSeed.length > 0) await prisma.$transaction(operacoesSeed)

  const todasAcoes = await prisma.planoCrescimentoAcao.findMany({
    where: { usuarioId },
    orderBy: [{ concluida: 'asc' }, { criadoEm: 'asc' }],
  })

  const resposta = {
    estagioGeral: plano.estagioGeral,
    resumoGeral: plano.resumoGeral,
    gargalo: plano.gargalo,
    pilares: plano.pilares.map(pilar => ({
      chave: pilar.chave,
      nome: pilar.nome,
      estagio: pilar.estagio,
      resumo: pilar.resumo,
      metricas: pilar.metricas,
      gates: pilar.gates,
      ritmo: pilar.ritmo,
      // Sugestão só aparece se pertence ao estágio atual do pilar — de um
      // estágio anterior, some sozinha quando o pilar avança (ou volta).
      // Itens customizados (chave nula) aparecem sempre.
      itens: todasAcoes
        .filter(a => a.pilar === pilar.chave && (a.origem === 'CUSTOMIZADA' || a.chave?.startsWith(`${pilar.chave}:${pilar.estagio}:`)))
        .map(a => ({ id: a.id, texto: a.texto, concluida: a.concluida, origem: a.origem })),
    })),
  }

  res.json(resposta)
})

const acaoCrescimentoSchema = z.object({
  pilar: z.enum(['aquisicao', 'conversao', 'execucao', 'financeiro']),
  texto: z.string().trim().min(1, 'Texto não pode ser vazio').max(500, 'Texto muito longo'),
})

router.post('/plano-crescimento/acoes', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = acaoCrescimentoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const acao = await prisma.planoCrescimentoAcao.create({
    data: { usuarioId: req.proLaboreUser!.sub, pilar: parse.data.pilar, texto: parse.data.texto, origem: 'CUSTOMIZADA' },
  })
  res.status(201).json({ id: acao.id, texto: acao.texto, concluida: acao.concluida, origem: acao.origem })
})

const acaoCrescimentoUpdateSchema = z.object({
  concluida: z.boolean().optional(),
  texto: z.string().trim().min(1, 'Texto não pode ser vazio').max(500, 'Texto muito longo').optional(),
})

router.patch('/plano-crescimento/acoes/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = acaoCrescimentoUpdateSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const acao = await prisma.planoCrescimentoAcao.findFirst({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub } })
  if (!acao) { res.status(404).json({ error: 'Ação não encontrada' }); return }

  const atualizada = await prisma.planoCrescimentoAcao.update({
    where: { id: acao.id },
    data: {
      concluida: parse.data.concluida,
      // Editar o texto de uma sugestão trava esse texto — o seeding do GET
      // /plano-crescimento não sobrescreve mais o que o dono escreveu.
      ...(parse.data.texto !== undefined ? { texto: parse.data.texto, editadoManualmente: true } : {}),
    },
  })
  res.json({ id: atualizada.id, texto: atualizada.texto, concluida: atualizada.concluida, origem: atualizada.origem })
})

router.delete('/plano-crescimento/acoes/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const acao = await prisma.planoCrescimentoAcao.findFirst({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub } })
  if (!acao) { res.status(404).json({ error: 'Ação não encontrada' }); return }
  // Só item customizado pode ser apagado — uma sugestão apagada voltaria
  // sozinha no próximo carregamento (a chave continuaria "faltando"), então
  // o jeito de "descartar" uma sugestão é marcá-la como concluída.
  if (acao.origem !== 'CUSTOMIZADA') { res.status(400).json({ error: 'Só é possível excluir itens adicionados por você — marque a sugestão como concluída em vez de excluir' }); return }
  await prisma.planoCrescimentoAcao.delete({ where: { id: acao.id } })
  res.json({ ok: true })
})

// Evolução mensal: retrato do estágio de cada pilar mês a mês (ver upsert em
// GET /plano-crescimento) — alimenta a grade de histórico na tela.
router.get('/plano-crescimento/historico', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const mesesParam = Number(req.query.meses)
  const quantidadeMeses = Number.isInteger(mesesParam) && mesesParam >= 1 && mesesParam <= 24 ? mesesParam : 6

  const inicioMesAtual = primeiroDiaDoMesUTC(new Date())
  const inicioJanela = new Date(Date.UTC(inicioMesAtual.getUTCFullYear(), inicioMesAtual.getUTCMonth() - (quantidadeMeses - 1), 1))

  const snapshots = await prisma.planoCrescimentoSnapshot.findMany({
    where: { usuarioId, mesReferencia: { gte: inicioJanela } },
    orderBy: { mesReferencia: 'asc' },
  })

  res.json(snapshots.map(s => ({
    mes: s.mesReferencia.getUTCMonth(),
    ano: s.mesReferencia.getUTCFullYear(),
    label: MESES_LABEL[s.mesReferencia.getUTCMonth()],
    estagioGeral: s.estagioGeral,
    estagioAquisicao: s.estagioAquisicao,
    estagioConversao: s.estagioConversao,
    estagioExecucao: s.estagioExecucao,
    estagioFinanceiro: s.estagioFinanceiro,
  })))
})

// ============ ASSISTENTE COMERCIAL (WhatsApp) ============
// Um assistente por vendedor, ligado ao número que ele já usa — o mesmo
// número atende dois papéis (SUPORTE quando é o próprio vendedor falando,
// LEAD quando é um contato de campanha sendo pré-qualificado). A conexão de
// verdade com o WhatsApp Business API ainda depende da mesma conta Meta
// usada no Social Media; até lá, "Conectar" aqui simula a conexão e povoa a
// tela com conversas de exemplo, pra já dar pra desenhar e validar o fluxo.

const ASSISTENTE_SELECT = {
  id: true, vendedorId: true, numeroWhatsapp: true, nomeExibicao: true, status: true, criadoEm: true,
}

// VENDEDOR/SUPERVISOR só enxergam o próprio assistente (é pessoal, ligado
// ao número que ele mesmo usa) — só o DONO escolhe de quem quer ver via
// ?vendedorId=, parecido com o filtro de vendedor usado no resto do painel.
function assistenteVendedorIdAlvo(req: Request, vendedorIdQuery?: string): string | null {
  const { papel, vendedorId } = req.proLaboreUser!
  if (papel === 'VENDEDOR' || papel === 'SUPERVISOR') return vendedorId!
  return typeof vendedorIdQuery === 'string' && vendedorIdQuery ? vendedorIdQuery : null
}

router.get('/assistente/config', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const vendedorIdAlvo = assistenteVendedorIdAlvo(req, req.query.vendedorId as string | undefined)
  if (!vendedorIdAlvo) {
    res.json({ assistente: null, vendedor: null })
    return
  }
  const vendedor = await prisma.vendedor.findFirst({ where: { id: vendedorIdAlvo, usuarioId }, select: { id: true, nome: true } })
  if (!vendedor) {
    res.status(404).json({ error: 'Vendedor não encontrado' })
    return
  }
  const assistente = await prisma.assistenteComercial.findUnique({ where: { vendedorId: vendedorIdAlvo }, select: ASSISTENTE_SELECT })
  res.json({ assistente, vendedor })
})

const conectarAssistenteSchema = z.object({
  numeroWhatsapp: z.string().min(8, 'Número inválido'),
  nomeExibicao: z.string().optional(),
  vendedorId: z.string().optional(), // só considerado quando quem chama é DONO
})

router.post('/assistente/config', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const parse = conectarAssistenteSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const { papel, vendedorId } = req.proLaboreUser!
  const vendedorIdAlvo = papel === 'DONO' ? parse.data.vendedorId : vendedorId
  if (!vendedorIdAlvo) {
    res.status(400).json({ error: 'Informe de qual vendedor é esse número' })
    return
  }
  const vendedor = await prisma.vendedor.findFirst({ where: { id: vendedorIdAlvo, usuarioId } })
  if (!vendedor) {
    res.status(404).json({ error: 'Vendedor não encontrado' })
    return
  }

  const assistente = await prisma.assistenteComercial.upsert({
    where: { vendedorId: vendedorIdAlvo },
    update: { numeroWhatsapp: parse.data.numeroWhatsapp, nomeExibicao: parse.data.nomeExibicao, status: 'CONECTADO' },
    create: { vendedorId: vendedorIdAlvo, numeroWhatsapp: parse.data.numeroWhatsapp, nomeExibicao: parse.data.nomeExibicao, status: 'CONECTADO' },
    select: ASSISTENTE_SELECT,
  })

  const jaTemConversas = await prisma.assistenteConversa.count({ where: { assistenteId: assistente.id } })
  if (jaTemConversas === 0) {
    await semearConversasExemplo(assistente.id, vendedor.nome)
  }

  res.json(assistente)
})

router.delete('/assistente/config', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const vendedorIdAlvo = assistenteVendedorIdAlvo(req, req.query.vendedorId as string | undefined)
  if (!vendedorIdAlvo) {
    res.status(400).json({ error: 'Informe de qual vendedor é esse assistente' })
    return
  }
  const vendedor = await prisma.vendedor.findFirst({ where: { id: vendedorIdAlvo, usuarioId } })
  if (!vendedor) {
    res.status(404).json({ error: 'Vendedor não encontrado' })
    return
  }
  // Só desconecta (reseta status/número) — não apaga o histórico de
  // conversas, igual um desligar de WhatsApp de verdade não apaga suas
  // conversas antigas.
  await prisma.assistenteComercial.updateMany({ where: { vendedorId: vendedorIdAlvo }, data: { status: 'NAO_CONECTADO', numeroWhatsapp: null } })
  res.json({ ok: true })
})

router.get('/assistente/conversas', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const vendedorIdAlvo = assistenteVendedorIdAlvo(req, req.query.vendedorId as string | undefined)
  if (!vendedorIdAlvo) {
    res.json([])
    return
  }
  const vendedor = await prisma.vendedor.findFirst({ where: { id: vendedorIdAlvo, usuarioId } })
  if (!vendedor) {
    res.status(404).json({ error: 'Vendedor não encontrado' })
    return
  }
  const assistente = await prisma.assistenteComercial.findUnique({ where: { vendedorId: vendedorIdAlvo } })
  if (!assistente) {
    res.json([])
    return
  }

  const { tipo } = req.query
  const where: { assistenteId: string; tipo?: string } = { assistenteId: assistente.id }
  if (typeof tipo === 'string' && ['SUPORTE', 'LEAD'].includes(tipo)) where.tipo = tipo

  const conversas = await prisma.assistenteConversa.findMany({
    where,
    include: {
      lead: { select: { id: true, nomeCliente: true, estagio: true } },
      mensagens: { orderBy: { criadoEm: 'desc' }, take: 1 },
    },
    orderBy: { ultimaMensagemEm: 'desc' },
  })
  res.json(conversas)
})

router.get('/assistente/conversas/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const conversa = await prisma.assistenteConversa.findUnique({
    where: { id: String(req.params.id) },
    include: {
      assistente: { include: { vendedor: { select: { id: true, nome: true, usuarioId: true } } } },
      mensagens: { orderBy: { criadoEm: 'asc' } },
      lead: { select: { id: true, nomeCliente: true, estagio: true } },
    },
  })
  const { sub: usuarioId, papel, vendedorId } = req.proLaboreUser!
  if (!conversa || conversa.assistente.vendedor.usuarioId !== usuarioId) {
    res.status(404).json({ error: 'Conversa não encontrada' })
    return
  }
  if ((papel === 'VENDEDOR' || papel === 'SUPERVISOR') && conversa.assistente.vendedorId !== vendedorId) {
    res.status(403).json({ error: 'Acesso restrito' })
    return
  }
  res.json(conversa)
})

// Conversas de exemplo (contexto de venda de motos, igual ao resto dos
// dados de demonstração do CRM) — só usadas pra popular a tela na primeira
// conexão, nunca criam Lead de verdade no CRM (isso é o que a integração
// real faria depois, quando a IA identificasse um lead qualificado).
async function semearConversasExemplo(assistenteId: string, nomeVendedor: string) {
  const agora = Date.now()
  const minutosAtras = (m: number) => new Date(agora - m * 60_000)

  await prisma.assistenteConversa.create({
    data: {
      assistenteId, tipo: 'SUPORTE', nomeContato: nomeVendedor, numeroContato: 'Você',
      status: 'ENCERRADA', ultimaMensagemEm: minutosAtras(40),
      mensagens: { create: [
        { remetente: 'CONTATO', texto: 'Como eu classifico uma negociação como renegociação (R)?', criadoEm: minutosAtras(42) },
        { remetente: 'ASSISTENTE', texto: 'No card do lead, dentro do CRM, tem dois botões "P" e "R" logo acima do "Avançar". Clique em "R" — isso já ajusta o teto de pró-labore e comissão dessa negociação, sem mexer no padrão da conta.', criadoEm: minutosAtras(41) },
        { remetente: 'CONTATO', texto: 'Boa, obrigado!', criadoEm: minutosAtras(40) },
      ] },
    },
  })

  await prisma.assistenteConversa.create({
    data: {
      assistenteId, tipo: 'LEAD', nomeContato: 'Marcos Vinícius', numeroContato: '+55 91 98212-4471',
      status: 'QUALIFICADO', ultimaMensagemEm: minutosAtras(18),
      mensagens: { create: [
        { remetente: 'CONTATO', texto: 'Oi, vi o anúncio da Pop 110 0km, ainda tem disponível?', criadoEm: minutosAtras(25) },
        { remetente: 'ASSISTENTE', texto: 'Oi, Marcos! Tudo bem? Temos sim 👍 Pra eu já te passar as condições certas: você pretende dar entrada ou parcelar o valor cheio?', criadoEm: minutosAtras(24) },
        { remetente: 'CONTATO', texto: 'Consigo dar uns 3 mil de entrada', criadoEm: minutosAtras(22) },
        { remetente: 'ASSISTENTE', texto: 'Perfeito, com 3 mil de entrada as parcelas ficam bem mais em conta. Você já tem CPF aprovado em alguma financeira ou prefere que a gente já consulte por aqui mesmo?', criadoEm: minutosAtras(21) },
        { remetente: 'CONTATO', texto: 'Pode consultar sim', criadoEm: minutosAtras(19) },
        { remetente: 'ASSISTENTE', texto: 'Show! Já te encaminhei pro vendedor com todos esses detalhes — ele deve te chamar em instantes pra fechar e agendar a retirada. 🏍️', criadoEm: minutosAtras(18) },
      ] },
    },
  })

  await prisma.assistenteConversa.create({
    data: {
      assistenteId, tipo: 'LEAD', nomeContato: 'Fernanda Rocha', numeroContato: '+55 91 99187-0325',
      status: 'ATIVA', ultimaMensagemEm: minutosAtras(6),
      mensagens: { create: [
        { remetente: 'CONTATO', texto: 'Boa tarde, gostaria de saber sobre a CB 300', criadoEm: minutosAtras(9) },
        { remetente: 'ASSISTENTE', texto: 'Boa tarde, Fernanda! Com certeza te ajudo. Essa moto seria pra uso no dia a dia ou você já trabalha com ela (app, entregas etc.)?', criadoEm: minutosAtras(8) },
        { remetente: 'CONTATO', texto: 'É mais pro dia a dia mesmo, trabalho e lazer', criadoEm: minutosAtras(6) },
      ] },
    },
  })
}

// ============ REUNIÕES E ANOTAÇÕES ============
// Bloco pessoal do usuário logado — reuniões/aulas/vídeos que ele quer
// manter registrados, com transcrição (por enquanto digitada/colada à mão;
// o campo já existe pronto pra receber texto de uma transcrição automática
// por IA quando essa integração for feita) e anotações livres, soltas ou
// vinculadas a uma reunião. Estritamente privado por identidade logada —
// mesmo o dono não vê o bloco pessoal de um vendedor, e vice-versa.

const TIPOS_REUNIAO = ['REUNIAO', 'AULA', 'VIDEO', 'OUTRO'] as const
const CATEGORIAS_NOTA = ['TRABALHO', 'IDEIA', 'APRENDIZADO', 'OUTRO'] as const

function reuniaoWhereBase(req: Request): { usuarioId: string; vendedorId: string | null } {
  const usuarioId = req.proLaboreUser!.sub
  const vendedorId = req.proLaboreUser!.papel === 'DONO' ? null : req.proLaboreUser!.vendedorId!
  return { usuarioId, vendedorId }
}

router.get('/reunioes', requireProLaboreAuth, async (req: Request, res: Response) => {
  const { tipo } = req.query
  const reunioes = await prisma.reuniao.findMany({
    where: { ...reuniaoWhereBase(req), ...(typeof tipo === 'string' && (TIPOS_REUNIAO as readonly string[]).includes(tipo) ? { tipo } : {}) },
    include: { _count: { select: { notas: true } } },
    orderBy: { data: 'desc' },
  })
  res.json(reunioes.map(r => ({
    id: r.id, titulo: r.titulo, tipo: r.tipo, data: r.data, duracaoSegundos: r.duracaoSegundos,
    nomeArquivoOriginal: r.nomeArquivoOriginal, temTranscricao: !!r.transcricao, quantidadeNotas: r._count.notas,
  })))
})

const reuniaoSchema = z.object({
  titulo: z.string().trim().min(1, 'Título não pode ser vazio').max(200, 'Título muito longo'),
  tipo: z.enum(TIPOS_REUNIAO).optional(),
  data: z.string().datetime().optional(),
  duracaoSegundos: z.number().int().nonnegative().optional(),
  nomeArquivoOriginal: z.string().max(255).optional(),
  transcricao: z.string().max(50000, 'Transcrição muito longa').optional(),
})

router.post('/reunioes', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = reuniaoSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const reuniao = await prisma.reuniao.create({
    data: { ...reuniaoWhereBase(req), ...parse.data, data: parse.data.data ? new Date(parse.data.data) : undefined },
  })
  res.status(201).json(reuniao)
})

router.get('/reunioes/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const reuniao = await prisma.reuniao.findFirst({
    where: { id: String(req.params.id), ...reuniaoWhereBase(req) },
    include: { notas: { orderBy: { criadoEm: 'asc' } } },
  })
  if (!reuniao) { res.status(404).json({ error: 'Reunião não encontrada' }); return }
  res.json(reuniao)
})

router.patch('/reunioes/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = reuniaoSchema.partial().safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const existente = await prisma.reuniao.findFirst({ where: { id: String(req.params.id), ...reuniaoWhereBase(req) } })
  if (!existente) { res.status(404).json({ error: 'Reunião não encontrada' }); return }
  const atualizada = await prisma.reuniao.update({
    where: { id: existente.id },
    data: { ...parse.data, data: parse.data.data ? new Date(parse.data.data) : undefined },
  })
  res.json(atualizada)
})

router.delete('/reunioes/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const existente = await prisma.reuniao.findFirst({ where: { id: String(req.params.id), ...reuniaoWhereBase(req) } })
  if (!existente) { res.status(404).json({ error: 'Reunião não encontrada' }); return }
  await prisma.reuniao.delete({ where: { id: existente.id } })
  res.json({ ok: true })
})

router.get('/notas', requireProLaboreAuth, async (req: Request, res: Response) => {
  const { reuniaoId, categoria, pastaId } = req.query
  const notas = await prisma.nota.findMany({
    where: {
      ...reuniaoWhereBase(req),
      reuniaoId: typeof reuniaoId === 'string' ? reuniaoId : null,
      // Sem o parâmetro = sem filtro de pasta (uso antigo, lista tudo).
      // Com o parâmetro presente (mesmo vazio) = filtra por aquela pasta
      // exata, "" virando null (nível raiz) — é como a tela de Anotações
      // navega pasta por pasta.
      ...(typeof pastaId === 'string' ? { pastaId: pastaId || null } : {}),
      ...(typeof categoria === 'string' && (CATEGORIAS_NOTA as readonly string[]).includes(categoria) ? { categoria } : {}),
    },
    orderBy: { criadoEm: 'desc' },
  })
  res.json(notas)
})

// Tipos de bloco do EditorBlocos (frontend) — ver comentário do campo
// Nota.blocos no schema. Validado de forma solta (zod não força a coerência
// tipo/marcado — quem faz isso é o editor), só protegendo tamanho.
const TIPOS_BLOCO = ['paragrafo', 'titulo1', 'titulo2', 'titulo3', 'lista', 'lista_numerada', 'checkbox', 'citacao', 'codigo', 'divisor'] as const
const blocoSchema = z.object({
  id: z.string(),
  tipo: z.enum(TIPOS_BLOCO),
  texto: z.string().max(5000, 'Bloco muito longo'),
  marcado: z.boolean().optional(),
})

const notaSchema = z.object({
  titulo: z.string().trim().max(200, 'Título muito longo').optional(),
  conteudo: z.string().max(20000, 'Conteúdo muito longo').optional(),
  blocos: z.array(blocoSchema).max(1000, 'Página com blocos demais').optional(),
  icone: z.string().max(8, 'Ícone inválido').nullable().optional(),
  categoria: z.enum(CATEGORIAS_NOTA).optional(),
  reuniaoId: z.string().optional(),
  pastaId: z.string().nullable().optional(),
})

async function validarPastaDoUsuario(req: Request, pastaId: string): Promise<boolean> {
  const pasta = await prisma.pasta.findFirst({ where: { id: pastaId, ...reuniaoWhereBase(req) } })
  return !!pasta
}

router.post('/notas', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = notaSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  if (parse.data.reuniaoId) {
    const reuniao = await prisma.reuniao.findFirst({ where: { id: parse.data.reuniaoId, ...reuniaoWhereBase(req) } })
    if (!reuniao) { res.status(404).json({ error: 'Reunião não encontrada' }); return }
  }
  if (parse.data.pastaId && !(await validarPastaDoUsuario(req, parse.data.pastaId))) {
    res.status(404).json({ error: 'Pasta não encontrada' }); return
  }
  const nota = await prisma.nota.create({ data: { ...reuniaoWhereBase(req), ...parse.data, conteudo: parse.data.conteudo ?? '' } })
  res.status(201).json(nota)
})

router.patch('/notas/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = notaSchema.omit({ reuniaoId: true }).partial().safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  if (parse.data.pastaId && !(await validarPastaDoUsuario(req, parse.data.pastaId))) {
    res.status(404).json({ error: 'Pasta não encontrada' }); return
  }
  const existente = await prisma.nota.findFirst({ where: { id: String(req.params.id), ...reuniaoWhereBase(req) } })
  if (!existente) { res.status(404).json({ error: 'Nota não encontrada' }); return }
  const atualizada = await prisma.nota.update({ where: { id: existente.id }, data: parse.data })
  res.json(atualizada)
})

router.delete('/notas/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const existente = await prisma.nota.findFirst({ where: { id: String(req.params.id), ...reuniaoWhereBase(req) } })
  if (!existente) { res.status(404).json({ error: 'Nota não encontrada' }); return }
  await prisma.nota.delete({ where: { id: existente.id } })
  res.json({ ok: true })
})

// --- Pastas: organização em árvore das Anotações (departamento, módulo,
// pasta, subpasta — é tudo o mesmo conceito de container aninhável). Volta
// sempre a lista inteira e achatada (ver comentário do modelo Pasta) —
// dá pra montar a árvore/breadcrumb no cliente sem N chamadas.
router.get('/pastas', requireProLaboreAuth, async (req: Request, res: Response) => {
  const pastas = await prisma.pasta.findMany({ where: reuniaoWhereBase(req), orderBy: { nome: 'asc' } })
  res.json(pastas)
})

const pastaSchema = z.object({
  nome: z.string().trim().min(1, 'Nome não pode ser vazio').max(100, 'Nome muito longo'),
  icone: z.string().max(8, 'Ícone inválido').nullable().optional(),
  paiId: z.string().nullable().optional(),
})

router.post('/pastas', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = pastaSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  if (parse.data.paiId && !(await validarPastaDoUsuario(req, parse.data.paiId))) {
    res.status(404).json({ error: 'Pasta pai não encontrada' }); return
  }
  const pasta = await prisma.pasta.create({ data: { ...reuniaoWhereBase(req), ...parse.data } })
  res.status(201).json(pasta)
})

router.patch('/pastas/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = pastaSchema.partial().safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const existente = await prisma.pasta.findFirst({ where: { id: String(req.params.id), ...reuniaoWhereBase(req) } })
  if (!existente) { res.status(404).json({ error: 'Pasta não encontrada' }); return }
  if (parse.data.paiId) {
    if (parse.data.paiId === existente.id) { res.status(400).json({ error: 'Uma pasta não pode ser pai dela mesma' }); return }
    if (!(await validarPastaDoUsuario(req, parse.data.paiId))) { res.status(404).json({ error: 'Pasta pai não encontrada' }); return }
  }
  const atualizada = await prisma.pasta.update({ where: { id: existente.id }, data: parse.data })
  res.json(atualizada)
})

router.delete('/pastas/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const existente = await prisma.pasta.findFirst({ where: { id: String(req.params.id), ...reuniaoWhereBase(req) } })
  if (!existente) { res.status(404).json({ error: 'Pasta não encontrada' }); return }
  // Subpastas e notas soltam pro nível de cima (paiId/pastaId -> null),
  // nunca são apagadas junto — ver comentário do modelo Pasta.
  await prisma.pasta.delete({ where: { id: existente.id } })
  res.json({ ok: true })
})

// --- Mapas mentais / board: outro "tipo de página" dentro da mesma árvore
// de Anotações (mora dentro de uma Pasta como uma Nota). `raiz` é o formato
// legado (árvore recursiva de nós, só mapa mental puro) — mantido só pra
// mapas antigos nunca reabertos ainda no formato novo, nunca mais escrito
// pelo backend. O formato atual é plano: `objetos` (qualquer forma/nó no
// canvas) + `conectores` (ligação entre dois objetos quaisquer, não só
// pai→filho), validados de forma solta como os blocos do EditorBlocos — só
// protegem tamanho/quantidade, não impõem a coerência tipo/conteúdo (quem
// faz isso é o frontend, MapaMental.tsx via @xyflow/react).
interface NoMapaInput { id: string; texto: string; x: number; y: number; filhos: NoMapaInput[] }
const noMapaSchema: z.ZodType<NoMapaInput> = z.lazy(() => z.object({
  id: z.string(),
  texto: z.string().max(300, 'Texto do nó muito longo'),
  x: z.number(),
  y: z.number(),
  filhos: z.array(noMapaSchema).max(40, 'Muitos nós filhos'),
}))

function criarNoMapaPadrao(texto: string): NoMapaInput {
  return { id: 'raiz', texto, x: 0, y: 0, filhos: [] }
}

const TIPOS_OBJETO_BOARD = [
  'noMapa', 'forma', 'sticky', 'texto', 'icone', 'secao', 'tabela',
  'desenho', 'frame', 'botao', 'inputWireframe', 'avatar', 'pilha', 'tarefa',
] as const
const boardObjetoSchema = z.object({
  id: z.string(),
  tipo: z.enum(TIPOS_OBJETO_BOARD),
  x: z.number(),
  y: z.number(),
  largura: z.number().optional(),
  altura: z.number().optional(),
  travado: z.boolean().optional(),
  zIndex: z.number().optional(),
  estilo: z.record(z.string(), z.unknown()).optional(),
  conteudo: z.record(z.string(), z.unknown()),
  // Limite bem mais alto que os outros tipos de objeto por causa do
  // desenho à mão livre — um traço razoável já tem centenas de pontos
  // {x,y}, cada um uns 20-30 caracteres de JSON.
}).refine(o => JSON.stringify(o).length <= 40000, 'Objeto do board muito grande')

const boardConectorSchema = z.object({
  id: z.string(),
  origemId: z.string(),
  destinoId: z.string(),
  estilo: z.record(z.string(), z.unknown()).optional(),
  label: z.string().max(200, 'Label do conector muito longo').optional(),
})

function criarBoardPadrao(texto: string) {
  const idCentral = 'central'
  return {
    objetos: [{ id: idCentral, tipo: 'noMapa' as const, x: 0, y: 0, conteudo: { texto, ehCentral: true } }],
    conectores: [] as unknown[],
  }
}

router.get('/mapas-mentais', requireProLaboreAuth, async (req: Request, res: Response) => {
  const { pastaId } = req.query
  const mapas = await prisma.mapaMental.findMany({
    where: {
      ...reuniaoWhereBase(req),
      // Mesma convenção de /notas: sem o parâmetro = sem filtro (lista tudo,
      // uso da árvore da sidebar); com o parâmetro = filtra por aquela pasta.
      ...(typeof pastaId === 'string' ? { pastaId: pastaId || null } : {}),
    },
    orderBy: { criadoEm: 'desc' },
  })
  res.json(mapas)
})

const mapaMentalSchema = z.object({
  titulo: z.string().trim().max(200, 'Título muito longo').optional(),
  icone: z.string().max(8, 'Ícone inválido').nullable().optional(),
  raiz: noMapaSchema.optional(),
  objetos: z.array(boardObjetoSchema).max(500, 'Board com objetos demais').optional(),
  conectores: z.array(boardConectorSchema).max(1000, 'Board com conectores demais').optional(),
  pastaId: z.string().nullable().optional(),
})

router.post('/mapas-mentais', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = mapaMentalSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  if (parse.data.pastaId && !(await validarPastaDoUsuario(req, parse.data.pastaId))) {
    res.status(404).json({ error: 'Pasta não encontrada' }); return
  }
  const { raiz, objetos, conectores, ...resto } = parse.data
  const padrao = objetos ? null : criarBoardPadrao('Ideia central')
  const mapa = await prisma.mapaMental.create({
    data: {
      ...reuniaoWhereBase(req), ...resto,
      objetos: (objetos ?? padrao?.objetos) as unknown as Prisma.InputJsonValue,
      conectores: (conectores ?? padrao?.conectores) as unknown as Prisma.InputJsonValue,
      ...(raiz ? { raiz: raiz as unknown as Prisma.InputJsonValue } : {}),
    },
  })
  res.status(201).json(mapa)
})

router.patch('/mapas-mentais/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = mapaMentalSchema.partial().safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  if (parse.data.pastaId && !(await validarPastaDoUsuario(req, parse.data.pastaId))) {
    res.status(404).json({ error: 'Pasta não encontrada' }); return
  }
  const existente = await prisma.mapaMental.findFirst({ where: { id: String(req.params.id), ...reuniaoWhereBase(req) } })
  if (!existente) { res.status(404).json({ error: 'Mapa mental não encontrado' }); return }
  const { raiz, objetos, conectores, ...resto } = parse.data
  const atualizado = await prisma.mapaMental.update({
    where: { id: existente.id },
    data: {
      ...resto,
      ...(raiz ? { raiz: raiz as unknown as Prisma.InputJsonValue } : {}),
      ...(objetos ? { objetos: objetos as unknown as Prisma.InputJsonValue } : {}),
      ...(conectores ? { conectores: conectores as unknown as Prisma.InputJsonValue } : {}),
    },
  })
  res.json(atualizado)
})

router.delete('/mapas-mentais/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const existente = await prisma.mapaMental.findFirst({ where: { id: String(req.params.id), ...reuniaoWhereBase(req) } })
  if (!existente) { res.status(404).json({ error: 'Mapa mental não encontrado' }); return }
  await prisma.mapaMental.delete({ where: { id: existente.id } })
  res.json({ ok: true })
})

export default router
