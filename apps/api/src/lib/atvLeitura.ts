// PDF 02 · seção 6: as telas atuais de follow, Ligações e Agenda leem da
// Atividade (ATV), sem mudar o uso. A ATV decide QUAIS registros entram, a
// ordem, o prazo e a situação; da tabela de origem vêm só os detalhes de cada
// tela (discagens, cadência, selo de localização…). A gravação chega à ATV
// pelo banco, na mesma transação (gatilhos aries_atv_*).
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

type Tabela = 'pro_labore_lead_follows' | 'pro_labore_ligacoes' | 'pro_labore_agenda_conclusoes'
const ESTADO: Record<Tabela, Record<string, string>> = {
  pro_labore_lead_follows: { PENDENTE: 'PENDENTE', EXECUTADA: 'FEITO', CANCELADA: 'CANCELADO' },
  pro_labore_ligacoes: { PENDENTE: 'PENDENTE', EXECUTADA: 'FEITA', CANCELADA: 'CANCELADA' },
  pro_labore_agenda_conclusoes: { PENDENTE: 'PENDENTE', EXECUTADA: 'FEITA', CANCELADA: 'CANCELADA' },
}

export interface FiltroAtv {
  tabela: Tabela
  usuarioId: string
  leadIds?: string[] | Prisma.Sql // lista ou subconsulta de ids dos leads visíveis
  leadId?: string
  status?: 'PENDENTE' | 'EXECUTADA' | 'CANCELADA'
  prazoAntes?: Date
  prazoDesde?: Date
  ordem?: 'asc' | 'desc'
  limite?: number
}

/** Ids (da tabela de origem) na ordem da ATV, com prazo e situação vindos da ATV. */
export async function daAtv(f: FiltroAtv): Promise<Array<{ registroId: string; prazo: Date; status: string }>> {
  const leads = f.leadIds == null ? Prisma.empty
    : Array.isArray(f.leadIds) ? (f.leadIds.length ? Prisma.sql`AND a."leadId" IN (${Prisma.join(f.leadIds)})` : Prisma.sql`AND false`)
    : Prisma.sql`AND a."leadId" IN (${f.leadIds})`
  const linhas = await prisma.$queryRaw<Array<{ registroId: string; prazo: Date; status: string }>>`
    SELECT a."registroId", a.prazo, a.status FROM pro_labore_atividades a
    WHERE a."registroTabela" = ${f.tabela} AND a."usuarioId" = ${f.usuarioId}
      ${leads}
      ${f.leadId ? Prisma.sql`AND a."leadId" = ${f.leadId}` : Prisma.empty}
      ${f.status ? Prisma.sql`AND a.status = ${f.status}` : Prisma.empty}
      ${f.prazoAntes ? Prisma.sql`AND a.prazo < ${f.prazoAntes}` : Prisma.empty}
      ${f.prazoDesde ? Prisma.sql`AND a.prazo >= ${f.prazoDesde}` : Prisma.empty}
    ORDER BY a.prazo ${f.ordem === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`}, a.numero
    LIMIT ${f.limite ?? 500}`
  return linhas.map(l => ({ ...l, status: ESTADO[f.tabela][l.status] ?? l.status }))
}

/** Contagem pela ATV (selo do menu). */
export async function contarNaAtv(f: Omit<FiltroAtv, 'ordem' | 'limite'>): Promise<number> {
  const leads = f.leadIds == null ? Prisma.empty
    : Array.isArray(f.leadIds) ? (f.leadIds.length ? Prisma.sql`AND a."leadId" IN (${Prisma.join(f.leadIds)})` : Prisma.sql`AND false`)
    : Prisma.sql`AND a."leadId" IN (${f.leadIds})`
  const [r] = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT count(*) n FROM pro_labore_atividades a
    WHERE a."registroTabela" = ${f.tabela} AND a."usuarioId" = ${f.usuarioId}
      ${leads}
      ${f.status ? Prisma.sql`AND a.status = ${f.status}` : Prisma.empty}
      ${f.prazoAntes ? Prisma.sql`AND a.prazo < ${f.prazoAntes}` : Prisma.empty}
      ${f.prazoDesde ? Prisma.sql`AND a.prazo >= ${f.prazoDesde}` : Prisma.empty}`
  return Number(r.n)
}

/** Junta os detalhes da origem na ordem da ATV (o que sumiu da origem não aparece). */
export function naOrdem<T extends { id: string }>(ordem: Array<{ registroId: string }>, detalhes: T[]): T[] {
  const por = new Map(detalhes.map(d => [d.id, d]))
  return ordem.map(o => por.get(o.registroId)).filter((x): x is T => !!x)
}

/** Leads visíveis para quem pede: sem recorte (dono/supervisor sem filtro) = undefined (vale a conta inteira). */
export async function leadsVisiveis(where: { usuarioId: string; vendedorId?: string; OR?: Prisma.LeadWhereInput[] }): Promise<string[] | undefined> {
  if (!where.vendedorId && !where.OR) return undefined
  return (await prisma.lead.findMany({ where, select: { id: true } })).map(l => l.id)
}
