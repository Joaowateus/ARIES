// Rotas da jornada de 10 etapas (PDF 01): checklist do que falta, mudança de
// etapa com critério, Levantamento e registro de perda pelo motivo da etapa.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { requireModulo } from '../lib/acessos'
import { leadWhereBase } from '../lib/escopoLead'
import { ETAPAS } from '../lib/etapasJornada'
import { ErroJornada, avancarPorFatos, checklist, leadDaJornada, moverEtapa, registrarPerda } from '../lib/jornadaRegras'

const router = Router()
const ver = [requireProLaboreAuth, requireModulo('crm', 'VER')]
const editar = [requireProLaboreAuth, requireModulo('crm', 'EDITAR')]

function falha(res: Response, e: unknown) {
  if (e instanceof ErroJornada) { res.status(e.status).json({ error: e.message, faltando: e.faltando }); return }
  throw e
}
const escopo = (req: Request) => { const { usuarioId, ...resto } = leadWhereBase(req); return { usuarioId, resto } }

router.get('/jornada/leads/:id/checklist', ...ver, async (req: Request, res: Response) => {
  try {
    const { usuarioId, resto } = escopo(req)
    res.json(await checklist(await leadDaJornada(usuarioId, String(req.params.id), resto)))
  } catch (e) { falha(res, e) }
})

const moverSchema = z.object({ etapa: z.enum(ETAPAS), contatoFora: z.boolean().optional() })
router.post('/jornada/leads/:id/etapa', ...editar, async (req: Request, res: Response) => {
  const p = moverSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Etapa inválida' }); return }
  try {
    const { usuarioId, resto } = escopo(req)
    const l = await leadDaJornada(usuarioId, String(req.params.id), resto)
    await moverEtapa(l, p.data.etapa, { contatoFora: p.data.contatoFora })
    res.json(await checklist(await leadDaJornada(usuarioId, l.id)))
  } catch (e) { falha(res, e) }
})

const levantamentoSchema = z.object({
  modeloInteresse: z.string().trim().max(200).nullable().optional(),
  formaPagamento: z.enum(['A_VISTA', 'FINANCIADO']).nullable().optional(),
  situacaoCnh: z.enum(['TEM', 'EM_PROCESSO', 'NAO_TEM']).nullable().optional(),
  temEntrada: z.boolean().nullable().optional(),
})
router.patch('/jornada/leads/:id/levantamento', ...editar, async (req: Request, res: Response) => {
  const p = levantamentoSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  try {
    const { usuarioId, resto } = escopo(req)
    const l = await leadDaJornada(usuarioId, String(req.params.id), resto)
    await prisma.lead.update({ where: { id: l.id }, data: p.data })
    const c = await checklist(await leadDaJornada(usuarioId, l.id))
    await prisma.lead.update({ where: { id: l.id }, data: { levantamentoCompleto: c.levantamentoFalta.length === 0 } })
    res.json(c)
  } catch (e) { falha(res, e) }
})

const perdaSchema = z.object({ motivo: z.string().min(1, 'Escolha o motivo da perda'), nota: z.string().trim().max(2000).optional() })
router.post('/jornada/leads/:id/perda', ...editar, async (req: Request, res: Response) => {
  const p = perdaSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  try {
    const { usuarioId, resto } = escopo(req)
    const l = await leadDaJornada(usuarioId, String(req.params.id), resto)
    const destino = await registrarPerda(l, p.data.motivo, p.data.nota)
    res.json({ ok: true, destino })
  } catch (e) { falha(res, e) }
})

// Reavalia os fatos do lead (ex.: depois de registrar a resposta do banco).
router.post('/jornada/leads/:id/reavaliar', ...editar, async (req: Request, res: Response) => {
  try {
    const { usuarioId, resto } = escopo(req)
    const l = await leadDaJornada(usuarioId, String(req.params.id), resto)
    res.json({ avancou: await avancarPorFatos(l.id) })
  } catch (e) { falha(res, e) }
})

export default router
