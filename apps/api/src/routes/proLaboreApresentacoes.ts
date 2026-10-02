// Apresentações ao vivo (aba Reuniões): o dono monta um mapa mental e a
// equipe inteira assiste em tempo real, sem poder editar. Ver
// lib/apresentacaoTransmissao.ts pra como o "ao vivo" funciona sem WebSocket.
import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth, requireDono } from '../middleware/authProLabore'
import {
  EventoTransmissao, SINAL_APRESENTADOR_MS, aoVivoEfetivo, inscreverEspectador, registrarPresenca, sinalizarMudanca,
} from '../lib/apresentacaoTransmissao'

const router = Router()

const DURACAO_CONEXAO_MS = 24_000
const PULSO_MS = 10_000
const ASSISTINDO_MS = 45_000
const ESPERA_MAXIMA_ESTADO_MS = 8_000

function pessoaDe(req: Request): string {
  const { papel, sub, vendedorId } = req.proLaboreUser!
  return papel === 'DONO' || !vendedorId ? `dono:${sub}` : `vendedor:${vendedorId}`
}
const ehDono = (req: Request) => req.proLaboreUser!.papel === 'DONO'
// Autor de uma apresentação: null = dono da conta; senão a pessoa da equipe.
const autorDe = (req: Request): string | null => (ehDono(req) ? null : pessoaDe(req))
const souAutor = (req: Request, a: { autorPessoa: string | null }) => (a.autorPessoa ?? null) === autorDe(req)

// ---------- Quem da equipe pode apresentar ----------

const MODOS_PERMISSAO = ['APROVACAO', 'LIVRE', 'BLOQUEADO'] as const
type ModoPermissao = (typeof MODOS_PERMISSAO)[number]

async function modoDe(req: Request): Promise<ModoPermissao | 'DONO'> {
  if (ehDono(req)) return 'DONO'
  const p = await prisma.reuniaoPermissao.findUnique({
    where: { usuarioId_pessoa: { usuarioId: req.proLaboreUser!.sub, pessoa: pessoaDe(req) } },
    select: { modo: true },
  })
  return (p?.modo as ModoPermissao | undefined) ?? 'APROVACAO'
}

// Quem vê o quê: o autor vê sempre o que é dele; o resto da equipe só o
// que foi aprovado (e está visível ou ao vivo); o dono vê também os
// pedidos esperando resposta — rascunho da equipe é só de quem montou.
function visivelPara(req: Request, a: { autorPessoa: string | null; aprovacao: string; visivelEquipe: boolean; aoVivo: boolean; apresentadorSinalEm: Date | null }): boolean {
  if (souAutor(req, a)) return true
  if (a.aprovacao !== 'APROVADA') return ehDono(req) && a.aprovacao === 'PENDENTE'
  return ehDono(req) || a.visivelEquipe || aoVivoEfetivo(a)
}

// ---------- Validação do conteúdo ----------

interface NoArvore { id: string; text: string; children: NoArvore[]; collapsed: boolean }

// Árvore vem do motor do navegador — confere formato e limites antes de
// gravar (o mesmo JSON é empurrado pra todos os espectadores).
function arvoreValida(v: unknown): v is NoArvore {
  let total = 0
  const ok = (n: unknown, prof: number): boolean => {
    if (!n || typeof n !== 'object' || prof > 60 || ++total > 3000) return false
    const no = n as Record<string, unknown>
    return typeof no.id === 'string' && no.id.length <= 40
      && typeof no.text === 'string' && no.text.length <= 2000
      && typeof no.collapsed === 'boolean'
      && Array.isArray(no.children) && no.children.every(c => ok(c, prof + 1))
  }
  return ok(v, 0)
}

const arvoreSchema = z.unknown().refine(arvoreValida, 'Mapa inválido ou grande demais (limite de 3.000 ideias)')
const configuracaoSchema = z.object({
  layout: z.enum(['mind', 'org', 'list']),
  tema: z.string().max(30),
  doisLados: z.boolean(),
})
const blocoSchema = z.object({
  id: z.string().max(60),
  tipo: z.string().max(30),
  texto: z.string().max(20_000),
  marcado: z.boolean().optional(),
  icone: z.string().max(20).optional(),
})
const lembreteSchema = z.object({
  id: z.string().max(60),
  texto: z.string().trim().min(1).max(300),
  feito: z.boolean(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

const ARVORE_PADRAO: NoArvore = { id: 'n1', text: 'Tema da apresentação', children: [], collapsed: false }

function contarNos(n: unknown): number {
  const no = n as NoArvore | null
  if (!no || !Array.isArray(no.children)) return 0
  return 1 + no.children.reduce((s, c) => s + contarNos(c), 0)
}

// ---------- Acesso ----------

// Departamentos que essa pessoa pode abrir: o dono abre todos; a equipe,
// os que ela já destrancou com a senha atual (trocar a senha invalida).
async function departamentosLiberados(req: Request): Promise<'todos' | Set<string>> {
  if (ehDono(req)) return 'todos'
  const acessos = await prisma.reuniaoDepartamentoAcesso.findMany({
    where: { pessoa: pessoaDe(req), departamento: { usuarioId: req.proLaboreUser!.sub } },
    select: { departamentoId: true, senhaVersao: true, departamento: { select: { senhaVersao: true } } },
  })
  return new Set(acessos.filter(a => a.senhaVersao === a.departamento.senhaVersao).map(a => a.departamentoId))
}
const liberado = (lib: 'todos' | Set<string>, departamentoId: string | null) => !departamentoId || lib === 'todos' || lib.has(departamentoId)

async function carregar(req: Request, res: Response) {
  const a = await prisma.apresentacao.findUnique({ where: { id: String(req.params.id) } })
  if (!a || a.usuarioId !== req.proLaboreUser!.sub) {
    res.status(404).json({ error: 'Apresentação não encontrada' })
    return null
  }
  if (!visivelPara(req, a)) {
    res.status(404).json({ error: 'Apresentação não encontrada' })
    return null
  }
  if (a.departamentoId && !ehDono(req)) {
    const [dep, acesso] = await Promise.all([
      prisma.reuniaoDepartamento.findUnique({ where: { id: a.departamentoId }, select: { id: true, nome: true, cor: true, senhaVersao: true } }),
      prisma.reuniaoDepartamentoAcesso.findUnique({ where: { departamentoId_pessoa: { departamentoId: a.departamentoId, pessoa: pessoaDe(req) } } }),
    ])
    if (!dep || !acesso || acesso.senhaVersao !== dep.senhaVersao) {
      res.status(403).json({ error: 'Esse departamento pede senha', codigo: 'SENHA_DEPARTAMENTO', departamento: dep && { id: dep.id, nome: dep.nome, cor: dep.cor } })
      return null
    }
  }
  return a
}

// Confere se o destino (departamento/pasta) existe, é da conta e a pasta
// pertence mesmo àquele departamento.
async function destinoInvalido(usuarioId: string, departamentoId: string | null, pastaId: string | null): Promise<string | null> {
  if (departamentoId) {
    const dep = await prisma.reuniaoDepartamento.findFirst({ where: { id: departamentoId, usuarioId }, select: { id: true } })
    if (!dep) return 'Departamento não encontrado'
  }
  if (pastaId) {
    const pasta = await prisma.reuniaoPasta.findFirst({ where: { id: pastaId, usuarioId }, select: { departamentoId: true } })
    if (!pasta) return 'Pasta não encontrada'
    if ((pasta.departamentoId ?? null) !== departamentoId) return 'Essa pasta é de outro departamento'
  }
  return null
}

// Quem é da equipe só cria/move pra departamento que já destrancou.
async function semAcessoAoDestino(req: Request, departamentoId: string | null): Promise<string | null> {
  if (!departamentoId || ehDono(req)) return null
  return liberado(await departamentosLiberados(req), departamentoId) ? null : 'Entre no departamento (com a senha) antes de colocar uma apresentação nele'
}

type ApresentacaoRow = NonNullable<Awaited<ReturnType<typeof prisma.apresentacao.findUnique>>>

function resumo(a: ApresentacaoRow, req: Request) {
  const lembretes = Array.isArray(a.lembretes) ? (a.lembretes as Array<{ feito?: boolean }>) : []
  return {
    id: a.id, titulo: a.titulo, descricao: a.descricao, icone: a.icone, visivelEquipe: a.visivelEquipe,
    departamentoId: a.departamentoId, pastaId: a.pastaId,
    autorNome: a.autorPessoa ? a.autorNome : null, souAutor: souAutor(req, a),
    aprovacao: a.aprovacao, aprovacaoMotivo: a.aprovacaoMotivo, pedidoEm: a.pedidoEm,
    aoVivo: aoVivoEfetivo(a), aoVivoDesde: aoVivoEfetivo(a) ? a.aoVivoDesde : null,
    criadoEm: a.criadoEm, atualizadoEm: a.atualizadoEm,
    totalIdeias: contarNos(a.arvore),
    lembretesPendentes: lembretes.filter(l => !l.feito).length,
  }
}

function detalhe(a: ApresentacaoRow, req: Request) {
  return {
    ...resumo(a, req),
    arvore: a.arvore, configuracao: a.configuracao, notas: a.notas, lembretes: a.lembretes,
    versao: a.versao, palco: a.palco, palcoVersao: a.palcoVersao,
    podeEditar: souAutor(req, a),
    ...(souAutor(req, a) && { notasPrivadas: a.notasPrivadas }),
  }
}

// ---------- Biblioteca ----------

router.get('/apresentacoes', requireProLaboreAuth, async (req: Request, res: Response) => {
  const lista = await prisma.apresentacao.findMany({
    where: { usuarioId: req.proLaboreUser!.sub },
    orderBy: { atualizadoEm: 'desc' },
  })
  const lib = await departamentosLiberados(req)
  res.json(lista.filter(a => visivelPara(req, a) && liberado(lib, a.departamentoId)).map(a => resumo(a, req)))
})

// Usado pelo menu lateral pra mostrar o selo "AO VIVO" pra equipe.
router.get('/apresentacoes/ao-vivo', requireProLaboreAuth, async (req: Request, res: Response) => {
  const lista = await prisma.apresentacao.findMany({
    where: { usuarioId: req.proLaboreUser!.sub, aoVivo: true, aprovacao: 'APROVADA', apresentadorSinalEm: { gte: new Date(Date.now() - SINAL_APRESENTADOR_MS) } },
    select: { id: true, titulo: true, aoVivoDesde: true, departamentoId: true, departamento: { select: { nome: true, cor: true } } },
  })
  const lib = await departamentosLiberados(req)
  // Departamento trancado: a equipe fica sabendo que tem reunião ao vivo,
  // mas o título só aparece depois da senha.
  res.json(lista.map(a => {
    const bloqueado = !liberado(lib, a.departamentoId)
    return {
      id: a.id, aoVivoDesde: a.aoVivoDesde, bloqueado,
      titulo: bloqueado ? 'Reunião protegida' : a.titulo,
      departamento: a.departamento ? { id: a.departamentoId, nome: a.departamento.nome, cor: a.departamento.cor } : null,
    }
  }))
})

// Pedidos esperando o dono (selo no menu lateral).
router.get('/apresentacoes/pendencias', requireProLaboreAuth, async (req: Request, res: Response) => {
  if (!ehDono(req)) {
    res.json({ pedidos: 0 })
    return
  }
  const pedidos = await prisma.apresentacao.count({ where: { usuarioId: req.proLaboreUser!.sub, aprovacao: 'PENDENTE' } })
  res.json({ pedidos })
})

const criarSchema = z.object({
  titulo: z.string().trim().min(1, 'Dê um título').max(120),
  descricao: z.string().max(500).optional(),
  icone: z.string().max(20).optional(),
  arvore: arvoreSchema.optional(),
  configuracao: configuracaoSchema.optional(),
  departamentoId: z.string().nullable().optional(),
  pastaId: z.string().nullable().optional(),
})

router.post('/apresentacoes', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = criarSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const modo = await modoDe(req)
  if (modo === 'BLOQUEADO') {
    res.status(403).json({ error: 'O responsável ainda não liberou você pra apresentar nas reuniões' })
    return
  }
  const { arvore, configuracao, departamentoId = null, pastaId = null, ...resto } = parse.data
  const invalido = await destinoInvalido(req.proLaboreUser!.sub, departamentoId, pastaId) ?? await semAcessoAoDestino(req, departamentoId)
  if (invalido) {
    res.status(400).json({ error: invalido })
    return
  }
  const raiz = (arvore as NoArvore | undefined) ?? { ...ARVORE_PADRAO, text: parse.data.titulo }
  const a = await prisma.apresentacao.create({
    data: {
      ...resto,
      departamentoId,
      pastaId,
      usuarioId: req.proLaboreUser!.sub,
      autorPessoa: autorDe(req),
      autorNome: ehDono(req) ? null : req.proLaboreUser!.nome,
      // Da equipe: nasce rascunho (só quem montou vê) até o dono aprovar —
      // a não ser que a pessoa esteja liberada pra apresentar sem pedir.
      aprovacao: modo === 'DONO' || modo === 'LIVRE' ? 'APROVADA' : 'RASCUNHO',
      arvore: raiz as unknown as Prisma.InputJsonValue,
      configuracao: (configuracao ?? { layout: 'mind', tema: 'meister', doisLados: true }) as Prisma.InputJsonValue,
      notas: [] as Prisma.InputJsonValue,
      lembretes: [] as Prisma.InputJsonValue,
    },
  })
  res.status(201).json(detalhe(a, req))
})

router.get('/apresentacoes/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const a = await carregar(req, res)
  if (!a) return
  if (souAutor(req, a)) {
    res.json(detalhe(a, req))
    return
  }
  const nota = await prisma.apresentacaoNotaPessoal.findUnique({
    where: { apresentacaoId_pessoa: { apresentacaoId: a.id, pessoa: pessoaDe(req) } },
    select: { texto: true },
  })
  res.json({ ...detalhe(a, req), notaPessoal: nota?.texto ?? '' })
})

const atualizarSchema = z.object({
  titulo: z.string().trim().min(1).max(120).optional(),
  descricao: z.string().max(500).nullable().optional(),
  icone: z.string().max(20).nullable().optional(),
  arvore: arvoreSchema.optional(),
  configuracao: configuracaoSchema.optional(),
  notas: z.array(blocoSchema).max(500).optional(),
  lembretes: z.array(lembreteSchema).max(100).optional(),
  notasPrivadas: z.string().max(50_000).nullable().optional(),
  visivelEquipe: z.boolean().optional(),
  // Mover pra outro departamento/pasta (os dois juntos).
  destino: z.object({ departamentoId: z.string().nullable(), pastaId: z.string().nullable() }).optional(),
})

// Salvamento contínuo da tela do apresentador (a cada ~250ms enquanto
// edita). Só o que a equipe vê sobe a `versao` — nota privada não dispara
// nada pros espectadores.
router.put('/apresentacoes/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = atualizarSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const d = parse.data
  if (d.destino) {
    const invalido = await destinoInvalido(req.proLaboreUser!.sub, d.destino.departamentoId, d.destino.pastaId)
      ?? await semAcessoAoDestino(req, d.destino.departamentoId)
    if (invalido) {
      res.status(400).json({ error: invalido })
      return
    }
  }
  // Só quem montou edita. O dono pode, além disso, reorganizar (mover) as
  // apresentações da equipe.
  const soMover = Object.keys(d).every(k => k === 'destino')
  const filtroAutor = ehDono(req) && soMover ? {} : { autorPessoa: autorDe(req) }
  const compartilhado = ['titulo', 'descricao', 'icone', 'arvore', 'configuracao', 'notas', 'lembretes'].some(k => d[k as keyof typeof d] !== undefined)
  // Uma consulta só (sem ler antes): é a rota mais chamada durante a
  // apresentação, e cada ida ao banco atrasa o que a equipe vê.
  let atualizada: { versao: number; atualizadoEm: Date }
  try {
    atualizada = await prisma.apresentacao.update({
    where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub, ...filtroAutor },
    data: {
      ...(d.destino && { departamentoId: d.destino.departamentoId, pastaId: d.destino.pastaId }),
      ...(d.titulo !== undefined && { titulo: d.titulo }),
      ...(d.descricao !== undefined && { descricao: d.descricao }),
      ...(d.icone !== undefined && { icone: d.icone }),
      ...(d.arvore !== undefined && { arvore: d.arvore as unknown as Prisma.InputJsonValue }),
      ...(d.configuracao !== undefined && { configuracao: d.configuracao as Prisma.InputJsonValue }),
      ...(d.notas !== undefined && { notas: d.notas as Prisma.InputJsonValue }),
      ...(d.lembretes !== undefined && { lembretes: d.lembretes as Prisma.InputJsonValue }),
      ...(d.notasPrivadas !== undefined && { notasPrivadas: d.notasPrivadas }),
      ...(d.visivelEquipe !== undefined && { visivelEquipe: d.visivelEquipe }),
      ...(compartilhado && { versao: { increment: 1 } }),
    },
    select: { versao: true, atualizadoEm: true },
  })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      res.status(404).json({ error: 'Apresentação não encontrada' })
      return
    }
    throw e
  }
  if (compartilhado) sinalizarMudanca(String(req.params.id))
  res.json(atualizada)
})

router.delete('/apresentacoes/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  const a = await carregar(req, res)
  if (!a) return
  if (!ehDono(req) && !souAutor(req, a)) {
    res.status(403).json({ error: 'Só quem montou a apresentação pode excluir' })
    return
  }
  await prisma.apresentacao.delete({ where: { id: a.id } })
  res.status(204).end()
})

// "Só pra mim" de quem assiste: cada pessoa guarda a própria nota. Não
// passa pela transmissão nem aparece pro dono (ele tem notasPrivadas).
const notaPessoalSchema = z.object({ texto: z.string().max(50_000) })

router.put('/apresentacoes/:id/minha-nota', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = notaPessoalSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Nota grande demais' })
    return
  }
  const a = await carregar(req, res)
  if (!a) return
  if (souAutor(req, a)) {
    res.status(400).json({ error: 'Quem apresenta usa as notas privadas da própria apresentação' })
    return
  }
  const chave = { apresentacaoId: a.id, pessoa: pessoaDe(req) }
  const { texto } = parse.data
  if (!texto.trim()) {
    await prisma.apresentacaoNotaPessoal.deleteMany({ where: chave })
    res.json({ ok: true })
    return
  }
  await prisma.apresentacaoNotaPessoal.upsert({
    where: { apresentacaoId_pessoa: chave },
    create: { ...chave, texto },
    update: { texto },
  })
  res.json({ ok: true })
})

// ---------- Autorização pra equipe apresentar ----------

// Quem montou pede pra apresentar (ou cancela o pedido). Liberado sem
// pedir = aprova na hora.
router.post('/apresentacoes/:id/pedir', requireProLaboreAuth, async (req: Request, res: Response) => {
  const cancelar = req.body?.cancelar === true
  const a = await carregar(req, res)
  if (!a) return
  if (!souAutor(req, a) || !a.autorPessoa) {
    res.status(400).json({ error: 'Só quem é da equipe pede autorização pra apresentar' })
    return
  }
  if (cancelar) {
    if (a.aprovacao !== 'PENDENTE') {
      res.status(409).json({ error: 'Não há pedido esperando resposta' })
      return
    }
    const r = await prisma.apresentacao.update({ where: { id: a.id }, data: { aprovacao: 'RASCUNHO', pedidoEm: null } })
    res.json(detalhe(r, req))
    return
  }
  if (a.aprovacao === 'APROVADA' || a.aprovacao === 'PENDENTE') {
    res.json(detalhe(a, req))
    return
  }
  const modo = await modoDe(req)
  if (modo === 'BLOQUEADO') {
    res.status(403).json({ error: 'O responsável ainda não liberou você pra apresentar nas reuniões' })
    return
  }
  const r = await prisma.apresentacao.update({
    where: { id: a.id },
    data: modo === 'LIVRE'
      ? { aprovacao: 'APROVADA', aprovacaoMotivo: null, pedidoEm: new Date() }
      : { aprovacao: 'PENDENTE', aprovacaoMotivo: null, pedidoEm: new Date() },
  })
  res.json(detalhe(r, req))
})

// Resposta do dono: aprovar, recusar (com motivo opcional) ou tirar a
// aprovação de uma que já estava liberada.
router.post('/apresentacoes/:id/decisao', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = z.object({
    decisao: z.enum(['APROVAR', 'RECUSAR']),
    motivo: z.string().trim().max(300).optional(),
  }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Decisão inválida' })
    return
  }
  const a = await prisma.apresentacao.findFirst({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub } })
  if (!a || !a.autorPessoa || a.aprovacao === 'RASCUNHO') {
    res.status(404).json({ error: 'Pedido não encontrado' })
    return
  }
  const { decisao, motivo } = parse.data
  const r = await prisma.apresentacao.update({
    where: { id: a.id },
    data: decisao === 'APROVAR'
      ? { aprovacao: 'APROVADA', aprovacaoMotivo: null }
      // Recusar/retirar derruba a transmissão, se estiver no ar.
      : { aprovacao: 'RECUSADA', aprovacaoMotivo: motivo || null, aoVivo: false, palco: Prisma.DbNull, palcoVersao: { increment: 1 } },
  })
  sinalizarMudanca(a.id)
  res.json(detalhe(r, req))
})

// Lista da equipe com o modo de cada um (só o dono).
router.get('/reunioes-permissoes', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const [equipe, permissoes] = await Promise.all([
    prisma.vendedor.findMany({ where: { usuarioId, ativo: true, email: { not: null } }, select: { id: true, nome: true, papel: true }, orderBy: { nome: 'asc' } }),
    prisma.reuniaoPermissao.findMany({ where: { usuarioId } }),
  ])
  const porPessoa = new Map(permissoes.map(p => [p.pessoa, p.modo]))
  res.json(equipe.map(v => ({ vendedorId: v.id, nome: v.nome, papel: v.papel, modo: porPessoa.get(`vendedor:${v.id}`) ?? 'APROVACAO' })))
})

router.put('/reunioes-permissoes/:vendedorId', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = z.object({ modo: z.enum(MODOS_PERMISSAO) }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Modo inválido' })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const v = await prisma.vendedor.findFirst({ where: { id: String(req.params.vendedorId), usuarioId }, select: { id: true } })
  if (!v) {
    res.status(404).json({ error: 'Pessoa não encontrada na equipe' })
    return
  }
  const pessoa = `vendedor:${v.id}`
  await prisma.reuniaoPermissao.upsert({
    where: { usuarioId_pessoa: { usuarioId, pessoa } },
    create: { usuarioId, pessoa, modo: parse.data.modo },
    update: { modo: parse.data.modo },
  })
  res.json({ ok: true })
})

// ---------- Ao vivo: lado do apresentador ----------

router.post('/apresentacoes/:id/ao-vivo', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = z.object({ ativo: z.boolean() }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Informe se a transmissão começa ou termina' })
    return
  }
  const a = await carregar(req, res)
  if (!a) return
  // Quem montou começa e termina; o dono pode encerrar a de qualquer um.
  if (!souAutor(req, a) && !(ehDono(req) && !parse.data.ativo)) {
    res.status(403).json({ error: 'Só quem montou a apresentação pode transmitir' })
    return
  }
  if (parse.data.ativo && a.aprovacao !== 'APROVADA') {
    res.status(403).json({ error: 'Essa apresentação ainda precisa da autorização do responsável', codigo: 'PRECISA_APROVACAO' })
    return
  }
  if (parse.data.ativo && (await modoDe(req)) === 'BLOQUEADO') {
    res.status(403).json({ error: 'O responsável não liberou você pra apresentar' })
    return
  }
  const agora = new Date()
  const atualizada = await prisma.apresentacao.update({
    where: { id: a.id },
    data: parse.data.ativo
      ? { aoVivo: true, aoVivoDesde: aoVivoEfetivo(a) ? a.aoVivoDesde : agora, apresentadorSinalEm: agora }
      : { aoVivo: false, palco: Prisma.DbNull, palcoVersao: { increment: 1 } },
  })
  sinalizarMudanca(a.id)
  res.json(detalhe(atualizada, req))
})

const palcoSchema = z.object({
  // Retângulo do mapa (coordenadas do próprio mapa, não da tela) que o
  // apresentador está vendo — cada espectador enquadra o mesmo pedaço no
  // tamanho da tela dele.
  vista: z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() }).nullable(),
  sel: z.string().max(40).nullable(),
  laser: z.object({ ativo: z.boolean(), pontos: z.array(z.object({ x: z.number(), y: z.number() })).max(30) }),
})

// Estado efêmero da transmissão + sinal de vida do apresentador. Chega
// várias vezes por segundo enquanto ele mexe; a tela manda também um sinal
// a cada ~15s parada, pra transmissão não ser dada como encerrada.
router.put('/apresentacoes/:id/palco', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = palcoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Palco inválido' })
    return
  }
  const r = await prisma.apresentacao.updateMany({
    where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub, autorPessoa: autorDe(req), aoVivo: true },
    data: { palco: parse.data as Prisma.InputJsonValue, palcoVersao: { increment: 1 }, apresentadorSinalEm: new Date() },
  })
  if (r.count > 0) sinalizarMudanca(String(req.params.id))
  res.json({ ok: r.count > 0 })
})

router.get('/apresentacoes/:id/espectadores', requireProLaboreAuth, async (req: Request, res: Response) => {
  const a = await carregar(req, res)
  if (!a) return
  if (!souAutor(req, a)) {
    res.status(403).json({ error: 'Só quem apresenta vê quem está assistindo' })
    return
  }
  const lista = await prisma.apresentacaoEspectador.findMany({ where: { apresentacaoId: a.id }, orderBy: { ultimoSinalEm: 'desc' } })
  const limite = Date.now() - ASSISTINDO_MS
  res.json(lista.map(e => ({ nome: e.nome, entrouEm: e.entrouEm, ultimoSinalEm: e.ultimoSinalEm, assistindo: e.ultimoSinalEm.getTime() >= limite })))
})

// ---------- Ao vivo: lado de quem assiste ----------

function estadoCompleto(a: ApresentacaoRow) {
  return {
    versao: a.versao,
    conteudo: { titulo: a.titulo, descricao: a.descricao, icone: a.icone, arvore: a.arvore, configuracao: a.configuracao, notas: a.notas, lembretes: a.lembretes },
    palcoVersao: a.palcoVersao,
    palco: a.palco,
    aoVivo: aoVivoEfetivo(a),
  }
}

// Conexão de eventos (SSE) de ~24s: manda o estado completo na hora e
// depois só o que mudar. O navegador reabre sozinho quando ela termina.
router.get('/apresentacoes/:id/transmissao', requireProLaboreAuth, async (req: Request, res: Response) => {
  const a = await carregar(req, res)
  if (!a) return
  if (!souAutor(req, a)) void registrarPresenca(a.id, pessoaDe(req), req.proLaboreUser!.nome)

  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  // no-transform: impede o middleware de compressão (e proxies) de
  // segurar o fluxo pra comprimir.
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  let aberto = true
  const escrever = (texto: string) => {
    if (!aberto) return
    res.write(texto)
    ;(res as unknown as { flush?: () => void }).flush?.()
  }
  const enviar = (e: EventoTransmissao | { tipo: 'estado' | 'fim'; [k: string]: unknown }) => escrever(`data: ${JSON.stringify(e)}\n\n`)

  // Preenchimento inicial: alguns proxies só repassam depois de alguns KB.
  escrever(`retry: 800\n: ${' '.repeat(2048)}\n\n`)
  enviar({ tipo: 'estado', ...estadoCompleto(a) })

  const sair = inscreverEspectador(a.id, { versao: a.versao, palcoVersao: a.palcoVersao, aoVivo: aoVivoEfetivo(a) }, enviar)
  const pulso = setInterval(() => escrever(': pulso\n\n'), PULSO_MS)
  const encerrar = () => {
    if (!aberto) return
    clearInterval(pulso)
    clearTimeout(limite)
    sair()
    aberto = false
  }
  const limite = setTimeout(() => {
    enviar({ tipo: 'fim' })
    encerrar()
    res.end()
  }, DURACAO_CONEXAO_MS)
  req.on('close', encerrar)
})

// Modo reserva (se a conexão de eventos não passar pela hospedagem): a
// tela pergunta a cada ~1s e só recebe o que for mais novo do que já tem.
router.get('/apresentacoes/:id/estado', requireProLaboreAuth, async (req: Request, res: Response) => {
  const a = await carregar(req, res)
  if (!a) return
  if (!souAutor(req, a)) void registrarPresenca(a.id, pessoaDe(req), req.proLaboreUser!.nome)
  const versao = Number(req.query.versao ?? -1)
  const palcoVersao = Number(req.query.palcoVersao ?? -1)
  let completo = estadoCompleto(a)
  // Espera segurada: se nada mudou ainda, a resposta fica aberta (até ~8s)
  // e sai no instante em que o observador vê uma mudança — atualiza quase
  // tão rápido quanto a conexão contínua, com poucas requisições.
  const aoVivoCliente = req.query.aoVivo === '1'
  if (req.query.espera === '1' && completo.versao <= versao && completo.palcoVersao <= palcoVersao && completo.aoVivo === aoVivoCliente) {
    await new Promise<void>(resolve => {
      let feito = false
      const terminar = () => { if (feito) return; feito = true; clearTimeout(limite); sair(); resolve() }
      const sair = inscreverEspectador(a.id, { versao, palcoVersao, aoVivo: aoVivoCliente }, () => terminar())
      const limite = setTimeout(terminar, ESPERA_MAXIMA_ESTADO_MS)
      req.on('close', terminar)
    })
    const nova = await prisma.apresentacao.findUnique({ where: { id: a.id } })
    if (!nova) {
      res.status(404).json({ error: 'Apresentação não encontrada' })
      return
    }
    completo = estadoCompleto(nova)
  }
  res.json({
    versao: completo.versao,
    palcoVersao: completo.palcoVersao,
    aoVivo: completo.aoVivo,
    ...(completo.versao > versao && { conteudo: completo.conteudo }),
    ...(completo.palcoVersao > palcoVersao && { palco: completo.palco }),
  })
})


// ---------- Departamentos (com senha) e pastas ----------

const corSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida')
const senhaSchema = z.string().min(4, 'A senha precisa ter pelo menos 4 caracteres').max(64)

// Lista pra montar a barra lateral da aba: todo mundo vê os nomes (pra saber
// que existem), mas pastas e contagens só de quem já destrancou.
router.get('/reunioes-departamentos', requireProLaboreAuth, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const [deps, pastas, apresentacoes, lib] = await Promise.all([
    prisma.reuniaoDepartamento.findMany({ where: { usuarioId }, orderBy: { nome: 'asc' } }),
    prisma.reuniaoPasta.findMany({ where: { usuarioId }, orderBy: { nome: 'asc' } }),
    prisma.apresentacao.findMany({ where: { usuarioId }, select: { departamentoId: true, pastaId: true, visivelEquipe: true, aoVivo: true, apresentadorSinalEm: true, autorPessoa: true, aprovacao: true } }),
    departamentosLiberados(req),
  ])
  const visiveis = apresentacoes.filter(a => visivelPara(req, a))
  const contar = (dep: string | null, pasta?: string) => visiveis.filter(a => a.departamentoId === dep && (pasta === undefined || a.pastaId === pasta)).length
  const pastasDe = (dep: string | null) => pastas.filter(p => (p.departamentoId ?? null) === dep).map(p => ({ id: p.id, nome: p.nome, paiId: p.paiId, total: contar(dep, p.id) }))
  res.json({
    permissao: await modoDe(req),
    pedidosPendentes: ehDono(req) ? apresentacoes.filter(a => a.aprovacao === 'PENDENTE').length : 0,
    geral: { total: contar(null), pastas: pastasDe(null), aoVivo: visiveis.some(a => !a.departamentoId && aoVivoEfetivo(a)) },
    departamentos: deps.map(d => {
      const aberto = liberado(lib, d.id)
      return {
        id: d.id, nome: d.nome, descricao: d.descricao, cor: d.cor, liberado: aberto,
        aoVivo: visiveis.some(a => a.departamentoId === d.id && aoVivoEfetivo(a)),
        total: aberto ? contar(d.id) : null,
        pastas: aberto ? pastasDe(d.id) : [],
      }
    }),
  })
})

router.post('/reunioes-departamentos', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = z.object({
    nome: z.string().trim().min(1, 'Dê um nome ao departamento').max(60),
    descricao: z.string().trim().max(200).optional(),
    cor: corSchema.optional(),
    senha: senhaSchema,
  }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const { senha, ...dados } = parse.data
  const d = await prisma.reuniaoDepartamento.create({
    data: { ...dados, usuarioId: req.proLaboreUser!.sub, senhaHash: await bcrypt.hash(senha, 10) },
  })
  res.status(201).json({ id: d.id, nome: d.nome, descricao: d.descricao, cor: d.cor })
})

router.put('/reunioes-departamentos/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = z.object({
    nome: z.string().trim().min(1).max(60).optional(),
    descricao: z.string().trim().max(200).nullable().optional(),
    cor: corSchema.optional(),
    // Trocar a senha tira o acesso de todo mundo que já tinha entrado.
    senha: senhaSchema.optional(),
  }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const { senha, ...dados } = parse.data
  const r = await prisma.reuniaoDepartamento.updateMany({
    where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub },
    data: { ...dados, ...(senha && { senhaHash: await bcrypt.hash(senha, 10), senhaVersao: { increment: 1 } }) },
  })
  if (r.count === 0) {
    res.status(404).json({ error: 'Departamento não encontrado' })
    return
  }
  res.json({ ok: true })
})

router.delete('/reunioes-departamentos/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const dep = await prisma.reuniaoDepartamento.findFirst({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub }, include: { _count: { select: { apresentacoes: true } } } })
  if (!dep) {
    res.status(404).json({ error: 'Departamento não encontrado' })
    return
  }
  // Nunca solta conteúdo protegido no "Geral" por engano.
  if (dep._count.apresentacoes > 0) {
    res.status(409).json({ error: `Esse departamento ainda tem ${dep._count.apresentacoes} apresentação(ões). Mova ou exclua antes de apagar o departamento.` })
    return
  }
  await prisma.reuniaoDepartamento.delete({ where: { id: dep.id } })
  res.status(204).end()
})

// Tentativas de senha erradas por pessoa+departamento (por instância):
// segura quem tenta adivinhar sem atrapalhar quem só digitou errado.
const tentativasSenha = new Map<string, { erros: number; desde: number }>()
const MAX_TENTATIVAS = 6
const JANELA_TENTATIVAS_MS = 10 * 60_000

router.post('/reunioes-departamentos/:id/entrar', requireProLaboreAuth, async (req: Request, res: Response) => {
  const parse = z.object({ senha: z.string().min(1, 'Digite a senha').max(64) }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const dep = await prisma.reuniaoDepartamento.findFirst({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub } })
  if (!dep) {
    res.status(404).json({ error: 'Departamento não encontrado' })
    return
  }
  const pessoa = pessoaDe(req)
  const chave = `${dep.id}|${pessoa}`
  const agora = Date.now()
  const t = tentativasSenha.get(chave)
  if (t && agora - t.desde < JANELA_TENTATIVAS_MS && t.erros >= MAX_TENTATIVAS) {
    const min = Math.ceil((JANELA_TENTATIVAS_MS - (agora - t.desde)) / 60_000)
    res.status(429).json({ error: `Muitas tentativas erradas. Tente de novo em ${min} min ou peça a senha ao responsável.` })
    return
  }
  if (!(await bcrypt.compare(parse.data.senha, dep.senhaHash))) {
    const atual = t && agora - t.desde < JANELA_TENTATIVAS_MS ? t : { erros: 0, desde: agora }
    tentativasSenha.set(chave, { ...atual, erros: atual.erros + 1 })
    res.status(401).json({ error: 'Senha incorreta' })
    return
  }
  tentativasSenha.delete(chave)
  await prisma.reuniaoDepartamentoAcesso.upsert({
    where: { departamentoId_pessoa: { departamentoId: dep.id, pessoa } },
    update: { senhaVersao: dep.senhaVersao, liberadoEm: new Date() },
    create: { departamentoId: dep.id, pessoa, senhaVersao: dep.senhaVersao },
  })
  res.json({ ok: true })
})

// Profundidade máxima de pastas dentro de pastas.
const MAX_NIVEIS_PASTA = 8

// Valida a pasta "mãe" de uma pasta: do mesmo dono, no mesmo departamento,
// sem passar do limite de níveis e (ao mover) sem cair dentro de si mesma.
async function paiInvalido(usuarioId: string, departamentoId: string | null, paiId: string | null, movendoId?: string): Promise<string | null> {
  if (!paiId) return null
  const todas = await prisma.reuniaoPasta.findMany({ where: { usuarioId }, select: { id: true, paiId: true, departamentoId: true } })
  const porId = new Map(todas.map(p => [p.id, p]))
  const pai = porId.get(paiId)
  if (!pai) return 'Pasta não encontrada'
  if ((pai.departamentoId ?? null) !== departamentoId) return 'A pasta precisa estar no mesmo departamento'
  let nivel = 1
  for (let atual: string | null = paiId; atual; atual = porId.get(atual)?.paiId ?? null) {
    if (movendoId && atual === movendoId) return 'Não dá pra mover uma pasta pra dentro dela mesma'
    if (++nivel > MAX_NIVEIS_PASTA) return `Dá pra ter até ${MAX_NIVEIS_PASTA} níveis de pasta`
  }
  return null
}

router.post('/reunioes-pastas', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = z.object({
    nome: z.string().trim().min(1, 'Dê um nome à pasta').max(60),
    departamentoId: z.string().nullable(),
    paiId: z.string().nullable().optional(),
  }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const { nome, departamentoId, paiId = null } = parse.data
  const invalido = await destinoInvalido(usuarioId, departamentoId, null) ?? await paiInvalido(usuarioId, departamentoId, paiId)
  if (invalido) {
    res.status(400).json({ error: invalido })
    return
  }
  const pasta = await prisma.reuniaoPasta.create({ data: { nome, departamentoId, paiId, usuarioId } })
  res.status(201).json({ id: pasta.id, nome: pasta.nome, departamentoId: pasta.departamentoId, paiId: pasta.paiId })
})

// Renomear e/ou mover pra dentro de outra pasta (do mesmo departamento).
router.put('/reunioes-pastas/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = z.object({ nome: z.string().trim().min(1).max(60).optional(), paiId: z.string().nullable().optional() }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Dados inválidos' })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const pasta = await prisma.reuniaoPasta.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!pasta) {
    res.status(404).json({ error: 'Pasta não encontrada' })
    return
  }
  if (parse.data.paiId !== undefined) {
    if (parse.data.paiId === pasta.id) {
      res.status(400).json({ error: 'Não dá pra mover uma pasta pra dentro dela mesma' })
      return
    }
    const invalido = await paiInvalido(usuarioId, pasta.departamentoId ?? null, parse.data.paiId, pasta.id)
    if (invalido) {
      res.status(400).json({ error: invalido })
      return
    }
  }
  await prisma.reuniaoPasta.update({
    where: { id: pasta.id },
    data: { ...(parse.data.nome ? { nome: parse.data.nome } : {}), ...(parse.data.paiId !== undefined ? { paiId: parse.data.paiId } : {}) },
  })
  res.json({ ok: true })
})

// Excluir a pasta não apaga nada: as subpastas e as apresentações dela sobem
// pra pasta de cima (ou pra raiz do departamento / Geral).
router.delete('/reunioes-pastas/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const pasta = await prisma.reuniaoPasta.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!pasta) {
    res.status(404).json({ error: 'Pasta não encontrada' })
    return
  }
  await prisma.$transaction([
    prisma.reuniaoPasta.updateMany({ where: { paiId: pasta.id, usuarioId }, data: { paiId: pasta.paiId } }),
    prisma.apresentacao.updateMany({ where: { pastaId: pasta.id, usuarioId }, data: { pastaId: pasta.paiId } }),
    prisma.reuniaoPasta.delete({ where: { id: pasta.id } }),
  ])
  res.status(204).end()
})

export default router
