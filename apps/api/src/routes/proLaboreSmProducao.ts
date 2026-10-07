// Tela 03 · Produção e o estoque leve do Social Media (seção 6 e decisão P3).
// Todas as rotas passam pelo contexto do papel (lib/smAcesso.ts): leitura
// pede o módulo em Leitura, escrita em Completo; aprovação é só do gestor.
import express, { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM, requireGestorSM, requireModuloSM } from '../lib/smAcesso'
import { guardarImagem, tipoPelaAssinatura } from '../lib/armazenamento'
import { melhoresJanelas, type JanelasResultado } from '../lib/smJanelas'
import { listarEstoque } from '../lib/smEstoque'
import { gerarPautasDeVendas, sugestoesDeAudiencia } from '../lib/smPautasAuto'
import {
  CAMPOS_DE_CONTEUDO, COLUNAS, FORMATOS, ORIGENS, PILARES, checklistDaPauta, gerarCodigo, marcarAvisosLidos, notificar, pendenciasParaPublicar,
  type Ator,
} from '../lib/smPautas'
import { garantirLinkDaPauta, sincronizarLinks } from '../lib/smAtribuicao'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]
const DIA_MS = 24 * 3600 * 1000
const MAX_UPLOAD = 4 * 1024 * 1024

const ator = (req: Request): Ator => (req.sm!.visao === 'GESTOR' ? 'GESTOR' : 'SOCIAL_MEDIA')
const erro = (res: Response, status: number, mensagem: string, extra?: Record<string, unknown>) => res.status(status).json({ error: mensagem, ...extra })

// ---------- Estoque leve ----------

const SELECT_MOTO = { id: true, modelo: true, marca: true, ano: true, cor: true, entradaEm: true, situacao: true, saidaEm: true, observacao: true } as const

router.get('/sm/estoque', ...autenticado, requireModuloSM('estoque', 'LEITURA'), async (req: Request, res: Response) => {
  res.json(await listarEstoque(req.sm!.usuarioId))
})

// Motos paradas sem conteúdo em produção (botão "Sugestões do estoque").
router.get('/sm/estoque/sugestoes', ...autenticado, requireModuloSM('producao', 'LEITURA'), async (req: Request, res: Response) => {
  if (!req.sm!.pode('estoque', 'LEITURA')) { res.json([]); return }
  const lista = (await listarEstoque(req.sm!.usuarioId))
    .filter(m => m.situacao === 'DISPONIVEL' && m.emProducao === 0 && m.status !== 'OK')
    .sort((a, b) => a.posts - b.posts || b.diasEmEstoque - a.diasEmEstoque)
  res.json(lista)
})

const motoSchema = z.object({
  modelo: z.string().trim().min(2, 'Informe o modelo').max(80),
  marca: z.string().trim().max(40).nullable().optional(),
  ano: z.number().int().min(1950).max(2100).nullable().optional(),
  cor: z.string().trim().max(40).nullable().optional(),
  entradaEm: z.coerce.date(),
  situacao: z.enum(['DISPONIVEL', 'RESERVADA', 'VENDIDA']).optional(),
  saidaEm: z.coerce.date().nullable().optional(),
  observacao: z.string().trim().max(300).nullable().optional(),
})

router.post('/sm/estoque', ...autenticado, requireModuloSM('estoque', 'COMPLETO'), async (req: Request, res: Response) => {
  const parse = motoSchema.safeParse(req.body)
  if (!parse.success) return erro(res, 400, parse.error.issues[0].message)
  const d = parse.data
  const moto = await prisma.smMotoEstoque.create({
    data: { usuarioId: req.sm!.usuarioId, ...d, saidaEm: d.situacao === 'VENDIDA' ? d.saidaEm ?? new Date() : null },
    select: SELECT_MOTO,
  })
  res.status(201).json(moto)
})

router.patch('/sm/estoque/:id', ...autenticado, requireModuloSM('estoque', 'COMPLETO'), async (req: Request, res: Response) => {
  const parse = motoSchema.partial().safeParse(req.body)
  if (!parse.success) return erro(res, 400, parse.error.issues[0].message)
  const atual = await prisma.smMotoEstoque.findFirst({ where: { id: String(req.params.id), usuarioId: req.sm!.usuarioId } })
  if (!atual) return erro(res, 404, 'Moto não encontrada')
  const d = parse.data
  const situacao = d.situacao ?? atual.situacao
  const saidaEm = situacao === 'VENDIDA' ? d.saidaEm ?? atual.saidaEm ?? new Date() : null
  const moto = await prisma.smMotoEstoque.update({ where: { id: atual.id }, data: { ...d, saidaEm }, select: SELECT_MOTO })
  res.json(moto)
})

router.delete('/sm/estoque/:id', ...autenticado, requireModuloSM('estoque', 'COMPLETO'), async (req: Request, res: Response) => {
  const r = await prisma.smMotoEstoque.deleteMany({ where: { id: String(req.params.id), usuarioId: req.sm!.usuarioId } })
  if (!r.count) return erro(res, 404, 'Moto não encontrada')
  res.json({ ok: true })
})

// Sugestões a partir da demografia dos seguidores (origem Audiência).
router.get('/sm/sugestoes/audiencia', ...autenticado, requireModuloSM('producao', 'LEITURA'), async (req: Request, res: Response) => {
  res.json(await sugestoesDeAudiencia(req.sm!.usuarioId))
})

// ---------- Pautas ----------

const INCLUDE_PAUTA = {
  moto: { select: { id: true, modelo: true, ano: true, cor: true } },
  midias: { orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }] },
} satisfies Prisma.SmPautaInclude

type PautaCompleta = Prisma.SmPautaGetPayload<{ include: typeof INCLUDE_PAUTA }>

function inicioDeHojeBrasilia(agora = new Date()) {
  const local = new Date(agora.getTime() - 3 * 3600 * 1000)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + 3 * 3600 * 1000)
}

function serializar(p: PautaCompleta, janelas: JanelasResultado, linkSlug: string | null = null, agora = new Date()) {
  const fechada = p.status === 'AGENDADO' || p.status === 'PUBLICADO'
  return {
    ...p,
    linkSlug, // link rastreado /r/{slug} (seção 3.5)
    checklist: checklistDaPauta(p, janelas),
    checklistManual: p.checklist,
    pendencias: p.status === 'PUBLICADO' ? [] : pendenciasParaPublicar(p, p.midias, agora),
    atrasada: !fechada && !!p.prazo && p.prazo.getTime() < inicioDeHojeBrasilia(agora).getTime(),
  }
}

async function carregar(usuarioId: string, id: string) {
  return prisma.smPauta.findFirst({ where: { id, usuarioId }, include: INCLUDE_PAUTA })
}

async function responderPauta(res: Response, usuarioId: string, id: string, status = 200) {
  const [p, janelas] = await Promise.all([carregar(usuarioId, id), melhoresJanelas(usuarioId)])
  if (!p) return erro(res, 404, 'Pauta não encontrada')
  res.status(status).json(serializar(p, janelas, await garantirLinkDaPauta(p)))
}

router.get('/sm/pautas', ...autenticado, requireModuloSM('producao', 'LEITURA'), async (req: Request, res: Response) => {
  const usuarioId = req.sm!.usuarioId
  await gerarPautasDeVendas(usuarioId)
  const desde = new Date(Date.now() - 45 * DIA_MS)
  const [pautas, janelas, links] = await Promise.all([
    prisma.smPauta.findMany({
      where: { usuarioId, OR: [{ status: { not: 'PUBLICADO' } }, { publicadaEm: { gte: desde } }] },
      include: INCLUDE_PAUTA,
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    }),
    melhoresJanelas(usuarioId),
    sincronizarLinks(usuarioId),
  ])
  res.json({
    pautas: pautas.map(p => serializar(p, janelas, links.get(p.id) ?? null)),
    janelas,
    regras: { aprovacaoGestor: req.sm!.permissoes.regras.aprovacaoGestor },
    podeEditar: req.sm!.pode('producao', 'COMPLETO') && !req.sm!.somenteLeitura,
    souGestor: req.sm!.visao === 'GESTOR',
  })
})

router.get('/sm/pautas/:id', ...autenticado, requireModuloSM('producao', 'LEITURA'), async (req: Request, res: Response) => {
  await responderPauta(res, req.sm!.usuarioId, String(req.params.id))
})

const textoOpcional = (max: number) => z.string().trim().max(max).nullable().optional()

const pautaSchema = z.object({
  titulo: z.string().trim().min(3, 'Dê um título à pauta').max(120),
  pilar: z.enum(PILARES),
  formato: z.enum(FORMATOS),
  prazo: z.coerce.date().nullable().optional(),
  motoId: z.string().nullable().optional(),
  origem: z.enum(ORIGENS).optional(),
  origemRef: z.string().max(80).nullable().optional(),
  gancho: textoOpcional(500),
  retencao: textoOpcional(1000),
  recompensa: textoOpcional(500),
  cta: textoOpcional(300),
  legenda: textoOpcional(2200), // limite do Instagram
  agendadoPara: z.coerce.date().nullable().optional(),
  trial: z.boolean().optional(),
  autorizacaoImagem: z.boolean().optional(),
  checklist: z.object({ capaTexto: z.boolean().optional() }).optional(),
})

async function motoDaConta(usuarioId: string, motoId: string | null | undefined) {
  if (!motoId) return null
  return prisma.smMotoEstoque.findFirst({ where: { id: motoId, usuarioId }, select: { id: true, modelo: true } })
}

router.post('/sm/pautas', ...autenticado, requireModuloSM('producao', 'COMPLETO'), async (req: Request, res: Response) => {
  const parse = pautaSchema.extend({ status: z.enum(['IDEIA', 'ROTEIRO', 'GRAVACAO', 'EDICAO']).optional() }).safeParse(req.body)
  if (!parse.success) return erro(res, 400, parse.error.issues[0].message)
  const usuarioId = req.sm!.usuarioId
  const d = parse.data
  const moto = await motoDaConta(usuarioId, d.motoId)
  if (d.motoId && !moto) return erro(res, 400, 'Moto não encontrada no estoque')
  const criada = await prisma.smPauta.create({
    data: {
      usuarioId,
      titulo: d.titulo, pilar: d.pilar, formato: d.formato, prazo: d.prazo ?? null, motoId: moto?.id ?? null,
      origem: d.origem ?? 'MANUAL', origemRef: d.origemRef ?? (d.origem === 'ESTOQUE' ? moto?.id ?? null : null),
      gancho: d.gancho, retencao: d.retencao, recompensa: d.recompensa, cta: d.cta, legenda: d.legenda,
      agendadoPara: d.agendadoPara ?? null, trial: d.trial ?? false, autorizacaoImagem: d.autorizacaoImagem ?? false,
      checklist: d.checklist ?? {}, status: d.status ?? 'IDEIA', ordem: Date.now(), criadoPor: ator(req),
    },
    include: INCLUDE_PAUTA,
  })
  if (criada.agendadoPara) {
    await prisma.smPauta.update({ where: { id: criada.id }, data: { codigo: await gerarCodigo(usuarioId, { ...criada, agendadoPara: criada.agendadoPara }) } })
  }
  await responderPauta(res, usuarioId, criada.id, 201)
})

/** A pauta pode ser mexida? (publicada ou publicando, não) */
function bloqueadaParaEdicao(p: { status: string; publicacaoStatus: string | null }): string | null {
  if (p.status === 'PUBLICADO') return 'Pauta já publicada'
  if (p.publicacaoStatus === 'PROCESSANDO') return 'A pauta está sendo publicada agora'
  return null
}

/**
 * O Social Media mexeu no conteúdo de uma pauta já aprovada (ou aguardando):
 * com a regra de aprovação ligada, volta para a coluna Aprovação.
 */
function efeitoNaAprovacao(req: Request, p: PautaCompleta, mudouConteudo: boolean): Prisma.SmPautaUpdateInput {
  if (!mudouConteudo || ator(req) === 'GESTOR' || !req.sm!.permissoes.regras.aprovacaoGestor) return {}
  if (p.status === 'AGENDADO' || (p.status === 'APROVACAO' && p.aprovacao === 'APROVADA')) {
    return { status: 'APROVACAO', aprovacao: 'PENDENTE', aprovadaEm: null, enviadaAprovacaoEm: new Date(), publicacaoStatus: null }
  }
  return {}
}

async function avisarGestorDaAprovacao(p: { id: string; usuarioId: string; titulo: string }, alterada = false) {
  await notificar(p.usuarioId, 'GESTOR', 'APROVACAO', `aprovacao:${p.id}`,
    alterada ? `Pauta alterada depois de aprovada: ${p.titulo}` : `Pauta para aprovar: ${p.titulo}`,
    alterada ? 'O conteúdo mudou depois da sua aprovação. Confira de novo antes de ir ao ar.' : 'Abra a Produção para aprovar ou pedir ajuste.',
    { pautaId: p.id })
}

router.patch('/sm/pautas/:id', ...autenticado, requireModuloSM('producao', 'COMPLETO'), async (req: Request, res: Response) => {
  const parse = pautaSchema.partial().safeParse(req.body)
  if (!parse.success) return erro(res, 400, parse.error.issues[0].message)
  const usuarioId = req.sm!.usuarioId
  const p = await carregar(usuarioId, String(req.params.id))
  if (!p) return erro(res, 404, 'Pauta não encontrada')
  const bloqueio = bloqueadaParaEdicao(p)
  if (bloqueio) return erro(res, 409, bloqueio)
  const d = parse.data
  if (d.motoId !== undefined && d.motoId && !(await motoDaConta(usuarioId, d.motoId))) return erro(res, 400, 'Moto não encontrada no estoque')
  const mudouConteudo = CAMPOS_DE_CONTEUDO.some(c => {
    if (!(c in d)) return false
    const novo = d[c as keyof typeof d], antigo = p[c as keyof typeof p]
    return novo instanceof Date || antigo instanceof Date ? (novo as Date | null)?.getTime() !== (antigo as Date | null)?.getTime() : novo !== antigo
  })
  const data: Prisma.SmPautaUpdateInput = {
    ...('titulo' in d && { titulo: d.titulo }), ...('pilar' in d && { pilar: d.pilar }), ...('formato' in d && { formato: d.formato }),
    ...('prazo' in d && { prazo: d.prazo }), ...('gancho' in d && { gancho: d.gancho }), ...('retencao' in d && { retencao: d.retencao }),
    ...('recompensa' in d && { recompensa: d.recompensa }), ...('cta' in d && { cta: d.cta }), ...('legenda' in d && { legenda: d.legenda }),
    ...('agendadoPara' in d && { agendadoPara: d.agendadoPara }), ...('trial' in d && { trial: d.trial }),
    ...('autorizacaoImagem' in d && { autorizacaoImagem: d.autorizacaoImagem }),
    ...('motoId' in d && { moto: d.motoId ? { connect: { id: d.motoId } } : { disconnect: true } }),
    ...('checklist' in d && { checklist: { ...(p.checklist as object), ...d.checklist } }),
    ...efeitoNaAprovacao(req, p, mudouConteudo),
  }
  const atualizada = await prisma.smPauta.update({ where: { id: p.id }, data, include: INCLUDE_PAUTA })
  // O código acompanha a data (#P-DDMM-...).
  if ('agendadoPara' in d || 'formato' in d || 'motoId' in d) {
    const codigo = atualizada.agendadoPara ? await gerarCodigo(usuarioId, { ...atualizada, agendadoPara: atualizada.agendadoPara }) : null
    if (codigo !== atualizada.codigo) await prisma.smPauta.update({ where: { id: p.id }, data: { codigo } })
  }
  if (atualizada.status === 'APROVACAO' && p.status !== 'APROVACAO') await avisarGestorDaAprovacao(atualizada, true)
  await responderPauta(res, usuarioId, p.id)
})

const moverSchema = z.object({ status: z.enum(COLUNAS), ordem: z.number().optional() })

router.post('/sm/pautas/:id/mover', ...autenticado, requireModuloSM('producao', 'COMPLETO'), async (req: Request, res: Response) => {
  const parse = moverSchema.safeParse(req.body)
  if (!parse.success) return erro(res, 400, 'Coluna inválida')
  const usuarioId = req.sm!.usuarioId
  const p = await carregar(usuarioId, String(req.params.id))
  if (!p) return erro(res, 404, 'Pauta não encontrada')
  const bloqueio = bloqueadaParaEdicao(p)
  if (bloqueio) return erro(res, 409, bloqueio)
  const destino = parse.data.status
  const ordem = parse.data.ordem ?? Date.now()
  const quem = ator(req)
  const regraLigada = req.sm!.permissoes.regras.aprovacaoGestor

  if (destino === p.status) {
    await prisma.smPauta.update({ where: { id: p.id }, data: { ordem } })
    return responderPauta(res, usuarioId, p.id)
  }

  let data: Prisma.SmPautaUpdateInput = { status: destino, ordem }
  if (destino === 'APROVACAO') {
    if (!p.agendadoPara) return erro(res, 409, 'Defina a data e a hora da publicação antes de enviar para aprovação', { codigo: 'SEM_DATA' })
    if (quem === 'GESTOR' || !regraLigada) {
      data = { ...data, aprovacao: null }
    } else {
      data = { ...data, aprovacao: 'PENDENTE', enviadaAprovacaoEm: new Date(), aprovadaEm: null, comentarioAprovacao: null }
    }
  } else if (destino === 'AGENDADO') {
    const pendencias = pendenciasParaPublicar(p, p.midias)
    if (pendencias.length) return erro(res, 409, pendencias[0], { codigo: 'PENDENCIAS', pendencias })
    if (quem === 'SOCIAL_MEDIA' && regraLigada && p.aprovacao !== 'APROVADA') {
      return erro(res, 409, 'Só vai para Agendado com a aprovação do gestor. Envie para aprovação.', { codigo: 'PRECISA_APROVACAO' })
    }
    data = { ...data, aprovacao: quem === 'GESTOR' ? 'APROVADA' : p.aprovacao, aprovadaEm: quem === 'GESTOR' ? new Date() : p.aprovadaEm, publicacaoStatus: 'AGUARDANDO', publicacaoTentativas: 0, publicacaoErro: null }
  } else {
    // Voltou para produção: a aprovação anterior deixa de valer.
    data = { ...data, aprovacao: p.aprovacao === 'AJUSTE' ? 'AJUSTE' : null, publicacaoStatus: null, publicacaoContainerId: null }
  }
  await prisma.smPauta.update({ where: { id: p.id }, data })
  if (destino === 'APROVACAO' && quem === 'SOCIAL_MEDIA' && regraLigada) await avisarGestorDaAprovacao(p)
  if (destino !== 'APROVACAO') await marcarAvisosLidos(usuarioId, `aprovacao:${p.id}`)
  await responderPauta(res, usuarioId, p.id)
})

// "Testar como Trial Reel": marca a pauta e segue o mesmo caminho de
// aprovação. Sem data, vai ao ar 15 minutos depois de aprovada.
router.post('/sm/pautas/:id/trial', ...autenticado, requireModuloSM('producao', 'COMPLETO'), async (req: Request, res: Response) => {
  const usuarioId = req.sm!.usuarioId
  const p = await carregar(usuarioId, String(req.params.id))
  if (!p) return erro(res, 404, 'Pauta não encontrada')
  const bloqueio = bloqueadaParaEdicao(p)
  if (bloqueio) return erro(res, 409, bloqueio)
  if (p.formato !== 'REELS') return erro(res, 409, 'Trial Reel só vale para Reels')
  const agendadoPara = p.agendadoPara && p.agendadoPara.getTime() > Date.now() ? p.agendadoPara : new Date(Date.now() + 15 * 60_000)
  const pend = pendenciasParaPublicar({ ...p, agendadoPara, trial: true }, p.midias)
  if (pend.length) return erro(res, 409, pend[0], { codigo: 'PENDENCIAS', pendencias: pend })
  const regraLigada = req.sm!.permissoes.regras.aprovacaoGestor
  const direto = ator(req) === 'GESTOR' || !regraLigada
  await prisma.smPauta.update({
    where: { id: p.id },
    data: {
      trial: true, agendadoPara,
      codigo: await gerarCodigo(usuarioId, { ...p, agendadoPara }),
      ...(direto
        ? { status: 'AGENDADO', aprovacao: ator(req) === 'GESTOR' ? 'APROVADA' : null, aprovadaEm: ator(req) === 'GESTOR' ? new Date() : null, publicacaoStatus: 'AGUARDANDO', publicacaoTentativas: 0 }
        : { status: 'APROVACAO', aprovacao: 'PENDENTE', enviadaAprovacaoEm: new Date() }),
    },
  })
  if (!direto) await avisarGestorDaAprovacao(p)
  await responderPauta(res, usuarioId, p.id)
})

// ---------- Aprovação (gestor) ----------

router.post('/sm/pautas/:id/aprovar', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  const comentario = typeof req.body?.comentario === 'string' ? req.body.comentario.trim().slice(0, 500) || null : null
  const usuarioId = req.sm!.usuarioId
  const p = await carregar(usuarioId, String(req.params.id))
  if (!p) return erro(res, 404, 'Pauta não encontrada')
  if (p.status !== 'APROVACAO') return erro(res, 409, 'A pauta não está aguardando aprovação')
  const pendencias = pendenciasParaPublicar(p, p.midias)
  if (pendencias.length) return erro(res, 409, `Ainda não dá para agendar: ${pendencias[0].toLowerCase()}`, { codigo: 'PENDENCIAS', pendencias })
  await prisma.smPauta.update({
    where: { id: p.id },
    data: { status: 'AGENDADO', aprovacao: 'APROVADA', aprovadaEm: new Date(), comentarioAprovacao: comentario, publicacaoStatus: 'AGUARDANDO', publicacaoTentativas: 0, publicacaoErro: null, ordem: Date.now() },
  })
  await marcarAvisosLidos(usuarioId, `aprovacao:${p.id}`)
  await notificar(usuarioId, 'SOCIAL_MEDIA', 'APROVADA', `aprovacao-resposta:${p.id}`, `Aprovada: ${p.titulo}`, comentario ?? 'Agendada para publicar no horário.', { pautaId: p.id })
  await responderPauta(res, usuarioId, p.id)
})

router.post('/sm/pautas/:id/ajuste', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  const parse = z.object({ comentario: z.string().trim().min(3, 'Diga o que precisa ajustar').max(500) }).safeParse(req.body)
  if (!parse.success) return erro(res, 400, parse.error.issues[0].message)
  const usuarioId = req.sm!.usuarioId
  const p = await carregar(usuarioId, String(req.params.id))
  if (!p) return erro(res, 404, 'Pauta não encontrada')
  if (p.status !== 'APROVACAO' && p.status !== 'AGENDADO') return erro(res, 409, 'A pauta não está em aprovação')
  if (p.publicacaoStatus === 'PROCESSANDO') return erro(res, 409, 'A pauta está sendo publicada agora')
  await prisma.smPauta.update({
    where: { id: p.id },
    data: { status: 'EDICAO', aprovacao: 'AJUSTE', comentarioAprovacao: parse.data.comentario, aprovadaEm: null, publicacaoStatus: null, ordem: Date.now() },
  })
  await marcarAvisosLidos(usuarioId, `aprovacao:${p.id}`)
  await notificar(usuarioId, 'SOCIAL_MEDIA', 'AJUSTE', `aprovacao-resposta:${p.id}`, `Ajuste pedido: ${p.titulo}`, parse.data.comentario, { pautaId: p.id })
  await responderPauta(res, usuarioId, p.id)
})

// Depois de uma falha, tenta publicar de novo na próxima passada do job.
router.post('/sm/pautas/:id/republicar', ...autenticado, requireModuloSM('producao', 'COMPLETO'), async (req: Request, res: Response) => {
  const usuarioId = req.sm!.usuarioId
  const p = await carregar(usuarioId, String(req.params.id))
  if (!p) return erro(res, 404, 'Pauta não encontrada')
  if (p.status !== 'AGENDADO' || p.publicacaoStatus !== 'FALHA') return erro(res, 409, 'Só dá para tentar de novo depois de uma falha')
  const pend = pendenciasParaPublicar({ ...p, agendadoPara: new Date() }, p.midias)
  if (pend.length) return erro(res, 409, pend[0], { codigo: 'PENDENCIAS', pendencias: pend })
  await prisma.smPauta.update({ where: { id: p.id }, data: { publicacaoStatus: 'AGUARDANDO', publicacaoTentativas: 0, publicacaoErro: null, publicacaoContainerId: null } })
  await marcarAvisosLidos(usuarioId, `publicacao-falha:${p.id}`)
  await responderPauta(res, usuarioId, p.id)
})

router.delete('/sm/pautas/:id', ...autenticado, requireModuloSM('producao', 'COMPLETO'), async (req: Request, res: Response) => {
  const usuarioId = req.sm!.usuarioId
  const p = await carregar(usuarioId, String(req.params.id))
  if (!p) return erro(res, 404, 'Pauta não encontrada')
  const bloqueio = bloqueadaParaEdicao(p)
  if (bloqueio) return erro(res, 409, bloqueio)
  await prisma.smPauta.delete({ where: { id: p.id } })
  await marcarAvisosLidos(usuarioId, `aprovacao:${p.id}`)
  res.json({ ok: true })
})

// ---------- Arquivos da pauta ----------

async function aposMudarMidia(req: Request, p: PautaCompleta) {
  const efeito = efeitoNaAprovacao(req, p, true)
  if (Object.keys(efeito).length) {
    await prisma.smPauta.update({ where: { id: p.id }, data: efeito })
    await avisarGestorDaAprovacao(p, true)
  }
}

// Envio binário (application/octet-stream). Imagem para publicar precisa ser
// JPEG (exigência da Meta); capa e termo aceitam JPEG, PNG ou WebP.
router.post('/sm/pautas/:id/midias', ...autenticado, requireModuloSM('producao', 'COMPLETO'),
  express.raw({ type: 'application/octet-stream', limit: MAX_UPLOAD }), async (req: Request, res: Response) => {
    const tipo = String(req.query.tipo ?? 'IMAGEM').toUpperCase()
    if (!['IMAGEM', 'CAPA', 'TERMO'].includes(tipo)) return erro(res, 400, 'Tipo de arquivo inválido')
    const usuarioId = req.sm!.usuarioId
    const p = await carregar(usuarioId, String(req.params.id))
    if (!p) return erro(res, 404, 'Pauta não encontrada')
    const bloqueio = bloqueadaParaEdicao(p)
    if (bloqueio) return erro(res, 409, bloqueio)
    const dados = Buffer.isBuffer(req.body) ? req.body : null
    if (!dados?.length) return erro(res, 400, 'Arquivo vazio')
    if (dados.length > MAX_UPLOAD) return erro(res, 413, 'Arquivo acima de 4 MB')
    const mime = tipoPelaAssinatura(dados)
    if (!mime) return erro(res, 400, 'Envie uma imagem JPEG, PNG ou WebP')
    if (tipo === 'IMAGEM' && mime !== 'image/jpeg') return erro(res, 400, 'Para publicar, a Meta só aceita imagem em JPEG')
    const url = await guardarImagem(usuarioId, dados)
    if (!url) return erro(res, 400, 'Imagem inválida')
    await prisma.smPautaMidia.create({ data: { pautaId: p.id, tipo, url, ordem: p.midias.length } })
    if (tipo === 'IMAGEM') await aposMudarMidia(req, p)
    await responderPauta(res, usuarioId, p.id, 201)
  })

// Vídeo por link público (o envio direto de vídeo depende do armazenamento
// de arquivos, decisão P8).
router.post('/sm/pautas/:id/midias/link', ...autenticado, requireModuloSM('producao', 'COMPLETO'), async (req: Request, res: Response) => {
  const parse = z.object({ tipo: z.enum(['VIDEO', 'IMAGEM']), url: z.string().trim().url('Link inválido').max(1000).refine(u => u.startsWith('https://'), 'Use um link https') }).safeParse(req.body)
  if (!parse.success) return erro(res, 400, parse.error.issues[0].message)
  const usuarioId = req.sm!.usuarioId
  const p = await carregar(usuarioId, String(req.params.id))
  if (!p) return erro(res, 404, 'Pauta não encontrada')
  const bloqueio = bloqueadaParaEdicao(p)
  if (bloqueio) return erro(res, 409, bloqueio)
  await prisma.smPautaMidia.create({ data: { pautaId: p.id, tipo: parse.data.tipo, url: parse.data.url, ordem: p.midias.length } })
  await aposMudarMidia(req, p)
  await responderPauta(res, usuarioId, p.id, 201)
})

router.delete('/sm/pautas/:id/midias/:midiaId', ...autenticado, requireModuloSM('producao', 'COMPLETO'), async (req: Request, res: Response) => {
  const usuarioId = req.sm!.usuarioId
  const p = await carregar(usuarioId, String(req.params.id))
  if (!p) return erro(res, 404, 'Pauta não encontrada')
  const bloqueio = bloqueadaParaEdicao(p)
  if (bloqueio) return erro(res, 409, bloqueio)
  const m = p.midias.find(x => x.id === String(req.params.midiaId))
  if (!m) return erro(res, 404, 'Arquivo não encontrado')
  await prisma.smPautaMidia.delete({ where: { id: m.id } })
  if (m.tipo === 'IMAGEM' || m.tipo === 'VIDEO') await aposMudarMidia(req, p)
  await responderPauta(res, usuarioId, p.id)
})

export default router
