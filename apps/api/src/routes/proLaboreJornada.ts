// Rotas da jornada de 10 etapas (PDF 01): checklist do que falta, mudança de
// etapa com critério, Levantamento e registro de perda pelo motivo da etapa.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { requireModulo } from '../lib/acessos'
import { leadWhereBase } from '../lib/escopoLead'
import { ETAPAS } from '../lib/etapasJornada'
import { ErroJornada, avancarPorFatos, checklist, leadDaJornada, moverEtapa, registrarPerda } from '../lib/jornadaRegras'
import { MOTIVOS_CANCELAMENTO, cancelarVenda, confirmarVenda, checkin, devolverAoSdr, marcarDisponivel, marcarVisita, passarAoVendedor, propostaEnviada, registrarFalta, registrarProposta, respostaDaProposta, resultadoDaVisita, rodizioDaEquipe } from '../lib/jornadaAtividades'
import { requireDono, requireDonoOuSupervisor } from '../middleware/authProLabore'

const router = Router()
const ver = [requireProLaboreAuth, requireModulo('crm', 'VER')]
const editar = [requireProLaboreAuth, requireModulo('crm', 'EDITAR')]

function falha(res: Response, e: unknown) {
  if (e instanceof ErroJornada) { res.status(e.status).json({ error: e.message, faltando: e.faltando }); return }
  throw e
}
const escopo = (req: Request) => { const { usuarioId, ...resto } = leadWhereBase(req); return { usuarioId, resto } }

router.get('/jornada/leads/:id/checklist', ...ver, async (req: Request, res: Response) => {
  try {
    const { usuarioId, resto } = escopo(req)
    res.json(await checklist(await leadDaJornada(usuarioId, String(req.params.id), resto)))
  } catch (e) { falha(res, e) }
})

const moverSchema = z.object({ etapa: z.enum(ETAPAS), contatoFora: z.boolean().optional() })
router.post('/jornada/leads/:id/etapa', ...editar, async (req: Request, res: Response) => {
  const p = moverSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Etapa inválida' }); return }
  try {
    const { usuarioId, resto } = escopo(req)
    const l = await leadDaJornada(usuarioId, String(req.params.id), resto)
    await moverEtapa(l, p.data.etapa, { contatoFora: p.data.contatoFora })
    res.json(await checklist(await leadDaJornada(usuarioId, l.id)))
  } catch (e) { falha(res, e) }
})

const levantamentoSchema = z.object({
  modeloInteresse: z.string().trim().max(200).nullable().optional(),
  formaPagamento: z.enum(['A_VISTA', 'FINANCIADO']).nullable().optional(),
  situacaoCnh: z.enum(['TEM', 'EM_PROCESSO', 'NAO_TEM']).nullable().optional(),
  temEntrada: z.boolean().nullable().optional(),
})
router.patch('/jornada/leads/:id/levantamento', ...editar, async (req: Request, res: Response) => {
  const p = levantamentoSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  try {
    const { usuarioId, resto } = escopo(req)
    const l = await leadDaJornada(usuarioId, String(req.params.id), resto)
    await prisma.lead.update({ where: { id: l.id }, data: p.data })
    const c = await checklist(await leadDaJornada(usuarioId, l.id))
    await prisma.lead.update({ where: { id: l.id }, data: { levantamentoCompleto: c.levantamentoFalta.length === 0 } })
    res.json(c)
  } catch (e) { falha(res, e) }
})

const perdaSchema = z.object({ motivo: z.string().min(1, 'Escolha o motivo da perda'), nota: z.string().trim().max(2000).optional() })
router.post('/jornada/leads/:id/perda', ...editar, async (req: Request, res: Response) => {
  const p = perdaSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  try {
    const { usuarioId, resto } = escopo(req)
    const l = await leadDaJornada(usuarioId, String(req.params.id), resto)
    const destino = await registrarPerda(l, p.data.motivo, p.data.nota)
    res.json({ ok: true, destino })
  } catch (e) { falha(res, e) }
})

// Reavalia os fatos do lead (ex.: depois de registrar a resposta do banco).
router.post('/jornada/leads/:id/reavaliar', ...editar, async (req: Request, res: Response) => {
  try {
    const { usuarioId, resto } = escopo(req)
    const l = await leadDaJornada(usuarioId, String(req.params.id), resto)
    res.json({ avancou: await avancarPorFatos(l.id) })
  } catch (e) { falha(res, e) }
})

// --- Painel do lead: propostas, visitas e passagens ---
router.get('/jornada/leads/:id/detalhe', ...ver, async (req: Request, res: Response) => {
  try {
    const { usuarioId, resto } = escopo(req)
    const l = await leadDaJornada(usuarioId, String(req.params.id), resto)
    const [propostas, visitas, passagens, atividades] = await Promise.all([
      prisma.leadProposta.findMany({ where: { leadId: l.id }, orderBy: { criadoEm: 'desc' } }),
      prisma.leadVisita.findMany({ where: { leadId: l.id }, orderBy: { marcadaPara: 'desc' } }),
      prisma.leadPassagem.findMany({ where: { leadId: l.id }, orderBy: { passadaEm: 'desc' } }),
      prisma.leadFollow.findMany({ where: { leadId: l.id, tipo: 'JORNADA', status: 'PENDENTE' }, orderBy: { agendadoPara: 'asc' }, select: { id: true, agendadoPara: true, nota: true, contexto: true } }),
    ])
    const ids = [...new Set(passagens.flatMap(p => [p.sdrId, p.vendedorId]).filter((x): x is string => !!x))]
    const nomes = new Map((await prisma.vendedor.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } })).map(v => [v.id, v.nome]))
    res.json({
      checklist: await checklist(l), propostas, visitas, atividades,
      passagens: passagens.map(p => ({ ...p, sdrNome: p.sdrId ? nomes.get(p.sdrId) ?? null : null, vendedorNome: p.vendedorId ? nomes.get(p.vendedorId) ?? null : null })),
      podePassar: !!l.responsavelQualificacaoId && (l.etapa === 'SQL' || (l.etapa === 'LEVANTAMENTO' && l.formaPagamento === 'A_VISTA')),
      podeDevolver: passagens.some(p => !p.devolvida),
    })
  } catch (e) { falha(res, e) }
})

const data = z.string().min(1).transform((s, ctx) => { const d = new Date(s); if (Number.isNaN(d.getTime())) { ctx.addIssue({ code: 'custom', message: 'Data inválida' }); return z.NEVER } return d })
const propostaSchema = z.object({
  preco: z.number().positive('Informe o preço'), entrada: z.number().min(0).nullable().optional(), parcela: z.number().min(0).nullable().optional(),
  prazo: z.number().int().positive().nullable().optional(), validade: data.nullable().optional(), followEm: data.nullable().optional(),
})
router.post('/jornada/leads/:id/proposta', ...editar, async (req: Request, res: Response) => {
  const p = propostaSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  try {
    const { usuarioId, resto } = escopo(req)
    const l = await leadDaJornada(usuarioId, String(req.params.id), resto)
    res.status(201).json(await registrarProposta({ ...l, nomeCliente: l.nomeCliente ?? '' }, p.data))
  } catch (e) { falha(res, e) }
})
router.post('/jornada/propostas/:id/enviada', ...editar, async (req: Request, res: Response) => {
  try { await propostaEnviada(String(req.params.id), req.proLaboreUser!.sub); res.json({ ok: true }) } catch (e) { falha(res, e) }
})
router.post('/jornada/propostas/:id/resposta', ...editar, async (req: Request, res: Response) => {
  const r = z.object({ resultado: z.enum(['ACEITA', 'RECUSADA', 'SEM_RESPOSTA']) }).safeParse(req.body)
  if (!r.success) { res.status(400).json({ error: 'Resultado inválido' }); return }
  try { await respostaDaProposta(String(req.params.id), req.proLaboreUser!.sub, r.data.resultado); res.json({ ok: true }) } catch (e) { falha(res, e) }
})

const acaoDoLead = (fn: (l: Awaited<ReturnType<typeof leadDaJornada>>, body: Record<string, unknown>) => Promise<unknown>) => async (req: Request, res: Response) => {
  try {
    const { usuarioId, resto } = escopo(req)
    const l = await leadDaJornada(usuarioId, String(req.params.id), resto)
    res.json({ ok: true, resultado: await fn(l, req.body ?? {}) })
  } catch (e) { falha(res, e) }
}
router.post('/jornada/leads/:id/visita', ...editar, acaoDoLead((l, b) => {
  const d = data.safeParse(b.marcadaPara)
  if (!d.success) throw new ErroJornada(400, 'Informe a data e a hora da visita')
  return marcarVisita(l, d.data)
}))
router.post('/jornada/leads/:id/checkin', ...editar, acaoDoLead(l => checkin(l)))
router.post('/jornada/leads/:id/falta', ...editar, acaoDoLead(l => registrarFalta(l)))
router.post('/jornada/leads/:id/resultado-visita', ...editar, acaoDoLead((l, b) => {
  const t = String(b.resultado ?? '').trim()
  if (!t) throw new ErroJornada(400, 'Escreva o resultado da visita')
  return resultadoDaVisita(l, t.slice(0, 2000))
}))
router.post('/jornada/leads/:id/passar', ...editar, acaoDoLead((l, b) => passarAoVendedor(l, String(b.resumo ?? '').trim().slice(0, 2000))))
router.post('/jornada/leads/:id/devolver', ...editar, acaoDoLead((l, b) => devolverAoSdr(l, String(b.motivo ?? ''))))

// --- Venda: o dono confirma (ou cancela com o motivo da etapa Venda) ---
router.get('/jornada/vendas/aguardando', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  res.json(await prisma.venda.findMany({ where: { usuarioId: req.proLaboreUser!.sub, situacao: 'AGUARDANDO_CONFIRMACAO' }, orderBy: { data: 'asc' }, select: { id: true, data: true, valorVenda: true, placa: true, vendedor: { select: { nome: true } }, lead: { select: { id: true, nomeCliente: true } } } }))
})
router.post('/jornada/vendas/:id/confirmar', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  try { await confirmarVenda(req.proLaboreUser!.sub, String(req.params.id), req.proLaboreUser!.nome ?? null); res.json({ ok: true }) } catch (e) { falha(res, e) }
})
router.post('/jornada/vendas/:id/cancelar', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const p = z.object({ motivo: z.enum(MOTIVOS_CANCELAMENTO) }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Escolha o motivo do cancelamento' }); return }
  try { await cancelarVenda(req.proLaboreUser!.sub, String(req.params.id), p.data.motivo); res.json({ ok: true }) } catch (e) { falha(res, e) }
})

// --- Rodízio (dono e supervisor) ---
router.get('/jornada/rodizio', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  res.json(await rodizioDaEquipe(req.proLaboreUser!.sub))
})
router.put('/jornada/rodizio/:vendedorId', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  try { await marcarDisponivel(req.proLaboreUser!.sub, String(req.params.vendedorId), !!req.body?.disponivel); res.json(await rodizioDaEquipe(req.proLaboreUser!.sub)) } catch (e) { falha(res, e) }
})

export default router
