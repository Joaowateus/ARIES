// Assistente Comercial — Central de Inteligência (RevOps): rotas.
// Só a gestão (dono e escopo de equipe) abre a Central. Investimento e
// financeiro seguem os acessos de cada módulo (Tráfego e Financeiro); o
// pró-labore, só o dono. Toda mudança de premissa, ação ou fechamento vai
// para a trilha de auditoria (IntelAuditoria).
import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { nivelAtende } from '../lib/acessos'
import { diaBrasilia } from '../lib/socialMediaSync'
import { montarCentral, planejamentoDe, type Acesso, type DadosCentral } from '../lib/intelCentral'
import { gerarDiagnosticos, scorecards, valorDoIndicador, atingiuMeta, INDICADORES_ACAO, NOME_DEPARTAMENTO, PRAZO_DIAS, type Diagnostico } from '../lib/intelDiagnostico'
import { MODULOS_RELATORIO, previaRelatorio, confirmarRelatorio, diferencas, type ModuloRelatorio } from '../lib/intelRelatorios'
import { pautaDaReuniao, retratoParaAta, type TipoReuniao } from '../lib/intelReuniao'
import { lerCentral } from '../lib/intelIA'

const router = Router()
const DIA = 24 * 3600e3
const hojeBR = () => diaBrasilia(new Date()).toISOString().slice(0, 10)
const STATUS_ABERTOS = ['IDENTIFICADA', 'AGUARDANDO_APROVACAO', 'PLANEJADA', 'EM_EXECUCAO', 'AGUARDANDO_VALIDACAO']
const STATUS_ACAO = [...STATUS_ABERTOS, 'CONCLUIDA', 'NAO_ATINGIU', 'CANCELADA'] as const

interface Ctx { usuarioId: string; acesso: Acesso; dono: boolean; autor: { id: string; nome: string }; podeEditarPremissas: boolean }
declare global { namespace Express { interface Request { intel?: Ctx } } }

async function central(req: Request, res: Response, next: NextFunction): Promise<void> {
  const u = req.proLaboreUser!
  if (u.papel !== 'DONO' && u.papel !== 'SUPERVISOR') { res.status(403).json({ error: 'A Central de Inteligência é da gestão (dono e quem vê a equipe).' }); return }
  const dono = u.papel === 'DONO'
  const a = req.acessos ?? {}
  const nome = dono ? (await prisma.proLaboreUsuario.findUnique({ where: { id: u.sub }, select: { nome: true } }))?.nome : (await prisma.vendedor.findUnique({ where: { id: u.vendedorId! }, select: { nome: true } }))?.nome
  req.intel = {
    usuarioId: u.sub, dono,
    acesso: { verInvestimento: dono || nivelAtende(a.trafego, 'VER'), verFinanceiro: dono || nivelAtende(a.financeiro, 'VER'), verProLabore: dono },
    autor: { id: dono ? 'DONO' : u.vendedorId!, nome: nome ?? 'Gestão' },
    podeEditarPremissas: dono || nivelAtende(a.configuracoes, 'EDITAR'),
  }
  next()
}
const base = [requireProLaboreAuth, central]
const erro400 = (res: Response, e: z.ZodError) => res.status(400).json({ error: e.issues[0]?.message ?? 'Dados inválidos' })
const auditar = (c: Ctx, entidade: string, entidadeId: string | null, acao: string, campo: string | null, antes: unknown, depois: unknown) =>
  prisma.intelAuditoria.create({ data: { usuarioId: c.usuarioId, entidade, entidadeId, acao, campo, antes: antes === undefined ? undefined : (antes as never), depois: depois === undefined ? undefined : (depois as never), autorId: c.autor.id, autorNome: c.autor.nome } })

function periodoDe(req: Request): { inicio: string; fim: string } {
  const hoje = hojeBR()
  const ok = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  const fim = ok(req.query.fim) ? String(req.query.fim) : hoje
  const inicio = ok(req.query.inicio) ? String(req.query.inicio) : `${fim.slice(0, 7)}-01`
  // Até 366 dias de janela.
  const minimo = new Date(Date.parse(`${fim}T00:00:00Z`) - 365 * DIA).toISOString().slice(0, 10)
  return { inicio: inicio < minimo ? minimo : inicio, fim }
}

async function contagemAcoes(usuarioId: string) {
  const agora = new Date()
  const [abertas, atrasadas, concluidas, concluidasNoPrazo] = await Promise.all([
    prisma.intelAcao.count({ where: { usuarioId, status: { in: STATUS_ABERTOS } } }),
    prisma.intelAcao.count({ where: { usuarioId, status: { in: STATUS_ABERTOS }, prazo: { lt: agora } } }),
    prisma.intelAcao.count({ where: { usuarioId, status: { in: ['CONCLUIDA', 'NAO_ATINGIU'] } } }),
    prisma.intelAcao.count({ where: { usuarioId, status: { in: ['CONCLUIDA', 'NAO_ATINGIU'] }, resultadoEm: { not: null }, prazo: { not: null } } }),
  ])
  return { abertas, atrasadas, concluidas, concluidasNoPrazo }
}

/** Guarda o histórico dos diagnósticos do mês corrente: novos, recorrentes e resolvidos. */
async function registrarDiagnosticos(c: Ctx, mes: string, diags: Diagnostico[]) {
  const agora = new Date()
  const existentes = await prisma.intelDiagnostico.findMany({ where: { usuarioId: c.usuarioId, periodo: mes } })
  const porChave = new Map(existentes.map(e => [e.chave, e]))
  const hoje = hojeBR()
  for (const d of diags) {
    const e = porChave.get(d.chave)
    const { chave, departamento, severidade, problema, ...dados } = d
    if (!e) {
      const novo = await prisma.intelDiagnostico.create({ data: { usuarioId: c.usuarioId, chave, periodo: mes, departamento, severidade, problema, dados: dados as never } })
      await auditar(c, 'DIAGNOSTICO', novo.id, 'IDENTIFICADO', null, undefined, { chave, severidade, problema })
    } else {
      const novoDia = e.ultimaVezEm.toISOString().slice(0, 10) !== hoje
      await prisma.intelDiagnostico.update({ where: { id: e.id }, data: { severidade, problema, dados: dados as never, status: 'ATIVO', resolvidoEm: null, ultimaVezEm: agora, ...(novoDia || e.status !== 'ATIVO' ? { ocorrencias: { increment: 1 } } : {}) } })
    }
  }
  const atuais = new Set(diags.map(d => d.chave))
  for (const e of existentes) if (e.status === 'ATIVO' && !atuais.has(e.chave)) {
    await prisma.intelDiagnostico.update({ where: { id: e.id }, data: { status: 'RESOLVIDO', resolvidoEm: agora } })
    await auditar(c, 'DIAGNOSTICO', e.id, 'SAIU_DO_ALERTA', null, { severidade: e.severidade }, { status: 'RESOLVIDO' })
  }
  return prisma.intelDiagnostico.findMany({ where: { usuarioId: c.usuarioId, periodo: mes }, select: { id: true, chave: true, ocorrencias: true, primeiraVezEm: true, status: true } })
}

async function dadosEDiagnosticos(c: Ctx, periodo: { inicio: string; fim: string }) {
  const dados = await montarCentral(c.usuarioId, periodo, c.acesso)
  const acoes = await contagemAcoes(c.usuarioId)
  const diags = gerarDiagnosticos(dados, { acoesAtrasadas: acoes.atrasadas })
  return { dados, acoes, diags }
}

// ---------- Central ----------

router.get('/intel/central', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  const { dados, acoes, diags } = await dadosEDiagnosticos(c, periodoDe(req))
  const historico = dados.periodo.mes === hojeBR().slice(0, 7) ? await registrarDiagnosticos(c, dados.periodo.mes, diags) : []
  const porChave = new Map(historico.map(h => [h.chave, h]))
  const acoesPorDiag = await prisma.intelAcao.findMany({ where: { usuarioId: c.usuarioId, diagnosticoId: { in: historico.map(h => h.id) } }, select: { diagnosticoId: true, id: true, status: true } })
  const pendentes = await prisma.intelAcao.findMany({ where: { usuarioId: c.usuarioId, status: { in: STATUS_ABERTOS } }, orderBy: [{ prazo: 'asc' }], take: 8 })
  res.json({
    ...dados,
    diagnosticos: diags.map(d => {
      const h = porChave.get(d.chave)
      return { ...d, departamentoNome: NOME_DEPARTAMENTO[d.departamento], id: h?.id ?? null, ocorrencias: h?.ocorrencias ?? 1, desde: h?.primeiraVezEm ?? null, acoes: acoesPorDiag.filter(a => a.diagnosticoId === h?.id) }
    }),
    departamentos: scorecards(dados, diags, acoes),
    acoesResumo: { ...acoes, proximas: pendentes },
    podeEditarPremissas: c.podeEditarPremissas, dono: c.dono,
  })
})

// ---------- Premissas ----------

const planSchema = z.object({
  metaFaturamentoMensal: z.number().positive('A meta de faturamento precisa ser maior que zero').max(1e10).optional(),
  ticketMedio: z.number().positive('O ticket médio precisa ser maior que zero').max(1e9).optional(),
  orcamentoMarketing: z.number().min(0).max(1e9).optional(),
  vendedoresPlanejados: z.number().int().min(1).max(500).nullable().optional(),
  metaLeadAbordado: z.number().min(0.01).max(1).optional(),
  metaAbordadoNegociacao: z.number().min(0.01).max(1).optional(),
  metaNegociacaoProposta: z.number().min(0.01).max(1).optional(),
  metaPropostaFechamento: z.number().min(0.01).max(1).optional(),
  margemContribuicaoVenda: z.number().min(0).max(1e8).nullable().optional(),
  diasUteisSemana: z.string().regex(/^[0-6](,[0-6])*$/, 'Dias da semana inválidos').optional(),
  cenarioPersonalizado: z.object({ conversoes: z.array(z.number().min(0.001).max(1)).length(4), ticket: z.number().positive().optional(), orcamento: z.number().min(0).optional() }).nullable().optional(),
  criterios: z.record(z.string(), z.number().min(0).max(1e6)).optional(),
})
router.put('/intel/planejamento', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  if (!c.podeEditarPremissas) { res.status(403).json({ error: 'Só quem edita as Configurações muda as premissas.' }); return }
  const p = planSchema.safeParse(req.body); if (!p.success) { erro400(res, p.error); return }
  const atual = await planejamentoDe(c.usuarioId)
  const mudancas = Object.entries(p.data).filter(([k, v]) => JSON.stringify((atual as Record<string, unknown>)[k] ?? null) !== JSON.stringify(v ?? null))
  if (!mudancas.length) { res.json({ ok: true, mudancas: 0 }); return }
  await prisma.intelPlanejamento.update({ where: { usuarioId: c.usuarioId }, data: { ...(p.data as Record<string, unknown>), atualizadoPor: c.autor.nome } as never })
  for (const [k, v] of mudancas) await auditar(c, 'PLANEJAMENTO', atual.id, 'ALTERADO', k, (atual as Record<string, unknown>)[k] ?? null, v ?? null)
  res.json({ ok: true, mudancas: mudancas.length })
})

router.get('/intel/auditoria', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  const entidade = typeof req.query.entidade === 'string' ? req.query.entidade : undefined
  const entidadeId = typeof req.query.entidadeId === 'string' ? req.query.entidadeId : undefined
  res.json(await prisma.intelAuditoria.findMany({ where: { usuarioId: c.usuarioId, ...(entidade ? { entidade } : {}), ...(entidadeId ? { entidadeId } : {}) }, orderBy: { em: 'desc' }, take: 200 }))
})

router.get('/intel/diagnosticos', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  res.json(await prisma.intelDiagnostico.findMany({ where: { usuarioId: c.usuarioId }, orderBy: [{ ultimaVezEm: 'desc' }], take: 200 }))
})

router.get('/intel/responsaveis', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  const [dono, vendedores] = await Promise.all([
    prisma.proLaboreUsuario.findUnique({ where: { id: c.usuarioId }, select: { nome: true } }),
    prisma.vendedor.findMany({ where: { usuarioId: c.usuarioId, ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
  ])
  res.json({ responsaveis: [{ id: 'DONO', nome: `${dono?.nome ?? 'Dono'} (gestão)` }, ...vendedores], indicadores: INDICADORES_ACAO, departamentos: NOME_DEPARTAMENTO })
})

// ---------- Plano de ação ----------

router.get('/intel/acoes', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  const acoes = await prisma.intelAcao.findMany({ where: { usuarioId: c.usuarioId }, orderBy: [{ criadoEm: 'desc' }], take: 300 })
  const dados = await montarCentral(c.usuarioId, periodoDe(req), c.acesso)
  const atrasadas = acoes.filter(a => STATUS_ABERTOS.includes(a.status) && a.prazo && a.prazo < new Date()).length
  res.json(acoes.map(a => {
    const atual = a.indicadorChave ? valorDoIndicador(a.indicadorChave, dados, { acoesAtrasadas: atrasadas }) : null
    return { ...a, indicadorAtual: atual, atingiu: atingiuMeta(atual, a.metaEsperada, a.melhorQuando), atrasada: STATUS_ABERTOS.includes(a.status) && !!a.prazo && a.prazo < new Date() }
  }))
})

const acaoSchema = z.object({
  diagnosticoId: z.string().nullable().optional(),
  titulo: z.string().trim().min(3, 'Dê um título à ação').max(200),
  problema: z.string().trim().min(3, 'Descreva o problema').max(2000),
  evidencias: z.string().trim().max(4000).nullable().optional(),
  objetivo: z.string().trim().max(1000).nullable().optional(),
  departamento: z.enum(['TRAFEGO', 'SOCIAL_MEDIA', 'COMERCIAL', 'GESTAO', 'FINANCEIRO']),
  responsavelId: z.string().nullable().optional(),
  colaboradores: z.array(z.string()).max(20).optional(),
  prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Prazo inválido').nullable().optional(),
  prioridade: z.enum(['CRITICO', 'ALTO', 'MODERADO', 'MONITORAMENTO']),
  indicadorChave: z.string().max(80).nullable().optional(),
  metaEsperada: z.number().nullable().optional(),
})
async function nomeDoResponsavel(usuarioId: string, id: string | null | undefined): Promise<string | null> {
  if (!id) return null
  if (id === 'DONO') return (await prisma.proLaboreUsuario.findUnique({ where: { id: usuarioId }, select: { nome: true } }))?.nome ?? 'Dono'
  return (await prisma.vendedor.findFirst({ where: { id, usuarioId }, select: { nome: true } }))?.nome ?? null
}
router.post('/intel/acoes', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  const p = acaoSchema.safeParse(req.body); if (!p.success) { erro400(res, p.error); return }
  const d = p.data
  const responsavelNome = await nomeDoResponsavel(c.usuarioId, d.responsavelId)
  if (d.responsavelId && !responsavelNome) { res.status(400).json({ error: 'Responsável não encontrado' }); return }
  const indicador = INDICADORES_ACAO.find(i => i.chave === d.indicadorChave) ?? (d.indicadorChave?.startsWith('abordagem:') ? { chave: d.indicadorChave, nome: 'Lead → abordado do vendedor', melhorQuando: 'MAIOR' as const, unidade: 'PCT' as const } : null)
  let valorInicial: number | null = null
  if (indicador) {
    const dados = await montarCentral(c.usuarioId, periodoDe(req), c.acesso)
    valorInicial = valorDoIndicador(indicador.chave, dados, { acoesAtrasadas: (await contagemAcoes(c.usuarioId)).atrasadas })
  }
  const prazo = d.prazo ? new Date(`${d.prazo}T23:59:59-03:00`) : new Date(Date.now() + PRAZO_DIAS[d.prioridade] * DIA)
  const acao = await prisma.intelAcao.create({
    data: {
      usuarioId: c.usuarioId, diagnosticoId: d.diagnosticoId ?? null, titulo: d.titulo, problema: d.problema, evidencias: d.evidencias ?? null, objetivo: d.objetivo ?? null,
      departamento: d.departamento, responsavelId: d.responsavelId ?? null, responsavelNome, colaboradores: d.colaboradores ?? [], prazo, prioridade: d.prioridade,
      indicadorChave: indicador?.chave ?? null, indicadorNome: indicador?.nome ?? null, valorInicial, metaEsperada: d.metaEsperada ?? null, melhorQuando: indicador?.melhorQuando ?? null,
      // O dono aprova o que ele mesmo cria; o que vem da equipe espera aprovação.
      status: c.dono ? 'PLANEJADA' : 'AGUARDANDO_APROVACAO', ...(c.dono ? { aprovadoPor: c.autor.nome, aprovadoEm: new Date() } : {}),
      criadoPor: c.autor.nome, comentarios: [],
    },
  })
  await auditar(c, 'ACAO', acao.id, 'CRIADA', null, undefined, { titulo: acao.titulo, status: acao.status, responsavel: responsavelNome, prazo: acao.prazo })
  res.status(201).json(acao)
})

const patchSchema = z.object({
  status: z.enum(STATUS_ACAO).optional(),
  justificativa: z.string().trim().max(1000).optional(),
  responsavelId: z.string().nullable().optional(),
  prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  prioridade: z.enum(['CRITICO', 'ALTO', 'MODERADO', 'MONITORAMENTO']).optional(),
  metaEsperada: z.number().nullable().optional(),
  evidenciasExecucao: z.string().trim().max(4000).nullable().optional(),
  objetivo: z.string().trim().max(1000).nullable().optional(),
})
const TRANSICOES: Record<string, string[]> = {
  IDENTIFICADA: ['AGUARDANDO_APROVACAO', 'PLANEJADA', 'CANCELADA'],
  AGUARDANDO_APROVACAO: ['PLANEJADA', 'CANCELADA'],
  PLANEJADA: ['EM_EXECUCAO', 'CANCELADA'],
  EM_EXECUCAO: ['AGUARDANDO_VALIDACAO', 'CANCELADA'],
  AGUARDANDO_VALIDACAO: ['EM_EXECUCAO', 'CANCELADA'],
  NAO_ATINGIU: ['EM_EXECUCAO', 'CANCELADA'],
  CONCLUIDA: [], CANCELADA: [],
}
router.patch('/intel/acoes/:id', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  const p = patchSchema.safeParse(req.body); if (!p.success) { erro400(res, p.error); return }
  const a = await prisma.intelAcao.findFirst({ where: { id: String(req.params.id), usuarioId: c.usuarioId } })
  if (!a) { res.status(404).json({ error: 'Ação não encontrada' }); return }
  const d = p.data
  const data: Record<string, unknown> = {}
  if (d.status && d.status !== a.status) {
    if (!TRANSICOES[a.status]?.includes(d.status)) { res.status(409).json({ error: `Não dá para ir de "${a.status}" para "${d.status}". Concluir só pela validação do indicador.` }); return }
    if (d.status === 'PLANEJADA' && a.status === 'AGUARDANDO_APROVACAO' && !c.dono) { res.status(403).json({ error: 'Só o dono aprova as ações.' }); return }
    if (d.status === 'CANCELADA' && !d.justificativa) { res.status(400).json({ error: 'Para cancelar, escreva a justificativa.' }); return }
    data.status = d.status
    if (d.status === 'PLANEJADA' && a.status === 'AGUARDANDO_APROVACAO') { data.aprovadoPor = c.autor.nome; data.aprovadoEm = new Date() }
    if (d.justificativa) data.justificativa = d.justificativa
  }
  if (d.responsavelId !== undefined) {
    const nome = await nomeDoResponsavel(c.usuarioId, d.responsavelId)
    if (d.responsavelId && !nome) { res.status(400).json({ error: 'Responsável não encontrado' }); return }
    data.responsavelId = d.responsavelId; data.responsavelNome = nome
  }
  if (d.prazo !== undefined) data.prazo = d.prazo ? new Date(`${d.prazo}T23:59:59-03:00`) : null
  for (const k of ['prioridade', 'metaEsperada', 'evidenciasExecucao', 'objetivo'] as const) if (d[k] !== undefined) data[k] = d[k]
  const nova = await prisma.intelAcao.update({ where: { id: a.id }, data })
  for (const [k, v] of Object.entries(data)) if (!['aprovadoEm'].includes(k)) await auditar(c, 'ACAO', a.id, k === 'status' ? 'STATUS' : 'ALTERADA', k, (a as Record<string, unknown>)[k] ?? null, v ?? null)
  res.json(nova)
})

router.post('/intel/acoes/:id/comentarios', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  const p = z.object({ texto: z.string().trim().min(1, 'Escreva o comentário').max(2000) }).safeParse(req.body); if (!p.success) { erro400(res, p.error); return }
  const a = await prisma.intelAcao.findFirst({ where: { id: String(req.params.id), usuarioId: c.usuarioId } })
  if (!a) { res.status(404).json({ error: 'Ação não encontrada' }); return }
  const comentarios = [...((a.comentarios as Array<unknown>) ?? []), { autor: c.autor.nome, texto: p.data.texto, em: new Date().toISOString() }]
  res.json(await prisma.intelAcao.update({ where: { id: a.id }, data: { comentarios: comentarios as never } }))
})

// Validação: concluir a tarefa não basta — o indicador precisa ter chegado à meta.
router.post('/intel/acoes/:id/validar', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  const a = await prisma.intelAcao.findFirst({ where: { id: String(req.params.id), usuarioId: c.usuarioId } })
  if (!a) { res.status(404).json({ error: 'Ação não encontrada' }); return }
  if (a.status !== 'AGUARDANDO_VALIDACAO') { res.status(409).json({ error: 'Valide depois de marcar a ação como executada (aguardando validação).' }); return }
  const dados = await montarCentral(c.usuarioId, periodoDe(req), c.acesso)
  const atual = a.indicadorChave ? valorDoIndicador(a.indicadorChave, dados, { acoesAtrasadas: (await contagemAcoes(c.usuarioId)).atrasadas }) : null
  const ok = atingiuMeta(atual, a.metaEsperada, a.melhorQuando)
  if (ok == null) { res.status(409).json({ error: 'Sem indicador ou meta para validar: defina o indicador e a meta esperada da ação.' }); return }
  const status = ok ? 'CONCLUIDA' : 'NAO_ATINGIU'
  const nova = await prisma.intelAcao.update({ where: { id: a.id }, data: { status, resultadoValor: atual, resultadoEm: new Date() } })
  await auditar(c, 'ACAO', a.id, 'VALIDADA', 'status', { status: a.status, valorInicial: a.valorInicial }, { status, resultado: atual, meta: a.metaEsperada })
  res.json(nova)
})

// ---------- Fechamento diário ----------

const MODULO_ACESSO: Record<ModuloRelatorio, string> = { JORNADA: 'painel', TRAFEGO: 'trafego', SOCIAL_MEDIA: 'socialMedia', VENDAS: 'vendas', FINANCEIRO: 'financeiro' }
function moduloPermitido(req: Request, modulo: ModuloRelatorio): boolean {
  return req.intel!.dono || nivelAtende(req.acessos?.[MODULO_ACESSO[modulo]], 'VER')
}
const moduloValido = (m: unknown): m is ModuloRelatorio => typeof m === 'string' && (MODULOS_RELATORIO as readonly string[]).includes(m)
const diaValido = (s: unknown) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && s <= hojeBR() ? s : hojeBR())

router.get('/intel/relatorios/previa', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  if (!moduloValido(req.query.modulo)) { res.status(400).json({ error: 'Módulo inválido' }); return }
  if (!moduloPermitido(req, req.query.modulo)) { res.status(403).json({ error: 'Seu acesso não inclui este módulo.' }); return }
  const dia = diaValido(req.query.dia)
  const previa = await previaRelatorio(c.usuarioId, req.query.modulo, dia, c.acesso)
  const ultimo = await prisma.intelRelatorio.findFirst({ where: { usuarioId: c.usuarioId, modulo: req.query.modulo, dia, status: 'VALIDO' }, orderBy: { versao: 'desc' } })
  res.json({ ...previa, ultimo: ultimo ? { id: ultimo.id, versao: ultimo.versao, confirmadoEm: ultimo.confirmadoEm, geradoPorNome: ultimo.geradoPorNome, igual: ultimo.hash === previa.hash, diferencas: diferencas(ultimo.indicadores as never, previa.indicadores) } : null })
})

router.post('/intel/relatorios', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  const p = z.object({ modulo: z.enum(MODULOS_RELATORIO), dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hash: z.string().min(8), observacao: z.string().trim().max(1000).optional() }).safeParse(req.body)
  if (!p.success) { erro400(res, p.error); return }
  if (!moduloPermitido(req, p.data.modulo)) { res.status(403).json({ error: 'Seu acesso não inclui este módulo.' }); return }
  const previa = await previaRelatorio(c.usuarioId, p.data.modulo, diaValido(p.data.dia), c.acesso)
  // Confirma o que a pessoa conferiu: se os números mudaram desde a prévia, ela revisa de novo.
  if (previa.hash !== p.data.hash) { res.status(409).json({ error: 'Os números mudaram desde que você abriu o resumo. Confira de novo antes de enviar.', previa }); return }
  const r = await confirmarRelatorio(c.usuarioId, previa, c.autor, p.data.observacao || null)
  res.status(r.duplicado ? 200 : 201).json(r)
})

router.get('/intel/relatorios', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  const dias = Math.min(120, Math.max(1, Number(req.query.dias) || 31))
  const desde = new Date(Date.now() - dias * DIA).toISOString().slice(0, 10)
  const lista = await prisma.intelRelatorio.findMany({ where: { usuarioId: c.usuarioId, dia: { gte: desde } }, orderBy: [{ dia: 'desc' }, { modulo: 'asc' }, { versao: 'desc' }] })
  res.json(lista.filter(r => moduloPermitido(req, r.modulo as ModuloRelatorio)))
})

// ---------- Reuniões ----------

const tipoValido = (t: unknown): t is TipoReuniao => t === 'TRAFEGO' || t === 'COMERCIAL' || t === 'INTEGRADA'
router.get('/intel/reuniao', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  const tipo = tipoValido(req.query.tipo) ? req.query.tipo : 'INTEGRADA'
  const { dados, diags } = await dadosEDiagnosticos(c, periodoDe(req))
  const deps = tipo === 'TRAFEGO' ? ['TRAFEGO'] : tipo === 'COMERCIAL' ? ['COMERCIAL', 'GESTAO'] : null
  const anterior = await prisma.intelReuniao.findFirst({ where: { usuarioId: c.usuarioId, tipo }, orderBy: { data: 'desc' } })
  const idsAnteriores = ((anterior?.acoesIds as string[] | null) ?? [])
  const [acoesAnteriores, pendentes] = await Promise.all([
    idsAnteriores.length ? prisma.intelAcao.findMany({ where: { id: { in: idsAnteriores }, usuarioId: c.usuarioId } }) : [],
    prisma.intelAcao.findMany({ where: { usuarioId: c.usuarioId, status: { in: STATUS_ABERTOS }, ...(deps ? { departamento: { in: deps } } : {}) }, orderBy: { prazo: 'asc' } }),
  ])
  res.json({
    tipo, periodo: dados.periodo, pauta: pautaDaReuniao(tipo, dados, diags),
    diagnosticos: diags.filter(d => !deps || deps.includes(d.departamento)).map(d => ({ ...d, departamentoNome: NOME_DEPARTAMENTO[d.departamento] })),
    resumo: dados.resumo, retrato: retratoParaAta(dados),
    anterior: anterior ? { id: anterior.id, data: anterior.data, titulo: anterior.titulo, notas: anterior.notas, retrato: anterior.retrato, acoes: acoesAnteriores } : null,
    pendentes,
  })
})

router.get('/intel/reunioes', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  res.json(await prisma.intelReuniao.findMany({ where: { usuarioId: c.usuarioId }, orderBy: { data: 'desc' }, take: 50 }))
})

router.post('/intel/reunioes', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  const p = z.object({ tipo: z.enum(['TRAFEGO', 'COMERCIAL', 'INTEGRADA']), titulo: z.string().trim().min(2).max(200), notas: z.string().trim().max(10000).optional(), acoesIds: z.array(z.string()).max(100).optional() }).safeParse(req.body)
  if (!p.success) { erro400(res, p.error); return }
  const dados = await montarCentral(c.usuarioId, periodoDe(req), c.acesso)
  const r = await prisma.intelReuniao.create({ data: { usuarioId: c.usuarioId, tipo: p.data.tipo, titulo: p.data.titulo, notas: p.data.notas ?? null, retrato: retratoParaAta(dados) as never, acoesIds: p.data.acoesIds ?? [], criadoPor: c.autor.nome } })
  await auditar(c, 'REUNIAO', r.id, 'REGISTRADA', null, undefined, { tipo: r.tipo, titulo: r.titulo, acoes: p.data.acoesIds?.length ?? 0 })
  res.status(201).json(r)
})

// ---------- Leitura pela IA ----------

router.post('/intel/leitura', ...base, async (req: Request, res: Response) => {
  const c = req.intel!
  const { dados, diags } = await dadosEDiagnosticos(c, periodoDe(req))
  res.json(await lerCentral(c.usuarioId, dados as DadosCentral, diags))
})

export default router
