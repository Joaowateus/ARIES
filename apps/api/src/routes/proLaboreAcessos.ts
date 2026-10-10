// Acessos da equipe (tela Acessos e permissões): o dono cria logins e escolhe,
// módulo a módulo, o que cada pessoa vê e pode mexer. Quem vende entra no
// ranking e no rodízio; quem só usa o sistema (gerente, financeiro,
// marketing) fica fora. Tudo vale na hora: o login relê o acesso a cada pedido.
import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth, requireDono } from '../middleware/authProLabore'
import { MODULOS, PERFIS, escopoDoPapel, limparPermissoes, papelDoEscopo, permissoesEfetivas, type Permissoes } from '../lib/acessos'

const router = Router()

const SELECT = { id: true, nome: true, email: true, ativo: true, vende: true, papel: true, permissoes: true, senhaHash: true, criadoEm: true } as const
type Linha = { id: string; nome: string; email: string | null; ativo: boolean; vende: boolean; papel: string; permissoes: unknown; senhaHash: string | null; criadoEm: Date }

const iguais = (a: Permissoes, b: Permissoes) => MODULOS.every(m => a[m.chave] === b[m.chave])

function resumo(v: Linha) {
  const escopo = escopoDoPapel(v.papel)
  const permissoes = permissoesEfetivas(v.papel, v.permissoes)
  const perfil = PERFIS.find(p => p.escopo === escopo && iguais(p.permissoes, permissoes))
  return { id: v.id, nome: v.nome, email: v.email, ativo: v.ativo, vende: v.vende, escopo, permissoes, perfil: perfil?.chave ?? null, criadoEm: v.criadoEm }
}

async function emailEmUso(email: string, ignorarVendedorId?: string) {
  const [dono, vendedor, sm] = await Promise.all([
    prisma.proLaboreUsuario.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } }),
    prisma.vendedor.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, ...(ignorarVendedorId ? { NOT: { id: ignorarVendedorId } } : {}) } }),
    prisma.smMembro.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } }),
  ])
  return !!(dono || vendedor || sm)
}

async function listar(usuarioId: string) {
  const [comLogin, semLogin] = await Promise.all([
    prisma.vendedor.findMany({ where: { usuarioId, email: { not: null }, senhaHash: { not: null } }, select: SELECT, orderBy: [{ ativo: 'desc' }, { nome: 'asc' }] }),
    prisma.vendedor.findMany({ where: { usuarioId, ativo: true, OR: [{ email: null }, { senhaHash: null }] }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
  ])
  return { modulos: MODULOS, perfis: PERFIS, acessos: comLogin.map(resumo), semLogin }
}

router.get('/acessos', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  res.json(await listar(req.proLaboreUser!.sub))
})

const nivelSchema = z.enum(['NENHUM', 'VER', 'EDITAR'])
const permissoesSchema = z.record(z.string(), nivelSchema)
const criarSchema = z.object({
  vendedorId: z.string().optional(), // dar login a alguém já cadastrado em Vendedores
  nome: z.string().trim().min(2, 'Informe o nome').max(80).optional(),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha precisa de ao menos 6 caracteres'),
  escopo: z.enum(['PROPRIO', 'EQUIPE']),
  vende: z.boolean().default(true),
  permissoes: permissoesSchema,
}).refine(d => d.vendedorId || d.nome, 'Informe o nome')

router.post('/acessos', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = criarSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const usuarioId = req.proLaboreUser!.sub
  const d = parse.data
  if (await emailEmUso(d.email, d.vendedorId)) { res.status(409).json({ error: 'Esse e-mail já é usado por outro acesso.' }); return }
  const dados = { email: d.email, senhaHash: await bcrypt.hash(d.senha, 10), papel: papelDoEscopo(d.escopo), vende: d.vende, permissoes: limparPermissoes(d.permissoes), ativo: true }
  let id: string
  if (d.vendedorId) {
    const atual = await prisma.vendedor.findFirst({ where: { id: d.vendedorId, usuarioId } })
    if (!atual) { res.status(404).json({ error: 'Pessoa não encontrada' }); return }
    if (atual.email && atual.senhaHash) { res.status(409).json({ error: `${atual.nome} já tem acesso.` }); return }
    id = (await prisma.vendedor.update({ where: { id: atual.id }, data: { ...dados, ...(d.nome ? { nome: d.nome } : {}) } })).id
  } else {
    id = (await prisma.vendedor.create({ data: { usuarioId, nome: d.nome!, ...dados } })).id
  }
  res.status(201).json({ id, ...(await listar(usuarioId)) })
})

const editarSchema = z.object({
  nome: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email('E-mail inválido').optional(),
  escopo: z.enum(['PROPRIO', 'EQUIPE']).optional(),
  vende: z.boolean().optional(),
  ativo: z.boolean().optional(),
  permissoes: permissoesSchema.optional(),
})

async function doDono(req: Request, res: Response) {
  const v = await prisma.vendedor.findFirst({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub, email: { not: null } } })
  if (!v) res.status(404).json({ error: 'Acesso não encontrado' })
  return v
}

router.put('/acessos/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = editarSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const v = await doDono(req, res)
  if (!v) return
  const d = parse.data
  if (d.email && await emailEmUso(d.email, v.id)) { res.status(409).json({ error: 'Esse e-mail já é usado por outro acesso.' }); return }
  await prisma.vendedor.update({
    where: { id: v.id },
    data: {
      ...(d.nome ? { nome: d.nome } : {}),
      ...(d.email ? { email: d.email } : {}),
      ...(d.escopo ? { papel: papelDoEscopo(d.escopo) } : {}),
      ...(d.vende !== undefined ? { vende: d.vende } : {}),
      ...(d.ativo !== undefined ? { ativo: d.ativo } : {}),
      ...(d.permissoes ? { permissoes: limparPermissoes(d.permissoes) } : {}),
    },
  })
  res.json(await listar(req.proLaboreUser!.sub))
})

router.post('/acessos/:id/senha', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = z.object({ senha: z.string().min(6, 'A senha precisa de ao menos 6 caracteres') }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const v = await doDono(req, res)
  if (!v) return
  await prisma.vendedor.update({ where: { id: v.id }, data: { senhaHash: await bcrypt.hash(parse.data.senha, 10) } })
  res.json({ ok: true })
})

// Tira o login. Quem vende continua em Vendedores (histórico de vendas);
// quem só usava o sistema é desativado junto.
router.delete('/acessos/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const v = await doDono(req, res)
  if (!v) return
  await prisma.vendedor.update({ where: { id: v.id }, data: { email: null, senhaHash: null, ...(v.vende ? {} : { ativo: false }) } })
  res.json(await listar(req.proLaboreUser!.sub))
})

export default router
