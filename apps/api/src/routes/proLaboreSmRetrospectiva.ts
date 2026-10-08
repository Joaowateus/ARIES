// Tela 11 · Retrospectiva da semana (seção 11.4): leitura, "Enviar ao gestor"
// e salvar o gancho do post da semana. A geração automática da sexta e o
// relatório de segunda rodam no job de hora em hora (/sm/cron/hora).
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM } from '../lib/smAcesso'
import { ErroRetro, enviarAoGestor, montarRetrospectiva, salvarGanchoDaSemana } from '../lib/smRetrospectiva'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]
const semanaSchema = z.object({ semana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Semana inválida') })

function falha(res: Response, e: unknown) {
  if (e instanceof ErroRetro) { res.status(e.status).json({ error: e.message }); return }
  throw e
}

router.get('/sm/retrospectiva', ...autenticado, async (req: Request, res: Response) => {
  const semana = typeof req.query.semana === 'string' && req.query.semana ? req.query.semana : null
  try { res.json(await montarRetrospectiva(req.sm!, semana)) } catch (e) { falha(res, e) }
})

router.post('/sm/retrospectiva/enviar', ...autenticado, async (req: Request, res: Response) => {
  const parse = semanaSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const sm = req.sm!
  const membro = sm.membroId ? await prisma.smMembro.findUnique({ where: { id: sm.membroId }, select: { nome: true, tratamento: true } }) : null
  const nome = membro?.tratamento ?? membro?.nome.split(' ')[0] ?? 'O Social Media'
  try { res.json(await enviarAoGestor(sm, parse.data.semana, nome)) } catch (e) { falha(res, e) }
})

router.post('/sm/retrospectiva/gancho', ...autenticado, async (req: Request, res: Response) => {
  const parse = semanaSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  try { res.json(await salvarGanchoDaSemana(req.sm!, parse.data.semana)) } catch (e) { falha(res, e) }
})

export default router
