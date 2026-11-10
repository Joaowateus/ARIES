// Ajuste 1 · Hoje do dono: Daily e Painel. Abrem para o dono e o supervisor;
// as cifras do dono (pró-labore, comissões, gasto e custos) só para ele.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireProLaboreAuth, requireDono } from '../middleware/authProLabore'
import { papelDoUsuario } from '../lib/papelHoje'
import { ErroDaily, NOME_BLOCO, configDaily, decidirDaily, encerrarDaily, iniciarDaily, pautaDaily, salvarConfigDaily, tempoDoBloco, tratarDaily, type BlocoChave, type Leitor } from '../lib/daily'
import { ErroPainel, PARTES, metasDasEtapas, opcoesDoPainel, painel, salvarMetaEtapa } from '../lib/painel'
import { hojeBrt, mesCorrente } from '../lib/metricas'
import { ETAPAS, type Etapa } from '../lib/etapasJornada'
import { ITENS_AJUSTE1, aceiteAjuste1, type ItemAjuste1 } from '../lib/aceiteAjuste1'

const router = Router()
const BLOCOS = Object.keys(NOME_BLOCO) as [BlocoChave, ...BlocoChave[]]

function leitor(req: Request, res: Response): Leitor | null {
  const u = req.proLaboreUser!
  const papel = papelDoUsuario(u)
  if (papel !== 'DONO' && papel !== 'SUPERVISOR') { res.status(403).json({ error: 'Só o dono e o supervisor abrem o Daily e o Painel' }); return null }
  return { usuarioId: u.sub, papel, vendedorId: u.vendedorId ?? null, nome: u.nome }
}
const falha = (res: Response, e: unknown) => {
  if (e instanceof ErroDaily || e instanceof ErroPainel) { res.status(e.status).json({ error: e.message }); return }
  throw e
}
const modoDe = (v: unknown) => (v === 'EQUIPE' ? 'EQUIPE' : 'GESTAO') as 'GESTAO' | 'EQUIPE'

// --- Daily ---
router.get('/daily/pauta', requireProLaboreAuth, async (req: Request, res: Response) => {
  const q = leitor(req, res); if (!q) return
  try { res.json(await pautaDaily(q, modoDe(req.query.modo), typeof req.query.reuniao === 'string' ? req.query.reuniao : null)) } catch (e) { falha(res, e) }
})
router.post('/daily/iniciar', requireProLaboreAuth, async (req: Request, res: Response) => {
  const q = leitor(req, res); if (!q) return
  try { res.json(await iniciarDaily(q, modoDe(req.body?.modo))) } catch (e) { falha(res, e) }
})
router.post('/daily/:id/decidir', requireProLaboreAuth, async (req: Request, res: Response) => {
  const q = leitor(req, res); if (!q) return
  const p = z.object({ bloco: z.enum(BLOCOS), texto: z.string().trim().min(3, 'Escreva o que foi decidido').max(500), responsavelId: z.string().nullable(), prazo: z.string().min(8) }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  try { res.json(await decidirDaily(q, String(req.params.id), p.data)) } catch (e) { falha(res, e) }
})
router.post('/daily/:id/tratar', requireProLaboreAuth, async (req: Request, res: Response) => {
  const q = leitor(req, res); if (!q) return
  const p = z.object({ bloco: z.enum(BLOCOS), tipo: z.enum(['REC', 'ATV', 'NUMERO']), ref: z.string().nullable(), texto: z.string().trim().min(1).max(300), individual: z.boolean().optional() }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  try { res.json(await tratarDaily(q, String(req.params.id), p.data)) } catch (e) { falha(res, e) }
})
router.post('/daily/:id/bloco', requireProLaboreAuth, async (req: Request, res: Response) => {
  const q = leitor(req, res); if (!q) return
  const p = z.object({ bloco: z.enum(BLOCOS), segundos: z.number().min(0).max(7200), pulado: z.boolean() }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  try { res.json(await tempoDoBloco(q, String(req.params.id), p.data)) } catch (e) { falha(res, e) }
})
router.post('/daily/:id/encerrar', requireProLaboreAuth, async (req: Request, res: Response) => {
  const q = leitor(req, res); if (!q) return
  try { res.json(await encerrarDaily(q, String(req.params.id))) } catch (e) { falha(res, e) }
})
router.get('/daily/config', requireProLaboreAuth, async (req: Request, res: Response) => {
  const q = leitor(req, res); if (!q) return
  res.json({ blocos: (await configDaily(q.usuarioId)).map(b => ({ ...b, nome: NOME_BLOCO[b.chave] })) })
})
router.put('/daily/config', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const p = z.object({ blocos: z.array(z.object({ chave: z.enum(BLOCOS), minutos: z.number().min(1).max(30), ligado: z.boolean() })).min(1), justificativa: z.string().trim().min(5, 'Escreva por que mudou') }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  try { res.json({ blocos: await salvarConfigDaily(req.proLaboreUser!.sub, p.data.blocos, p.data.justificativa, req.proLaboreUser!.sub) }) } catch (e) { falha(res, e) }
})

// --- Painel ---
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
router.get('/painel-dono', requireProLaboreAuth, async (req: Request, res: Response) => {
  const q = leitor(req, res); if (!q) return
  const s = (k: string) => (typeof req.query[k] === 'string' && req.query[k] ? String(req.query[k]) : null)
  const mes = mesCorrente()
  const inicio = dia.safeParse(s('inicio')).success ? s('inicio')! : mes.inicio
  const fim = dia.safeParse(s('fim')).success ? s('fim')! : hojeBrt()
  if (inicio > fim) { res.status(400).json({ error: 'O início vem antes do fim' }); return }
  try {
    res.json(await painel({ usuarioId: q.usuarioId, papel: q.papel as 'DONO' | 'SUPERVISOR' }, { inicio, fim }, { vendedorId: s('vendedorId'), sdrId: s('sdrId'), origem: s('origem'), formaPagamento: s('formaPagamento') }, new Date(), PARTES[s('parte') === 'TOPO' ? 'TOPO' : s('parte') === 'SERIES' ? 'SERIES' : 'TUDO']))
  } catch (e) { falha(res, e) }
})
router.get('/painel-dono/opcoes', requireProLaboreAuth, async (req: Request, res: Response) => {
  const q = leitor(req, res); if (!q) return
  res.json(await opcoesDoPainel(q.usuarioId))
})
router.get('/painel-dono/metas', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  res.json(await metasDasEtapas(req.proLaboreUser!.sub))
})
router.put('/painel-dono/metas/:etapa', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const etapa = String(req.params.etapa) as Etapa
  if (!ETAPAS.includes(etapa)) { res.status(404).json({ error: 'Etapa desconhecida' }); return }
  const n = z.number().min(0).nullable()
  const p = z.object({ conversaoMin: n.refine(v => v == null || v <= 100, 'Conversão até 100%'), perdaMax: n.refine(v => v == null || v <= 100, 'Perda até 100%'), custoMax: n, justificativa: z.string().trim().min(5, 'Escreva por que mudou') }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  try { res.json(await salvarMetaEtapa(req.proLaboreUser!.sub, etapa, p.data, p.data.justificativa, req.proLaboreUser!.sub)) } catch (e) { falha(res, e) }
})

// --- Teste do Ajuste 1, calculado na própria produção ---
router.get('/ajuste1/aceite', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const d = typeof req.query.dia === 'string' && dia.safeParse(req.query.dia).success ? String(req.query.dia) : null
  const item = typeof req.query.item === 'string' && (ITENS_AJUSTE1 as readonly string[]).includes(req.query.item) ? req.query.item as ItemAjuste1 : undefined
  if (!item) { res.status(400).json({ error: `Rode um item por vez: ${ITENS_AJUSTE1.join(', ')}` }); return }
  res.json(await aceiteAjuste1(req.proLaboreUser!.sub, d, new Date(), item))
})

export default router
