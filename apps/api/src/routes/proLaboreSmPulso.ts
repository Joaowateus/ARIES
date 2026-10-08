// Tela 12 · Celular (seção 11.5): inscrição do aparelho no Web Push, aviso de
// teste e a lista "Avisos" do próprio espaço (o que foi para o celular, mesmo
// sem push configurado). Os gatilhos e a entrega agrupada rodam no job de
// minuto (/sm/cron/minuto), em lib/smPulso.ts.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM, type ContextoSM, type ModuloSM } from '../lib/smAcesso'
import { atorDe } from '../lib/smInsights'
import { avisoDeTeste, chavePublicaPush, pushConfigurado } from '../lib/smPulso'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]

// Tipo do aviso → módulo que a pessoa precisa enxergar para recebê-lo.
const MODULO_DO_TIPO: Record<string, ModuloSM | null> = { DECOLANDO: 'analise', VENDA: 'vendas', CLIENTE: 'atendimento', APROVACAO: null, FALHA: null }

/** De quem é a lista: no "ver como", a do Social Media (só leitura). */
async function atorDaLista(sm: ContextoSM): Promise<string> {
  if (sm.verComo) return (await prisma.smMembro.findUnique({ where: { usuarioId: sm.usuarioId }, select: { id: true } }))?.id ?? 'GESTOR'
  return atorDe(sm)
}
const podeVerTipo = (sm: ContextoSM, tipo: string) => { const m = MODULO_DO_TIPO[tipo]; return !m || sm.pode(m, 'LEITURA') }

router.get('/sm/push/chave', ...autenticado, async (req: Request, res: Response) => {
  const sm = req.sm!
  const aparelhos = sm.verComo ? 0 : await prisma.smPushInscricao.count({ where: { usuarioId: sm.usuarioId, ator: atorDe(sm) } })
  res.json({ configurado: pushConfigurado(), chave: chavePublicaPush(), aparelhos })
})

const inscricaoSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  navegador: z.string().trim().max(120).optional(),
})

router.post('/sm/push/inscrever', ...autenticado, async (req: Request, res: Response) => {
  if (!pushConfigurado()) { res.status(409).json({ error: 'Os avisos no celular ainda não foram configurados no servidor.' }); return }
  const parse = inscricaoSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Inscrição inválida' }); return }
  const sm = req.sm!
  const { endpoint, keys, navegador } = parse.data
  const dados = { usuarioId: sm.usuarioId, ator: atorDe(sm), p256dh: keys.p256dh, auth: keys.auth, navegador: navegador ?? null }
  // O mesmo navegador pode trocar de pessoa (sair e entrar com outro login): o endpoint passa a ser de quem inscreveu por último.
  await prisma.smPushInscricao.upsert({ where: { endpoint }, create: { endpoint, ...dados }, update: dados })
  // Ligar neste aparelho liga o canal "celular" nas preferências.
  const chave = { usuarioId: sm.usuarioId, ator: atorDe(sm) }
  const pref = await prisma.smPreferencia.findUnique({ where: { usuarioId_ator: chave }, select: { avisos: true } })
  const avisos = { whatsapp: true, celular: true, email: false, ...((pref?.avisos as object | null) ?? {}) }
  if (!avisos.celular) await prisma.smPreferencia.upsert({ where: { usuarioId_ator: chave }, create: { ...chave, avisos: { ...avisos, celular: true } }, update: { avisos: { ...avisos, celular: true } } })
  res.json({ ok: true, aparelhos: await prisma.smPushInscricao.count({ where: chave }) })
})

router.delete('/sm/push/inscrever', ...autenticado, async (req: Request, res: Response) => {
  const parse = z.object({ endpoint: z.string().url().max(2000) }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Inscrição inválida' }); return }
  const sm = req.sm!
  await prisma.smPushInscricao.deleteMany({ where: { endpoint: parse.data.endpoint, usuarioId: sm.usuarioId, ator: atorDe(sm) } })
  res.json({ ok: true, aparelhos: await prisma.smPushInscricao.count({ where: { usuarioId: sm.usuarioId, ator: atorDe(sm) } }) })
})

router.post('/sm/push/teste', ...autenticado, async (req: Request, res: Response) => {
  if (!pushConfigurado()) { res.status(409).json({ error: 'Os avisos no celular ainda não foram configurados no servidor.' }); return }
  const sm = req.sm!
  const enviados = await avisoDeTeste(sm.usuarioId, atorDe(sm))
  if (!enviados) { res.status(409).json({ error: 'Nenhum aparelho com avisos ligados. Ative neste aparelho primeiro.' }); return }
  res.json({ ok: true, enviados })
})

router.get('/sm/avisos', ...autenticado, async (req: Request, res: Response) => {
  const sm = req.sm!
  const ator = await atorDaLista(sm)
  const desde = new Date(Date.now() - 14 * 864e5)
  const lista = (await prisma.smPulso.findMany({ where: { usuarioId: sm.usuarioId, ator, criadoEm: { gte: desde } }, orderBy: { criadoEm: 'desc' }, take: 40 }))
    .filter(p => podeVerTipo(sm, p.tipo))
  res.json({
    naoLidos: lista.filter(p => !p.lidoEm).length,
    avisos: lista.slice(0, 30).map(p => ({ id: p.id, tipo: p.tipo, titulo: p.titulo, texto: p.texto, href: p.href, urgente: p.urgente, criadoEm: p.criadoEm, lido: !!p.lidoEm })),
  })
})

router.post('/sm/avisos/lidos', ...autenticado, async (req: Request, res: Response) => {
  const parse = z.object({ ids: z.array(z.string().min(1).max(40)).max(50).optional() }).safeParse(req.body ?? {})
  if (!parse.success) { res.status(400).json({ error: 'Avisos inválidos' }); return }
  const sm = req.sm!
  const r = await prisma.smPulso.updateMany({
    where: { usuarioId: sm.usuarioId, ator: atorDe(sm), lidoEm: null, ...(parse.data.ids ? { id: { in: parse.data.ids } } : {}) },
    data: { lidoEm: new Date() },
  })
  res.json({ ok: true, marcados: r.count })
})

export default router
