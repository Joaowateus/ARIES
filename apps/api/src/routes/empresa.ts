import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { signToken } from '../lib/jwt'
import { requireAuth, requirePapel } from '../middleware/auth'

const router = Router()

const criarEmpresaSchema = z.object({
  empresa: z.object({
    nome: z.string().min(2, 'Nome da empresa obrigatório'),
    cnpj: z.string().optional(),
    segmento: z.string().default('motos'),
  }),
  admin: z.object({
    nome: z.string().min(2, 'Nome do administrador obrigatório'),
    email: z.string().email('Email inválido'),
    senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  }),
})

// POST /empresa/setup — cria empresa + admin (primeiro acesso)
router.post('/setup', async (req: Request, res: Response) => {
  const parse = criarEmpresaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const { empresa: empresaData, admin } = parse.data

  const emailExistente = await prisma.usuario.findUnique({ where: { email: admin.email } })
  if (emailExistente) {
    res.status(409).json({ error: 'Este email já está em uso' })
    return
  }

  const senhaHash = await bcrypt.hash(admin.senha, 12)

  const empresa = await prisma.empresa.create({
    data: {
      nome: empresaData.nome,
      cnpj: empresaData.cnpj,
      segmento: empresaData.segmento,
      usuarios: {
        create: {
          nome: admin.nome,
          email: admin.email,
          senhaHash,
          papel: 'ADMINISTRADOR',
          status: 'ATIVO',
        },
      },
    },
    include: { usuarios: true },
  })

  const usuario = empresa.usuarios[0]
  const token = signToken({
    sub: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    papel: usuario.papel,
    empresaId: empresa.id,
  })

  res.status(201).json({
    token,
    empresa: { id: empresa.id, nome: empresa.nome },
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
  })
})

// GET /empresa — dados da empresa do usuário
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const empresa = await prisma.empresa.findUnique({
    where: { id: req.user!.empresaId },
    include: {
      _count: { select: { usuarios: true, unidades: true, oportunidades: true } },
    },
  })
  if (!empresa) {
    res.status(404).json({ error: 'Empresa não encontrada' })
    return
  }
  res.json(empresa)
})

export default router
