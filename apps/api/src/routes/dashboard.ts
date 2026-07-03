import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const hoje = new Date()

  const [oportunidades, usuarios, unidades, financeiro] = await Promise.all([
    prisma.oportunidade.findMany({ where: { empresaId } }),
    prisma.usuario.count({ where: { empresaId, status: 'ATIVO' } }),
    prisma.unidade.groupBy({ by: ['situacao'], where: { empresaId, situacao: { not: 'INATIVO' } }, _count: true }),
    prisma.contaReceber.aggregate({
      where: { empresaId, status: 'PAGO' },
      _sum: { pago: true },
    }),
  ])

  const funil: Record<string, number> = {
    NOVO_LEAD: 0, CONTATO: 0, VISITA_AGENDADA: 0,
    PROPOSTA: 0, NEGOCIACAO: 0, GANHO: 0, PERDIDO: 0,
  }

  for (const op of oportunidades) {
    funil[op.estagio] = (funil[op.estagio] ?? 0) + 1
  }

  const ativas = oportunidades.filter(o => !['GANHO', 'PERDIDO'].includes(o.estagio))
  const ganhas = oportunidades.filter(o => o.estagio === 'GANHO')
  const perdidas = oportunidades.filter(o => o.estagio === 'PERDIDO')
  const taxaConversao = ganhas.length + perdidas.length > 0
    ? Math.round((ganhas.length / (ganhas.length + perdidas.length)) * 100)
    : 0

  const estoque: Record<string, number> = {}
  for (const u of unidades) estoque[u.situacao] = u._count

  res.json({
    funil,
    totais: {
      oportunidadesAtivas: ativas.length,
      vendasFechadas: ganhas.length,
      taxaConversao,
      receitaTotal: financeiro._sum.pago ?? 0,
      vendedoresAtivos: usuarios,
      estoque,
    },
    recentes: oportunidades
      .sort((a, b) => new Date(b.atualizadaEm).getTime() - new Date(a.atualizadaEm).getTime())
      .slice(0, 5)
      .map(o => ({ id: o.id, nomeCliente: o.nomeCliente, estagio: o.estagio, valor: o.valor })),
  })
})

export default router
