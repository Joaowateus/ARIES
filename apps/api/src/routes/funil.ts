import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { escopoVisibilidade, escopoWhereDono } from '../lib/permissoes'
import { METAS_FUNIL_PADRAO, SLA_PADRAO_DIAS, obterMetasFunil, montarConversaoFunil, contarLeadsRegistrados } from '../lib/funil'

const router = Router()

router.get('/metas', requireAuth, async (req: Request, res: Response) => {
  const metas = await obterMetasFunil(prisma, req.user!.empresaId)
  res.json(metas)
})

const metaFunilSchema = z.object({
  metaPct: z.number().min(0).max(1).optional(),
  tempoMaximoDias: z.number().int().positive().nullable().optional(),
})

// Meta % e SLA por etapa são editáveis por qualquer usuário autenticado — não
// só gestão. É config compartilhada por toda a empresa (todo mundo vê a
// mesma meta), então qualquer vendedor pode corrigir na hora direto pelo
// painel, sem depender de alguém com papel de gestão logado.
router.put('/metas/:etapa', requireAuth, async (req: Request, res: Response) => {
  const parse = metaFunilSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const etapa = String(req.params.etapa)
  const cfgPadrao = METAS_FUNIL_PADRAO[etapa]
  const temSlaPadrao = etapa in SLA_PADRAO_DIAS
  if (!cfgPadrao && !temSlaPadrao) {
    res.status(400).json({ error: 'Etapa inválida' })
    return
  }
  const meta = await prisma.metaFunilEtapa.upsert({
    where: { empresaId_etapa: { empresaId: req.user!.empresaId, etapa } },
    update: parse.data,
    create: {
      empresaId: req.user!.empresaId,
      etapa,
      metaPct: parse.data.metaPct ?? cfgPadrao?.metaPct ?? 0,
      tipoMeta: cfgPadrao?.tipoMeta ?? 'MINIMO',
      tempoMaximoDias: parse.data.tempoMaximoDias ?? SLA_PADRAO_DIAS[etapa] ?? null,
    },
  })
  res.json(meta)
})

// ---------------------------------------------------------------------------
// Conversão real por etapa — "quantos leads já passaram por aqui" (via
// EstagioHistorico), não "quantos estão parados aqui agora" (isso já existe
// no Dashboard Executivo). Semáforo compara contra a meta configurável.
//
// Usa o mesmo escopo de visibilidade do CRM (/oportunidades): vendedor só
// vê o próprio funil, gestão vê equipe/empresa — pra este gráfico bater
// exatamente com o que aparece no board do CRM de quem está olhando.
//
// A etapa "Leads" (e a base de 100% do funil) vem do contador permanente
// LeadRegistrado, não do histórico — assim ela nunca encolhe quando um card
// é apagado do CRM. Aceita ?inicio=YYYY-MM-DD&fim=YYYY-MM-DD pra analisar um
// período específico (dia, semana, mês); sem os parâmetros, é o histórico
// completo.
// ---------------------------------------------------------------------------

function parseDataQuery(valor: unknown): Date | undefined {
  if (typeof valor !== 'string' || !valor) return undefined
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? undefined : data
}

router.get('/conversao', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const metas = await obterMetasFunil(prisma, empresaId)
  const metaPorEtapa = new Map(metas.map(m => [m.etapa, m]))

  const inicio = parseDataQuery(req.query.inicio)
  const fimQuery = parseDataQuery(req.query.fim)
  // Fim inclusivo do dia inteiro, senão "até 25/08" excluiria o próprio 25/08.
  const fim = fimQuery ? new Date(fimQuery.getFullYear(), fimQuery.getMonth(), fimQuery.getDate(), 23, 59, 59, 999) : undefined

  const escopo = await escopoVisibilidade(prisma, req.user!)
  const oportunidadesEscopo = await prisma.oportunidade.findMany({
    where: { empresaId, ...escopoWhereDono(escopo, 'responsavelId') },
    select: { id: true },
  })

  const historico = await prisma.estagioHistorico.findMany({
    where: {
      empresaId,
      oportunidadeId: { in: oportunidadesEscopo.map(o => o.id) },
      ...(inicio || fim ? { criadoEm: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lte: fim } : {}) } } : {}),
    },
    select: { oportunidadeId: true, estagioNovo: true, criadoEm: true },
  })

  const totalLeadsRegistrados = await contarLeadsRegistrados(prisma, empresaId, escopoWhereDono(escopo, 'usuarioId'), { inicio, fim })

  res.json(montarConversaoFunil(historico, metaPorEtapa, totalLeadsRegistrados))
})

export default router
