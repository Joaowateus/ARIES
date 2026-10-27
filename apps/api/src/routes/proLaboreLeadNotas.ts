// Notas da negociação do lead (painel do card do CRM): o que foi combinado,
// o que o cliente pediu, o que falta. Quem enxerga o lead lê todas; só o
// autor e o dono editam ou apagam. As notas não entram em nenhuma chamada
// de IA (podem ter valores e dados que o cliente contou).
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { requireModulo } from '../lib/acessos'
import { leadWhereBase } from '../lib/escopoLead'

const router = Router()
const autorId = (req: Request) => req.proLaboreUser!.vendedorId ?? req.proLaboreUser!.sub
const podeMexer = (req: Request, nota: { autorId: string }) => req.proLaboreUser!.papel === 'DONO' || nota.autorId === autorId(req)

const NOTA_SELECT = { id: true, texto: true, autorId: true, autorNome: true, criadoEm: true, atualizadoEm: true } as const
const comPermissao = (req: Request) => <T extends { autorId: string }>(n: T) => ({ ...n, podeEditar: podeMexer(req, n) })

const textoSchema = z.object({ texto: z.string().trim().min(1, 'Escreva a nota').max(4000, 'Nota muito longa (máximo de 4.000 caracteres)') })

router.get('/leads/:id/notas', requireProLaboreAuth, requireModulo('crm', 'VER'), async (req: Request, res: Response) => {
  const lead = await prisma.lead.findFirst({ where: { id: String(req.params.id), ...leadWhereBase(req) }, select: { id: true } })
  if (!lead) { res.status(404).json({ error: 'Lead não encontrado' }); return }
  const notas = await prisma.leadNota.findMany({ where: { leadId: lead.id }, orderBy: { criadoEm: 'desc' }, select: NOTA_SELECT })
  res.json(notas.map(comPermissao(req)))
})

router.post('/leads/:id/notas', requireProLaboreAuth, requireModulo('crm', 'EDITAR'), async (req: Request, res: Response) => {
  const p = textoSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const lead = await prisma.lead.findFirst({ where: { id: String(req.params.id), ...leadWhereBase(req) }, select: { id: true, usuarioId: true } })
  if (!lead) { res.status(404).json({ error: 'Lead não encontrado' }); return }
  const nota = await prisma.leadNota.create({
    data: { usuarioId: lead.usuarioId, leadId: lead.id, texto: p.data.texto, autorId: autorId(req), autorNome: req.proLaboreUser!.nome ?? null },
    select: NOTA_SELECT,
  })
  res.status(201).json(comPermissao(req)(nota))
})

async function notaDoPedido(req: Request, res: Response) {
  const nota = await prisma.leadNota.findFirst({ where: { id: String(req.params.notaId), lead: { ...leadWhereBase(req) } }, select: NOTA_SELECT })
  if (!nota) { res.status(404).json({ error: 'Nota não encontrada' }); return null }
  if (!podeMexer(req, nota)) { res.status(403).json({ error: 'Só quem escreveu a nota (ou o dono) pode mudar ou apagar.' }); return null }
  return nota
}

router.patch('/leads/notas/:notaId', requireProLaboreAuth, requireModulo('crm', 'EDITAR'), async (req: Request, res: Response) => {
  const p = textoSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const nota = await notaDoPedido(req, res)
  if (!nota) return
  const nova = await prisma.leadNota.update({ where: { id: nota.id }, data: { texto: p.data.texto }, select: NOTA_SELECT })
  res.json(comPermissao(req)(nova))
})

router.delete('/leads/notas/:notaId', requireProLaboreAuth, requireModulo('crm', 'EDITAR'), async (req: Request, res: Response) => {
  const nota = await notaDoPedido(req, res)
  if (!nota) return
  await prisma.leadNota.delete({ where: { id: nota.id } })
  res.json({ ok: true })
})

export default router
