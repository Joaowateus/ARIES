// Aries no WhatsApp — as respostas, montadas com os números do sistema (sem
// IA). O vendedor recebe só o que é dele; o dono recebe a loja inteira
// (vendas, equipe, tráfego e financeiro), como já vê no painel.
import { prisma } from './prisma'
import { type Intencao, saudacaoDoHorario, textoAjuda, variar } from './agenteConversa'
import { responderPergunta, type AssistentePessoal } from './assistentePessoalDados'
import { filaDoCopiloto } from './copilotoFila'
import { EQUIPE, valeNoDia, type ItemAgenda } from './copilotoFatos'
import { gerarDia, telaDoDia } from './copiloto'
import { diaBrasilia } from './socialMediaSync'
import { gastoDoMes } from './gastoAnuncios'
import { ROTULO_ETAPA } from './assistenteJornada'

const H = 3600e3
const DIA = 24 * H

export interface ContextoAgente {
  usuarioId: string
  /** "DONO" ou o id do vendedor. */
  pessoa: string
  nome: string
  dono: boolean
  /** Assistente comercial do vendedor (para as perguntas do chat "Você"); null para o dono ou sem WhatsApp ligado. */
  assistente: AssistentePessoal | null
}

const reais = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const hhmm = (d: Date) => new Date(d.getTime() - 3 * H).toISOString().slice(11, 16)
const diaCurto = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const CANAL: Record<string, string> = { WHATSAPP: 'WhatsApp', LIGACAO: 'ligação', VISITA: 'visita', EMAIL: 'e-mail', OUTRO: 'contato' }
const pessoaCopiloto = (c: ContextoAgente) => (c.dono ? EQUIPE : c.pessoa)
const autorAgenda = (c: ContextoAgente) => (c.dono ? c.usuarioId : c.pessoa)

// ---------- Agenda do dia (rotinas + follows + tarefas) ----------

export async function agendaDoDia(c: ContextoAgente, agora = new Date(), amanha = false) {
  const hoje = diaBrasilia(agora)
  const dia = new Date(hoje.getTime() + (amanha ? DIA : 0))
  const inicio = new Date(dia.getTime() + 3 * H), fim = new Date(inicio.getTime() + DIA)
  const filtroVend = c.dono ? {} : { vendedorId: c.pessoa }
  const [itens, conclusoes, follows, atrasados, tarefas] = await Promise.all([
    prisma.agendaItem.findMany({ where: { usuarioId: c.usuarioId, ativo: true }, select: { id: true, titulo: true, tipo: true, data: true, diasSemana: true, dataInicio: true, dataFim: true, horario: true, vendedorIds: true, incluiDono: true, criadoEm: true } }),
    prisma.agendaConclusao.findMany({ where: { autorId: autorAgenda(c), dataReferencia: dia, item: { usuarioId: c.usuarioId } }, select: { agendaItemId: true } }),
    prisma.leadFollow.findMany({ where: { usuarioId: c.usuarioId, status: 'PENDENTE', agendadoPara: { gte: inicio, lt: fim }, lead: filtroVend }, orderBy: { agendadoPara: 'asc' }, take: 20, select: { agendadoPara: true, canal: true, nota: true, lead: { select: { nomeCliente: true } } } }),
    amanha ? Promise.resolve(0) : prisma.leadFollow.count({ where: { usuarioId: c.usuarioId, status: 'PENDENTE', agendadoPara: { lt: inicio }, lead: { ...filtroVend, estagio: { notIn: ['FECHADO', 'PERDIDO'] } } } }),
    prisma.agendaTarefa.findMany({ where: { usuarioId: c.usuarioId, autorId: autorAgenda(c), dia }, orderBy: [{ horario: 'asc' }, { criadoEm: 'asc' }], select: { titulo: true, horario: true, feitaEm: true } }),
  ])
  const feitas = new Set(conclusoes.map(x => x.agendaItemId))
  const rotinas = (itens as ItemAgenda[]).filter(i => valeNoDia(i, dia, autorAgenda(c), c.dono))
  type Linha = { hora: string | null; texto: string; feito: boolean }
  const linhas: Linha[] = [
    ...rotinas.map(r => ({ hora: r.horario, texto: r.titulo, feito: feitas.has(r.id) })),
    ...follows.map(f => ({ hora: hhmm(f.agendadoPara), texto: `Follow: ${f.lead.nomeCliente}${f.canal ? ` (${CANAL[f.canal] ?? f.canal})` : ''}${f.nota ? ` — "${f.nota}"` : ''}`, feito: false })),
    ...tarefas.map(t => ({ hora: t.horario, texto: t.titulo, feito: !!t.feitaEm })),
  ].sort((a, b) => (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99'))
  return { dia, linhas, atrasados }
}

function textoAgenda(c: ContextoAgente, a: Awaited<ReturnType<typeof agendaDoDia>>, amanha: boolean): string {
  const titulo = `🗓️ *Sua agenda ${amanha ? 'de amanhã' : 'de hoje'}* (${diaCurto(a.dia)})`
  if (!a.linhas.length) return [titulo, amanha ? 'Nada marcado ainda. Quer que eu anote algo? Ex.: *anota amanhã 9h ligar pro banco*.' : 'Nada marcado para hoje. Bom dia para prospectar! 💪', a.atrasados ? `⚠️ Tem ${plural(a.atrasados, 'follow atrasado', 'follows atrasados')}.` : ''].filter(Boolean).join('\n\n')
  const pend = a.linhas.filter(l => !l.feito).length
  return [
    titulo,
    a.linhas.map(l => `${l.feito ? '✅' : '•'} ${l.hora ? `*${l.hora}* ` : ''}${l.texto}`).join('\n'),
    [pend ? `Faltam ${pend} de ${a.linhas.length}.` : 'Tudo feito por hoje. 👏', a.atrasados ? `⚠️ E ${plural(a.atrasados, 'follow atrasado', 'follows atrasados')} de dias anteriores.` : ''].filter(Boolean).join(' '),
  ].join('\n\n')
}

// ---------- Fila do Copiloto ----------

async function textoAgora(c: ContextoAgente, agora: Date, grupo?: 'WHATSAPP' | 'FOLLOW' | 'COMPRA'): Promise<string> {
  const fila = await filaDoCopiloto(c.usuarioId, pessoaCopiloto(c), agora, 20).catch(() => null)
  const itens = (fila?.itens ?? []).filter(i => !grupo || i.grupo === grupo)
  if (!itens.length) return grupo === 'WHATSAPP' ? '✅ Ninguém esperando resposta agora.' : '✅ Ninguém pedindo atenção agora. Bom momento para prospectar ou estudar.'
  const top = itens.slice(0, 5)
  return [
    grupo === 'WHATSAPP' ? '⏳ *Esperando resposta:*' : '🎯 *Por onde começar:*',
    top.map((i, k) => `${k + 1}. *${i.nome}*${i.vendedor ? ` (${i.vendedor})` : ''} — ${i.motivo.texto.charAt(0).toLowerCase()}${i.motivo.texto.slice(1)}\n   ↳ ${i.passo}`).join('\n'),
    itens.length > top.length ? `E mais ${itens.length - top.length} na fila do Copiloto.` : '',
  ].filter(Boolean).join('\n\n')
}

// ---------- Números da loja (dono) ----------

async function textoVendas(c: ContextoAgente, agora: Date): Promise<string> {
  const hoje = diaBrasilia(agora)
  const ini = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1))
  const iniAnt = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1))
  const mesmoDiaAnt = new Date(iniAnt.getTime() + hoje.getUTCDate() * DIA)
  const [mes, ant, hojeV, param] = await Promise.all([
    prisma.venda.aggregate({ where: { usuarioId: c.usuarioId, data: { gte: ini } }, _count: { _all: true }, _sum: { valorVenda: true } }),
    prisma.venda.aggregate({ where: { usuarioId: c.usuarioId, data: { gte: iniAnt, lt: mesmoDiaAnt } }, _count: { _all: true }, _sum: { valorVenda: true } }),
    prisma.venda.count({ where: { usuarioId: c.usuarioId, data: { gte: hoje } } }),
    prisma.parametroLiquidez.findUnique({ where: { usuarioId: c.usuarioId }, select: { metaFaturamentoAnual: true } }),
  ])
  const total = mes._sum.valorVenda ?? 0, antes = ant._sum.valorVenda ?? 0
  const meta = param?.metaFaturamentoAnual ? param.metaFaturamentoAnual / 12 : 0
  const diasNoMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0)).getUTCDate()
  const linhas = [
    `💰 *Vendas do mês* (até ${hoje.getUTCDate()}/${String(hoje.getUTCMonth() + 1).padStart(2, '0')})`,
    [
      `• ${plural(mes._count._all, 'venda', 'vendas')} · ${reais(total)}${hojeV ? ` (${hojeV} hoje)` : ''}`,
      `• Mesmo ponto do mês passado: ${plural(ant._count._all, 'venda', 'vendas')} · ${reais(antes)}${antes > 0 ? ` (${total >= antes ? '↑' : '↓'} ${Math.abs(Math.round(((total - antes) / antes) * 100))}%)` : ''}`,
      ...(meta > 0 ? [`• Meta do mês: ${Math.round((total / meta) * 100)}% atingida, com ${Math.round((hoje.getUTCDate() / diasNoMes) * 100)}% do mês passado`] : []),
    ].join('\n'),
  ]
  return linhas.join('\n\n')
}

async function textoEquipe(c: ContextoAgente, agora: Date): Promise<string> {
  if (!(await telaDoDia(c.usuarioId, EQUIPE, agora))) await gerarDia(c.usuarioId, EQUIPE, { agora })
  const tela = await telaDoDia(c.usuarioId, EQUIPE, agora)
  const equipe = tela?.fatos.equipe ?? []
  if (!equipe.length) return 'Ainda não tenho números da equipe hoje. Os vendedores aparecem quando têm leads no CRM.'
  const ordem = [...equipe].sort((a, b) => b.indice - a.indice)
  return [
    `👥 *A equipe hoje* (índice de execução do Copiloto)`,
    ordem.map(l => `• *${l.nome}* — ${l.indice} · ${l.carteira} em aberto${l.parados ? ` · ${l.parados} parados` : ''}${l.esperandoWhatsapp ? ` · ⏳ ${l.esperandoWhatsapp} esperando` : ''}`).join('\n'),
    ordem.length > 1 && ordem[ordem.length - 1].indice < 70 ? `Quem precisa de você primeiro: *${ordem[ordem.length - 1].nome}*.` : '',
  ].filter(Boolean).join('\n\n')
}

async function textoTrafego(c: ContextoAgente, agora: Date): Promise<string> {
  const hoje = diaBrasilia(agora)
  const mes = hoje.toISOString().slice(0, 7)
  const ini = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1))
  const [gasto, leads, doAnuncio] = await Promise.all([
    gastoDoMes(c.usuarioId, mes),
    prisma.lead.count({ where: { usuarioId: c.usuarioId, criadoEm: { gte: ini } } }),
    prisma.lead.count({ where: { usuarioId: c.usuarioId, criadoEm: { gte: ini }, tipoLead: 'TRAFEGO' } }),
  ])
  if (gasto.fonte === 'NENHUM') return `📣 Ainda não tenho o gasto com anúncios deste mês. Conecte a conta de anúncios na aba Tráfego (ou lance o gasto em Indicadores).\n\nLeads do mês: ${leads} (${doAnuncio} de tráfego pago).`
  const base = doAnuncio || leads
  return [
    `📣 *Tráfego do mês*${gasto.fonte === 'TRAFEGO' ? ' (Meta Ads)' : ' (gasto lançado)'}`,
    [`• Gasto: ${reais(gasto.valor)}`, `• Leads: ${leads}${doAnuncio ? ` (${doAnuncio} de tráfego pago)` : ''}`, ...(base ? [`• Custo por lead: ${reais(gasto.valor / base)}`] : [])].join('\n'),
  ].join('\n\n')
}

const CATEGORIA_FIN: Record<string, string> = { SALARIO: 'Salários', ADIANTAMENTO: 'Vales', BONIFICACAO: 'Bonificações', REEMBOLSO: 'Reembolsos', INVESTIMENTO: 'Investimentos', CUSTO: 'Custos', OUTRO: 'Outros' }
async function textoFinanceiro(c: ContextoAgente, agora: Date): Promise<string> {
  const hoje = diaBrasilia(agora)
  const ini = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1) + 3 * H)
  const grupos = await prisma.lancamentoFinanceiro.groupBy({ by: ['categoria'], where: { usuarioId: c.usuarioId, canceladoEm: null, pagoEm: { gte: ini } }, _sum: { valorTotal: true }, _count: { _all: true } })
  if (!grupos.length) return '🧾 Nenhum pagamento lançado neste mês ainda.'
  const total = grupos.reduce((s, g) => s + (g._sum.valorTotal ?? 0), 0)
  return [
    `🧾 *Pago no mês:* ${reais(total)}`,
    grupos.sort((a, b) => (b._sum.valorTotal ?? 0) - (a._sum.valorTotal ?? 0)).map(g => `• ${CATEGORIA_FIN[g.categoria] ?? g.categoria}: ${reais(g._sum.valorTotal ?? 0)} (${plural(g._count._all, 'recibo', 'recibos')})`).join('\n'),
  ].join('\n\n')
}

// ---------- Plano do Copiloto ----------

async function textoPlano(c: ContextoAgente, agora: Date): Promise<string> {
  const pessoa = pessoaCopiloto(c)
  if (!(await telaDoDia(c.usuarioId, pessoa, agora))) await gerarDia(c.usuarioId, pessoa, { agora })
  const tela = await telaDoDia(c.usuarioId, pessoa, agora)
  const pend = (tela?.acoes ?? []).filter(a => a.status === 'PENDENTE')
  if (!pend.length) return '✅ Plano de hoje concluído. Se sobrar tempo: prospecção e estudo.'
  return ['📋 *Seu plano de hoje* (do Copiloto)', pend.slice(0, 6).map((a, i) => `${i + 1}. ${a.texto}`).join('\n'), 'Para ver quem atender primeiro agora, mande *quem atendo agora*.'].join('\n\n')
}

// ---------- Resumo da manhã ----------

export async function resumoDaManha(c: ContextoAgente, agora = new Date()): Promise<string> {
  const [ag, fila] = await Promise.all([agendaDoDia(c, agora), filaDoCopiloto(c.usuarioId, pessoaCopiloto(c), agora, 20).catch(() => null)])
  const urgentes = (fila?.itens ?? []).filter(i => i.prioridade >= 85)
  const partes = [
    `${saudacaoDoHorario(agora)}, ${c.nome}! ☀️`,
    ag.linhas.length || ag.atrasados
      ? `Hoje você tem ${[ag.linhas.length ? plural(ag.linhas.length, 'compromisso na agenda', 'compromissos na agenda') : '', ag.atrasados ? plural(ag.atrasados, 'follow atrasado', 'follows atrasados') : ''].filter(Boolean).join(' e ')}.${ag.linhas.find(l => l.hora) ? ` O primeiro é às ${ag.linhas.find(l => l.hora)!.hora}.` : ''}`
      : 'Agenda livre hoje.',
    urgentes.length
      ? `Começaria por aqui:\n${urgentes.slice(0, 3).map(i => `• *${i.nome}*${i.vendedor ? ` (${i.vendedor})` : ''} — ${i.motivo.texto.charAt(0).toLowerCase()}${i.motivo.texto.slice(1)}`).join('\n')}`
      : '',
    // O dono também recebe como estão as vendas do mês.
    c.dono ? await textoVendas(c, agora) : '',
    'Quer a lista completa? Manda *minha agenda* ou *quem atendo agora*.',
  ]
  return partes.filter(Boolean).join('\n\n')
}

// ---------- Roteamento ----------

export async function responderIntencao(c: ContextoAgente, i: Intencao, agora = new Date()): Promise<string> {
  const semente = `${c.pessoa}|${diaBrasilia(agora).toISOString().slice(0, 10)}|${i.tipo}`
  switch (i.tipo) {
    case 'SAUDACAO': {
      const fila = await filaDoCopiloto(c.usuarioId, pessoaCopiloto(c), agora, 20).catch(() => null)
      const esperando = fila?.porGrupo.WHATSAPP ?? 0, urgentes = fila?.urgentes ?? 0
      const status = esperando ? `Tem ${plural(esperando, 'pessoa esperando', 'pessoas esperando')} resposta no WhatsApp.` : urgentes ? `Tem ${plural(urgentes, 'lead pedindo', 'leads pedindo')} atenção agora.` : variar(['Por aqui está tudo tranquilo.', 'Nada urgente por enquanto.', 'Tudo em ordem por aqui.'], semente)
      return `${saudacaoDoHorario(agora)}, ${c.nome}! ${variar(['👋', '😊', '🙌'], semente)}\n\n${status} ${esperando || urgentes ? 'Quer ver por onde começar? Manda *quem atendo agora*.' : 'Se precisar, é só chamar.'}`
    }
    case 'OBRIGADO': return variar(['Imagina! 😉', 'Tamo junto! 💪', 'Por nada! Qualquer coisa é só chamar.'], semente)
    case 'AJUDA': return textoAjuda(c.nome, c.dono)
    case 'AGORA': return textoAgora(c, agora)
    case 'AGENDA': return textoAgenda(c, await agendaDoDia(c, agora, i.amanha), i.amanha)
    case 'PLANO': return textoPlano(c, agora)
    case 'ANOTAR': {
      const dia = new Date(diaBrasilia(agora).getTime() + (i.amanha ? DIA : 0))
      await prisma.agendaTarefa.create({ data: { usuarioId: c.usuarioId, autorId: autorAgenda(c), titulo: i.titulo.slice(0, 200), dia, horario: i.horario } })
      return `Anotado ✅ *${i.titulo}* ${i.amanha ? 'amanhã' : 'hoje'}${i.horario ? ` às ${i.horario}` : ''}.\n\nJá está no *Meu dia* da sua Agenda.`
    }
    case 'VENDAS': case 'EQUIPE': case 'TRAFEGO': case 'FINANCEIRO':
      if (!c.dono) return 'Esses números da loja inteira ficam com o gestor. Posso te mostrar os seus: manda *meu mês* ou *como estou hoje*.'
      return i.tipo === 'VENDAS' ? textoVendas(c, agora) : i.tipo === 'EQUIPE' ? textoEquipe(c, agora) : i.tipo === 'TRAFEGO' ? textoTrafego(c, agora) : textoFinanceiro(c, agora)
    case 'PAUSAR': return 'Combinado, pausei os avisos e o resumo da manhã. Para voltar, manda *voltar a avisar*. Perguntas continuam valendo a qualquer hora.'
    case 'RETOMAR': return 'Pronto, voltei com os avisos e o resumo da manhã. 👍'
    case 'VINCULAR': return 'Este número já está vinculado a você. 😉'
    case 'PESSOAL': {
      const p = i.pergunta
      if (c.dono) {
        // O dono não tem um WhatsApp de vendas próprio: as perguntas viram a visão da loja.
        if (p.tipo === 'HOJE' || p.tipo === 'SEMANA' || p.tipo === 'MES') return textoVendas(c, agora)
        if (p.tipo === 'ESPERANDO') return textoAgora(c, agora, 'WHATSAPP')
        if (p.tipo === 'QUENTES') return textoAgora(c, agora, 'COMPRA')
        if (p.tipo === 'FOLLOWS') return textoAgora(c, agora, 'FOLLOW')
        if (p.tipo === 'LEAD') return textoLead(c, p.nome)
      }
      if (c.assistente) return responderPergunta(c.assistente, p, agora)
      if (p.tipo === 'ESPERANDO') return textoAgora(c, agora, 'WHATSAPP')
      if (p.tipo === 'FOLLOWS') return textoAgora(c, agora, 'FOLLOW')
      if (p.tipo === 'QUENTES') return textoAgora(c, agora, 'COMPRA')
      if (p.tipo === 'LEAD') return textoLead(c, p.nome)
      return 'Para essa eu preciso do seu WhatsApp de vendas ligado no Assistente Comercial. Enquanto isso, posso te mostrar *minha agenda* ou *quem atendo agora*.'
    }
  }
}

/** Situação de um lead pelo nome (o dono busca na loja toda; o vendedor, nos dele). */
async function textoLead(c: ContextoAgente, nome: string): Promise<string> {
  const leads = await prisma.lead.findMany({
    where: { usuarioId: c.usuarioId, ...(c.dono ? {} : { vendedorId: c.pessoa }), nomeCliente: { contains: nome.trim(), mode: 'insensitive' } },
    orderBy: { atualizadoEm: 'desc' }, take: 3,
    select: { nomeCliente: true, estagio: true, pontuacao: true, modeloInteresse: true, etiquetas: true, vendedor: { select: { nome: true } }, follows: { where: { status: 'PENDENTE' }, orderBy: { agendadoPara: 'asc' }, take: 1, select: { agendadoPara: true } } },
  })
  if (!leads.length) return `Não achei nenhum lead com "${nome}". Tenta com outro pedaço do nome.`
  return leads.map(l => [
    `👤 *${l.nomeCliente}* — ${ROTULO_ETAPA[l.estagio] ?? l.estagio}${l.pontuacao != null ? ` · nota ${l.pontuacao}` : ''}`,
    [l.modeloInteresse ? `Moto: ${l.modeloInteresse}` : '', c.dono && l.vendedor ? `Vendedor: ${l.vendedor.nome}` : '', l.follows[0] ? `Próximo follow: ${l.follows[0].agendadoPara.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })} ${hhmm(l.follows[0].agendadoPara)}` : ''].filter(Boolean).join(' · '),
  ].filter(Boolean).join('\n')).join('\n\n')
}
