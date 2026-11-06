// Migração das 5 etapas do CRM para a jornada de 10 etapas (PDF 01, seção 11)
// e criação dos Clientes a partir dos leads.
//
// - Simulação: só lê e mostra quantos leads vão para cada etapa, os motivos
//   de perda traduzidos e quantos clientes serão criados (mesmo telefone =
//   mesmo cliente). Nada é gravado.
// - Aplicação: em rodadas curtas (limite de 30 s da Vercel), com autor
//   MIGRACAO na auditoria. Só roda no ambiente de teste ou com
//   PERMITIR_MIGRACAO_JORNADA=1 (a troca na produção é liberada pelo dono).
// - Desfazer: volta cada lead migrado ao estado anterior (a etapa e o motivo
//   antigos ficam guardados em estagioLegado e motivoPerdaLegado).
import { prisma } from './prisma'
import { ambienteDeTeste } from './ambiente'
import { comAutor } from './autorAuditoria'
import { telefoneCanonico } from './auditoriaDados'
import { destinoDoMotivo, faseDa, type Etapa } from './etapasJornada'

export class ErroMigracao extends Error { constructor(readonly status: number, message: string) { super(message) } }
export const migracaoPermitida = () => ambienteDeTeste() || process.env.PERMITIR_MIGRACAO_JORNADA === '1'

const LIMITE_RODADA_MS = 12_000
const LOTE = 100

const DIRETO: Record<string, Etapa> = { LEAD: 'LEAD', ABORDADO: 'ABORDADO', NEGOCIACAO: 'NEGOCIACAO', PROPOSTA: 'PROPOSTA' }

interface LeadMigravel {
  id: string; estagio: string; estagioPerda: string | null; motivoPerda: string | null
  telefone: string | null; vendedorId: string | null; etiquetas: string[]
  venda: { situacao: string } | null
}

/** Etapa nova do lead (seção 11). Perdido fica com a etapa em que foi perdido. */
export function etapaNova(l: Pick<LeadMigravel, 'estagio' | 'estagioPerda' | 'venda'>): { etapa: Etapa; revisarEtapa: boolean } {
  const base = l.estagio === 'PERDIDO' ? (l.estagioPerda ?? 'LEAD') : l.estagio
  if (base === 'FECHADO') return l.venda?.situacao === 'CONFIRMADA' ? { etapa: 'VENDA', revisarEtapa: false } : { etapa: 'PROPOSTA', revisarEtapa: true }
  return { etapa: DIRETO[base] ?? 'LEAD', revisarEtapa: false }
}

/** Motivo novo: tradução direta; os ambíguos viram "outro (anterior à migração)". */
export function motivoNovo(antigo: string | null, etapa: Etapa): string {
  switch (antigo) {
    case 'PRECO': return 'ACHOU_CARO'
    case 'CONCORRENCIA': return 'COMPROU_OUTRO_LUGAR'
    case 'SEM_ESTOQUE': return 'MOTO_INDISPONIVEL'
    case 'DESISTIU': return 'DESISTIU'
    case 'SEM_RESPOSTA': return etapa === 'LEAD' || etapa === 'ABORDADO' ? 'NUNCA_RESPONDEU' : 'PAROU_DE_RESPONDER'
    default: return 'OUTRO_ANTERIOR_MIGRACAO'
  }
}

/** O que a migração grava no lead (sem o cliente). */
export function planoDoLead(l: LeadMigravel) {
  const { etapa, revisarEtapa } = etapaNova(l)
  const perdido = l.estagio === 'PERDIDO'
  const motivo = perdido ? motivoNovo(l.motivoPerda, etapa) : null
  const et = new Set(l.etiquetas ?? [])
  return {
    etapa, fase: faseDa(etapa), revisarEtapa,
    responsavelFechamentoId: l.vendedorId,
    formaPagamento: et.has('A_VISTA') ? 'A_VISTA' : et.has('FINANCIAMENTO') ? 'FINANCIADO' : null,
    temEntrada: et.has('SEM_ENTRADA') ? false : null,
    levantamentoCompleto: false,
    anteriorMigracao: true,
    estagioLegado: l.estagio,
    ...(perdido ? { motivoPerda: motivo, motivoPerdaLegado: l.motivoPerda, destinoPerda: destinoDoMotivo(motivo!) } : {}),
  }
}

const SELECT_LEAD = { id: true, estagio: true, estagioPerda: true, motivoPerda: true, telefone: true, vendedorId: true, etiquetas: true, nomeCliente: true, email: true, endereco: true, criadoEm: true, fechadoEm: true, venda: { select: { situacao: true } } } as const
const conta = <K extends string>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1)
const final4 = (t: string) => `…${t.slice(-4)}`

export async function simularMigracao(usuarioId: string) {
  const leads = await prisma.lead.findMany({ where: { usuarioId }, select: { ...SELECT_LEAD, etapa: true }, orderBy: { criadoEm: 'desc' } })
  const pendentes = leads.filter(l => l.etapa == null)
  const jaMigrados = leads.length - pendentes.length
  const pares = new Map<string, number>(), porEtapa = new Map<Etapa, number>(), porEstagio = new Map<string, number>(), motivos = new Map<string, number>()
  let revisar = 0, perdidos = 0, aVista = 0, financiado = 0
  const grupos = new Map<string, { nome: string; leads: number }>()
  let semTelefone = 0
  for (const l of pendentes) {
    const p = planoDoLead(l)
    conta(porEstagio, l.estagio); conta(porEtapa, p.etapa)
    conta(pares, `${l.estagio}→${p.etapa}${p.revisarEtapa ? ' (revisar etapa)' : ''}`)
    if (p.revisarEtapa) revisar++
    if (p.formaPagamento === 'A_VISTA') aVista++
    if (p.formaPagamento === 'FINANCIADO') financiado++
    if (l.estagio === 'PERDIDO') { perdidos++; conta(motivos, `${l.motivoPerda ?? 'sem motivo'}→${p.motivoPerda}→${p.destinoPerda ?? 'sem destino'}`) }
    const t = telefoneCanonico(l.telefone)
    if (!t) { semTelefone++; continue }
    const g = grupos.get(t)
    if (g) g.leads++
    else grupos.set(t, { nome: l.nomeCliente, leads: 1 })
  }
  const repetidos = [...grupos.entries()].filter(([, g]) => g.leads > 1)
  const existentes = await prisma.cliente.count({ where: { usuarioId } })
  const total = leads.length
  const somaNova = [...porEtapa.values()].reduce((s, n) => s + n, 0)
  return {
    permitido: migracaoPermitida(),
    total, jaMigrados, aMigrar: pendentes.length,
    porEstagioAntigo: Object.fromEntries(porEstagio), porEtapaNova: Object.fromEntries(porEtapa),
    pares: [...pares.entries()].map(([de, n]) => ({ de, n })).sort((a, b) => b.n - a.n),
    revisarEtapa: revisar, perdidos,
    motivos: [...motivos.entries()].map(([k, n]) => { const [antigo, novo, destino] = k.split('→'); return { antigo, novo, destino, n } }).sort((a, b) => b.n - a.n),
    levantamento: { aVista, financiado, semInformacao: pendentes.length - aVista - financiado },
    clientes: {
      jaExistem: existentes,
      aCriar: grupos.size + semTelefone,
      comTelefone: grupos.size, semTelefone,
      telefonesRepetidos: repetidos.length,
      leadsJuntados: repetidos.reduce((s, [, g]) => s + g.leads, 0),
      exemplos: repetidos.sort((a, b) => b[1].leads - a[1].leads).slice(0, 8).map(([t, g]) => ({ nome: g.nome, telefone: final4(t), leads: g.leads })),
    },
    conferencia: { leadsAntes: pendentes.length, leadsDepois: somaNova, nenhumPerdido: somaNova === pendentes.length },
  }
}

async function entradaNaEtapa(ids: string[]) {
  const hist = await prisma.leadEstagioHistorico.findMany({ where: { leadId: { in: ids } }, select: { leadId: true, estagioNovo: true, criadoEm: true }, orderBy: { criadoEm: 'asc' } })
  const m = new Map<string, Map<string, Date>>()
  for (const h of hist) { if (!m.has(h.leadId)) m.set(h.leadId, new Map()); m.get(h.leadId)!.set(h.estagioNovo, h.criadoEm) }
  return m
}

export async function statusMigracao(usuarioId: string) {
  const [total, migrados, clientes, cruzado] = await Promise.all([
    prisma.lead.count({ where: { usuarioId } }),
    prisma.lead.count({ where: { usuarioId, etapa: { not: null } } }),
    prisma.cliente.count({ where: { usuarioId } }),
    prisma.lead.groupBy({ by: ['estagioLegado', 'etapa', 'revisarEtapa'], where: { usuarioId, anteriorMigracao: true }, _count: { _all: true } }),
  ])
  const semCliente = await prisma.lead.count({ where: { usuarioId, etapa: { not: null }, clienteId: null } })
  return {
    total, migrados, pendentes: total - migrados, clientes, semCliente,
    conferencia: cruzado.map(c => ({ de: c.estagioLegado, para: c.etapa, revisarEtapa: c.revisarEtapa, n: c._count._all })).sort((a, b) => b.n - a.n),
  }
}

/** Uma rodada da aplicação (até ~12 s). Repetir até `pendentes` chegar a 0. */
export async function rodadaMigracao(usuarioId: string) {
  if (!migracaoPermitida()) throw new ErroMigracao(403, 'A migração da jornada só roda no ambiente de teste. Na produção ela é liberada pelo dono, depois do teste.')
  const inicio = Date.now()
  await comAutor({ origem: 'MIGRACAO' }, async () => {
    const clientes = new Map<string, string>()
    while (Date.now() - inicio < LIMITE_RODADA_MS) {
      const lote = await prisma.lead.findMany({ where: { usuarioId, etapa: null }, select: SELECT_LEAD, orderBy: { criadoEm: 'desc' }, take: LOTE })
      if (!lote.length) break
      const entradas = await entradaNaEtapa(lote.map(l => l.id))
      for (const l of lote) {
        const p = planoDoLead(l)
        const tel = telefoneCanonico(l.telefone)
        let clienteId = tel ? clientes.get(tel) : undefined
        if (tel && !clienteId) {
          const c = await prisma.cliente.upsert({
            where: { usuarioId_telefone: { usuarioId, telefone: tel } },
            create: { usuarioId, nome: l.nomeCliente, telefone: tel, email: l.email, endereco: l.endereco },
            update: {}, select: { id: true },
          })
          clienteId = c.id; clientes.set(tel, c.id)
        }
        if (!clienteId) clienteId = (await prisma.cliente.create({ data: { usuarioId, nome: l.nomeCliente, email: l.email, endereco: l.endereco }, select: { id: true } })).id
        const entrou = p.etapa === 'VENDA' ? (l.fechadoEm ?? entradas.get(l.id)?.get('FECHADO')) : entradas.get(l.id)?.get(l.estagio === 'PERDIDO' ? (l.estagioPerda ?? '') : l.estagio)
        await prisma.lead.update({ where: { id: l.id }, data: { ...p, clienteId, entrouNaEtapaEm: entrou ?? l.criadoEm } })
      }
    }
  })
  return statusMigracao(usuarioId)
}

/** Uma rodada do desfazer: devolve os leads migrados ao estado de antes. */
export async function rodadaDesfazer(usuarioId: string) {
  if (!migracaoPermitida()) throw new ErroMigracao(403, 'Desfazer a migração só é possível onde ela pode rodar (ambiente de teste).')
  const inicio = Date.now()
  await comAutor({ origem: 'MIGRACAO' }, async () => {
    while (Date.now() - inicio < LIMITE_RODADA_MS) {
      const lote = await prisma.lead.findMany({ where: { usuarioId, anteriorMigracao: true }, select: { id: true, estagio: true, motivoPerdaLegado: true }, take: LOTE })
      if (!lote.length) break
      for (const l of lote) {
        await prisma.lead.update({
          where: { id: l.id },
          data: {
            etapa: null, fase: null, revisarEtapa: false, responsavelFechamentoId: null, formaPagamento: null, temEntrada: null,
            levantamentoCompleto: false, anteriorMigracao: false, estagioLegado: null, entrouNaEtapaEm: null, clienteId: null, destinoPerda: null,
            ...(l.estagio === 'PERDIDO' ? { motivoPerda: l.motivoPerdaLegado, motivoPerdaLegado: null } : {}),
          },
        })
      }
    }
    if (!(await prisma.lead.count({ where: { usuarioId, anteriorMigracao: true } }))) await prisma.cliente.deleteMany({ where: { usuarioId, leads: { none: {} } } })
  })
  return statusMigracao(usuarioId)
}
