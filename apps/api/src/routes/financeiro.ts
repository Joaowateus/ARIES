import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.get('/contas-receber', requireAuth, async (req: Request, res: Response) => {
  const { status } = req.query
  const contas = await prisma.contaReceber.findMany({
    where: {
      empresaId: req.user!.empresaId,
      ...(typeof status === 'string' ? { status } : {}),
    },
    include: {
      contrato: {
        select: { id: true, nomeCliente: true, unidade: { select: { nome: true } } },
      },
    },
    orderBy: { vencimento: 'asc' },
  })

  // Marcar como atrasadas as vencidas e ainda PENDENTE
  const hoje = new Date()
  const atualizadas = contas.map(c => ({
    ...c,
    status: c.status === 'PENDENTE' && new Date(c.vencimento) < hoje ? 'ATRASADO' : c.status,
  }))

  res.json(atualizadas)
})

const baixaSchema = z.object({
  valorPago: z.number().positive(),
  pagoEm: z.string().optional(),
})

router.patch('/contas-receber/:id/baixa', requireAuth, async (req: Request, res: Response) => {
  const parse = baixaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const conta = await prisma.contaReceber.findFirst({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
  })
  if (!conta) {
    res.status(404).json({ error: 'Conta não encontrada' })
    return
  }
  if (conta.status === 'PAGO') {
    res.status(409).json({ error: 'Conta já baixada' })
    return
  }

  const pagoEm = parse.data.pagoEm ? new Date(parse.data.pagoEm) : new Date()
  const atualizada = await prisma.contaReceber.update({
    where: { id: String(req.params.id) },
    data: {
      pago: parse.data.valorPago,
      pagoEm,
      status: 'PAGO',
    },
  })
  res.json(atualizada)
})

router.get('/resumo', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)

  const [totalPago, totalPendente, totalAtrasado, contasMes] = await Promise.all([
    prisma.contaReceber.aggregate({
      where: { empresaId, status: 'PAGO' },
      _sum: { pago: true },
    }),
    prisma.contaReceber.aggregate({
      where: { empresaId, status: 'PENDENTE', vencimento: { gte: hoje } },
      _sum: { valor: true },
      _count: true,
    }),
    prisma.contaReceber.aggregate({
      where: { empresaId, status: 'PENDENTE', vencimento: { lt: hoje } },
      _sum: { valor: true },
      _count: true,
    }),
    prisma.contaReceber.findMany({
      where: { empresaId, vencimento: { gte: inicioMes, lte: fimMes } },
    }),
  ])

  const receitaMes = contasMes.filter(c => c.status === 'PAGO').reduce((s, c) => s + (c.pago ?? 0), 0)
  const previsaoMes = contasMes.reduce((s, c) => s + c.valor, 0)

  res.json({
    totalRecebido: totalPago._sum.pago ?? 0,
    totalPendente: totalPendente._sum.valor ?? 0,
    totalAtrasado: totalAtrasado._sum.valor ?? 0,
    contasAtrasadas: totalAtrasado._count,
    receitaMes,
    previsaoMes,
  })
})

export default router
