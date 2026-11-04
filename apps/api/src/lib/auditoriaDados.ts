// Auditoria dos dados (Configurações): confere, mês a mês, se vendas, recibos,
// lançamentos do Financeiro e leads ficaram repetidos depois da importação do
// banco antigo (Neon). O caso típico: a mesma venda lançada de novo no sistema
// novo, com o mesmo valor e, às vezes, outra data (até em outro mês). A
// importação trouxe a do banco antigo e o mês passou a somar as duas.
//
// - Registro "do banco antigo" = id que veio na seleção da importação.
// - Par repetido = um do banco antigo e um lançado aqui, mesmo valor (e mesma
//   vendedora/favorecido), até 45 dias de diferença. Fica o lançado aqui; o do
//   banco antigo sai. O que só o antigo tinha (recibo de pagamento, lead ligado,
//   a data, se você escolher) passa para o que fica.
// - Mesmo dia, valor e vendedora dentro do mesmo banco: só "conferir" (podem
//   ser duas vendas de verdade), nunca vem marcado.
// - Nada é apagado sem cópia: cada correção guarda o que tirou e o que mudou,
//   e dá para desfazer.
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

export class ErroAuditoria extends Error { constructor(readonly status: number, message: string) { super(message) } }

export type TipoAchado = 'vendas' | 'pagamentos' | 'financeiro' | 'leads'
const TABELA: Record<TipoAchado, string> = {
  vendas: 'pro_labore_vendas',
  pagamentos: 'pro_labore_pagamentos_comissao',
  financeiro: 'pro_labore_lancamentos_financeiros',
  leads: 'pro_labore_leads',
}
const ORDEM: TipoAchado[] = ['vendas', 'pagamentos', 'financeiro', 'leads']
const JANELA_DIAS = 45

export interface RegistroAuditoria { id: string; data: string; valor: number; rotulo: string; detalhe: string | null; antigo: boolean }
export interface Achado {
  chave: string
  tipo: TipoAchado
  remover: RegistroAuditoria
  manter: RegistroAuditoria | null
  motivo: string
  confianca: 'alta' | 'media' | 'conferir'
  sugerido: boolean
  diasDiferenca: number
  mesRemovido: string
  mesMantido: string | null
}
export interface MesAuditoria {
  mes: string
  vendas: number; receita: number; proLabore: number; comissao: number
  vendasAntigas: number
  repetidas: number; receitaRepetida: number
  receitaCorrigida: number; proLaboreCorrigido: number; comissaoCorrigida: number; vendasCorrigidas: number
  leads: number; leadsRepetidos: number
}

const q = (n: string) => `"${n.replace(/"/g, '""')}"`
const centavos = (n: number) => Math.round(n * 100)
const dias = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 86_400_000
const mesDe = (d: Date) => d.toISOString().slice(0, 7)
const diaDe = (d: Date) => d.toISOString().slice(0, 10)
const norm = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ')
/** Telefone comparável: só dígitos, sem o 55 do Brasil e sem o nono dígito. */
export function telefoneCanonico(t: string | null | undefined) {
  let d = (t ?? '').replace(/\D/g, '')
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2)
  if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3)
  return d.length >= 8 ? d : null
}

async function idsAntigos(usuarioId: string) {
  const imp = await prisma.importacaoNeon.findUnique({ where: { usuarioId }, select: { estado: true } })
  const sel = ((imp?.estado as { selecao?: Record<string, string[]> } | null)?.selecao) ?? {}
  return { conhecida: !!imp, de: (t: TipoAchado) => new Set(sel[TABELA[t]] ?? []) }
}

/** Liga cada registro do banco antigo ao lançado aqui mais parecido (um para um, o mais próximo primeiro). */
function parear<T extends { id: string; quando: Date; antigo: boolean }>(lista: T[], grupo: (x: T) => string, compativel: (a: T, n: T) => boolean, mesmoDono: (a: T, n: T) => boolean) {
  const porGrupo = new Map<string, T[]>()
  for (const x of lista) { const g = grupo(x); if (!porGrupo.has(g)) porGrupo.set(g, []); porGrupo.get(g)!.push(x) }
  const pares: Array<{ a: T; n: T; d: number; dono: boolean }> = []
  for (const itens of porGrupo.values()) {
    if (itens.length < 2) continue
    const antigas = itens.filter(x => x.antigo), novas = itens.filter(x => !x.antigo)
    const cands: typeof pares = []
    for (const a of antigas) for (const n of novas) {
      const d = dias(a.quando, n.quando)
      if (d <= JANELA_DIAS && compativel(a, n)) cands.push({ a, n, d, dono: mesmoDono(a, n) })
    }
    cands.sort((x, y) => Number(y.dono) - Number(x.dono) || x.d - y.d)
    const usados = new Set<string>()
    for (const c of cands) {
      if (usados.has(c.a.id) || usados.has(c.n.id)) continue
      usados.add(c.a.id); usados.add(c.n.id); pares.push(c)
    }
  }
  return pares
}

const quantosDias = (d: number) => (d < 1 ? 'no mesmo dia' : `${Math.round(d)} dia${Math.round(d) === 1 ? '' : 's'} de diferença`)

export async function auditarDados(usuarioId: string) {
  const origem = await idsAntigos(usuarioId)
  const antigos = Object.fromEntries(ORDEM.map(t => [t, origem.de(t)])) as Record<TipoAchado, Set<string>>
  const [vendas, pagamentos, lancamentos, leads] = await Promise.all([
    prisma.venda.findMany({ where: { usuarioId }, select: { id: true, data: true, valorVenda: true, valorProLabore: true, valorComissao: true, vendedorId: true, observacao: true, pagamentoComissaoId: true, pagamentoProLaboreId: true, criadoEm: true, vendedor: { select: { nome: true } }, lead: { select: { id: true } } } }),
    prisma.pagamentoComissao.findMany({ where: { usuarioId, canceladoEm: null }, select: { id: true, tipo: true, numero: true, pagoEm: true, valorTotal: true, vendedorId: true, recebedor: true, vendedor: { select: { nome: true } } } }),
    prisma.lancamentoFinanceiro.findMany({ where: { usuarioId, canceladoEm: null }, select: { id: true, categoria: true, numero: true, pagoEm: true, valorTotal: true, favorecido: true, vendedorId: true, descricao: true } }),
    prisma.lead.findMany({ where: { usuarioId }, select: { id: true, nomeCliente: true, telefone: true, criadoEm: true, estagio: true, vendaId: true } }),
  ])
  const achados: Achado[] = []

  // Vendas
  const vs = vendas.map(v => ({ ...v, quando: v.data, antigo: antigos.vendas.has(v.id) }))
  const regVenda = (v: (typeof vs)[number]): RegistroAuditoria => ({ id: v.id, data: v.data.toISOString(), valor: v.valorVenda, rotulo: v.vendedor?.nome ?? 'Sem vendedor', detalhe: v.observacao, antigo: v.antigo })
  // Vendedor: mesmo cadastro ou mesmo nome (a vendedora pode ter ficado com dois cadastros); diferente também entra, como provável.
  const mesmoVendedor = (a: (typeof vs)[number], n: (typeof vs)[number]) => !a.vendedorId || !n.vendedorId || a.vendedorId === n.vendedorId || norm(a.vendedor?.nome) === norm(n.vendedor?.nome)
  const paresVendas = parear(vs, v => String(centavos(v.valorVenda)), () => true, mesmoVendedor)
  const emPar = new Set<string>()
  for (const p of paresVendas) {
    emPar.add(p.a.id); emPar.add(p.n.id)
    const outroMes = mesDe(p.a.data) !== mesDe(p.n.data)
    const alta = p.d <= 3 && p.dono && !outroMes
    achados.push({
      chave: `vendas:${p.a.id}:${p.n.id}`, tipo: 'vendas', remover: regVenda(p.a), manter: regVenda(p.n),
      motivo: `Mesma venda no banco antigo e lançada aqui: mesmo valor${p.dono ? ' e vendedor' : ', mas vendedor diferente'}, ${quantosDias(p.d)}${outroMes ? ' (em outro mês)' : ''}.`,
      confianca: alta ? 'alta' : 'media', sugerido: true, diasDiferenca: Math.round(p.d), mesRemovido: mesDe(p.a.data), mesMantido: mesDe(p.n.data),
    })
  }
  // Dentro do mesmo banco: mesmo dia, valor e vendedor (só para conferir).
  const porDia = new Map<string, typeof vs>()
  for (const v of vs) {
    if (emPar.has(v.id)) continue
    const k = `${diaDe(v.data)}|${centavos(v.valorVenda)}|${v.vendedorId ?? ''}|${v.antigo}`
    if (!porDia.has(k)) porDia.set(k, []); porDia.get(k)!.push(v)
  }
  for (const grupo of porDia.values()) {
    if (grupo.length < 2) continue
    const [primeira, ...resto] = [...grupo].sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime())
    for (const v of resto) achados.push({
      chave: `vendas:${v.id}:${primeira.id}`, tipo: 'vendas', remover: regVenda(v), manter: regVenda(primeira),
      motivo: `Duas vendas no mesmo dia, mesmo valor e mesmo vendedor, ${v.antigo ? 'ambas do banco antigo' : 'ambas lançadas aqui'}. Podem ser duas motos de verdade: confira antes de marcar.`,
      confianca: 'conferir', sugerido: false, diasDiferenca: 0, mesRemovido: mesDe(v.data), mesMantido: mesDe(primeira.data),
    })
  }

  // Recibos de comissão e pró-labore
  const ps = pagamentos.map(p => ({ ...p, quando: p.pagoEm, antigo: antigos.pagamentos.has(p.id) }))
  const regPag = (p: (typeof ps)[number]): RegistroAuditoria => ({ id: p.id, data: p.pagoEm.toISOString(), valor: p.valorTotal, rotulo: `${p.tipo === 'PROLABORE' ? 'Pró-labore' : 'Comissão'} nº ${p.numero}`, detalhe: p.vendedor?.nome ?? p.recebedor ?? null, antigo: p.antigo })
  for (const p of parear(ps, x => `${x.tipo}|${x.vendedorId ?? ''}|${centavos(x.valorTotal)}`, () => true, () => true)) {
    achados.push({
      chave: `pagamentos:${p.a.id}:${p.n.id}`, tipo: 'pagamentos', remover: regPag(p.a), manter: regPag(p.n),
      motivo: `Mesmo recibo no banco antigo e lançado aqui: mesmo tipo, valor e ${p.a.vendedorId ? 'vendedor' : 'recebedor'}, ${quantosDias(p.d)}. As vendas do antigo passam para o que fica.`,
      confianca: p.d <= 3 ? 'alta' : 'media', sugerido: true, diasDiferenca: Math.round(p.d), mesRemovido: mesDe(p.a.pagoEm), mesMantido: mesDe(p.n.pagoEm),
    })
  }

  // Financeiro
  const fs = lancamentos.map(l => ({ ...l, quando: l.pagoEm, antigo: antigos.financeiro.has(l.id) }))
  const regFin = (l: (typeof fs)[number]): RegistroAuditoria => ({ id: l.id, data: l.pagoEm.toISOString(), valor: l.valorTotal, rotulo: `${l.favorecido} · recibo nº ${l.numero}`, detalhe: l.descricao, antigo: l.antigo })
  for (const p of parear(fs, x => `${x.categoria}|${centavos(x.valorTotal)}`, (a, n) => norm(a.favorecido) === norm(n.favorecido) || (!!a.vendedorId && a.vendedorId === n.vendedorId), () => true)) {
    achados.push({
      chave: `financeiro:${p.a.id}:${p.n.id}`, tipo: 'financeiro', remover: regFin(p.a), manter: regFin(p.n),
      motivo: `Mesmo pagamento no banco antigo e lançado aqui: mesma categoria, valor e favorecido, ${quantosDias(p.d)}.`,
      confianca: p.d <= 3 ? 'alta' : 'media', sugerido: true, diasDiferenca: Math.round(p.d), mesRemovido: mesDe(p.a.pagoEm), mesMantido: mesDe(p.n.pagoEm),
    })
  }

  // Leads: o mesmo telefone escrito de outro jeito (a importação só casou o telefone idêntico).
  const ls = leads.map(l => ({ ...l, quando: l.criadoEm, antigo: antigos.leads.has(l.id), tel: telefoneCanonico(l.telefone) })).filter(l => l.tel)
  const regLead = (l: (typeof ls)[number]): RegistroAuditoria => ({ id: l.id, data: l.criadoEm.toISOString(), valor: 0, rotulo: l.nomeCliente, detalhe: l.telefone, antigo: l.antigo })
  for (const p of parear(ls, x => x.tel!, () => true, () => true)) {
    achados.push({
      chave: `leads:${p.a.id}:${p.n.id}`, tipo: 'leads', remover: regLead(p.a), manter: regLead(p.n),
      motivo: `Mesmo telefone (escrito de outro jeito) no banco antigo e cadastrado aqui, ${quantosDias(p.d)}. As notas, follows, ligações e conversas do antigo passam para o que fica.`,
      confianca: 'alta', sugerido: true, diasDiferenca: Math.round(p.d), mesRemovido: mesDe(p.a.criadoEm), mesMantido: mesDe(p.n.criadoEm),
    })
  }

  // Mês a mês (as mesmas contas do Dashboard: receita, pró-labore e comissão pela data da venda; leads pela criação).
  const meses = new Map<string, MesAuditoria>()
  const mes = (m: string) => {
    if (!meses.has(m)) meses.set(m, { mes: m, vendas: 0, receita: 0, proLabore: 0, comissao: 0, vendasAntigas: 0, repetidas: 0, receitaRepetida: 0, receitaCorrigida: 0, proLaboreCorrigido: 0, comissaoCorrigida: 0, vendasCorrigidas: 0, leads: 0, leadsRepetidos: 0 })
    return meses.get(m)!
  }
  const sairao = new Set(achados.filter(a => a.sugerido).map(a => a.remover.id))
  for (const v of vs) {
    const m = mes(mesDe(v.data))
    m.vendas++; m.receita += v.valorVenda; m.proLabore += v.valorProLabore; m.comissao += v.valorComissao ?? 0
    if (v.antigo) m.vendasAntigas++
    if (sairao.has(v.id)) { m.repetidas++; m.receitaRepetida += v.valorVenda }
    else { m.vendasCorrigidas++; m.receitaCorrigida += v.valorVenda; m.proLaboreCorrigido += v.valorProLabore; m.comissaoCorrigida += v.valorComissao ?? 0 }
  }
  for (const l of leads) { const m = mes(mesDe(l.criadoEm)); m.leads++; if (sairao.has(l.id)) m.leadsRepetidos++ }
  const arred = (n: number) => Math.round(n * 100) / 100
  const listaMeses = [...meses.values()].sort((a, b) => b.mes.localeCompare(a.mes)).map(m => ({ ...m, receita: arred(m.receita), proLabore: arred(m.proLabore), comissao: arred(m.comissao), receitaRepetida: arred(m.receitaRepetida), receitaCorrigida: arred(m.receitaCorrigida), proLaboreCorrigido: arred(m.proLaboreCorrigido), comissaoCorrigida: arred(m.comissaoCorrigida) }))

  const ultima = await prisma.correcaoAuditoria.findFirst({ where: { usuarioId, desfeitaEm: null }, orderBy: { criadoEm: 'desc' }, select: { id: true, criadoEm: true, quantidade: true } })
  achados.sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo) || b.mesRemovido.localeCompare(a.mesRemovido) || b.remover.valor - a.remover.valor)
  return {
    origemConhecida: origem.conhecida,
    geradoEm: new Date().toISOString(),
    resumo: Object.fromEntries(ORDEM.map(t => [t, { total: achados.filter(a => a.tipo === t).length, sugeridos: achados.filter(a => a.tipo === t && a.sugerido).length }])) as Record<TipoAchado, { total: number; sugeridos: number }>,
    meses: listaMeses,
    achados,
    ultimaCorrecao: ultima && ultima.quantidade > 0 ? ultima : null,
  }
}

// --- Correção (com cópia para desfazer) ---

type Tx = Prisma.TransactionClient
interface Backup {
  removidos: Array<{ tabela: string; linha: Record<string, unknown> }>
  alterados: Array<{ tabela: string; ids: string[]; coluna: string; antes: unknown }>
  desfeitoAte?: number
}

async function linhaDe(tx: Tx, tabela: string, id: string) {
  const [r] = await tx.$queryRawUnsafe<Array<{ j: Record<string, unknown> }>>(`SELECT row_to_json(x) AS j FROM ${q(tabela)} x WHERE id = $1`, id)
  return r?.j ?? null
}
/** Muda uma coluna guardando o valor anterior (tipo da coluna resolvido pelo próprio banco). */
async function alterar(tx: Tx, b: Backup, tabela: string, ids: string[], coluna: string, novo: unknown, antes: unknown) {
  if (!ids.length) return
  b.alterados.push({ tabela, ids, coluna, antes })
  await tx.$executeRawUnsafe(`UPDATE ${q(tabela)} SET ${q(coluna)} = (json_populate_record(NULL::${q(tabela)}, json_build_object($1::text, $2::json))).${q(coluna)} WHERE id::text = ANY($3::text[])`, coluna, JSON.stringify(novo ?? null), ids)
}
async function remover(tx: Tx, b: Backup, tabela: string, id: string) {
  const linha = await linhaDe(tx, tabela, id)
  if (!linha) throw new Error('registro não encontrado')
  b.removidos.push({ tabela, linha })
  await tx.$executeRawUnsafe(`DELETE FROM ${q(tabela)} WHERE id = $1`, id)
}
/** Tabelas que apontam para os leads (descobertas no banco: notas, follows, ligações, conversas, histórico…). */
async function filhosDeLead(tx: Tx) {
  return tx.$queryRawUnsafe<Array<{ tabela: string; coluna: string; unica: boolean }>>(`
    SELECT c.conrelid::regclass::text AS tabela, a.attname AS coluna,
      EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND i.indisunique AND i.indnatts = 1 AND i.indkey[0] = a.attnum) AS unica
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = 'pro_labore_leads'::regclass AND c.conrelid <> 'pro_labore_leads'::regclass`)
}

async function corrigirUm(tx: Tx, b: Backup, a: Achado, usarDataAntiga: boolean) {
  const x = a.remover.id, k = a.manter?.id
  if (a.tipo === 'vendas') {
    const [rx, rk] = await Promise.all([
      tx.venda.findUnique({ where: { id: x }, select: { data: true, pagamentoComissaoId: true, pagamentoProLaboreId: true, lead: { select: { id: true } } } }),
      k ? tx.venda.findUnique({ where: { id: k }, select: { data: true, pagamentoComissaoId: true, pagamentoProLaboreId: true, lead: { select: { id: true } } } }) : null,
    ])
    if (!rx) throw new Error('a venda já não existe')
    if (rk && k) {
      // O que só a do banco antigo tinha passa para a que fica.
      if (rx.pagamentoComissaoId && !rk.pagamentoComissaoId) await alterar(tx, b, TABELA.vendas, [k], 'pagamentoComissaoId', rx.pagamentoComissaoId, null)
      if (rx.pagamentoProLaboreId && !rk.pagamentoProLaboreId) await alterar(tx, b, TABELA.vendas, [k], 'pagamentoProLaboreId', rx.pagamentoProLaboreId, null)
      if (rx.lead && !rk.lead) await alterar(tx, b, TABELA.leads, [rx.lead.id], 'vendaId', k, x)
      if (usarDataAntiga && rx.data.getTime() !== rk.data.getTime()) await alterar(tx, b, TABELA.vendas, [k], 'data', rx.data.toISOString(), rk.data.toISOString())
    }
    if (rx.lead && (!rk || rk.lead)) await alterar(tx, b, TABELA.leads, [rx.lead.id], 'vendaId', null, x)
    await remover(tx, b, TABELA.vendas, x)
  } else if (a.tipo === 'pagamentos') {
    for (const coluna of ['pagamentoComissaoId', 'pagamentoProLaboreId']) {
      const ids = (await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM pro_labore_vendas WHERE ${q(coluna)} = $1`, x)).map(r => r.id)
      await alterar(tx, b, TABELA.vendas, ids, coluna, k ?? null, x)
    }
    await remover(tx, b, TABELA.pagamentos, x)
  } else if (a.tipo === 'financeiro') {
    await remover(tx, b, TABELA.financeiro, x)
  } else {
    if (!k) throw new Error('lead sem correspondente')
    const [rx, rk] = await Promise.all([
      tx.lead.findUnique({ where: { id: x }, select: { vendaId: true, criadoEm: true } }),
      tx.lead.findUnique({ where: { id: k }, select: { vendaId: true, criadoEm: true } }),
    ])
    if (!rx || !rk) throw new Error('o lead já não existe')
    for (const f of await filhosDeLead(tx)) {
      const ids = (await tx.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id::text AS id FROM ${q(f.tabela)} WHERE ${q(f.coluna)} = $1`, x)).map(r => r.id)
      if (!ids.length) continue
      if (f.unica) {
        const ocupado = await tx.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM ${q(f.tabela)} WHERE ${q(f.coluna)} = $1 LIMIT 1`, k)
        // O que fica já tem o seu: o do antigo fica solto (sem lead), guardado para desfazer.
        if (ocupado.length) { await alterar(tx, b, f.tabela, ids, f.coluna, null, x); continue }
      }
      await alterar(tx, b, f.tabela, ids, f.coluna, k, x)
    }
    if (rx.vendaId && !rk.vendaId) {
      await alterar(tx, b, TABELA.leads, [x], 'vendaId', null, rx.vendaId)
      await alterar(tx, b, TABELA.leads, [k], 'vendaId', rx.vendaId, null)
    }
    // O lead conta no mês em que chegou pela primeira vez.
    if (rx.criadoEm < rk.criadoEm) await alterar(tx, b, TABELA.leads, [k], 'criadoEm', rx.criadoEm.toISOString(), rk.criadoEm.toISOString())
    await remover(tx, b, TABELA.leads, x)
  }
}

export async function corrigirDados(usuarioId: string, entrada: { chaves: string[]; dataAntiga?: string[]; correcaoId?: string | null }, prazoMs = 12_000) {
  const inicio = Date.now()
  const pedidas = new Set(entrada.chaves)
  const dataAntiga = new Set(entrada.dataAntiga ?? [])
  const { achados } = await auditarDados(usuarioId)
  const fila = achados.filter(a => pedidas.has(a.chave))
  // Revisão manual: vendas que você escolheu tirar na lista do mês (sem par).
  const manuais = [...pedidas].filter(c => c.startsWith('manual:vendas:')).map(c => c.slice('manual:vendas:'.length))
  if (manuais.length) {
    const existem = await prisma.venda.findMany({ where: { usuarioId, id: { in: manuais } }, select: { id: true, data: true, valorVenda: true } })
    const jaNaFila = new Set(fila.map(a => a.remover.id))
    for (const v of existem) if (!jaNaFila.has(v.id)) fila.push({ chave: `manual:vendas:${v.id}`, tipo: 'vendas', remover: { id: v.id, data: v.data.toISOString(), valor: v.valorVenda, rotulo: '', detalhe: null, antigo: false }, manter: null, motivo: 'Escolhida na revisão do mês', confianca: 'conferir', sugerido: false, diasDiferenca: 0, mesRemovido: mesDe(v.data), mesMantido: null })
  }
  let correcao = entrada.correcaoId ? await prisma.correcaoAuditoria.findFirst({ where: { id: entrada.correcaoId, usuarioId, desfeitaEm: null } }) : null
  correcao ??= await prisma.correcaoAuditoria.create({ data: { usuarioId, backup: { removidos: [], alterados: [] } } })
  const backup = correcao.backup as unknown as Backup
  let feitos = 0
  const falhas: Array<{ chave: string; erro: string }> = []
  const feitas = new Set<string>()
  for (const a of fila) {
    if (feitos + falhas.length > 0 && Date.now() - inicio > prazoMs) break
    const b: Backup = { removidos: [], alterados: [] }
    try {
      await prisma.$transaction(tx => corrigirUm(tx, b, a, dataAntiga.has(a.chave)), { timeout: 15_000 })
      backup.removidos.push(...b.removidos); backup.alterados.push(...b.alterados)
      feitos++; feitas.add(a.chave)
    } catch (e) {
      falhas.push({ chave: a.chave, erro: (e instanceof Error ? e.message : String(e)).split('\n').filter(Boolean).slice(-1)[0].slice(0, 200) })
      feitas.add(a.chave)
    }
  }
  await prisma.correcaoAuditoria.update({ where: { id: correcao.id }, data: { backup: backup as unknown as object, quantidade: { increment: feitos } } })
  const restantes = fila.filter(a => !feitas.has(a.chave)).map(a => a.chave)
  return { correcaoId: correcao.id, feitos, falhas, restantes }
}

/** Desfaz uma correção: devolve o que saiu e volta o que mudou (em rodadas). */
export async function desfazerCorrecao(usuarioId: string, correcaoId: string, prazoMs = 12_000) {
  const inicio = Date.now()
  const c = await prisma.correcaoAuditoria.findFirst({ where: { id: correcaoId, usuarioId } })
  if (!c) throw new ErroAuditoria(404, 'Correção não encontrada')
  if (c.desfeitaEm) return { restantes: 0 }
  const b = c.backup as unknown as Backup
  if (b.desfeitoAte == null) {
    // Primeiro devolve os registros (recibos antes das vendas, vendas antes dos leads).
    const ordem = [TABELA.pagamentos, TABELA.financeiro, TABELA.vendas, TABELA.leads]
    for (const tabela of ordem) {
      const linhas = b.removidos.filter(r => r.tabela === tabela).map(r => r.linha)
      if (linhas.length) await prisma.$executeRawUnsafe(`INSERT INTO ${q(tabela)} SELECT * FROM json_populate_recordset(NULL::${q(tabela)}, $1::json) ON CONFLICT DO NOTHING`, JSON.stringify(linhas))
    }
    b.desfeitoAte = b.alterados.length
  }
  // Depois volta as mudanças, da última para a primeira.
  while (b.desfeitoAte! > 0 && Date.now() - inicio < prazoMs) {
    const m = b.alterados[b.desfeitoAte! - 1]
    await prisma.$executeRawUnsafe(`UPDATE ${q(m.tabela)} SET ${q(m.coluna)} = (json_populate_record(NULL::${q(m.tabela)}, json_build_object($1::text, $2::json))).${q(m.coluna)} WHERE id::text = ANY($3::text[])`, m.coluna, JSON.stringify(m.antes ?? null), m.ids)
    b.desfeitoAte!--
  }
  await prisma.correcaoAuditoria.update({ where: { id: c.id }, data: { backup: b as unknown as object, ...(b.desfeitoAte === 0 ? { desfeitaEm: new Date() } : {}) } })
  return { restantes: b.desfeitoAte }
}

/** Todas as vendas de um mês, com a origem de cada uma, para revisar uma a uma. */
export async function vendasDoMes(usuarioId: string, mes: string) {
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new ErroAuditoria(400, 'Mês inválido')
  const [ano, m] = mes.split('-').map(Number)
  const origem = await idsAntigos(usuarioId)
  const antigos = origem.de('vendas')
  const vendas = await prisma.venda.findMany({
    where: { usuarioId, data: { gte: new Date(Date.UTC(ano, m - 1, 1)), lt: new Date(Date.UTC(ano, m, 1)) } },
    select: { id: true, data: true, valorVenda: true, valorProLabore: true, valorComissao: true, observacao: true, criadoEm: true, pagamentoComissaoId: true, vendedor: { select: { nome: true } }, lead: { select: { nomeCliente: true } } },
    orderBy: [{ data: 'asc' }, { valorVenda: 'desc' }],
  })
  return {
    mes,
    vendas: vendas.map(v => ({ id: v.id, data: v.data.toISOString(), valor: v.valorVenda, proLabore: v.valorProLabore, comissao: v.valorComissao ?? 0, vendedor: v.vendedor?.nome ?? null, cliente: v.lead?.nomeCliente ?? null, observacao: v.observacao, lancadaEm: v.criadoEm.toISOString(), comissaoPaga: !!v.pagamentoComissaoId, antigo: antigos.has(v.id) })),
  }
}
