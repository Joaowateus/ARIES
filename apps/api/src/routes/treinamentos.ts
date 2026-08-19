import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requirePapel } from '../middleware/auth'
import { PAPEIS_GESTAO, veEquipe, escopoVisibilidade } from '../lib/permissoes'

const router = Router()

// Vídeo/PDF/documento são só links — a plataforma não hospeda arquivo
// (upload/streaming ficaria pra um passo à parte, com storage dedicado).
const treinamentoSchema = z.object({
  nome: z.string().min(2),
  categoria: z.string().optional(),
  papelAlvo: z.string().nullable().optional(),
  departamento: z.string().optional(),
  descricao: z.string().optional(),
  videoUrl: z.string().optional(),
  pdfUrl: z.string().optional(),
  documentoUrl: z.string().optional(),
  link: z.string().optional(),
  materialComplementar: z.array(z.object({ titulo: z.string(), url: z.string() })).optional(),
  avaliacao: z.array(z.object({ pergunta: z.string(), opcoes: z.array(z.string()), respostaCorreta: z.number() })).optional(),
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const treinamentos = await prisma.treinamento.findMany({
    where: { empresaId: req.user!.empresaId, status: 'ativo', OR: [{ papelAlvo: null }, { papelAlvo: req.user!.papel }] },
    orderBy: { criadoEm: 'desc' },
  })
  res.json(treinamentos)
})

router.post('/', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const parse = treinamentoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const treinamento = await prisma.treinamento.create({ data: { ...parse.data, empresaId: req.user!.empresaId } })
  res.status(201).json(treinamento)
})

// ---------------------------------------------------------------------------
// Progresso — materializa (find-or-create) o registro DISPONIVEL do
// colaborador para cada treinamento aplicável ao seu papel, mesmo padrão de
// Rotina.
// ---------------------------------------------------------------------------

router.get('/progresso', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const usuarioId = req.user!.sub

  const treinamentosAplicaveis = await prisma.treinamento.findMany({
    where: { empresaId, status: 'ativo', OR: [{ papelAlvo: null }, { papelAlvo: req.user!.papel }] },
  })

  const progresso = await Promise.all(
    treinamentosAplicaveis.map(async treinamento => {
      const existente = await prisma.treinamentoProgresso.findUnique({
        where: { treinamentoId_usuarioId: { treinamentoId: treinamento.id, usuarioId } },
      })
      if (existente) return { treinamento, progresso: existente }
      const criado = await prisma.treinamentoProgresso.create({
        data: { empresaId, treinamentoId: treinamento.id, usuarioId, status: 'DISPONIVEL', percentual: 0 },
      })
      return { treinamento, progresso: criado }
    })
  )

  res.json(progresso)
})

const progressoSchema = z.object({
  status: z.enum(['DISPONIVEL', 'INICIADO', 'CONCLUIDO']).optional(),
  percentual: z.number().min(0).max(100).optional(),
  nota: z.number().min(0).max(100).optional(),
})

router.patch('/progresso/:treinamentoId', requireAuth, async (req: Request, res: Response) => {
  const parse = progressoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const atualizado = await prisma.treinamentoProgresso.updateMany({
    where: { treinamentoId: String(req.params.treinamentoId), usuarioId: req.user!.sub, empresaId: req.user!.empresaId },
    data: {
      ...parse.data,
      concluidoEm: parse.data.status === 'CONCLUIDO' ? new Date() : undefined,
    },
  })
  if (!atualizado.count) {
    res.status(404).json({ error: 'Progresso não encontrado — acesse GET /treinamentos/progresso primeiro' })
    return
  }
  res.json({ ok: true })
})

// Visão do gestor: "João — 82% concluído, Pedro — 100%..."
router.get('/progresso/equipe', requireAuth, async (req: Request, res: Response) => {
  if (!veEquipe(req.user!.papel)) {
    res.status(403).json({ error: 'Permissão insuficiente' })
    return
  }
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const usuarioIds = escopo.tipo === 'equipe' ? escopo.usuarioIds : undefined

  const usuarios = await prisma.usuario.findMany({
    where: { empresaId: req.user!.empresaId, status: 'ATIVO', ...(usuarioIds ? { id: { in: usuarioIds } } : {}) },
    select: { id: true, nome: true },
  })

  const resultado = await Promise.all(
    usuarios.map(async u => {
      const progresso = await prisma.treinamentoProgresso.findMany({ where: { empresaId: req.user!.empresaId, usuarioId: u.id } })
      const total = progresso.length
      const concluidos = progresso.filter(p => p.status === 'CONCLUIDO').length
      return { usuario: u, total, concluidos, percentual: total > 0 ? concluidos / total : 0 }
    })
  )

  res.json(resultado)
})

export default router
