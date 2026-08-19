import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { escopoVisibilidade, escopoWhereDono } from '../lib/permissoes'

const router = Router()

const TIPOS = ['STORY', 'REELS', 'POST', 'VIDEO', 'FOTO', 'OFERTA', 'EDUCATIVO', 'COMERCIAL'] as const

const conteudoSchema = z.object({
  tipo: z.enum(TIPOS),
  plataforma: z.string().min(1),
  objetivo: z.string().optional(),
  status: z.enum(['PLANEJADO', 'PRODUZIDO', 'PUBLICADO']).default('PUBLICADO'),
  link: z.string().optional(),
  alcance: z.number().int().nonnegative().optional(),
  visualizacoes: z.number().int().nonnegative().optional(),
  interacoes: z.number().int().nonnegative().optional(),
  leadsGerados: z.number().int().nonnegative().optional(),
  vendasOriginadas: z.number().int().nonnegative().optional(),
  observacoes: z.string().optional(),
})

function inicioDaSemana(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay())
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const conteudos = await prisma.conteudoSocialMedia.findMany({
    where: { empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'usuarioId') },
    include: { usuario: { select: { id: true, nome: true } } },
    orderBy: { data: 'desc' },
    take: 100,
  })
  res.json(conteudos)
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parse = conteudoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const conteudo = await prisma.conteudoSocialMedia.create({
    data: { ...parse.data, empresaId: req.user!.empresaId, usuarioId: req.user!.sub },
  })
  res.status(201).json(conteudo)
})

router.get('/resumo', requireAuth, async (req: Request, res: Response) => {
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const conteudos = await prisma.conteudoSocialMedia.findMany({
    where: { empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'usuarioId'), data: { gte: inicioDaSemana(new Date()) } },
  })

  res.json({
    produzido: conteudos.length,
    publicado: conteudos.filter(c => c.status === 'PUBLICADO').length,
    pendente: conteudos.filter(c => c.status !== 'PUBLICADO').length,
    alcance: conteudos.reduce((s, c) => s + (c.alcance ?? 0), 0),
    visualizacoes: conteudos.reduce((s, c) => s + (c.visualizacoes ?? 0), 0),
    interacoes: conteudos.reduce((s, c) => s + (c.interacoes ?? 0), 0),
    leadsGerados: conteudos.reduce((s, c) => s + (c.leadsGerados ?? 0), 0),
    vendasOriginadas: conteudos.reduce((s, c) => s + (c.vendasOriginadas ?? 0), 0),
    porTipo: TIPOS.map(tipo => ({ tipo, quantidade: conteudos.filter(c => c.tipo === tipo).length })).filter(t => t.quantidade > 0),
  })
})

export default router
