import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requirePapel } from '../middleware/auth'
import { veEquipe } from '../lib/permissoes'

const router = Router()

const ENTIDADES = ['CRM', 'ROTINA', 'ANUNCIO', 'CONTEUDO', 'TREINAMENTO', 'PROCESSO'] as const

const auditoriaSchema = z.object({
  entidadeTipo: z.enum(ENTIDADES),
  entidadeId: z.string(),
  conforme: z.boolean(),
  itensVerificados: z.array(z.object({ item: z.string(), conforme: z.boolean() })).optional(),
  observacoes: z.string().optional(),
})

function apenasEquipe(req: Request, res: Response, next: NextFunction) {
  if (!veEquipe(req.user!.papel)) {
    res.status(403).json({ error: 'Permissão insuficiente' })
    return
  }
  next()
}

router.get('/', requireAuth, apenasEquipe, async (req: Request, res: Response) => {
  const entidadeTipo = typeof req.query.entidadeTipo === 'string' ? req.query.entidadeTipo : undefined
  const auditorias = await prisma.auditoria.findMany({
    where: { empresaId: req.user!.empresaId, ...(entidadeTipo ? { entidadeTipo } : {}) },
    include: { responsavel: { select: { id: true, nome: true } }, planosAcao: true },
    orderBy: { data: 'desc' },
    take: 200,
  })
  res.json(auditorias)
})

router.post('/', requireAuth, apenasEquipe, async (req: Request, res: Response) => {
  const parse = auditoriaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const auditoria = await prisma.auditoria.create({
    data: { ...parse.data, empresaId: req.user!.empresaId, responsavelId: req.user!.sub },
  })
  res.status(201).json(auditoria)
})

// Conformidade % por área — alimenta o painel "Comercial 96%, Marketing
// 91%..." (últimos 90 dias, só entidades com pelo menos 1 auditoria).
router.get('/resumo', requireAuth, apenasEquipe, async (req: Request, res: Response) => {
  const desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const auditorias = await prisma.auditoria.findMany({
    where: { empresaId: req.user!.empresaId, data: { gte: desde } },
    select: { entidadeTipo: true, conforme: true },
  })

  const resumo = ENTIDADES.map(tipo => {
    const doTipo = auditorias.filter(a => a.entidadeTipo === tipo)
    if (doTipo.length === 0) return null
    const conformes = doTipo.filter(a => a.conforme).length
    return { entidadeTipo: tipo, total: doTipo.length, percentualConformidade: conformes / doTipo.length }
  }).filter(Boolean)

  res.json(resumo)
})

// ---------------------------------------------------------------------------
// Planos de Ação — genérico (mesmo padrão de PlanoAcaoProtocolo).
// ---------------------------------------------------------------------------

const planoAcaoSchema = z.object({
  auditoriaId: z.string().optional(),
  origemTipo: z.enum(['AUDITORIA', 'INSIGHT', 'MANUAL']).default('MANUAL'),
  problema: z.string().min(2),
  causa: z.string().optional(),
  solucao: z.string().optional(),
  responsavelId: z.string().optional(),
  prazo: z.coerce.date().optional(),
})

router.get('/planos-acao', requireAuth, apenasEquipe, async (req: Request, res: Response) => {
  const planos = await prisma.planoAcao.findMany({
    where: { empresaId: req.user!.empresaId },
    include: { responsavel: { select: { id: true, nome: true } } },
    orderBy: { criadoEm: 'desc' },
  })
  res.json(planos)
})

router.post('/planos-acao', requireAuth, apenasEquipe, async (req: Request, res: Response) => {
  const parse = planoAcaoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const plano = await prisma.planoAcao.create({ data: { ...parse.data, empresaId: req.user!.empresaId } })
  res.status(201).json(plano)
})

const statusSchema = z.object({ status: z.enum(['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'ATRASADO']) })

router.patch('/planos-acao/:id/status', requireAuth, apenasEquipe, async (req: Request, res: Response) => {
  const parse = statusSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const atualizado = await prisma.planoAcao.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    data: { status: parse.data.status, concluidoEm: parse.data.status === 'CONCLUIDO' ? new Date() : null },
  })
  if (!atualizado.count) {
    res.status(404).json({ error: 'Plano de ação não encontrado' })
    return
  }
  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Log de auditoria genérico (quem alterou o quê) — só administrador vê a
// trilha completa do sistema.
// ---------------------------------------------------------------------------

router.get('/log', requireAuth, requirePapel('ADMINISTRADOR'), async (req: Request, res: Response) => {
  const entidadeTipo = typeof req.query.entidadeTipo === 'string' ? req.query.entidadeTipo : undefined
  const logs = await prisma.logAuditoria.findMany({
    where: { empresaId: req.user!.empresaId, ...(entidadeTipo ? { entidadeTipo } : {}) },
    orderBy: { criadoEm: 'desc' },
    take: 200,
  })
  res.json(logs)
})

export default router
