// Saúde do sistema para o dono: hoje, o tamanho do banco contra o limite do
// plano (aviso no topo do painel a partir de 400 MB).
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireDono, requireProLaboreAuth } from '../middleware/authProLabore'
import { tamanhoDoBanco } from '../lib/bancoDisponivel'

const router = Router()

router.get('/sistema/banco', requireProLaboreAuth, requireDono, async (_req: Request, res: Response) => {
  const r = await tamanhoDoBanco(async () => {
    const [{ bytes }] = await prisma.$queryRaw<Array<{ bytes: bigint }>>`SELECT pg_database_size(current_database()) AS bytes`
    return Number(bytes)
  })
  res.json(r)
})

export default router
