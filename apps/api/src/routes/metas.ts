import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requirePapel } from '../middleware/auth'
import { PAPEIS_GESTAO, escopoVisibilidade, escopoWhereDono } from '../lib/permissoes'

const router = Router()

// Metas podem ser da empresa/departamento como um todo (usuarioId nulo) ou
// individuais (ver Pilar 7 do manual de precificação — a leitura de metas
// individuais deve orientar treinamento, não virar cobrança pública).
const metaSchema = z.object({
  titulo: z.string().min(2),
  tipo: z.enum(['QUANTIDADE', 'FATURAMENTO']).default('QUANTIDADE'),
  valor: z.number().positive(),
  periodo: z.enum(['DIARIA', 'SEMANAL', 'MENSAL']),
  inicioEm: z.coerce.date(),
  fimEm: z.coerce.date(),
  usuarioId: z.string().nullable().optional(),
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const whereDono = escopo.tipo === 'todos' ? {} : { OR: [{ usuarioId: null }, escopoWhereDono(escopo, 'usuarioId')] }

  const metas = await prisma.meta.findMany({
    where: { empresaId: req.user!.empresaId, ...whereDono, ...(status ? { status } : {}) },
    orderBy: { inicioEm: 'desc' },
  })
  res.json(metas)
})

router.post('/', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const parse = metaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const meta = await prisma.meta.create({
    data: { ...parse.data, empresaId: req.user!.empresaId },
  })
  res.status(201).json(meta)
})

router.patch('/:id', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const parse = metaSchema.partial().safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const atualizado = await prisma.meta.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    data: parse.data,
  })
  if (!atualizado.count) {
    res.status(404).json({ error: 'Meta não encontrada' })
    return
  }
  res.json({ ok: true })
})

router.patch('/:id/encerrar', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const atualizado = await prisma.meta.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    data: { status: 'ENCERRADA' },
  })
  if (!atualizado.count) {
    res.status(404).json({ error: 'Meta não encontrada' })
    return
  }
  res.json({ ok: true })
})

router.delete('/:id', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const deletado = await prisma.meta.deleteMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
  })
  if (!deletado.count) {
    res.status(404).json({ error: 'Meta não encontrada' })
    return
  }
  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Progresso das metas — usado nas barras Dia/Semana/Mês do Dashboard
// Executivo e do Meu Painel. Meta individual mede só as vendas do próprio
// usuarioId; meta da empresa mede tudo.
// ---------------------------------------------------------------------------

export async function calcularProgressoMetas(empresaId: string, metas: { id: string; tipo: string; valor: number; usuarioId: string | null; periodo: string; inicioEm: Date; fimEm: Date }[]) {
  const agora = new Date()
  return Promise.all(
    metas.map(async meta => {
      const fimJanela = meta.fimEm < agora ? meta.fimEm : agora
      const contratos = await prisma.contrato.findMany({
        where: {
          empresaId,
          status: { not: 'CANCELADO' },
          criadoEm: { gte: meta.inicioEm, lte: fimJanela },
          ...(meta.usuarioId ? { vendedorId: meta.usuarioId } : {}),
        },
        select: { valorTotal: true },
      })

      const realizado =
        meta.tipo === 'FATURAMENTO'
          ? contratos.reduce((soma, c) => soma + c.valorTotal, 0)
          : contratos.length

      return {
        ...meta,
        realizado,
        percentual: meta.valor > 0 ? Math.min(1, realizado / meta.valor) : 0,
      }
    })
  )
}

router.get('/progresso', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const status = typeof req.query.status === 'string' ? req.query.status : 'ATIVA'
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const whereDono = escopo.tipo === 'todos' ? {} : { OR: [{ usuarioId: null }, escopoWhereDono(escopo, 'usuarioId')] }

  const metas = await prisma.meta.findMany({
    where: { empresaId, ...whereDono, ...(status !== 'todas' ? { status } : {}) },
    orderBy: { inicioEm: 'desc' },
  })

  res.json(await calcularProgressoMetas(empresaId, metas))
})

export default router
