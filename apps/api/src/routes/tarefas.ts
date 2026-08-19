import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { escopoVisibilidade, escopoWhereDono } from '../lib/permissoes'
import { criarNotificacao } from '../lib/notificacoes'

const router = Router()

const tarefaSchema = z.object({
  titulo: z.string().min(2),
  descricao: z.string().optional(),
  responsavelId: z.string(),
  prazo: z.coerce.date().optional(),
  prioridade: z.enum(['BAIXA', 'NORMAL', 'ALTA', 'URGENTE']).default('NORMAL'),
  vinculoTipo: z.enum(['OPORTUNIDADE', 'ROTINA', 'PROTOCOLO', 'PROCESSO']).optional(),
  vinculoId: z.string().optional(),
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const tarefas = await prisma.tarefa.findMany({
    where: {
      empresaId: req.user!.empresaId,
      ...escopoWhereDono(escopo, 'responsavelId'),
      ...(status ? { status } : {}),
    },
    include: { responsavel: { select: { id: true, nome: true } }, criadoPor: { select: { id: true, nome: true } } },
    orderBy: [{ status: 'asc' }, { prazo: 'asc' }],
  })
  res.json(tarefas)
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parse = tarefaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const tarefa = await prisma.tarefa.create({
    data: { ...parse.data, empresaId: req.user!.empresaId, criadoPorId: req.user!.sub },
    include: { responsavel: { select: { id: true, nome: true } } },
  })
  if (parse.data.responsavelId !== req.user!.sub) {
    await criarNotificacao({
      empresaId: req.user!.empresaId, usuarioId: parse.data.responsavelId, tipo: 'NOVA_TAREFA',
      titulo: 'Nova tarefa atribuída', mensagem: tarefa.titulo, entidadeTipo: 'TAREFA', entidadeId: tarefa.id,
    })
  }
  res.status(201).json(tarefa)
})

const statusSchema = z.object({ status: z.enum(['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'ATRASADA', 'CANCELADA']) })

router.patch('/:id/status', requireAuth, async (req: Request, res: Response) => {
  const parse = statusSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const atualizada = await prisma.tarefa.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'responsavelId') },
    data: { status: parse.data.status, concluidoEm: parse.data.status === 'CONCLUIDA' ? new Date() : null },
  })
  if (!atualizada.count) {
    res.status(404).json({ error: 'Tarefa não encontrada' })
    return
  }
  res.json({ ok: true })
})

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const deletado = await prisma.tarefa.deleteMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'responsavelId') },
  })
  if (!deletado.count) {
    res.status(404).json({ error: 'Tarefa não encontrada' })
    return
  }
  res.json({ ok: true })
})

export default router
