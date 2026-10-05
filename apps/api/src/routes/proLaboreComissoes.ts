// Pagamentos registrados a partir das vendas: o dono marca, direto na tabela
// de Vendas, quais comissões já pagou aos vendedores e quais pró-labores já
// retirou. Cada marcação vira um PagamentoComissao numerado (por conta e por
// tipo) — é ele que gera o comprovante impresso e assinado. Só o dono mexe
// aqui, igual ao cadastro de vendas.
//
// As rotas /comissoes/* são as originais (só comissão) e continuam valendo;
// /pagamentos-vendas/* recebem o `tipo` (COMISSAO | PROLABORE).
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth, requireDono } from '../middleware/authProLabore'
import { recalcularPagamentoComissao, CAMPO_PAGAMENTO, TIPOS_PAGAMENTO, valorDoPagamento, type TipoPagamento } from '../lib/comissoes'

const router = Router()

const FORMAS = ['PIX', 'DINHEIRO', 'TRANSFERENCIA', 'OUTRO'] as const
const NOME_TIPO: Record<TipoPagamento, { plural: string; ja: string }> = {
  COMISSAO: { plural: 'comissões', ja: 'Alguma dessas comissões já está marcada como paga' },
  PROLABORE: { plural: 'pró-labores', ja: 'Algum desses pró-labores já está marcado como pago' },
}

const registrarSchema = z.object({
  tipo: z.enum(TIPOS_PAGAMENTO).default('COMISSAO'),
  vendaIds: z.array(z.string().min(1)).min(1, 'Selecione pelo menos uma venda').max(500),
  pagoEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data do pagamento inválida'),
  formaPagamento: z.enum(FORMAS).nullable().optional(),
  observacao: z.string().max(500).nullable().optional(),
  pagador: z.string().max(120).nullable().optional(),
  recebedor: z.string().max(120).nullable().optional(),
})

const desmarcarSchema = z.object({
  tipo: z.enum(TIPOS_PAGAMENTO).default('COMISSAO'),
  vendaIds: z.array(z.string().min(1)).min(1).max(500),
})

const arred = (v: number) => Math.round(v * 100) / 100

const INCLUDE_RESUMO = {
  vendedor: { select: { id: true, nome: true } },
  _count: { select: { vendas: true, vendasProLabore: true } },
} satisfies Prisma.PagamentoComissaoInclude

// Achata a contagem das vendas no campo que a tela usa, seja qual for o tipo.
function resumo<T extends { tipo: string; _count: { vendas: number; vendasProLabore: number } }>(p: T) {
  const { _count, ...resto } = p
  return { ...resto, _count: { vendas: p.tipo === 'PROLABORE' ? _count.vendasProLabore : _count.vendas } }
}

// Marca como pagas as comissões (um comprovante por vendedor) ou os
// pró-labores (um comprovante só) das vendas escolhidas.
async function registrar(req: Request, res: Response) {
  const parse = registrarSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const { tipo } = parse.data
  const campo = CAMPO_PAGAMENTO[tipo]
  const usuarioId = req.proLaboreUser!.sub
  const ids = [...new Set(parse.data.vendaIds)]
  const vendas = await prisma.venda.findMany({
    where: { id: { in: ids }, usuarioId },
    select: { id: true, vendedorId: true, valorComissao: true, valorProLabore: true, pagamentoComissaoId: true, pagamentoProLaboreId: true },
  })
  if (vendas.length !== ids.length) {
    res.status(404).json({ error: 'Alguma das vendas não foi encontrada' })
    return
  }
  if (tipo === 'COMISSAO' && vendas.some(v => !v.vendedorId || !v.valorComissao)) {
    res.status(400).json({ error: 'Só dá pra marcar como paga a venda que tem vendedor e comissão' })
    return
  }
  if (tipo === 'PROLABORE' && vendas.some(v => !(v.valorProLabore > 0))) {
    res.status(400).json({ error: 'Só dá pra marcar como pago o pró-labore com valor maior que zero' })
    return
  }
  if (vendas.some(v => v[campo])) {
    res.status(409).json({ error: NOME_TIPO[tipo].ja })
    return
  }

  const dono = await prisma.proLaboreUsuario.findUnique({ where: { id: usuarioId }, select: { nome: true } })
  let pagador = parse.data.pagador?.trim() || ''
  let recebedor: string | null = null
  if (tipo === 'COMISSAO') {
    pagador ||= dono?.nome || ''
  } else {
    // Pró-labore: quem recebe é o dono; quem paga é a empresa — se não veio,
    // usa a da última retirada registrada.
    recebedor = parse.data.recebedor?.trim() || dono?.nome || ''
    if (!pagador) {
      const ultimo = await prisma.pagamentoComissao.findFirst({ where: { usuarioId, tipo }, orderBy: { criadoEm: 'desc' }, select: { pagador: true } })
      pagador = ultimo?.pagador ?? ''
    }
    if (!pagador) {
      res.status(400).json({ error: 'Informe quem paga o pró-labore (o nome da empresa) — é o que sai no recibo' })
      return
    }
  }

  // Comissão: um grupo por vendedor. Pró-labore: um grupo só.
  const grupos = new Map<string | null, typeof vendas>()
  for (const v of vendas) {
    const k = tipo === 'COMISSAO' ? v.vendedorId : null
    grupos.set(k, [...(grupos.get(k) ?? []), v])
  }

  // Sem transação interativa (no servidor ela tem limite de 5s e falhava com
  // o banco longe da API): cada comprovante é gravado num lote atômico só
  // (cria o pagamento + liga as vendas), e o número sequencial é garantido
  // pelo unique (usuarioId, tipo, numero) — se outro pagamento pegou o mesmo
  // número no meio do caminho, tenta o próximo.
  const pagoEm = new Date(`${parse.data.pagoEm}T12:00:00Z`)
  const observacao = parse.data.observacao?.trim() || null
  const criados: string[] = []
  let conflito = false
  try {
    for (const [vendedorId, lista] of grupos) {
      const id = randomUUID()
      const vendaIds = lista.map(v => v.id)
      for (let tentativa = 0; ; tentativa++) {
        const ultimo = await prisma.pagamentoComissao.aggregate({ where: { usuarioId, tipo }, _max: { numero: true } })
        try {
          const [, ligadas] = await prisma.$transaction([
            prisma.pagamentoComissao.create({
              data: {
                id, usuarioId, tipo, vendedorId, pagoEm, observacao, pagador, recebedor,
                numero: (ultimo._max.numero ?? 0) + 1,
                formaPagamento: parse.data.formaPagamento ?? null,
                valorTotal: arred(lista.reduce((s, v) => s + valorDoPagamento(tipo, v), 0)),
              },
            }),
            // [campo]: null protege contra duas abas marcando a mesma venda
            // ao mesmo tempo.
            prisma.venda.updateMany({ where: { id: { in: vendaIds }, usuarioId, [campo]: null }, data: { [campo]: id } }),
          ])
          if (ligadas.count !== vendaIds.length) {
            // Alguma venda foi marcada em outro lugar nesse meio-tempo:
            // desfaz este comprovante (fica cancelado, o número não volta).
            await prisma.venda.updateMany({ where: { [campo]: id }, data: { [campo]: null } })
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
    console.error('[pagamentos] falha ao registrar pagamento', { usuarioId, tipo, codigo, erro: e instanceof Error ? e.message : e })
    res.status(500).json({
      error: `Não deu pra registrar o pagamento agora (código ${codigo}).${criados.length ? ` ${criados.length} comprovante(s) já foram gravados — atualize a página.` : ' Nada foi gravado — tente de novo.'}`,
    })
    return
  }
  if (conflito && !criados.length) {
    res.status(409).json({ error: `Esses pagamentos acabaram de ser marcados em outro lugar. Atualize a página e tente de novo.` })
    return
  }

  const pagamentos = await prisma.pagamentoComissao.findMany({ where: { id: { in: criados } }, include: INCLUDE_RESUMO, orderBy: { numero: 'asc' } })
  res.status(201).json(pagamentos.map(resumo))
}

// Desmarca: as vendas voltam a "a pagar" e saem do comprovante (que fica
// cancelado se não sobrar nenhuma venda nele).
async function desmarcar(req: Request, res: Response) {
  const parse = desmarcarSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const campo = CAMPO_PAGAMENTO[parse.data.tipo]
  const usuarioId = req.proLaboreUser!.sub
  const vendas = await prisma.venda.findMany({
    where: { id: { in: parse.data.vendaIds }, usuarioId, [campo]: { not: null } },
    select: { id: true, pagamentoComissaoId: true, pagamentoProLaboreId: true },
  })
  const pagamentos = [...new Set(vendas.map(v => v[campo]!))]
  await prisma.venda.updateMany({ where: { id: { in: vendas.map(v => v.id) } }, data: { [campo]: null } })
  // Recalcular é idempotente: se falhar no meio, a próxima ação refaz.
  for (const id of pagamentos) await recalcularPagamentoComissao(prisma, id)
  res.json({ ok: true, desmarcadas: vendas.length })
}

async function listar(req: Request, res: Response) {
  const tipo = TIPOS_PAGAMENTO.includes(req.query.tipo as TipoPagamento) ? (req.query.tipo as TipoPagamento) : 'COMISSAO'
  const pagamentos = await prisma.pagamentoComissao.findMany({
    where: { usuarioId: req.proLaboreUser!.sub, tipo, canceladoEm: null },
    include: INCLUDE_RESUMO,
    orderBy: { numero: 'desc' },
  })
  res.json(pagamentos.map(resumo))
}

// Tudo que o comprovante precisa pra ser impresso. `vendas` vem sempre com
// `valor` = o que foi pago naquela venda (comissão ou pró-labore).
async function comprovante(req: Request, res: Response) {
  const VENDA = {
    select: { id: true, data: true, valorVenda: true, valorComissao: true, valorProLabore: true, observacao: true, lead: { select: { nomeCliente: true } } },
    orderBy: { data: 'asc' },
  } satisfies Prisma.PagamentoComissao$vendasArgs
  const pagamento = await prisma.pagamentoComissao.findFirst({
    where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub },
    include: { vendedor: { select: { id: true, nome: true } }, vendas: VENDA, vendasProLabore: VENDA },
  })
  if (!pagamento) {
    res.status(404).json({ error: 'Comprovante não encontrado' })
    return
  }
  const tipo = pagamento.tipo as TipoPagamento
  const { vendas, vendasProLabore, ...resto } = pagamento
  res.json({ ...resto, vendas: (tipo === 'PROLABORE' ? vendasProLabore : vendas).map(v => ({ ...v, valor: valorDoPagamento(tipo, v) })) })
}

router.post(['/pagamentos-vendas', '/comissoes/pagamentos'], requireProLaboreAuth, requireDono, registrar)
router.post(['/pagamentos-vendas/desmarcar', '/comissoes/desmarcar'], requireProLaboreAuth, requireDono, desmarcar)
router.get(['/pagamentos-vendas', '/comissoes/pagamentos'], requireProLaboreAuth, requireDono, listar)
router.get(['/pagamentos-vendas/:id', '/comissoes/pagamentos/:id'], requireProLaboreAuth, requireDono, comprovante)

export default router
