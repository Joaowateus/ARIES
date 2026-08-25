import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { signProLaboreToken } from '../lib/jwtProLabore'
import { requireProLaboreAuth } from '../middleware/authProLabore'

const router = Router()

const PARAMETROS_PADRAO = {
  percentualImpostos: 0.06,
  percentualCustosOperacionais: 0.15,
  percentualReservaCaixa: 0.10,
}

function segundaFeiraDaSemana(data: Date): Date {
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate())
  const dia = d.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + diff)
  return d
}

function calcularLiquido(valorBruto: number, parametro: { percentualImpostos: number; percentualCustosOperacionais: number; percentualReservaCaixa: number }) {
  const percentualRetido = parametro.percentualImpostos + parametro.percentualCustosOperacionais + parametro.percentualReservaCaixa
  const valorLiquido = Math.round(valorBruto * (1 - percentualRetido) * 100) / 100
  return { valorLiquido, percentualRetido }
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
      parametro: { create: PARAMETROS_PADRAO },
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
    create: { usuarioId: req.proLaboreUser!.sub, ...PARAMETROS_PADRAO },
  })
  res.json(parametro)
})

const parametrosSchema = z.object({
  percentualImpostos: z.number().min(0).max(1).optional(),
  percentualCustosOperacionais: z.number().min(0).max(1).optional(),
  percentualReservaCaixa: z.number().min(0).max(1).optional(),
})

router.put('/parametros', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = parametrosSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const atual = await prisma.parametroLiquidez.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  const mesclado = {
    percentualImpostos: parse.data.percentualImpostos ?? atual?.percentualImpostos ?? PARAMETROS_PADRAO.percentualImpostos,
    percentualCustosOperacionais: parse.data.percentualCustosOperacionais ?? atual?.percentualCustosOperacionais ?? PARAMETROS_PADRAO.percentualCustosOperacionais,
    percentualReservaCaixa: parse.data.percentualReservaCaixa ?? atual?.percentualReservaCaixa ?? PARAMETROS_PADRAO.percentualReservaCaixa,
  }
  const somaTotal = mesclado.percentualImpostos + mesclado.percentualCustosOperacionais + mesclado.percentualReservaCaixa
  if (somaTotal > 1) {
    res.status(400).json({ error: 'A soma dos percentuais não pode ultrapassar 100%' })
    return
  }

  const parametro = await prisma.parametroLiquidez.upsert({
    where: { usuarioId: req.proLaboreUser!.sub },
    update: parse.data,
    create: { usuarioId: req.proLaboreUser!.sub, ...PARAMETROS_PADRAO, ...parse.data },
  })
  res.json(parametro)
})

// --- Lançamentos semanais de faturamento ---

router.get('/faturamentos', requireProLaboreAuth, async (req: Request, res: Response) => {
  const { ano } = req.query
  const where: { usuarioId: string; referenciaSemana?: { gte: Date; lte: Date } } = { usuarioId: req.proLaboreUser!.sub }
  if (typeof ano === 'string' && /^\d{4}$/.test(ano)) {
    where.referenciaSemana = { gte: new Date(Number(ano), 0, 1), lte: new Date(Number(ano), 11, 31) }
  }

  const faturamentos = await prisma.faturamentoSemanal.findMany({
    where,
    orderBy: { referenciaSemana: 'desc' },
  })
  res.json(faturamentos)
})

const criarFaturamentoSchema = z.object({
  data: z.string().min(1, 'Data obrigatória'),
  valorBruto: z.number().positive('Valor deve ser positivo'),
  observacao: z.string().optional(),
})

router.post('/faturamentos', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = criarFaturamentoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const usuarioId = req.proLaboreUser!.sub
  const referenciaSemana = segundaFeiraDaSemana(new Date(parse.data.data))

  const parametro = await prisma.parametroLiquidez.upsert({
    where: { usuarioId },
    update: {},
    create: { usuarioId, ...PARAMETROS_PADRAO },
  })

  const { valorLiquido } = calcularLiquido(parse.data.valorBruto, parametro)

  const existente = await prisma.faturamentoSemanal.findUnique({
    where: { usuarioId_referenciaSemana: { usuarioId, referenciaSemana } },
  })
  if (existente) {
    res.status(409).json({ error: 'Já existe um lançamento para essa semana. Edite o lançamento existente.' })
    return
  }

  const faturamento = await prisma.faturamentoSemanal.create({
    data: {
      usuarioId,
      referenciaSemana,
      valorBruto: parse.data.valorBruto,
      percentualImpostosAplicado: parametro.percentualImpostos,
      percentualCustosAplicado: parametro.percentualCustosOperacionais,
      percentualReservaAplicado: parametro.percentualReservaCaixa,
      valorLiquido,
      observacao: parse.data.observacao,
    },
  })
  res.status(201).json(faturamento)
})

const editarFaturamentoSchema = z.object({
  valorBruto: z.number().positive().optional(),
  observacao: z.string().optional(),
})

router.patch('/faturamentos/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = editarFaturamentoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.faturamentoSemanal.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Lançamento não encontrado' })
    return
  }

  const valorBruto = parse.data.valorBruto ?? atual.valorBruto
  const { valorLiquido } = calcularLiquido(valorBruto, {
    percentualImpostos: atual.percentualImpostosAplicado,
    percentualCustosOperacionais: atual.percentualCustosAplicado,
    percentualReservaCaixa: atual.percentualReservaAplicado,
  })

  const faturamento = await prisma.faturamentoSemanal.update({
    where: { id: atual.id },
    data: { valorBruto, valorLiquido, observacao: parse.data.observacao ?? atual.observacao },
  })
  res.json(faturamento)
})

router.delete('/faturamentos/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.faturamentoSemanal.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) {
    res.status(404).json({ error: 'Lançamento não encontrado' })
    return
  }
  await prisma.faturamentoSemanal.delete({ where: { id: atual.id } })
  res.json({ ok: true })
})

// --- Dashboard de liquidez ---

router.get('/resumo', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const agora = new Date()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const inicioAno = new Date(agora.getFullYear(), 0, 1)
  const semanaAtualRef = segundaFeiraDaSemana(agora)

  const [semanaAtual, doMes, doAno, ultimasSemanas] = await Promise.all([
    prisma.faturamentoSemanal.findUnique({ where: { usuarioId_referenciaSemana: { usuarioId, referenciaSemana: semanaAtualRef } } }),
    prisma.faturamentoSemanal.findMany({ where: { usuarioId, referenciaSemana: { gte: inicioMes } } }),
    prisma.faturamentoSemanal.findMany({ where: { usuarioId, referenciaSemana: { gte: inicioAno } }, select: { valorBruto: true, valorLiquido: true } }),
    prisma.faturamentoSemanal.findMany({
      where: { usuarioId },
      orderBy: { referenciaSemana: 'desc' },
      take: 12,
      select: { referenciaSemana: true, valorBruto: true, valorLiquido: true },
    }),
  ])

  const brutoMes = doMes.reduce((s, f) => s + f.valorBruto, 0)
  const liquidoMes = doMes.reduce((s, f) => s + f.valorLiquido, 0)
  const brutoAno = doAno.reduce((s, f) => s + f.valorBruto, 0)
  const liquidoAno = doAno.reduce((s, f) => s + f.valorLiquido, 0)

  res.json({
    semanaAtual: semanaAtual
      ? { referenciaSemana: semanaAtual.referenciaSemana, valorBruto: semanaAtual.valorBruto, valorLiquido: semanaAtual.valorLiquido }
      : null,
    mes: {
      bruto: brutoMes,
      liquido: liquidoMes,
      retido: brutoMes - liquidoMes,
      percentualLiquidezMedio: brutoMes > 0 ? liquidoMes / brutoMes : 0,
    },
    ano: { bruto: brutoAno, liquido: liquidoAno },
    serieSemanal: [...ultimasSemanas].reverse(),
  })
})

export default router
