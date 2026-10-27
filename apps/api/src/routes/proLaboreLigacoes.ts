// Ligações: lembretes por lead (avulsos ou de cadência), o "Ligar" que fica
// registrado, o resultado obrigatório, a auditoria do dono e as cadências.
// Escopo igual ao dos leads: o vendedor só vê as ligações dos leads dele.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireDono, requireDonoOuSupervisor, requireProLaboreAuth } from '../middleware/authProLabore'
import { requireModulo } from '../lib/acessos'
import { leadWhereBase } from '../lib/escopoLead'
import { GATILHOS, RESULTADOS, TOLERANCIA_MS, alertasDoRegistro, aplicarCadencia, cancelarLigacoesDoLead, passoSchema } from '../lib/ligacoes'

const router = Router()
const DIA = 864e5
const quem = (req: Request) => ({ id: req.proLaboreUser!.vendedorId ?? req.proLaboreUser!.sub, nome: req.proLaboreUser!.nome ?? null })

const SELECT = {
  id: true, leadId: true, vendedorId: true, cadenciaId: true, passo: true, totalPassos: true, instrucao: true, agendadaPara: true,
  status: true, motivoCancelada: true, discadaEm: true, discagens: true, dispositivo: true, registradaEm: true, registradaPor: true,
  resultado: true, duracaoSeg: true, resumo: true, alertas: true, criadoPor: true, criadoEm: true,
} as const
const LEAD_RESUMO = { select: { id: true, nomeCliente: true, telefone: true, estagio: true, modeloInteresse: true, vendedor: { select: { id: true, nome: true } } } } as const

async function nomesDasCadencias(usuarioId: string, ids: Array<string | null>) {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))]
  if (!unicos.length) return new Map<string, string>()
  const cs = await prisma.cadenciaLigacao.findMany({ where: { usuarioId, id: { in: unicos } }, select: { id: true, nome: true } })
  return new Map(cs.map(c => [c.id, c.nome]))
}
const comCadencia = <T extends { cadenciaId: string | null }>(lista: T[], nomes: Map<string, string>) => lista.map(l => ({ ...l, cadenciaNome: l.cadenciaId ? nomes.get(l.cadenciaId) ?? null : null }))

async function ligacaoDoPedido(req: Request, res: Response) {
  const l = await prisma.ligacaoTarefa.findFirst({ where: { id: String(req.params.id), lead: { ...leadWhereBase(req) } }, include: { lead: { select: { id: true, vendedorId: true } } } })
  if (!l) { res.status(404).json({ error: 'Ligação não encontrada' }); return null }
  return l
}

// ---------- Para ligar ----------

/** Pendentes (atrasadas, de hoje e dos próximos 7 dias) com o resumo do lead. */
router.get('/ligacoes/pendentes', requireProLaboreAuth, requireModulo('crm', 'VER'), async (req: Request, res: Response) => {
  const filtro = typeof req.query.vendedorId === 'string' && req.query.vendedorId ? req.query.vendedorId : undefined
  const ate = new Date(Date.now() + 8 * DIA)
  const lista = await prisma.ligacaoTarefa.findMany({
    where: { status: 'PENDENTE', agendadaPara: { lt: ate }, lead: { ...leadWhereBase(req, filtro) } },
    orderBy: { agendadaPara: 'asc' }, take: 300,
    select: { ...SELECT, lead: LEAD_RESUMO },
  })
  res.json(comCadencia(lista, await nomesDasCadencias(req.proLaboreUser!.sub, lista.map(l => l.cadenciaId))))
})

/** Ligações do lead (todas) e as cadências que dá para iniciar nele. */
router.get('/leads/:id/ligacoes', requireProLaboreAuth, requireModulo('crm', 'VER'), async (req: Request, res: Response) => {
  const lead = await prisma.lead.findFirst({ where: { id: String(req.params.id), ...leadWhereBase(req) }, select: { id: true } })
  if (!lead) { res.status(404).json({ error: 'Lead não encontrado' }); return }
  const [lista, cadencias] = await Promise.all([
    prisma.ligacaoTarefa.findMany({ where: { leadId: lead.id }, orderBy: { agendadaPara: 'desc' }, select: SELECT }),
    prisma.cadenciaLigacao.findMany({ where: { usuarioId: req.proLaboreUser!.sub, ativa: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, passos: true } }),
  ])
  res.json({
    ligacoes: comCadencia(lista, new Map(cadencias.map(c => [c.id, c.nome]))),
    cadencias: cadencias.map(c => ({ id: c.id, nome: c.nome, passos: Array.isArray(c.passos) ? c.passos.length : 0 })),
  })
})

const avulsaSchema = z.object({
  agendadaPara: z.string().datetime({ offset: true, message: 'Data e hora da ligação inválidas' }),
  instrucao: z.string().trim().max(1000).optional(),
})

router.post('/leads/:id/ligacoes', requireProLaboreAuth, requireModulo('crm', 'EDITAR'), async (req: Request, res: Response) => {
  const p = avulsaSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const lead = await prisma.lead.findFirst({ where: { id: String(req.params.id), ...leadWhereBase(req) }, select: { id: true, usuarioId: true, vendedorId: true } })
  if (!lead) { res.status(404).json({ error: 'Lead não encontrado' }); return }
  const nova = await prisma.ligacaoTarefa.create({
    data: { usuarioId: lead.usuarioId, leadId: lead.id, vendedorId: lead.vendedorId, agendadaPara: new Date(p.data.agendadaPara), instrucao: p.data.instrucao || null, criadoPor: quem(req).nome },
    select: SELECT,
  })
  res.status(201).json({ ...nova, cadenciaNome: null })
})

router.post('/leads/:id/cadencias/:cadenciaId', requireProLaboreAuth, requireModulo('crm', 'EDITAR'), async (req: Request, res: Response) => {
  const lead = await prisma.lead.findFirst({ where: { id: String(req.params.id), ...leadWhereBase(req) }, select: { id: true, vendedorId: true, estagio: true, vendaId: true } })
  if (!lead) { res.status(404).json({ error: 'Lead não encontrado' }); return }
  if (lead.vendaId || lead.estagio === 'PERDIDO') { res.status(409).json({ error: 'Lead fora do funil: não dá para iniciar cadência.' }); return }
  const cadencia = await prisma.cadenciaLigacao.findFirst({ where: { id: String(req.params.cadenciaId), usuarioId: req.proLaboreUser!.sub, ativa: true } })
  if (!cadencia) { res.status(404).json({ error: 'Cadência não encontrada' }); return }
  const n = await aplicarCadencia(prisma, cadencia, lead, quem(req).nome)
  if (!n) { res.status(409).json({ error: 'Esta cadência já está rodando neste lead.' }); return }
  res.status(201).json({ criadas: n })
})

// ---------- Ligar e registrar ----------

/** Tocou em "Ligar": guarda quando e de onde (o discador abre no aparelho). */
router.post('/ligacoes/:id/discar', requireProLaboreAuth, requireModulo('crm', 'EDITAR'), async (req: Request, res: Response) => {
  const l = await ligacaoDoPedido(req, res)
  if (!l) return
  if (l.status !== 'PENDENTE') { res.status(409).json({ error: 'Esta ligação já foi encerrada.' }); return }
  const ua = String(req.headers['user-agent'] ?? '')
  const atual = await prisma.ligacaoTarefa.update({
    where: { id: l.id },
    data: { discadaEm: new Date(), discagens: { increment: 1 }, dispositivo: /Mobi|Android|iPhone|iPad/i.test(ua) ? 'CELULAR' : 'COMPUTADOR' },
    select: SELECT,
  })
  res.json(atual)
})

const registroSchema = z.object({
  resultado: z.enum(RESULTADOS),
  duracaoSeg: z.number().int().min(1).max(4 * 3600).optional(),
  resumo: z.string().trim().max(2000).optional(),
  retornoEm: z.string().datetime({ offset: true }).optional(),
}).superRefine((r, ctx) => {
  if (r.resultado === 'ATENDEU' && !r.duracaoSeg) ctx.addIssue({ code: 'custom', message: 'Informe quanto tempo durou a ligação', path: ['duracaoSeg'] })
  if (r.resultado === 'ATENDEU' && (r.resumo ?? '').length < 10) ctx.addIssue({ code: 'custom', message: 'Conte em uma frase o que foi falado (mín. 10 letras)', path: ['resumo'] })
  if (r.resultado === 'PEDIU_RETORNO' && !r.retornoEm) ctx.addIssue({ code: 'custom', message: 'Quando ligar de volta?', path: ['retornoEm'] })
})

router.post('/ligacoes/:id/registrar', requireProLaboreAuth, requireModulo('crm', 'EDITAR'), async (req: Request, res: Response) => {
  const p = registroSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message, campo: p.error.issues[0].path.join('.') }); return }
  const l = await ligacaoDoPedido(req, res)
  if (!l) return
  if (l.status !== 'PENDENTE') { res.status(409).json({ error: 'Esta ligação já foi registrada.' }); return }
  const agora = new Date()
  const eu = quem(req)
  const anterior = await prisma.ligacaoTarefa.findFirst({ where: { usuarioId: l.usuarioId, registradaPorId: eu.id, registradaEm: { not: null } }, orderBy: { registradaEm: 'desc' }, select: { registradaEm: true } })
  const r = p.data
  const alertas = alertasDoRegistro(l, { resultado: r.resultado, duracaoSeg: r.duracaoSeg ?? null }, agora, anterior?.registradaEm ?? null)
  const resultado = await prisma.$transaction(async tx => {
    const feita = await tx.ligacaoTarefa.update({
      where: { id: l.id },
      data: {
        status: 'FEITA', registradaEm: agora, registradaPorId: eu.id, registradaPor: eu.nome, resultado: r.resultado,
        duracaoSeg: r.resultado === 'ATENDEU' ? r.duracaoSeg ?? null : null, resumo: r.resumo || null, alertas,
      },
      select: SELECT,
    })
    let proxima = null
    if (r.resultado === 'ATENDEU' && l.cadenciaId) {
      const c = await tx.cadenciaLigacao.findUnique({ where: { id: l.cadenciaId }, select: { pararAoAtender: true } })
      if (c?.pararAoAtender) await tx.ligacaoTarefa.updateMany({ where: { leadId: l.leadId, cadenciaId: l.cadenciaId, status: 'PENDENTE' }, data: { status: 'CANCELADA', motivoCancelada: 'O cliente atendeu' } })
    }
    if (r.resultado === 'NUMERO_ERRADO') await cancelarLigacoesDoLead(tx, l.leadId, 'Número errado')
    if (r.resultado === 'PEDIU_RETORNO' && r.retornoEm) {
      proxima = await tx.ligacaoTarefa.create({
        data: { usuarioId: l.usuarioId, leadId: l.leadId, vendedorId: l.lead.vendedorId, agendadaPara: new Date(r.retornoEm), instrucao: `Retorno combinado${r.resumo ? `: ${r.resumo}` : ''}`.slice(0, 1000), criadoPor: eu.nome },
        select: SELECT,
      })
    }
    return { feita, proxima }
  })
  res.json(resultado)
})

router.post('/ligacoes/:id/cancelar', requireProLaboreAuth, requireModulo('crm', 'EDITAR'), requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const motivo = z.string().trim().min(3, 'Diga o motivo').max(300).safeParse(req.body?.motivo)
  if (!motivo.success) { res.status(400).json({ error: motivo.error.issues[0].message }); return }
  const l = await ligacaoDoPedido(req, res)
  if (!l) return
  if (l.status !== 'PENDENTE') { res.status(409).json({ error: 'Esta ligação já foi encerrada.' }); return }
  res.json(await prisma.ligacaoTarefa.update({ where: { id: l.id }, data: { status: 'CANCELADA', motivoCancelada: motivo.data }, select: SELECT }))
})

// ---------- Auditoria (dono e supervisor) ----------

router.get('/ligacoes/auditoria', requireProLaboreAuth, requireModulo('crm', 'VER'), requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const dias = Math.min(90, Math.max(1, Number(req.query.dias) || 30))
  const filtro = typeof req.query.vendedorId === 'string' && req.query.vendedorId ? req.query.vendedorId : undefined
  const agora = new Date(), inicio = new Date(agora.getTime() - dias * DIA)
  const lista = await prisma.ligacaoTarefa.findMany({
    // As que já deviam ter sido feitas no período e as feitas no período (mesmo antes da hora marcada).
    where: { status: { not: 'CANCELADA' }, lead: { ...leadWhereBase(req, filtro) }, OR: [{ agendadaPara: { gte: inicio, lte: agora } }, { status: 'FEITA', registradaEm: { gte: inicio } }] },
    orderBy: { agendadaPara: 'desc' }, take: 2000,
    select: { ...SELECT, lead: LEAD_RESUMO },
  })
  const vendedores = await prisma.vendedor.findMany({ where: { usuarioId: req.proLaboreUser!.sub }, select: { id: true, nome: true } })
  const nomeDe = new Map(vendedores.map(v => [v.id, v.nome]))
  const porPessoa = new Map<string, { vendedorId: string | null; nome: string; previstas: number; feitas: number; noPrazo: number; atrasadas: number; naoFeitas: number; atendidas: number; comAlerta: number; minutosAteLigar: number[]; duracoes: number[] }>()
  const venceu = (t: Date) => agora.getTime() - t.getTime() > TOLERANCIA_MS
  for (const l of lista) {
    const chave = l.vendedorId ?? 'dono'
    const p = porPessoa.get(chave) ?? { vendedorId: l.vendedorId, nome: l.vendedorId ? nomeDe.get(l.vendedorId) ?? 'Vendedor' : 'Sem vendedor', previstas: 0, feitas: 0, noPrazo: 0, atrasadas: 0, naoFeitas: 0, atendidas: 0, comAlerta: 0, minutosAteLigar: [], duracoes: [] }
    porPessoa.set(chave, p)
    p.previstas++
    if (l.status === 'FEITA') {
      p.feitas++
      if (l.alertas.includes('ATRASADA')) p.atrasadas++
      else p.noPrazo++
      if (l.resultado === 'ATENDEU') { p.atendidas++; if (l.duracaoSeg) p.duracoes.push(l.duracaoSeg) }
      if (l.alertas.some(a => a !== 'ATRASADA')) p.comAlerta++
      if (l.discadaEm) p.minutosAteLigar.push(Math.max(0, (l.discadaEm.getTime() - l.agendadaPara.getTime()) / 60e3))
    } else if (venceu(l.agendadaPara)) p.naoFeitas++
  }
  const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
  const resumo = [...porPessoa.values()].map(({ minutosAteLigar, duracoes, ...p }) => ({ ...p, minutosAteLigar: media(minutosAteLigar), duracaoMediaSeg: media(duracoes) }))
    .sort((a, b) => b.previstas - a.previstas)
  // Para olhar de perto: com alerta (fora o atraso sozinho) ou vencidas sem registro.
  const atencao = lista.filter(l => (l.status === 'FEITA' && l.alertas.some(a => a !== 'ATRASADA')) || (l.status === 'PENDENTE' && venceu(l.agendadaPara))).slice(0, 200)
  const recentes = lista.filter(l => l.status === 'FEITA').slice(0, 200)
  const nomes = await nomesDasCadencias(req.proLaboreUser!.sub, lista.map(l => l.cadenciaId))
  res.json({ dias, resumo, atencao: comCadencia(atencao, nomes), recentes: comCadencia(recentes, nomes) })
})

// ---------- Cadências (o dono monta; todos veem a lista) ----------

const cadenciaSchema = z.object({
  nome: z.string().trim().min(2, 'Dê um nome à cadência').max(80),
  ativa: z.boolean().default(true),
  gatilho: z.enum(GATILHOS).nullable().default(null),
  pararAoAtender: z.boolean().default(true),
  passos: z.array(passoSchema).min(1, 'Coloque pelo menos um passo').max(15, 'No máximo 15 passos'),
})

router.get('/ligacoes/cadencias', requireProLaboreAuth, requireModulo('crm', 'VER'), async (req: Request, res: Response) => {
  res.json(await prisma.cadenciaLigacao.findMany({ where: { usuarioId: req.proLaboreUser!.sub }, orderBy: [{ ativa: 'desc' }, { nome: 'asc' }] }))
})

router.post('/ligacoes/cadencias', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const p = cadenciaSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  res.status(201).json(await prisma.cadenciaLigacao.create({ data: { ...p.data, passos: p.data.passos as unknown as Prisma.InputJsonValue, usuarioId: req.proLaboreUser!.sub } }))
})

router.put('/ligacoes/cadencias/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const p = cadenciaSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const atual = await prisma.cadenciaLigacao.findFirst({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub }, select: { id: true } })
  if (!atual) { res.status(404).json({ error: 'Cadência não encontrada' }); return }
  // Mudar os passos vale para quem entrar daqui em diante; o que já foi agendado continua.
  res.json(await prisma.cadenciaLigacao.update({ where: { id: atual.id }, data: { ...p.data, passos: p.data.passos as unknown as Prisma.InputJsonValue } }))
})

router.delete('/ligacoes/cadencias/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const atual = await prisma.cadenciaLigacao.findFirst({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub }, select: { id: true } })
  if (!atual) { res.status(404).json({ error: 'Cadência não encontrada' }); return }
  await prisma.$transaction([
    prisma.ligacaoTarefa.updateMany({ where: { cadenciaId: atual.id, status: 'PENDENTE' }, data: { status: 'CANCELADA', motivoCancelada: 'Cadência removida' } }),
    prisma.cadenciaLigacao.delete({ where: { id: atual.id } }),
  ])
  res.json({ ok: true })
})

export default router
