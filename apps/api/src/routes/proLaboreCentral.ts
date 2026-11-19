// PDF 07 · Central de Conhecimento — rotas da aba (Explorar, Indicadores, Conhecimento
// comercial e Saúde da Central). Toda permissão é conferida aqui, no servidor (P7).
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth, requireDono } from '../middleware/authProLabore'
import { contextoDoPedido } from '../lib/centralConhecimento/contexto'
import { buscar } from '../lib/centralConhecimento/indice'
import { NOME_TIPO, type TipoDoc } from '../lib/centralConhecimento/fontes'
import { saude, topo } from '../lib/centralConhecimento/saude'
import { conferir, processarEventos, tentarDeNovo } from '../lib/centralConhecimento/rotinas'
import { fichas, historicoDaFicha, hojeBrt, ler, mesCorrente, type Ficha } from '../lib/metricas'
import { formatar } from '../lib/pergunte'

const router = Router()
const TIPOS = Object.keys(NOME_TIPO) as TipoDoc[]

// --- Topo ---
router.get('/central/topo', requireProLaboreAuth, async (req: Request, res: Response) => {
  res.json(await topo(contextoDoPedido(req)))
})

// --- Explorar ---
router.get('/central/busca', requireProLaboreAuth, async (req: Request, res: Response) => {
  const ctx = contextoDoPedido(req)
  const termo = String(req.query.q ?? '').trim().slice(0, 120)
  if (termo.length < 2) { res.json({ grupos: [], total: 0 }); return }
  const tipos = String(req.query.tipos ?? '').split(',').filter((t): t is TipoDoc => (TIPOS as string[]).includes(t))
  const data = (s: unknown) => { const d = typeof s === 'string' && s ? new Date(s) : null; return d && !Number.isNaN(d.getTime()) ? d : null }
  // Filtro por responsável: só para quem vê a equipe.
  const vendedorId = !ctx.pessoal && typeof req.query.vendedorId === 'string' && req.query.vendedorId ? req.query.vendedorId : null
  const r = await buscar(ctx, termo, { tipos, desde: data(req.query.desde), ate: data(req.query.ate), vendedorId })
  await prisma.centralPesquisa.create({ data: { usuarioId: ctx.pessoa.usuarioId, pessoaId: ctx.pessoa.id, papel: ctx.pessoa.papel, termo, resultados: r.total } }).catch(() => undefined)
  res.json(r)
})

// Pesquisa sem resultado → vira pergunta sem resposta (aparece na Saúde para virar verbete ou ajuste).
router.post('/central/sem-resposta', requireProLaboreAuth, async (req: Request, res: Response) => {
  const ctx = contextoDoPedido(req)
  const termo = String(req.body?.termo ?? '').trim().slice(0, 500)
  if (termo.length < 2) { res.status(400).json({ error: 'Escreva o que você procurou' }); return }
  const c = await prisma.pergunteConversa.create({ data: { usuarioId: ctx.pessoa.usuarioId, pessoaId: ctx.pessoa.id, papel: ctx.pessoa.papel, canal: 'TELA', pergunta: termo, resposta: 'Registrada a partir de uma pesquisa sem resultado na Central de Conhecimento.', naoSabe: true } })
  res.status(201).json({ id: c.id })
})

// Filtro "responsável" do Explorar (só quem vê a equipe).
router.get('/central/responsaveis', requireProLaboreAuth, async (req: Request, res: Response) => {
  const ctx = contextoDoPedido(req)
  if (ctx.pessoal) { res.json([]); return }
  res.json(await prisma.vendedor.findMany({ where: { usuarioId: ctx.pessoa.usuarioId, ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }))
})

// --- Indicadores ---
const visivel = (f: Ficha, papel: string) => papel === 'DONO' || f.quemVe.includes(papel as Ficha['quemVe'][number])

router.get('/central/indicadores', requireProLaboreAuth, async (req: Request, res: Response) => {
  const ctx = contextoDoPedido(req)
  const lista = (await fichas(ctx.pessoa.usuarioId)).filter(f => visivel(f, ctx.pessoa.papel))
  const rascunhos = ctx.pessoa.papel === 'DONO' || ctx.pessoa.papel === 'SUPERVISOR'
    ? await prisma.metricaVersao.findMany({ where: { usuarioId: ctx.pessoa.usuarioId, situacao: 'RASCUNHO' }, orderBy: { criadoEm: 'desc' } })
    : []
  res.json({
    fichas: lista.map(f => ({ chave: f.chave, nome: f.nome, definicao: f.definicao, fonte: f.fonte, unidade: f.unidade, sinonimos: f.sinonimos ?? [], versao: f.versao, naoDefinido: f.naoDefinido ?? null, retrato: !!f.retrato, area: f.fonte.split(/\s+e\s+|,/)[0].trim() })),
    rascunhos: rascunhos.map(r => ({ id: r.id, chave: r.chave, versao: r.versao, ficha: r.ficha, justificativa: r.justificativa, autorId: r.autorId, criadoEm: r.criadoEm })),
    podeAprovar: ctx.pessoa.papel === 'DONO',
  })
})

router.get('/central/indicadores/:chave', requireProLaboreAuth, async (req: Request, res: Response) => {
  const ctx = contextoDoPedido(req)
  const f = (await fichas(ctx.pessoa.usuarioId)).find(x => x.chave === req.params.chave)
  if (!f || !visivel(f, ctx.pessoa.papel)) { res.status(404).json({ error: 'Métrica não encontrada' }); return }
  const agora = new Date()
  const periodo = f.retrato ? { inicio: hojeBrt(agora), fim: hojeBrt(agora) } : mesCorrente(agora)
  const vendedorId = ctx.pessoal ? ctx.pessoa.vendedorId ?? '__nenhum__' : null
  let valor: { valor: number | null; texto: string; anterior: string | null; variacao: number | null; faixa: string | null; periodo: typeof periodo; erro?: string } | null = null
  if (!f.naoDefinido) {
    try {
      const l = await ler(f.chave, { usuarioId: ctx.pessoa.usuarioId, papel: ctx.pessoa.papel, vendedorId }, periodo, agora)
      valor = { valor: l.valor, texto: formatar(l.valor, f.unidade), anterior: l.anterior ? formatar(l.anterior.valor, f.unidade) : null, variacao: l.variacao, faixa: l.faixa, periodo }
    } catch (e) { valor = { valor: null, texto: 'sem dados', anterior: null, variacao: null, faixa: null, periodo, erro: e instanceof Error ? e.message : 'Falha no cálculo' } }
  }
  const versoes = await historicoDaFicha(ctx.pessoa.usuarioId, f.chave)
  // P4: aviso de qualidade quando a base tem registros incompletos ou suspeitos.
  const [q] = await prisma.$queryRaw<Array<{ inc: bigint; sus: bigint }>>`
    SELECT count(*) FILTER (WHERE classificacao = 'INCOMPLETO') inc, count(*) FILTER (WHERE classificacao = 'SUSPEITO') sus
    FROM pro_labore_confiabilidade WHERE "usuarioId" = ${ctx.pessoa.usuarioId} AND "registroTabela" = ${/Vendas/.test(f.fonte) && !/CRM/.test(f.fonte) ? 'pro_labore_vendas' : 'pro_labore_leads'}`.catch(() => [{ inc: 0n, sus: 0n }])
  const inc = Number(q?.inc ?? 0), sus = Number(q?.sus ?? 0)
  res.json({
    ficha: { ...f, aprovadoEm: f.aprovadoEm?.toISOString() ?? null },
    valor, escopo: vendedorId ? 'você' : 'a loja',
    qualidade: inc || sus ? `Há ${inc} registro(s) incompleto(s) e ${sus} suspeito(s) na base desta métrica (Saúde dos dados).` : null,
    versoes: versoes.map(v => ({ versao: v.versao, situacao: v.situacao, justificativa: v.justificativa, aprovadoPor: v.aprovadoPor, aprovadoEm: v.aprovadoEm, criadoEm: v.criadoEm })),
  })
})

// Gestão sugere uma mudança (nome, definição ou sinônimos): fica em rascunho até o dono aprovar.
const sugestaoSchema = z.object({
  nome: z.string().trim().min(3).max(80).optional(),
  definicao: z.string().trim().min(5).max(400).optional(),
  sinonimos: z.array(z.string().trim().min(2).max(60)).max(30).optional(),
  justificativa: z.string().trim().min(5, 'Escreva por que mudar').max(500),
})
router.post('/central/indicadores/:chave/sugestao', requireProLaboreAuth, async (req: Request, res: Response) => {
  const ctx = contextoDoPedido(req)
  if (ctx.pessoa.papel !== 'DONO' && ctx.pessoa.papel !== 'SUPERVISOR') { res.status(403).json({ error: 'Sugerir mudança numa métrica é da gestão' }); return }
  const p = sugestaoSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const u = ctx.pessoa.usuarioId
  const atual = (await fichas(u)).find(x => x.chave === req.params.chave)
  if (!atual) { res.status(404).json({ error: 'Métrica não encontrada' }); return }
  const ultima = await prisma.metricaVersao.findFirst({ where: { usuarioId: u, chave: atual.chave }, orderBy: { versao: 'desc' }, select: { versao: true } })
  const { versao: _v, aprovadoPor: _a, aprovadoEm: _b, ...base } = atual
  const { justificativa, ...mudanca } = p.data
  const r = await prisma.metricaVersao.create({
    data: { usuarioId: u, chave: atual.chave, versao: Math.max(ultima?.versao ?? 1, atual.versao) + 1, ficha: { ...base, ...mudanca } as unknown as Prisma.InputJsonValue, justificativa, autorId: ctx.pessoa.id, situacao: 'RASCUNHO' },
  })
  res.status(201).json({ id: r.id, versao: r.versao, situacao: r.situacao })
})

// O dono aprova (ou recusa, sem apagar) cada rascunho, um por métrica (regra 2 do PDF 07).
router.post('/central/indicadores/rascunhos/:id/:decisao', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const r = await prisma.metricaVersao.findFirst({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub, situacao: 'RASCUNHO' } })
  if (!r) { res.status(404).json({ error: 'Rascunho não encontrado' }); return }
  if (req.params.decisao === 'aprovar') {
    await prisma.metricaVersao.update({ where: { id: r.id }, data: { situacao: 'APROVADA', aprovadoPor: req.proLaboreUser!.sub, aprovadoEm: new Date() } })
    res.json({ ok: true, situacao: 'APROVADA' })
  } else if (req.params.decisao === 'recusar') {
    await prisma.metricaVersao.update({ where: { id: r.id }, data: { situacao: 'RECUSADA', aprovadoPor: req.proLaboreUser!.sub, aprovadoEm: new Date() } })
    res.json({ ok: true, situacao: 'RECUSADA' })
  } else res.status(400).json({ error: 'Decisão inválida' })
})

// --- Conhecimento comercial: histórico de versões de um verbete ---
router.get('/central/conhecimento/:id/versoes', requireProLaboreAuth, async (req: Request, res: Response) => {
  const ctx = contextoDoPedido(req)
  const v = await prisma.assistenteConhecimento.findFirst({ where: { id: String(req.params.id), usuarioId: ctx.pessoa.usuarioId }, select: { id: true, status: true } })
  const gestao = ctx.pessoa.papel === 'DONO' || ctx.pessoa.papel === 'SUPERVISOR'
  if (!v || (!gestao && v.status !== 'ATIVO')) { res.status(404).json({ error: 'Verbete não encontrado' }); return }
  res.json(await prisma.assistenteConhecimentoVersao.findMany({ where: { conhecimentoId: v.id }, orderBy: { versao: 'desc' } }))
})

// --- Pergunte: marcar resposta errada (vai para a Saúde) ---
router.post('/pergunte/:id/errada', requireProLaboreAuth, async (req: Request, res: Response) => {
  const ctx = contextoDoPedido(req)
  const r = await prisma.pergunteConversa.updateMany({ where: { id: String(req.params.id), usuarioId: ctx.pessoa.usuarioId, pessoaId: ctx.pessoa.id }, data: { marcadaErradaEm: new Date(), marcadaErradaPor: ctx.pessoa.id } })
  if (!r.count) { res.status(404).json({ error: 'Conversa não encontrada' }); return }
  res.json({ ok: true })
})

// --- Saúde da Central (só o dono) ---
router.get('/central/saude', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  res.json(await saude(req.proLaboreUser!.sub))
})
router.post('/central/saude/tentar', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const p = z.object({ eventoId: z.string().optional(), fonte: z.string().optional() }).safeParse(req.body ?? {})
  if (!p.success) { res.status(400).json({ error: 'Pedido inválido' }); return }
  const r = await tentarDeNovo(req.proLaboreUser!.sub, p.data)
  // Já processa um lote agora, sem esperar o próximo job.
  const feito = await processarEventos(6000)
  res.json({ ...r, ...feito })
})
router.post('/central/saude/conferir', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  res.json(await conferir(20_000, new Date(), req.proLaboreUser!.sub))
})
router.post('/central/saude/divergencias/:id/resolver', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const r = await prisma.centralDivergencia.updateMany({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub, resolvidaEm: null }, data: { resolvidaEm: new Date(), resolvidaPor: req.proLaboreUser!.nome ?? 'Dono' } })
  res.json({ ok: r.count > 0 })
})
router.post('/central/saude/perguntas/:id/tratada', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const r = await prisma.pergunteConversa.updateMany({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub }, data: { tratadaEm: new Date() } })
  res.json({ ok: r.count > 0 })
})

export default router
