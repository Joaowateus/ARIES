import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { escopoVisibilidade, escopoWhereDono } from '../lib/permissoes'

const router = Router()

// Meta sugerida por conta (Marketplace/Anúncios): 200 anúncios/semana por
// conta, distribuído em até 5 contas — meta total escala com quantas contas
// o próprio usuário tem cadastradas, em vez de um número fixo hardcoded.
const META_POR_CONTA_SEMANA = 200

function inicioDaSemana(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay())
}

const contaSchema = z.object({ nome: z.string().min(1), plataforma: z.string().default('MARKETPLACE') })

router.get('/contas', requireAuth, async (req: Request, res: Response) => {
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const contas = await prisma.contaAnuncio.findMany({
    where: { empresaId: req.user!.empresaId, ativa: true, ...escopoWhereDono(escopo, 'usuarioId') },
    orderBy: { nome: 'asc' },
  })
  res.json(contas)
})

router.post('/contas', requireAuth, async (req: Request, res: Response) => {
  const parse = contaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const conta = await prisma.contaAnuncio.create({
    data: { ...parse.data, empresaId: req.user!.empresaId, usuarioId: req.user!.sub },
  })
  res.status(201).json(conta)
})

const producaoSchema = z.object({
  contaId: z.string(),
  unidadeId: z.string().optional(),
  produto: z.string().optional(),
  quantidade: z.number().int().positive().default(1),
  horario: z.string().optional(),
})

router.get('/producao', requireAuth, async (req: Request, res: Response) => {
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const producao = await prisma.anuncioProducao.findMany({
    where: { empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'usuarioId'), data: { gte: inicioDaSemana(new Date()) } },
    include: { conta: { select: { id: true, nome: true } } },
    orderBy: { data: 'desc' },
  })
  res.json(producao)
})

router.post('/producao', requireAuth, async (req: Request, res: Response) => {
  const parse = producaoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const conta = await prisma.contaAnuncio.findFirst({ where: { id: parse.data.contaId, empresaId: req.user!.empresaId, usuarioId: req.user!.sub } })
  if (!conta) {
    res.status(404).json({ error: 'Conta de anúncio não encontrada' })
    return
  }
  const registro = await prisma.anuncioProducao.create({
    data: { ...parse.data, empresaId: req.user!.empresaId, usuarioId: req.user!.sub },
  })
  res.status(201).json(registro)
})

router.get('/resumo', requireAuth, async (req: Request, res: Response) => {
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const inicioSemana = inicioDaSemana(new Date())

  const [contas, producaoSemana] = await Promise.all([
    prisma.contaAnuncio.findMany({ where: { empresaId: req.user!.empresaId, ativa: true, ...escopoWhereDono(escopo, 'usuarioId') } }),
    prisma.anuncioProducao.findMany({
      where: { empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'usuarioId'), data: { gte: inicioSemana } },
      select: { contaId: true, quantidade: true },
    }),
  ])

  const meta = contas.length * META_POR_CONTA_SEMANA
  const produzido = producaoSemana.reduce((s, p) => s + p.quantidade, 0)

  const porConta = contas.map(c => {
    const total = producaoSemana.filter(p => p.contaId === c.id).reduce((s, p) => s + p.quantidade, 0)
    return { contaId: c.id, nome: c.nome, meta: META_POR_CONTA_SEMANA, produzido: total }
  })

  res.json({ meta, produzido, restante: Math.max(0, meta - produzido), percentual: meta > 0 ? Math.min(1, produzido / meta) : 0, porConta })
})

export default router
