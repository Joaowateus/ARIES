// Tela 04 · Atendimento (seção 7). Leitura pede Atendimento em Leitura;
// responder pede Completo; "Transformar em lead" pede também o CRM em
// Leitura (o papel só cria lead e acompanha os orgânicos, seção 3.1).
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM, requireGestorSM, requireModuloSM } from '../lib/smAcesso'
import { carregarConfig } from '../lib/smCalendario'
import {
  estadoJanela, garantirPadroes, inicioDaSemana, processarEventosPendentes, proximoConsultor, responderConversa, tempoRespostaSemana, textoExpediente, transformarEmLead,
} from '../lib/smAtendimento'
import { iaLigada, sugerirResposta } from '../lib/smIA'
import { fatosDaConversa } from '../lib/smPerguntas'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]

const NOME_CANAL: Record<string, string> = { DIRECT: 'Direct', COMENTARIO: 'Comentário', COMENTARIO_AUTOMACAO: 'Comentário → Direct', RESPOSTA_STORY: 'Resposta ao story' }

router.get('/sm/atendimento', ...autenticado, requireModuloSM('atendimento', 'LEITURA'), async (req: Request, res: Response) => {
  const sm = req.sm!
  const usuarioId = sm.usuarioId
  await processarEventosPendentes(30).catch(() => undefined)
  await garantirPadroes(usuarioId)
  const agora = new Date()
  const semana = inicioDaSemana(agora)
  const [config, conversas, respostasRapidas, automacoes, tempoMedio, viraramLead, disparos, leadsQuero] = await Promise.all([
    carregarConfig(usuarioId),
    prisma.smConversa.findMany({
      where: { usuarioId, status: { not: 'ARQUIVADA' } },
      orderBy: [{ ultimaMsgEm: 'desc' }],
      take: 200,
      include: { mensagens: { orderBy: { enviadaEm: 'desc' }, take: 1, select: { texto: true, direcao: true } } },
    }),
    prisma.smRespostaRapida.findMany({ where: { usuarioId }, orderBy: { ordem: 'asc' } }),
    prisma.smAutomacao.findMany({ where: { usuarioId } }),
    tempoRespostaSemana(usuarioId, agora),
    prisma.smConversa.count({ where: { usuarioId, leadId: { not: null }, atualizadoEm: { gte: semana } } }),
    prisma.smMensagem.count({ where: { automacao: 'PALAVRA_CHAVE', enviadaEm: { gte: semana }, conversa: { usuarioId } } }),
    prisma.smConversa.count({ where: { usuarioId, canal: 'COMENTARIO_AUTOMACAO', leadId: { not: null }, criadoEm: { gte: semana } } }),
  ])
  const disparosFora = await prisma.smMensagem.count({ where: { automacao: 'FORA_HORARIO', enviadaEm: { gte: semana }, conversa: { usuarioId } } })
  const ordenadas = [...conversas].sort((a, b) => {
    // Quem espera resposta vem primeiro, a mais antiga no topo.
    if (!!a.aguardandoDesde !== !!b.aguardandoDesde) return a.aguardandoDesde ? -1 : 1
    if (a.aguardandoDesde && b.aguardandoDesde) return a.aguardandoDesde.getTime() - b.aguardandoDesde.getTime()
    return b.ultimaMsgEm.getTime() - a.ultimaMsgEm.getTime()
  })
  res.json({
    cabecalho: { tempoMedioMin: tempoMedio, viraramLeadSemana: viraramLead },
    metaRespostaMin: config.metaRespostaMin,
    expediente: textoExpediente(config),
    contadores: {
      todos: conversas.length,
      direct: conversas.filter(c => c.canal !== 'COMENTARIO').length,
      comentarios: conversas.filter(c => c.canal === 'COMENTARIO').length,
      aguardando: conversas.filter(c => c.aguardandoDesde).length,
    },
    conversas: ordenadas.map(c => ({
      id: c.id, canal: c.canal, canalNome: NOME_CANAL[c.canal] ?? c.canal,
      nome: c.clienteNome ?? (c.clienteUsuario ? `@${c.clienteUsuario}` : 'Cliente'),
      previa: c.mensagens[0]?.texto ?? '', ultimaDirecao: c.mensagens[0]?.direcao ?? null,
      ultimaMsgEm: c.ultimaMsgEm, aguardandoDesde: c.aguardandoDesde,
      atrasada: !!c.aguardandoDesde && agora.getTime() - c.aguardandoDesde.getTime() > config.metaRespostaMin * 60_000,
      moto: c.motoInteresse, postCode: c.postCode, status: c.status,
    })),
    respostasRapidas: respostasRapidas.map(r => ({ id: r.id, titulo: r.titulo, texto: r.texto })),
    automacoes: automacoes.sort((a, b) => a.tipo.localeCompare(b.tipo) * -1).map(a => ({
      tipo: a.tipo, palavra: a.palavra, resposta: a.resposta, ativa: a.ativa,
      disparosSemana: a.tipo === 'PALAVRA_CHAVE' ? disparos : disparosFora,
      leadsSemana: a.tipo === 'PALAVRA_CHAVE' ? leadsQuero : null,
    })),
    podeResponder: sm.pode('atendimento', 'COMPLETO') && !sm.somenteLeitura,
    podeCriarLead: sm.pode('atendimento', 'COMPLETO') && sm.pode('crm', 'LEITURA') && !sm.somenteLeitura,
    souGestor: sm.visao === 'GESTOR',
  })
})

async function conversaDaConta(usuarioId: string, id: string) {
  return prisma.smConversa.findFirst({ where: { id, usuarioId } })
}

router.get('/sm/conversas/:id', ...autenticado, requireModuloSM('atendimento', 'LEITURA'), async (req: Request, res: Response) => {
  const usuarioId = req.sm!.usuarioId
  const c = await prisma.smConversa.findFirst({
    where: { id: String(req.params.id), usuarioId },
    include: { mensagens: { orderBy: { enviadaEm: 'asc' }, take: 300 } },
  })
  if (!c) { res.status(404).json({ error: 'Conversa não encontrada' }); return }
  const [miniatura, consultor] = await Promise.all([
    c.midiaIgId ? prisma.socialMediaMidia.findUnique({ where: { instagramMediaId: c.midiaIgId }, select: { miniaturaLocal: true, thumbnailUrl: true, urlMidia: true, urlPermalink: true } }) : null,
    c.leadId ? null : proximoConsultor(usuarioId),
  ])
  res.json({
    id: c.id, canal: c.canal, canalNome: NOME_CANAL[c.canal] ?? c.canal,
    nome: c.clienteNome ?? (c.clienteUsuario ? `@${c.clienteUsuario}` : 'Cliente'), usuario: c.clienteUsuario,
    post: { titulo: c.postTitulo, codigo: c.postCode, miniatura: miniatura?.miniaturaLocal ?? miniatura?.thumbnailUrl ?? null, permalink: miniatura?.urlPermalink ?? null },
    moto: c.motoInteresse, status: c.status, leadId: c.leadId, aguardandoDesde: c.aguardandoDesde,
    janela: estadoJanela(c),
    proximoConsultor: consultor?.nome ?? null,
    mensagens: c.mensagens.map(m => ({ id: m.id, direcao: m.direcao, autor: m.autor, automacao: m.automacao, texto: m.texto, enviadaEm: m.enviadaEm })),
  })
})

router.post('/sm/conversas/:id/responder', ...autenticado, requireModuloSM('atendimento', 'COMPLETO'), async (req: Request, res: Response) => {
  const parse = z.object({ texto: z.string().trim().min(1, 'Escreva a resposta').max(1000, 'Resposta longa demais (máx. 1.000 caracteres)') }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const c = await conversaDaConta(req.sm!.usuarioId, String(req.params.id))
  if (!c) { res.status(404).json({ error: 'Conversa não encontrada' }); return }
  try {
    await responderConversa(c, parse.data.texto)
    res.json({ ok: true })
  } catch (e) {
    res.status(409).json({ error: e instanceof Error ? e.message : 'Falha ao enviar' })
  }
})

// Resposta sugerida (seção 13.4 e 16.3): pela IA quando ligada, senão pelo tema
// da pergunta. Vai para a caixa de texto; quem atende revisa e envia.
router.post('/sm/conversas/:id/sugestao', ...autenticado, requireModuloSM('atendimento', 'COMPLETO'), async (req: Request, res: Response) => {
  const c = await fatosDaConversa(req.sm!.usuarioId, String(req.params.id))
  if (!c) { res.status(404).json({ error: 'Conversa não encontrada' }); return }
  const ia = iaLigada() ? await sugerirResposta(req.sm!.usuarioId, c.fatos) : null
  res.json({ texto: ia ?? c.semIA, ia: !!ia })
})

router.post('/sm/conversas/:id/arquivar', ...autenticado, requireModuloSM('atendimento', 'COMPLETO'), async (req: Request, res: Response) => {
  const c = await conversaDaConta(req.sm!.usuarioId, String(req.params.id))
  if (!c) { res.status(404).json({ error: 'Conversa não encontrada' }); return }
  const arquivar = req.body?.arquivar !== false
  await prisma.smConversa.update({ where: { id: c.id }, data: arquivar ? { status: 'ARQUIVADA', aguardandoDesde: null } : { status: c.leadId ? 'LEAD' : 'RESPONDIDA' } })
  res.json({ ok: true })
})

const leadSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome').max(120),
  whatsapp: z.string().trim().max(30).nullable().optional().transform(v => v || null)
    .refine(v => !v || v.replace(/\D/g, '').length >= 10, 'WhatsApp com DDD, só números'),
  moto: z.string().trim().max(120).nullable().optional().transform(v => v || null),
  pagamento: z.enum(['FINANCIAMENTO', 'A_VISTA', 'CONSORCIO']),
})

router.post('/sm/conversas/:id/lead', ...autenticado, requireModuloSM('atendimento', 'COMPLETO'), requireModuloSM('crm', 'LEITURA'), async (req: Request, res: Response) => {
  const parse = leadSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const c = await conversaDaConta(req.sm!.usuarioId, String(req.params.id))
  if (!c) { res.status(404).json({ error: 'Conversa não encontrada' }); return }
  try {
    res.status(201).json(await transformarEmLead(c, { ...parse.data, whatsapp: parse.data.whatsapp ?? null, moto: parse.data.moto ?? null }))
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500
    res.status(status).json({ error: e instanceof Error ? e.message : 'Falha ao criar o lead' })
  }
})

// ---------- Gestor: respostas rápidas e automações ----------

router.put('/sm/gestor/respostas-rapidas', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  const parse = z.array(z.object({ titulo: z.string().trim().min(2).max(40), texto: z.string().trim().min(2).max(1000) })).max(12).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Cada resposta precisa de título (até 40) e texto (até 1.000 caracteres); no máximo 12' }); return }
  const usuarioId = req.sm!.usuarioId
  await prisma.$transaction([
    prisma.smRespostaRapida.deleteMany({ where: { usuarioId } }),
    prisma.smRespostaRapida.createMany({ data: parse.data.map((r, i) => ({ usuarioId, ...r, ordem: i })) }),
  ])
  res.json(await prisma.smRespostaRapida.findMany({ where: { usuarioId }, orderBy: { ordem: 'asc' }, select: { id: true, titulo: true, texto: true } }))
})

router.put('/sm/gestor/automacoes/:tipo', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  const tipo = String(req.params.tipo).toUpperCase()
  if (!['PALAVRA_CHAVE', 'FORA_HORARIO'].includes(tipo)) { res.status(404).json({ error: 'Automação não encontrada' }); return }
  const parse = z.object({
    ativa: z.boolean().optional(),
    palavra: z.string().trim().min(2).max(30).regex(/^[\p{L}\p{N}]+$/u, 'A palavra-chave é uma palavra só, sem espaços').optional(),
    resposta: z.string().trim().min(5).max(1000).optional(),
  }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const usuarioId = req.sm!.usuarioId
  await garantirPadroes(usuarioId)
  const a = await prisma.smAutomacao.update({ where: { usuarioId_tipo: { usuarioId, tipo } }, data: { ...parse.data, ...(tipo === 'FORA_HORARIO' && { palavra: null }) } })
  res.json({ tipo: a.tipo, palavra: a.palavra, resposta: a.resposta, ativa: a.ativa })
})

export default router
