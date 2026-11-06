// Regras que protegem os números de vendas:
// - placa da moto num campo próprio (ou tirada da observação), para achar a
//   mesma moto lançada duas vezes;
// - aviso de venda repetida antes de gravar (mesma placa em 60 dias; sem
//   placa, mesmo valor e vendedor em 3 dias) — quem lança confirma se for
//   outra venda;
// - mês fechado: depois de conferido, não aceita venda nova, edição nem
//   exclusão até ser reaberto. Pagamentos de comissão continuam liberados.
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { placaDe } from './auditoriaDados'

export class ErroRegraVenda extends Error {
  constructor(readonly status: number, message: string, readonly codigo?: string, readonly dados?: Record<string, unknown>) { super(message) }
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const nomeDoMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)}`
export const mesDaData = (d: Date) => d.toISOString().slice(0, 7)

/** Placa informada (validada) ou, se vazia, a que estiver escrita na observação. */
export function resolverPlaca(placa: string | null | undefined, observacao?: string | null) {
  const p = (placa ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (p) {
    if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p)) throw new ErroRegraVenda(400, 'Placa inválida: use o formato ABC1234 ou ABC1D23')
    return p
  }
  return placaDe(observacao)
}

export async function exigirMesAberto(usuarioId: string, data: Date) {
  const mes = mesDaData(data)
  const f = await prisma.fechamentoMesVendas.findUnique({ where: { usuarioId_mes: { usuarioId, mes } }, select: { fechadoEm: true } })
  if (f?.fechadoEm) throw new ErroRegraVenda(423, `As vendas de ${nomeDoMes(mes)} estão fechadas (conferidas em ${f.fechadoEm.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}). Para mudar, o dono reabre o mês em Vendas → Fechamento do mês.`, 'MES_FECHADO', { mes })
}

const DIA = 86_400_000

/** Vendas já lançadas que parecem a mesma desta (para avisar antes de gravar). */
export async function vendasParecidas(usuarioId: string, v: { placa: string | null; valorVenda: number; data: Date; vendedorId?: string | null; ignorarId?: string }) {
  const select = { id: true, data: true, valorVenda: true, placa: true, observacao: true, vendedor: { select: { nome: true } } } as const
  const achadas = v.placa
    ? await prisma.venda.findMany({ where: { usuarioId, situacao: { not: 'CANCELADA' }, placa: v.placa, data: { gte: new Date(v.data.getTime() - 60 * DIA), lte: new Date(v.data.getTime() + 60 * DIA) }, ...(v.ignorarId ? { id: { not: v.ignorarId } } : {}) }, select, take: 5 })
    : await prisma.venda.findMany({ where: { usuarioId, situacao: { not: 'CANCELADA' }, valorVenda: { gte: v.valorVenda - 0.005, lte: v.valorVenda + 0.005 }, vendedorId: v.vendedorId ?? null, data: { gte: new Date(v.data.getTime() - 3 * DIA), lte: new Date(v.data.getTime() + 3 * DIA) }, ...(v.ignorarId ? { id: { not: v.ignorarId } } : {}) }, select, take: 5 })
  return achadas.map(a => ({ id: a.id, data: a.data.toISOString(), valorVenda: a.valorVenda, placa: a.placa, observacao: a.observacao, vendedor: a.vendedor?.nome ?? null }))
}

/** Barra a venda repetida, a não ser que quem lança confirme que é outra. */
export async function exigirSemRepetida(usuarioId: string, v: Parameters<typeof vendasParecidas>[1], confirmada: boolean | undefined) {
  if (confirmada) return
  const parecidas = await vendasParecidas(usuarioId, v)
  if (!parecidas.length) return
  const motivo = v.placa ? `a placa ${v.placa} já tem venda lançada` : 'já tem venda com o mesmo valor e vendedor nesses dias'
  throw new ErroRegraVenda(409, `Parece venda repetida: ${motivo}. Confira antes de registrar; se for outra venda, confirme.`, 'VENDA_REPETIDA', { parecidas })
}

// --- Fechamento do mês ---

interface Evento { acao: 'FECHAR' | 'REABRIR'; em: string; por: string | null }

export async function fechamentosDoAno(usuarioId: string, ano: number) {
  const regs = await prisma.fechamentoMesVendas.findMany({ where: { usuarioId, mes: { startsWith: `${ano}-` } } })
  const porMes = new Map(regs.map(r => [r.mes, r]))
  const inicio = new Date(Date.UTC(ano, 0, 1)), fim = new Date(Date.UTC(ano + 1, 0, 1))
  const vendas = await prisma.venda.findMany({ where: { usuarioId, data: { gte: inicio, lt: fim } }, select: { data: true, valorVenda: true, lead: { select: { id: true } } } })
  return Array.from({ length: 12 }, (_, i) => {
    const mes = `${ano}-${String(i + 1).padStart(2, '0')}`
    const doMes = vendas.filter(v => mesDaData(v.data) === mes)
    const r = porMes.get(mes)
    return {
      mes, fechado: !!r?.fechadoEm, fechadoEm: r?.fechadoEm?.toISOString() ?? null,
      historico: (r?.historico as unknown as Evento[] | undefined) ?? [],
      vendas: doMes.length, receita: Math.round(doMes.reduce((s, v) => s + v.valorVenda, 0) * 100) / 100,
      semLead: doMes.filter(v => !v.lead).length,
    }
  })
}

export async function alterarFechamento(usuarioId: string, mes: string, acao: 'fechar' | 'reabrir', por: string | null) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new ErroRegraVenda(400, 'Mês inválido')
  const atual = await prisma.fechamentoMesVendas.findUnique({ where: { usuarioId_mes: { usuarioId, mes } } })
  const historico = [...((atual?.historico as unknown as Evento[] | undefined) ?? []), { acao: acao === 'fechar' ? 'FECHAR' : 'REABRIR', em: new Date().toISOString(), por } satisfies Evento]
  const fechadoEm = acao === 'fechar' ? new Date() : null
  await prisma.fechamentoMesVendas.upsert({
    where: { usuarioId_mes: { usuarioId, mes } },
    create: { usuarioId, mes, fechadoEm, historico: historico as unknown as Prisma.InputJsonValue },
    update: { fechadoEm, historico: historico as unknown as Prisma.InputJsonValue },
  })
}

// --- Estoque: a venda dá baixa na moto ---

/**
 * Acha a moto do estoque desta venda: a escolhida (motoId) ou, sem escolha, a
 * de mesma placa ainda não vendida. Devolve também a placa da moto, para a
 * venda herdar quando não veio escrita.
 */
export async function motoDaVenda(usuarioId: string, motoId: string | null | undefined, placa: string | null) {
  if (motoId) {
    const m = await prisma.smMotoEstoque.findFirst({ where: { id: motoId, usuarioId }, select: { id: true, placa: true, situacao: true, modelo: true } })
    if (!m) throw new ErroRegraVenda(400, 'Moto do estoque não encontrada')
    if (m.situacao === 'VENDIDA') throw new ErroRegraVenda(409, `${m.modelo} já está como vendida no estoque. Se for outra unidade, cadastre-a no estoque antes.`, 'MOTO_VENDIDA')
    return { motoId: m.id, placa: m.placa }
  }
  if (!placa) return { motoId: null, placa: null }
  const m = await prisma.smMotoEstoque.findFirst({ where: { usuarioId, placa, situacao: { not: 'VENDIDA' } }, select: { id: true, placa: true } })
  return { motoId: m?.id ?? null, placa: m?.placa ?? null }
}

export async function darBaixaNaMoto(motoId: string | null, data: Date) {
  if (!motoId) return
  await prisma.smMotoEstoque.update({ where: { id: motoId }, data: { situacao: 'VENDIDA', saidaEm: data } })
}

/** Venda excluída: a moto volta ao estoque, se nenhuma outra venda a usa. */
export async function devolverMotoAoEstoque(motoId: string | null) {
  if (!motoId) return
  const outras = await prisma.venda.count({ where: { motoId } })
  if (outras) return
  await prisma.smMotoEstoque.updateMany({ where: { id: motoId, situacao: 'VENDIDA' }, data: { situacao: 'DISPONIVEL', saidaEm: null } })
}

/** Placa digitada no estoque: valida o formato e devolve sem traço, em maiúsculas (ou null). */
export function placaDoEstoque(placa: string | null | undefined) {
  if (placa === undefined) return undefined
  return resolverPlaca(placa ?? '', null)
}
