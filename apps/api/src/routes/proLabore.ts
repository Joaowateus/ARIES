import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { signProLaboreToken } from '../lib/jwtProLabore'
import { requireProLaboreAuth, requireDono } from '../middleware/authProLabore'

const router = Router()

const TETO_PRO_LABORE_PADRAO = 900

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const VENDEDOR_SELECT = { id: true, nome: true, ativo: true, email: true, criadoEm: true, atualizadoEm: true } as const

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
function vendaWhereBase(req: Request): { usuarioId: string; vendedorId?: string } {
  const usuarioId = req.proLaboreUser!.sub
  if (req.proLaboreUser!.papel === 'VENDEDOR') {
    return { usuarioId, vendedorId: req.proLaboreUser!.vendedorId! }
  }
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
    const token = signProLaboreToken({
      sub: vendedor.usuarioId,
      email: vendedor.email,
      nome: vendedor.nome,
      papel: 'VENDEDOR',
      vendedorId: vendedor.id,
    })
    res.json({ token, usuario: { id: vendedor.id, nome: vendedor.nome, email: vendedor.email, papel: 'VENDEDOR' } })
    return
  }

  res.status(401).json({ error: 'Email ou senha incorretos' })
})

router.get('/auth/me', requireProLaboreAuth, async (req: Request, res: Response) => {
  const { papel, vendedorId, sub } = req.proLaboreUser!

  if (papel === 'VENDEDOR') {
    const vendedor = await prisma.vendedor.findUnique({
      where: { id: vendedorId },
      select: { id: true, nome: true, email: true },
    })
    if (!vendedor || !vendedor.email) {
      res.status(404).json({ error: 'Vendedor não encontrado' })
      return
    }
    res.json({ id: vendedor.id, nome: vendedor.nome, email: vendedor.email, papel: 'VENDEDOR' })
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
  metaFaturamentoAnual: z.number().positive('Meta deve ser positiva').optional(),
  fraseMotivacional: z.string().max(280, 'Frase muito longa').optional(),
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

// --- Vendedores (gestão exclusiva do dono) ---

router.get('/vendedores', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
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

// --- Vendas ---

router.get('/vendas', requireProLaboreAuth, async (req: Request, res: Response) => {
  const { ano } = req.query
  const where: { usuarioId: string; vendedorId?: string; data?: { gte: Date; lte: Date } } = vendaWhereBase(req)
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
  observacao: z.string().optional(),
})

router.post('/vendas', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = criarVendaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const usuarioId = req.proLaboreUser!.sub
  const papel = req.proLaboreUser!.papel
  const { valorVenda, valorProLabore } = parse.data
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

  const parametro = await prisma.parametroLiquidez.upsert({
    where: { usuarioId },
    update: {},
    create: { usuarioId, tetoProLaborePorVenda: TETO_PRO_LABORE_PADRAO },
  })

  if (valorProLabore > parametro.tetoProLaborePorVenda) {
    res.status(400).json({ error: `O pró-labore não pode ultrapassar o teto configurado (${parametro.tetoProLaborePorVenda})` })
    return
  }
  if (valorProLabore > valorVenda) {
    res.status(400).json({ error: 'O pró-labore não pode ser maior que o valor da venda' })
    return
  }

  const venda = await prisma.venda.create({
    data: {
      usuarioId,
      vendedorId,
      data: new Date(parse.data.data),
      valorVenda,
      valorProLabore,
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
  observacao: z.string().optional(),
})

router.patch('/vendas/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = editarVendaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const usuarioId = req.proLaboreUser!.sub
  const papel = req.proLaboreUser!.papel
  const atual = await prisma.venda.findFirst({ where: { id: String(req.params.id), ...vendaWhereBase(req) } })
  if (!atual) {
    res.status(404).json({ error: 'Venda não encontrada' })
    return
  }

  // Vendedor não pode reatribuir a própria venda a outra pessoa.
  if (papel === 'VENDEDOR') {
    delete parse.data.vendedorId
  } else if (parse.data.vendedorId) {
    const vendedor = await prisma.vendedor.findFirst({ where: { id: parse.data.vendedorId, usuarioId } })
    if (!vendedor) {
      res.status(400).json({ error: 'Vendedor não encontrado' })
      return
    }
  }

  const valorVenda = parse.data.valorVenda ?? atual.valorVenda
  const valorProLabore = parse.data.valorProLabore ?? atual.valorProLabore

  const parametro = await prisma.parametroLiquidez.findUnique({ where: { usuarioId } })
  const teto = parametro?.tetoProLaborePorVenda ?? TETO_PRO_LABORE_PADRAO
  if (valorProLabore > teto) {
    res.status(400).json({ error: `O pró-labore não pode ultrapassar o teto configurado (${teto})` })
    return
  }
  if (valorProLabore > valorVenda) {
    res.status(400).json({ error: 'O pró-labore não pode ser maior que o valor da venda' })
    return
  }

  const venda = await prisma.venda.update({
    where: { id: atual.id },
    data: {
      valorVenda,
      valorProLabore,
      vendedorId: parse.data.vendedorId === undefined ? atual.vendedorId : parse.data.vendedorId,
      observacao: parse.data.observacao ?? atual.observacao,
    },
    include: { vendedor: { select: { id: true, nome: true } } },
  })
  res.json(venda)
})

router.delete('/vendas/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const atual = await prisma.venda.findFirst({ where: { id: String(req.params.id), ...vendaWhereBase(req) } })
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

function estagioAtingiu(estagioAtual: string, alvo: (typeof ORDEM_ESTAGIO_LEAD)[number]): boolean {
  if (estagioAtual === 'PERDIDO') return false
  return ORDEM_ESTAGIO_LEAD.indexOf(estagioAtual as (typeof ORDEM_ESTAGIO_LEAD)[number]) >= ORDEM_ESTAGIO_LEAD.indexOf(alvo)
}

const LEAD_INCLUDE = { vendedor: { select: { id: true, nome: true } } } as const

function leadWhereBase(req: Request): { usuarioId: string; vendedorId?: string } {
  const usuarioId = req.proLaboreUser!.sub
  if (req.proLaboreUser!.papel === 'VENDEDOR') {
    return { usuarioId, vendedorId: req.proLaboreUser!.vendedorId! }
  }
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
  observacao: z.string().optional(),
  vendedorId: z.string().optional(),
  tipoLead: z.enum(TIPOS_LEAD).optional(),
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
      observacao: parse.data.observacao,
      tipoLead: parse.data.tipoLead,
    },
    include: LEAD_INCLUDE,
  })
  await prisma.leadEstagioHistorico.create({ data: { leadId: lead.id, estagioAnterior: null, estagioNovo: 'LEAD' } })
  res.status(201).json(lead)
})

const editarLeadSchema = z.object({
  nomeCliente: z.string().min(2).optional(),
  telefone: z.string().optional(),
  observacao: z.string().optional(),
  vendedorId: z.string().nullable().optional(),
  tipoLead: z.enum(TIPOS_LEAD).nullable().optional(),
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

  const data: { nomeCliente?: string; telefone?: string; observacao?: string; vendedorId?: string | null; tipoLead?: string | null } = {
    nomeCliente: parse.data.nomeCliente,
    telefone: parse.data.telefone,
    observacao: parse.data.observacao,
    tipoLead: parse.data.tipoLead,
  }
  // Só o dono pode reatribuir um lead a outro vendedor.
  if (papel === 'DONO' && parse.data.vendedorId !== undefined) {
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
  observacao: z.string().optional(),
})

// Fecha um lead gerando a venda correspondente — é a única forma "oficial"
// de fechamento, pra manter o vínculo lead→venda e não deixar o funil e as
// vendas divergirem. Marcar o estágio como FECHADO manualmente ainda é
// possível (ex: negócio fechado fora da esteira), só não cria a venda.
router.post('/leads/:id/converter', requireProLaboreAuth, async (req: Request, res: Response) => {
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
  const parametro = await prisma.parametroLiquidez.upsert({
    where: { usuarioId },
    update: {},
    create: { usuarioId, tetoProLaborePorVenda: TETO_PRO_LABORE_PADRAO },
  })
  if (valorProLabore > parametro.tetoProLaborePorVenda) {
    res.status(400).json({ error: `O pró-labore não pode ultrapassar o teto configurado (${parametro.tetoProLaborePorVenda})` })
    return
  }
  if (valorProLabore > valorVenda) {
    res.status(400).json({ error: 'O pró-labore não pode ser maior que o valor da venda' })
    return
  }

  const venda = await prisma.venda.create({
    data: {
      usuarioId,
      vendedorId: atual.vendedorId,
      data: new Date(parse.data.data),
      valorVenda,
      valorProLabore,
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
  const { ano } = req.query
  const anoNum = typeof ano === 'string' && /^\d{4}$/.test(ano) ? Number(ano) : agora.getUTCFullYear()
  const ultimoMes = anoNum === agora.getUTCFullYear() ? agora.getUTCMonth() : 11

  const inicioAno = inicioDoAnoUTC(anoNum)
  const fimAno = fimDoAnoUTC(anoNum)

  // Métricas de negócio da operação inteira (gasto com anúncio, ranking por
  // vendedor, funil manual histórico) são visão exclusiva do dono — um
  // vendedor autenticado só enxerga a própria produção.
  const [vendas, funilRegistros, gastosRegistros, vendedores, leads] = await Promise.all([
    prisma.venda.findMany({
      where: { ...vendaWhereBase(req), data: { gte: inicioAno, lte: fimAno } },
      include: { vendedor: { select: { id: true, nome: true } } },
    }),
    papel === 'DONO'
      ? prisma.funilMensal.findMany({ where: { usuarioId, mesReferencia: { gte: inicioAno, lte: fimAno } } })
      : Promise.resolve([]),
    papel === 'DONO'
      ? prisma.gastoAnuncioMensal.findMany({ where: { usuarioId, mesReferencia: { gte: inicioAno, lte: fimAno } } })
      : Promise.resolve([]),
    papel === 'DONO' ? prisma.vendedor.findMany({ where: { usuarioId } }) : Promise.resolve([]),
    prisma.lead.findMany({ where: { ...leadWhereBase(req), criadoEm: { gte: inicioAno, lte: fimAno } } }),
  ])

  const vendedorPorId = new Map(vendedores.map(v => [v.id, v]))

  const meses = MESES_LABEL.slice(0, ultimoMes + 1).map((label, mes) => {
    const vendasDoMes = vendas.filter(v => v.data.getUTCMonth() === mes)
    const receita = vendasDoMes.reduce((s, v) => s + v.valorVenda, 0)
    const proLaboreSacado = vendasDoMes.reduce((s, v) => s + v.valorProLabore, 0)
    const quantidadeVendas = vendasDoMes.length
    const ticketMedio = quantidadeVendas > 0 ? receita / quantidadeVendas : 0

    const gastoRegistro = gastosRegistros.find(g => g.mesReferencia.getUTCMonth() === mes)
    const gastoAnuncios = papel === 'DONO' ? gastoRegistro?.valor ?? 0 : 0
    const roas = gastoAnuncios > 0 ? receita / gastoAnuncios : 0
    const cac = gastoAnuncios > 0 && quantidadeVendas > 0 ? gastoAnuncios / quantidadeVendas : 0

    // Prefere o funil real (Leads) quando existe dado no mês; cai pro
    // cadastro manual (FunilMensal) só em meses anteriores à funcionalidade
    // de Leads, e só pro dono — não há FunilMensal por vendedor.
    const leadsDoMes = leads.filter(l => l.criadoEm.getUTCMonth() === mes)
    const funilRegistro = funilRegistros.find(f => f.mesReferencia.getUTCMonth() === mes)
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

    const rankingVendedores: { id: string; nome: string; quantidadeVendas: number; receita: number; proLaboreSacado: number }[] = []
    if (papel === 'DONO') {
      const porVendedor = new Map<string, { id: string; nome: string; quantidadeVendas: number; receita: number; proLaboreSacado: number }>()
      for (const v of vendasDoMes) {
        if (!v.vendedorId) continue
        const nome = vendedorPorId.get(v.vendedorId)?.nome ?? v.vendedor?.nome ?? 'Sem nome'
        const atual = porVendedor.get(v.vendedorId) ?? { id: v.vendedorId, nome, quantidadeVendas: 0, receita: 0, proLaboreSacado: 0 }
        atual.quantidadeVendas += 1
        atual.receita += v.valorVenda
        atual.proLaboreSacado += v.valorProLabore
        porVendedor.set(v.vendedorId, atual)
      }
      rankingVendedores.push(...[...porVendedor.values()].sort((a, b) => b.receita - a.receita))
    }

    return {
      mes, label, ano: anoNum,
      receita, proLaboreSacado, quantidadeVendas, ticketMedio,
      gastoAnuncios, roas, cac,
      funil, conversaoLeadVenda,
      vendedores: rankingVendedores,
    }
  })

  res.json({ meses })
})

export default router
