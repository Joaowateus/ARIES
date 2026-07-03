import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requirePapel } from '../middleware/auth'

const router = Router()

const produtoSchema = z.object({
  nome: z.string().min(2),
  categoria: z.string().default('MOTO'),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  ano: z.number().int().optional(),
  precoBase: z.number().positive().optional(),
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const produtos = await prisma.produto.findMany({
    where: { empresaId: req.user!.empresaId, status: 'ATIVO' },
    orderBy: { nome: 'asc' },
  })
  res.json(produtos)
})

router.post('/', requireAuth, requirePapel('ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL'), async (req: Request, res: Response) => {
  const parse = produtoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const produto = await prisma.produto.create({
    data: { ...parse.data, empresaId: req.user!.empresaId },
  })
  res.status(201).json(produto)
})

router.patch('/:id', requireAuth, requirePapel('ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL'), async (req: Request, res: Response) => {
  const parse = produtoSchema.partial().safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const produto = await prisma.produto.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    data: parse.data,
  })
  if (!produto.count) {
    res.status(404).json({ error: 'Produto não encontrado' })
    return
  }
  res.json({ ok: true })
})

router.delete('/:id', requireAuth, requirePapel('ADMINISTRADOR', 'GERENTE_COMERCIAL'), async (req: Request, res: Response) => {
  await prisma.produto.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    data: { status: 'INATIVO' },
  })
  res.json({ ok: true })
})

export default router
