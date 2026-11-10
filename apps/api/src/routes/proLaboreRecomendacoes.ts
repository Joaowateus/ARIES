// PDF 03 · Recomendações: lista e detalhe (dono e supervisor; cada pessoa as
// suas orientações), ciclo (aceitar, descartar com motivo, concluir as
// atividades, avaliar, encerrar), avaliação da amostra de utilidade,
// detectores (nível e volume mínimo, só o dono edita) e o roteamento.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth, requireDono, requireDonoOuSupervisor } from '../middleware/authProLabore'
import { DETECTORES, configDetectores } from '../lib/detectores'
import { aceitePdf03 } from '../lib/aceitePdf03'
import { decidirSugestao, sugerirAjustes } from '../lib/ajusteMensal'
import { DETECTORES_ONDA4, GRUPOS, NOME_GRUPO, RESPONSAVEL_GRUPO, configAreas, type GrupoArea } from '../lib/detectoresOnda4'
import { aceitePdf05 } from '../lib/aceitePdf05'
import { ErroRec, compartilharBoaPratica, mudarArea, aceitar, avaliar, concluirAtividade, descartar, detalhe, encerrar, modoRoteamento, mudarRoteamento, podeVerRec, rodarDetectores } from '../lib/recomendacoes'

const router = Router()
// Gestor de tráfego e financeiro entram com escopo de equipe, mas nas Recomendações valem como pessoas (só o que é roteado para eles).
const quem = (req: Request) => ({ id: req.proLaboreUser!.vendedorId ?? req.proLaboreUser!.sub, papel: req.proLaboreUser!.funcao ? 'VENDEDOR' : req.proLaboreUser!.papel, usuarioId: req.proLaboreUser!.sub })
const falha = (res: Response, e: unknown) => {
  if (e instanceof ErroRec) { res.status(e.status).json({ error: e.message }); return }
  throw e
}

router.get('/recomendacoes', requireProLaboreAuth, async (req: Request, res: Response) => {
  const q = quem(req)
  const { area, status, destinatarioId } = req.query
  const lista = await prisma.recomendacao.findMany({
    where: {
      usuarioId: q.usuarioId,
      ...(q.papel === 'DONO' ? {} : { visivelPara: { has: q.id } }),
      ...(typeof area === 'string' && area ? { area } : {}),
      ...(typeof status === 'string' && status ? { status } : {}),
      ...(typeof destinatarioId === 'string' && destinatarioId ? { destinatarioId } : {}),
    },
    orderBy: [{ criadoEm: 'desc' }], take: 300,
    select: { id: true, codigo: true, titulo: true, area: true, detector: true, tipo: true, forca: true, impacto: true, status: true, prazo: true, destinatarioId: true, alvoTipo: true, alvoId: true, visivelPara: true, criadoEm: true, evidencia: true, acaoSugerida: true },
  })
  const pessoas = await prisma.vendedor.findMany({ where: { usuarioId: q.usuarioId }, select: { id: true, nome: true } })
  const nome = (id: string | null) => (!id ? null : id === q.usuarioId ? 'Dono' : pessoas.find(p => p.id === id)?.nome ?? id)
  res.json({
    modo: await modoRoteamento(q.usuarioId),
    itens: lista.filter(r => podeVerRec(r, q)).map(({ visivelPara: _v, evidencia, ...r }) => ({ ...r, destinatario: nome(r.destinatarioId), resumo: (evidencia as { resumo?: string }).resumo ?? null })),
  })
})

// Orientações individuais da própria pessoa (no ponto do Copiloto).
router.get('/recomendacoes/minhas', requireProLaboreAuth, async (req: Request, res: Response) => {
  const q = quem(req)
  const lista = await prisma.recomendacao.findMany({
    where: { usuarioId: q.usuarioId, visivelPara: { has: q.id }, alvoId: q.id, alvoTipo: { in: ['PESSOA', 'CREDITO'] }, status: { in: ['NOVA', 'ACEITA', 'EM_EXECUCAO'] } },
    orderBy: { criadoEm: 'desc' }, take: 10,
    select: { id: true, codigo: true, titulo: true, tipo: true, forca: true, status: true, prazo: true, evidencia: true, acaoSugerida: true },
  })
  res.json(lista.map(({ evidencia, ...r }) => ({ ...r, orientacao: (evidencia as { orientacao?: string }).orientacao ?? null })))
})

router.get('/recomendacoes/:id', requireProLaboreAuth, async (req: Request, res: Response) => {
  try { res.json(await detalhe(String(req.params.id), quem(req))) } catch (e) { falha(res, e) }
})
router.post('/recomendacoes/:id/aceitar', requireProLaboreAuth, async (req: Request, res: Response) => {
  try { res.json(await aceitar(String(req.params.id), quem(req), new Date(), typeof req.body?.atribuirA === 'string' ? req.body.atribuirA : null)) } catch (e) { falha(res, e) }
})
router.post('/recomendacoes/:id/descartar', requireProLaboreAuth, async (req: Request, res: Response) => {
  try { res.json(await descartar(String(req.params.id), quem(req), String(req.body?.motivo ?? ''))) } catch (e) { falha(res, e) }
})
router.post('/recomendacoes/:id/atividades/:atvId/concluir', requireProLaboreAuth, async (req: Request, res: Response) => {
  try { res.json(await concluirAtividade(String(req.params.id), String(req.params.atvId), quem(req), String(req.body?.resultado ?? ''))) } catch (e) { falha(res, e) }
})
const avaliarSchema = z.object({ resultado: z.enum(['MANTER', 'AJUSTAR', 'REVERTER']), nota: z.string().trim().max(500).optional() })
router.post('/recomendacoes/:id/avaliar', requireProLaboreAuth, async (req: Request, res: Response) => {
  const p = avaliarSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Escolha manter, ajustar ou reverter' }); return }
  try { res.json(await avaliar(String(req.params.id), quem(req), p.data.resultado, p.data.nota)) } catch (e) { falha(res, e) }
})
router.post('/recomendacoes/:id/encerrar', requireProLaboreAuth, async (req: Request, res: Response) => {
  try { res.json(await encerrar(String(req.params.id), quem(req))) } catch (e) { falha(res, e) }
})

// Teste de utilidade (seção 9): dono e supervisor marcam pertinente ou não.
const pertSchema = z.object({ pertinente: z.boolean(), comentario: z.string().trim().max(500).optional() })
router.post('/recomendacoes/:id/pertinencia', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const p = pertSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Diga se é pertinente' }); return }
  const q = quem(req)
  const rec = await prisma.recomendacao.findFirst({ where: { id: String(req.params.id), usuarioId: q.usuarioId }, select: { id: true } })
  if (!rec) { res.status(404).json({ error: 'Recomendação não encontrada' }); return }
  await prisma.recomendacaoAvaliacao.upsert({
    where: { recomendacaoId_avaliadorId: { recomendacaoId: rec.id, avaliadorId: q.id } },
    create: { recomendacaoId: rec.id, avaliadorId: q.id, pertinente: p.data.pertinente, comentario: p.data.comentario ?? null },
    update: { pertinente: p.data.pertinente, comentario: p.data.comentario ?? null, em: new Date() },
  })
  res.json({ ok: true })
})

// Rodar os detectores agora (só o dono; o cron roda todo dia).
router.post('/recomendacoes/rodar', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  // Fora da produção, os testes podem simular a data (como o cron faz com x-cron-agora).
  const simulada = process.env.NODE_ENV !== 'production' && typeof req.body?.agora === 'string' ? new Date(req.body.agora) : null
  const quais = Array.isArray(req.body?.detectores) ? req.body.detectores.map(String) : undefined
  res.json(await rodarDetectores(req.proLaboreUser!.sub, simulada && !Number.isNaN(simulada.getTime()) ? simulada : new Date(), quais))
})

// Detectores: lista com nível e volume mínimo; só o dono edita.
router.get('/detectores', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const cfg = await configDetectores(req.proLaboreUser!.sub)
  res.json({ modo: await modoRoteamento(req.proLaboreUser!.sub), detectores: DETECTORES.filter(d => !d.grupo).map(d => ({ ...d, ...cfg[d.chave] })) })
})
const detSchema = z.object({
  ativo: z.boolean().optional(),
  volumeMinimo: z.number().int().min(1).max(1000).optional(),
  limite: z.number().min(0.05).max(2).optional(),
  // Onda 2: nenhuma execução automática (fora do escopo). Os níveis 2 e 3 chegam com a execução.
  nivelAutonomia: z.literal(1).optional(),
  justificativa: z.string().trim().min(5, 'Escreva por que mudou').max(500),
})
router.put('/detectores/:chave', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const chave = String(req.params.chave)
  if (!DETECTORES.some(d => d.chave === chave)) { res.status(404).json({ error: 'Detector não encontrado' }); return }
  const p = detSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message.includes('literal') ? 'Nesta onda todos os detectores ficam no nível 1 (só recomendam)' : p.error.issues[0].message }); return }
  const usuarioId = req.proLaboreUser!.sub
  const { justificativa, ...dados } = p.data
  const antes = (await configDetectores(usuarioId))[chave]
  await prisma.detector.upsert({ where: { usuarioId_chave: { usuarioId, chave } }, create: { usuarioId, chave, ...dados }, update: dados })
  await prisma.parametroHistorico.create({ data: { usuarioId, nome: `detector.${chave}`, valorAnterior: antes as object, valorNovo: { ...antes, ...dados } as object, origem: 'MANUAL', justificativa, autorId: usuarioId } })
  const cfg = await configDetectores(usuarioId)
  res.json({ modo: await modoRoteamento(usuarioId), detectores: DETECTORES.map(d => ({ ...d, ...cfg[d.chave] })) })
})

// Roteamento: SILENCIOSO (dono e supervisor) até a liberação; NORMAL liga o envio para a equipe.
const rotSchema = z.object({ modo: z.enum(['SILENCIOSO', 'NORMAL']), justificativa: z.string().trim().min(5, 'Escreva por que mudou').max(500) })
router.put('/recomendacoes-roteamento', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const p = rotSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const usuarioId = req.proLaboreUser!.sub
  const antes = await modoRoteamento(usuarioId)
  const afetadas = antes === p.data.modo ? 0 : await mudarRoteamento(usuarioId, p.data.modo)
  if (antes !== p.data.modo) await prisma.parametroHistorico.create({ data: { usuarioId, nome: 'recRoteamento', valorAnterior: antes, valorNovo: p.data.modo, origem: 'MANUAL', justificativa: p.data.justificativa, autorId: usuarioId } })
  res.json({ modo: await modoRoteamento(usuarioId), afetadas })
})

// Sugestões mensais de ajuste (para aprovação do dono).
router.get('/sugestoes-ajuste', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  res.json(await prisma.sugestaoAjuste.findMany({ where: { usuarioId: req.proLaboreUser!.sub }, orderBy: [{ status: 'asc' }, { criadoEm: 'desc' }], take: 50 }))
})
router.post('/sugestoes-ajuste/gerar', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const simulada = process.env.NODE_ENV !== 'production' && typeof req.body?.agora === 'string' ? new Date(req.body.agora) : new Date()
  res.json(await sugerirAjustes(req.proLaboreUser!.sub, simulada))
})
router.post('/sugestoes-ajuste/:id/:decisao', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const d = String(req.params.decisao)
  if (d !== 'aprovar' && d !== 'recusar') { res.status(404).json({ error: 'Ação inválida' }); return }
  try { res.json(await decidirSugestao(req.proLaboreUser!.sub, String(req.params.id), d === 'aprovar', req.proLaboreUser!.sub)) } catch (e) { res.status(409).json({ error: e instanceof Error ? e.message : 'Não foi possível' }) }
})

// PDF 03 · seção 9: aceite calculado na produção (só o dono) e a amostra de utilidade.
router.get('/recomendacoes-aceite', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  res.json(await aceitePdf03(req.proLaboreUser!.sub))
})

// PDF 05 · Áreas da onda 4: ligar/desligar e modo silencioso de cada uma (só o dono, com justificativa).
router.get('/detectores-areas', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  const u = req.proLaboreUser!.sub
  const [areas, cfg] = await Promise.all([configAreas(u), configDetectores(u)])
  res.json(GRUPOS.map(g => ({ grupo: g, nome: NOME_GRUPO[g], responsavel: RESPONSAVEL_GRUPO[g], ...areas[g], detectores: DETECTORES_ONDA4.filter(d => d.grupo === g).map(d => ({ ...d, ...cfg[d.chave] })) })))
})
router.put('/detectores-areas/:grupo', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const g = String(req.params.grupo) as GrupoArea
  if (!GRUPOS.includes(g)) { res.status(404).json({ error: 'Área desconhecida' }); return }
  const p = z.object({ ligada: z.boolean().optional(), modo: z.enum(['SILENCIOSO', 'NORMAL']).optional(), justificativa: z.string().trim().min(5, 'Escreva por que mudou') }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  // Uma área por vez (PDF 05): só liga a próxima quando a anterior foi liberada (roteamento normal).
  if (p.data.ligada) {
    const areas = await configAreas(req.proLaboreUser!.sub)
    const anterior = GRUPOS[GRUPOS.indexOf(g) - 1]
    if (anterior && !(areas[anterior].ligada && areas[anterior].modo === 'NORMAL')) { res.status(409).json({ error: `Ligue uma área por vez: primeiro libere ${NOME_GRUPO[anterior]}` }); return }
  }
  const r = await mudarArea(req.proLaboreUser!.sub, g, { ligada: p.data.ligada, modo: p.data.modo }, p.data.justificativa, req.proLaboreUser!.sub)
  // Ao ligar, os detectores da área já rodam (sem esperar o job do dia).
  const rodada = p.data.ligada ? await rodarArea(req.proLaboreUser!.sub, g) : null
  res.json({ ...r, ...(rodada ? { recsCriadas: rodada } : {}) })
})
const rodarArea = async (usuarioId: string, g: GrupoArea) => (await rodarDetectores(usuarioId, new Date(), DETECTORES_ONDA4.filter(d => d.grupo === g).map(d => d.chave)).catch(e => { console.error('[detectores] área', e); return [] })).filter(x => x.criada).length
// Rodar agora os detectores de uma área ligada (o job do dia também roda).
router.post('/detectores-areas/:grupo/rodar', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const g = String(req.params.grupo) as GrupoArea
  if (!GRUPOS.includes(g)) { res.status(404).json({ error: 'Área desconhecida' }); return }
  if (!(await configAreas(req.proLaboreUser!.sub))[g].ligada) { res.status(409).json({ error: 'Ligue a área antes de rodar' }); return }
  res.json({ recsCriadas: await rodarArea(req.proLaboreUser!.sub, g) })
})
// Boa prática: o supervisor decide compartilhar (sem nomes, ou reconhecendo a pessoa).
router.post('/recomendacoes/:id/compartilhar', requireProLaboreAuth, requireDonoOuSupervisor, async (req: Request, res: Response) => {
  try { res.json(await compartilharBoaPratica(String(req.params.id), quem(req), req.body?.comNome === true, typeof req.body?.texto === 'string' ? req.body.texto : undefined)) } catch (e) { falha(res, e) }
})

router.get('/detectores-areas/:grupo/aceite', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const g = String(req.params.grupo) as GrupoArea
  if (!GRUPOS.includes(g)) { res.status(404).json({ error: 'Área desconhecida' }); return }
  res.json(await aceitePdf05(req.proLaboreUser!.sub, g))
})

export default router
