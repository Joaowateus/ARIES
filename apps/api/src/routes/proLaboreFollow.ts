// Follow-up do CRM (botão Follow no card) e a Reativação (os perdidos, fora
// do funil, com tudo o que se sabia deles). O lead perdido continua com
// estagio PERDIDO, então as contas do funil não mudam.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { requireModulo } from '../lib/acessos'
import { CANAIS_FOLLOW, MOTIVOS_PERDA, TEMPERATURAS, leadWhereBase } from '../lib/escopoLead'
import { ErroWhatsapp, enviarTexto } from '../lib/whatsappEvolution'
import { lerConfig } from '../lib/assistenteRoteiro'
import { preencherResposta } from '../lib/assistenteConhecimento'
import { lerConfigFollow } from '../lib/assistenteFollow'
import { ContextoCredito, reabrirPreAnalise } from '../lib/followCredito'
import { atualizarNota, avaliarJornada } from '../lib/assistenteMotor'
import { logger } from '../lib/logger'

const router = Router()
const DIA = 864e5
const OFFSET_BR = 3 * 3600e3
/** Início do dia de hoje em Brasília (como instante UTC). */
const inicioHojeBR = (agora = new Date()) => new Date(Math.floor((agora.getTime() - OFFSET_BR) / DIA) * DIA + OFFSET_BR)
const autor = (req: Request) => req.proLaboreUser!.nome ?? null

const FOLLOW_SELECT = { id: true, agendadoPara: true, canal: true, nota: true, tipo: true, contexto: true, status: true, feitoEm: true, resultado: true, criadoPor: true, criadoEm: true } as const

// ---------- Follow ----------

/** Contagem para o selo do menu e o aviso do CRM: atrasados (antes de hoje) e de hoje. */
router.get('/follows/contagem', requireProLaboreAuth, requireModulo('crm', 'VER'), async (req: Request, res: Response) => {
  const hoje = inicioHojeBR(), amanha = new Date(hoje.getTime() + DIA)
  const lead = { ...leadWhereBase(req) }
  const [atrasados, deHoje] = await Promise.all([
    prisma.leadFollow.count({ where: { status: 'PENDENTE', agendadoPara: { lt: hoje }, lead } }),
    prisma.leadFollow.count({ where: { status: 'PENDENTE', agendadoPara: { gte: hoje, lt: amanha }, lead } }),
  ])
  res.json({ atrasados, hoje: deHoje })
})

/** Follows pendentes (atrasados, de hoje e próximos 7 dias) com o resumo do lead. */
router.get('/follows', requireProLaboreAuth, requireModulo('crm', 'VER'), async (req: Request, res: Response) => {
  const ate = new Date(inicioHojeBR().getTime() + 8 * DIA)
  const follows = await prisma.leadFollow.findMany({
    where: { status: 'PENDENTE', agendadoPara: { lt: ate }, lead: { ...leadWhereBase(req) } },
    orderBy: { agendadoPara: 'asc' }, take: 200,
    select: { ...FOLLOW_SELECT, lead: { select: { id: true, nomeCliente: true, telefone: true, estagio: true, modeloInteresse: true, vendedor: { select: { id: true, nome: true } } } } },
  })
  res.json(follows)
})

router.get('/leads/:id/follows', requireProLaboreAuth, requireModulo('crm', 'VER'), async (req: Request, res: Response) => {
  const lead = await prisma.lead.findFirst({ where: { id: String(req.params.id), ...leadWhereBase(req) }, select: { id: true } })
  if (!lead) { res.status(404).json({ error: 'Lead não encontrado' }); return }
  res.json(await prisma.leadFollow.findMany({ where: { leadId: lead.id }, orderBy: { agendadoPara: 'desc' }, select: FOLLOW_SELECT }))
})

const novoFollowSchema = z.object({
  agendadoPara: z.string().datetime({ offset: true, message: 'Data e hora do follow inválidas' }),
  canal: z.enum(CANAIS_FOLLOW).optional(),
  nota: z.string().trim().max(1000).optional(),
})

/** Agenda o próximo follow do lead. Um lead tem um follow comum pendente por vez: o anterior vira "reagendado" (a nova análise de crédito fica). */
router.post('/leads/:id/follows', requireProLaboreAuth, requireModulo('crm', 'EDITAR'), async (req: Request, res: Response) => {
  const p = novoFollowSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const lead = await prisma.lead.findFirst({ where: { id: String(req.params.id), ...leadWhereBase(req) }, select: { id: true, usuarioId: true, vendedorId: true } })
  if (!lead) { res.status(404).json({ error: 'Lead não encontrado' }); return }
  const follow = await prisma.$transaction(async tx => {
    await tx.leadFollow.updateMany({ where: { leadId: lead.id, status: 'PENDENTE', tipo: 'CONTATO' }, data: { status: 'CANCELADO', resultado: 'Reagendado' } })
    return tx.leadFollow.create({
      data: { usuarioId: lead.usuarioId, leadId: lead.id, vendedorId: lead.vendedorId, agendadoPara: new Date(p.data.agendadoPara), canal: p.data.canal ?? null, nota: p.data.nota || null, criadoPor: autor(req) },
      select: FOLLOW_SELECT,
    })
  })
  res.status(201).json(follow)
})

const editarFollowSchema = z.object({
  status: z.enum(['FEITO', 'CANCELADO']),
  resultado: z.string().trim().max(1000).optional(),
  // Já agenda o próximo junto (ex.: "falei, retornar em 3 dias").
  proximo: novoFollowSchema.optional(),
})

router.patch('/follows/:id', requireProLaboreAuth, requireModulo('crm', 'EDITAR'), async (req: Request, res: Response) => {
  const p = editarFollowSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const atual = await prisma.leadFollow.findFirst({ where: { id: String(req.params.id), lead: { ...leadWhereBase(req) } }, include: { lead: { select: { id: true, usuarioId: true, vendedorId: true } } } })
  if (!atual) { res.status(404).json({ error: 'Follow não encontrado' }); return }
  if (atual.status !== 'PENDENTE') { res.status(409).json({ error: 'Este follow já foi encerrado.' }); return }
  const r = await prisma.$transaction(async tx => {
    const feito = await tx.leadFollow.update({ where: { id: atual.id }, data: { status: p.data.status, feitoEm: p.data.status === 'FEITO' ? new Date() : null, resultado: p.data.resultado || (p.data.status === 'CANCELADO' ? 'Cancelado' : null) }, select: FOLLOW_SELECT })
    const proximo = p.data.proximo
      ? await tx.leadFollow.create({ data: { usuarioId: atual.lead.usuarioId, leadId: atual.lead.id, vendedorId: atual.lead.vendedorId, agendadoPara: new Date(p.data.proximo.agendadoPara), canal: p.data.proximo.canal ?? null, nota: p.data.proximo.nota || null, criadoPor: autor(req) }, select: FOLLOW_SELECT })
      : null
    return { feito, proximo }
  })
  res.json(r)
})

// ---------- Mensagem pelo WhatsApp e nova análise de crédito ----------

async function followDoPedido(req: Request, res: Response) {
  const f = await prisma.leadFollow.findFirst({
    where: { id: String(req.params.id), lead: { ...leadWhereBase(req) } },
    include: { lead: { select: { id: true, usuarioId: true, vendedorId: true, nomeCliente: true, telefone: true, modeloInteresse: true } } },
  })
  if (!f) { res.status(404).json({ error: 'Follow não encontrado' }); return null }
  return f
}
type FollowComLead = NonNullable<Awaited<ReturnType<typeof followDoPedido>>>

/** A conversa do lead no WhatsApp do sistema (a da pré-análise, no follow de crédito). Vendedor só manda pelo próprio número. */
async function conversaDoFollow(req: Request, f: FollowComLead) {
  const ctx = f.tipo === 'CREDITO' ? (f.contexto as ContextoCredito | null) : null
  const conversa = await prisma.assistenteConversa.findFirst({
    where: { tipo: 'LEAD', ...(ctx?.conversaId ? { id: ctx.conversaId } : { leadId: f.leadId }), assistente: { vendedor: { usuarioId: f.lead.usuarioId } } },
    orderBy: { ultimaMensagemEm: 'desc' },
    include: { assistente: { include: { vendedor: { select: { id: true, nome: true } } } } },
  })
  if (!conversa) return { conversa: null, motivo: 'O cliente não tem conversa no WhatsApp do sistema' }
  const { papel, vendedorId } = req.proLaboreUser!
  if (papel !== 'DONO' && conversa.assistente.vendedorId !== vendedorId) return { conversa: null, motivo: 'A conversa do cliente está no WhatsApp de outro vendedor' }
  if (!conversa.assistente.instancia || conversa.assistente.status !== 'CONECTADO') return { conversa: null, motivo: 'O WhatsApp do vendedor não está conectado agora' }
  return { conversa, motivo: null }
}

/** O que mandar e por onde: a conversa no WhatsApp do sistema (se der) e a mensagem sugerida (nova análise de crédito). */
router.get('/follows/:id/whatsapp', requireProLaboreAuth, requireModulo('crm', 'VER'), async (req: Request, res: Response) => {
  const f = await followDoPedido(req, res)
  if (!f) return
  const { conversa, motivo } = await conversaDoFollow(req, f)
  let sugestao = ''
  if (f.tipo === 'CREDITO') {
    const loja = await prisma.assistenteLoja.findUnique({ where: { usuarioId: f.lead.usuarioId }, select: { followConfig: true } })
    const vendedor = conversa?.assistente.vendedor.nome ?? req.proLaboreUser!.nome ?? ''
    sugestao = preencherResposta(lerConfigFollow(loja?.followConfig).credito.texto, {
      nomeContato: f.lead.nomeCliente, vendedor, empresa: conversa ? lerConfig(conversa.assistente.configuracao).nomeEmpresa : '', moto: f.lead.modeloInteresse,
    })
  }
  res.json({ conversaId: conversa?.id ?? null, vendedorId: conversa?.assistente.vendedorId ?? null, motivo, telefone: f.lead.telefone, sugestao })
})

const whatsappSchema = z.object({ texto: z.string().trim().min(2, 'Escreva a mensagem').max(1500), proximo: novoFollowSchema.optional() })

/** Manda a mensagem do follow pelo WhatsApp do vendedor, dá o follow como feito e (opcional) agenda o próximo. */
router.post('/follows/:id/whatsapp', requireProLaboreAuth, requireModulo('crm', 'EDITAR'), async (req: Request, res: Response) => {
  const p = whatsappSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const f = await followDoPedido(req, res)
  if (!f) return
  if (f.status !== 'PENDENTE') { res.status(409).json({ error: 'Este follow já foi encerrado.' }); return }
  const { conversa, motivo } = await conversaDoFollow(req, f)
  if (!conversa) { res.status(409).json({ error: `${motivo}: use "Abrir no WhatsApp".` }); return }
  const registro = await prisma.assistenteMensagem.create({ data: { conversaId: conversa.id, remetente: 'VENDEDOR', texto: p.data.texto } })
  try {
    const providerId = await enviarTexto(conversa.assistente.instancia!, conversa.jid ?? conversa.numeroContato, p.data.texto)
    if (providerId) await prisma.assistenteMensagem.update({ where: { id: registro.id }, data: { providerId } }).catch(() => undefined)
  } catch (e) {
    await prisma.assistenteMensagem.delete({ where: { id: registro.id } })
    res.status(502).json({ error: e instanceof ErroWhatsapp ? e.message : 'Falha inesperada ao falar com o servidor do WhatsApp' })
    return
  }
  const agora = new Date()
  await prisma.assistenteConversa.update({
    where: { id: conversa.id },
    data: { ultimaMensagemEm: agora, ...((conversa.status === 'ATIVA' || conversa.status === 'AGUARDANDO_VENDEDOR') && { status: 'ASSUMIDA', assumidaEm: agora }) },
  })
  const trecho = p.data.texto.length > 140 ? `${p.data.texto.slice(0, 139)}…` : p.data.texto
  const r = await prisma.$transaction(async tx => {
    const feito = await tx.leadFollow.update({ where: { id: f.id }, data: { status: 'FEITO', feitoEm: agora, resultado: `Mandou pelo WhatsApp: "${trecho}"` }, select: FOLLOW_SELECT })
    const prox = p.data.proximo
    if (prox) await tx.leadFollow.updateMany({ where: { leadId: f.leadId, status: 'PENDENTE', tipo: 'CONTATO' }, data: { status: 'CANCELADO', resultado: 'Reagendado' } })
    const proximo = prox
      ? await tx.leadFollow.create({ data: { usuarioId: f.lead.usuarioId, leadId: f.leadId, vendedorId: f.lead.vendedorId, agendadoPara: new Date(prox.agendadoPara), canal: prox.canal ?? null, nota: prox.nota || null, criadoPor: autor(req) }, select: FOLLOW_SELECT })
      : null
    return { feito, proximo }
  })
  res.status(201).json(r)
})

/** Nova análise de crédito: o cliente autorizou a nova consulta, as recusas voltam para "a enviar" na ficha. */
router.post('/follows/:id/credito/reabrir', requireProLaboreAuth, requireModulo('crm', 'EDITAR'), async (req: Request, res: Response) => {
  if (req.body?.autorizado !== true) { res.status(400).json({ error: 'Confirme que o cliente autorizou a nova consulta' }); return }
  const f = await followDoPedido(req, res)
  if (!f) return
  const conversaId = f.tipo === 'CREDITO' ? (f.contexto as ContextoCredito | null)?.conversaId : null
  if (!conversaId || f.status !== 'PENDENTE') { res.status(409).json({ error: 'Este follow não é de uma nova análise pendente.' }); return }
  const conversa = await prisma.assistenteConversa.findUnique({ where: { id: conversaId }, include: { assistente: true } })
  const { papel, vendedorId } = req.proLaboreUser!
  if (!conversa || (papel !== 'DONO' && conversa.assistente.vendedorId !== vendedorId)) { res.status(403).json({ error: 'A ficha está na conversa de outro vendedor' }); return }
  if (!(await reabrirPreAnalise(conversaId, req.proLaboreUser!.nome ?? 'o vendedor'))) { res.status(409).json({ error: 'Não há recusa para refazer nesta ficha.' }); return }
  const cfg = lerConfig(conversa.assistente.configuracao)
  await atualizarNota(cfg, conversaId).catch(e => logger.warn({ err: e }, 'follow: falha na nota do lead'))
  await avaliarJornada(conversaId).catch(e => logger.warn({ err: e }, 'follow: falha na jornada do lead'))
  res.json({ conversaId, vendedorId: conversa.assistente.vendedorId })
})

// ---------- Reativação ----------

const LEAD_REATIVACAO = {
  vendedor: { select: { id: true, nome: true } },
  historico: { select: { estagioAnterior: true, estagioNovo: true, criadoEm: true }, orderBy: { criadoEm: 'asc' } },
  follows: { where: { status: 'PENDENTE' }, orderBy: { agendadoPara: 'asc' }, take: 3, select: FOLLOW_SELECT },
  _count: { select: { follows: { where: { status: 'FEITO' } } } },
} as const

/** Os perdidos, com tudo o que se sabia deles, e o resumo por motivo e temperatura. */
router.get('/reativacao', requireProLaboreAuth, requireModulo('crm', 'VER'), async (req: Request, res: Response) => {
  const escopo = leadWhereBase(req, typeof req.query.vendedorId === 'string' && req.query.vendedorId ? req.query.vendedorId : undefined)
  const desde30 = new Date(Date.now() - 30 * DIA)
  const [leads, reativados] = await Promise.all([
    prisma.lead.findMany({ where: { ...escopo, estagio: 'PERDIDO' }, include: LEAD_REATIVACAO, orderBy: [{ perdidoEm: 'desc' }, { atualizadoEm: 'desc' }] }),
    prisma.lead.count({ where: { ...escopo, reativadoEm: { gte: desde30 }, estagio: { not: 'PERDIDO' } } }),
  ])
  const porMotivo = new Map<string, number>(), porTemperatura = new Map<string, number>()
  let followsPendentes = 0
  const lista = leads.map(l => {
    const perda = [...l.historico].reverse().find(h => h.estagioNovo === 'PERDIDO')
    const perdidoEm = l.perdidoEm ?? perda?.criadoEm ?? l.fechadoEm ?? l.atualizadoEm
    porMotivo.set(l.motivoPerda ?? 'SEM_MOTIVO', (porMotivo.get(l.motivoPerda ?? 'SEM_MOTIVO') ?? 0) + 1)
    porTemperatura.set(l.temperatura ?? 'SEM_TEMPERATURA', (porTemperatura.get(l.temperatura ?? 'SEM_TEMPERATURA') ?? 0) + 1)
    if (l.follows.length) followsPendentes++
    const { _count, ...resto } = l
    return { ...resto, perdidoEm, estagioAntesDaPerda: perda?.estagioAnterior ?? null, contatosFeitos: _count.follows, proximoFollow: l.follows[0] ?? null }
  })
  res.json({
    leads: lista,
    resumo: {
      total: lista.length, followsPendentes, reativados30d: reativados,
      porMotivo: [...porMotivo].map(([motivo, n]) => ({ motivo, n })).sort((a, b) => b.n - a.n),
      porTemperatura: [...porTemperatura].map(([temperatura, n]) => ({ temperatura, n })),
    },
  })
})

const reativacaoSchema = z.object({
  motivoPerda: z.enum(MOTIVOS_PERDA).optional(),
  notaPerda: z.string().trim().max(2000).nullable().optional(),
  temperatura: z.enum(TEMPERATURAS).nullable().optional(),
})

/** Ajusta motivo, nota e temperatura de um perdido. */
router.patch('/leads/:id/reativacao', requireProLaboreAuth, requireModulo('crm', 'EDITAR'), async (req: Request, res: Response) => {
  const p = reativacaoSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const lead = await prisma.lead.findFirst({ where: { id: String(req.params.id), ...leadWhereBase(req), estagio: 'PERDIDO' }, select: { id: true } })
  if (!lead) { res.status(404).json({ error: 'Lead perdido não encontrado' }); return }
  const data: Record<string, unknown> = {}
  if (p.data.motivoPerda !== undefined) data.motivoPerda = p.data.motivoPerda
  if (p.data.notaPerda !== undefined) data.notaPerda = p.data.notaPerda || null
  if (p.data.temperatura !== undefined) data.temperatura = p.data.temperatura
  res.json(await prisma.lead.update({ where: { id: lead.id }, data, include: LEAD_REATIVACAO }))
})

export default router
