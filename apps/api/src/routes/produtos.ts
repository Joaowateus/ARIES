import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requirePapel } from '../middleware/auth'

const router = Router()

const unidadeSchema = z.object({
  nome: z.string().min(2),
  categoria: z.string().default('MOTO'),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  ano: z.number().int().optional(),
  cor: z.string().optional(),
  chassi: z.string().optional(),
  placa: z.string().optional(),
  km: z.number().int().min(0).optional(),
  precoBase: z.number().positive().optional(),
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { situacao } = req.query
  const unidades = await prisma.unidade.findMany({
    where: {
      empresaId: req.user!.empresaId,
      situacao: typeof situacao === 'string' ? situacao : { not: 'INATIVO' },
    },
    orderBy: [{ situacao: 'asc' }, { nome: 'asc' }],
  })
  res.json(unidades)
})

router.post('/', requireAuth, requirePapel('ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL'), async (req: Request, res: Response) => {
  const parse = unidadeSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const unidade = await prisma.unidade.create({
    data: { ...parse.data, empresaId: req.user!.empresaId, situacao: 'DISPONIVEL' },
  })
  res.status(201).json(unidade)
})

router.patch('/:id', requireAuth, requirePapel('ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL'), async (req: Request, res: Response) => {
  const parse = unidadeSchema.partial().safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const unidade = await prisma.unidade.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    data: parse.data,
  })
  if (!unidade.count) {
    res.status(404).json({ error: 'Unidade não encontrada' })
    return
  }
  res.json({ ok: true })
})

router.delete('/:id', requireAuth, requirePapel('ADMINISTRADOR', 'GERENTE_COMERCIAL'), async (req: Request, res: Response) => {
  await prisma.unidade.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    data: { situacao: 'INATIVO' },
  })
  res.json({ ok: true })
})

export default router
