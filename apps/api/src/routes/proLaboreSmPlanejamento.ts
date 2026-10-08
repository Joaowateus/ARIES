// Fase 6 · Planejamento do mês (dia 25) e as datas comerciais do Calendário.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM, requireModuloSM } from '../lib/smAcesso'
import { diaLocal } from '../lib/smCalendario'
import { datasComerciaisEntre } from '../lib/smDatasComerciais'
import { mesSeguinte, planejarMes, situacaoDoPlanejamento } from '../lib/smPlanejamento'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]
const DIA = /^\d{4}-\d{2}-\d{2}$/

// Só o mês atual e o seguinte podem ser pré-carregados.
function mesValido(mes: string, hoje: string) { return mes === hoje.slice(0, 7) || mes === mesSeguinte(hoje) }

router.get('/sm/planejamento', ...autenticado, requireModuloSM('producao', 'LEITURA'), async (req: Request, res: Response) => {
  const hoje = diaLocal(new Date())
  const mes = typeof req.query.mes === 'string' && /^\d{4}-\d{2}$/.test(req.query.mes) ? req.query.mes : mesSeguinte(hoje)
  res.json({ ...(await situacaoDoPlanejamento(req.sm!.usuarioId, mes)), podePlanejar: mesValido(mes, hoje) && !req.sm!.somenteLeitura && req.sm!.pode('producao', 'COMPLETO') })
})

router.post('/sm/planejamento', ...autenticado, requireModuloSM('producao', 'COMPLETO'), async (req: Request, res: Response) => {
  const parse = z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/, 'Mês inválido') }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const hoje = diaLocal(new Date())
  if (!mesValido(parse.data.mes, hoje)) { res.status(400).json({ error: 'Dá para planejar o mês atual ou o seguinte' }); return }
  const sm = req.sm!
  const r = await planejarMes(sm.usuarioId, parse.data.mes, sm.visao === 'GESTOR' ? 'GESTOR' : 'SOCIAL_MEDIA')
  res.json({ ...r, ...(await situacaoDoPlanejamento(sm.usuarioId, parse.data.mes)) })
})

router.get('/sm/datas-comerciais', ...autenticado, requireModuloSM('producao', 'LEITURA'), (req: Request, res: Response) => {
  const de = String(req.query.de ?? ''), ate = String(req.query.ate ?? '')
  if (!DIA.test(de) || !DIA.test(ate) || ate < de) { res.status(400).json({ error: 'Período inválido' }); return }
  res.json(datasComerciaisEntre(de, ate))
})

export default router
