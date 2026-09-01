import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { escopoVisibilidade, escopoWhereDono } from '../lib/permissoes'
import { contarLeadsRegistrados } from '../lib/funil'
import { PLATAFORMAS_TRAFEGO, montarConversaoTrafego, montarConversaoPorCampanha } from '../lib/funilTrafego'

const router = Router()

function parseDataQuery(valor: unknown): Date | undefined {
  if (typeof valor !== 'string' || !valor) return undefined
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? undefined : data
}

function parsePlataformaQuery(valor: unknown): string | undefined {
  return typeof valor === 'string' && (PLATAFORMAS_TRAFEGO as readonly string[]).includes(valor) ? valor : undefined
}

const metricaSchema = z.object({
  data: z.string().refine(v => !Number.isNaN(new Date(v).getTime()), 'Data inválida'),
  plataforma: z.enum(PLATAFORMAS_TRAFEGO).default('META'),
  campanha: z.string().trim().default(''),
  impressoes: z.number().int().nonnegative().default(0),
  cliques: z.number().int().nonnegative().default(0),
  visitasLp: z.number().int().nonnegative().default(0),
  leadsCapturados: z.number().int().nonnegative().default(0),
  valorInvestido: z.number().nonnegative().default(0),
  observacoes: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Conversão do funil de tráfego pago — Impressões/Cliques/Visitas LP/Leads
// capturados vêm do lançamento manual em MetricaTrafegoPago (a mesma tabela
// que a extração automática via Meta/Google Ads Insights vai popular no
// futuro); a última etapa, "Leads no CRM", vem do contador permanente
// LeadRegistrado(tipoLead=TRAFEGO) — o mesmo usado pelo Funil de Vendas
// (/funil/conversao) — pra comparar o que a plataforma diz que gerou contra
// o que de fato virou Oportunidade. Aceita ?inicio=&fim=&plataforma=.
// ---------------------------------------------------------------------------
router.get('/conversao', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const whereUsuario = escopoWhereDono(escopo, 'usuarioId')

  const inicio = parseDataQuery(req.query.inicio)
  const fimQuery = parseDataQuery(req.query.fim)
  const fim = fimQuery ? new Date(fimQuery.getFullYear(), fimQuery.getMonth(), fimQuery.getDate(), 23, 59, 59, 999) : undefined
  const plataforma = parsePlataformaQuery(req.query.plataforma)

  const agregado = await prisma.metricaTrafegoPago.aggregate({
    where: {
      empresaId,
      ...whereUsuario,
      ...(plataforma ? { plataforma } : {}),
      ...(inicio || fim ? { data: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lte: fim } : {}) } } : {}),
    },
    _sum: { impressoes: true, cliques: true, visitasLp: true, leadsCapturados: true, valorInvestido: true },
  })

  const leadsCrm = await contarLeadsRegistrados(prisma, empresaId, whereUsuario, { inicio, fim }, 'TRAFEGO')

  const porCampanhaMetricas = await prisma.metricaTrafegoPago.groupBy({
    by: ['campanha'],
    where: {
      empresaId,
      ...whereUsuario,
      ...(plataforma ? { plataforma } : {}),
      ...(inicio || fim ? { data: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lte: fim } : {}) } } : {}),
    },
    _sum: { impressoes: true, cliques: true, visitasLp: true, leadsCapturados: true, valorInvestido: true },
  })

  const porCampanhaLeads = await prisma.leadRegistrado.groupBy({
    by: ['campanhaTrafego'],
    where: {
      empresaId,
      ...whereUsuario,
      tipoLead: 'TRAFEGO',
      ...(inicio || fim ? { criadoEm: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lte: fim } : {}) } } : {}),
    },
    _count: true,
  })
  const leadsCrmPorCampanha = new Map(porCampanhaLeads.map(g => [g.campanhaTrafego ?? '', g._count]))

  res.json({
    ...montarConversaoTrafego(
      {
        impressoes: agregado._sum.impressoes ?? 0,
        cliques: agregado._sum.cliques ?? 0,
        visitasLp: agregado._sum.visitasLp ?? 0,
        leadsCapturados: agregado._sum.leadsCapturados ?? 0,
        valorInvestido: agregado._sum.valorInvestido ?? 0,
      },
      leadsCrm
    ),
    porCampanha: montarConversaoPorCampanha(
      porCampanhaMetricas.map(g => ({
        campanha: g.campanha,
        impressoes: g._sum.impressoes ?? 0,
        cliques: g._sum.cliques ?? 0,
        visitasLp: g._sum.visitasLp ?? 0,
        leadsCapturados: g._sum.leadsCapturados ?? 0,
        valorInvestido: g._sum.valorInvestido ?? 0,
        leadsCrm: leadsCrmPorCampanha.get(g.campanha) ?? 0,
      }))
    ),
  })
})

// Nomes de campanha já lançados — alimenta o autocomplete tanto do
// lançamento de métrica quanto do campo "Campanha" no cadastro de lead
// (Novo Lead), pra reduzir o nome digitado divergir entre os dois lados.
router.get('/campanhas', requireAuth, async (req: Request, res: Response) => {
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const campanhas = await prisma.metricaTrafegoPago.findMany({
    where: { empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'usuarioId'), campanha: { not: '' } },
    select: { campanha: true },
    distinct: ['campanha'],
    orderBy: { campanha: 'asc' },
  })
  res.json(campanhas.map(c => c.campanha))
})

router.get('/metricas', requireAuth, async (req: Request, res: Response) => {
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const metricas = await prisma.metricaTrafegoPago.findMany({
    where: { empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'usuarioId') },
    include: { usuario: { select: { id: true, nome: true } } },
    orderBy: { data: 'desc' },
    take: 200,
  })
  res.json(metricas)
})

// Um lançamento por usuário/plataforma/dia — reenviar o mesmo dia corrige o
// valor em vez de duplicar (upsert na unique de MetricaTrafegoPago).
router.post('/metricas', requireAuth, async (req: Request, res: Response) => {
  const parse = metricaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const { data, ...resto } = parse.data
  const empresaId = req.user!.empresaId
  const usuarioId = req.user!.sub
  const dataNormalizada = new Date(data)

  const metrica = await prisma.metricaTrafegoPago.upsert({
    where: {
      empresaId_usuarioId_plataforma_campanha_data: {
        empresaId,
        usuarioId,
        plataforma: resto.plataforma,
        campanha: resto.campanha,
        data: dataNormalizada,
      },
    },
    update: resto,
    create: { ...resto, empresaId, usuarioId, data: dataNormalizada },
  })
  res.status(201).json(metrica)
})

router.delete('/metricas/:id', requireAuth, async (req: Request, res: Response) => {
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const deletado = await prisma.metricaTrafegoPago.deleteMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'usuarioId') },
  })
  if (!deletado.count) {
    res.status(404).json({ error: 'Métrica não encontrada' })
    return
  }
  res.json({ ok: true })
})

export default router
