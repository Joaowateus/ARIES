// Base de conhecimento do Assistente Comercial (aba "Conhecimento"): a
// biblioteca da loja com dúvidas, objeções, argumentos e gatilhos, o que os
// clientes mais perguntaram e o que o aprendizado trouxe para revisar.
// A base é da conta inteira; aprovar ou arquivar (o que muda o que o robô
// diz aos clientes) é da gestão — o vendedor sugere e rascunha.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { requireModulo } from '../lib/acessos'
import { ETAPAS_CONHECIMENTO, STATUS_CONHECIMENTO, TIPOS_CONHECIMENTO, normalizarPalavraChave } from '../lib/assistenteConhecimento'
import { CHAVE_OUTRAS, aprenderConta, garantirModelosProntos } from '../lib/assistenteAprendizado'
import { iaLigada } from '../lib/assistenteIA'
import { esquecerRespostasAtivas } from '../lib/assistenteRespostas'

const router = Router()
// Qualquer mudança na base vale na próxima mensagem do robô (sem esperar o cache).
router.use('/assistente/conhecimento', (req: Request, res: Response, next) => {
  if (req.method !== 'GET') res.on('finish', () => { if (req.proLaboreUser) esquecerRespostasAtivas(req.proLaboreUser.sub) })
  next()
})
const DIA = 86_400_000
const ver = [requireProLaboreAuth, requireModulo('assistente', 'VER')]
const editar = [requireProLaboreAuth, requireModulo('assistente', 'EDITAR')]
const daGestao = (req: Request) => req.proLaboreUser!.papel === 'DONO' || req.proLaboreUser!.papel === 'SUPERVISOR'
const autor = (req: Request) => req.proLaboreUser!.nome ?? null
const erro = (res: Response, status: number, mensagem: string) => res.status(status).json({ error: mensagem })

const palavras = z.array(z.string().max(60)).max(20).transform(l => [...new Set(l.map(normalizarPalavraChave).filter(p => p.length >= 2))])

router.get('/assistente/conhecimento', ...ver, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  await garantirModelosProntos(usuarioId)
  const dias = Math.min(90, Math.max(1, Number(req.query.dias) || 7))
  const desde = new Date(Date.now() - dias * DIA)
  const [itens, noPeriodo, recentes, estado] = await Promise.all([
    prisma.assistenteConhecimento.findMany({ where: { usuarioId }, orderBy: [{ ocorrencias: 'desc' }, { criadoEm: 'asc' }] }),
    prisma.assistenteConhecimentoOcorrencia.groupBy({ by: ['conhecimentoId'], where: { usuarioId, criadoEm: { gte: desde } }, _count: { _all: true } }),
    prisma.assistenteConhecimentoOcorrencia.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'desc' }, take: 1500, select: { conhecimentoId: true, texto: true, criadoEm: true } }),
    prisma.assistenteAprendizadoEstado.findUnique({ where: { usuarioId } }),
  ])
  const contagem = new Map(noPeriodo.map(g => [g.conhecimentoId, g._count._all]))
  const exemplos = new Map<string, Array<{ texto: string; em: Date }>>()
  for (const o of recentes) {
    const l = exemplos.get(o.conhecimentoId) ?? []
    if (l.length < 4 && !l.some(x => x.texto === o.texto)) l.push({ texto: o.texto, em: o.criadoEm })
    exemplos.set(o.conhecimentoId, l)
  }
  const lista = itens.map(i => ({ ...i, outras: i.chave === CHAVE_OUTRAS, noPeriodo: contagem.get(i.id) ?? 0, exemplos: exemplos.get(i.id) ?? [] }))
  const captadas = noPeriodo.reduce((s, g) => s + g._count._all, 0)
  res.json({
    itens: lista,
    dias,
    totais: {
      paraRevisar: itens.filter(i => i.status === 'PARA_REVISAR').length,
      ativos: itens.filter(i => i.status === 'ATIVO').length,
      arquivados: itens.filter(i => i.status === 'ARQUIVADO').length,
      captadasNoPeriodo: captadas,
      // Perguntas que o robô ainda não saberia responder (assunto sem resposta aprovada).
      semRespostaNoPeriodo: lista.filter(i => i.status !== 'ATIVO').reduce((s, i) => s + i.noPeriodo, 0),
    },
    ranking: lista.filter(i => i.noPeriodo > 0).sort((a, b) => b.noPeriodo - a.noPeriodo).slice(0, 10)
      .map(i => ({ id: i.id, titulo: i.titulo, tipo: i.tipo, status: i.status, total: i.noPeriodo })),
    ultimaAnalise: estado?.rodadaEm ?? null,
    iaLigada: iaLigada(),
    podeAprovar: daGestao(req),
  })
})

const criarSchema = z.object({
  tipo: z.enum(TIPOS_CONHECIMENTO),
  titulo: z.string().trim().min(3, 'Escreva a dúvida ou objeção').max(160),
  resposta: z.string().trim().max(1500).optional(),
  palavrasChave: palavras.optional(),
  modelo: z.string().trim().max(80).optional(),
  etapa: z.enum(ETAPAS_CONHECIMENTO).optional(),
})

router.post('/assistente/conhecimento', ...editar, async (req: Request, res: Response) => {
  const p = criarSchema.safeParse(req.body)
  if (!p.success) { erro(res, 400, p.error.issues[0].message); return }
  const usuarioId = req.proLaboreUser!.sub
  const d = p.data
  const chaves = d.palavrasChave?.length ? d.palavrasChave : [normalizarPalavraChave(d.titulo)].filter(Boolean)
  // Gestão com resposta: já entra valendo. Vendedor sugere: a resposta vira rascunho para a gestão aprovar.
  const ativo = daGestao(req) && !!d.resposta
  const item = await prisma.assistenteConhecimento.create({
    data: {
      usuarioId, tipo: d.tipo, titulo: d.titulo, palavrasChave: chaves, modelo: d.modelo || null, etapa: d.etapa ?? null,
      origem: 'MANUAL', criadoPor: autor(req),
      ...(ativo
        ? { resposta: d.resposta, status: 'ATIVO', aprovadoPor: autor(req), aprovadoEm: new Date() }
        : { rascunho: d.resposta || null, rascunhoOrigem: d.resposta ? 'VENDEDOR' : null, status: 'PARA_REVISAR' }),
    },
  })
  res.status(201).json(item)
})

const editarSchema = z.object({
  tipo: z.enum(TIPOS_CONHECIMENTO).optional(),
  titulo: z.string().trim().min(3).max(160).optional(),
  resposta: z.string().trim().max(1500).nullable().optional(),
  rascunho: z.string().trim().max(1500).nullable().optional(),
  palavrasChave: palavras.optional(),
  modelo: z.string().trim().max(80).nullable().optional(),
  etapa: z.enum(ETAPAS_CONHECIMENTO).nullable().optional(),
  status: z.enum(STATUS_CONHECIMENTO).optional(),
})

router.patch('/assistente/conhecimento/:id', ...editar, async (req: Request, res: Response) => {
  const p = editarSchema.safeParse(req.body)
  if (!p.success) { erro(res, 400, p.error.issues[0].message); return }
  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.assistenteConhecimento.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) { erro(res, 404, 'Item não encontrado'); return }
  const d = p.data
  const gestao = daGestao(req)
  // O que muda a fala do robô com os clientes é da gestão.
  if (!gestao && (d.status !== undefined || d.resposta !== undefined || atual.status === 'ATIVO')) {
    erro(res, 403, 'Aprovar, arquivar ou mudar uma resposta em uso é com a gestão. Você pode sugerir um rascunho.')
    return
  }
  const resposta = d.resposta !== undefined ? d.resposta || null : atual.resposta
  const chaves = d.palavrasChave ?? atual.palavrasChave
  if (d.status === 'ATIVO') {
    if (!resposta) { erro(res, 400, 'Escreva a resposta antes de aprovar'); return }
    if (!chaves.length) { erro(res, 400, 'Coloque pelo menos uma palavra-chave para o assistente reconhecer o assunto'); return }
    if (atual.chave === CHAVE_OUTRAS) { erro(res, 400, '"Outras dúvidas" é só a caixa de entrada: crie um assunto com a dúvida e a resposta'); return }
  }
  const item = await prisma.assistenteConhecimento.update({
    where: { id: atual.id },
    data: {
      ...(d.tipo && { tipo: d.tipo }),
      ...(d.titulo && { titulo: d.titulo }),
      ...(d.resposta !== undefined && { resposta }),
      ...(d.rascunho !== undefined && { rascunho: d.rascunho || null, rascunhoOrigem: d.rascunho ? 'VENDEDOR' : null }),
      ...(d.palavrasChave && { palavrasChave: chaves }),
      ...(d.modelo !== undefined && { modelo: d.modelo || null }),
      ...(d.etapa !== undefined && { etapa: d.etapa }),
      ...(d.status && { status: d.status }),
      ...(d.status === 'ATIVO' && atual.status !== 'ATIVO' && { aprovadoPor: autor(req), aprovadoEm: new Date() }),
    },
  })
  res.json(item)
})

// Juntar dois assuntos que são o mesmo (ex.: o que o aprendizado separou).
router.post('/assistente/conhecimento/:id/juntar', ...editar, async (req: Request, res: Response) => {
  if (!daGestao(req)) { erro(res, 403, 'Juntar assuntos é com a gestão'); return }
  const p = z.object({ destinoId: z.string().min(1) }).safeParse(req.body)
  if (!p.success) { erro(res, 400, 'Escolha o assunto de destino'); return }
  const usuarioId = req.proLaboreUser!.sub
  const [origem, destino] = await Promise.all([
    prisma.assistenteConhecimento.findFirst({ where: { id: String(req.params.id), usuarioId } }),
    prisma.assistenteConhecimento.findFirst({ where: { id: p.data.destinoId, usuarioId } }),
  ])
  if (!origem || !destino || origem.id === destino.id) { erro(res, 404, 'Assunto não encontrado'); return }
  const equipe = [...((destino.respostasEquipe ?? []) as unknown[]), ...((origem.respostasEquipe ?? []) as unknown[])].slice(0, 5)
  await prisma.$transaction([
    prisma.assistenteConhecimentoOcorrencia.updateMany({ where: { conhecimentoId: origem.id }, data: { conhecimentoId: destino.id } }),
    prisma.assistenteConhecimento.update({
      where: { id: destino.id },
      data: {
        palavrasChave: [...new Set([...destino.palavrasChave, ...(origem.chave === CHAVE_OUTRAS ? [] : origem.palavrasChave)])],
        usos: destino.usos + origem.usos, avancos: destino.avancos + origem.avancos,
        respostasEquipe: equipe as Prisma.InputJsonValue,
        ...(!destino.rascunho && origem.rascunho && { rascunho: origem.rascunho, rascunhoOrigem: origem.rascunhoOrigem }),
      },
    }),
  ])
  const ocorrencias = await prisma.assistenteConhecimentoOcorrencia.count({ where: { conhecimentoId: destino.id } })
  await prisma.assistenteConhecimento.update({ where: { id: destino.id }, data: { ocorrencias } })
  // A caixa "Outras dúvidas" e os modelos prontos ficam (zerados/arquivados); o resto sai.
  if (origem.chave === CHAVE_OUTRAS) await prisma.assistenteConhecimento.update({ where: { id: origem.id }, data: { ocorrencias: 0 } })
  else if (origem.origem === 'MODELO_PRONTO') await prisma.assistenteConhecimento.update({ where: { id: origem.id }, data: { status: 'ARQUIVADO', ocorrencias: 0 } })
  else await prisma.assistenteConhecimento.delete({ where: { id: origem.id } })
  res.json({ ok: true, destinoId: destino.id, ocorrencias })
})

// Mover uma frase de "Outras dúvidas" (ou de um assunto errado) para outro assunto.
router.post('/assistente/conhecimento/ocorrencias/mover', ...editar, async (req: Request, res: Response) => {
  if (!daGestao(req)) { erro(res, 403, 'Organizar a base é com a gestão'); return }
  const p = z.object({ texto: z.string().min(1).max(500), deId: z.string().min(1), paraId: z.string().min(1) }).safeParse(req.body)
  if (!p.success) { erro(res, 400, 'Dados inválidos'); return }
  const usuarioId = req.proLaboreUser!.sub
  const para = await prisma.assistenteConhecimento.findFirst({ where: { id: p.data.paraId, usuarioId }, select: { id: true } })
  if (!para) { erro(res, 404, 'Assunto não encontrado'); return }
  const r = await prisma.assistenteConhecimentoOcorrencia.updateMany({ where: { usuarioId, conhecimentoId: p.data.deId, texto: p.data.texto }, data: { conhecimentoId: para.id } })
  for (const id of [p.data.deId, para.id]) {
    const ocorrencias = await prisma.assistenteConhecimentoOcorrencia.count({ where: { conhecimentoId: id } })
    await prisma.assistenteConhecimento.updateMany({ where: { id, usuarioId }, data: { ocorrencias } })
  }
  res.json({ movidas: r.count })
})

router.delete('/assistente/conhecimento/:id', ...editar, async (req: Request, res: Response) => {
  if (!daGestao(req)) { erro(res, 403, 'Excluir da base é com a gestão'); return }
  const usuarioId = req.proLaboreUser!.sub
  const atual = await prisma.assistenteConhecimento.findFirst({ where: { id: String(req.params.id), usuarioId } })
  if (!atual) { erro(res, 404, 'Item não encontrado'); return }
  // Modelo pronto e a caixa de entrada não voltariam certos se apagados: ficam arquivados.
  if (atual.origem === 'MODELO_PRONTO' || atual.chave === CHAVE_OUTRAS) {
    await prisma.assistenteConhecimento.update({ where: { id: atual.id }, data: { status: 'ARQUIVADO' } })
    res.json({ arquivado: true })
    return
  }
  await prisma.assistenteConhecimento.delete({ where: { id: atual.id } })
  res.json({ ok: true })
})

// "Analisar conversas agora": não espera o cron (nem a meia hora de folga).
router.post('/assistente/conhecimento/analisar', ...editar, async (req: Request, res: Response) => {
  const r = await aprenderConta(req.proLaboreUser!.sub, { atrasoMs: 0 })
  res.json(r)
})

export default router
