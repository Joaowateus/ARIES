import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { escopoVisibilidade, escopoWhereDono } from '../lib/permissoes'
import { ESTAGIO_LABEL } from '../lib/funil'

const router = Router()

function paraCsv(linhas: Record<string, unknown>[]): string {
  if (linhas.length === 0) return ''
  const colunas = Object.keys(linhas[0])
  const escapar = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [colunas.join(','), ...linhas.map(l => colunas.map(c => escapar(l[c])).join(','))].join('\n')
}

router.get('/oportunidades.csv', requireAuth, async (req: Request, res: Response) => {
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const oportunidades = await prisma.oportunidade.findMany({
    where: { empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'responsavelId') },
    include: { responsavel: { select: { nome: true } } },
    orderBy: { criadaEm: 'desc' },
  })
  const csv = paraCsv(
    oportunidades.map(o => ({
      cliente: o.nomeCliente, telefone: o.telefone ?? '', estagio: ESTAGIO_LABEL[o.estagio] ?? o.estagio,
      origem: o.origem, valor: o.valor ?? '', responsavel: o.responsavel?.nome ?? '', criadaEm: o.criadaEm.toISOString(),
    }))
  )
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="oportunidades.csv"')
  res.send('﻿' + csv)
})

router.get('/contratos.csv', requireAuth, async (req: Request, res: Response) => {
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const contratos = await prisma.contrato.findMany({
    where: { empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'vendedorId'), status: { not: 'CANCELADO' } },
    include: { vendedor: { select: { nome: true } }, unidade: { select: { nome: true } } },
    orderBy: { criadoEm: 'desc' },
  })
  const csv = paraCsv(
    contratos.map(c => ({
      cliente: c.nomeCliente, moto: c.unidade?.nome ?? '', valorTotal: c.valorTotal, entrada: c.entrada ?? 0,
      parcelas: c.parcelas ?? 1, vendedor: c.vendedor?.nome ?? '', criadoEm: c.criadoEm.toISOString(),
    }))
  )
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="contratos.csv"')
  res.send('﻿' + csv)
})

router.get('/tarefas.csv', requireAuth, async (req: Request, res: Response) => {
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const tarefas = await prisma.tarefa.findMany({
    where: { empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'responsavelId') },
    include: { responsavel: { select: { nome: true } } },
    orderBy: { criadoEm: 'desc' },
  })
  const csv = paraCsv(
    tarefas.map(t => ({
      titulo: t.titulo, responsavel: t.responsavel?.nome ?? '', prioridade: t.prioridade, status: t.status,
      prazo: t.prazo?.toISOString() ?? '', criadoEm: t.criadoEm.toISOString(),
    }))
  )
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="tarefas.csv"')
  res.send('﻿' + csv)
})

export default router
