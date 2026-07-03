import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = Router()

const ESTAGIOS = ['NOVO_LEAD', 'CONTATO', 'VISITA_AGENDADA', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO'] as const

const criarSchema = z.object({
  nomeCliente: z.string().min(2),
  telefone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  produtoId: z.string().optional(),
  responsavelId: z.string().optional(),
  origem: z.string().default('MANUAL'),
  valor: z.number().positive().optional(),
  observacoes: z.string().optional(),
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const estagio = typeof req.query.estagio === 'string' ? req.query.estagio : undefined
  const responsavelId = typeof req.query.responsavelId === 'string' ? req.query.responsavelId : undefined
  const oportunidades = await prisma.oportunidade.findMany({
    where: {
      empresaId: req.user!.empresaId,
      ...(estagio ? { estagio } : {}),
      ...(responsavelId ? { responsavelId } : {}),
    },
    include: {
      responsavel: { select: { id: true, nome: true } },
      produto: { select: { id: true, nome: true, marca: true, modelo: true } },
    },
    orderBy: { atualizadaEm: 'desc' },
  })
  res.json(oportunidades)
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parse = criarSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const data = parse.data
  const oportunidade = await prisma.oportunidade.create({
    data: {
      ...data,
      email: data.email || undefined,
      empresaId: req.user!.empresaId,
      responsavelId: data.responsavelId ?? req.user!.sub,
      estagio: 'NOVO_LEAD',
    },
    include: {
      responsavel: { select: { id: true, nome: true } },
      produto: { select: { id: true, nome: true } },
    },
  })
  res.status(201).json(oportunidade)
})

router.patch('/:id/estagio', requireAuth, async (req: Request, res: Response) => {
  const { estagio } = req.body
  if (!ESTAGIOS.includes(estagio)) {
    res.status(400).json({ error: 'Estágio inválido' })
    return
  }

  const oportunidade = await prisma.oportunidade.findFirst({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
  })
  if (!oportunidade) {
    res.status(404).json({ error: 'Oportunidade não encontrada' })
    return
  }

  const fechadaEm = ['GANHO', 'PERDIDO'].includes(estagio) ? new Date() : null
  const statusFinal = ['GANHO', 'PERDIDO'].includes(estagio) ? estagio : null

  const atualizada = await prisma.oportunidade.update({
    where: { id: String(req.params.id) },
    data: { estagio, fechadaEm, statusFinal },
    include: {
      responsavel: { select: { id: true, nome: true } },
      produto: { select: { id: true, nome: true } },
    },
  })
  res.json(atualizada)
})

router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const parse = criarSchema.partial().safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const atualizada = await prisma.oportunidade.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    data: parse.data,
  })
  if (!atualizada.count) {
    res.status(404).json({ error: 'Oportunidade não encontrada' })
    return
  }
  res.json({ ok: true })
})

export default router
