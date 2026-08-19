import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requirePapel } from '../middleware/auth'
import { PAPEIS, PAPEIS_GESTAO } from '../lib/permissoes'

const router = Router()

const criarUsuarioSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(6),
  papel: z.enum(PAPEIS),
  departamento: z.string().optional(),
  gestorId: z.string().optional(),
})

const editarUsuarioSchema = z.object({
  nome: z.string().min(2).optional(),
  papel: z.enum(PAPEIS).optional(),
  departamento: z.string().nullable().optional(),
  gestorId: z.string().nullable().optional(),
})

const usuarioSelect = {
  id: true, nome: true, email: true, papel: true, status: true,
  departamento: true, gestorId: true, criadoEm: true,
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const usuarios = await prisma.usuario.findMany({
    where: { empresaId: req.user!.empresaId },
    select: usuarioSelect,
    orderBy: { nome: 'asc' },
  })
  res.json(usuarios)
})

router.post('/', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const parse = criarUsuarioSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const emailExistente = await prisma.usuario.findUnique({ where: { email: parse.data.email } })
  if (emailExistente) {
    res.status(409).json({ error: 'Email já em uso' })
    return
  }

  if (parse.data.gestorId) {
    const gestor = await prisma.usuario.findFirst({ where: { id: parse.data.gestorId, empresaId: req.user!.empresaId } })
    if (!gestor) {
      res.status(400).json({ error: 'Gestor informado não encontrado' })
      return
    }
  }

  const { senha, ...dados } = parse.data
  const senhaHash = await bcrypt.hash(senha, 12)
  const usuario = await prisma.usuario.create({
    data: {
      ...dados,
      senhaHash,
      empresaId: req.user!.empresaId,
      status: 'ATIVO',
    },
    select: usuarioSelect,
  })
  res.status(201).json(usuario)
})

router.patch('/:id', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const parse = editarUsuarioSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  if (parse.data.gestorId === req.params.id) {
    res.status(400).json({ error: 'Um usuário não pode ser gestor de si mesmo' })
    return
  }
  if (parse.data.gestorId) {
    const gestor = await prisma.usuario.findFirst({ where: { id: parse.data.gestorId, empresaId: req.user!.empresaId } })
    if (!gestor) {
      res.status(400).json({ error: 'Gestor informado não encontrado' })
      return
    }
  }
  const atualizado = await prisma.usuario.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    data: parse.data,
  })
  if (!atualizado.count) {
    res.status(404).json({ error: 'Usuário não encontrado' })
    return
  }
  res.json({ ok: true })
})

router.patch('/:id/status', requireAuth, requirePapel('ADMINISTRADOR', 'GERENTE_COMERCIAL'), async (req: Request, res: Response) => {
  const { status } = req.body
  if (!['ATIVO', 'INATIVO'].includes(status)) {
    res.status(400).json({ error: 'Status inválido' })
    return
  }
  const usuario = await prisma.usuario.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    data: { status },
  })
  if (!usuario.count) {
    res.status(404).json({ error: 'Usuário não encontrado' })
    return
  }
  res.json({ ok: true })
})

export default router
