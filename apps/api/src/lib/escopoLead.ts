import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

// Etapas pelas quais o SDR responde (pré-venda).
export const ETAPAS_DO_SDR = ['LEAD', 'ABORDADO', 'LEVANTAMENTO', 'MQL', 'SQL']

/** Leads que o SDR passou adiante e já estão na fase de Venda: só a etapa atual e o resultado. */
export async function leadsPassadosDoSdr(req: Request) {
  const u = req.proLaboreUser!
  if (u.papel !== 'VENDEDOR' || !u.sdr || !u.vendedorId) return []
  const ls = await prisma.lead.findMany({
    where: { usuarioId: u.sub, responsavelQualificacaoId: u.vendedorId, vendedorId: { not: u.vendedorId }, etapa: { notIn: ETAPAS_DO_SDR } },
    select: { id: true, nomeCliente: true, etapa: true, fase: true, estagio: true, entrouNaEtapaEm: true, criadoEm: true, destinoPerda: true, vendedor: { select: { nome: true } } },
    orderBy: { entrouNaEtapaEm: 'desc' }, take: 300,
  })
  return ls.map(l => ({ ...l, resultado: l.etapa === 'VENDA' ? 'VENDIDO' : l.estagio === 'PERDIDO' ? 'PERDIDO' : 'EM_ANDAMENTO', somenteLeitura: true }))
}

// Quais leads a pessoa enxerga: o vendedor só os dele; dono e supervisor a
// equipe inteira (ou um vendedor, quando filtram).
export function leadWhereBase(req: Request, vendedorIdFiltro?: string): { usuarioId: string; vendedorId?: string; OR?: Prisma.LeadWhereInput[] } {
  const u = req.proLaboreUser!
  return leadWhereDe({ usuarioId: u.sub, papel: u.papel, sdr: !!u.sdr, vendedorId: u.vendedorId ?? null }, vendedorIdFiltro)
}
/** A mesma regra de leadWhereBase, sem o pedido (Central de Conhecimento e WhatsApp do Pergunte). */
export function leadWhereDe(u: { usuarioId: string; papel: string; sdr: boolean; vendedorId: string | null }, vendedorIdFiltro?: string): { usuarioId: string; vendedorId?: string; OR?: Prisma.LeadWhereInput[] } {
  const usuarioId = u.usuarioId
  // SDR: os próprios leads e os que qualificou (mesmo depois de passados ao vendedor).
  if (u.papel === 'VENDEDOR' && u.sdr) {
    const eu = u.vendedorId!
    // Passado ao vendedor e já na fase de Venda: só a etapa e o resultado (leadsPassadosDoSdr).
    return { usuarioId, OR: [{ vendedorId: eu }, { responsavelQualificacaoId: eu, OR: [{ etapa: null }, { etapa: { in: ETAPAS_DO_SDR } }] }] }
  }
  if (u.papel === 'VENDEDOR') {
    return { usuarioId, vendedorId: u.vendedorId! }
  }
  if (vendedorIdFiltro) return { usuarioId, vendedorId: vendedorIdFiltro }
  return { usuarioId }
}

// Motivos de perda (a Reativação agrupa por eles).
export const MOTIVOS_PERDA = ['SEM_MOMENTO', 'SEM_CREDITO', 'PRECO', 'SEM_RESPOSTA', 'CONCORRENCIA', 'SEM_ESTOQUE', 'DESISTIU', 'OUTRO'] as const
export const TEMPERATURAS = ['FRIO', 'MORNO', 'QUENTE'] as const
export const CANAIS_FOLLOW = ['WHATSAPP', 'LIGACAO', 'VISITA', 'EMAIL', 'OUTRO'] as const
