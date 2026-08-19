import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const notificacoes = await prisma.notificacao.findMany({
    where: { empresaId: req.user!.empresaId, usuarioId: req.user!.sub },
    orderBy: { criadoEm: 'desc' },
    take: 50,
  })
  res.json(notificacoes)
})

router.patch('/:id/lida', requireAuth, async (req: Request, res: Response) => {
  const atualizado = await prisma.notificacao.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId, usuarioId: req.user!.sub },
    data: { lida: true },
  })
  if (!atualizado.count) {
    res.status(404).json({ error: 'Notificação não encontrada' })
    return
  }
  res.json({ ok: true })
})

router.patch('/marcar-todas-lidas', requireAuth, async (req: Request, res: Response) => {
  await prisma.notificacao.updateMany({
    where: { empresaId: req.user!.empresaId, usuarioId: req.user!.sub, lida: false },
    data: { lida: true },
  })
  res.json({ ok: true })
})

export default router
