// Tela 10 · Paleta de comandos (seção 11.3): a busca global e as ações que
// ela dispara (criar a pauta da moto, gerar ganchos). Cada grupo respeita o
// nível do módulo; as perguntas livres vão para o assistente da aba.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM } from '../lib/smAcesso'
import { ErroBusca, buscar, criarPautaDaMoto, ganchosPara } from '../lib/smBusca'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]

function falha(res: Response, e: unknown) {
  if (e instanceof ErroBusca) { res.status(e.status).json({ error: e.message }); return }
  throw e
}

router.get('/sm/busca', ...autenticado, async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').slice(0, 120)
  res.json(await buscar(req.sm!, q))
})

router.post('/sm/busca/pauta', ...autenticado, async (req: Request, res: Response) => {
  const parse = z.object({ motoId: z.string().min(1).max(60) }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Diga a moto' }); return }
  try {
    const r = await criarPautaDaMoto(req.sm!, parse.data.motoId, req.sm!.visao === 'GESTOR' ? 'GESTOR' : 'SOCIAL_MEDIA')
    res.status(r.criada ? 201 : 200).json(r)
  } catch (e) { falha(res, e) }
})

// Só lê e escreve na tela (nada é gravado): vale também na pré-visualização.
router.post('/sm/busca/ganchos', ...autenticado, async (req: Request, res: Response) => {
  const parse = z.object({ motoId: z.string().min(1).max(60).optional(), pautaId: z.string().min(1).max(60).optional() }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Diga a moto ou a pauta' }); return }
  try {
    res.json(await ganchosPara(req.sm!, parse.data))
  } catch (e) { falha(res, e) }
})

export default router
