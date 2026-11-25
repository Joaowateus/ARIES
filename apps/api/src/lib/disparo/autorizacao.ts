// ARIES DISPARO — autorização de comunicação e lista de supressão.
// Cada mudança é uma linha nova (imutável): quem autorizou, quando, por qual base legal e com qual
// evidência; quem revogou e como. A linha mais recente de cada telefone vale. BLOQUEADO vale para
// tudo; REVOGADO vale para as mensagens promocionais (marketing) — de todas as campanhas futuras e
// das mensagens promocionais ainda não enviadas.
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { normalizarTelefone } from './regras'

export type Situacao = 'AUTORIZADO' | 'REVOGADO' | 'BLOQUEADO'
export const BASES_LEGAIS = ['CONSENTIMENTO', 'LEGITIMO_INTERESSE', 'EXECUCAO_CONTRATO'] as const
export const ROTULO_BASE: Record<string, string> = { CONSENTIMENTO: 'Consentimento do titular', LEGITIMO_INTERESSE: 'Legítimo interesse (cliente da loja, com opção de sair)', EXECUCAO_CONTRATO: 'Execução de contrato (compra em andamento)' }

/** Situação atual de cada telefone (a linha mais recente; BLOQUEADO em qualquer finalidade vale para todas). */
export async function estadosDeAutorizacao(usuarioId: string, telefones: string[]): Promise<Map<string, { situacao: Situacao; criadoEm: Date; baseLegal: string | null }>> {
  const r = new Map<string, { situacao: Situacao; criadoEm: Date; baseLegal: string | null }>()
  const unicos = [...new Set(telefones.filter(Boolean))]
  for (let i = 0; i < unicos.length; i += 5000) {
    const lote = unicos.slice(i, i + 5000)
    const linhas = await prisma.$queryRaw<Array<{ telefone: string; situacao: Situacao; criadoEm: Date; baseLegal: string | null }>>`
      SELECT DISTINCT ON (telefone) telefone, situacao, "criadoEm", "baseLegal" FROM pro_labore_contato_autorizacoes
      WHERE "usuarioId" = ${usuarioId} AND (canal = 'WHATSAPP' OR (canal = 'INSTAGRAM' AND telefone LIKE 'ig:%')) AND telefone IN (${Prisma.join(lote)})
      ORDER BY telefone, (situacao = 'BLOQUEADO') DESC, "criadoEm" DESC`
    for (const l of linhas) r.set(l.telefone, { situacao: l.situacao, criadoEm: l.criadoEm, baseLegal: l.baseLegal })
  }
  return r
}

export async function situacaoDe(usuarioId: string, telefone: string) {
  return (await estadosDeAutorizacao(usuarioId, [telefone])).get(telefone) ?? null
}

export async function registrarAutorizacao(a: { usuarioId: string; telefone: string; situacao: Situacao; finalidade?: string; baseLegal?: string | null; evidencia?: string | null; origem: string; leadId?: string | null; autorNome?: string | null }) {
  // Contato do Instagram: a chave é "ig:<id do Instagram>" (canal INSTAGRAM), sem número de telefone.
  const instagram = /^ig:\d+$/.test(a.telefone)
  const telefone = instagram ? a.telefone : normalizarTelefone(a.telefone)
  if (!telefone) throw new Error('Telefone inválido')
  const linha = await prisma.contatoAutorizacao.create({
    data: {
      usuarioId: a.usuarioId, telefone, canal: instagram ? 'INSTAGRAM' : 'WHATSAPP', finalidade: a.finalidade ?? 'MARKETING', situacao: a.situacao,
      baseLegal: a.baseLegal ?? null, evidencia: a.evidencia?.slice(0, 1000) ?? null, origem: a.origem, leadId: a.leadId ?? null, registradoPorNome: a.autorNome ?? null,
    },
  })
  // Revogação/bloqueio: as mensagens promocionais ainda não enviadas para esse número não saem.
  if (a.situacao !== 'AUTORIZADO') {
    const finalidades = a.situacao === 'BLOQUEADO' ? undefined : ['MARKETING']
    const pendentes = await prisma.disparoMensagem.findMany({
      where: { status: 'AGENDADA', destinatario: { usuarioId: a.usuarioId, telefone }, ...(finalidades ? { campanha: { finalidade: { in: finalidades } } } : {}) },
      select: { id: true, destinatarioId: true, campanhaId: true },
    })
    if (pendentes.length) {
      await prisma.disparoMensagem.updateMany({ where: { id: { in: pendentes.map(p => p.id) }, status: 'AGENDADA' }, data: { status: 'CANCELADA', ultimoErro: a.situacao === 'BLOQUEADO' ? 'Contato bloqueado' : 'Contato pediu para não receber' } })
      await prisma.disparoDestinatario.updateMany({ where: { id: { in: [...new Set(pendentes.map(p => p.destinatarioId))] }, status: { in: ['ELEGIVEL', 'EM_ANDAMENTO'] } }, data: { status: 'INTERROMPIDO', interrompidoPor: a.situacao } })
      await prisma.disparoEvento.createMany({ data: pendentes.map(p => ({ usuarioId: a.usuarioId, campanhaId: p.campanhaId, destinatarioId: p.destinatarioId, mensagemId: p.id, tipo: 'INTERROMPIDO_REVOGACAO', descricao: a.situacao === 'BLOQUEADO' ? 'Contato bloqueado: mensagem cancelada' : 'Contato pediu para não receber: mensagem promocional cancelada', autorNome: a.autorNome ?? null })) })
    }
  }
  return linha
}
