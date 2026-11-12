// Rotas da jornada de 10 etapas (PDF 01): checklist do que falta, mudança de
// etapa com critério, Levantamento e registro de perda pelo motivo da etapa.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { requireModulo } from '../lib/acessos'
import { leadWhereBase } from '../lib/escopoLead'
import { ETAPAS } from '../lib/etapasJornada'
import { historicoDeParametros, premissas, salvarPremissas } from '../lib/jornadaPremissas'
import { conversaoPorEtapa } from '../lib/jornadaMetricas'
import { ErroJornada, avancarPorFatos, checklist, leadDaJornada, moverEtapa, registrarPerda, revisarPendencias } from '../lib/jornadaRegras'
import { MOTIVOS_CANCELAMENTO, cancelarVenda, confirmarVenda, checkin, devolverAoSdr, marcarDisponivel, marcarVisita, passarAoVendedor, propostaEnviada, registrarFalta, registrarProposta, respostaDaProposta, resultadoDaVisita, rodizioDaEquipe } from '../lib/jornadaAtividades'
import { requireDono, requireDonoOuSupervisor } from '../middleware/authProLabore'
import { ORIGENS_ATV, configDaRegua, conferenciaDaMigracao, modoDaRegua } from '../lib/atividades'

const router = Router()
const ver = [requireProLaboreAuth, requireModulo('crm', 'VER')]
const editar = [requireProLaboreAuth, requireModulo('crm', 'EDITAR')]

function falha(res: Response, e: unknown) {
  if (e instanceof ErroJornada) { res.status(e.status).json({ error: e.message, faltando: e.faltando, podeForcar: e.podeForcar }); return }
  throw e
}
const escopo = (req: Request) => { const { usuarioId, ...resto } = leadWhereBase(req); return { usuarioId, resto } }

// CRM livre: depois de qualquer ação no lead (proposta, visita, levantamento…), confere de novo
// as pendências da etapa antes de responder, para o card já voltar sem o selo.
router.use('/jornada/leads/:id', (req: Request, res: Response, next) => {
  if (req.method === 'GET') { next(); return }
  const id = String(req.params.id), json = res.json.bind(res)
  res.json = ((corpo: unknown) => { if (res.statusCode >= 400) return json(corpo); void revisarPendencias(id).catch(() => undefined).finally(() => json(corpo)); return res }) as typeof res.json
  next()
})

router.get('/jornada/leads/:id/checklist', ...ver, async (req: Request, res: Response) => {
  try {
    const { usuarioId, resto } = escopo(req)
    await revisarPendencias(String(req.params.id)).catch(() => undefined)
    res.json(await checklist(await leadDaJornada(usuarioId, String(req.params.id), resto)))
  } catch (e) { falha(res, e) }
})

const moverSchema = z.object({ etapa: z.enum(ETAPAS), contatoFora: z.boolean().optional(), forcar: z.boolean().optional() })
router.post('/jornada/leads/:id/etapa', ...editar, async (req: Request, res: Response) => {
  const p = moverSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Etapa inválida' }); return }
  try {
    const { usuarioId, resto } = escopo(req)
    const l = await leadDaJornada(usuarioId, String(req.params.id), resto)
    await moverEtapa(l, p.data.etapa, { contatoFora: p.data.contatoFora, forcar: p.data.forcar })
    res.json(await checklist(await leadDaJornada(usuarioId, l.id)))
  } catch (e) { falha(res, e) }
})

// Temperatura fixada à mão (nulo = volta a ser calculada).
router.patch('/jornada/leads/:id/temperatura', ...editar, async (req: Request, res: Response) => {
  const p = z.object({ temperatura: z.enum(['FRIO', 'MORNO', 'QUENTE']).nullable() }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Temperatura inválida' }); return }
  try {
    const { usuarioId, resto } = escopo(req)
    const l = await leadDaJornada(usuarioId, String(req.params.id), resto)
    await prisma.lead.update({ where: { id: l.id }, data: { temperaturaManual: p.data.temperatura } })
    res.json({ ok: true, temperaturaManual: p.data.temperatura })
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

// --- Aba Crédito: leads em MQL e SQL, fichas por banco e validade das aprovações ---
router.get('/jornada/credito', ...ver, async (req: Request, res: Response) => {
  const { usuarioId, resto } = escopo(req)
  const leads = await prisma.lead.findMany({
    where: { usuarioId, ...resto, etapa: { in: ['MQL', 'SQL'] }, estagio: { not: 'PERDIDO' } },
    select: { id: true, nomeCliente: true, etapa: true, entrouNaEtapaEm: true, modeloInteresse: true, vendedor: { select: { nome: true } } },
    orderBy: { entrouNaEtapaEm: 'asc' }, take: 300,
  })
  const ids = leads.map(l => l.id)
  const fichas = ids.length ? await prisma.assistenteFichaCredito.findMany({
    where: { OR: [{ leadId: { in: ids } }, { conversa: { leadId: { in: ids } } }] },
    select: { id: true, leadId: true, conversaId: true, conversa: { select: { leadId: true } }, analises: { orderBy: { criadoEm: 'asc' }, select: { id: true, banco: true, status: true, enviadaEm: true, respondidoEm: true, validadeAte: true, condicaoAprovada: true, parcela: true, entrada: true, prazo: true } } },
  }) : []
  const agora = Date.now()
  res.json(leads.map(l => {
    const f = fichas.find(x => x.leadId === l.id || x.conversa?.leadId === l.id)
    const analises = (f?.analises ?? []).map(a => ({ ...a, venceEmDias: a.validadeAte ? Math.ceil((a.validadeAte.getTime() - agora) / 86_400_000) : null }))
    return { ...l, fichaId: f?.id ?? null, conversaId: f?.conversaId ?? null, analises }
  }))
})
const analiseSchema = z.object({
  status: z.enum(['A_ENVIAR', 'EM_ANALISE', 'APROVADA', 'RECUSADA']).optional(),
  validadeAte: data.nullable().optional(),
  condicaoAprovada: z.string().trim().max(500).nullable().optional(),
  enviada: z.boolean().optional(),
})
router.patch('/jornada/analises/:id', ...editar, async (req: Request, res: Response) => {
  const p = analiseSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  try {
    const { usuarioId, resto } = escopo(req)
    const a = await prisma.assistenteAnaliseCredito.findFirst({ where: { id: String(req.params.id), usuarioId }, select: { id: true, ficha: { select: { leadId: true, conversa: { select: { leadId: true } } } } } })
    const leadId = a?.ficha.leadId ?? a?.ficha.conversa?.leadId
    if (!a || !leadId) throw new ErroJornada(404, 'Análise não encontrada')
    const l = await leadDaJornada(usuarioId, leadId, resto)
    const d = p.data
    await prisma.assistenteAnaliseCredito.update({
      where: { id: a.id },
      data: {
        ...(d.status ? { status: d.status, ...(['APROVADA', 'RECUSADA'].includes(d.status) ? { respondidoEm: new Date() } : {}) } : {}),
        ...(d.enviada ? { enviadaEm: new Date(), ...(d.status ? {} : { status: 'EM_ANALISE' }) } : {}),
        ...(d.validadeAte !== undefined ? { validadeAte: d.validadeAte } : {}),
        ...(d.condicaoAprovada !== undefined ? { condicaoAprovada: d.condicaoAprovada } : {}),
      },
    })
    // Banco aprovou: o lead vai para SQL sozinho (fato que o sistema vê).
    res.json({ ok: true, avancou: await avancarPorFatos(l.id) })
  } catch (e) { falha(res, e) }
})

// --- Conversão por etapa (pela data em que o lead chegou à etapa) ---
router.get('/jornada/conversao', ...ver, async (req: Request, res: Response) => {
  const { usuarioId, resto } = escopo(req)
  const fim = typeof req.query.fim === 'string' ? new Date(req.query.fim) : new Date()
  const inicio = typeof req.query.inicio === 'string' ? new Date(req.query.inicio) : new Date(fim.getTime() - 30 * 86_400_000)
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) { res.status(400).json({ error: 'Período inválido' }); return }
  res.json({ inicio, fim, etapas: await conversaoPorEtapa({ usuarioId, ...resto }, inicio, fim) })
})

// --- Metas e premissas da jornada (o dono edita) ---
router.get('/jornada/premissas', ...ver, async (req: Request, res: Response) => {
  res.json(await premissas(req.proLaboreUser!.sub))
})
const tempoSchema = z.object({ valor: z.number().int().positive().nullable(), unidade: z.enum(['MINUTOS', 'HORAS', 'DIAS']) })
const premissasSchema = z.object({
  temposMaximos: z.record(z.string(), tempoSchema).refine(o => Object.keys(o).every(k => (ETAPAS as readonly string[]).includes(k)), 'Etapa inválida').optional(),
  criteriosLevantamento: z.array(z.enum(['modelo', 'pagamento', 'cnh', 'entrada'])).min(1, 'Escolha ao menos um critério').optional(),
  faltasAtePerda: z.number().int().min(1).max(10).optional(),
  posVendaPrazos: z.object({ entrega: z.number().int().min(0), documentacao: z.number().int().min(0), primeiraRevisao: z.number().int().min(0) }).optional(),
  volumeMinimoDetectores: z.number().int().min(1).max(1000).optional(),
  metaDiariaSdr: z.number().min(0).max(1000).nullable().optional(),
  // PDF 02 · 4.3: toda mudança de parâmetro tem justificativa.
  justificativa: z.string().trim().min(5, 'Escreva por que mudou').max(500),
})
router.put('/jornada/premissas', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const p = premissasSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const { justificativa, ...mudanca } = p.data
  res.json(await salvarPremissas(req.proLaboreUser!.sub, mudanca as Parameters<typeof salvarPremissas>[1], { autorId: req.proLaboreUser!.sub, justificativa }))
})

router.get('/jornada/premissas/historico', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  res.json(await historicoDeParametros(req.proLaboreUser!.sub))
})

// --- Rodízio (dono e supervisor) ---
router.get('/jornada/rodizio', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  res.json(await rodizioDaEquipe(req.proLaboreUser!.sub))
})
router.put('/jornada/rodizio/:vendedorId', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  try { await marcarDisponivel(req.proLaboreUser!.sub, String(req.params.vendedorId), !!req.body?.disponivel); res.json(await rodizioDaEquipe(req.proLaboreUser!.sub)) } catch (e) { falha(res, e) }
})

// --- Atividade (ATV) · PDF 02, 4.4 ---
// Régua de cobrança por tipo de origem (só o dono edita).
router.get('/atividades/regua', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  res.json({ modo: await modoDaRegua(req.proLaboreUser!.sub), origens: await configDaRegua(req.proLaboreUser!.sub) })
})
const reguaSchema = z.object({
  lembreteMinAntes: z.number().int().min(0).max(1440),
  segundoAlertaMin: z.number().int().min(15).max(1440),
  escalonamentoMin: z.number().int().min(60).max(10080),
  escalonarPara: z.enum(['SUPERVISOR', 'GESTOR', 'DONO']),
}).refine(v => v.escalonamentoMin > v.segundoAlertaMin, { message: 'O escalonamento vem depois do segundo alerta' })
router.put('/atividades/regua/:origem', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const origem = String(req.params.origem)
  if (!(ORIGENS_ATV as readonly string[]).includes(origem)) { res.status(400).json({ error: 'Tipo de origem inválido' }); return }
  const p = reguaSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const usuarioId = req.proLaboreUser!.sub
  await prisma.reguaCobranca.upsert({ where: { usuarioId_origemTipo: { usuarioId, origemTipo: origem } }, create: { usuarioId, origemTipo: origem, ...p.data }, update: p.data })
  res.json({ modo: await modoDaRegua(usuarioId), origens: await configDaRegua(usuarioId) })
})
// Ligar o envio da régua (fim da semana em paralelo) ou voltar ao modo de registro. Só o dono, com justificativa.
const modoSchema = z.object({ modo: z.enum(['REGISTRO', 'ENVIO']), justificativa: z.string().trim().min(5, 'Escreva por que mudou').max(500) })
router.put('/atividades/regua-modo', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const p = modoSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const usuarioId = req.proLaboreUser!.sub
  const antes = await modoDaRegua(usuarioId)
  if (antes !== p.data.modo) {
    await prisma.parametroLiquidez.upsert({ where: { usuarioId }, create: { usuarioId, reguaModo: p.data.modo }, update: { reguaModo: p.data.modo } })
    await prisma.parametroHistorico.create({ data: { usuarioId, nome: 'reguaModo', valorAnterior: antes, valorNovo: p.data.modo, origem: 'MANUAL', justificativa: p.data.justificativa, autorId: usuarioId } })
  }
  res.json({ modo: await modoDaRegua(usuarioId), origens: await configDaRegua(usuarioId) })
})
// Conferência da migração: total por tipo antes (tabelas atuais) e depois (ATV).
router.get('/atividades/conferencia', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  res.json(await conferenciaDaMigracao(req.proLaboreUser!.sub))
})
// ATVs de uma oportunidade, com o que a régua registrou (para a ficha do lead).
router.get('/atividades', requireProLaboreAuth, requireModulo('crm', 'VER'), async (req: Request, res: Response) => {
  const leadId = String(req.query.leadId ?? '')
  if (!leadId) { res.status(400).json({ error: 'Informe a oportunidade' }); return }
  const lead = await prisma.lead.findFirst({ where: { id: leadId, ...leadWhereBase(req) }, select: { id: true } })
  if (!lead) { res.status(404).json({ error: 'Oportunidade não encontrada' }); return }
  res.json(await prisma.atividade.findMany({
    where: { leadId }, orderBy: { prazo: 'desc' }, take: 200,
    select: { codigo: true, tipo: true, origemTipo: true, prazo: true, canal: true, oQueFazer: true, status: true, resultado: true, executadaEm: true, autorExecucaoTipo: true, modeloTipo: true, reguaEstado: true, registrosRegua: { select: { etapa: true, previstoPara: true, registradoEm: true, modo: true, enviado: true }, orderBy: { previstoPara: 'asc' } } },
  }))
})

export default router
