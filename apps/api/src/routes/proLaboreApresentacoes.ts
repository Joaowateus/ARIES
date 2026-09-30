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
  // Equipe vê o que está marcado como visível ou o que está ao vivo agora.
  if (!ehDono(req) && !a.visivelEquipe && !aoVivoEfetivo(a)) {
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

type ApresentacaoRow = NonNullable<Awaited<ReturnType<typeof prisma.apresentacao.findUnique>>>

function resumo(a: ApresentacaoRow) {
  const lembretes = Array.isArray(a.lembretes) ? (a.lembretes as Array<{ feito?: boolean }>) : []
  return {
    id: a.id, titulo: a.titulo, descricao: a.descricao, icone: a.icone, visivelEquipe: a.visivelEquipe,
    departamentoId: a.departamentoId, pastaId: a.pastaId,
    aoVivo: aoVivoEfetivo(a), aoVivoDesde: aoVivoEfetivo(a) ? a.aoVivoDesde : null,
    criadoEm: a.criadoEm, atualizadoEm: a.atualizadoEm,
    totalIdeias: contarNos(a.arvore),
    lembretesPendentes: lembretes.filter(l => !l.feito).length,
  }
}

function detalhe(a: ApresentacaoRow, req: Request) {
  return {
    ...resumo(a),
    arvore: a.arvore, configuracao: a.configuracao, notas: a.notas, lembretes: a.lembretes,
    versao: a.versao, palco: a.palco, palcoVersao: a.palcoVersao,
    podeEditar: ehDono(req),
    ...(ehDono(req) && { notasPrivadas: a.notasPrivadas }),
  }
}

// ---------- Biblioteca ----------

router.get('/apresentacoes', requireProLaboreAuth, async (req: Request, res: Response) => {
  const lista = await prisma.apresentacao.findMany({
    where: { usuarioId: req.proLaboreUser!.sub },
    orderBy: { atualizadoEm: 'desc' },
  })
  const lib = await departamentosLiberados(req)
  res.json(lista.filter(a => (ehDono(req) || a.visivelEquipe || aoVivoEfetivo(a)) && liberado(lib, a.departamentoId)).map(resumo))
})

// Usado pelo menu lateral pra mostrar o selo "AO VIVO" pra equipe.
router.get('/apresentacoes/ao-vivo', requireProLaboreAuth, async (req: Request, res: Response) => {
  const lista = await prisma.apresentacao.findMany({
    where: { usuarioId: req.proLaboreUser!.sub, aoVivo: true, apresentadorSinalEm: { gte: new Date(Date.now() - SINAL_APRESENTADOR_MS) } },
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

const criarSchema = z.object({
  titulo: z.string().trim().min(1, 'Dê um título').max(120),
  descricao: z.string().max(500).optional(),
  icone: z.string().max(20).optional(),
  arvore: arvoreSchema.optional(),
  configuracao: configuracaoSchema.optional(),
  departamentoId: z.string().nullable().optional(),
  pastaId: z.string().nullable().optional(),
})

router.post('/apresentacoes', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = criarSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const { arvore, configuracao, departamentoId = null, pastaId = null, ...resto } = parse.data
  const invalido = await destinoInvalido(req.proLaboreUser!.sub, departamentoId, pastaId)
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
  if (ehDono(req)) {
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
router.put('/apresentacoes/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = atualizarSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const d = parse.data
  if (d.destino) {
    const invalido = await destinoInvalido(req.proLaboreUser!.sub, d.destino.departamentoId, d.destino.pastaId)
    if (invalido) {
      res.status(400).json({ error: invalido })
      return
    }
  }
  const compartilhado = ['titulo', 'descricao', 'icone', 'arvore', 'configuracao', 'notas', 'lembretes'].some(k => d[k as keyof typeof d] !== undefined)
  // Uma consulta só (sem ler antes): é a rota mais chamada durante a
  // apresentação, e cada ida ao banco atrasa o que a equipe vê.
  let atualizada: { versao: number; atualizadoEm: Date }
  try {
    atualizada = await prisma.apresentacao.update({
    where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub },
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

router.delete('/apresentacoes/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const a = await carregar(req, res)
  if (!a) return
  await prisma.apresentacao.delete({ where: { id: a.id } })
  res.status(204).end()
})

// "Só pra mim" de quem assiste: cada pessoa guarda a própria nota. Não
// passa pela transmissão nem aparece pro dono (ele tem notasPrivadas).
const notaPessoalSchema = z.object({ texto: z.string().max(50_000) })

router.put('/apresentacoes/:id/minha-nota', requireProLaboreAuth, async (req: Request, res: Response) => {
  if (ehDono(req)) {
    res.status(400).json({ error: 'Quem apresenta usa as notas privadas da própria apresentação' })
    return
  }
  const parse = notaPessoalSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Nota grande demais' })
    return
  }
  const a = await carregar(req, res)
  if (!a) return
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

// ---------- Ao vivo: lado do apresentador ----------

router.post('/apresentacoes/:id/ao-vivo', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = z.object({ ativo: z.boolean() }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Informe se a transmissão começa ou termina' })
    return
  }
  const a = await carregar(req, res)
  if (!a) return
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
router.put('/apresentacoes/:id/palco', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = palcoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Palco inválido' })
    return
  }
  const r = await prisma.apresentacao.updateMany({
    where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub, aoVivo: true },
    data: { palco: parse.data as Prisma.InputJsonValue, palcoVersao: { increment: 1 }, apresentadorSinalEm: new Date() },
  })
  if (r.count > 0) sinalizarMudanca(String(req.params.id))
  res.json({ ok: r.count > 0 })
})

router.get('/apresentacoes/:id/espectadores', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const a = await carregar(req, res)
  if (!a) return
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
  if (!ehDono(req)) void registrarPresenca(a.id, pessoaDe(req), req.proLaboreUser!.nome)

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
  if (!ehDono(req)) void registrarPresenca(a.id, pessoaDe(req), req.proLaboreUser!.nome)
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
    prisma.apresentacao.findMany({ where: { usuarioId }, select: { departamentoId: true, pastaId: true, visivelEquipe: true, aoVivo: true, apresentadorSinalEm: true } }),
    departamentosLiberados(req),
  ])
  const visiveis = apresentacoes.filter(a => ehDono(req) || a.visivelEquipe || aoVivoEfetivo(a))
  const contar = (dep: string | null, pasta?: string) => visiveis.filter(a => a.departamentoId === dep && (pasta === undefined || a.pastaId === pasta)).length
  const pastasDe = (dep: string | null) => pastas.filter(p => (p.departamentoId ?? null) === dep).map(p => ({ id: p.id, nome: p.nome, total: contar(dep, p.id) }))
  res.json({
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

router.post('/reunioes-pastas', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = z.object({ nome: z.string().trim().min(1, 'Dê um nome à pasta').max(60), departamentoId: z.string().nullable() }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const invalido = await destinoInvalido(req.proLaboreUser!.sub, parse.data.departamentoId, null)
  if (invalido) {
    res.status(400).json({ error: invalido })
    return
  }
  const pasta = await prisma.reuniaoPasta.create({ data: { ...parse.data, usuarioId: req.proLaboreUser!.sub } })
  res.status(201).json({ id: pasta.id, nome: pasta.nome, departamentoId: pasta.departamentoId })
})

router.put('/reunioes-pastas/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = z.object({ nome: z.string().trim().min(1).max(60) }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Nome inválido' })
    return
  }
  const r = await prisma.reuniaoPasta.updateMany({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub }, data: parse.data })
  if (r.count === 0) {
    res.status(404).json({ error: 'Pasta não encontrada' })
    return
  }
  res.json({ ok: true })
})

// Excluir a pasta não apaga as apresentações — elas voltam pra raiz do
// departamento (ou do Geral).
router.delete('/reunioes-pastas/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const r = await prisma.reuniaoPasta.deleteMany({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub } })
  if (r.count === 0) {
    res.status(404).json({ error: 'Pasta não encontrada' })
    return
  }
  res.status(204).end()
})

export default router
