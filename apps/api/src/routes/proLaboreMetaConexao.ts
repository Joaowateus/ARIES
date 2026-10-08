// Saúde da conexão com a Meta (Tráfego e Instagram juntos): o estado do
// bloqueio do app, com o passo a passo, e o "Já resolvi: testar agora".
import { Router, Request, Response } from 'express'
import { requireProLaboreAuth, requireDono } from '../middleware/authProLabore'
import { estadoDaConexao } from '../lib/metaConexao'
import { testarConexoesMeta } from '../lib/metaTeste'

const router = Router()

router.get('/meta/conexao', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  res.json(await estadoDaConexao(req.proLaboreUser!.sub))
})

router.post('/meta/conexao/testar', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const r = await testarConexoesMeta(usuarioId)
  res.json({ ...r, estado: await estadoDaConexao(usuarioId) })
})

export default router
