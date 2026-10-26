// Copiloto Comercial: coleta da fila de "próxima melhor ação" no banco. As
// regras (motivos, pesos, próximo passo) ficam em copilotoFilaRegras.ts.
import { prisma } from './prisma'
import { ESTAGIOS_ABERTOS, escopoDa, primeiroNome, rankEstagio } from './copilotoFatos'
import { diaBrasilia, inicioDoDiaBrasilia } from './socialMediaSync'
import { itemDaFila, type GrupoFila, type ItemFila } from './copilotoFilaRegras'

export * from './copilotoFilaRegras'

const H = 3600e3
const DIA = 24 * H

export interface FilaCopiloto {
  itens: ItemFila[]
  total: number
  urgentes: number
  porGrupo: Record<GrupoFila, number>
  geradoEm: string
}

/** A fila ao vivo da pessoa (um vendedor ou EQUIPE). */
export async function filaDoCopiloto(usuarioId: string, pessoa: string, agora = new Date(), limite = 20): Promise<FilaCopiloto | null> {
  const esc = await escopoDa(usuarioId, pessoa)
  if (!esc) return null
  const t = agora.getTime()
  const inicioHoje = inicioDoDiaBrasilia(diaBrasilia(agora)).getTime()
  const filtroVend = esc.vendedorIds ? { vendedorId: { in: esc.vendedorIds } } : {}
  const [leads, conversas, vendedores] = await Promise.all([
    prisma.lead.findMany({
      where: { usuarioId, ...filtroVend, vendaId: null, estagio: { in: [...ESTAGIOS_ABERTOS] } },
      select: {
        id: true, nomeCliente: true, estagio: true, modeloInteresse: true, vendedorId: true, pontuacao: true, etiquetas: true, criadoEm: true, atualizadoEm: true,
        historico: { select: { criadoEm: true, estagioNovo: true }, orderBy: { criadoEm: 'desc' }, take: 20 },
        follows: { where: { status: 'PENDENTE', agendadoPara: { lt: new Date(inicioHoje + DIA) } }, orderBy: { agendadoPara: 'asc' }, take: 1, select: { id: true, agendadoPara: true, nota: true, canal: true } },
      },
      take: 3000,
    }),
    esc.assistenteIds.length
      ? prisma.assistenteConversa.findMany({
        where: { assistenteId: { in: esc.assistenteIds }, tipo: 'LEAD', status: { in: ['AGUARDANDO_VENDEDOR', 'ASSUMIDA'] } },
        select: {
          id: true, leadId: true, nomeContato: true, status: true, aguardandoVendedorEm: true, ultimaMensagemEm: true,
          assistente: { select: { vendedor: { select: { nome: true } } } },
          mensagens: { orderBy: { criadoEm: 'desc' }, take: 1, select: { remetente: true, criadoEm: true } },
        },
      })
      : Promise.resolve([]),
    prisma.vendedor.findMany({ where: { usuarioId }, select: { id: true, nome: true } }),
  ])
  const nomeVend = new Map(vendedores.map(v => [v.id, primeiroNome(v.nome)]))
  const daEquipe = !esc.vendedorIds

  // Situação de cada conversa pendente (mesma regra dos fatos do dia).
  const situacao = new Map<string, { id: string; situacao: 'ESPERANDO' | 'SEM_RESPOSTA'; horas: number; nome: string; vendedor: string | null; leadId: string | null }>()
  for (const c of conversas) {
    const vendedor = daEquipe ? primeiroNome(c.assistente.vendedor.nome) : null
    if (c.status === 'AGUARDANDO_VENDEDOR') {
      const desde = (c.aguardandoVendedorEm ?? c.ultimaMensagemEm).getTime()
      situacao.set(c.id, { id: c.id, situacao: 'ESPERANDO', horas: (t - desde) / H, nome: primeiroNome(c.nomeContato), vendedor, leadId: c.leadId })
    } else {
      const ultima = c.mensagens[0]
      if (ultima && ultima.remetente === 'CONTATO' && t - ultima.criadoEm.getTime() > 2 * H) situacao.set(c.id, { id: c.id, situacao: 'SEM_RESPOSTA', horas: (t - ultima.criadoEm.getTime()) / H, nome: primeiroNome(c.nomeContato), vendedor, leadId: c.leadId })
    }
  }
  const conversaDoLead = new Map([...situacao.values()].filter(s => s.leadId).map(s => [s.leadId!, s]))

  const itens: ItemFila[] = []
  for (const l of leads) {
    const ultimo = Math.max(l.atualizadoEm.getTime(), l.criadoEm.getTime(), l.historico[0]?.criadoEm.getTime() ?? 0)
    const f = l.follows[0]
    const conv = conversaDoLead.get(l.id)
    const item = itemDaFila({
      leadId: l.id, nome: l.nomeCliente.trim() || 'Cliente', estagio: l.estagio, modelo: l.modeloInteresse,
      vendedor: daEquipe && l.vendedorId ? nomeVend.get(l.vendedorId) ?? null : null,
      pontuacao: l.pontuacao, etiquetas: l.etiquetas,
      diasParado: Math.floor((t - ultimo) / DIA), semAbordagem: !l.historico.some(h => rankEstagio(h.estagioNovo) >= 1), horasDesdeCriacao: (t - l.criadoEm.getTime()) / H,
      follow: f ? { id: f.id, atrasoDias: Math.max(0, Math.floor((inicioHoje - f.agendadoPara.getTime()) / DIA) + (f.agendadoPara.getTime() < inicioHoje ? 1 : 0)), nota: f.nota, canal: f.canal } : null,
      conversa: conv ? { id: conv.id, situacao: conv.situacao, horas: conv.horas } : null,
    })
    if (item) itens.push(item)
  }
  // Conversa pendente sem lead aberto no CRM (ainda não virou card, ou o cliente
  // já comprou e voltou a escrever): entra pela conversa.
  const abertos = new Set(leads.map(l => l.id))
  for (const s of situacao.values()) {
    if (s.leadId && abertos.has(s.leadId)) continue
    const item = itemDaFila({ leadId: s.leadId, nome: s.nome, estagio: null, modelo: null, vendedor: s.vendedor, pontuacao: null, etiquetas: [], diasParado: 0, semAbordagem: false, horasDesdeCriacao: 0, follow: null, conversa: { id: s.id, situacao: s.situacao, horas: s.horas } })
    if (item) itens.push(item)
  }

  itens.sort((a, b) => b.prioridade - a.prioridade || (b.pontuacao ?? 0) - (a.pontuacao ?? 0) || a.nome.localeCompare(b.nome))
  const porGrupo: Record<GrupoFila, number> = { WHATSAPP: 0, FOLLOW: 0, COMPRA: 0, CARTEIRA: 0 }
  for (const i of itens) porGrupo[i.grupo]++

  // A conversa de cada lead do topo (para o botão "Abrir a conversa"), mesmo sem pendência.
  const topo = itens.slice(0, limite)
  const semConversa = topo.filter(i => i.leadId && !i.conversaId).map(i => i.leadId!)
  if (semConversa.length) {
    const doLead = await prisma.assistenteConversa.findMany({ where: { leadId: { in: semConversa }, tipo: 'LEAD' }, orderBy: { ultimaMensagemEm: 'desc' }, select: { id: true, leadId: true } })
    for (const i of topo) if (i.leadId && !i.conversaId) i.conversaId = doLead.find(c => c.leadId === i.leadId)?.id ?? null
  }
  return { itens: topo, total: itens.length, urgentes: itens.filter(i => i.prioridade >= 85).length, porGrupo, geradoEm: agora.toISOString() }
}
