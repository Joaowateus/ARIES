import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { signProLaboreToken } from '../lib/jwtProLabore'
import { requireProLaboreAuth } from '../middleware/authProLabore'

const router = Router()

const TETO_PRO_LABORE_PADRAO = 900

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// --- Autenticação (usuário único, independente do login multi-tenant do ARIES) ---

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

  const token = signProLaboreToken({ sub: usuario.id, email: usuario.email, nome: usuario.nome })
  res.status(201).json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } })
})

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(1, 'Senha obrigatória'),
})

router.post('/auth/login', async (req: Request, res: Response) => {
  const parse = loginSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const { email, senha } = parse.data
  const usuario = await prisma.proLaboreUsuario.findUnique({ where: { email } })
  if (!usuario) {
    res.status(401).json({ error: 'Email ou senha incorretos' })
    return
  }

  const senhaOk = await bcrypt.compare(senha, usuario.senhaHash)
  if (!senhaOk) {
    res.status(401).json({ error: 'Email ou senha incorretos' })
    return
  }

  const token = signProLaboreToken({ sub: usuario.id, email: usuario.email, nome: usuario.nome })
  res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } })
})

router.get('/auth/me', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuario = await prisma.proLaboreUsuario.findUnique({
    where: { id: req.proLaboreUser!.sub },
    select: { id: true, nome: true, email: true },
  })
  if (!usuario) {
    res.status(404).json({ error: 'Usuário não encontrado' })
    return
  }
  res.json(usuario)
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
  tetoProLaborePorVenda: z.number().positive('Teto deve ser positivo'),
})

router.put('/parametros', requireProLaboreAuth, async (req: Request, res: Response) => {
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

// --- Vendas ---

router.get('/vendas', requireProLaboreAuth, async (req: Request, res: Response) => {
  const { ano } = req.query
  const where: { usuarioId: string; data?: { gte: Date; lte: Date } } = { usuarioId: req.proLaboreUser!.sub }
  if (typeof ano === 'string' && /^\d{4}$/.test(ano)) {
    where.data = { gte: new Date(Number(ano), 0, 1), lte: new Date(Number(ano), 11, 31) }
  }

  const vendas = await prisma.venda.findMany({
    where,
    orderBy: { data: 'desc' },
  })
  res.json(vendas)
})

const criarVendaSchema = z.object({
  data: z.string().min(1, 'Data obrigatória'),
  valorVenda: z.number().positive('Valor da venda deve ser positivo'),
  valorProLabore: z.number().positive('Valor de pró-labore deve ser positivo'),
  observacao: z.string().optional(),
})

router.post('/vendas', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = criarVendaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const usuarioId = req.proLaboreUser!.sub
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
      data: new Date(parse.data.data),
      valorVenda,
      valorProLabore,
      observacao: parse.data.observacao,
    },
  })
  res.status(201).json(venda)
})

const editarVendaSchema = z.object({
  valorVenda: z.number().positive().optional(),
  valorProLabore: z.number().positive().optional(),
  observacao: z.string().optional(),
})

router.patch('/vendas/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
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
    data: { valorVenda, valorProLabore, observacao: parse.data.observacao ?? atual.observacao },
  })
  res.json(venda)
})

router.delete('/vendas/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.venda.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Venda não encontrada' })
    return
  }
  await prisma.venda.delete({ where: { id: atual.id } })
  res.json({ ok: true })
})

// --- Dashboard de liquidez ---

router.get('/resumo', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const agora = new Date()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const inicioAno = new Date(agora.getFullYear(), 0, 1)

  const [ultimaVenda, doMes, doAno, ultimasVendas] = await Promise.all([
    prisma.venda.findFirst({ where: { usuarioId }, orderBy: { data: 'desc' } }),
    prisma.venda.findMany({ where: { usuarioId, data: { gte: inicioMes } }, select: { valorVenda: true, valorProLabore: true } }),
    prisma.venda.findMany({ where: { usuarioId, data: { gte: inicioAno } }, select: { data: true, valorVenda: true, valorProLabore: true } }),
    prisma.venda.findMany({ where: { usuarioId }, orderBy: { data: 'desc' }, take: 10 }),
  ])

  const somar = (lista: { valorVenda: number; valorProLabore: number }[], campo: 'valorVenda' | 'valorProLabore') =>
    lista.reduce((s, v) => s + v[campo], 0)

  const valorVendasMes = somar(doMes, 'valorVenda')
  const proLaboreMes = somar(doMes, 'valorProLabore')
  const valorVendasAno = somar(doAno, 'valorVenda')
  const proLaboreAno = somar(doAno, 'valorProLabore')

  const serieMensal = MESES_LABEL.slice(0, agora.getMonth() + 1).map((label, mes) => {
    const doMesReferencia = doAno.filter(v => v.data.getMonth() === mes)
    return {
      mes,
      label,
      quantidadeVendas: doMesReferencia.length,
      valorVendas: somar(doMesReferencia, 'valorVenda'),
      proLaboreSacado: somar(doMesReferencia, 'valorProLabore'),
    }
  })

  res.json({
    ultimaVenda,
    mes: {
      quantidadeVendas: doMes.length,
      valorVendas: valorVendasMes,
      proLaboreSacado: proLaboreMes,
      retidoCaixa: valorVendasMes - proLaboreMes,
      ticketMedio: doMes.length > 0 ? valorVendasMes / doMes.length : 0,
    },
    ano: {
      quantidadeVendas: doAno.length,
      valorVendas: valorVendasAno,
      proLaboreSacado: proLaboreAno,
    },
    serieMensal,
    ultimasVendas,
  })
})

export default router
