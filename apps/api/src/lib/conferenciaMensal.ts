// Conferência automática dos números, mês a mês: cruza vendas, CRM e recibos
// e lista o que não bate (vendas que parecem repetidas, leads fechados sem
// venda, vendas sem lead, recibos cujo total não confere com as vendas
// dentro dele). Só lê. Aparece no Dashboard e antes de fechar o mês.
import { prisma } from './prisma'
import { auditarDados } from './auditoriaDados'

export type Gravidade = 'alta' | 'media' | 'baixa'
export interface PontoConferencia { tipo: string; gravidade: Gravidade; texto: string; onde: 'auditoria' | 'vendas' | 'crm' }
export interface MesConferido { mes: string; fechado: boolean; vendas: number; receita: number; pontos: PontoConferencia[] }

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const mesDe = (d: Date) => d.toISOString().slice(0, 7)
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export async function conferirMeses(usuarioId: string, meses = 12) {
  const agora = new Date()
  const desde = `${new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - (meses - 1), 1)).toISOString().slice(0, 7)}`
  const [aud, leadsSemVenda, pagamentos, fechamentos] = await Promise.all([
    auditarDados(usuarioId),
    prisma.lead.findMany({ where: { usuarioId, estagio: 'FECHADO', vendaId: null }, select: { fechadoEm: true, criadoEm: true } }),
    prisma.pagamentoComissao.findMany({
      where: { usuarioId, canceladoEm: null },
      select: { tipo: true, numero: true, pagoEm: true, valorTotal: true, vendas: { select: { valorComissao: true } }, vendasProLabore: { select: { valorProLabore: true } } },
    }),
    prisma.fechamentoMesVendas.findMany({ where: { usuarioId, fechadoEm: { not: null } }, select: { mes: true } }),
  ])
  const fechados = new Set(fechamentos.map(f => f.mes))
  const porMes = new Map<string, MesConferido>()
  const mes = (m: string) => {
    if (!porMes.has(m)) porMes.set(m, { mes: m, fechado: fechados.has(m), vendas: 0, receita: 0, pontos: [] })
    return porMes.get(m)!
  }

  for (const m of aud.meses) {
    if (m.mes < desde) continue
    const c = mes(m.mes)
    c.vendas = m.vendas; c.receita = m.receita
    if (m.repetidas) c.pontos.push({ tipo: 'repetidas', gravidade: 'alta', onde: 'auditoria', texto: `${plural(m.repetidas, 'venda parece repetida', 'vendas parecem repetidas')} (${brl(m.receitaRepetida)} a mais na receita)` })
    if (m.vendasSemLead) c.pontos.push({ tipo: 'semLead', gravidade: 'baixa', onde: 'auditoria', texto: `${plural(m.vendasSemLead, 'venda não está ligada', 'vendas não estão ligadas')} a lead do CRM` })
    if (m.leadsRepetidos) c.pontos.push({ tipo: 'leadsRepetidos', gravidade: 'media', onde: 'auditoria', texto: `${plural(m.leadsRepetidos, 'lead repetido', 'leads repetidos')} (mesmo telefone), inflando o topo do funil` })
  }
  const semVenda = new Map<string, number>()
  for (const l of leadsSemVenda) { const k = mesDe(l.fechadoEm ?? l.criadoEm); semVenda.set(k, (semVenda.get(k) ?? 0) + 1) }
  for (const [k, n] of semVenda) if (k >= desde) mes(k).pontos.push({ tipo: 'fechadoSemVenda', gravidade: 'media', onde: 'crm', texto: `${plural(n, 'lead marcado como fechado', 'leads marcados como fechados')} no CRM sem venda lançada` })
  for (const p of pagamentos) {
    const k = mesDe(p.pagoEm)
    if (k < desde) continue
    const soma = p.tipo === 'PROLABORE' ? p.vendasProLabore.reduce((s, v) => s + v.valorProLabore, 0) : p.vendas.reduce((s, v) => s + (v.valorComissao ?? 0), 0)
    if (Math.abs(soma - p.valorTotal) > 0.01) mes(k).pontos.push({ tipo: 'recibo', gravidade: 'alta', onde: 'vendas', texto: `${p.tipo === 'PROLABORE' ? 'Recibo de pró-labore' : 'Comprovante de comissão'} nº ${p.numero}: total ${brl(p.valorTotal)}, mas as vendas dentro dele somam ${brl(soma)}` })
  }

  const ordem: Record<Gravidade, number> = { alta: 0, media: 1, baixa: 2 }
  const lista = [...porMes.values()].sort((a, b) => b.mes.localeCompare(a.mes))
  for (const m of lista) m.pontos.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade])
  const comPendencia = lista.filter(m => m.pontos.some(p => p.gravidade !== 'baixa'))
  return { geradoEm: new Date().toISOString(), meses: lista, pendentes: comPendencia.map(m => ({ mes: m.mes, pontos: m.pontos.filter(p => p.gravidade !== 'baixa').length, fechado: m.fechado })) }
}
