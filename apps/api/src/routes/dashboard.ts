import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId

  const [oportunidades, usuarios, produtos] = await Promise.all([
    prisma.oportunidade.findMany({ where: { empresaId } }),
    prisma.usuario.count({ where: { empresaId, status: 'ATIVO' } }),
    prisma.produto.count({ where: { empresaId, status: 'ATIVO' } }),
  ])

  const funil = {
    NOVO_LEAD: 0,
    CONTATO: 0,
    VISITA_AGENDADA: 0,
    PROPOSTA: 0,
    NEGOCIACAO: 0,
    GANHO: 0,
    PERDIDO: 0,
  } as Record<string, number>

  let receitaFechada = 0
  for (const op of oportunidades) {
    funil[op.estagio] = (funil[op.estagio] ?? 0) + 1
    if (op.estagio === 'GANHO' && op.valor) receitaFechada += op.valor
  }

  const ativas = oportunidades.filter(o => !['GANHO', 'PERDIDO'].includes(o.estagio))
  const ganhas = oportunidades.filter(o => o.estagio === 'GANHO')
  const perdidas = oportunidades.filter(o => o.estagio === 'PERDIDO')
  const taxaConversao = ativas.length + ganhas.length > 0
    ? Math.round((ganhas.length / (ganhas.length + perdidas.length || 1)) * 100)
    : 0

  res.json({
    funil,
    totais: {
      oportunidadesAtivas: ativas.length,
      vendasFechadas: ganhas.length,
      taxaConversao,
      receitaFechada,
      vendedoresAtivos: usuarios,
      produtosCadastrados: produtos,
    },
    recentes: oportunidades
      .sort((a, b) => new Date(b.atualizadaEm).getTime() - new Date(a.atualizadaEm).getTime())
      .slice(0, 5)
      .map(o => ({ id: o.id, nomeCliente: o.nomeCliente, estagio: o.estagio, valor: o.valor })),
  })
})

export default router
