import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requirePapel } from '../middleware/auth'

const router = Router()

const PAPEIS_GESTAO = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL']

// ---------------------------------------------------------------------------
// Protocolo — definição do processo (Pilares 1-3 e 5-7 do framework)
// ---------------------------------------------------------------------------

const listaTexto = z.array(z.string()).optional()
const paresTexto = z.array(z.object({ item: z.string(), prazo: z.string() })).optional() // SLA
const paresKpi = z.array(z.object({ categoria: z.string(), indicador: z.string() })).optional()
// Rotina / Reuniões — array (não objeto) para preservar a ordem das cadências;
// JSONB no Postgres não garante ordem de chaves de objeto.
const chaveValor = z.array(z.object({ chave: z.string(), valor: z.string() })).optional()
const paresContingencia = z.array(z.object({ cenario: z.string(), acao: z.string() })).optional()
const etapasPop = z.array(z.object({
  titulo: z.string(),
  descricao: z.string().optional(),
  checklist: z.array(z.string()).optional(),
})).optional()
const anexos = z.array(z.object({ titulo: z.string(), itens: z.array(z.string()) })).optional()

const protocoloSchema = z.object({
  categoria: z.string().default('Comercial'),
  nome: z.string().min(2),
  versao: z.string().default('1.0.0'),
  status: z.enum(['rascunho', 'ativo', 'em_revisao', 'obsoleto']).default('ativo'),
  ordem: z.number().int().optional(),

  objetivo: z.string().optional(),
  resultadoEsperado: listaTexto,
  responsaveis: listaTexto,

  processo: listaTexto,
  pop: etapasPop,
  regras: listaTexto,
  ferramentas: listaTexto,

  rotina: chaveValor,
  sla: paresTexto,
  kpis: paresKpi,

  auditoriaItens: listaTexto,
  frequenciaAuditoria: z.string().optional(),
  criteriosConformidade: listaTexto,
  naoConformidadesCatalogo: listaTexto,

  reunioes: chaveValor,
  perguntasAnalise: listaTexto,

  riscos: listaTexto,
  planoContingencia: paresContingencia,

  oportunidadesMelhoriaNotas: listaTexto,
  automacoesPossiveis: listaTexto,
  iaAplicavel: listaTexto,
  revisaoFrequencia: z.string().optional(),
  revisaoResponsavel: z.string().optional(),

  anexos,
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const protocolos = await prisma.protocolo.findMany({
    where: { empresaId, status: { not: 'obsoleto' } },
    orderBy: [{ categoria: 'asc' }, { ordem: 'asc' }, { nome: 'asc' }],
  })

  const ids = protocolos.map(p => p.id)
  const [naoConformidadesAbertas, planosAtrasados, ultimasAuditorias] = await Promise.all([
    prisma.naoConformidadeProtocolo.groupBy({
      by: ['protocoloId'],
      where: { protocoloId: { in: ids }, status: { not: 'RESOLVIDA' } },
      _count: true,
    }),
    prisma.planoAcaoProtocolo.groupBy({
      by: ['protocoloId'],
      where: { protocoloId: { in: ids }, status: { in: ['PENDENTE', 'EM_ANDAMENTO', 'ATRASADO'] } },
      _count: true,
    }),
    prisma.auditoriaProtocolo.findMany({
      where: { protocoloId: { in: ids } },
      orderBy: { data: 'desc' },
      distinct: ['protocoloId'],
      select: { protocoloId: true, data: true, conforme: true },
    }),
  ])

  const ncMap = new Map(naoConformidadesAbertas.map(n => [n.protocoloId, n._count]))
  const paMap = new Map(planosAtrasados.map(p => [p.protocoloId, p._count]))
  const auditMap = new Map(ultimasAuditorias.map(a => [a.protocoloId, a]))

  res.json(protocolos.map(p => ({
    id: p.id,
    categoria: p.categoria,
    nome: p.nome,
    versao: p.versao,
    status: p.status,
    naoConformidadesAbertas: ncMap.get(p.id) ?? 0,
    planosAcaoPendentes: paMap.get(p.id) ?? 0,
    ultimaAuditoria: auditMap.get(p.id) ?? null,
  })))
})

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const protocolo = await prisma.protocolo.findFirst({
    where: { id: String(req.params.id), empresaId },
    include: {
      criadoPor: { select: { id: true, nome: true } },
      auditorias: { orderBy: { data: 'desc' }, include: { responsavel: { select: { id: true, nome: true } } } },
      naoConformidades: { orderBy: { data: 'desc' }, include: { planosAcao: true } },
      planosAcao: { orderBy: { criadoEm: 'desc' }, include: { responsavel: { select: { id: true, nome: true } } } },
      melhorias: { orderBy: { criadoEm: 'desc' } },
    },
  })
  if (!protocolo) {
    res.status(404).json({ error: 'Protocolo não encontrado' })
    return
  }
  res.json(protocolo)
})

router.post('/', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const parse = protocoloSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const protocolo = await prisma.protocolo.create({
    data: { ...parse.data, empresaId: req.user!.empresaId, criadoPorId: req.user!.sub },
  })
  res.status(201).json(protocolo)
})

router.patch('/:id', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const parse = protocoloSchema.partial().safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const atualizado = await prisma.protocolo.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    data: parse.data,
  })
  if (!atualizado.count) {
    res.status(404).json({ error: 'Protocolo não encontrado' })
    return
  }
  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Auditoria (Pilar 4 do framework) — execução real, vinculada ao protocolo
// ---------------------------------------------------------------------------

const auditoriaSchema = z.object({
  conforme: z.boolean(),
  itensVerificados: z.array(z.object({ item: z.string(), ok: z.boolean() })).optional(),
  observacoes: z.string().optional(),
  responsavelId: z.string().optional(),
})

router.post('/:id/auditorias', requireAuth, async (req: Request, res: Response) => {
  const parse = auditoriaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const empresaId = req.user!.empresaId
  const protocolo = await prisma.protocolo.findFirst({ where: { id: String(req.params.id), empresaId } })
  if (!protocolo) {
    res.status(404).json({ error: 'Protocolo não encontrado' })
    return
  }
  const auditoria = await prisma.auditoriaProtocolo.create({
    data: {
      empresaId,
      protocoloId: protocolo.id,
      conforme: parse.data.conforme,
      itensVerificados: parse.data.itensVerificados,
      observacoes: parse.data.observacoes,
      responsavelId: parse.data.responsavelId ?? req.user!.sub,
    },
  })
  res.status(201).json(auditoria)
})

// ---------------------------------------------------------------------------
// Não Conformidade (Pilar 4) — falha real encontrada, do catálogo ou livre
// ---------------------------------------------------------------------------

const naoConformidadeSchema = z.object({
  tipo: z.string().min(2),
  descricao: z.string().optional(),
})

router.post('/:id/nao-conformidades', requireAuth, async (req: Request, res: Response) => {
  const parse = naoConformidadeSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const empresaId = req.user!.empresaId
  const protocolo = await prisma.protocolo.findFirst({ where: { id: String(req.params.id), empresaId } })
  if (!protocolo) {
    res.status(404).json({ error: 'Protocolo não encontrado' })
    return
  }
  const nc = await prisma.naoConformidadeProtocolo.create({
    data: { empresaId, protocoloId: protocolo.id, tipo: parse.data.tipo, descricao: parse.data.descricao },
  })
  res.status(201).json(nc)
})

router.patch('/:id/nao-conformidades/:ncId', requireAuth, async (req: Request, res: Response) => {
  const parse = z.object({ status: z.enum(['ABERTA', 'EM_TRATAMENTO', 'RESOLVIDA']) }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const atualizado = await prisma.naoConformidadeProtocolo.updateMany({
    where: { id: String(req.params.ncId), empresaId: req.user!.empresaId, protocoloId: String(req.params.id) },
    data: {
      status: parse.data.status,
      resolvidoEm: parse.data.status === 'RESOLVIDA' ? new Date() : null,
    },
  })
  if (!atualizado.count) {
    res.status(404).json({ error: 'Não conformidade não encontrada' })
    return
  }
  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Plano de Ação (Pilar 5) — Problema → Causa → Solução → Responsável → Prazo
// ---------------------------------------------------------------------------

const planoAcaoSchema = z.object({
  naoConformidadeId: z.string().optional(),
  problema: z.string().min(2),
  causa: z.string().optional(),
  solucao: z.string().optional(),
  responsavelId: z.string().optional(),
  prazo: z.coerce.date().optional(),
})

router.post('/:id/planos-acao', requireAuth, async (req: Request, res: Response) => {
  const parse = planoAcaoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const empresaId = req.user!.empresaId
  const protocolo = await prisma.protocolo.findFirst({ where: { id: String(req.params.id), empresaId } })
  if (!protocolo) {
    res.status(404).json({ error: 'Protocolo não encontrado' })
    return
  }
  const plano = await prisma.planoAcaoProtocolo.create({
    data: { ...parse.data, empresaId, protocoloId: protocolo.id },
  })
  res.status(201).json(plano)
})

router.patch('/:id/planos-acao/:planoId', requireAuth, async (req: Request, res: Response) => {
  const parse = z.object({
    status: z.enum(['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'ATRASADO']).optional(),
    causa: z.string().optional(),
    solucao: z.string().optional(),
  }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const atualizado = await prisma.planoAcaoProtocolo.updateMany({
    where: { id: String(req.params.planoId), empresaId: req.user!.empresaId, protocoloId: String(req.params.id) },
    data: {
      ...parse.data,
      concluidoEm: parse.data.status === 'CONCLUIDO' ? new Date() : undefined,
    },
  })
  if (!atualizado.count) {
    res.status(404).json({ error: 'Plano de ação não encontrado' })
    return
  }
  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Melhoria (Pilar 7) — backlog contínuo por protocolo
// ---------------------------------------------------------------------------

router.post('/:id/melhorias', requireAuth, async (req: Request, res: Response) => {
  const parse = z.object({ descricao: z.string().min(2) }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const empresaId = req.user!.empresaId
  const protocolo = await prisma.protocolo.findFirst({ where: { id: String(req.params.id), empresaId } })
  if (!protocolo) {
    res.status(404).json({ error: 'Protocolo não encontrado' })
    return
  }
  const melhoria = await prisma.melhoriaProtocolo.create({
    data: { empresaId, protocoloId: protocolo.id, descricao: parse.data.descricao },
  })
  res.status(201).json(melhoria)
})

router.patch('/:id/melhorias/:melhoriaId', requireAuth, async (req: Request, res: Response) => {
  const parse = z.object({ status: z.enum(['ABERTA', 'EM_ANALISE', 'IMPLEMENTADA', 'DESCARTADA']) }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const atualizado = await prisma.melhoriaProtocolo.updateMany({
    where: { id: String(req.params.melhoriaId), empresaId: req.user!.empresaId, protocoloId: String(req.params.id) },
    data: { status: parse.data.status },
  })
  if (!atualizado.count) {
    res.status(404).json({ error: 'Melhoria não encontrada' })
    return
  }
  res.json({ ok: true })
})

export default router
