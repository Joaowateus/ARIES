import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { signToken } from '../lib/jwt'
import { requireAuth } from '../middleware/auth'

const router = Router()

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
})

router.post('/login', async (req: Request, res: Response) => {
  const parse = loginSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const { email, senha } = parse.data

  const usuario = await prisma.usuario.findUnique({ where: { email } })
  if (!usuario || usuario.status !== 'ATIVO') {
    res.status(401).json({ error: 'Email ou senha incorretos' })
    return
  }

  const senhaOk = await bcrypt.compare(senha, usuario.senhaHash)
  if (!senhaOk) {
    res.status(401).json({ error: 'Email ou senha incorretos' })
    return
  }

  const token = signToken({
    sub: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    papel: usuario.papel,
    empresaId: usuario.empresaId,
  })

  res.json({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      empresaId: usuario.empresaId,
    },
  })
})

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, nome: true, email: true, papel: true, empresaId: true, status: true },
  })
  if (!usuario) {
    res.status(404).json({ error: 'Usuário não encontrado' })
    return
  }
  res.json(usuario)
})

export default router
