// Apresentações ao vivo (aba Reuniões): o dono monta um mapa mental e a
// equipe inteira assiste em tempo real, sem poder editar. Ver
// lib/apresentacaoTransmissao.ts pra como o "ao vivo" funciona sem WebSocket.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth, requireDono } from '../middleware/authProLabore'
import {
  EventoTransmissao, SINAL_APRESENTADOR_MS, aoVivoEfetivo, inscreverEspectador, registrarPresenca,
} from '../lib/apresentacaoTransmissao'

const router = Router()

const DURACAO_CONEXAO_MS = 24_000
const PULSO_MS = 10_000
const ASSISTINDO_MS = 45_000

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
  return a
}

type ApresentacaoRow = NonNullable<Awaited<ReturnType<typeof prisma.apresentacao.findUnique>>>

function resumo(a: ApresentacaoRow) {
  const lembretes = Array.isArray(a.lembretes) ? (a.lembretes as Array<{ feito?: boolean }>) : []
  return {
    id: a.id, titulo: a.titulo, descricao: a.descricao, icone: a.icone, visivelEquipe: a.visivelEquipe,
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
  res.json(lista.filter(a => ehDono(req) || a.visivelEquipe || aoVivoEfetivo(a)).map(resumo))
})

// Usado pelo menu lateral pra mostrar o selo "AO VIVO" pra equipe.
router.get('/apresentacoes/ao-vivo', requireProLaboreAuth, async (req: Request, res: Response) => {
  const lista = await prisma.apresentacao.findMany({
    where: { usuarioId: req.proLaboreUser!.sub, aoVivo: true, apresentadorSinalEm: { gte: new Date(Date.now() - SINAL_APRESENTADOR_MS) } },
    select: { id: true, titulo: true, aoVivoDesde: true },
  })
  res.json(lista)
})

const criarSchema = z.object({
  titulo: z.string().trim().min(1, 'Dê um título').max(120),
  descricao: z.string().max(500).optional(),
  icone: z.string().max(20).optional(),
  arvore: arvoreSchema.optional(),
  configuracao: configuracaoSchema.optional(),
})

router.post('/apresentacoes', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = criarSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const { arvore, configuracao, ...resto } = parse.data
  const raiz = (arvore as NoArvore | undefined) ?? { ...ARVORE_PADRAO, text: parse.data.titulo }
  const a = await prisma.apresentacao.create({
    data: {
      ...resto,
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
  res.json(detalhe(a, req))
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
  const a = await carregar(req, res)
  if (!a) return
  const d = parse.data
  const compartilhado = ['titulo', 'descricao', 'icone', 'arvore', 'configuracao', 'notas', 'lembretes'].some(k => d[k as keyof typeof d] !== undefined)
  const atualizada = await prisma.apresentacao.update({
    where: { id: a.id },
    data: {
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
  res.json(atualizada)
})

router.delete('/apresentacoes/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const a = await carregar(req, res)
  if (!a) return
  await prisma.apresentacao.delete({ where: { id: a.id } })
  res.status(204).end()
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
  const completo = estadoCompleto(a)
  res.json({
    versao: completo.versao,
    palcoVersao: completo.palcoVersao,
    aoVivo: completo.aoVivo,
    ...(completo.versao > versao && { conteudo: completo.conteudo }),
    ...(completo.palcoVersao > palcoVersao && { palco: completo.palco }),
  })
})

export default router
