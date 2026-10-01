// Preferências de quem está usando (dono ou alguém da equipe), guardadas no
// servidor pra valerem em qualquer aparelho. Hoje: a formatação padrão das
// ideias dos mapas mentais e se tudo que a pessoa escolhe no painel de texto
// vira o padrão automaticamente.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'

const router = Router()

function chave(req: Request) {
  const { papel, sub, vendedorId } = req.proLaboreUser!
  return { usuarioId: sub, pessoa: papel === 'DONO' || !vendedorId ? `dono:${sub}` : `vendedor:${vendedorId}` }
}

const estiloSchema = z.object({
  fonte: z.enum(['sans', 'serif', 'mao', 'mono']).optional(),
  negrito: z.boolean().optional(),
  italico: z.boolean().optional(),
  tamanho: z.enum(['p', 'm', 'g']).optional(),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  largura: z.number().min(80).max(1000).optional(),
}).strict()

const prefSchema = z.object({
  estiloMapa: estiloSchema.nullable().optional(),
  padraoAutomatico: z.boolean().nullable().optional(),
}).strict()

router.get('/preferencias', requireProLaboreAuth, async (req: Request, res: Response) => {
  const p = await prisma.preferenciaProLabore.findUnique({ where: { usuarioId_pessoa: chave(req) } })
  res.json(p?.dados ?? {})
})

// Mescla com o que já existe (null apaga a chave).
router.put('/preferencias', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = prefSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Preferência inválida' })
    return
  }
  const k = chave(req)
  const atual = ((await prisma.preferenciaProLabore.findUnique({ where: { usuarioId_pessoa: k } }))?.dados ?? {}) as Record<string, unknown>
  const novo: Record<string, unknown> = { ...atual }
  for (const [c, v] of Object.entries(parse.data)) {
    if (v === null) delete novo[c]
    else if (v !== undefined) novo[c] = v
  }
  const r = await prisma.preferenciaProLabore.upsert({
    where: { usuarioId_pessoa: k },
    create: { ...k, dados: novo as Prisma.InputJsonValue },
    update: { dados: novo as Prisma.InputJsonValue },
  })
  res.json(r.dados)
})

export default router
