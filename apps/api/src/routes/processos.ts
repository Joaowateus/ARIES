import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requirePapel } from '../middleware/auth'
import { PAPEIS_GESTAO } from '../lib/permissoes'

const router = Router()

// Mesma estrutura de blocos flexíveis já usada em Protocolo — Processo é o
// desenho operacional do departamento, que pode referenciar um Protocolo
// (o "como fazer" oficial) e Rotinas (a execução recorrente).
const processoSchema = z.object({
  nome: z.string().min(2),
  departamento: z.string().optional(),
  responsavelId: z.string().nullable().optional(),
  cargo: z.string().optional(),
  objetivo: z.string().optional(),
  fluxo: z.array(z.string()).optional(),
  pop: z.array(z.object({ titulo: z.string(), descricao: z.string().optional(), checklist: z.array(z.string()).optional() })).optional(),
  protocoloId: z.string().nullable().optional(),
  ferramentas: z.array(z.string()).optional(),
  kpis: z.array(z.object({ categoria: z.string(), indicador: z.string() })).optional(),
  contingencia: z.array(z.object({ cenario: z.string(), acao: z.string() })).optional(),
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const processos = await prisma.processo.findMany({
    where: { empresaId: req.user!.empresaId, status: 'ativo' },
    include: { protocolo: { select: { id: true, nome: true } }, rotinas: { select: { id: true, nome: true } } },
    orderBy: { nome: 'asc' },
  })
  res.json(processos)
})

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const processo = await prisma.processo.findFirst({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    include: { protocolo: { select: { id: true, nome: true } }, rotinas: true },
  })
  if (!processo) {
    res.status(404).json({ error: 'Processo não encontrado' })
    return
  }
  res.json(processo)
})

router.post('/', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const parse = processoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const processo = await prisma.processo.create({
    data: { ...parse.data, empresaId: req.user!.empresaId, criadoPorId: req.user!.sub },
  })
  res.status(201).json(processo)
})

router.patch('/:id', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const parse = processoSchema.partial().safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const atualizado = await prisma.processo.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    data: parse.data,
  })
  if (!atualizado.count) {
    res.status(404).json({ error: 'Processo não encontrado' })
    return
  }
  res.json({ ok: true })
})

export default router
