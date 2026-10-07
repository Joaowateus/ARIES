// Assistente da aba (seção 16) e ações dos insights (seção 13.1).
// Cada aba pede o mesmo módulo da tela; Acessos (tela 07) é do gestor.
// A ação é sempre recalculada no servidor pela chave do insight.
import { Router, Request, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM, requireGestorSM, requireModuloSM, type ModuloSM } from '../lib/smAcesso'
import { ABAS, ErroAcao, atorDe, desfazer, executar, insightsDaAba, type Aba } from '../lib/smInsights'
import { montarAssistente } from '../lib/smAssistente'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]
const MODULO_DA_ABA: Record<Exclude<Aba, 'permissoes'>, ModuloSM> = { calendario: 'producao', producao: 'producao', atendimento: 'atendimento', desempenho: 'analise', atribuicao: 'vendas' }

function abaValida(req: Request, res: Response, next: NextFunction) {
  const aba = String(req.params.aba) as Aba
  if (!(ABAS as readonly string[]).includes(aba)) { res.status(404).json({ error: 'Aba não encontrada' }); return }
  if (aba === 'permissoes') return requireGestorSM(req, res, next)
  return requireModuloSM(MODULO_DA_ABA[aba], 'LEITURA')(req, res, next)
}

router.get('/sm/assistente/:aba', ...autenticado, abaValida, async (req: Request, res: Response) => {
  res.json(await montarAssistente(req.sm!, String(req.params.aba) as Aba))
})

router.put('/sm/assistente/:aba/estado', ...autenticado, abaValida, async (req: Request, res: Response) => {
  const parse = z.object({ recolhido: z.boolean() }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Estado inválido' }); return }
  const sm = req.sm!
  const chave = { usuarioId: sm.usuarioId, ator: atorDe(sm), aba: String(req.params.aba) }
  await prisma.smAssistenteEstado.upsert({ where: { usuarioId_ator_aba: chave }, create: { ...chave, recolhido: parse.data.recolhido }, update: { recolhido: parse.data.recolhido } })
  res.json({ recolhido: parse.data.recolhido })
})

router.post('/sm/assistente/:aba/executar', ...autenticado, abaValida, async (req: Request, res: Response) => {
  const parse = z.object({ chave: z.string().min(3).max(400) }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Sugestão inválida' }); return }
  const sm = req.sm!
  const aba = String(req.params.aba) as Aba
  const insight = (await insightsDaAba(sm, aba)).find(i => i.chave === parse.data.chave)
  if (!insight?.acao) { res.status(409).json({ error: 'Essa sugestão já não vale mais. Atualize a tela.' }); return }
  try {
    const r = await executar(sm, insight.acao.operacao)
    if (r.href) { res.json({ mensagem: r.mensagem, href: r.href }); return }
    const acao = await prisma.smInsightAcao.create({
      data: { usuarioId: sm.usuarioId, ator: atorDe(sm), aba, chave: insight.chave, operacao: insight.acao.operacao as unknown as Prisma.InputJsonValue, desfazer: r.desfazer ?? Prisma.DbNull, mensagem: r.mensagem },
    })
    res.json({ acaoId: acao.id, mensagem: r.mensagem, desfazivel: !!r.desfazer })
  } catch (e) {
    if (e instanceof ErroAcao) { res.status(e.status).json({ error: e.message }); return }
    throw e
  }
})

router.post('/sm/assistente/desfazer/:id', ...autenticado, async (req: Request, res: Response) => {
  try {
    await desfazer(req.sm!, String(req.params.id))
    res.json({ ok: true })
  } catch (e) {
    if (e instanceof ErroAcao) { res.status(e.status).json({ error: e.message }); return }
    throw e
  }
})

export default router
