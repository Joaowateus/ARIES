import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { signProLaboreToken } from '../lib/jwtProLabore'
import { requireProLaboreAuth } from '../middleware/authProLabore'

const router = Router()

const TETO_PRO_LABORE_PADRAO = 900

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function primeiroDiaDoMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), 1)
}

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

// --- Vendedores ---

router.get('/vendedores', requireProLaboreAuth, async (req: Request, res: Response) => {
  const vendedores = await prisma.vendedor.findMany({
    where: { usuarioId: req.proLaboreUser!.sub },
    orderBy: { nome: 'asc' },
  })
  res.json(vendedores)
})

const criarVendedorSchema = z.object({
  nome: z.string().min(2, 'Nome muito curto'),
})

router.post('/vendedores', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = criarVendedorSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const vendedor = await prisma.vendedor.create({
    data: { usuarioId: req.proLaboreUser!.sub, nome: parse.data.nome },
  })
  res.status(201).json(vendedor)
})

const editarVendedorSchema = z.object({
  nome: z.string().min(2).optional(),
  ativo: z.boolean().optional(),
})

router.patch('/vendedores/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
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
  const vendedor = await prisma.vendedor.update({ where: { id: atual.id }, data: parse.data })
  res.json(vendedor)
})

router.delete('/vendedores/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.vendedor.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Vendedor não encontrado' })
    return
  }
  await prisma.vendedor.delete({ where: { id: atual.id } })
  res.json({ ok: true })
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
  const { valorVenda, valorProLabore, vendedorId } = parse.data

  if (vendedorId) {
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
  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.venda.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Venda não encontrada' })
    return
  }
  await prisma.venda.delete({ where: { id: atual.id } })
  res.json({ ok: true })
})

// --- Funil comercial mensal (cadastro manual) ---

router.get('/funil', requireProLaboreAuth, async (req: Request, res: Response) => {
  const { ano } = req.query
  const usuarioId = req.proLaboreUser!.sub
  const anoNum = typeof ano === 'string' && /^\d{4}$/.test(ano) ? Number(ano) : new Date().getFullYear()
  const registros = await prisma.funilMensal.findMany({
    where: { usuarioId, mesReferencia: { gte: new Date(anoNum, 0, 1), lte: new Date(anoNum, 11, 31) } },
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

router.put('/funil', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = funilSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const mesReferencia = primeiroDiaDoMes(new Date(parse.data.mesReferencia))
  const { leads, abordados, negociacao, proposta } = parse.data

  const registro = await prisma.funilMensal.upsert({
    where: { usuarioId_mesReferencia: { usuarioId, mesReferencia } },
    update: { leads, abordados, negociacao, proposta },
    create: { usuarioId, mesReferencia, leads, abordados, negociacao, proposta },
  })
  res.json(registro)
})

// --- Gasto com anúncios mensal (cadastro manual) ---

router.get('/gastos-anuncios', requireProLaboreAuth, async (req: Request, res: Response) => {
  const { ano } = req.query
  const usuarioId = req.proLaboreUser!.sub
  const anoNum = typeof ano === 'string' && /^\d{4}$/.test(ano) ? Number(ano) : new Date().getFullYear()
  const registros = await prisma.gastoAnuncioMensal.findMany({
    where: { usuarioId, mesReferencia: { gte: new Date(anoNum, 0, 1), lte: new Date(anoNum, 11, 31) } },
    orderBy: { mesReferencia: 'asc' },
  })
  res.json(registros)
})

const gastoAnuncioSchema = z.object({
  mesReferencia: z.string().min(1, 'Mês de referência obrigatório'),
  valor: z.number().min(0),
})

router.put('/gastos-anuncios', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = gastoAnuncioSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const mesReferencia = primeiroDiaDoMes(new Date(parse.data.mesReferencia))
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
  const agora = new Date()
  const { ano } = req.query
  const anoNum = typeof ano === 'string' && /^\d{4}$/.test(ano) ? Number(ano) : agora.getFullYear()
  const ultimoMes = anoNum === agora.getFullYear() ? agora.getMonth() : 11

  const inicioAno = new Date(anoNum, 0, 1)
  const fimAno = new Date(anoNum, 11, 31, 23, 59, 59)

  const [vendas, funilRegistros, gastosRegistros, vendedores] = await Promise.all([
    prisma.venda.findMany({
      where: { usuarioId, data: { gte: inicioAno, lte: fimAno } },
      include: { vendedor: { select: { id: true, nome: true } } },
    }),
    prisma.funilMensal.findMany({ where: { usuarioId, mesReferencia: { gte: inicioAno, lte: fimAno } } }),
    prisma.gastoAnuncioMensal.findMany({ where: { usuarioId, mesReferencia: { gte: inicioAno, lte: fimAno } } }),
    prisma.vendedor.findMany({ where: { usuarioId } }),
  ])

  const vendedorPorId = new Map(vendedores.map(v => [v.id, v]))

  const meses = MESES_LABEL.slice(0, ultimoMes + 1).map((label, mes) => {
    const vendasDoMes = vendas.filter(v => v.data.getMonth() === mes)
    const receita = vendasDoMes.reduce((s, v) => s + v.valorVenda, 0)
    const proLaboreSacado = vendasDoMes.reduce((s, v) => s + v.valorProLabore, 0)
    const quantidadeVendas = vendasDoMes.length
    const ticketMedio = quantidadeVendas > 0 ? receita / quantidadeVendas : 0

    const funilRegistro = funilRegistros.find(f => f.mesReferencia.getMonth() === mes)
    const gastoRegistro = gastosRegistros.find(g => g.mesReferencia.getMonth() === mes)
    const gastoAnuncios = gastoRegistro?.valor ?? 0
    const roas = gastoAnuncios > 0 ? receita / gastoAnuncios : 0
    const cac = gastoAnuncios > 0 && quantidadeVendas > 0 ? gastoAnuncios / quantidadeVendas : 0

    const leads = funilRegistro?.leads ?? 0
    const funil = {
      leads,
      abordados: funilRegistro?.abordados ?? 0,
      negociacao: funilRegistro?.negociacao ?? 0,
      proposta: funilRegistro?.proposta ?? 0,
      fechamento: quantidadeVendas,
    }
    const conversaoLeadVenda = leads > 0 ? (quantidadeVendas / leads) * 100 : 0

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
    const rankingVendedores = [...porVendedor.values()].sort((a, b) => b.receita - a.receita)

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
