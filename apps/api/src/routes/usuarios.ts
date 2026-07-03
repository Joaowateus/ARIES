import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requirePapel } from '../middleware/auth'

const router = Router()

const criarUsuarioSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(6),
  papel: z.enum(['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL', 'SUPERVISOR', 'VENDEDOR', 'CS', 'FINANCEIRO', 'LEITOR']),
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const usuarios = await prisma.usuario.findMany({
    where: { empresaId: req.user!.empresaId },
    select: { id: true, nome: true, email: true, papel: true, status: true, criadoEm: true },
    orderBy: { nome: 'asc' },
  })
  res.json(usuarios)
})

router.post('/', requireAuth, requirePapel('ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL'), async (req: Request, res: Response) => {
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

  const senhaHash = await bcrypt.hash(parse.data.senha, 12)
  const usuario = await prisma.usuario.create({
    data: {
      ...parse.data,
      senhaHash,
      senha: undefined,
      empresaId: req.user!.empresaId,
      status: 'ATIVO',
    } as any,
    select: { id: true, nome: true, email: true, papel: true, status: true, criadoEm: true },
  })
  res.status(201).json(usuario)
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
