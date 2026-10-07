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
import { NOME_ABA, fraseDaIA, montarAssistente } from '../lib/smAssistente'
import { iaLigada, responderPergunta, sugerirResposta } from '../lib/smIA'
import { perguntasDaAba, respostaDaAba } from '../lib/smPerguntas'

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

// Frase do momento redigida pela IA, com os mesmos números (seção 16.3).
router.get('/sm/assistente/:aba/frase', ...autenticado, abaValida, async (req: Request, res: Response) => {
  res.json({ frase: await fraseDaIA(req.sm!, String(req.params.aba) as Aba) })
})

// Linha "Pergunte:" (seção 16.2): a pergunta sugerida tem resposta por template;
// com a IA ligada, ela responde em cima dos fatos da aba (só o que o papel vê, sem dinheiro).
const SEM_IA = 'Perguntas livres usam a IA, que ainda não está ligada nesta conta. Experimente uma das perguntas sugeridas.'
const SEM_SEGURANCA = 'Não consegui responder com segurança agora: só respondo com números que estão no sistema. Tente reformular ou use uma das perguntas sugeridas.'
router.post('/sm/assistente/:aba/perguntar', ...autenticado, abaValida, async (req: Request, res: Response) => {
  const parse = z.object({
    pergunta: z.string().trim().min(2, 'Escreva a pergunta').max(400, 'Pergunta longa demais'),
    perguntaId: z.string().max(200).nullish(),
    historico: z.array(z.object({ pergunta: z.string().max(400), resposta: z.string().max(2000) })).max(6).optional(),
  }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const sm = req.sm!
  const aba = String(req.params.aba) as Aba
  // A pergunta sugerida precisa ser uma das atuais: o servidor recalcula.
  let id = parse.data.perguntaId ?? null
  if (id && !(await perguntasDaAba(sm, aba)).some(p => p.id === id)) id = null
  const r = await respostaDaAba(sm, aba, id)
  let resposta: string | null = null
  if (iaLigada()) {
    if (r.conversa) {
      const t = await sugerirResposta(sm.usuarioId, r.conversa.fatos)
      if (t) resposta = `Sugestão para ${r.conversa.nome}:\n“${t}”\nAbra a conversa para revisar e enviar.`
    } else {
      resposta = await responderPergunta(sm.usuarioId, NOME_ABA[aba], parse.data.pergunta, parse.data.historico ?? [], r.fatos)
    }
  }
  res.json({ resposta: resposta ?? r.semIA ?? (iaLigada() ? SEM_SEGURANCA : SEM_IA), ia: !!resposta, acao: r.acao ?? null })
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
