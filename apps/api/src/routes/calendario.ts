import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { escopoVisibilidade, escopoWhereDono } from '../lib/permissoes'

const router = Router()

interface EventoCalendario {
  tipo: string
  titulo: string
  data: Date
  entidadeId: string
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const de = typeof req.query.de === 'string' ? new Date(req.query.de) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const ate = typeof req.query.ate === 'string' ? new Date(req.query.ate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const escopo = await escopoVisibilidade(prisma, req.user!)

  const [tarefas, followUps, auditorias] = await Promise.all([
    prisma.tarefa.findMany({
      where: { empresaId, ...escopoWhereDono(escopo, 'responsavelId'), prazo: { gte: de, lte: ate } },
      select: { id: true, titulo: true, prazo: true },
    }),
    prisma.oportunidade.findMany({
      where: { empresaId, ...escopoWhereDono(escopo, 'responsavelId'), proximaAcaoEm: { gte: de, lte: ate } },
      select: { id: true, nomeCliente: true, proximaAcaoDescricao: true, proximaAcaoEm: true },
    }),
    prisma.auditoria.findMany({
      where: { empresaId, data: { gte: de, lte: ate } },
      select: { id: true, entidadeTipo: true, data: true },
    }),
  ])

  const eventos: EventoCalendario[] = [
    ...tarefas.map(t => ({ tipo: 'TAREFA', titulo: t.titulo, data: t.prazo!, entidadeId: t.id })),
    ...followUps.map(o => ({ tipo: 'FOLLOW_UP', titulo: o.proximaAcaoDescricao || `Follow-up: ${o.nomeCliente}`, data: o.proximaAcaoEm!, entidadeId: o.id })),
    ...auditorias.map(a => ({ tipo: 'AUDITORIA', titulo: `Auditoria — ${a.entidadeTipo}`, data: a.data, entidadeId: a.id })),
  ].sort((a, b) => a.data.getTime() - b.data.getTime())

  res.json(eventos)
})

export default router
