// PDF 02 · 4.7/4.9: consulta da trilha de auditoria imutável. Dono vê tudo;
// supervisor vê a da equipe (oportunidades, clientes, atividades e o
// trabalho comercial), sem vendas, crédito nem configurações do dono.
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

export const TABELAS_AUDITADAS: Record<string, string> = {
  pro_labore_leads: 'Oportunidade', pro_labore_clientes: 'Cliente', pro_labore_atividades: 'Atividade (ATV)',
  pro_labore_lead_follows: 'Follow', pro_labore_ligacoes: 'Ligação', pro_labore_lead_visitas: 'Visita',
  pro_labore_lead_propostas: 'Proposta', pro_labore_lead_passagens: 'Passagem ao vendedor', pro_labore_agenda_itens: 'Rotina da Agenda',
  pro_labore_copiloto_sugestoes: 'Sugestão do ARIES', pro_labore_vendas: 'Venda', pro_labore_assistente_fichas_credito: 'Ficha de crédito',
  pro_labore_assistente_analises_credito: 'Análise de crédito', pro_labore_regua_cobranca: 'Régua de cobrança',
}
export const TABELAS_DA_EQUIPE = ['pro_labore_leads', 'pro_labore_clientes', 'pro_labore_atividades', 'pro_labore_lead_follows', 'pro_labore_ligacoes', 'pro_labore_lead_visitas', 'pro_labore_lead_propostas', 'pro_labore_lead_passagens', 'pro_labore_agenda_itens']

export interface FiltroTrilha { tabela?: string; registroId?: string; autorId?: string; desde?: Date; ate?: Date; limite?: number }

export async function trilha(usuarioId: string, papel: string, f: FiltroTrilha) {
  const permitidas = papel === 'DONO' ? Object.keys(TABELAS_AUDITADAS) : TABELAS_DA_EQUIPE
  const tabelas = f.tabela ? permitidas.filter(t => t === f.tabela) : permitidas
  if (!tabelas.length) return []
  // Registros da conta: os que existem hoje e os criados por ela (mesmo se apagados depois).
  const daConta = Prisma.join(tabelas.map(t => Prisma.sql`SELECT id FROM ${Prisma.raw(`"${t}"`)} WHERE "usuarioId" = ${usuarioId}`), ' UNION ')
  const linhas = await prisma.$queryRaw<Array<{ id: string; tabela: string; registroId: string; acao: string; campo: string | null; valorAnterior: string | null; valorNovo: string | null; autorOrigem: string; autorId: string | null; autorPapel: string | null; em: Date }>>`
    WITH ids AS (
      ${daConta}
      UNION SELECT e."registroId" FROM pro_labore_eventos_auditoria e
        WHERE e.acao = 'CRIACAO' AND e.tabela IN (${Prisma.join(tabelas)}) AND (e."valorNovo"::jsonb ->> 'usuarioId') = ${usuarioId}
    )
    SELECT e.* FROM pro_labore_eventos_auditoria e
    WHERE e.tabela IN (${Prisma.join(tabelas)}) AND e."registroId" IN (SELECT id FROM ids)
      ${f.registroId ? Prisma.sql`AND e."registroId" = ${f.registroId}` : Prisma.empty}
      ${f.autorId ? Prisma.sql`AND e."autorId" = ${f.autorId}` : Prisma.empty}
      ${f.desde ? Prisma.sql`AND e.em >= ${f.desde}` : Prisma.empty}
      ${f.ate ? Prisma.sql`AND e.em < ${f.ate}` : Prisma.empty}
    ORDER BY e.em DESC LIMIT ${Math.min(f.limite ?? 200, 500)}`
  // Nomes de quem fez (vendedores e o dono).
  const pessoas = await prisma.vendedor.findMany({ where: { usuarioId }, select: { id: true, nome: true } })
  const nome = (id: string | null, origem: string) => (origem === 'AUTOMACAO' ? 'ARIES (automação)' : origem === 'INTEGRACAO' ? 'Integração' : !id ? 'Sistema' : id === usuarioId ? 'Dono' : pessoas.find(p => p.id === id)?.nome ?? id)
  const curto = (v: string | null) => (v && v.length > 300 ? `${v.slice(0, 300)}…` : v)
  return linhas.map(l => ({ ...l, oQue: TABELAS_AUDITADAS[l.tabela] ?? l.tabela, quem: nome(l.autorId, l.autorOrigem), valorAnterior: curto(l.valorAnterior), valorNovo: curto(l.valorNovo) }))
}
