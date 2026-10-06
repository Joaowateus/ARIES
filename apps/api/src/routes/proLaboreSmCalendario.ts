// Tela 02 · Calendário editorial (seção 5). Mover um post entre dias usa a
// mesma rota de edição da pauta (PATCH /sm/pautas/:id com agendadoPara),
// que revalida tudo e devolve a pauta para aprovação se for o caso.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM, requireGestorSM, requireModuloSM } from '../lib/smAcesso'
import { calendarioDoMes, carregarConfig, diaLocal, PILARES_MIX } from '../lib/smCalendario'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]

router.get('/sm/calendario', ...autenticado, requireModuloSM('producao', 'LEITURA'), async (req: Request, res: Response) => {
  const mes = typeof req.query.mes === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.mes) ? req.query.mes : diaLocal(new Date()).slice(0, 7)
  const podeEditar = req.sm!.pode('producao', 'COMPLETO') && !req.sm!.somenteLeitura
  const cal = await calendarioDoMes(req.sm!.usuarioId, mes, { podeArrastar: podeEditar })
  res.json({ ...cal, podeEditar, souGestor: req.sm!.visao === 'GESTOR' })
})

const configSchema = z.object({
  minDiasSemana: z.number().int().min(1).max(7),
  maxPostsDia: z.number().int().min(1).max(10),
  maxDiasSemPost: z.number().int().min(1).max(14),
  horizonteDias: z.number().int().min(7).max(90),
  mixMeta: z.object(Object.fromEntries(PILARES_MIX.map(p => [p, z.number().int().min(0).max(100)])) as Record<(typeof PILARES_MIX)[number], z.ZodNumber>)
    .refine(m => Object.values(m).reduce((s, v) => s + v, 0) === 100, 'O mix precisa somar 100%'),
}).partial()

router.put('/sm/gestor/calendario', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  const parse = configSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const usuarioId = req.sm!.usuarioId
  const atual = await carregarConfig(usuarioId)
  const novo = { ...atual, ...parse.data }
  await prisma.smConfig.upsert({ where: { usuarioId }, create: { usuarioId, ...novo }, update: novo })
  res.json(novo)
})

export default router
