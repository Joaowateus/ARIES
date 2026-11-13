// PDF 04 · Onda 3 — rotas das telas novas: Hoje por papel, Lente do ARIES,
// aba Atividades, uso das telas e piloto (participantes, alternância e
// liberação para todos). Nada aqui executa ação sozinho.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth, requireDono, requireDonoOuSupervisor } from '../middleware/authProLabore'
import { papelDoUsuario, NOME_PAPEL } from '../lib/papelHoje'
import { CONFIG_PADRAO, ErroHoje, acaoDoSupervisor, configDoPapel, filaDoHoje, lenteDaAba, nomeDoGrupo, numerosDoHoje, painelDoDono, quadroDaEquipe, type Pessoa } from '../lib/hoje'
import { alternarVersao, definirParticipante, liberarParaTodos, participantes, versaoDasTelas } from '../lib/piloto'
import { ErroRec, aceitar, concluirAtividade, descartar } from '../lib/recomendacoes'
import { hojeBrt } from '../lib/metricas'
import { criarAcao, envioSeguro, perguntar } from '../lib/pergunte'
import { aceitePdf04 } from '../lib/aceitePdf04'
import { resumoDoHoje } from '../lib/resumoHoje'
import { painelDoHoje } from '../lib/hojePainel'
import { ErroDaily, itensEnviados, levarAoDaily } from '../lib/daily'
import { ErroFrase, TEMAS, criarFrase, editarFrase, listarFrases } from '../lib/frases'
import { sugerirFrasesComIa } from '../lib/frasesIa'

const router = Router()

export function pessoaDe(req: Request): Pessoa {
  const u = req.proLaboreUser!
  return { usuarioId: u.sub, papel: papelDoUsuario(u), id: u.vendedorId ?? (u.papel === 'SOCIAL_MEDIA' && u.smMembroId ? u.smMembroId : u.sub), vendedorId: u.vendedorId ?? null, nome: u.nome }
}
const falha = (res: Response, e: unknown) => {
  if (e instanceof ErroHoje) { res.status(e.status).json({ error: e.message }); return }
  throw e
}

// --- Hoje ---
router.get('/hoje', requireProLaboreAuth, async (req: Request, res: Response) => {
  const pessoa = pessoaDe(req)
  const agora = new Date()
  const cfg = await configDoPapel(pessoa.usuarioId, pessoa.papel)
  const [numeros, fila, lente] = await Promise.all([numerosDoHoje(pessoa, agora), pessoa.papel === 'SOCIAL_MEDIA' ? Promise.resolve([]) : filaDoHoje(pessoa, agora), lenteDaAba(pessoa, 'hoje', agora)])
  const [quadro, painel] = await Promise.all([
    pessoa.papel === 'SUPERVISOR' || pessoa.papel === 'DONO' ? quadroDaEquipe(pessoa.usuarioId, agora) : Promise.resolve(null),
    // PDF 06: a bússola por área (GET /hoje/bussola) substitui o antigo painel por área.
    Promise.resolve(null as Awaited<ReturnType<typeof painelDoDono>> | null),
  ])
  res.json({
    papel: pessoa.papel, nomePapel: NOME_PAPEL[pessoa.papel], pergunta: cfg.pergunta, lenteDescricao: cfg.lente,
    numeros, fila: fila.map(i => ({ ...i, grupoNome: nomeDoGrupo(i.grupo) })), ordemFila: cfg.fila.map(g => ({ grupo: g, nome: nomeDoGrupo(g) })),
    lente, quadro: pessoa.papel === 'SUPERVISOR' ? quadro : null, painel, geradoEm: agora.toISOString(),
  })
})

// PDF 06 · seção 3: frase do dia, resumo do ARIES e a bússola por área (alcance do papel).
// Vem numa chamada separada porque calcula as 9 áreas; fica guardada por 1 hora (?atualizar=1 recalcula).
router.get('/hoje/bussola', requireProLaboreAuth, async (req: Request, res: Response) => {
  const pessoa = pessoaDe(req)
  const agora = new Date()
  const fila = pessoa.papel === 'SOCIAL_MEDIA' ? [] : await filaDoHoje(pessoa, agora).catch(() => [])
  const primeira = fila.find(i => i.acao && !i.extensao)
  const r = await resumoDoHoje(pessoa, primeira ? primeira.titulo : null, agora, req.query.atualizar === '1')
  const enviados = await itensEnviados(pessoa.usuarioId, pessoa.id)
  res.json({ ...r, enviados })
})
// Hoje como painel de comando: os dados dos gráficos (ritmo do mês, minilinhas, funil, equipe, origem).
router.get('/hoje/painel', requireProLaboreAuth, async (req: Request, res: Response) => {
  const pessoa = pessoaDe(req)
  res.json(await painelDoHoje(pessoa))
})
// "Levar ao Daily": o ponto escolhido no Hoje entra no topo do bloco da área, marcado com quem enviou e quando.
router.post('/hoje/levar-ao-daily', requireProLaboreAuth, async (req: Request, res: Response) => {
  const p = z.object({ area: z.string().min(3).max(20), texto: z.string().trim().min(3).max(300), detalhe: z.string().max(500).nullable().optional(), refTipo: z.string().max(20).nullable().optional(), refId: z.string().max(80).nullable().optional() }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const pessoa = pessoaDe(req)
  try { res.json(await levarAoDaily(pessoa, p.data)) } catch (e) { if (e instanceof ErroDaily) { res.status(e.status).json({ error: e.message }); return } throw e }
})

// PDF 06 · 5.2: biblioteca de frases (Configurações, só o dono). Autor e fonte sempre; ligar exige aprovação.
const falhaFrase = (res: Response, e: unknown) => { if (e instanceof ErroFrase) { res.status(e.status).json({ error: e.message }); return } throw e }
router.get('/frases', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  res.json({ frases: await listarFrases(req.proLaboreUser!.sub), temas: TEMAS })
})
router.post('/frases', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const p = z.object({ texto: z.string(), autor: z.string(), fonte: z.string(), temas: z.array(z.string()).max(6).default([]), ativa: z.boolean().optional() }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Preencha a frase, o autor e a fonte' }); return }
  try { res.json(await criarFrase(req.proLaboreUser!.sub, req.proLaboreUser!.nome, p.data)) } catch (e) { falhaFrase(res, e) }
})
router.put('/frases/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const p = z.object({ texto: z.string().optional(), autor: z.string().optional(), fonte: z.string().optional(), temas: z.array(z.string()).max(6).optional(), ativa: z.boolean().optional(), aprovar: z.boolean().optional() }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Dados inválidos' }); return }
  try { res.json(await editarFrase(req.proLaboreUser!.sub, String(req.params.id), req.proLaboreUser!.nome, p.data)) } catch (e) { falhaFrase(res, e) }
})
router.post('/frases/sugerir', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const tema = typeof req.body?.tema === 'string' && (TEMAS as readonly string[]).includes(req.body.tema) ? req.body.tema : 'vendas'
  res.json(await sugerirFrasesComIa(req.proLaboreUser!.sub, tema))
})

// Social Media: mantém o Hoje do seu espaço próprio, com os três números e a Lente acrescentados.
// (Rota dentro de /sm/ para valer a guarda do papel; o dono vê com "ver como".)
router.get('/sm/aries/hoje', requireProLaboreAuth, async (req: Request, res: Response) => {
  const u = req.proLaboreUser!
  const verComo = u.papel === 'DONO' && req.headers['x-ver-como'] === 'SOCIAL_MEDIA'
  if (u.papel !== 'SOCIAL_MEDIA' && !verComo) { res.status(403).json({ error: 'Só para o Social Media' }); return }
  const pessoa: Pessoa = { usuarioId: u.sub, papel: 'SOCIAL_MEDIA', id: u.smMembroId ?? u.sub, vendedorId: null, nome: u.nome }
  const versao = verComo ? { versao: 'NOVA' as const } : await versaoDasTelas(u.sub, pessoa.id, 'SOCIAL_MEDIA')
  if (versao.versao !== 'NOVA') { res.json({ ativo: false }); return }
  const cfg = await configDoPapel(u.sub, 'SOCIAL_MEDIA')
  const [numeros, lente] = await Promise.all([numerosDoHoje(pessoa), lenteDaAba(pessoa, 'hoje')])
  res.json({ ativo: true, pergunta: cfg.pergunta, numeros, lente })
})

// PDF 05: o social media decide (aceitar ou descartar com motivo) os achados de conteúdo roteados para ele.
router.post('/sm/aries/rec/:id/:acao', requireProLaboreAuth, async (req: Request, res: Response) => {
  const u = req.proLaboreUser!
  if (u.papel !== 'SOCIAL_MEDIA' || !u.smMembroId) { res.status(403).json({ error: 'Só para o Social Media' }); return }
  const q = { id: u.smMembroId, papel: 'VENDEDOR', usuarioId: u.sub }
  try {
    if (req.params.acao === 'aceitar') res.json(await aceitar(String(req.params.id), q))
    else if (req.params.acao === 'descartar') res.json(await descartar(String(req.params.id), q, String(req.body?.motivo ?? '')))
    else res.status(404).json({ error: 'Ação inválida' })
  } catch (e) { if (e instanceof ErroRec) { res.status(e.status).json({ error: e.message }); return } throw e }
})

// Configuração do Hoje por papel (seção 5): o dono vê; a padrão é a aprovada no PDF.
router.get('/hoje/config', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const papeis = Object.keys(CONFIG_PADRAO) as Array<keyof typeof CONFIG_PADRAO>
  res.json(await Promise.all(papeis.map(async p => ({ papel: p, nome: NOME_PAPEL[p], ...(await configDoPapel(req.proLaboreUser!.sub, p)) }))))
})

// Supervisor: quadro da equipe e ações (redistribuir, repriorizar, intervir, plano de ação), todas auditadas.
router.get('/hoje/equipe', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  res.json(await quadroDaEquipe(req.proLaboreUser!.sub))
})
router.get('/hoje/equipe/:vendedorId/atividades', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  res.json(await prisma.atividade.findMany({
    where: { usuarioId: req.proLaboreUser!.sub, responsavelId: String(req.params.vendedorId), status: 'PENDENTE' }, orderBy: { prazo: 'asc' }, take: 100,
    select: { id: true, codigo: true, tipo: true, prazo: true, oQueFazer: true, leadId: true },
  }))
})
router.post('/hoje/equipe/acao', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  try { res.json(await acaoDoSupervisor(pessoaDe(req), req.body ?? {})) } catch (e) { falha(res, e) }
})

// --- Lente do ARIES de qualquer aba ---
router.get('/lente', requireProLaboreAuth, async (req: Request, res: Response) => {
  res.json(await lenteDaAba(pessoaDe(req), String(req.query.aba ?? 'hoje')))
})

// --- Aba Atividades (sobre a ATV da onda 1): atrasadas, de hoje e próximas ---
const NATIVAS = ['pro_labore_recomendacoes', 'pro_labore_hoje_acoes']
router.get('/atividades/minhas', requireProLaboreAuth, async (req: Request, res: Response) => {
  const pessoa = pessoaDe(req)
  const gestao = pessoa.papel === 'DONO' || pessoa.papel === 'SUPERVISOR'
  const filtro = typeof req.query.pessoa === 'string' && req.query.pessoa ? req.query.pessoa : null
  const responsavel = gestao ? (filtro && filtro !== 'TODOS' ? filtro : filtro === 'TODOS' ? undefined : pessoa.vendedorId ?? undefined) : pessoa.vendedorId ?? '__nenhum__'
  const agora = new Date(), inicioHoje = new Date(`${hojeBrt(agora)}T03:00:00.000Z`), fimHoje = new Date(inicioHoje.getTime() + 86_400_000)
  const lista = await prisma.atividade.findMany({
    where: { usuarioId: pessoa.usuarioId, status: 'PENDENTE', ...(responsavel !== undefined ? { responsavelId: responsavel } : {}), prazo: { lt: new Date(agora.getTime() + 7 * 86_400_000) } },
    orderBy: { prazo: 'asc' }, take: 400,
    select: { id: true, codigo: true, tipo: true, origemTipo: true, origemId: true, prazo: true, canal: true, oQueFazer: true, leadId: true, responsavelId: true, registroTabela: true },
  })
  const clientes = new Map((await prisma.lead.findMany({ where: { id: { in: lista.map(a => a.leadId).filter((x): x is string => !!x) } }, select: { id: true, nomeCliente: true } })).map(l => [l.id, l.nomeCliente]))
  const nomes = gestao ? new Map((await prisma.vendedor.findMany({ where: { usuarioId: pessoa.usuarioId }, select: { id: true, nome: true } })).map(v => [v.id, v.nome])) : new Map<string, string>()
  const item = (a: typeof lista[number]) => ({
    ...a, cliente: clientes.get(a.leadId ?? '') ?? null, responsavel: nomes.get(a.responsavelId ?? '') ?? null,
    // Concluir aqui só o que nasceu nesta tela ou numa Recomendação; follow e ligação concluem no lugar deles (a ATV acompanha).
    concluiAqui: NATIVAS.includes(a.registroTabela),
    ondeConcluir: a.registroTabela === 'pro_labore_ligacoes' ? '/pro-labore/ligacoes' : a.leadId ? `/pro-labore/leads?lead=${a.leadId}` : null,
  })
  res.json({
    atrasadas: lista.filter(a => a.prazo < agora).map(item),
    hoje: lista.filter(a => a.prazo >= agora && a.prazo < fimHoje).map(item),
    proximas: lista.filter(a => a.prazo >= fimHoje).map(item),
  })
})
router.post('/atividades/:id/concluir', requireProLaboreAuth, async (req: Request, res: Response) => {
  const pessoa = pessoaDe(req)
  const resultado = String(req.body?.resultado ?? '').trim()
  const atv = await prisma.atividade.findFirst({ where: { id: String(req.params.id), usuarioId: pessoa.usuarioId } })
  if (!atv) { res.status(404).json({ error: 'Atividade não encontrada' }); return }
  const gestao = pessoa.papel === 'DONO' || pessoa.papel === 'SUPERVISOR'
  if (!gestao && atv.responsavelId !== pessoa.vendedorId) { res.status(404).json({ error: 'Atividade não encontrada' }); return }
  if (resultado.length < 2) { res.status(400).json({ error: 'Registre o resultado' }); return }
  if (atv.status !== 'PENDENTE') { res.status(409).json({ error: 'Esta atividade já foi tratada' }); return }
  if (!NATIVAS.includes(atv.registroTabela)) { res.status(409).json({ error: 'Esta atividade é concluída no lugar de origem (follow ou ligação)' }); return }
  if (atv.registroTabela === 'pro_labore_recomendacoes') {
    const quem = { id: pessoa.vendedorId ?? pessoa.usuarioId, papel: pessoa.papel === 'DONO' ? 'DONO' : pessoa.papel === 'SUPERVISOR' ? 'SUPERVISOR' : 'VENDEDOR', usuarioId: pessoa.usuarioId }
    res.json(await concluirAtividade(atv.origemId, atv.id, quem, resultado))
    return
  }
  const agora = new Date()
  res.json(await prisma.atividade.update({ where: { id: atv.id }, data: { status: 'EXECUTADA', executadaEm: agora, resultado: resultado.slice(0, 1000), autorExecucao: pessoa.vendedorId ?? pessoa.usuarioId, autorExecucaoTipo: 'PESSOA', reguaEstado: 'PARADA', auditoriaAutor: `USUARIO|${pessoa.vendedorId ?? pessoa.usuarioId}|${pessoa.papel}|atividades` } }))
})

// --- Uso das telas (princípio visual 10) ---
router.post('/uso', requireProLaboreAuth, async (req: Request, res: Response) => {
  const p = z.object({ aba: z.string().trim().min(1).max(60), versao: z.enum(['NOVA', 'ATUAL']).default('ATUAL') }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Aba inválida' }); return }
  const pessoa = pessoaDe(req)
  const r = await prisma.usoTela.create({ data: { usuarioId: pessoa.usuarioId, pessoaId: pessoa.id, papel: pessoa.papel, aba: p.data.aba, versao: p.data.versao }, select: { id: true } })
  res.status(201).json(r)
})
router.post('/uso/:id/acao', requireProLaboreAuth, async (req: Request, res: Response) => {
  const pessoa = pessoaDe(req)
  const acao = String(req.body?.acao ?? '').slice(0, 80)
  await prisma.usoTela.updateMany({ where: { id: String(req.params.id), usuarioId: pessoa.usuarioId, pessoaId: pessoa.id }, data: { acoes: { increment: 1 }, ultimaAcao: acao || null } })
  res.json({ ok: true })
})
router.get('/uso/resumo', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const desde = new Date(Date.now() - 30 * 86_400_000)
  const rs = await prisma.$queryRaw<Array<{ aba: string; aberturas: bigint; pessoas: bigint; acoes: bigint; ultima: Date }>>`
    SELECT aba, count(*) aberturas, count(DISTINCT "pessoaId") pessoas, coalesce(sum(acoes), 0) acoes, max("abertaEm") ultima
    FROM pro_labore_uso_telas WHERE "usuarioId" = ${req.proLaboreUser!.sub} AND "abertaEm" >= ${desde} GROUP BY aba ORDER BY 2 DESC`
  res.json(rs.map(r => ({ aba: r.aba, aberturas: Number(r.aberturas), pessoas: Number(r.pessoas), acoes: Number(r.acoes), ultima: r.ultima })))
})

// --- Piloto ---
router.get('/telas/versao', requireProLaboreAuth, async (req: Request, res: Response) => {
  const pessoa = pessoaDe(req)
  res.json({ ...(await versaoDasTelas(pessoa.usuarioId, pessoa.id, pessoa.papel)), papel: pessoa.papel, nomePapel: NOME_PAPEL[pessoa.papel] })
})
router.post('/telas/versao', requireProLaboreAuth, async (req: Request, res: Response) => {
  const pessoa = pessoaDe(req)
  const versao = req.body?.versao === 'NOVA' ? 'NOVA' : 'ATUAL'
  try { res.json(await alternarVersao(pessoa.usuarioId, pessoa.id, pessoa.papel, versao, `USUARIO|${pessoa.id}|${pessoa.papel}|piloto`)) } catch (e) { res.status(403).json({ error: e instanceof Error ? e.message : 'Sem permissão' }) }
})
router.get('/piloto', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  res.json(await participantes(req.proLaboreUser!.sub))
})
router.put('/piloto', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const p = z.object({ pessoaId: z.string().min(1), participa: z.boolean() }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Pedido inválido' }); return }
  try { res.json(await definirParticipante(req.proLaboreUser!.sub, p.data.pessoaId, p.data.participa, `USUARIO|${req.proLaboreUser!.sub}|DONO|piloto`)) } catch (e) { res.status(404).json({ error: e instanceof Error ? e.message : 'Não encontrado' }) }
})
router.post('/piloto/liberar', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const justificativa = String(req.body?.justificativa ?? '').trim()
  if (justificativa.length < 5) { res.status(400).json({ error: 'Registre a liberação (por que e com base em quê)' }); return }
  res.json({ liberadaEm: await liberarParaTodos(req.proLaboreUser!.sub, justificativa, req.proLaboreUser!.sub) })
})

// Orçamento de anúncio planejado do mês (Hoje do gestor de tráfego): só o dono define, com histórico.
router.put('/orcamento-anuncio', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const p = z.object({ valor: z.number().min(0).nullable(), justificativa: z.string().trim().min(5, 'Escreva por que mudou') }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const u = req.proLaboreUser!.sub
  const antes = await prisma.parametroLiquidez.findUnique({ where: { usuarioId: u }, select: { orcamentoAnuncioMensal: true } })
  await prisma.parametroLiquidez.update({ where: { usuarioId: u }, data: { orcamentoAnuncioMensal: p.data.valor } })
  await prisma.parametroHistorico.create({ data: { usuarioId: u, nome: 'orcamentoAnuncioMensal', valorAnterior: antes?.orcamentoAnuncioMensal ?? Prisma.JsonNull, valorNovo: p.data.valor ?? Prisma.JsonNull, origem: 'MANUAL', justificativa: p.data.justificativa, autorId: u } })
  res.json({ orcamentoAnuncioMensal: p.data.valor })
})
router.get('/orcamento-anuncio', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const p = await prisma.parametroLiquidez.findUnique({ where: { usuarioId: req.proLaboreUser!.sub }, select: { orcamentoAnuncioMensal: true } })
  res.json({ orcamentoAnuncioMensal: p?.orcamentoAnuncioMensal ?? null })
})

// --- Pergunte ao ARIES ---
router.post('/pergunte', requireProLaboreAuth, async (req: Request, res: Response) => {
  const pergunta = String(req.body?.pergunta ?? '').trim()
  if (pergunta.length < 3) { res.status(400).json({ error: 'Escreva a pergunta' }); return }
  res.json(await perguntar(pessoaDe(req), pergunta.slice(0, 600)))
})
router.get('/pergunte/historico', requireProLaboreAuth, async (req: Request, res: Response) => {
  const pessoa = pessoaDe(req)
  res.json(await prisma.pergunteConversa.findMany({ where: { usuarioId: pessoa.usuarioId, pessoaId: pessoa.id }, orderBy: { criadoEm: 'desc' }, take: 30 }))
})
router.post('/pergunte/:id/acao', requireProLaboreAuth, async (req: Request, res: Response) => {
  const texto = String(req.body?.texto ?? '').trim()
  const prazo = new Date(String(req.body?.prazo ?? ''))
  if (texto.length < 3 || Number.isNaN(prazo.getTime())) { res.status(400).json({ error: 'Confira o que fazer e o prazo' }); return }
  try { res.status(201).json(await criarAcao(pessoaDe(req), String(req.params.id), texto, prazo)) } catch (e) { res.status(404).json({ error: e instanceof Error ? e.message : 'Não encontrado' }) }
})
// Registro do que foi enviado à IA (conferência do teste de proteção): só o dono.
router.get('/pergunte/registro-ia', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const envios = await prisma.iaEnvio.findMany({ where: { usuarioId: req.proLaboreUser!.sub }, orderBy: { criadoEm: 'desc' }, take: Math.min(Number(req.query.limite) || 100, 500) })
  res.json({ total: await prisma.iaEnvio.count({ where: { usuarioId: req.proLaboreUser!.sub } }), envios: envios.map(e => ({ ...e, seguro: envioSeguro(e.conteudo) })) })
})

// PDF 04 · seção 9: aceite calculado na produção (só o dono).
router.get('/telas-aceite', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  res.json(await aceitePdf04(req.proLaboreUser!.sub))
})

export default router
