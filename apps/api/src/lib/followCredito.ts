// Follow de crédito recusado: quando nenhum banco aprovou (pelo menos uma
// recusa, nenhuma aprovada e nenhuma ainda em análise), o vendedor ganha um
// follow para daqui a N dias (30 por padrão): chamar o cliente de novo e,
// com a nova autorização dele, refazer a pré-análise para ver se a restrição
// continua. É só do vendedor: nada vai para o cliente sozinho, e o nome dos
// bancos fica no contexto do follow (fora da nota, que o Aries e o resumo
// leem). Aprovou em algum banco: o follow pendente é cancelado.
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { logger } from './logger'
import { lerConfigFollow } from './assistenteFollow'
import { avisarNoWhatsapp } from './ligacoesAviso'

const DIA = 864e5, HORA = 3600e3
export const NOTA_CREDITO = 'Nova pré-análise de crédito: chame o cliente e, se ele autorizar, refaça a consulta para ver se a restrição continua.'
export interface ContextoCredito { conversaId: string; bancos: string[]; recusadoEm: string }

/** Nenhum banco aprovou: pelo menos uma recusa, nenhuma aprovada, nenhuma em análise. */
export function semAprovacao(analises: Array<{ status: string }>): boolean {
  return analises.some(a => a.status === 'RECUSADA') && !analises.some(a => a.status === 'APROVADA' || a.status === 'EM_ANALISE')
}

/** 10h (Brasília) do dia que cai daqui a `dias` dias. */
export function dataDaNovaAnalise(dias: number, agora = new Date()): Date {
  const dia = new Date(agora.getTime() - 3 * HORA + dias * DIA).toISOString().slice(0, 10)
  return new Date(`${dia}T13:00:00.000Z`)
}

const CONVERSA = {
  id: true, assistente: { select: { vendedorId: true, vendedor: { select: { usuarioId: true } } } },
  lead: { select: { id: true, usuarioId: true, vendedorId: true, estagio: true } },
  ficha: { select: { analises: { select: { banco: true, status: true, respondidoEm: true } } } },
} satisfies Prisma.AssistenteConversaSelect

/** Agenda (ou remarca) a nova análise do lead da conversa. */
export async function agendarNovaAnalise(conversaId: string, dias: number, autor: string | null, agora = new Date()) {
  const c = await prisma.assistenteConversa.findUnique({ where: { id: conversaId }, select: CONVERSA })
  if (!c?.lead) return null
  const recusas = (c.ficha?.analises ?? []).filter(a => a.status === 'RECUSADA')
  const recusadoEm = recusas.reduce<Date | null>((m, a) => (a.respondidoEm && (!m || a.respondidoEm > m) ? a.respondidoEm : m), null) ?? agora
  const contexto: ContextoCredito = { conversaId, bancos: recusas.map(a => a.banco), recusadoEm: recusadoEm.toISOString() }
  return prisma.$transaction(async tx => {
    await tx.leadFollow.updateMany({ where: { leadId: c.lead!.id, tipo: 'CREDITO', status: 'PENDENTE' }, data: { status: 'CANCELADO', resultado: 'Reagendado' } })
    return tx.leadFollow.create({
      data: {
        usuarioId: c.lead!.usuarioId, leadId: c.lead!.id, vendedorId: c.lead!.vendedorId ?? c.assistente.vendedorId, tipo: 'CREDITO', canal: 'WHATSAPP',
        agendadoPara: dataDaNovaAnalise(dias, agora), nota: NOTA_CREDITO, contexto: contexto as unknown as Prisma.InputJsonValue, criadoPor: autor ?? 'Pré-análise (automático)',
      },
      select: { id: true, agendadoPara: true },
    })
  })
}

/**
 * Depois de cada resposta de banco: aprovou, cancela a nova análise
 * pendente; ficou sem aprovação, agenda (uma vez por recusa: se o vendedor
 * cancelou, não volta sozinha).
 */
export async function sincronizarFollowCredito(conversaId: string, agora = new Date()): Promise<void> {
  const c = await prisma.assistenteConversa.findUnique({ where: { id: conversaId }, select: CONVERSA })
  if (!c?.lead || !c.ficha) return
  const analises = c.ficha.analises
  if (analises.some(a => a.status === 'APROVADA')) {
    await prisma.leadFollow.updateMany({ where: { leadId: c.lead.id, tipo: 'CREDITO', status: 'PENDENTE' }, data: { status: 'CANCELADO', resultado: 'Crédito aprovado' } })
    return
  }
  if (!semAprovacao(analises) || c.lead.estagio === 'FECHADO') return
  const ultimaRecusa = analises.reduce<Date | null>((m, a) => (a.status === 'RECUSADA' && a.respondidoEm && (!m || a.respondidoEm > m) ? a.respondidoEm : m), null)
  const jaTem = await prisma.leadFollow.count({ where: { leadId: c.lead.id, tipo: 'CREDITO', OR: [{ status: 'PENDENTE' }, ...(ultimaRecusa ? [{ criadoEm: { gte: ultimaRecusa } }] : [])] } })
  if (jaTem) return
  const loja = await prisma.assistenteLoja.findUnique({ where: { usuarioId: c.assistente.vendedor.usuarioId }, select: { followConfig: true } })
  const { credito } = lerConfigFollow(loja?.followConfig)
  if (!credito.ativo) return
  await agendarNovaAnalise(conversaId, credito.dias, null, agora)
}

/**
 * Nova consulta com a autorização renovada pelo cliente: as recusas voltam
 * para "a enviar" (a recusa anterior fica na observação), a autorização
 * nova é registrada e a nova análise pendente é dada como feita.
 */
export async function reabrirPreAnalise(conversaId: string, autor: string, agora = new Date()): Promise<boolean> {
  const ficha = await prisma.assistenteFichaCredito.findUnique({ where: { conversaId }, include: { analises: true, conversa: { select: { leadId: true } } } })
  if (!ficha || !ficha.analises.some(a => a.status === 'RECUSADA')) return false
  const data = (d: Date | null) => (d ? new Date(d.getTime() - 3 * HORA).toISOString().slice(0, 10).split('-').reverse().join('/') : null)
  await prisma.$transaction(async tx => {
    for (const a of ficha.analises.filter(x => x.status === 'RECUSADA')) {
      const antes = [`Recusada${data(a.respondidoEm) ? ` em ${data(a.respondidoEm)}` : ''}`, a.observacao].filter(Boolean).join(': ')
      await tx.assistenteAnaliseCredito.update({
        where: { id: a.id },
        data: { status: 'A_ENVIAR', entrada: null, prazo: null, parcela: null, taxa: null, respondidoEm: null, enviadaAoClienteEm: null, observacao: antes.slice(0, 300) },
      })
    }
    await tx.assistenteFichaCredito.update({
      where: { id: ficha.id },
      data: { consentimento: { em: agora.toISOString(), pergunta: 'Nova consulta depois da recusa', resposta: `confirmada por ${autor}`, anterior: ficha.consentimento } as Prisma.InputJsonValue },
    })
    if (ficha.conversa.leadId) {
      await tx.leadFollow.updateMany({ where: { leadId: ficha.conversa.leadId, tipo: 'CREDITO', status: 'PENDENTE' }, data: { status: 'FEITO', feitoEm: agora, resultado: 'Pré-análise reaberta (o cliente autorizou a nova consulta)' } })
    }
  })
  return true
}

const dentroDoHorario = (agora: Date) => { const h = new Date(agora.getTime() - 3 * HORA).getUTCHours(); return h >= 8 && h < 20 }

/** Job de minuto: avisa o vendedor no dia da nova análise (Aries ou chat "Você"), uma vez. */
export async function avisarFollowsCredito(agora = new Date()): Promise<{ avisosCredito: number }> {
  if (!dentroDoHorario(agora)) return { avisosCredito: 0 }
  const vencidos = await prisma.leadFollow.findMany({
    where: { tipo: 'CREDITO', status: 'PENDENTE', avisadoEm: null, agendadoPara: { lte: agora, gte: new Date(agora.getTime() - 7 * DIA) } },
    select: { id: true, usuarioId: true, vendedorId: true, contexto: true, lead: { select: { id: true, nomeCliente: true } } },
    orderBy: { agendadoPara: 'asc' }, take: 100,
  })
  if (!vencidos.length) return { avisosCredito: 0 }
  const base = process.env.FRONTEND_URL?.replace(/\/+$/, '')
  const porPessoa = new Map<string, typeof vencidos>()
  for (const f of vencidos) porPessoa.set(`${f.usuarioId}|${f.vendedorId ?? ''}`, [...(porPessoa.get(`${f.usuarioId}|${f.vendedorId ?? ''}`) ?? []), f])
  let enviados = 0
  for (const itens of porPessoa.values()) {
    const marcados = await prisma.leadFollow.updateMany({ where: { id: { in: itens.map(i => i.id) }, avisadoEm: null }, data: { avisadoEm: agora } })
    if (!marcados.count) continue
    const linhas = itens.slice(0, 6).map(f => {
      const desde = (f.contexto as ContextoCredito | null)?.recusadoEm
      const dias = desde ? Math.max(1, Math.round((agora.getTime() - Date.parse(desde)) / DIA)) : null
      return `• *${f.lead.nomeCliente}*${dias ? ` — faz ${dias} dias da recusa` : ''}${base ? `\n  ${base}/pro-labore/leads?lead=${f.lead.id}&follow=${f.id}` : ''}`
    })
    const texto = [
      `🔁 *Nova análise de crédito${itens.length > 1 ? ` (${itens.length})` : ''}*`, '',
      ...linhas, '',
      'Chame o cliente e, se ele autorizar, refaça a pré-análise nos bancos para ver se a restrição continua.',
    ].join('\n')
    try {
      if (await avisarNoWhatsapp(itens[0].usuarioId, itens[0].vendedorId, texto)) enviados++
    } catch (e) {
      logger.warn({ err: e }, 'follow de crédito: falha ao avisar pelo WhatsApp')
    }
  }
  return { avisosCredito: enviados }
}
