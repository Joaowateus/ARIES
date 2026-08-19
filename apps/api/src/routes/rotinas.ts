import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requirePapel } from '../middleware/auth'
import { PAPEIS_GESTAO } from '../lib/permissoes'

const router = Router()

const blocosSchema = z.array(z.object({ titulo: z.string(), itens: z.array(z.string()) }))

const rotinaSchema = z.object({
  nome: z.string().min(2),
  descricao: z.string().optional(),
  papelAlvo: z.string().nullable().optional(),
  departamento: z.string().nullable().optional(),
  frequencia: z.enum(['DIARIA', 'SEMANAL', 'MENSAL']).default('DIARIA'),
  horario: z.string().optional(),
  blocos: blocosSchema,
  evidenciaNecessaria: z.boolean().default(false),
  protocoloId: z.string().nullable().optional(),
  processoId: z.string().nullable().optional(),
})

function inicioDoDia(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const rotinas = await prisma.rotina.findMany({
    where: { empresaId: req.user!.empresaId, status: 'ATIVA' },
    orderBy: { criadoEm: 'desc' },
  })
  res.json(rotinas)
})

router.post('/', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const parse = rotinaSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const rotina = await prisma.rotina.create({
    data: { ...parse.data, empresaId: req.user!.empresaId, criadoPorId: req.user!.sub },
  })
  res.status(201).json(rotina)
})

router.patch('/:id', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const parse = rotinaSchema.partial().safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const atualizado = await prisma.rotina.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    data: parse.data,
  })
  if (!atualizado.count) {
    res.status(404).json({ error: 'Rotina não encontrada' })
    return
  }
  res.json({ ok: true })
})

router.patch('/:id/arquivar', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const atualizado = await prisma.rotina.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    data: { status: 'ARQUIVADA' },
  })
  if (!atualizado.count) {
    res.status(404).json({ error: 'Rotina não encontrada' })
    return
  }
  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Checklist do dia — materializa (find-or-create) a RotinaExecucao de hoje
// para cada rotina DIARIA aplicável ao papel do usuário logado. Rotinas
// SEMANAL/MENSAL ficam só como referência em /rotinas por enquanto — não
// geram checklist automático (ver nota de escopo).
// ---------------------------------------------------------------------------

router.get('/minha', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const usuarioId = req.user!.sub
  const hoje = inicioDoDia(new Date())

  const rotinasAplicaveis = await prisma.rotina.findMany({
    where: {
      empresaId,
      status: 'ATIVA',
      frequencia: 'DIARIA',
      OR: [{ papelAlvo: null }, { papelAlvo: req.user!.papel }],
    },
  })

  const execucoes = await Promise.all(
    rotinasAplicaveis.map(async rotina => {
      const itensIniciais = (rotina.blocos as { titulo: string; itens: string[] }[]).flatMap(bloco =>
        bloco.itens.map(item => ({ bloco: bloco.titulo, item, status: 'PENDENTE' }))
      )
      const existente = await prisma.rotinaExecucao.findUnique({
        where: { rotinaId_usuarioId_data: { rotinaId: rotina.id, usuarioId, data: hoje } },
      })
      if (existente) return { rotina, execucao: existente }
      const criada = await prisma.rotinaExecucao.create({
        data: { empresaId, rotinaId: rotina.id, usuarioId, data: hoje, itensStatus: itensIniciais, status: 'PENDENTE' },
      })
      return { rotina, execucao: criada }
    })
  )

  res.json(execucoes)
})

const execucaoSchema = z.object({
  itensStatus: z.array(z.object({ bloco: z.string(), item: z.string(), status: z.string() })).optional(),
  evidencia: z.string().optional(),
  observacao: z.string().optional(),
})

router.patch('/execucoes/:id', requireAuth, async (req: Request, res: Response) => {
  const parse = execucaoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const execucao = await prisma.rotinaExecucao.findFirst({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId, usuarioId: req.user!.sub },
  })
  if (!execucao) {
    res.status(404).json({ error: 'Execução não encontrada' })
    return
  }

  const itensStatus = parse.data.itensStatus ?? (execucao.itensStatus as { status: string }[])
  const todosConcluidos = itensStatus.length > 0 && itensStatus.every(i => i.status === 'CONCLUIDO')
  const algumConcluido = itensStatus.some(i => i.status === 'CONCLUIDO')
  const status = todosConcluidos ? 'CONCLUIDA' : algumConcluido ? 'EM_ANDAMENTO' : 'PENDENTE'

  const atualizada = await prisma.rotinaExecucao.update({
    where: { id: execucao.id },
    data: {
      ...parse.data,
      status,
      concluidoEm: todosConcluidos ? new Date() : null,
    },
  })
  res.json(atualizada)
})

export default router
