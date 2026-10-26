// Agenda › Meu dia: tarefas pessoais. Cada pessoa anota as próprias (o
// gestor continua sendo quem cadastra as rotinas da equipe); não entram na
// auditoria de aderência.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { requireModulo } from '../lib/acessos'

const router = Router()
const base = [requireProLaboreAuth, requireModulo('agenda', 'VER')]

/** Mesma regra das conclusões da Agenda: o vendedor do login, ou o dono. */
const dono = (req: Request) => ({ usuarioId: req.proLaboreUser!.sub, autorId: req.proLaboreUser!.vendedorId ?? req.proLaboreUser!.sub })
const DIA = /^\d{4}-\d{2}-\d{2}$/
const diaUTC = (v: string) => new Date(`${v}T00:00:00.000Z`)
const SELECT = { id: true, titulo: true, dia: true, horario: true, leadId: true, feitaEm: true, criadoEm: true }

const diaSchema = z.string().regex(DIA, 'Dia inválido').refine(v => !Number.isNaN(diaUTC(v).getTime()), 'Dia inválido')
const horarioSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:MM)')
const novaSchema = z.object({
  titulo: z.string().trim().min(1, 'Escreva a tarefa').max(200, 'Tarefa muito longa'),
  dia: diaSchema,
  horario: horarioSchema.nullish(),
  leadId: z.string().max(40).nullish(),
})
const editarSchema = z.object({
  titulo: z.string().trim().min(1, 'Escreva a tarefa').max(200, 'Tarefa muito longa').optional(),
  dia: diaSchema.optional(),
  horario: horarioSchema.nullable().optional(),
  feita: z.boolean().optional(),
})

// Tarefas do período; com atrasadas=1, também as de antes do início que ficaram por fazer.
router.get('/agenda/tarefas', ...base, async (req: Request, res: Response) => {
  const inicio = String(req.query.inicio ?? ''), fim = String(req.query.fim ?? '')
  if (!DIA.test(inicio) || !DIA.test(fim)) { res.status(400).json({ error: 'Período inválido' }); return }
  const d = dono(req)
  const noPeriodo = { dia: { gte: diaUTC(inicio), lte: diaUTC(fim) } }
  const atrasadas = { dia: { lt: diaUTC(inicio) }, feitaEm: null }
  res.json(await prisma.agendaTarefa.findMany({
    where: { ...d, OR: req.query.atrasadas === '1' ? [noPeriodo, atrasadas] : [noPeriodo] },
    orderBy: [{ dia: 'asc' }, { horario: 'asc' }, { criadoEm: 'asc' }], take: 500, select: SELECT,
  }))
})

router.post('/agenda/tarefas', ...base, async (req: Request, res: Response) => {
  const p = novaSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const d = dono(req)
  // Lead de outra conta (ou de outro vendedor) não fica ligado à tarefa.
  const lead = p.data.leadId ? await prisma.lead.findFirst({ where: { id: p.data.leadId, usuarioId: d.usuarioId, ...(req.proLaboreUser!.vendedorId && req.proLaboreUser!.papel === 'VENDEDOR' ? { vendedorId: req.proLaboreUser!.vendedorId } : {}) }, select: { id: true } }) : null
  const criada = await prisma.agendaTarefa.create({ data: { ...d, titulo: p.data.titulo, dia: diaUTC(p.data.dia), horario: p.data.horario ?? null, leadId: lead?.id ?? null }, select: SELECT })
  res.status(201).json(criada)
})

router.patch('/agenda/tarefas/:id', ...base, async (req: Request, res: Response) => {
  const p = editarSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const atual = await prisma.agendaTarefa.findFirst({ where: { id: String(req.params.id), ...dono(req) }, select: { id: true } })
  if (!atual) { res.status(404).json({ error: 'Tarefa não encontrada' }); return }
  const { feita, dia, ...resto } = p.data
  res.json(await prisma.agendaTarefa.update({
    where: { id: atual.id },
    data: { ...resto, ...(dia ? { dia: diaUTC(dia) } : {}), ...(feita === undefined ? {} : { feitaEm: feita ? new Date() : null }) },
    select: SELECT,
  }))
})

router.delete('/agenda/tarefas/:id', ...base, async (req: Request, res: Response) => {
  const r = await prisma.agendaTarefa.deleteMany({ where: { id: String(req.params.id), ...dono(req) } })
  if (!r.count) { res.status(404).json({ error: 'Tarefa não encontrada' }); return }
  res.json({ ok: true })
})

export default router
