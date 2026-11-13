// Follow pelo robô no CRM (Ajuste 3): o vendedor escolhe a cadência para um
// ou vários clientes; aqui ela é ligada à conversa do WhatsApp de cada um.
import { prisma } from './prisma'
import { Prisma } from '@prisma/client'
import { lerCadencias, lerCadenciaDaConversa, novaCadencia, quandoDoPasso, rotuloCadencia, type CadenciaDaConversa } from './assistenteCadencia'
import type { PassoFollow } from './assistenteFollow'

export async function cadenciasDaLoja(usuarioId: string) {
  const loja = await prisma.assistenteLoja.findUnique({ where: { usuarioId }, select: { cadencias: true } })
  return lerCadencias(loja?.cadencias)
}

/** A conversa do WhatsApp do lead (a mais recente), se houver. */
async function conversaDoLead(leadId: string) {
  return prisma.assistenteConversa.findFirst({ where: { leadId, tipo: 'LEAD' }, orderBy: { ultimaMensagemEm: 'desc' }, select: { id: true, followParado: true, cadencia: true } })
}

export type ResultadoCadencia = { leadId: string; ok: boolean; motivo?: string }
export async function aplicarCadencia(usuarioId: string, leadIds: string[], cadenciaId: string, opcoes: { inicio?: Date; passos?: PassoFollow[]; autor: { id: string | null; nome: string | null }; escopo?: Record<string, unknown> }): Promise<ResultadoCadencia[]> {
  const cad = (await cadenciasDaLoja(usuarioId)).find(c => c.id === cadenciaId)
  if (!cad) throw new Error('Cadência não encontrada')
  const out: ResultadoCadencia[] = []
  for (const leadId of [...new Set(leadIds)].slice(0, 200)) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, usuarioId, ...(opcoes.escopo ?? {}) }, select: { id: true, estagio: true, vendaId: true, cliente: { select: { bloqueado: true } } } })
    if (!lead) { out.push({ leadId, ok: false, motivo: 'Lead não encontrado' }); continue }
    if (lead.estagio === 'FECHADO' || lead.estagio === 'PERDIDO' || lead.vendaId) { out.push({ leadId, ok: false, motivo: 'Lead fechado ou perdido' }); continue }
    if (lead.cliente?.bloqueado) { out.push({ leadId, ok: false, motivo: 'Cliente pediu para não ser contatado' }); continue }
    const c = await conversaDoLead(leadId)
    if (!c) { out.push({ leadId, ok: false, motivo: 'O cliente ainda não conversou no WhatsApp (o robô nunca abre conversa)' }); continue }
    if (c.followParado === 'PEDIU_PARAR') { out.push({ leadId, ok: false, motivo: 'O cliente pediu para parar as mensagens' }); continue }
    const nova = novaCadencia(cad, opcoes.inicio ?? new Date(), opcoes.autor, opcoes.passos)
    await prisma.assistenteConversa.update({ where: { id: c.id }, data: { cadencia: nova as unknown as Prisma.InputJsonValue } })
    await prisma.leadFollow.create({ data: { usuarioId, leadId, agendadoPara: new Date(), tipo: 'JORNADA', canal: 'WHATSAPP', status: 'FEITO', feitoEm: new Date(), resultado: 'Cadência ligada', nota: `Follow pelo robô: cadência "${cad.nome}" ligada${opcoes.autor.nome ? ` por ${opcoes.autor.nome}` : ''}`, contexto: { atividade: 'CADENCIA_ROBO' }, criadoPor: opcoes.autor.id } })
    out.push({ leadId, ok: true })
  }
  return out
}

export async function mudarCadencia(leadId: string, acao: 'pausar' | 'retomar' | 'cancelar'): Promise<CadenciaDaConversa | null> {
  const c = await conversaDoLead(leadId)
  const cad = lerCadenciaDaConversa(c?.cadencia)
  if (!c || !cad) return null
  let novo: CadenciaDaConversa = cad
  if (acao === 'pausar' && cad.status === 'ATIVO') novo = { ...cad, status: 'PAUSADO' }
  else if (acao === 'retomar' && cad.status === 'PAUSADO') {
    // Recomeça a contar de agora para o passo que faltava.
    const atraso = Date.now() - new Date(cad.proximoEm ?? Date.now()).getTime()
    const inicio = new Date(new Date(cad.inicioEm).getTime() + Math.max(0, atraso)).toISOString()
    novo = { ...cad, status: 'ATIVO', inicioEm: inicio, proximoEm: quandoDoPasso({ ...cad, inicioEm: inicio }, cad.passo) }
  } else if (acao === 'cancelar' && (cad.status === 'ATIVO' || cad.status === 'PAUSADO')) novo = { ...cad, status: 'CANCELADO', proximoEm: null, motivoFim: 'Cancelada pelo vendedor' }
  await prisma.assistenteConversa.update({ where: { id: c.id }, data: { cadencia: novo as unknown as Prisma.InputJsonValue } })
  return novo
}

/** Robô no lead: pausar (o vendedor assume) ou retomar o roteiro de onde parou. */
export async function mudarRobo(leadId: string, acao: 'pausar' | 'retomar') {
  const c = await prisma.assistenteConversa.findFirst({ where: { leadId, tipo: 'LEAD' }, orderBy: { ultimaMensagemEm: 'desc' }, select: { id: true, pausadoEm: true } })
  if (!c) return null
  const r = await prisma.assistenteConversa.update({ where: { id: c.id }, data: { pausadoEm: acao === 'pausar' ? (c.pausadoEm ?? new Date()) : null }, select: { id: true, pausadoEm: true } })
  return { ...r, pausadoAntes: c.pausadoEm }
}

type ConversaResumo = { status: string; robo: boolean; pausadoEm: Date | null; prontoEm: Date | null; resultado: string | null; etapaRoteiro: number; cadencia: Prisma.JsonValue | null } | undefined
/** Situação do robô e da cadência para o card do CRM. */
export function situacaoDoRobo(c: ConversaResumo, falta: string[]) {
  if (!c) return null
  const cad = lerCadenciaDaConversa(c.cadencia)
  const robo = !c.robo ? null
    : c.pausadoEm ? { codigo: 'PAUSADO', texto: 'Robô pausado' }
    : c.status === 'ATIVA' ? { codigo: 'COLETANDO', texto: falta.length ? `Robô coletando · falta ${falta.join(', ')}` : 'Robô coletando' }
    : c.prontoEm && !falta.length ? { codigo: 'PRONTO', texto: 'Pronto para simular' }
    : c.status === 'AGUARDANDO_VENDEDOR' ? { codigo: 'COM_VENDEDOR', texto: c.resultado === 'SUMIU' ? 'Robô entregou (cliente parou de responder)' : 'Robô entregou ao vendedor' }
    : null
  return { robo, cadencia: cad ? { status: cad.status, nome: cad.nome, texto: rotuloCadencia(cad), passo: cad.passo, total: cad.passos.length, proximoEm: cad.status === 'ATIVO' ? cad.proximoEm : null } : null }
}
