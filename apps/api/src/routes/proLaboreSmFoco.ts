// Tela 08 · Primeiro acesso e tela 09 · Modo foco (seção 11.1 e 11.2), e as
// preferências da pessoa (seção 15.5: "Dá para mudar tudo depois em
// Preferências").
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM } from '../lib/smAcesso'
import { atorDe } from '../lib/smInsights'
import { ErroFoco, adiarTarefa, concluirRitual, executarTarefa, filaDoFoco, iniciarRitual } from '../lib/smFoco'
import { AVISOS_PADRAO, OPCOES_DIAS, OPCOES_RESPOSTA, dadosBoasVindas, preferenciaDe, salvarBoasVindas } from '../lib/smBoasVindas'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]

// ---------- Modo foco ----------

router.get('/sm/foco', ...autenticado, async (req: Request, res: Response) => {
  const sm = req.sm!
  if (req.query.iniciar === '1') await iniciarRitual(sm)
  res.json(await filaDoFoco(sm))
})

const leadSchema = z.object({ nome: z.string().trim().max(120), moto: z.string().trim().max(120).nullable(), pagamento: z.enum(['FINANCIAMENTO', 'A_VISTA', 'CONSORCIO']) })
router.post('/sm/foco/acao', ...autenticado, async (req: Request, res: Response) => {
  const parse = z.object({
    tarefaId: z.string().min(3).max(300),
    texto: z.string().max(1000).optional(),
    virarLead: z.boolean().optional(),
    lead: leadSchema.optional(),
    capaTexto: z.boolean().optional(),
  }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Ação inválida' }); return }
  const { tarefaId, ...d } = parse.data
  try {
    res.json(await executarTarefa(req.sm!, tarefaId, d))
  } catch (e) {
    if (e instanceof ErroFoco) { res.status(e.status).json({ error: e.message }); return }
    const status = (e as { status?: number }).status
    if (status) { res.status(status).json({ error: e instanceof Error ? e.message : 'Falha' }); return }
    throw e
  }
})

router.post('/sm/foco/adiar', ...autenticado, async (req: Request, res: Response) => {
  const parse = z.object({ tarefaId: z.string().min(3).max(300) }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Tarefa inválida' }); return }
  await adiarTarefa(req.sm!, parse.data.tarefaId)
  res.json({ ok: true })
})

router.post('/sm/foco/concluir', ...autenticado, async (req: Request, res: Response) => {
  res.json(await concluirRitual(req.sm!))
})

// ---------- Primeiro acesso ----------

router.get('/sm/boas-vindas', ...autenticado, async (req: Request, res: Response) => {
  res.json(await dadosBoasVindas(req.sm!))
})

const avisosSchema = z.object({ whatsapp: z.boolean(), celular: z.boolean(), email: z.boolean() })
router.post('/sm/boas-vindas', ...autenticado, async (req: Request, res: Response) => {
  const parse = z.object({
    tratamento: z.string().trim().max(40).nullable().optional(),
    genero: z.enum(['F', 'M']).nullable().optional(),
    metas: z.object({
      diasComPost: z.number().int().refine(v => (OPCOES_DIAS as readonly number[]).includes(v), 'Dias com post: 3, 4 ou 5'),
      respostaMin: z.number().int().refine(v => (OPCOES_RESPOSTA as readonly number[]).includes(v), 'Resposta: 15, 30 ou 60 min'),
      leadsSemana: z.number().int().min(1).max(1000),
    }),
    focoHora: z.number().int().min(5).max(14),
    avisos: avisosSchema,
  }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  try {
    await salvarBoasVindas(req.sm!, parse.data)
    res.json({ ok: true })
  } catch (e) {
    const status = (e as { status?: number }).status
    if (status) { res.status(status).json({ error: e instanceof Error ? e.message : 'Falha' }); return }
    throw e
  }
})

// ---------- Preferências ----------

router.get('/sm/preferencias', ...autenticado, async (req: Request, res: Response) => {
  const sm = req.sm!
  const pref = await preferenciaDe(sm.usuarioId, atorDe(sm))
  const membro = sm.visao === 'SOCIAL_MEDIA' ? await prisma.smMembro.findUnique({ where: { usuarioId: sm.usuarioId }, select: { nome: true, tratamento: true } }) : null
  res.json({ tratamento: membro ? membro.tratamento ?? membro.nome.split(' ')[0] : null, genero: pref.genero, focoHora: pref.focoHora, avisos: pref.avisos, padraoAvisos: AVISOS_PADRAO })
})

router.put('/sm/preferencias', ...autenticado, async (req: Request, res: Response) => {
  const parse = z.object({
    genero: z.enum(['F', 'M']).nullable().optional(),
    tratamento: z.string().trim().min(1).max(40).optional(),
    focoHora: z.number().int().min(5).max(14).optional(),
    avisos: avisosSchema.optional(),
  }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Preferência inválida' }); return }
  const sm = req.sm!
  const { tratamento, ...resto } = parse.data
  const chave = { usuarioId: sm.usuarioId, ator: atorDe(sm) }
  await prisma.smPreferencia.upsert({ where: { usuarioId_ator: chave }, create: { ...chave, ...resto }, update: resto })
  if (tratamento && sm.visao === 'SOCIAL_MEDIA') await prisma.smMembro.update({ where: { usuarioId: sm.usuarioId }, data: { tratamento } })
  res.json({ ok: true, ...parse.data })
})

export default router
