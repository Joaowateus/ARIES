// Copiloto Comercial: rotas da aba (relatório do dia, plano, estudos,
// evolução, sugestões de resposta no WhatsApp, conversa e memória).
// Cada pessoa vê o próprio copiloto. O dono vê o da equipe ("EQUIPE") e
// pode abrir o de cada vendedor só para ler: a conversa e a memória do
// vendedor com o copiloto são dele e ficam fora da visão do gestor.
import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { requireModulo, nivelAtende } from '../lib/acessos'
import { EQUIPE, primeiroNome, chaveDia } from '../lib/copilotoFatos'
import { COMPETENCIAS, COMPETENCIAS_LISTA, bibliotecaDa, type Competencia } from '../lib/copilotoCompetencias'
import { fatosParaIA, garantirPerfil, gerarDia, hojeChave, memoriaParaIA, telaDoDia, type Relatorio } from '../lib/copiloto'
import { buscarEstudosNaWeb, competenciaValida, iaLigada, responderChat, sugerirResposta, type SugestaoIA } from '../lib/copilotoIA'
import { DICAS, pedidoDeMemoria, sugestaoModelo } from '../lib/copilotoModelos'
import { semDinheiro } from '../lib/smIA'
import { Prisma } from '@prisma/client'

const router = Router()
const DIA = 24 * 3600e3

interface Contexto { usuarioId: string; pessoa: string; minha: boolean; somenteLeitura: boolean; nome: string }
declare global { namespace Express { interface Request { copiloto?: Contexto } } }

/** Resolve de quem é o copiloto pedido e o que quem pede pode fazer nele. */
async function contexto(req: Request, res: Response, next: NextFunction): Promise<void> {
  const u = req.proLaboreUser!
  const pedida = typeof req.query.pessoa === 'string' && req.query.pessoa ? req.query.pessoa : (typeof req.body?.pessoa === 'string' ? req.body.pessoa : '')
  const podeEditar = u.papel === 'DONO' || nivelAtende(req.acessos?.copiloto, 'EDITAR')
  if (u.papel === 'DONO') {
    const pessoa = pedida || EQUIPE
    if (pessoa === EQUIPE) {
      const dono = await prisma.proLaboreUsuario.findUnique({ where: { id: u.sub }, select: { nome: true } })
      req.copiloto = { usuarioId: u.sub, pessoa, minha: true, somenteLeitura: false, nome: primeiroNome(dono?.nome) }
    } else {
      const v = await prisma.vendedor.findFirst({ where: { id: pessoa, usuarioId: u.sub }, select: { nome: true } })
      if (!v) { res.status(404).json({ error: 'Pessoa não encontrada' }); return }
      req.copiloto = { usuarioId: u.sub, pessoa, minha: false, somenteLeitura: true, nome: primeiroNome(v.nome) }
    }
  } else if (u.vendedorId) {
    const v = await prisma.vendedor.findUnique({ where: { id: u.vendedorId }, select: { nome: true } })
    req.copiloto = { usuarioId: u.sub, pessoa: u.vendedorId, minha: true, somenteLeitura: !podeEditar, nome: primeiroNome(v?.nome) }
  } else { res.status(403).json({ error: 'Acesso restrito' }); return }
  next()
}
const escrita = (req: Request, res: Response, next: NextFunction) => {
  if (req.copiloto!.somenteLeitura) { res.status(403).json({ error: req.copiloto!.minha ? 'Seu acesso ao Copiloto é só para ver.' : 'O copiloto de cada vendedor é dele: aqui você só acompanha.' }); return }
  next()
}
const soDaPessoa = (req: Request, res: Response, next: NextFunction) => {
  if (!req.copiloto!.minha) { res.status(403).json({ error: 'A conversa e a memória do copiloto são da própria pessoa.' }); return }
  next()
}

const base = [requireProLaboreAuth, requireModulo('copiloto', 'VER'), contexto]
const erroValidacao = (res: Response, e: z.ZodError) => res.status(400).json({ error: e.issues[0]?.message ?? 'Dados inválidos' })

// ---------- Pessoas (dono) ----------

router.get('/copiloto/pessoas', ...base, async (req: Request, res: Response) => {
  const c = req.copiloto!
  if (req.proLaboreUser!.papel !== 'DONO') { res.json([{ pessoa: c.pessoa, nome: c.nome, tipo: 'EU' }]); return }
  const vendedores = await prisma.vendedor.findMany({ where: { usuarioId: c.usuarioId, ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } })
  const dias = await prisma.copilotoDia.findMany({ where: { usuarioId: c.usuarioId, dia: hojeChave() }, select: { pessoa: true, indice: true } })
  const indice = new Map(dias.map(d => [d.pessoa, d.indice]))
  res.json([{ pessoa: EQUIPE, nome: 'Equipe (visão do gestor)', tipo: 'EQUIPE', indice: indice.get(EQUIPE) ?? null }, ...vendedores.map(v => ({ pessoa: v.id, nome: v.nome, tipo: 'VENDEDOR', indice: indice.get(v.id) ?? null }))])
})

// ---------- Hoje ----------

async function respostaHoje(req: Request) {
  const c = req.copiloto!
  const [tela, perfil] = await Promise.all([telaDoDia(c.usuarioId, c.pessoa), garantirPerfil(c.usuarioId, c.pessoa)])
  if (!tela) return null
  const registro = await prisma.copilotoDia.findUnique({ where: { usuarioId_pessoa_dia: { usuarioId: c.usuarioId, pessoa: c.pessoa, dia: tela.dia } }, select: { iaEm: true } })
  const iaPendente = iaLigada() && tela.origem !== 'IA' && (!registro?.iaEm || Date.now() - registro.iaEm.getTime() > 3600e3)
  return { ...tela, nome: c.nome, pessoa: c.pessoa, minha: c.minha, somenteLeitura: c.somenteLeitura, iaLigada: iaLigada(), iaPendente, perfil }
}

router.get('/copiloto/hoje', ...base, async (req: Request, res: Response) => {
  const c = req.copiloto!
  if (c.minha) await prisma.copilotoPerfil.upsert({ where: { usuarioId_pessoa: { usuarioId: c.usuarioId, pessoa: c.pessoa } }, create: { usuarioId: c.usuarioId, pessoa: c.pessoa, ultimoAcessoEm: new Date() }, update: { ultimoAcessoEm: new Date() } })
  // Ainda sem o dia: as regras montam na hora (rápido); a IA vem num segundo pedido.
  if (!(await telaDoDia(c.usuarioId, c.pessoa))) {
    const r = await gerarDia(c.usuarioId, c.pessoa)
    if (!r) { res.status(404).json({ error: 'Pessoa não encontrada' }); return }
  }
  res.json(await respostaHoje(req))
})

// A IA redige o relatório de hoje (quando a pessoa abre a tela e ainda não há texto da IA).
router.post('/copiloto/hoje/ia', ...base, async (req: Request, res: Response) => {
  const c = req.copiloto!
  await gerarDia(c.usuarioId, c.pessoa, { comIA: true })
  res.json(await respostaHoje(req))
})

// Refaz a análise com os dados de agora (mantém as ações já feitas).
router.post('/copiloto/hoje/atualizar', ...base, escrita, async (req: Request, res: Response) => {
  const c = req.copiloto!
  await gerarDia(c.usuarioId, c.pessoa, { refazer: true, comIA: req.body?.comIA !== false })
  res.json(await respostaHoje(req))
})

router.post('/copiloto/hoje/lido', ...base, async (req: Request, res: Response) => {
  const c = req.copiloto!
  if (c.minha) await prisma.copilotoDia.updateMany({ where: { usuarioId: c.usuarioId, pessoa: c.pessoa, dia: hojeChave(), lidoEm: null }, data: { lidoEm: new Date() } })
  res.json({ ok: true })
})

const feedbackSchema = z.object({ util: z.boolean(), comentario: z.string().trim().max(500).optional() })
router.post('/copiloto/hoje/feedback', ...base, escrita, async (req: Request, res: Response) => {
  const p = feedbackSchema.safeParse(req.body); if (!p.success) { erroValidacao(res, p.error); return }
  const c = req.copiloto!
  await prisma.copilotoDia.updateMany({ where: { usuarioId: c.usuarioId, pessoa: c.pessoa, dia: hojeChave() }, data: { util: p.data.util, comentario: p.data.comentario || null } })
  // O que a pessoa escreve sobre o relatório vira memória (é o jeito dela de ensinar o copiloto).
  if (p.data.comentario) await prisma.copilotoMemoria.create({ data: { usuarioId: c.usuarioId, pessoa: c.pessoa, tipo: 'PREFERENCIA', texto: `Sobre o relatório: ${p.data.comentario}`, natureza: 'PEDIDO', origem: 'USUARIO' } })
  res.json({ ok: true })
})

// ---------- Plano do dia ----------

const acaoSchema = z.object({ status: z.enum(['PENDENTE', 'FEITA', 'IGNORADA']) })
router.patch('/copiloto/acoes/:id', ...base, escrita, async (req: Request, res: Response) => {
  const p = acaoSchema.safeParse(req.body); if (!p.success) { erroValidacao(res, p.error); return }
  const c = req.copiloto!
  const a = await prisma.copilotoAcao.findFirst({ where: { id: String(req.params.id), usuarioId: c.usuarioId, pessoa: c.pessoa } })
  if (!a) { res.status(404).json({ error: 'Ação não encontrada' }); return }
  res.json(await prisma.copilotoAcao.update({ where: { id: a.id }, data: { status: p.data.status, feitaEm: p.data.status === 'FEITA' ? new Date() : null } }))
})

// ---------- Evolução ----------

router.get('/copiloto/evolucao', ...base, async (req: Request, res: Response) => {
  const c = req.copiloto!
  const dias = Math.min(90, Math.max(7, Number(req.query.dias) || 30))
  const desde = chaveDia(new Date(Date.now() - dias * DIA))
  const [registros, acoes, aprendizados] = await Promise.all([
    prisma.copilotoDia.findMany({ where: { usuarioId: c.usuarioId, pessoa: c.pessoa, dia: { gte: desde } }, orderBy: { dia: 'asc' }, select: { dia: true, indice: true, fatos: true, origem: true, util: true } }),
    prisma.copilotoAcao.findMany({ where: { usuarioId: c.usuarioId, pessoa: c.pessoa, dia: { gte: desde } }, select: { dia: true, tipo: true, status: true, resultado: true } }),
    prisma.copilotoMemoria.findMany({ where: { usuarioId: c.usuarioId, pessoa: c.pessoa, origem: 'RESULTADO', ativa: true }, select: { texto: true, atualizadoEm: true } }),
  ])
  const serie = registros.map(r => {
    const f = r.fatos as Record<string, any>
    const doDia = acoes.filter(a => a.dia === r.dia && a.tipo !== 'ESTUDO')
    return {
      dia: r.dia, indice: r.indice, carteira: f.carteira?.total ?? null, parados: f.parados?.total ?? null, semAbordar: f.parados?.semAbordar ?? null,
      tempoAbordagemHoras: f.tempoAbordagemHoras ?? null, conversaoLeadAbordado: f.conversao?.leadParaAbordado ?? null, agendaPct: f.agenda?.percentual ?? null,
      esperandoWhatsapp: f.whatsapp?.esperandoAgora ?? null, movimentos7d: f.movimentos?.semana ? ['ABORDADO', 'NEGOCIACAO', 'PROPOSTA', 'FECHADO'].reduce((s: number, k) => s + (f.movimentos.semana[k] ?? 0), 0) : null,
      acoes: doDia.length, acoesFeitas: doDia.filter(a => a.status === 'FEITA').length,
    }
  })
  const porTipo = new Map<string, { total: number; feitas: number; efeito: number }>()
  for (const a of acoes) {
    const x = porTipo.get(a.tipo) ?? { total: 0, feitas: 0, efeito: 0 }
    x.total++; if (a.status === 'FEITA') x.feitas++; if (a.resultado === 'AVANCOU' || a.resultado === 'RESPONDIDA') x.efeito++
    porTipo.set(a.tipo, x)
  }
  const estudos = await prisma.copilotoEstudo.count({ where: { usuarioId: c.usuarioId, pessoa: c.pessoa, status: 'CONCLUIDO' } })
  // Dias seguidos com o plano tocado (pelo menos uma ação feita), até ontem.
  let sequencia = 0
  for (let k = 1; k <= dias; k++) {
    const d = chaveDia(new Date(Date.now() - 3 * 3600e3 - k * DIA))
    if (acoes.some(a => a.dia === d && a.status === 'FEITA')) sequencia++
    else break
  }
  res.json({ serie, porTipo: Object.fromEntries(porTipo), aprendizados, estudosConcluidos: estudos, sequencia })
})

// ---------- Estudos ----------

router.get('/copiloto/estudos', ...base, async (req: Request, res: Response) => {
  const c = req.copiloto!
  const itens = await prisma.copilotoEstudo.findMany({ where: { usuarioId: c.usuarioId, pessoa: c.pessoa, status: { not: 'DESCARTADO' } }, orderBy: [{ criadoEm: 'desc' }] })
  res.json({ itens, competencias: COMPETENCIAS_LISTA.map(k => ({ chave: k, ...COMPETENCIAS[k] })), buscaWeb: iaLigada() })
})

const buscarSchema = z.object({ competencia: z.string().refine(competenciaValida, 'Competência inválida') })
router.post('/copiloto/estudos/buscar', ...base, escrita, async (req: Request, res: Response) => {
  const p = buscarSchema.safeParse(req.body); if (!p.success) { erroValidacao(res, p.error); return }
  const c = req.copiloto!
  const competencia = p.data.competencia as Competencia
  const perfil = await garantirPerfil(c.usuarioId, c.pessoa)
  const ja = await prisma.copilotoEstudo.findMany({ where: { usuarioId: c.usuarioId, pessoa: c.pessoa }, select: { url: true } })
  const hoje = await prisma.copilotoDia.findUnique({ where: { usuarioId_pessoa_dia: { usuarioId: c.usuarioId, pessoa: c.pessoa, dia: hojeChave() } }, select: { achados: true } })
  const motivos = ((hoje?.achados ?? []) as Array<{ competencia: string; texto: string; tipo: string }>).filter(a => a.competencia === competencia && a.tipo !== 'FORTE').map(a => a.texto)
  const web = await buscarEstudosNaWeb(c.usuarioId, { competencia, porque: semDinheiro(motivos.join(' ')) || COMPETENCIAS[competencia].descricao, nivel: perfil.nivel, jaTem: ja.map(e => e.url).filter(u => !u.includes('/search') && !u.includes('/results')).slice(0, 20) })
  const urls = new Set(ja.map(e => e.url))
  let origem: 'WEB' | 'BIBLIOTECA' = 'WEB'
  let novos: Array<{ titulo: string; url: string; tipo: string; fonte: string; porque: string; origem: string }> = (web ?? []).filter(i => !urls.has(i.url)).map(i => ({ ...i, origem: 'WEB' }))
  if (!novos.length) {
    origem = 'BIBLIOTECA'
    novos = bibliotecaDa(competencia).filter(i => !urls.has(i.url)).map(i => ({ ...i, origem: 'BIBLIOTECA' }))
  }
  if (novos.length) await prisma.copilotoEstudo.createMany({ data: novos.map(i => ({ usuarioId: c.usuarioId, pessoa: c.pessoa, competencia, titulo: i.titulo, tipo: i.tipo, url: i.url, fonte: i.fonte, porque: i.porque || COMPETENCIAS[competencia].descricao, origem: i.origem })) })
  res.json({ adicionados: novos.length, origem, buscaWeb: iaLigada(), webFalhou: iaLigada() && web == null })
})

const estudoSchema = z.object({ status: z.enum(['SUGERIDO', 'ESTUDANDO', 'CONCLUIDO', 'DESCARTADO']).optional(), util: z.boolean().nullable().optional(), anotacao: z.string().trim().max(2000).nullable().optional() })
router.patch('/copiloto/estudos/:id', ...base, escrita, async (req: Request, res: Response) => {
  const p = estudoSchema.safeParse(req.body); if (!p.success) { erroValidacao(res, p.error); return }
  const c = req.copiloto!
  const e = await prisma.copilotoEstudo.findFirst({ where: { id: String(req.params.id), usuarioId: c.usuarioId, pessoa: c.pessoa } })
  if (!e) { res.status(404).json({ error: 'Estudo não encontrado' }); return }
  res.json(await prisma.copilotoEstudo.update({ where: { id: e.id }, data: { ...p.data, ...(p.data.status === 'CONCLUIDO' ? { concluidoEm: new Date() } : p.data.status ? { concluidoEm: null } : {}) } }))
})

// ---------- Conversas do WhatsApp ----------

async function assistentesDa(c: Contexto): Promise<Array<{ id: string; vendedorId: string; status: string; vendedor: { nome: string } }>> {
  return prisma.assistenteComercial.findMany({
    where: c.pessoa === EQUIPE ? { vendedor: { usuarioId: c.usuarioId, ativo: true } } : { vendedorId: c.pessoa, vendedor: { usuarioId: c.usuarioId } },
    select: { id: true, vendedorId: true, status: true, vendedor: { select: { nome: true } } },
  })
}

router.get('/copiloto/conversas', ...base, async (req: Request, res: Response) => {
  const c = req.copiloto!
  const assistentes = await assistentesDa(c)
  if (!assistentes.length) { res.json({ conectado: false, itens: [] }); return }
  const conversas = await prisma.assistenteConversa.findMany({
    where: { assistenteId: { in: assistentes.map(a => a.id) }, tipo: 'LEAD', OR: [{ status: { in: ['AGUARDANDO_VENDEDOR', 'ASSUMIDA'] } }, { ultimaMensagemEm: { gte: new Date(Date.now() - 3 * DIA) } }], NOT: { status: 'ENCERRADA' } },
    orderBy: { ultimaMensagemEm: 'desc' }, take: 40,
    select: { id: true, nomeContato: true, status: true, ultimaMensagemEm: true, aguardandoVendedorEm: true, assistenteId: true, lead: { select: { estagio: true, modeloInteresse: true } }, mensagens: { orderBy: { criadoEm: 'desc' }, take: 1, select: { remetente: true, texto: true, criadoEm: true } } },
  })
  const porAssistente = new Map(assistentes.map(a => [a.id, a]))
  const agora = Date.now()
  const itens = conversas.map(cv => {
    const ultima = cv.mensagens[0]
    const esperando = cv.status === 'AGUARDANDO_VENDEDOR' || (ultima?.remetente === 'CONTATO' && cv.status === 'ASSUMIDA')
    const desde = cv.status === 'AGUARDANDO_VENDEDOR' ? (cv.aguardandoVendedorEm ?? cv.ultimaMensagemEm) : ultima?.criadoEm ?? cv.ultimaMensagemEm
    return {
      id: cv.id, nome: cv.nomeContato, status: cv.status, estagio: cv.lead?.estagio ?? null, modelo: cv.lead?.modeloInteresse ?? null,
      ultima: ultima ? { remetente: ultima.remetente, texto: ultima.texto.slice(0, 160), em: ultima.criadoEm } : null,
      esperando, esperaMin: esperando ? Math.round((agora - desde.getTime()) / 60e3) : null,
      vendedor: c.pessoa === EQUIPE ? primeiroNome(porAssistente.get(cv.assistenteId)?.vendedor.nome) : null,
      vendedorId: porAssistente.get(cv.assistenteId)?.vendedorId ?? null,
    }
  }).sort((a, b) => Number(b.esperando) - Number(a.esperando) || (b.esperaMin ?? 0) - (a.esperaMin ?? 0))
  res.json({ conectado: assistentes.some(a => a.status === 'CONECTADO'), itens })
})

async function conversaDa(c: Contexto, id: string) {
  const assistentes = await assistentesDa(c)
  return prisma.assistenteConversa.findFirst({
    where: { id, assistenteId: { in: assistentes.map(a => a.id) }, tipo: 'LEAD' },
    select: {
      id: true, nomeContato: true, status: true, origem: true, respostas: true, assistente: { select: { vendedorId: true, status: true, vendedor: { select: { nome: true } } } },
      lead: { select: { id: true, estagio: true, modeloInteresse: true, observacao: true } },
      mensagens: { orderBy: { criadoEm: 'desc' }, take: 30, select: { id: true, remetente: true, texto: true, criadoEm: true } },
    },
  })
}

/** Conteúdos da loja (posts do Instagram) sobre a moto de interesse, para mandar ao cliente. */
async function conteudosPara(usuarioId: string, modelo: string | null) {
  const palavras = (modelo ?? '').split(/[\s/-]+/).filter(p => p.length >= 2 && !/^\d{4}$/.test(p)).slice(0, 2)
  const sel = { id: true, legenda: true, formato: true, urlPermalink: true, publicadoEm: true, miniaturaLocal: true, thumbnailUrl: true }
  let midias = palavras.length
    ? await prisma.socialMediaMidia.findMany({ where: { conta: { usuarioId }, urlPermalink: { not: null }, formato: { not: 'STORY' }, AND: palavras.map(p => ({ legenda: { contains: p, mode: 'insensitive' as const } })) }, orderBy: { publicadoEm: 'desc' }, take: 3, select: sel })
    : []
  if (!midias.length) midias = await prisma.socialMediaMidia.findMany({ where: { conta: { usuarioId }, urlPermalink: { not: null }, formato: 'REELS', publicadoEm: { gte: new Date(Date.now() - 60 * DIA) } }, orderBy: { alcance: 'desc' }, take: 3, select: sel })
  return midias.map(m => ({ id: m.id, titulo: (m.legenda ?? '').split('\n')[0].slice(0, 90) || 'Post da loja', formato: m.formato, link: m.urlPermalink!, miniatura: m.miniaturaLocal ?? m.thumbnailUrl ?? null, data: chaveDia(m.publicadoEm) }))
}

router.get('/copiloto/conversas/:id', ...base, async (req: Request, res: Response) => {
  const c = req.copiloto!
  const cv = await conversaDa(c, String(req.params.id))
  if (!cv) { res.status(404).json({ error: 'Conversa não encontrada' }); return }
  const [ultima, conteudos] = await Promise.all([
    prisma.copilotoSugestao.findFirst({ where: { usuarioId: c.usuarioId, conversaId: cv.id }, orderBy: { criadoEm: 'desc' } }),
    conteudosPara(c.usuarioId, cv.lead?.modeloInteresse ?? null),
  ])
  res.json({
    id: cv.id, nome: cv.nomeContato, status: cv.status, lead: cv.lead, vendedorId: cv.assistente.vendedorId, vendedor: primeiroNome(cv.assistente.vendedor.nome), conectado: cv.assistente.status === 'CONECTADO',
    mensagens: [...cv.mensagens].reverse(), sugestao: ultima, conteudos,
  })
})

router.post('/copiloto/conversas/:id/sugestao', ...base, async (req: Request, res: Response) => {
  const c = req.copiloto!
  if (c.somenteLeitura && c.minha) { res.status(403).json({ error: 'Seu acesso ao Copiloto é só para ver.' }); return }
  const cv = await conversaDa(c, String(req.params.id))
  if (!cv) { res.status(404).json({ error: 'Conversa não encontrada' }); return }
  const mensagens = [...cv.mensagens].reverse()
  const conteudos = await conteudosPara(c.usuarioId, cv.lead?.modeloInteresse ?? null)
  const ultimaDoCliente = [...mensagens].reverse().find(m => m.remetente === 'CONTATO')?.texto ?? ''
  const cliente = primeiroNome(cv.nomeContato)
  let sugestao: SugestaoIA | null = null
  let origem = 'MODELO'
  if (iaLigada()) {
    const memoria = (await memoriaParaIA(c.usuarioId, cv.assistente.vendedorId)).filter(m => ['ESTILO', 'PREFERENCIA', 'APRENDIZADO'].includes(m.tipo))
    sugestao = await sugerirResposta(c.usuarioId, {
      cliente: { nome: cliente, estagioNoCrm: cv.lead?.estagio ?? null, motoDeInteresse: cv.lead?.modeloInteresse ?? null, respostasDoPreAtendimento: cv.respostas ?? null },
      conversa: mensagens.map(m => ({ de: m.remetente === 'CONTATO' ? 'CLIENTE' : m.remetente === 'VENDEDOR' ? 'VENDEDOR' : 'ASSISTENTE_AUTOMATICO', texto: m.texto.slice(0, 600), quando: m.criadoEm.toISOString().slice(0, 16) })),
      conteudos: conteudos.map(x => ({ id: x.id, titulo: x.titulo, formato: x.formato, data: x.data })), memoria, vendedor: primeiroNome(cv.assistente.vendedor.nome),
    })
    if (sugestao) origem = 'IA'
  }
  sugestao ??= sugestaoModelo(ultimaDoCliente, cliente, conteudos[0]?.id ?? null)
  const registro = await prisma.copilotoSugestao.create({ data: { usuarioId: c.usuarioId, pessoa: cv.assistente.vendedorId, conversaId: cv.id, conteudo: sugestao as unknown as Prisma.InputJsonValue, origem, estagioNaHora: cv.lead?.estagio ?? null } })
  res.status(201).json({ ...registro, conteudos })
})

const usarSchema = z.object({ indice: z.number().int().min(0).max(5), editada: z.boolean().optional() })
router.post('/copiloto/sugestoes/:id/usar', ...base, async (req: Request, res: Response) => {
  const p = usarSchema.safeParse(req.body); if (!p.success) { erroValidacao(res, p.error); return }
  const s = await prisma.copilotoSugestao.findFirst({ where: { id: String(req.params.id), usuarioId: req.copiloto!.usuarioId } })
  if (!s) { res.status(404).json({ error: 'Sugestão não encontrada' }); return }
  res.json(await prisma.copilotoSugestao.update({ where: { id: s.id }, data: { usadaIndice: p.data.indice, usadaEm: new Date() } }))
})
router.post('/copiloto/sugestoes/:id/feedback', ...base, async (req: Request, res: Response) => {
  const p = z.object({ util: z.boolean() }).safeParse(req.body); if (!p.success) { erroValidacao(res, p.error); return }
  const s = await prisma.copilotoSugestao.findFirst({ where: { id: String(req.params.id), usuarioId: req.copiloto!.usuarioId } })
  if (!s) { res.status(404).json({ error: 'Sugestão não encontrada' }); return }
  res.json(await prisma.copilotoSugestao.update({ where: { id: s.id }, data: { util: p.data.util } }))
})

// ---------- Conversa com o copiloto ----------

router.get('/copiloto/chat', ...base, soDaPessoa, async (req: Request, res: Response) => {
  const c = req.copiloto!
  const msgs = await prisma.copilotoMensagem.findMany({ where: { usuarioId: c.usuarioId, pessoa: c.pessoa }, orderBy: { criadoEm: 'desc' }, take: 60 })
  res.json({ mensagens: msgs.reverse(), iaLigada: iaLigada() })
})

const chatSchema = z.object({ texto: z.string().trim().min(1, 'Escreva uma mensagem').max(1500) })
router.post('/copiloto/chat', ...base, soDaPessoa, escrita, async (req: Request, res: Response) => {
  const p = chatSchema.safeParse(req.body); if (!p.success) { erroValidacao(res, p.error); return }
  const c = req.copiloto!
  const pergunta = p.data.texto
  await prisma.copilotoMensagem.create({ data: { usuarioId: c.usuarioId, pessoa: c.pessoa, autor: 'USUARIO', texto: pergunta } })
  const lembrete = pedidoDeMemoria(pergunta)
  let resposta: string, origem = 'MODELO'
  const lembrados: string[] = []
  if (lembrete) {
    await prisma.copilotoMemoria.create({ data: { usuarioId: c.usuarioId, pessoa: c.pessoa, tipo: 'PREFERENCIA', texto: lembrete, natureza: 'PEDIDO', origem: 'USUARIO' } })
    lembrados.push(lembrete)
    resposta = `Anotado, ${c.nome}. Vou levar isso em conta nas próximas análises e sugestões. Você pode ver e mudar o que eu lembro na aba Memória.`
  } else {
    if (!(await telaDoDia(c.usuarioId, c.pessoa))) await gerarDia(c.usuarioId, c.pessoa)
    const tela = (await telaDoDia(c.usuarioId, c.pessoa))!
    const historico = (await prisma.copilotoMensagem.findMany({ where: { usuarioId: c.usuarioId, pessoa: c.pessoa }, orderBy: { criadoEm: 'desc' }, take: 11, select: { autor: true, texto: true } })).reverse().slice(0, -1)
    const ia = iaLigada() ? await responderChat(c.usuarioId, {
      fatos: fatosParaIA(tela.fatos), achados: tela.achados.map(a => ({ tipo: a.tipo, texto: a.texto })), plano: tela.acoes.map(a => ({ texto: a.texto, status: a.status })),
      memoria: await memoriaParaIA(c.usuarioId, c.pessoa), historico, pergunta, nome: c.nome,
    }) : null
    if (ia) {
      resposta = ia.resposta; origem = 'IA'
      for (const l of ia.lembrar) {
        const ja = await prisma.copilotoMemoria.findFirst({ where: { usuarioId: c.usuarioId, pessoa: c.pessoa, texto: l.texto } })
        if (!ja) { await prisma.copilotoMemoria.create({ data: { usuarioId: c.usuarioId, pessoa: c.pessoa, tipo: l.tipo, texto: l.texto, natureza: 'FATO', origem: 'USUARIO' } }); lembrados.push(l.texto) }
      }
    } else {
      const r = tela.relatorio as Relatorio
      const d = DICAS[r.foco]
      resposta = [
        iaLigada() ? 'Não consegui responder com segurança agora. Enquanto isso, o essencial de hoje:' : 'A conversa livre usa a IA, que não está ligada neste sistema. Enquanto isso, o essencial de hoje:',
        tela.acoes.filter(a => a.status === 'PENDENTE').slice(0, 3).map((a, i) => `${i + 1}. ${a.texto}`).join(' '),
        `Técnica do dia: ${d.titulo}. ${d.tecnica}`,
        'Para eu lembrar de algo, escreva "lembre que ...".',
      ].filter(Boolean).join('\n')
    }
  }
  const msg = await prisma.copilotoMensagem.create({ data: { usuarioId: c.usuarioId, pessoa: c.pessoa, autor: 'COPILOTO', texto: resposta, origem } })
  res.status(201).json({ mensagem: msg, lembrados })
})

// ---------- Memória ----------

router.get('/copiloto/memoria', ...base, soDaPessoa, async (req: Request, res: Response) => {
  const c = req.copiloto!
  res.json(await prisma.copilotoMemoria.findMany({ where: { usuarioId: c.usuarioId, pessoa: c.pessoa }, orderBy: [{ ativa: 'desc' }, { atualizadoEm: 'desc' }] }))
})
const TIPOS_MEMORIA = ['OBJETIVO', 'PREFERENCIA', 'PONTO_FORTE', 'PONTO_FRACO', 'APRENDIZADO', 'ESTILO'] as const
router.post('/copiloto/memoria', ...base, soDaPessoa, escrita, async (req: Request, res: Response) => {
  const p = z.object({ tipo: z.enum(TIPOS_MEMORIA), texto: z.string().trim().min(3, 'Escreva o que o copiloto deve lembrar').max(400) }).safeParse(req.body)
  if (!p.success) { erroValidacao(res, p.error); return }
  const c = req.copiloto!
  res.status(201).json(await prisma.copilotoMemoria.create({ data: { usuarioId: c.usuarioId, pessoa: c.pessoa, tipo: p.data.tipo, texto: p.data.texto, natureza: 'PEDIDO', origem: 'USUARIO' } }))
})
router.patch('/copiloto/memoria/:id', ...base, soDaPessoa, escrita, async (req: Request, res: Response) => {
  const p = z.object({ texto: z.string().trim().min(3).max(400).optional(), ativa: z.boolean().optional(), natureza: z.enum(['FATO', 'HIPOTESE', 'PEDIDO']).optional() }).safeParse(req.body)
  if (!p.success) { erroValidacao(res, p.error); return }
  const c = req.copiloto!
  const m = await prisma.copilotoMemoria.findFirst({ where: { id: String(req.params.id), usuarioId: c.usuarioId, pessoa: c.pessoa } })
  if (!m) { res.status(404).json({ error: 'Memória não encontrada' }); return }
  res.json(await prisma.copilotoMemoria.update({ where: { id: m.id }, data: p.data }))
})
router.delete('/copiloto/memoria/:id', ...base, soDaPessoa, escrita, async (req: Request, res: Response) => {
  const c = req.copiloto!
  const r = await prisma.copilotoMemoria.deleteMany({ where: { id: String(req.params.id), usuarioId: c.usuarioId, pessoa: c.pessoa } })
  if (!r.count) { res.status(404).json({ error: 'Memória não encontrada' }); return }
  res.json({ ok: true })
})

// ---------- Perfil ----------

router.get('/copiloto/perfil', ...base, async (req: Request, res: Response) => {
  const c = req.copiloto!
  const perfil = await garantirPerfil(c.usuarioId, c.pessoa)
  const assistente = c.pessoa === EQUIPE ? null : await prisma.assistenteComercial.findUnique({ where: { vendedorId: c.pessoa }, select: { status: true } })
  res.json({ ...perfil, whatsappDisponivel: assistente?.status === 'CONECTADO' })
})
const perfilSchema = z.object({
  nivel: z.enum(['INICIANTE', 'INTERMEDIARIO', 'AVANCADO']).optional(),
  minutosEstudoDia: z.number().int().min(5).max(120).optional(),
  objetivo: z.string().trim().max(400).nullable().optional(),
  whatsappDiario: z.boolean().optional(),
})
router.put('/copiloto/perfil', ...base, soDaPessoa, escrita, async (req: Request, res: Response) => {
  const p = perfilSchema.safeParse(req.body); if (!p.success) { erroValidacao(res, p.error); return }
  const c = req.copiloto!
  await garantirPerfil(c.usuarioId, c.pessoa)
  const perfil = await prisma.copilotoPerfil.update({ where: { usuarioId_pessoa: { usuarioId: c.usuarioId, pessoa: c.pessoa } }, data: { ...p.data, objetivo: p.data.objetivo === undefined ? undefined : p.data.objetivo || null } })
  // O objetivo dito pela pessoa também entra na memória.
  if (p.data.objetivo) {
    const atual = await prisma.copilotoMemoria.findFirst({ where: { usuarioId: c.usuarioId, pessoa: c.pessoa, chave: 'perfil:objetivo' } })
    if (atual) await prisma.copilotoMemoria.update({ where: { id: atual.id }, data: { texto: p.data.objetivo, ativa: true } })
    else await prisma.copilotoMemoria.create({ data: { usuarioId: c.usuarioId, pessoa: c.pessoa, chave: 'perfil:objetivo', tipo: 'OBJETIVO', texto: p.data.objetivo, natureza: 'PEDIDO', origem: 'USUARIO' } })
  }
  res.json(perfil)
})

export default router
