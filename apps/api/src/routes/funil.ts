import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requirePapel } from '../middleware/auth'
import { PAPEIS_GESTAO } from '../lib/permissoes'
import { ETAPAS_FUNIL_ORDEM, ESTAGIO_LABEL, METAS_FUNIL_PADRAO } from '../lib/funil'

const router = Router()

async function obterMetasFunil(empresaId: string) {
  const existentes = await prisma.metaFunilEtapa.findMany({ where: { empresaId } })
  const porEtapa = new Map(existentes.map(m => [m.etapa, m]))

  const faltando = Object.entries(METAS_FUNIL_PADRAO).filter(([etapa]) => !porEtapa.has(etapa))
  if (faltando.length) {
    await prisma.$transaction(
      faltando.map(([etapa, cfg]) =>
        prisma.metaFunilEtapa.upsert({
          where: { empresaId_etapa: { empresaId, etapa } },
          update: {},
          create: { empresaId, etapa, metaPct: cfg.metaPct, tipoMeta: cfg.tipoMeta },
        })
      )
    )
    return prisma.metaFunilEtapa.findMany({ where: { empresaId } })
  }
  return existentes
}

router.get('/metas', requireAuth, async (req: Request, res: Response) => {
  const metas = await obterMetasFunil(req.user!.empresaId)
  res.json(metas)
})

const metaFunilSchema = z.object({ metaPct: z.number().min(0).max(1) })

router.put('/metas/:etapa', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const parse = metaFunilSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const etapa = String(req.params.etapa)
  const cfgPadrao = METAS_FUNIL_PADRAO[etapa]
  if (!cfgPadrao) {
    res.status(400).json({ error: 'Etapa inválida' })
    return
  }
  const meta = await prisma.metaFunilEtapa.upsert({
    where: { empresaId_etapa: { empresaId: req.user!.empresaId, etapa } },
    update: { metaPct: parse.data.metaPct },
    create: { empresaId: req.user!.empresaId, etapa, metaPct: parse.data.metaPct, tipoMeta: cfgPadrao.tipoMeta },
  })
  res.json(meta)
})

// ---------------------------------------------------------------------------
// Conversão real por etapa — "quantos leads já passaram por aqui" (via
// EstagioHistorico), não "quantos estão parados aqui agora" (isso já existe
// no Dashboard Executivo). Semáforo compara contra a meta configurável.
// ---------------------------------------------------------------------------

router.get('/conversao', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const metas = await obterMetasFunil(empresaId)
  const metaPorEtapa = new Map(metas.map(m => [m.etapa, m]))

  const historico = await prisma.estagioHistorico.findMany({
    where: { empresaId },
    select: { oportunidadeId: true, estagioNovo: true, criadoEm: true },
  })

  const totalLeads = new Set(historico.filter(h => h.estagioNovo === 'NOVO_LEAD').map(h => h.oportunidadeId)).size

  const alcancados = new Map<string, Set<string>>()
  for (const h of historico) {
    if (!alcancados.has(h.estagioNovo)) alcancados.set(h.estagioNovo, new Set())
    alcancados.get(h.estagioNovo)!.add(h.oportunidadeId)
  }

  const etapas = ETAPAS_FUNIL_ORDEM.map(estagio => {
    const quantidade = alcancados.get(estagio)?.size ?? 0
    const conversaoReal = totalLeads > 0 ? quantidade / totalLeads : 0
    const metaCfg = metaPorEtapa.get(estagio)
    const metaPct = metaCfg?.metaPct ?? METAS_FUNIL_PADRAO[estagio]?.metaPct ?? 0
    const tipoMeta = metaCfg?.tipoMeta ?? METAS_FUNIL_PADRAO[estagio]?.tipoMeta ?? 'MINIMO'

    let status: 'verde' | 'amarelo' | 'vermelho' = 'verde'
    if (tipoMeta === 'MAXIMO_PERDA') {
      if (conversaoReal > metaPct * 1.15) status = 'vermelho'
      else if (conversaoReal > metaPct) status = 'amarelo'
    } else {
      if (conversaoReal < metaPct * 0.85) status = 'vermelho'
      else if (conversaoReal < metaPct) status = 'amarelo'
    }

    return {
      estagio,
      label: ESTAGIO_LABEL[estagio],
      quantidade,
      conversaoReal,
      meta: metaPct,
      tipoMeta,
      diferenca: conversaoReal - metaPct,
      status,
    }
  })

  res.json({ totalLeads, etapas })
})

export default router
