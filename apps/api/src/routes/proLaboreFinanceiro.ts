// Financeiro: pagamentos da operação que não saem das vendas (salário,
// adiantamento, bonificação, reembolso, investimento, custo e outros gastos).
// Cada pagamento vira um recibo numerado por conta e por categoria, impresso
// e assinado como o comprovante de comissão. "Pagar salários" é o mesmo
// fluxo do "marcar comissão como paga": escolhe as pessoas da equipe e sai
// um recibo para cada uma. Cancelar não apaga: o número não volta.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { nivelAtende, requireEscopoEquipe, requireModulo } from '../lib/acessos'

const router = Router()

export const CATEGORIAS = [
  { chave: 'SALARIO', rotulo: 'Salário', plural: 'Salários', equipe: true, titulo: 'Recibo de pagamento de salário', referente: 'ao salário' },
  { chave: 'ADIANTAMENTO', rotulo: 'Adiantamento (vale)', plural: 'Adiantamentos', equipe: true, titulo: 'Recibo de adiantamento salarial', referente: 'ao adiantamento salarial (vale)' },
  { chave: 'BONIFICACAO', rotulo: 'Bonificação', plural: 'Bonificações', equipe: true, titulo: 'Recibo de bonificação', referente: 'à bonificação' },
  { chave: 'REEMBOLSO', rotulo: 'Reembolso', plural: 'Reembolsos', equipe: true, titulo: 'Recibo de reembolso de despesas', referente: 'ao reembolso de despesas' },
  { chave: 'INVESTIMENTO', rotulo: 'Investimento', plural: 'Investimentos', equipe: false, titulo: 'Recibo de pagamento · investimento', referente: 'ao investimento' },
  { chave: 'CUSTO', rotulo: 'Custo', plural: 'Custos', equipe: false, titulo: 'Recibo de pagamento · custo', referente: 'ao custo' },
  { chave: 'OUTRO', rotulo: 'Outros gastos', plural: 'Outros gastos', equipe: false, titulo: 'Recibo de pagamento', referente: 'ao pagamento' },
] as const
type Categoria = (typeof CATEGORIAS)[number]['chave']
const CHAVES = CATEGORIAS.map(c => c.chave) as [Categoria, ...Categoria[]]
const FORMAS = ['PIX', 'DINHEIRO', 'TRANSFERENCIA', 'BOLETO', 'CARTAO', 'OUTRO'] as const
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const arred = (v: number) => Math.round(v * 100) / 100
const mesAtual = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7) // Belém (UTC-3)
const mesExtenso = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`
function intervaloDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number)
  return { gte: new Date(Date.UTC(a, m - 1, 1)), lt: new Date(Date.UTC(a, m, 1)) }
}
const mesSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês inválido')
const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data do pagamento inválida')
const ehProprio = (req: Request) => req.proLaboreUser!.papel === 'VENDEDOR'

interface Item { descricao: string; valor: number; desconto: boolean }
const totalDosItens = (itens: Item[]) => arred(itens.reduce((s, i) => s + (i.desconto ? -i.valor : i.valor), 0))

// Grava com o próximo número da categoria; o unique (usuarioId, categoria,
// numero) garante a sequência: se outro pagamento pegou o número, tenta o próximo.
async function criarNumerado(data: Omit<Prisma.LancamentoFinanceiroUncheckedCreateInput, 'numero'>) {
  for (let tentativa = 0; ; tentativa++) {
    const ultimo = await prisma.lancamentoFinanceiro.aggregate({ where: { usuarioId: data.usuarioId, categoria: data.categoria }, _max: { numero: true } })
    try {
      return await prisma.lancamentoFinanceiro.create({ data: { ...data, numero: (ultimo._max.numero ?? 0) + 1 } })
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') || tentativa >= 4) throw e
    }
  }
}

// Nome da empresa que sai como "quem paga": o do último recibo do Financeiro
// ou, sem nenhum ainda, o do último recibo de pró-labore.
async function ultimoPagador(usuarioId: string) {
  const [fin, pl] = await Promise.all([
    prisma.lancamentoFinanceiro.findFirst({ where: { usuarioId }, orderBy: { criadoEm: 'desc' }, select: { pagador: true } }),
    prisma.pagamentoComissao.findFirst({ where: { usuarioId, tipo: 'PROLABORE' }, orderBy: { criadoEm: 'desc' }, select: { pagador: true } }),
  ])
  return fin?.pagador ?? pl?.pagador ?? ''
}

const SELECT_LISTA = {
  id: true, categoria: true, numero: true, vendedorId: true, favorecido: true, documento: true, pagador: true, descricao: true,
  competencia: true, itens: true, valorTotal: true, pagoEm: true, formaPagamento: true, observacao: true, canceladoEm: true, criadoEm: true,
} satisfies Prisma.LancamentoFinanceiroSelect

router.get('/financeiro', requireProLaboreAuth, requireModulo('financeiro', 'VER'), async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const mes = mesSchema.safeParse(req.query.mes).success ? String(req.query.mes) : mesAtual()
  const pagoEm = intervaloDoMes(mes)
  const proprio = ehProprio(req)
  const lancamentos = await prisma.lancamentoFinanceiro.findMany({
    where: { usuarioId, pagoEm, ...(proprio ? { vendedorId: req.proLaboreUser!.vendedorId } : {}) },
    select: SELECT_LISTA,
    orderBy: [{ pagoEm: 'desc' }, { criadoEm: 'desc' }],
  })
  const porCategoria = Object.fromEntries(CATEGORIAS.map(c => [c.chave, 0])) as Record<Categoria, number>
  for (const l of lancamentos) if (!l.canceladoEm) porCategoria[l.categoria as Categoria] = arred(porCategoria[l.categoria as Categoria] + l.valorTotal)
  const total = arred(Object.values(porCategoria).reduce((s, v) => s + v, 0))
  // O que saiu pela tela de Vendas no mesmo mês, para a visão completa do caixa.
  let vendas: { comissoes: number; proLabore: number } | null = null
  if (!proprio && nivelAtende(req.acessos?.vendas, 'VER')) {
    const pagos = await prisma.pagamentoComissao.groupBy({ by: ['tipo'], where: { usuarioId, pagoEm, canceladoEm: null }, _sum: { valorTotal: true } })
    const soma = (t: string) => arred(pagos.find(p => p.tipo === t)?._sum.valorTotal ?? 0)
    vendas = { comissoes: soma('COMISSAO'), proLabore: soma('PROLABORE') }
  }
  const equipe = proprio ? [] : await prisma.vendedor.findMany({
    where: { usuarioId, ativo: true }, select: { id: true, nome: true, vende: true, salarioBase: true }, orderBy: { nome: 'asc' },
  })
  res.json({
    mes, categorias: CATEGORIAS, formas: FORMAS, lancamentos, totais: { porCategoria, total }, vendas, equipe,
    pagador: proprio ? '' : await ultimoPagador(usuarioId),
    podeEditar: req.proLaboreUser!.papel === 'DONO' || (!proprio && nivelAtende(req.acessos?.financeiro, 'EDITAR')),
  })
})

const itemSchema = z.object({
  descricao: z.string().trim().min(1, 'Descreva cada linha do recibo').max(120),
  valor: z.number().positive('Cada linha precisa de um valor maior que zero'),
  desconto: z.boolean().default(false),
})
const comumSchema = {
  pagoEm: dataSchema,
  formaPagamento: z.enum(FORMAS).nullable().optional(),
  pagador: z.string().trim().min(2, 'Informe quem paga (o nome da empresa): é o que sai no recibo').max(120),
  observacao: z.string().trim().max(500).nullable().optional(),
}
const criarSchema = z.object({
  categoria: z.enum(CHAVES),
  vendedorId: z.string().nullable().optional(),
  favorecido: z.string().trim().max(120).nullable().optional(),
  documento: z.string().trim().max(30).nullable().optional(),
  descricao: z.string().trim().max(200).nullable().optional(),
  competencia: mesSchema.nullable().optional(),
  itens: z.array(itemSchema).min(1, 'Inclua pelo menos uma linha no recibo').max(30),
  ...comumSchema,
})

router.post('/financeiro', requireProLaboreAuth, requireModulo('financeiro', 'EDITAR'), requireEscopoEquipe, async (req: Request, res: Response) => {
  const parse = criarSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const d = parse.data
  const usuarioId = req.proLaboreUser!.sub
  const cat = CATEGORIAS.find(c => c.chave === d.categoria)!
  let favorecido = d.favorecido?.trim() || ''
  if (d.vendedorId) {
    const v = await prisma.vendedor.findFirst({ where: { id: d.vendedorId, usuarioId }, select: { nome: true } })
    if (!v) { res.status(404).json({ error: 'Pessoa da equipe não encontrada' }); return }
    favorecido ||= v.nome
  }
  if (favorecido.length < 2) { res.status(400).json({ error: 'Informe quem recebe: é o nome que sai no recibo' }); return }
  const competencia = d.competencia ?? (cat.chave === 'SALARIO' || cat.chave === 'ADIANTAMENTO' ? d.pagoEm.slice(0, 7) : null)
  const descricao = d.descricao?.trim()
    || (cat.chave === 'SALARIO' ? `Salário de ${mesExtenso(competencia!)}` : cat.chave === 'ADIANTAMENTO' ? `Adiantamento salarial de ${mesExtenso(competencia!)}` : '')
  if (!descricao) { res.status(400).json({ error: 'Diga a que se refere o pagamento (ex.: aluguel da loja de outubro)' }); return }
  const valorTotal = totalDosItens(d.itens)
  if (valorTotal <= 0) { res.status(400).json({ error: 'Os descontos não podem ser maiores que o valor a pagar' }); return }
  if (cat.chave === 'SALARIO' && d.vendedorId) {
    const ja = await prisma.lancamentoFinanceiro.findFirst({ where: { usuarioId, categoria: 'SALARIO', vendedorId: d.vendedorId, competencia, canceladoEm: null }, select: { numero: true } })
    if (ja) { res.status(409).json({ error: `${favorecido} já tem recibo de salário de ${mesExtenso(competencia!)} (nº ${ja.numero}). Cancele esse recibo antes de pagar de novo.` }); return }
  }
  const l = await criarNumerado({
    usuarioId, categoria: cat.chave, vendedorId: d.vendedorId || null, favorecido, documento: d.documento?.trim() || null,
    pagador: d.pagador, descricao, competencia, itens: d.itens as unknown as Prisma.InputJsonValue, valorTotal,
    pagoEm: new Date(`${d.pagoEm}T12:00:00Z`), formaPagamento: d.formaPagamento ?? null, observacao: d.observacao?.trim() || null,
  })
  res.status(201).json(l)
})

// --- Pagar salários (várias pessoas de uma vez, um recibo para cada) ---

router.get('/financeiro/salarios', requireProLaboreAuth, requireModulo('financeiro', 'EDITAR'), requireEscopoEquipe, async (req: Request, res: Response) => {
  const usuarioId = req.proLaboreUser!.sub
  const competencia = mesSchema.safeParse(req.query.competencia).success ? String(req.query.competencia) : mesAtual()
  const [equipe, pagos] = await Promise.all([
    prisma.vendedor.findMany({ where: { usuarioId, ativo: true }, select: { id: true, nome: true, vende: true, salarioBase: true }, orderBy: { nome: 'asc' } }),
    prisma.lancamentoFinanceiro.findMany({ where: { usuarioId, categoria: 'SALARIO', competencia, canceladoEm: null, vendedorId: { not: null } }, select: { id: true, numero: true, valorTotal: true, vendedorId: true } }),
  ])
  res.json({
    competencia, pagador: await ultimoPagador(usuarioId),
    equipe: equipe.map(v => ({ ...v, pago: pagos.find(p => p.vendedorId === v.id) ?? null })),
  })
})

const salariosSchema = z.object({
  competencia: mesSchema,
  lembrar: z.boolean().default(true),
  pagamentos: z.array(z.object({ vendedorId: z.string().min(1), valor: z.number().positive('Informe o salário de cada pessoa marcada') })).min(1, 'Marque pelo menos uma pessoa').max(200),
  ...comumSchema,
})

router.post('/financeiro/salarios', requireProLaboreAuth, requireModulo('financeiro', 'EDITAR'), requireEscopoEquipe, async (req: Request, res: Response) => {
  const parse = salariosSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  const d = parse.data
  const usuarioId = req.proLaboreUser!.sub
  const ids = [...new Set(d.pagamentos.map(p => p.vendedorId))]
  if (ids.length !== d.pagamentos.length) { res.status(400).json({ error: 'A mesma pessoa aparece duas vezes' }); return }
  const pessoas = await prisma.vendedor.findMany({ where: { id: { in: ids }, usuarioId }, select: { id: true, nome: true } })
  if (pessoas.length !== ids.length) { res.status(404).json({ error: 'Alguma pessoa não foi encontrada na equipe' }); return }
  const ja = await prisma.lancamentoFinanceiro.findMany({ where: { usuarioId, categoria: 'SALARIO', competencia: d.competencia, vendedorId: { in: ids }, canceladoEm: null }, select: { numero: true, favorecido: true } })
  if (ja.length) {
    res.status(409).json({ error: `Já existe recibo de salário de ${mesExtenso(d.competencia)} para ${ja.map(j => `${j.favorecido} (nº ${j.numero})`).join(', ')}. Desmarque ${ja.length > 1 ? 'essas pessoas' : 'essa pessoa'} ou cancele o recibo antes.` })
    return
  }
  const descricao = `Salário de ${mesExtenso(d.competencia)}`
  const criados = []
  for (const p of d.pagamentos) {
    const pessoa = pessoas.find(x => x.id === p.vendedorId)!
    const valor = arred(p.valor)
    criados.push(await criarNumerado({
      usuarioId, categoria: 'SALARIO', vendedorId: pessoa.id, favorecido: pessoa.nome, pagador: d.pagador, descricao, competencia: d.competencia,
      itens: [{ descricao, valor, desconto: false }] as unknown as Prisma.InputJsonValue, valorTotal: valor,
      pagoEm: new Date(`${d.pagoEm}T12:00:00Z`), formaPagamento: d.formaPagamento ?? null, observacao: d.observacao?.trim() || null,
    }))
    if (d.lembrar) await prisma.vendedor.update({ where: { id: pessoa.id }, data: { salarioBase: valor } })
  }
  res.status(201).json(criados)
})

// --- Recibo e cancelamento ---

router.get('/financeiro/:id', requireProLaboreAuth, requireModulo('financeiro', 'VER'), async (req: Request, res: Response) => {
  const l = await prisma.lancamentoFinanceiro.findFirst({
    where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub, ...(ehProprio(req) ? { vendedorId: req.proLaboreUser!.vendedorId } : {}) },
    select: SELECT_LISTA,
  })
  if (!l) { res.status(404).json({ error: 'Recibo não encontrado' }); return }
  res.json({ ...l, categoriaInfo: CATEGORIAS.find(c => c.chave === l.categoria) })
})

router.post('/financeiro/:id/cancelar', requireProLaboreAuth, requireModulo('financeiro', 'EDITAR'), requireEscopoEquipe, async (req: Request, res: Response) => {
  const l = await prisma.lancamentoFinanceiro.findFirst({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub }, select: { id: true, canceladoEm: true } })
  if (!l) { res.status(404).json({ error: 'Recibo não encontrado' }); return }
  if (l.canceladoEm) { res.status(409).json({ error: 'Esse recibo já está cancelado' }); return }
  res.json(await prisma.lancamentoFinanceiro.update({ where: { id: l.id }, data: { canceladoEm: new Date() }, select: SELECT_LISTA }))
})

export default router
