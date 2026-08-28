import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requirePapel } from '../middleware/auth'
import { PAPEIS_GESTAO } from '../lib/permissoes'
import { obterMetasComerciais } from '../lib/metasComerciais'

const router = Router()

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const metas = await obterMetasComerciais(prisma, req.user!.empresaId)
  res.json(metas)
})

const metaComercialSchema = z.object({
  supermetaVendasMes: z.number().int().positive().optional(),
  supermetaFaturamentoMes: z.number().positive().optional(),
  metaAnunciosMes: z.number().int().positive().optional(),
})

router.put('/', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const parse = metaComercialSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const empresaId = req.user!.empresaId
  await obterMetasComerciais(prisma, empresaId)
  const meta = await prisma.metaComercialPadrao.update({ where: { empresaId }, data: parse.data })
  res.json(meta)
})

export default router
