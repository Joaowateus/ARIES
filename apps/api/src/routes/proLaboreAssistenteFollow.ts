// Follow automático do Assistente (aba "Follow"): os fluxos por situação
// (parou de responder, depois da simulação, depois da aprovação, resgate de
// perdido), o follow de crédito recusado, a chave (começa desligada, para o
// dono revisar antes), a fila do que vai sair e a taxa de resposta de cada
// fluxo. Mudar é da gestão; o vendedor vê a própria fila.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { requireModulo } from '../lib/acessos'
import { MIDIAS_FOLLOW, SITUACOES_FOLLOW, SituacaoFollow, dentroDoHorario, inicioDoDiaBrt, lerConfigFollow, limiteDias } from '../lib/assistenteFollow'
import { filaDeFollow } from '../lib/assistenteMotor'

const router = Router()
const ver = [requireProLaboreAuth, requireModulo('assistente', 'VER')]
const editar = [requireProLaboreAuth, requireModulo('assistente', 'EDITAR')]
const daGestao = (req: Request) => req.proLaboreUser!.papel === 'DONO' || req.proLaboreUser!.papel === 'SUPERVISOR'

router.get('/assistente/follow', ...ver, async (req: Request, res: Response) => {
  const { sub: usuarioId, vendedorId } = req.proLaboreUser!
  const gestao = daGestao(req)
  const agora = new Date()
  const loja = await prisma.assistenteLoja.findUnique({ where: { usuarioId } })
  const config = lerConfigFollow(loja?.followConfig)
  const doVendedor = gestao ? null : vendedorId ?? '-'
  const daOperacao = { assistente: { vendedor: { usuarioId, ...(doVendedor && { id: doVendedor }) } } }
  const [fila, enviadosHoje, ultimos, desempenho] = await Promise.all([
    filaDeFollow(usuarioId, doVendedor, agora),
    prisma.assistenteMensagem.count({ where: { origem: 'FOLLOW', criadoEm: { gte: inicioDoDiaBrt(agora) }, conversa: daOperacao } }),
    prisma.assistenteMensagem.findMany({
      where: { origem: 'FOLLOW', conversa: daOperacao },
      orderBy: { criadoEm: 'desc' }, take: 10,
      select: { id: true, texto: true, midiaUrl: true, criadoEm: true, followFluxo: true, conversa: { select: { id: true, nomeContato: true } } },
    }),
    desempenhoPorFluxo(usuarioId, doVendedor, agora),
  ])
  res.json({ ativo: loja?.followAtivo ?? false, config, podeEditar: gestao, noHorario: dentroDoHorario(agora, config), enviadosHoje, fila, ultimos, desempenho })
})

/**
 * Taxa de resposta por fluxo nos últimos 30 dias: mensagem do follow que o
 * cliente respondeu em até 3 dias. Mais quantos viraram follow do vendedor.
 */
async function desempenhoPorFluxo(usuarioId: string, vendedorId: string | null, agora: Date) {
  const desde = new Date(agora.getTime() - 30 * 864e5)
  const enviadas = await prisma.assistenteMensagem.findMany({
    where: { origem: 'FOLLOW', criadoEm: { gte: desde }, conversa: { assistente: { vendedor: { usuarioId, ...(vendedorId && { id: vendedorId }) } } } },
    select: { conversaId: true, criadoEm: true, followFluxo: true }, take: 3000,
  })
  const respostas = enviadas.length
    ? await prisma.assistenteMensagem.findMany({ where: { remetente: 'CONTATO', criadoEm: { gte: desde }, conversaId: { in: [...new Set(enviadas.map(m => m.conversaId))] } }, select: { conversaId: true, criadoEm: true } })
    : []
  const porConversa = new Map<string, number[]>()
  for (const r of respostas) porConversa.set(r.conversaId, [...(porConversa.get(r.conversaId) ?? []), r.criadoEm.getTime()])
  const linhas = new Map<SituacaoFollow, { enviados: number; responderam: number }>(SITUACOES_FOLLOW.map(s => [s, { enviados: 0, responderam: 0 }]))
  for (const m of enviadas) {
    const l = linhas.get(SITUACOES_FOLLOW.includes(m.followFluxo as SituacaoFollow) ? m.followFluxo as SituacaoFollow : 'SEM_RESPOSTA')!
    l.enviados++
    const t = m.criadoEm.getTime()
    if ((porConversa.get(m.conversaId) ?? []).some(r => r > t && r <= t + 3 * 864e5)) l.responderam++
  }
  const paraVendedor = await prisma.leadFollow.count({ where: { usuarioId, criadoPor: 'Follow automático', criadoEm: { gte: desde }, ...(vendedorId && { vendedorId }) } })
  return { dias: 30, paraVendedor, fluxos: [...linhas].map(([fluxo, l]) => ({ fluxo, ...l })) }
}

const passoSchema = z.object({
  dias: z.number().int().min(1).max(180),
  texto: z.string().trim().min(5, 'Escreva a mensagem de cada passo').max(600),
  midia: z.enum(MIDIAS_FOLLOW as [string, ...string[]]),
  imagem: z.string().regex(/^\/pro-labore\/imagens\/[A-Za-z0-9_-]{20,40}$/, 'Imagem inválida').nullable().optional(),
})
const salvarSchema = z.object({
  ativo: z.boolean().optional(),
  config: z.object({
    fluxos: z.array(z.object({
      situacao: z.enum(SITUACOES_FOLLOW as [SituacaoFollow, ...SituacaoFollow[]]),
      ativo: z.boolean(),
      passos: z.array(passoSchema).min(1, 'Cada fluxo precisa de pelo menos um passo').max(5, 'No máximo 5 passos por fluxo'),
      aoFinal: z.enum(['NADA', 'AVISAR_VENDEDOR']),
    })).min(1).max(SITUACOES_FOLLOW.length),
    tetoDiario: z.number().int().min(1).max(100),
    horaInicio: z.number().int().min(7).max(20),
    horaFim: z.number().int().min(8).max(21),
    credito: z.object({ ativo: z.boolean(), dias: z.number().int().min(7).max(120), texto: z.string().trim().min(5, 'Escreva a mensagem para chamar o cliente de novo').max(600) }),
  }).optional(),
})
const ROTULO: Record<SituacaoFollow, string> = { SEM_RESPOSTA: 'Parou de responder', APOS_SIMULACAO: 'Depois da simulação', APOS_APROVACAO: 'Depois da aprovação', REATIVACAO: 'Resgate de perdido' }

router.put('/assistente/follow', ...editar, async (req: Request, res: Response) => {
  if (!daGestao(req)) { res.status(403).json({ error: 'Só o dono ou o supervisor muda o follow automático' }); return }
  const p = salvarSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  if (p.data.config) {
    for (const f of p.data.config.fluxos) {
      const dias = f.passos.map(x => x.dias)
      const { min, max } = limiteDias(f.situacao)
      if (dias.some((d, i) => i > 0 && d <= dias[i - 1])) { res.status(400).json({ error: `${ROTULO[f.situacao]}: os passos precisam estar em dias crescentes (ex.: 1, 3, 7)` }); return }
      if (dias.some(d => d < min || d > max)) { res.status(400).json({ error: `${ROTULO[f.situacao]}: use de ${min} a ${max} dias` }); return }
      if (f.passos.some(x => x.midia === 'IMAGEM' && !x.imagem)) { res.status(400).json({ error: `${ROTULO[f.situacao]}: escolha a imagem do passo` }); return }
    }
    if (p.data.config.horaFim <= p.data.config.horaInicio) { res.status(400).json({ error: 'O horário final precisa ser depois do inicial' }); return }
  }
  const usuarioId = req.proLaboreUser!.sub
  const dados = {
    ...(p.data.ativo !== undefined && { followAtivo: p.data.ativo }),
    ...(p.data.config && { followConfig: lerConfigFollow(p.data.config) as unknown as Prisma.InputJsonValue }),
  }
  const loja = await prisma.assistenteLoja.upsert({ where: { usuarioId }, update: dados, create: { usuarioId, ...dados } })
  res.json({ ativo: loja.followAtivo, config: lerConfigFollow(loja.followConfig) })
})

export default router
