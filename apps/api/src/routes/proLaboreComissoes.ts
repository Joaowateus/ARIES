// Pagamento de comissões: o dono marca, direto na tabela de Vendas, quais
// comissões já pagou. Cada marcação vira um PagamentoComissao (um por
// vendedor) com número sequencial — é ele que gera o comprovante impresso
// e assinado. Só o dono mexe aqui, igual ao cadastro de vendas.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth, requireDono } from '../middleware/authProLabore'
import { recalcularPagamentoComissao } from '../lib/comissoes'

const router = Router()

const FORMAS = ['PIX', 'DINHEIRO', 'TRANSFERENCIA', 'OUTRO'] as const

const registrarSchema = z.object({
  vendaIds: z.array(z.string().min(1)).min(1, 'Selecione pelo menos uma venda').max(500),
  pagoEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data do pagamento inválida'),
  formaPagamento: z.enum(FORMAS).nullable().optional(),
  observacao: z.string().max(500).nullable().optional(),
  pagador: z.string().max(120).nullable().optional(),
})

const arred = (v: number) => Math.round(v * 100) / 100

// Marca as comissões das vendas como pagas. Vendas de vendedores diferentes
// geram um comprovante pra cada vendedor.
router.post('/comissoes/pagamentos', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = registrarSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const ids = [...new Set(parse.data.vendaIds)]
  const vendas = await prisma.venda.findMany({
    where: { id: { in: ids }, usuarioId },
    select: { id: true, vendedorId: true, valorComissao: true, pagamentoComissaoId: true },
  })
  if (vendas.length !== ids.length) {
    res.status(404).json({ error: 'Alguma das vendas não foi encontrada' })
    return
  }
  if (vendas.some(v => !v.vendedorId || !v.valorComissao)) {
    res.status(400).json({ error: 'Só dá pra marcar como paga a venda que tem vendedor e comissão' })
    return
  }
  if (vendas.some(v => v.pagamentoComissaoId)) {
    res.status(409).json({ error: 'Alguma dessas comissões já está marcada como paga' })
    return
  }

  const dono = await prisma.proLaboreUsuario.findUnique({ where: { id: usuarioId }, select: { nome: true } })
  const pagador = parse.data.pagador?.trim() || dono?.nome || ''
  const porVendedor = new Map<string, typeof vendas>()
  for (const v of vendas) porVendedor.set(v.vendedorId!, [...(porVendedor.get(v.vendedorId!) ?? []), v])

  // O número é sequencial por conta; a transação serializável evita dois
  // pagamentos simultâneos pegarem o mesmo número (o unique garante).
  const criados = await prisma.$transaction(async tx => {
    const ultimo = await tx.pagamentoComissao.aggregate({ where: { usuarioId }, _max: { numero: true } })
    let numero = ultimo._max.numero ?? 0
    const saida: string[] = []
    for (const [vendedorId, lista] of porVendedor) {
      numero += 1
      const pg = await tx.pagamentoComissao.create({
        data: {
          usuarioId,
          vendedorId,
          numero,
          pagoEm: new Date(`${parse.data.pagoEm}T12:00:00Z`),
          formaPagamento: parse.data.formaPagamento ?? null,
          observacao: parse.data.observacao?.trim() || null,
          pagador,
          valorTotal: arred(lista.reduce((s, v) => s + (v.valorComissao ?? 0), 0)),
        },
      })
      // Condição pagamentoComissaoId: null protege contra duas abas marcando
      // a mesma venda ao mesmo tempo.
      const r = await tx.venda.updateMany({ where: { id: { in: lista.map(v => v.id) }, pagamentoComissaoId: null }, data: { pagamentoComissaoId: pg.id } })
      if (r.count !== lista.length) throw new Error('CONFLITO')
      saida.push(pg.id)
    }
    return saida
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((e: unknown) => {
    if (e instanceof Error && e.message === 'CONFLITO') return null
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2002' || e.code === 'P2034')) return null
    throw e
  })
  if (!criados) {
    res.status(409).json({ error: 'Essas comissões acabaram de ser marcadas em outro lugar. Atualize a página e tente de novo.' })
    return
  }

  const pagamentos = await prisma.pagamentoComissao.findMany({
    where: { id: { in: criados } },
    include: { vendedor: { select: { id: true, nome: true } }, _count: { select: { vendas: true } } },
    orderBy: { numero: 'asc' },
  })
  res.status(201).json(pagamentos)
})

// Desmarca: as vendas voltam a "comissão a pagar" e saem do comprovante
// (que fica cancelado se não sobrar nenhuma venda nele).
router.post('/comissoes/desmarcar', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = z.object({ vendaIds: z.array(z.string().min(1)).min(1).max(500) }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const vendas = await prisma.venda.findMany({
    where: { id: { in: parse.data.vendaIds }, usuarioId, pagamentoComissaoId: { not: null } },
    select: { id: true, pagamentoComissaoId: true },
  })
  const pagamentos = [...new Set(vendas.map(v => v.pagamentoComissaoId!))]
  await prisma.$transaction(async tx => {
    await tx.venda.updateMany({ where: { id: { in: vendas.map(v => v.id) } }, data: { pagamentoComissaoId: null } })
    for (const id of pagamentos) await recalcularPagamentoComissao(tx, id)
  })
  res.json({ ok: true, desmarcadas: vendas.length })
})

router.get('/comissoes/pagamentos', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const pagamentos = await prisma.pagamentoComissao.findMany({
    where: { usuarioId: req.proLaboreUser!.sub, canceladoEm: null },
    include: { vendedor: { select: { id: true, nome: true } }, _count: { select: { vendas: true } } },
    orderBy: { numero: 'desc' },
  })
  res.json(pagamentos)
})

// Tudo que o comprovante precisa pra ser impresso.
router.get('/comissoes/pagamentos/:id', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const pagamento = await prisma.pagamentoComissao.findFirst({
    where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub },
    include: {
      vendedor: { select: { id: true, nome: true } },
      vendas: {
        select: { id: true, data: true, valorVenda: true, valorComissao: true, observacao: true, lead: { select: { nomeCliente: true } } },
        orderBy: { data: 'asc' },
      },
    },
  })
  if (!pagamento) {
    res.status(404).json({ error: 'Comprovante não encontrado' })
    return
  }
  res.json(pagamento)
})

export default router
