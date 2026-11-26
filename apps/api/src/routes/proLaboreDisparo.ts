// ARIES DISPARO — rotas da API (/pro-labore/disparo/...).
// Permissão: módulo "disparo" (VER acompanha; EDITAR cria, inicia, pausa). Configurações e
// autorizações em lote ficam com o dono. Quem não é da gestão vê e mexe só nas próprias campanhas,
// usa só o próprio número e sua campanha passa por aprovação (se a loja exigir).
// As rotas mudam o estado; o envio é do motor (lib/disparo/motor.ts), que roda pela rotina automática
// (/sm/cron/disparo e /sm/cron/minuto) e também pela tela da campanha aberta (POST /disparo/processar).
import express, { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { requireModulo } from '../lib/acessos'
import { papelDoUsuario } from '../lib/papelHoje'
import { gravarNoBlob, lerDoBlob } from '../lib/armazenamento'
import { lerConfigLoja, lerConfigEnvio, normalizarTelefone, renderizar, ROTULO_STATUS, ROTULO_FINALIDADE, VARIAVEIS, EDITAVEL, FINALIDADES, TIPOS_PASSO, type Conteudo, type StatusCampanha } from '../lib/disparo/regras'
import { CAMPOS, JORNADA, MOTIVOS, PREDEFINIDOS, BASES, BASES_INSTAGRAM, contagemJornada, definicaoDaEtapa, resolverPublico, valoresDoContato, type DefinicaoPublico } from '../lib/disparo/publico'
import { ErroDisparo, cancelarCampanha, configDaLoja, decidirMensagem, disparoAtivo, evento, prepararCampanha, rodarDisparo, situacaoDoEnvio, transicionar } from '../lib/disparo/motor'
import { comTrava, ultimasRodadas } from '../lib/disparo/travas'
import { MAX_POR_HORA_INSTAGRAM } from '../lib/disparo/instagram'
import { estadosDeAutorizacao, registrarAutorizacao, ROTULO_BASE, BASES_LEGAIS } from '../lib/disparo/autorizacao'
import { provedor } from '../lib/disparo/provedor'
import { comparativo, resultadoComercial, resumoCampanha, visaoGeral } from '../lib/disparo/relatorios'
import { ErroMidia, LIMITE_SEM_ARMAZENAMENTO, MIMES as MIMES_MIDIA, PARTE_BYTES, capaDaMidia, concluirEnvio, guardarCapa, iniciarEnvio, importarDoInstagram, limiteDe, listarMidias, mimePeloConteudo, nomeSeguro, publicacoesDoInstagram, receberParte, storiesDoInstagram } from '../lib/disparo/midias'
import { linksTemporarios, supabaseConfigurado } from '../lib/armazenamento'

const router = Router()
const MB = 1024 * 1024
const POR_PAGINA = 25

// ---------- Quem está pedindo ----------

interface Quem { usuarioId: string; papelLogin: string; papel: string; gestao: boolean; dono: boolean; vendedorId: string | null; sdr: boolean; nome: string }
function quem(req: Request): Quem {
  const u = req.proLaboreUser!
  const papel = papelDoUsuario(u)
  return { usuarioId: u.sub, papelLogin: u.papel, papel, gestao: papel === 'DONO' || papel === 'SUPERVISOR', dono: papel === 'DONO', vendedorId: u.vendedorId ?? null, sdr: !!u.sdr, nome: u.nome }
}
// Sem trava de carteira: qualquer pessoa com o Disparo monta público com todos os contatos da loja
// (leads, clientes, conversas e equipe) e escolhe quem quiser (pedido do dono, 25/11/2026).
const leitorDe = (q: Quem) => ({ usuarioId: q.usuarioId, papel: 'DONO', vendedorId: null, sdr: false })
const semSocial = (req: Request, res: Response, next: () => void) => { if (req.proLaboreUser?.papel === 'SOCIAL_MEDIA') { res.status(403).json({ error: 'O Disparo não faz parte do espaço do Social Media.' }); return } next() }
const ver = [requireProLaboreAuth, semSocial, requireModulo('disparo', 'VER')]
const editar = [requireProLaboreAuth, semSocial, requireModulo('disparo', 'EDITAR')]
const soDono = (req: Request, res: Response, next: () => void) => { if (!quem(req).dono) { res.status(403).json({ error: 'Só o dono mexe nas configurações e nas autorizações em lote do Disparo.' }); return } next() }
const soGestao = (req: Request, res: Response, next: () => void) => { if (!quem(req).gestao) { res.status(403).json({ error: 'Só o dono e o supervisor aprovam campanhas.' }); return } next() }

function falha(res: Response, e: unknown) {
  if (e instanceof ErroDisparo) { res.status(e.status).json({ error: e.message }); return }
  if (e instanceof z.ZodError) { res.status(400).json({ error: e.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }); return }
  throw e
}

/** Campanha visível para quem pede (gestão vê todas da loja; operador, só as que criou). */
async function campanhaDe(req: Request, id: string) {
  const q = quem(req)
  const c = await prisma.disparoCampanha.findFirst({ where: { id, usuarioId: q.usuarioId, excluidaEm: null, ...(q.gestao ? {} : { criadoPorId: q.vendedorId ?? '__nenhum__' }) } })
  if (!c) throw new ErroDisparo('Campanha não encontrada', 404)
  return c
}
/**
 * De quem são as campanhas que a tela mostra (lista, números, respostas, comparação, Jornada).
 * Cada pessoa vê só as que ela criou. Dono e supervisor escolhem: "minhas" (padrão), "equipe"
 * (todas da loja), "dono" ou o id de um vendedor. Campanha criada pelo dono tem criadoPorId vazio.
 */
function escopo(q: Quem, de: unknown): Prisma.DisparoCampanhaWhereInput {
  if (!q.gestao) return { criadoPorId: q.vendedorId ?? '__nenhum__' }
  const v = typeof de === 'string' ? de.trim() : ''
  if (v === 'equipe') return {}
  if (v === 'dono') return { criadoPorId: null }
  if (v && v !== 'minhas') return { criadoPorId: v.slice(0, 40) }
  return { criadoPorId: q.vendedorId ?? null }
}
/** Números que a pessoa pode usar para enviar. */
async function remetentesDe(q: Quem) {
  return prisma.assistenteComercial.findMany({
    where: { vendedor: { usuarioId: q.usuarioId }, ...(q.gestao ? {} : { vendedorId: q.vendedorId ?? '__nenhum__' }) },
    select: { id: true, numeroWhatsapp: true, status: true, vendedorId: true, vendedor: { select: { nome: true, ativo: true } } },
  })
}

// ---------- Esquemas ----------

const zCond: z.ZodType<unknown> = z.lazy(() => z.union([z.object({ campo: z.string().max(40), op: z.string().max(20), valor: z.unknown().optional() }), z.object({ op: z.enum(['E', 'OU']), itens: z.array(zCond).max(30) })]))
const zDefinicao = z.object({
  base: z.enum(BASES), predefinido: z.string().max(40).nullable().optional(),
  filtros: z.object({ op: z.enum(['E', 'OU']), itens: z.array(zCond).max(30) }).nullable().optional(),
  manual: z.object({ incluir: z.array(z.object({ tipo: z.enum(['LEAD', 'CLIENTE', 'CONVERSA']), id: z.string().max(40), nome: z.string().max(160).nullable().optional() })).max(50_000).optional(), excluir: z.array(z.string().max(30)).max(50_000).optional(), numeros: z.array(z.object({ telefone: z.string().max(30), nome: z.string().max(160).nullable().optional() })).max(50_000).optional(), apenasManual: z.boolean().optional() }).nullable().optional(),
})
const zPasso = z.object({ tipo: z.enum(TIPOS_PASSO), texto: z.string().max(4000).nullable().optional(), midiaId: z.string().max(40).nullable().optional(), esperarMin: z.number().int().min(0).max(60 * 24 * 30).optional() })
const zConteudo = z.object({ passos: z.array(zPasso).min(1).max(10), fallbacks: z.record(z.string(), z.string().max(120)).optional(), rodapeSair: z.boolean().optional() })
const zCampanha = z.object({
  nome: z.string().trim().min(2).max(120), descricao: z.string().max(1000).nullable().optional(), objetivo: z.string().max(200).nullable().optional(),
  finalidade: z.enum(FINALIDADES), assistenteId: z.string().max(40).nullable().optional(), publicoId: z.string().max(40).nullable().optional(),
  canal: z.enum(['WHATSAPP', 'INSTAGRAM']).default('WHATSAPP'),
  publico: zDefinicao, conteudo: zConteudo, config: z.record(z.string(), z.unknown()).optional(),
  agendadaPara: z.string().datetime().nullable().optional(), recorrencia: z.object({ tipo: z.enum(['DIARIA', 'SEMANAL', 'MENSAL']), ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).nullable().optional(),
})

/** Regras do canal Instagram (Meta): público de quem interagiu, sem documento, resposta privada só texto. */
function validarCanal(canal: string, publico: DefinicaoPublico, conteudo: Conteudo) {
  const baseIg = BASES_INSTAGRAM.includes(publico.base)
  if (canal !== 'INSTAGRAM') {
    if (baseIg) throw new ErroDisparo('Este público é do Instagram: escolha o canal Instagram na campanha')
    return
  }
  if (!baseIg) throw new ErroDisparo('No Instagram só dá para enviar para quem falou com a conta: escolha um público do Instagram (direct, story ou comentários)')
  for (const [i, p] of conteudo.passos.entries()) {
    if (p.tipo === 'DOCUMENTO') throw new ErroDisparo(`A mensagem ${i + 1} é um documento: o direct do Instagram aceita texto, foto, vídeo ou áudio`)
  }
  if (publico.base === 'INSTAGRAM_COMENTARIOS' && (conteudo.passos[0]?.tipo !== 'TEXTO' || !conteudo.passos[0]?.texto?.trim())) throw new ErroDisparo('Para quem comentou, a 1ª mensagem vai como resposta privada e precisa ser só texto (regra da Meta)')
}

function validarConteudo(conteudo: Conteudo) {
  for (const [i, p] of conteudo.passos.entries()) {
    if (p.tipo === 'TEXTO' && !p.texto?.trim()) throw new ErroDisparo(`A mensagem ${i + 1} está sem texto`)
    if (p.tipo !== 'TEXTO' && !p.midiaId) throw new ErroDisparo(`A mensagem ${i + 1} precisa de um arquivo da biblioteca`)
    const r = renderizar(p.texto ?? '', {}, conteudo.fallbacks ?? {})
    if (r.desconhecidas.length) throw new ErroDisparo(`Variável desconhecida na mensagem ${i + 1}: ${r.desconhecidas.map(v => `{{${v}}}`).join(', ')}`)
  }
}

// ---------- Metadados e configuração ----------

router.get('/disparo/meta', ...ver, async (req, res) => {
  const q = quem(req)
  const [remetentes, vendedores, config, rodadas, contaInstagram] = await Promise.all([
    remetentesDe(q),
    q.gestao ? prisma.vendedor.findMany({ where: { usuarioId: q.usuarioId }, orderBy: [{ ativo: 'desc' }, { nome: 'asc' }], select: { id: true, nome: true, ativo: true } }) : Promise.resolve([]),
    configDaLoja(q.usuarioId),
    ultimasRodadas(),
    prisma.socialMediaConta.findUnique({ where: { titular: `dono:${q.usuarioId}` }, select: { nomeUsuario: true, tipoConexao: true } }),
  ])
  const ultimaRotinaEm = rodadas.rotina?.em ?? null
  res.json({
    midias: { limites: { IMAGEM: limiteDe('IMAGEM'), VIDEO: limiteDe('VIDEO'), AUDIO: limiteDe('AUDIO'), DOCUMENTO: limiteDe('DOCUMENTO') }, uploadDireto: supabaseConfigurado(), instagram: contaInstagram?.nomeUsuario ?? null },
    motor: { ultimaRotinaEm, rotinaLigada: !!ultimaRotinaEm && Date.now() - new Date(ultimaRotinaEm).getTime() <= 10 * 60_000 },
    papel: q.papel, gestao: q.gestao, dono: q.dono, nivel: q.dono ? 'EDITAR' : req.acessos?.disparo ?? 'NENHUM',
    capacidades: provedor().capacidades(), variaveis: VARIAVEIS, campos: CAMPOS, predefinidos: PREDEFINIDOS.map(p => ({ chave: p.chave, nome: p.nome, descricao: p.descricao, definicao: p.definicao, grupo: p.grupo ?? null })),
    jornada: JORNADA.map(j => ({ ...j, definicao: definicaoDaEtapa(j.etapa) })),
    motivos: MOTIVOS, status: ROTULO_STATUS, finalidades: ROTULO_FINALIDADE, basesLegais: BASES_LEGAIS.map(b => ({ chave: b, rotulo: ROTULO_BASE[b] })),
    remetentes: remetentes.map(r => ({ id: r.id, vendedor: r.vendedor.nome, numero: r.numeroWhatsapp ? `final ${r.numeroWhatsapp.slice(-4)}` : null, conectado: r.status === 'CONECTADO', ativo: r.vendedor.ativo })),
    vendedores, config,
    // Quem está vendo (para "minhas campanhas") e de quem a gestão pode filtrar.
    eu: { vendedorId: q.vendedorId, nome: q.nome },
    instagram: { conectado: !!contaInstagram, usuario: contaInstagram?.nomeUsuario ?? null, maxPorHora: MAX_POR_HORA_INSTAGRAM },
  })
})
router.get('/disparo/config', ...ver, soDono, async (req, res) => { res.json(await configDaLoja(quem(req).usuarioId)) })
router.put('/disparo/config', ...ver, soDono, async (req, res) => {
  const q = quem(req)
  const atual = await configDaLoja(q.usuarioId)
  const nova = lerConfigLoja({ ...atual, ...(req.body ?? {}), envio: lerConfigEnvio({ ...atual.envio, ...(req.body?.envio ?? {}) }) })
  await prisma.disparoConfig.upsert({ where: { usuarioId: q.usuarioId }, create: { usuarioId: q.usuarioId, config: nova as unknown as Prisma.InputJsonValue }, update: { config: nova as unknown as Prisma.InputJsonValue } })
  await evento({ usuarioId: q.usuarioId, tipo: 'CONFIG_ALTERADA', descricao: 'Configurações do Disparo alteradas', dados: nova as unknown as Prisma.InputJsonValue, autorNome: q.nome })
  res.json(nova)
})

// ---------- Públicos ----------

router.post('/disparo/publicos/previa', ...ver, async (req, res) => {
  try {
    const q = quem(req)
    const b = z.object({ definicao: zDefinicao, finalidade: z.enum(FINALIDADES).default('MARKETING'), conteudo: zConteudo.nullable().optional(), assistenteId: z.string().max(40).nullable().optional(), pagina: z.number().int().min(0).max(1000).default(0), excluidos: z.boolean().default(false) }).parse(req.body)
    const remetente = b.assistenteId ? await prisma.assistenteComercial.findFirst({ where: { id: b.assistenteId, vendedor: { usuarioId: q.usuarioId } }, select: { numeroWhatsapp: true } }) : null
    const r = await resolverPublico(leitorDe(q), b.definicao as DefinicaoPublico, { finalidade: b.finalidade, config: await configDaLoja(q.usuarioId), conteudo: b.conteudo as Conteudo | null, remetenteNumero: remetente?.numeroWhatsapp ?? null })
    const fonte = b.excluidos ? r.excluidos.map(x => ({ ...x.contato, motivo: x.motivo })) : r.elegiveis.map(c => ({ ...c, motivo: null as string | null }))
    const pagina = fonte.slice(b.pagina * POR_PAGINA, (b.pagina + 1) * POR_PAGINA).map(c => ({ telefone: c.instagram ? c.bruto : c.telefone ? `+${c.telefone.slice(0, 4)} •••• ${c.telefone.slice(-4)}` : null, telefoneCompleto: c.telefone, instagram: c.instagram ? { janelaAte: c.instagram.janelaAte?.toISOString() ?? null, modo: c.instagram.comentarioId ? 'COMENTARIO' : 'DM', canal: c.instagram.canal } : null, nome: c.nome, vendedor: c.vendedorNome, situacao: c.situacao, etapa: c.etapa, origem: c.origem, cidade: c.cidade, autorizacao: c.autorizacao, leadId: c.leadId, clienteId: c.clienteId, motivo: c.motivo }))
    // Prévia da mensagem com o primeiro contato elegível (variáveis já trocadas).
    let exemplo: string[] | null = null
    if (b.conteudo && r.elegiveis[0]) {
      const loja = (await prisma.proLaboreUsuario.findUnique({ where: { id: q.usuarioId }, select: { nome: true } }))?.nome ?? ''
      const v = await valoresDoContato(r.elegiveis[0], loja)
      exemplo = b.conteudo.passos.map(p => renderizar(p.texto ?? '', v, b.conteudo!.fallbacks ?? {}).texto)
    }
    res.json({ selecionados: r.selecionados, elegiveis: r.elegiveis.length, excluidos: r.selecionados - r.elegiveis.length, porMotivo: r.porMotivo, pagina, total: fonte.length, porPagina: POR_PAGINA, exemplo })
  } catch (e) { falha(res, e) }
})
router.get('/disparo/publicos', ...ver, async (req, res) => {
  res.json(await prisma.disparoPublico.findMany({ where: { usuarioId: quem(req).usuarioId, arquivadoEm: null }, orderBy: { atualizadoEm: 'desc' } }))
})
router.post('/disparo/publicos', ...editar, async (req, res) => {
  try {
    const q = quem(req)
    const b = z.object({ nome: z.string().trim().min(2).max(120), descricao: z.string().max(500).nullable().optional(), definicao: zDefinicao }).parse(req.body)
    res.status(201).json(await prisma.disparoPublico.create({ data: { usuarioId: q.usuarioId, nome: b.nome, descricao: b.descricao ?? null, definicao: b.definicao as Prisma.InputJsonValue, criadoPorNome: q.nome } }))
  } catch (e) { falha(res, e) }
})
router.put('/disparo/publicos/:id', ...editar, async (req, res) => {
  try {
    const q = quem(req)
    const b = z.object({ nome: z.string().trim().min(2).max(120), descricao: z.string().max(500).nullable().optional(), definicao: zDefinicao }).parse(req.body)
    const r = await prisma.disparoPublico.updateMany({ where: { id: String(req.params.id), usuarioId: q.usuarioId }, data: { nome: b.nome, descricao: b.descricao ?? null, definicao: b.definicao as Prisma.InputJsonValue } })
    if (!r.count) throw new ErroDisparo('Público não encontrado', 404)
    res.json({ ok: true })
  } catch (e) { falha(res, e) }
})
router.post('/disparo/publicos/:id/arquivar', ...editar, async (req, res) => {
  await prisma.disparoPublico.updateMany({ where: { id: String(req.params.id), usuarioId: quem(req).usuarioId }, data: { arquivadoEm: new Date() } })
  res.json({ ok: true })
})
// Jornada do CRM: quantos estão em cada etapa agora e as estratégias contínuas de cada etapa.
const etapaDaDefinicao = (d: unknown): string | null => {
  const def = (d ?? {}) as DefinicaoPublico
  if (def.predefinido?.startsWith('ETAPA_')) return def.predefinido.slice(6)
  const achar = (g: unknown): string | null => {
    const x = g as { campo?: string; op?: string; valor?: unknown; itens?: unknown[] } | null
    if (!x) return null
    if (x.campo === 'etapa' && x.op === 'igual' && typeof x.valor === 'string') return x.valor
    for (const i of x.itens ?? []) { const r = achar(i); if (r) return r }
    return null
  }
  return achar(def.filtros)
}
router.get('/disparo/jornada', ...ver, async (req, res) => {
  try {
    const q = quem(req)
    const [etapas, campanhas] = await Promise.all([
      contagemJornada(q.usuarioId),
      prisma.disparoCampanha.findMany({ where: { usuarioId: q.usuarioId, excluidaEm: null, ...escopo(q, req.query.de), status: { in: ['DRAFT', 'VALIDATING', 'NEEDS_REVIEW', 'READY', 'SCHEDULED', 'QUEUED', 'RUNNING', 'PAUSED'] } }, select: { id: true, nome: true, status: true, config: true, publico: true, totais: true, objetivo: true } }),
    ])
    const estrategias = campanhas.filter(c => lerConfigEnvio(c.config).continua).map(c => ({ id: c.id, nome: c.nome, status: c.status, objetivo: c.objetivo, etapa: etapaDaDefinicao(c.publico), entraram: ((c.totais ?? {}) as { elegiveis?: number }).elegiveis ?? 0 }))
    res.json({ etapas: etapas.map(e => ({ ...e, estrategias: estrategias.filter(s => s.etapa === e.etapa) })), outras: estrategias.filter(s => !s.etapa || !etapas.some(e => e.etapa === s.etapa)) })
  } catch (e) { falha(res, e) }
})

// Seleção manual: busca de contatos no CRM (paginada no servidor).
router.get('/disparo/contatos', ...ver, async (req, res) => {
  const q = quem(req)
  const busca = String(req.query.busca ?? '').trim()
  if (busca.length < 2) { res.json({ itens: [] }); return }
  const dig = busca.replace(/\D/g, '')
  const r = await resolverPublico(leitorDe(q), { base: 'TODOS' }, { config: await configDaLoja(q.usuarioId) })
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const alvo = norm(busca)
  const todos = [...r.elegiveis, ...r.excluidos.map(x => x.contato)].filter(c => norm(c.nome ?? '').includes(alvo) || (dig.length >= 4 && (c.telefone ?? '').includes(dig)))
  res.json({ total: todos.length, itens: todos.slice(0, 2000).map(c => ({ tipo: c.leadId ? 'LEAD' : c.clienteId ? 'CLIENTE' : 'CONVERSA', id: c.leadId ?? c.clienteId ?? c.conversaId, nome: c.nome, telefone: c.telefone ? `final ${c.telefone.slice(-4)}` : null, telefoneCompleto: c.telefone, vendedor: c.vendedorNome, situacao: c.situacao })).filter(x => x.id) })
})

// ---------- Campanhas ----------

router.get('/disparo/campanhas', ...ver, async (req, res) => {
  const q = quem(req)
  const status = typeof req.query.status === 'string' && req.query.status ? req.query.status.split(',') : null
  const pagina = Math.max(0, Number(req.query.pagina ?? 0) || 0)
  const where: Prisma.DisparoCampanhaWhereInput = { usuarioId: q.usuarioId, excluidaEm: null, ...escopo(q, req.query.de), ...(status ? { status: { in: status } } : { status: { not: 'ARCHIVED' } }) }
  const [total, itens] = await Promise.all([
    prisma.disparoCampanha.count({ where }),
    prisma.disparoCampanha.findMany({ where, orderBy: { atualizadoEm: 'desc' }, skip: pagina * POR_PAGINA, take: POR_PAGINA, select: { id: true, nome: true, objetivo: true, finalidade: true, status: true, agendadaPara: true, iniciadaEm: true, concluidaEm: true, totais: true, responsavelNome: true, criadoPorNome: true, erro: true, atualizadoEm: true, config: true, canal: true, assistente: { select: { vendedor: { select: { nome: true } } } } } }),
  ])
  res.json({ total, pagina, porPagina: POR_PAGINA, itens })
})

// Excluir (uma ou várias): some da tela e dos relatórios. Se ainda pode enviar, é cancelada antes
// (nada mais sai). Nada é apagado: mensagens, destinatários e auditoria ficam no banco.
const ATIVAS_PARA_CANCELAR = ['VALIDATING', 'NEEDS_REVIEW', 'READY', 'SCHEDULED', 'QUEUED', 'RUNNING', 'PAUSED']
router.post('/disparo/campanhas/excluir', ...editar, async (req, res) => {
  try {
    const q = quem(req)
    const { ids } = z.object({ ids: z.array(z.string().min(1).max(40)).min(1).max(100) }).parse(req.body)
    let excluidas = 0, canceladas = 0
    for (const id of [...new Set(ids)]) {
      const c = await campanhaDe(req, id).catch(() => null)
      if (!c) continue
      if (ATIVAS_PARA_CANCELAR.includes(c.status)) { await cancelarCampanha(c.id, q.nome); canceladas += 1 }
      const r = await prisma.disparoCampanha.updateMany({ where: { id: c.id, excluidaEm: null }, data: { excluidaEm: new Date(), excluidaPorNome: q.nome } })
      if (r.count) { excluidas += 1; await evento({ usuarioId: c.usuarioId, campanhaId: c.id, tipo: 'EXCLUIDA', descricao: 'Excluída da tela (os registros continuam guardados)', autorNome: q.nome }) }
    }
    res.json({ excluidas, canceladas })
  } catch (e) { falha(res, e) }
})

router.post('/disparo/campanhas', ...editar, async (req, res) => {
  try {
    const q = quem(req)
    const b = zCampanha.parse(req.body)
    validarConteudo(b.conteudo as Conteudo)
    validarCanal(b.canal, b.publico as DefinicaoPublico, b.conteudo as Conteudo)
    if (b.assistenteId && !(await remetentesDe(q)).some(r => r.id === b.assistenteId)) throw new ErroDisparo('Você não pode enviar por esse número', 403)
    const c = await prisma.disparoCampanha.create({
      data: {
        usuarioId: q.usuarioId, nome: b.nome, descricao: b.descricao ?? null, objetivo: b.objetivo ?? null, finalidade: b.finalidade, canal: b.canal, assistenteId: b.canal === 'INSTAGRAM' ? null : b.assistenteId ?? null, publicoId: b.publicoId ?? null,
        publico: b.publico as Prisma.InputJsonValue, conteudo: b.conteudo as Prisma.InputJsonValue, config: (b.config ?? {}) as Prisma.InputJsonValue,
        agendadaPara: b.agendadaPara ? new Date(b.agendadaPara) : null, recorrencia: (b.recorrencia ?? Prisma.DbNull) as Prisma.InputJsonValue,
        responsavelId: q.vendedorId, responsavelNome: q.nome, criadoPorId: q.vendedorId, criadoPorNome: q.nome,
        versoes: { create: { versao: 1, nome: b.nome, publico: b.publico as Prisma.InputJsonValue, conteudo: b.conteudo as Prisma.InputJsonValue, config: (b.config ?? {}) as Prisma.InputJsonValue, autorNome: q.nome, motivo: 'Criada' } },
      },
    })
    await evento({ usuarioId: q.usuarioId, campanhaId: c.id, tipo: 'CRIADA', descricao: `Campanha "${c.nome}" criada`, autorNome: q.nome })
    res.status(201).json(c)
  } catch (e) { falha(res, e) }
})

router.get('/disparo/campanhas/:id', ...ver, async (req, res) => {
  try {
    const c = await campanhaDe(req, String(req.params.id))
    const [resumo, versoes, remetente, situacao] = await Promise.all([
      resumoCampanha(c.id),
      prisma.disparoCampanhaVersao.findMany({ where: { campanhaId: c.id }, orderBy: { versao: 'desc' }, select: { versao: true, nome: true, autorNome: true, motivo: true, criadoEm: true } }),
      c.assistenteId ? prisma.assistenteComercial.findUnique({ where: { id: c.assistenteId }, select: { id: true, status: true, numeroWhatsapp: true, vendedor: { select: { nome: true } } } }) : null,
      situacaoDoEnvio(c.id),
    ])
    const contaIg = c.canal === 'INSTAGRAM' ? await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${c.usuarioId}` }, select: { id: true, nomeUsuario: true } }) : null
    res.json({ ...c, resumo, versoes, situacao, remetente: c.canal === 'INSTAGRAM' ? { id: contaIg ? `ig:${contaIg.id}` : 'ig', vendedor: contaIg ? `@${contaIg.nomeUsuario} (Instagram)` : 'Instagram não conectado', numero: null, conectado: !!contaIg } : remetente ? { id: remetente.id, vendedor: remetente.vendedor.nome, numero: remetente.numeroWhatsapp ? `final ${remetente.numeroWhatsapp.slice(-4)}` : null, conectado: remetente.status === 'CONECTADO' } : null })
  } catch (e) { falha(res, e) }
})

router.put('/disparo/campanhas/:id', ...editar, async (req, res) => {
  try {
    const q = quem(req)
    const c = await campanhaDe(req, String(req.params.id))
    if (!EDITAVEL.includes(c.status as StatusCampanha)) throw new ErroDisparo('Esta campanha já começou: duplique para fazer outra', 409)
    const b = zCampanha.parse(req.body)
    validarConteudo(b.conteudo as Conteudo)
    validarCanal(b.canal, b.publico as DefinicaoPublico, b.conteudo as Conteudo)
    if (b.assistenteId && !(await remetentesDe(q)).some(r => r.id === b.assistenteId)) throw new ErroDisparo('Você não pode enviar por esse número', 403)
    const versao = c.versao + 1
    await prisma.$transaction([
      prisma.disparoCampanha.update({
        where: { id: c.id },
        data: {
          nome: b.nome, descricao: b.descricao ?? null, objetivo: b.objetivo ?? null, finalidade: b.finalidade, canal: b.canal, assistenteId: b.canal === 'INSTAGRAM' ? null : b.assistenteId ?? null, publicoId: b.publicoId ?? null,
          publico: b.publico as Prisma.InputJsonValue, conteudo: b.conteudo as Prisma.InputJsonValue, config: (b.config ?? {}) as Prisma.InputJsonValue,
          agendadaPara: b.agendadaPara ? new Date(b.agendadaPara) : null, recorrencia: (b.recorrencia ?? Prisma.DbNull) as Prisma.InputJsonValue,
          status: 'DRAFT', versao, totais: Prisma.DbNull, aprovadoEm: null, aprovadoPorNome: null, erro: null,
        },
      }),
      prisma.disparoCampanhaVersao.create({ data: { campanhaId: c.id, versao, nome: b.nome, publico: b.publico as Prisma.InputJsonValue, conteudo: b.conteudo as Prisma.InputJsonValue, config: (b.config ?? {}) as Prisma.InputJsonValue, autorNome: q.nome, motivo: 'Editada' } }),
    ])
    await evento({ usuarioId: q.usuarioId, campanhaId: c.id, tipo: 'EDITADA', descricao: `Versão ${versao}${c.status !== 'DRAFT' ? ` (voltou de ${c.status} para rascunho)` : ''}`, autorNome: q.nome })
    res.json({ ok: true, versao })
  } catch (e) { falha(res, e) }
})

router.post('/disparo/campanhas/:id/duplicar', ...editar, async (req, res) => {
  try {
    const q = quem(req)
    const c = await campanhaDe(req, String(req.params.id))
    const nova = await prisma.disparoCampanha.create({
      data: {
        usuarioId: q.usuarioId, nome: `${c.nome} (cópia)`.slice(0, 120), descricao: c.descricao, objetivo: c.objetivo, finalidade: c.finalidade, canal: c.canal, assistenteId: c.assistenteId, publicoId: c.publicoId,
        publico: c.publico as Prisma.InputJsonValue, conteudo: c.conteudo as Prisma.InputJsonValue, config: c.config as Prisma.InputJsonValue, origemId: c.id,
        responsavelId: q.vendedorId, responsavelNome: q.nome, criadoPorId: q.vendedorId, criadoPorNome: q.nome,
        versoes: { create: { versao: 1, nome: `${c.nome} (cópia)`.slice(0, 120), publico: c.publico as Prisma.InputJsonValue, conteudo: c.conteudo as Prisma.InputJsonValue, config: c.config as Prisma.InputJsonValue, autorNome: q.nome, motivo: `Duplicada de ${c.nome}` } },
      },
    })
    await evento({ usuarioId: q.usuarioId, campanhaId: nova.id, tipo: 'DUPLICADA', descricao: `Cópia de "${c.nome}"`, autorNome: q.nome })
    res.status(201).json(nova)
  } catch (e) { falha(res, e) }
})

// Revisão: prepara o público (snapshot) e, se precisar, manda para aprovação.
router.post('/disparo/campanhas/:id/validar', ...editar, async (req, res) => {
  try {
    const q = quem(req)
    const c = await campanhaDe(req, String(req.params.id))
    if (c.canal === 'INSTAGRAM') {
      if (!(await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${q.usuarioId}` }, select: { id: true } }))) throw new ErroDisparo('Conecte o Instagram da empresa em Social Media › Conexão para enviar por lá')
    } else if (!c.assistenteId) throw new ErroDisparo('Escolha o número que vai enviar')
    validarConteudo(c.conteudo as unknown as Conteudo)
    validarCanal(c.canal, c.publico as unknown as DefinicaoPublico, c.conteudo as unknown as Conteudo)
    const config = await configDaLoja(q.usuarioId)
    const aprovacao = config.exigirAprovacao && !q.gestao
    const ok = await transicionar(c.id, 'VALIDATING', { de: ['DRAFT'], autorNome: q.nome, motivo: 'Preparação do público', dados: { preparo: { leitor: leitorDe(q), aprovacao } as unknown as Prisma.InputJsonValue, erro: null } })
    if (!ok) throw new ErroDisparo('A campanha precisa estar em rascunho', 409)
    // Prepara já (até ~12 s); se não der tempo, a rotina de cada minuto termina.
    const r = await Promise.race([prepararCampanha(c.id).catch(e => { throw e }), new Promise<null>(ok2 => setTimeout(() => ok2(null), 12_000))])
    res.json({ ok: true, preparada: !!r, ...(r ?? {}) })
  } catch (e) { falha(res, e) }
})
router.post('/disparo/campanhas/:id/aprovar', ...editar, soGestao, async (req, res) => {
  try {
    const q = quem(req)
    const c = await campanhaDe(req, String(req.params.id))
    if (!(await transicionar(c.id, 'READY', { de: ['NEEDS_REVIEW'], autorNome: q.nome, motivo: 'Aprovada', dados: { aprovadoPorNome: q.nome, aprovadoEm: new Date() } }))) throw new ErroDisparo('A campanha não está aguardando aprovação', 409)
    res.json({ ok: true })
  } catch (e) { falha(res, e) }
})
router.post('/disparo/campanhas/:id/reprovar', ...editar, soGestao, async (req, res) => {
  try {
    const q = quem(req)
    const motivo = z.object({ motivo: z.string().trim().min(3).max(500) }).parse(req.body).motivo
    const c = await campanhaDe(req, String(req.params.id))
    if (!(await transicionar(c.id, 'DRAFT', { de: ['NEEDS_REVIEW'], autorNome: q.nome, motivo: `Devolvida: ${motivo}`, dados: { erro: `Devolvida por ${q.nome}: ${motivo}` } }))) throw new ErroDisparo('A campanha não está aguardando aprovação', 409)
    res.json({ ok: true })
  } catch (e) { falha(res, e) }
})
router.post('/disparo/campanhas/:id/iniciar', ...editar, async (req, res) => {
  try {
    const q = quem(req)
    const b = z.object({ quando: z.string().datetime().nullable().optional() }).parse(req.body ?? {})
    const c = await campanhaDe(req, String(req.params.id))
    const quando = b.quando ? new Date(b.quando) : c.agendadaPara
    const agendar = !!quando && quando.getTime() > Date.now() + 60_000
    const ok = await transicionar(c.id, agendar ? 'SCHEDULED' : 'QUEUED', { de: ['READY'], autorNome: q.nome, motivo: agendar ? `Agendada para ${quando!.toISOString()}` : 'Início imediato', dados: { agendadaPara: agendar ? quando : null } })
    if (!ok) throw new ErroDisparo('A campanha precisa estar pronta (revisada e, se for o caso, aprovada)', 409)
    res.json({ ok: true, status: agendar ? 'SCHEDULED' : 'QUEUED' })
  } catch (e) { falha(res, e) }
})
// Rodada do motor pedida pela tela da campanha aberta: o envio não depende só da rotina automática.
// Mesmo trabalho da rotina (respeita intervalo, limites, janela, conexão e o atendimento); uma rodada
// da tela por vez, e o número remetente tem trava própria (rotina e tela juntas não furam o intervalo).
router.post('/disparo/processar', ...ver, async (_req, res) => {
  try {
    if (!(await disparoAtivo())) { res.json({ rodou: false, motivo: 'Nenhuma campanha com envio pendente' }); return }
    const r = await comTrava('rodada:tela', 24_000, () => rodarDisparo(20_000, new Date(), 'TELA'))
    res.json(r.ok ? { rodou: true, ...r.valor } : { rodou: false, motivo: 'Já há uma rodada de envio em andamento' })
  } catch (e) { falha(res, e) }
})
router.post('/disparo/campanhas/:id/pausar', ...editar, async (req, res) => {
  try {
    const q = quem(req)
    const c = await campanhaDe(req, String(req.params.id))
    if (!(await transicionar(c.id, 'PAUSED', { de: ['RUNNING', 'QUEUED'], autorNome: q.nome, motivo: 'Pausada: nenhum envio novo até retomar' }))) throw new ErroDisparo('A campanha não está enviando', 409)
    res.json({ ok: true })
  } catch (e) { falha(res, e) }
})
router.post('/disparo/campanhas/:id/retomar', ...editar, async (req, res) => {
  try {
    const q = quem(req)
    const c = await campanhaDe(req, String(req.params.id))
    const jaTemFila = await prisma.disparoMensagem.count({ where: { campanhaId: c.id } })
    if (!(await transicionar(c.id, jaTemFila ? 'RUNNING' : 'QUEUED', { de: ['PAUSED'], autorNome: q.nome, motivo: 'Retomada' }))) throw new ErroDisparo('A campanha não está pausada', 409)
    res.json({ ok: true })
  } catch (e) { falha(res, e) }
})
router.post('/disparo/campanhas/:id/cancelar', ...editar, async (req, res) => {
  try { const c = await campanhaDe(req, String(req.params.id)); await cancelarCampanha(c.id, quem(req).nome); res.json({ ok: true }) } catch (e) { falha(res, e) }
})
router.post('/disparo/campanhas/:id/arquivar', ...editar, async (req, res) => {
  try {
    const c = await campanhaDe(req, String(req.params.id))
    if (!(await transicionar(c.id, 'ARCHIVED', { autorNome: quem(req).nome, motivo: 'Arquivada' }))) throw new ErroDisparo('Não foi possível arquivar', 409)
    res.json({ ok: true })
  } catch (e) { falha(res, e) }
})

// ---------- Monitoramento ----------

router.get('/disparo/campanhas/:id/resumo', ...ver, async (req, res) => {
  try { const c = await campanhaDe(req, String(req.params.id)); res.json(await resumoCampanha(c.id)) } catch (e) { falha(res, e) }
})
router.get('/disparo/campanhas/:id/destinatarios', ...ver, async (req, res) => {
  try {
    const c = await campanhaDe(req, String(req.params.id))
    const pagina = Math.max(0, Number(req.query.pagina ?? 0) || 0)
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : null
    const busca = String(req.query.busca ?? '').trim()
    const dig = busca.replace(/\D/g, '')
    const where: Prisma.DisparoDestinatarioWhereInput = {
      campanhaId: c.id, versao: c.versao,
      ...(status === 'RESPONDEU' ? { respondeuEm: { not: null } } : status ? { status } : {}),
      ...(busca ? { OR: [{ nome: { contains: busca, mode: 'insensitive' } }, ...(dig.length >= 4 ? [{ telefone: { contains: dig } }] : [])] } : {}),
    }
    const [total, itens] = await Promise.all([
      prisma.disparoDestinatario.count({ where }),
      prisma.disparoDestinatario.findMany({ where, orderBy: { criadoEm: 'asc' }, skip: pagina * POR_PAGINA, take: POR_PAGINA, select: { id: true, nome: true, telefone: true, status: true, motivoExclusao: true, passoAtual: true, respondeuEm: true, interrompidoPor: true, leadId: true, mensagens: { orderBy: { passo: 'desc' }, take: 1, select: { status: true, aceitaEm: true, entregueEm: true, lidaEm: true, ultimoErro: true } } } }),
    ])
    res.json({ total, pagina, porPagina: POR_PAGINA, itens: itens.map(d => ({ ...d, telefone: `final ${d.telefone.slice(-4)}` })) })
  } catch (e) { falha(res, e) }
})
router.get('/disparo/destinatarios/:id', ...ver, async (req, res) => {
  try {
    const d = await prisma.disparoDestinatario.findFirst({ where: { id: String(req.params.id), usuarioId: quem(req).usuarioId } })
    if (!d) throw new ErroDisparo('Destinatário não encontrado', 404)
    await campanhaDe(req, d.campanhaId)
    const [mensagens, eventos] = await Promise.all([
      prisma.disparoMensagem.findMany({ where: { destinatarioId: d.id }, orderBy: { passo: 'asc' }, include: { tentativasRegistro: { orderBy: { numero: 'asc' } } } }),
      prisma.disparoEvento.findMany({ where: { destinatarioId: d.id }, orderBy: { criadoEm: 'asc' } }),
    ])
    res.json({ ...d, telefone: `final ${d.telefone.slice(-4)}`, mensagens, eventos })
  } catch (e) { falha(res, e) }
})
router.get('/disparo/campanhas/:id/eventos', ...ver, async (req, res) => {
  try { const c = await campanhaDe(req, String(req.params.id)); res.json(await prisma.disparoEvento.findMany({ where: { campanhaId: c.id, destinatarioId: null }, orderBy: { criadoEm: 'desc' }, take: 100 })) } catch (e) { falha(res, e) }
})
router.post('/disparo/mensagens/:id/decidir', ...editar, async (req, res) => {
  try {
    const b = z.object({ decisao: z.enum(['REENVIAR', 'CONSIDERAR_ENVIADA']) }).parse(req.body)
    const m = await prisma.disparoMensagem.findUnique({ where: { id: String(req.params.id) }, select: { campanhaId: true } })
    if (!m) throw new ErroDisparo('Mensagem não encontrada', 404)
    await campanhaDe(req, m.campanhaId)
    await decidirMensagem(String(req.params.id), b.decisao, quem(req).nome)
    res.json({ ok: true })
  } catch (e) { falha(res, e) }
})
router.get('/disparo/campanhas/:id/comercial', ...ver, async (req, res) => {
  try { const c = await campanhaDe(req, String(req.params.id)); res.json(await resultadoComercial(c.id, quem(req).dono, Math.min(90, Math.max(1, Number(req.query.dias ?? 30) || 30)))) } catch (e) { falha(res, e) }
})

// ---------- Visão geral e relatórios ----------

const desdeDias = (v: unknown) => new Date(Date.now() - Math.min(365, Math.max(1, Number(v ?? 30) || 30)) * 86_400_000)
router.get('/disparo/visao-geral', ...ver, async (req, res) => { const q = quem(req); res.json(await visaoGeral(q.usuarioId, desdeDias(req.query.dias), escopo(q, req.query.de))) })
router.get('/disparo/relatorios/comparativo', ...ver, async (req, res) => { const q = quem(req); res.json(await comparativo(q.usuarioId, desdeDias(req.query.dias), escopo(q, req.query.de))) })

// Respostas às campanhas do escopo: quem respondeu, o quê, quando e por qual campanha.
router.get('/disparo/respostas', ...ver, async (req, res) => {
  const q = quem(req)
  const pagina = Math.max(0, Number(req.query.pagina ?? 0) || 0)
  const busca = String(req.query.busca ?? '').trim()
  const where: Prisma.DisparoDestinatarioWhereInput = {
    usuarioId: q.usuarioId, respondeuEm: { gte: desdeDias(req.query.dias) },
    campanha: { usuarioId: q.usuarioId, excluidaEm: null, ...escopo(q, req.query.de) },
    ...(busca ? { nome: { contains: busca, mode: 'insensitive' } } : {}),
  }
  const [total, itens] = await Promise.all([
    prisma.disparoDestinatario.count({ where }),
    prisma.disparoDestinatario.findMany({ where, orderBy: { respondeuEm: 'desc' }, skip: pagina * POR_PAGINA, take: POR_PAGINA, select: { id: true, nome: true, telefone: true, status: true, respondeuEm: true, leadId: true, campanhaId: true, campanha: { select: { nome: true, canal: true, criadoPorNome: true } } } }),
  ])
  const evs = await prisma.disparoEvento.findMany({ where: { destinatarioId: { in: itens.map(d => d.id) }, tipo: { in: ['RESPOSTA', 'DESCADASTRO'] } }, orderBy: { criadoEm: 'desc' }, select: { destinatarioId: true, tipo: true, descricao: true } })
  const ultima = new Map<string, string | null>()
  const saiu = new Set<string>()
  for (const e of evs) { if (e.tipo === 'RESPOSTA' && !ultima.has(e.destinatarioId!)) ultima.set(e.destinatarioId!, e.descricao); if (e.tipo === 'DESCADASTRO') saiu.add(e.destinatarioId!) }
  res.json({
    total, pagina, porPagina: POR_PAGINA,
    itens: itens.map(d => ({
      id: d.id, nome: d.nome, contato: d.telefone.startsWith('ig:') ? 'Instagram' : `final ${d.telefone.slice(-4)}`, respondeuEm: d.respondeuEm, leadId: d.leadId,
      resposta: (ultima.get(d.id) ?? '').replace(/^Instagram: /, '') || null, descadastrou: saiu.has(d.id),
      campanha: { id: d.campanhaId, nome: d.campanha.nome, canal: d.campanha.canal, criadoPor: d.campanha.criadoPorNome },
    })),
  })
})

// ---------- Biblioteca ----------

router.get('/disparo/modelos', ...ver, async (req, res) => {
  res.json(await prisma.disparoModelo.findMany({ where: { usuarioId: quem(req).usuarioId, arquivadoEm: null }, orderBy: { atualizadoEm: 'desc' } }))
})
router.post('/disparo/modelos', ...editar, async (req, res) => {
  try {
    const q = quem(req)
    const b = z.object({ nome: z.string().trim().min(2).max(120), conteudo: zConteudo }).parse(req.body)
    validarConteudo(b.conteudo as Conteudo)
    res.status(201).json(await prisma.disparoModelo.create({ data: { usuarioId: q.usuarioId, nome: b.nome, conteudo: b.conteudo as Prisma.InputJsonValue, criadoPorNome: q.nome } }))
  } catch (e) { falha(res, e) }
})
router.put('/disparo/modelos/:id', ...editar, async (req, res) => {
  try {
    const b = z.object({ nome: z.string().trim().min(2).max(120), conteudo: zConteudo }).parse(req.body)
    validarConteudo(b.conteudo as Conteudo)
    const r = await prisma.disparoModelo.updateMany({ where: { id: String(req.params.id), usuarioId: quem(req).usuarioId }, data: { nome: b.nome, conteudo: b.conteudo as Prisma.InputJsonValue } })
    if (!r.count) throw new ErroDisparo('Modelo não encontrado', 404)
    res.json({ ok: true })
  } catch (e) { falha(res, e) }
})
router.post('/disparo/modelos/:id/arquivar', ...editar, async (req, res) => {
  await prisma.disparoModelo.updateMany({ where: { id: String(req.params.id), usuarioId: quem(req).usuarioId }, data: { arquivadoEm: new Date() } })
  res.json({ ok: true })
})

// ---------- Biblioteca de arquivos (lib/disparo/midias.ts) ----------

const falhaMidia = (res: Response, e: unknown) => {
  if (e instanceof ErroMidia) { res.status(e.status).json({ error: e.message }); return }
  falha(res, e)
}
router.get('/disparo/midias', ...ver, async (req, res) => {
  try { res.json(await listarMidias(quem(req).usuarioId)) } catch (e) { falhaMidia(res, e) }
})
// Envio simples (arquivo de até 4 MB pela API), usado quando o arquivo é pequeno.
router.post('/disparo/midias', ...editar, express.raw({ type: '*/*', limit: LIMITE_SEM_ARMAZENAMENTO }), async (req, res) => {
  const q = quem(req)
  const dados = Buffer.isBuffer(req.body) ? req.body : null
  const nome = nomeSeguro(String(req.query.nome ?? 'arquivo'))
  const declarado = String(req.headers['content-type'] ?? '').split(';')[0].trim()
  if (!dados?.length) { res.status(400).json({ error: 'Arquivo vazio' }); return }
  const mime = mimePeloConteudo(dados, declarado)
  if (!mime || !MIMES_MIDIA[mime]) { res.status(400).json({ error: 'Formato não aceito: use JPG, PNG, WebP, MP4, MOV, MP3, OGG, M4A, PDF, Word ou Excel' }); return }
  const guardado = await gravarNoBlob(`disparo/${q.usuarioId}/${nome}`, mime, dados)
  const num = (v: unknown) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null)
  const m = await prisma.disparoMidia.create({ data: { usuarioId: q.usuarioId, nome, tipo: MIMES_MIDIA[mime].tipo, mime, tamanho: dados.length, largura: num(req.query.largura), altura: num(req.query.altura), duracaoSeg: num(req.query.duracao), ...(guardado ? { blobUrl: guardado.blobUrl, blobAcesso: guardado.blobAcesso } : { dados }), criadoPorNome: q.nome } })
  res.status(201).json({ id: m.id, nome: m.nome, tipo: m.tipo, mime: m.mime, tamanho: m.tamanho, armazenamento: guardado ? 'externo' : 'banco' })
})
// Arquivo grande: 1) iniciar → 2) o navegador manda direto (ou em pedaços) → 3) concluir.
router.post('/disparo/midias/iniciar', ...editar, async (req, res) => {
  try {
    const b = z.object({ nome: z.string().trim().min(1).max(200), mime: z.string().max(120), tamanho: z.number().int().positive(), largura: z.number().int().positive().max(20000).nullable().optional(), altura: z.number().int().positive().max(20000).nullable().optional(), duracaoSeg: z.number().positive().max(36000).nullable().optional() }).parse(req.body)
    const q = quem(req)
    res.status(201).json(await iniciarEnvio(q.usuarioId, q.nome, b))
  } catch (e) { falhaMidia(res, e) }
})
router.post('/disparo/midias/:id/parte', ...editar, express.raw({ type: '*/*', limit: PARTE_BYTES + 1024 }), async (req, res) => {
  try {
    const dados = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    await receberParte(quem(req).usuarioId, String(req.params.id), Number(req.query.n), dados)
    res.json({ ok: true })
  } catch (e) { falhaMidia(res, e) }
})
router.post('/disparo/midias/:id/concluir', ...editar, async (req, res) => {
  try {
    const b = z.object({ partes: z.number().int().min(0).max(40).nullable().optional() }).parse(req.body ?? {})
    res.json(await concluirEnvio(quem(req).usuarioId, String(req.params.id), b.partes ?? null))
  } catch (e) { falhaMidia(res, e) }
})
router.post('/disparo/midias/:id/capa', ...editar, express.raw({ type: '*/*', limit: LIMITE_SEM_ARMAZENAMENTO }), async (req, res) => {
  try {
    await guardarCapa(quem(req).usuarioId, String(req.params.id), Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0))
    res.json({ ok: true })
  } catch (e) { falhaMidia(res, e) }
})
router.get('/disparo/midias/:id/capa', ...ver, async (req, res) => {
  const c = await capaDaMidia(quem(req).usuarioId, String(req.params.id))
  if (!c) { res.status(404).json({ error: 'Sem capa' }); return }
  res.setHeader('Content-Type', c.mime)
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.send(c.dados)
})
// O arquivo só sai com login (a tela usa para a prévia). Arquivo no armazenamento externo: link temporário.
router.get('/disparo/midias/:id/arquivo', ...ver, async (req, res) => {
  const m = await prisma.disparoMidia.findFirst({ where: { id: String(req.params.id), usuarioId: quem(req).usuarioId } })
  if (!m) { res.status(404).json({ error: 'Arquivo não encontrado' }); return }
  if (m.tamanho > LIMITE_SEM_ARMAZENAMENTO && m.blobUrl) {
    const url = (await linksTemporarios([m.blobUrl], 2 * 3600).catch(() => new Map<string, string>())).get(m.blobUrl)
    if (url) { res.json({ url }); return }
  }
  const dados = m.blobUrl ? await lerDoBlob(m.blobUrl, m.blobAcesso) : m.dados ? Buffer.from(m.dados) : null
  if (!dados) { res.status(410).json({ error: 'Arquivo indisponível no armazenamento' }); return }
  res.setHeader('Content-Type', m.mime)
  res.setHeader('Cache-Control', 'private, max-age=300')
  res.send(dados)
})
router.post('/disparo/midias/:id/arquivar', ...editar, async (req, res) => {
  await prisma.disparoMidia.updateMany({ where: { id: String(req.params.id), usuarioId: quem(req).usuarioId }, data: { arquivadoEm: new Date() } })
  res.json({ ok: true })
})
// Instagram da empresa: publicações recentes e importação para a Biblioteca.
router.get('/disparo/instagram', ...ver, async (req, res) => {
  try {
    const q = quem(req)
    const opcoes = { apos: typeof req.query.apos === 'string' && req.query.apos ? req.query.apos.slice(0, 400) : null, limite: Math.min(50, Math.max(6, Number(req.query.limite) || 24)) }
    res.json(req.query.origem === 'stories' ? await storiesDoInstagram(q.usuarioId, opcoes) : await publicacoesDoInstagram(q.usuarioId, opcoes))
  } catch (e) { falhaMidia(res, e) }
})
router.post('/disparo/instagram/importar', ...editar, async (req, res) => {
  try {
    const b = z.object({ mediaId: z.string().regex(/^\d{5,40}$/), itens: z.array(z.string().regex(/^\d{5,40}$/)).max(20).nullable().optional(), comoImagem: z.boolean().optional() }).parse(req.body)
    const q = quem(req)
    res.status(201).json(await importarDoInstagram(q.usuarioId, q.nome, b.mediaId, b.itens ?? null, { comoImagem: b.comoImagem }))
  } catch (e) { falhaMidia(res, e) }
})

// ---------- Autorizações e supressão ----------

router.get('/disparo/autorizacoes', ...ver, async (req, res) => {
  const q = quem(req)
  const tel = normalizarTelefone(String(req.query.telefone ?? ''))
  const pagina = Math.max(0, Number(req.query.pagina ?? 0) || 0)
  const situacao = typeof req.query.situacao === 'string' && req.query.situacao ? req.query.situacao : null
  const where: Prisma.ContatoAutorizacaoWhereInput = { usuarioId: q.usuarioId, ...(tel ? { telefone: tel } : {}), ...(situacao ? { situacao } : {}) }
  const [total, itens] = await Promise.all([prisma.contatoAutorizacao.count({ where }), prisma.contatoAutorizacao.findMany({ where, orderBy: { criadoEm: 'desc' }, skip: pagina * POR_PAGINA, take: POR_PAGINA })])
  const atual = tel ? (await estadosDeAutorizacao(q.usuarioId, [tel])).get(tel) ?? null : null
  res.json({ total, pagina, porPagina: POR_PAGINA, atual, itens: itens.map(i => ({ ...i, telefone: q.gestao ? i.telefone : `final ${i.telefone.slice(-4)}` })) })
})
router.post('/disparo/autorizacoes', ...editar, async (req, res) => {
  try {
    const q = quem(req)
    const b = z.object({
      telefones: z.array(z.string().max(30)).min(1).max(5000), situacao: z.enum(['AUTORIZADO', 'REVOGADO', 'BLOQUEADO']),
      baseLegal: z.enum(BASES_LEGAIS).nullable().optional(), evidencia: z.string().trim().max(1000).nullable().optional(),
    }).parse(req.body)
    // Autorizar exige base legal e evidência e é só da gestão; revogar e bloquear, qualquer um com o módulo.
    if (b.situacao === 'AUTORIZADO') {
      if (!q.gestao) throw new ErroDisparo('Só o dono e o supervisor registram autorização', 403)
      if (!b.baseLegal || !b.evidencia || b.evidencia.length < 5) throw new ErroDisparo('Informe a base legal e a evidência da autorização (onde e como o contato autorizou)')
    }
    if (b.telefones.length > 1 && !q.dono) throw new ErroDisparo('Registro em lote é só do dono', 403)
    let ok = 0
    const invalidos: string[] = []
    for (const t of b.telefones) {
      if (!normalizarTelefone(t)) { invalidos.push(t); continue }
      await registrarAutorizacao({ usuarioId: q.usuarioId, telefone: t, situacao: b.situacao, baseLegal: b.baseLegal ?? null, evidencia: b.evidencia ?? null, origem: b.telefones.length > 1 ? 'IMPORTACAO' : 'MANUAL', autorNome: q.nome })
      ok += 1
    }
    await evento({ usuarioId: q.usuarioId, tipo: `AUTORIZACAO_${b.situacao}`, descricao: `${ok} contato(s) marcado(s) como ${b.situacao.toLowerCase()}${invalidos.length ? ` · ${invalidos.length} número(s) inválido(s)` : ''}`, autorNome: q.nome })
    res.json({ registrados: ok, invalidos })
  } catch (e) { falha(res, e) }
})

export default router
