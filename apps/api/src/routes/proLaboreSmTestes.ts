// Testes A/B (seção 13.3) e biblioteca de ganchos (seção 3.4).
// Testes pedem Análise (leitura para ver, completo para criar e cancelar);
// a biblioteca pede Produção (leitura para ver, completo para mudar). Os
// posts entram nos grupos pela própria pauta (PATCH testeId/testeGrupo).
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM, requireModuloSM } from '../lib/smAcesso'
import { METRICAS, VARIAVEIS, listarGanchos, listarTestes, salvarGancho } from '../lib/smTestes'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]
const MAX_ATIVOS = 3
const METRICA_PADRAO: Record<(typeof VARIAVEIS)[number], (typeof METRICAS)[number]> = { HORARIO: 'ALCANCE', GANCHO: 'PULO', FORMATO: 'ALCANCE', CTA: 'ENVIOS', OUTRO: 'ALCANCE' }

router.get('/sm/testes', ...autenticado, requireModuloSM('analise', 'LEITURA'), async (req: Request, res: Response) => {
  const sm = req.sm!
  res.json({ ...(await listarTestes(sm.usuarioId)), podeEditar: sm.pode('analise', 'COMPLETO') && !sm.somenteLeitura })
})

const testeSchema = z.object({
  hipotese: z.string().trim().min(8, 'Escreva a hipótese (ex.: posts às 17h alcançam mais que às 11h)').max(200),
  descricao: z.string().trim().max(500).nullable().optional(),
  variavel: z.enum(VARIAVEIS),
  grupoA: z.string().trim().min(1, 'Dê um nome ao grupo A').max(40),
  grupoB: z.string().trim().min(1, 'Dê um nome ao grupo B').max(40),
  horaA: z.number().int().min(0).max(23).nullable().optional(),
  horaB: z.number().int().min(0).max(23).nullable().optional(),
  metrica: z.enum(METRICAS).optional(),
  amostraAlvo: z.number().int().min(2).max(20).optional(),
  origem: z.enum(['MANUAL', 'INSIGHT']).optional(),
  origemRef: z.string().max(120).nullable().optional(),
}).refine(t => t.variavel !== 'HORARIO' || (t.horaA != null && t.horaB != null && t.horaA !== t.horaB), { message: 'No teste de horário, escolha duas horas diferentes' })

router.post('/sm/testes', ...autenticado, requireModuloSM('analise', 'COMPLETO'), async (req: Request, res: Response) => {
  const parse = testeSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const sm = req.sm!
  const ativos = await prisma.smTeste.count({ where: { usuarioId: sm.usuarioId, status: 'ATIVO' } })
  if (ativos >= MAX_ATIVOS) { res.status(409).json({ error: `Já há ${MAX_ATIVOS} testes em andamento. Conclua ou cancele um antes.` }); return }
  const d = parse.data
  // Amostra par: metade para cada grupo (padrão 6, 3 por grupo).
  const amostra = d.amostraAlvo ? d.amostraAlvo + (d.amostraAlvo % 2) : 6
  const t = await prisma.smTeste.create({
    data: {
      usuarioId: sm.usuarioId, hipotese: d.hipotese, descricao: d.descricao ?? null, variavel: d.variavel,
      grupoA: d.grupoA, grupoB: d.grupoB, horaA: d.variavel === 'HORARIO' ? d.horaA ?? null : null, horaB: d.variavel === 'HORARIO' ? d.horaB ?? null : null,
      metrica: d.metrica ?? METRICA_PADRAO[d.variavel], amostraAlvo: amostra, origem: d.origem ?? 'MANUAL', origemRef: d.origemRef ?? null,
      criadoPor: sm.visao === 'GESTOR' ? 'GESTOR' : 'SOCIAL_MEDIA',
    },
  })
  res.status(201).json(t)
})

router.post('/sm/testes/:id/cancelar', ...autenticado, requireModuloSM('analise', 'COMPLETO'), async (req: Request, res: Response) => {
  const t = await prisma.smTeste.findFirst({ where: { id: String(req.params.id), usuarioId: req.sm!.usuarioId } })
  if (!t) { res.status(404).json({ error: 'Teste não encontrado' }); return }
  if (t.status !== 'ATIVO') { res.status(409).json({ error: 'Só dá para cancelar um teste em andamento' }); return }
  await prisma.$transaction([
    prisma.smPauta.updateMany({ where: { testeId: t.id }, data: { testeId: null, testeGrupo: null } }),
    prisma.smTeste.update({ where: { id: t.id }, data: { status: 'CANCELADO' } }),
  ])
  res.json({ ok: true })
})

router.get('/sm/ganchos', ...autenticado, requireModuloSM('producao', 'LEITURA'), async (req: Request, res: Response) => {
  const sm = req.sm!
  res.json({ ...(await listarGanchos(sm.usuarioId)), podeEditar: sm.pode('producao', 'COMPLETO') && !sm.somenteLeitura })
})

router.post('/sm/ganchos', ...autenticado, requireModuloSM('producao', 'COMPLETO'), async (req: Request, res: Response) => {
  const parse = z.object({ texto: z.string().trim().min(3, 'Escreva o gancho').max(300), midiaIgIds: z.array(z.string().max(40)).max(20).optional() }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const sm = req.sm!
  // Só reels da própria conta entram como exemplo.
  let ids = parse.data.midiaIgIds ?? []
  if (ids.length) {
    const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${sm.usuarioId}` }, select: { id: true } })
    ids = conta ? (await prisma.socialMediaMidia.findMany({ where: { contaId: conta.id, instagramMediaId: { in: ids } }, select: { instagramMediaId: true } })).map(m => m.instagramMediaId) : []
  }
  const r = await salvarGancho(sm.usuarioId, parse.data.texto, ids, sm.visao === 'GESTOR' ? 'GESTOR' : 'SOCIAL_MEDIA')
  res.status(r.novo ? 201 : 200).json({ id: r.gancho.id, texto: r.gancho.texto, exemplos: r.gancho.exemplos.length, novo: r.novo })
})

router.delete('/sm/ganchos/:id', ...autenticado, requireModuloSM('producao', 'COMPLETO'), async (req: Request, res: Response) => {
  const r = await prisma.smGancho.deleteMany({ where: { id: String(req.params.id), usuarioId: req.sm!.usuarioId } })
  if (!r.count) { res.status(404).json({ error: 'Gancho não encontrado' }); return }
  res.json({ ok: true })
})

export default router
