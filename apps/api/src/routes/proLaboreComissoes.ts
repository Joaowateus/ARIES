// Pagamento de comissões: o dono marca, direto na tabela de Vendas, quais
// comissões já pagou. Cada marcação vira um PagamentoComissao (um por
// vendedor) com número sequencial — é ele que gera o comprovante impresso
// e assinado. Só o dono mexe aqui, igual ao cadastro de vendas.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
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

  // Um comprovante por vendedor. Sem transação interativa (no servidor ela
  // tem limite de 5s e falhava com o banco longe da API): cada comprovante é
  // gravado num lote atômico só (cria o pagamento + liga as vendas), e o
  // número sequencial é garantido pelo unique (usuarioId, numero) — se outro
  // pagamento pegou o mesmo número no meio do caminho, tenta o próximo.
  const pagoEm = new Date(`${parse.data.pagoEm}T12:00:00Z`)
  const observacao = parse.data.observacao?.trim() || null
  const criados: string[] = []
  let conflito = false
  try {
    for (const [vendedorId, lista] of porVendedor) {
      const id = randomUUID()
      const vendaIds = lista.map(v => v.id)
      for (let tentativa = 0; ; tentativa++) {
        const ultimo = await prisma.pagamentoComissao.aggregate({ where: { usuarioId }, _max: { numero: true } })
        try {
          const [, ligadas] = await prisma.$transaction([
            prisma.pagamentoComissao.create({
              data: {
                id, usuarioId, vendedorId, pagoEm, observacao, pagador,
                numero: (ultimo._max.numero ?? 0) + 1,
                formaPagamento: parse.data.formaPagamento ?? null,
                valorTotal: arred(lista.reduce((s, v) => s + (v.valorComissao ?? 0), 0)),
              },
            }),
            // pagamentoComissaoId: null protege contra duas abas marcando a
            // mesma venda ao mesmo tempo.
            prisma.venda.updateMany({ where: { id: { in: vendaIds }, usuarioId, pagamentoComissaoId: null }, data: { pagamentoComissaoId: id } }),
          ])
          if (ligadas.count !== vendaIds.length) {
            // Alguma venda foi marcada em outro lugar nesse meio-tempo:
            // desfaz este comprovante (fica cancelado, o número não volta).
            await prisma.venda.updateMany({ where: { pagamentoComissaoId: id }, data: { pagamentoComissaoId: null } })
            await recalcularPagamentoComissao(prisma, id)
            conflito = true
          } else criados.push(id)
          break
        } catch (e) {
          const numeroRepetido = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
          if (!numeroRepetido || tentativa >= 4) throw e
        }
      }
      if (conflito) break
    }
  } catch (e) {
    const codigo = e instanceof Prisma.PrismaClientKnownRequestError ? e.code : e instanceof Error ? e.name : 'desconhecido'
    console.error('[comissoes] falha ao registrar pagamento', { usuarioId, codigo, erro: e instanceof Error ? e.message : e })
    res.status(500).json({
      error: `Não deu pra registrar o pagamento agora (código ${codigo}).${criados.length ? ` ${criados.length} comprovante(s) já foram gravados — atualize a página.` : ' Nada foi gravado — tente de novo.'}`,
    })
    return
  }
  if (conflito && !criados.length) {
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
  await prisma.venda.updateMany({ where: { id: { in: vendas.map(v => v.id) } }, data: { pagamentoComissaoId: null } })
  // Recalcular é idempotente: se falhar no meio, a próxima ação refaz.
  for (const id of pagamentos) await recalcularPagamentoComissao(prisma, id)
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
