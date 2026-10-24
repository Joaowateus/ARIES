// Respostas do assistente pessoal (chat "Você") com os números do sistema.
// Tudo montado por modelo pronto, sem IA; valores em reais saem direto do
// banco, só para o próprio vendedor.
import { prisma } from './prisma'
import { Pergunta, TEXTO_AJUDA_PESSOAL } from './assistentePessoal'
import { acharConhecimento, preencherResposta } from './assistenteConhecimento'
import { respostasAtivas, vitrineDaLoja } from './assistenteRespostas'
import { acharMotos, fichaTexto } from './assistenteVitrine'
import { ETIQUETAS, ROTULO_ETAPA } from './assistenteJornada'
import { faixaNota } from './assistenteNota'
import { inicioDoDiaBrt } from './assistenteFollow'

const DIA = 86_400_000
const ABERTOS = { notIn: ['FECHADO', 'PERDIDO'] }
const reais = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const primeiro = (nome: string) => { const p = nome.trim().split(/\s+/)[0] ?? nome; return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() }

export interface AssistentePessoal { id: string; vendedorId: string; vendedor: { nome: string; usuarioId: string } }

export function tempoDesde(d: Date, agora = new Date()): string {
  const min = Math.max(0, Math.round((agora.getTime() - d.getTime()) / 60_000))
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.round(h / 24)} dia(s)`
}

export interface Esperando { conversaId: string; nome: string; numero: string; desde: Date; ultima: string }

/**
 * Leads esperando o vendedor: o robô terminou e ninguém respondeu, ou o
 * cliente mandou a última mensagem numa conversa que o vendedor assumiu.
 */
export async function leadsEsperando(assistenteId: string, agora = new Date()): Promise<Esperando[]> {
  const conversas = await prisma.assistenteConversa.findMany({
    where: { assistenteId, tipo: 'LEAD', status: { in: ['AGUARDANDO_VENDEDOR', 'ASSUMIDA'] }, ultimaMensagemEm: { gte: new Date(agora.getTime() - 3 * DIA) } },
    select: { id: true, nomeContato: true, numeroContato: true, status: true, aguardandoVendedorEm: true, mensagens: { orderBy: { criadoEm: 'desc' }, take: 6, select: { remetente: true, texto: true, criadoEm: true } } },
  })
  const lista: Esperando[] = []
  for (const c of conversas) {
    const [ultima] = c.mensagens
    const doCliente = c.mensagens.find(m => m.remetente === 'CONTATO')
    if (!ultima) continue
    let desde: Date | null = null
    if (ultima.remetente === 'CONTATO') desde = ultima.criadoEm
    else if (c.status === 'AGUARDANDO_VENDEDOR' && !c.mensagens.some(m => m.remetente === 'VENDEDOR')) desde = c.aguardandoVendedorEm ?? ultima.criadoEm
    if (desde) lista.push({ conversaId: c.id, nome: c.nomeContato, numero: c.numeroContato, desde, ultima: (doCliente?.texto ?? '').slice(0, 80) })
  }
  return lista.sort((a, b) => a.desde.getTime() - b.desde.getTime())
}

async function numerosDoPeriodo(a: AssistentePessoal, desde: Date) {
  const { vendedorId } = a
  const [leads, avancos, vendas] = await Promise.all([
    prisma.lead.count({ where: { vendedorId, criadoEm: { gte: desde } } }),
    prisma.leadEstagioHistorico.count({ where: { lead: { vendedorId }, criadoEm: { gte: desde }, estagioNovo: { in: ['NEGOCIACAO', 'PROPOSTA'] } } }),
    prisma.venda.aggregate({ where: { vendedorId, data: { gte: desde } }, _count: { _all: true }, _sum: { valorVenda: true } }),
  ])
  return { leads, avancos, vendas: vendas._count._all, vendido: vendas._sum.valorVenda ?? 0 }
}

async function followsDoDia(a: AssistentePessoal, agora: Date) {
  const fimDoDia = new Date(inicioDoDiaBrt(agora).getTime() + DIA)
  return prisma.leadFollow.findMany({
    where: { vendedorId: a.vendedorId, status: 'PENDENTE', agendadoPara: { lt: fimDoDia }, lead: { estagio: ABERTOS } },
    orderBy: { agendadoPara: 'asc' }, take: 8,
    select: { agendadoPara: true, nota: true, lead: { select: { nomeCliente: true } } },
  })
}

async function quentes(a: AssistentePessoal, n = 5) {
  return prisma.lead.findMany({
    where: { vendedorId: a.vendedorId, pontuacao: { gte: 70 }, estagio: ABERTOS, vendaId: null },
    orderBy: { pontuacao: 'desc' }, take: n,
    select: { nomeCliente: true, pontuacao: true, estagio: true, etiquetas: true },
  })
}

const etiquetasCurtas = (e: string[]) => e.filter(x => x !== 'QUENTE').slice(0, 2).map(x => ETIQUETAS[x as keyof typeof ETIQUETAS] ?? x).join(', ')

export { primeiro as primeiroNomeVendedor }

export async function resumoDoDia(a: AssistentePessoal, agora = new Date(), titulo = `📊 *Seu dia, ${primeiro(a.vendedor.nome)}*`): Promise<string> {
  const hoje = inicioDoDiaBrt(agora)
  const [dia, esperando, follows, top] = await Promise.all([numerosDoPeriodo(a, hoje), leadsEsperando(a.id, agora), followsDoDia(a, agora), quentes(a, 3)])
  const atrasados = follows.filter(f => f.agendadoPara < hoje).length
  return [
    titulo,
    '',
    `• Leads novos hoje: ${dia.leads}`,
    `• Avançaram para negociação/proposta: ${dia.avancos}`,
    `• Vendas hoje: ${dia.vendas}${dia.vendas ? ` (${reais(dia.vendido)})` : ''}`,
    `• Esperando sua resposta: ${esperando.length}`,
    `• Follows para hoje: ${follows.length}${atrasados ? ` (${atrasados} atrasado${atrasados > 1 ? 's' : ''})` : ''}`,
    ...(top.length ? ['', '🔥 *Mais quentes:*', ...top.map(l => `• ${l.nomeCliente} — ${l.pontuacao} · ${ROTULO_ETAPA[l.estagio] ?? l.estagio}`)] : []),
    ...(esperando.length ? ['', 'Mande *quem está esperando?* para ver a lista.'] : []),
  ].join('\n')
}

async function resumoDoPeriodo(a: AssistentePessoal, agora: Date, tipo: 'SEMANA' | 'MES'): Promise<string> {
  const hoje = inicioDoDiaBrt(agora)
  // Semana = hoje e os 6 dias antes; mês = desde o dia 1 (horário de Brasília).
  const brt = new Date(agora.getTime() - 3 * 3600e3)
  const inicio = tipo === 'SEMANA' ? new Date(hoje.getTime() - 6 * DIA) : new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), 1, 3))
  const atual = await numerosDoPeriodo(a, inicio)
  // Semana anterior = 14 dias menos os 7 atuais.
  const quatorze = tipo === 'SEMANA' ? await numerosDoPeriodo(a, new Date(inicio.getTime() - 7 * DIA)) : null
  const anterior = quatorze ? { leads: quatorze.leads - atual.leads, vendas: quatorze.vendas - atual.vendas } : null
  const conversao = atual.leads ? Math.round((atual.vendas / atual.leads) * 1000) / 10 : 0
  const comp = (agoraN: number, antes: number | undefined) => (antes === undefined ? '' : agoraN > antes ? ` (↑ ${antes} na semana anterior)` : agoraN < antes ? ` (↓ ${antes} na semana anterior)` : ' (igual à semana anterior)')
  return [
    tipo === 'SEMANA' ? '📈 *Seus últimos 7 dias*' : '📈 *Seu mês até agora*',
    '',
    `• Leads novos: ${atual.leads}${comp(atual.leads, anterior?.leads)}`,
    `• Avançaram para negociação/proposta: ${atual.avancos}`,
    `• Vendas: ${atual.vendas}${atual.vendas ? ` (${reais(atual.vendido)})` : ''}${comp(atual.vendas, anterior?.vendas)}`,
    `• Conversão lead → venda: ${conversao.toLocaleString('pt-BR')}%`,
  ].join('\n')
}

export async function responderPergunta(a: AssistentePessoal, p: Pergunta, agora = new Date()): Promise<string> {
  const usuarioId = a.vendedor.usuarioId
  if (p.tipo === 'AJUDA') return TEXTO_AJUDA_PESSOAL
  if (p.tipo === 'HOJE') return resumoDoDia(a, agora)
  if (p.tipo === 'SEMANA' || p.tipo === 'MES') return resumoDoPeriodo(a, agora, p.tipo)
  if (p.tipo === 'ESPERANDO') {
    const lista = await leadsEsperando(a.id, agora)
    if (!lista.length) return '✅ Ninguém esperando resposta sua agora.'
    return [`⏳ *${plural(lista.length, 'lead esperando', 'leads esperando')} você:*`, '', ...lista.slice(0, 8).map(e => `• ${e.nome} — ${tempoDesde(e.desde, agora)}${e.ultima ? `: "${e.ultima}"` : ''}\n  wa.me/${e.numero}`)].join('\n')
  }
  if (p.tipo === 'QUENTES') {
    const top = await quentes(a)
    if (!top.length) return 'Nenhum lead com nota 70+ agora. A nota sobe com entrada, pressa, pedido de visita ou simulação.'
    return ['🔥 *Seus leads mais quentes:*', '', ...top.map(l => `• ${l.nomeCliente} — ${l.pontuacao} (${faixaNota(l.pontuacao ?? 0).toLowerCase()}) · ${ROTULO_ETAPA[l.estagio] ?? l.estagio}${l.etiquetas.length > 1 ? ` · ${etiquetasCurtas(l.etiquetas)}` : ''}`)].join('\n')
  }
  if (p.tipo === 'FOLLOWS') {
    const follows = await followsDoDia(a, agora)
    if (!follows.length) return '✅ Nenhum follow para hoje nem atrasado.'
    const hoje = inicioDoDiaBrt(agora)
    return ['📅 *Seus follows:*', '', ...follows.map(f => `• ${f.lead.nomeCliente} — ${f.agendadoPara < hoje ? 'atrasado' : 'hoje'}${f.nota ? `: ${f.nota.slice(0, 60)}` : ''}`)].join('\n')
  }
  if (p.tipo === 'FICHA') {
    const { motos } = await vitrineDaLoja(usuarioId)
    const achadas = acharMotos(p.moto, motos)
    if (!achadas.length) return `Não achei "${p.moto}" no estoque. Confira o nome na aba Estoque do Assistente.`
    const m = achadas[0]
    const situacao = m.situacao === 'DISPONIVEL' ? '✅ Disponível' : m.situacao === 'RESERVADA' ? '⏸️ Reservada' : '❌ Vendida'
    return [fichaTexto(m, { mostrarPreco: true }), '', situacao, m.fotos.length ? `${plural(m.fotos.length, 'foto', 'fotos')} — use "Enviar moto" na conversa do cliente.` : 'Sem foto cadastrada.'].join('\n')
  }
  if (p.tipo === 'RESPOSTA') {
    const itens = await respostasAtivas(usuarioId)
    const [achado] = acharConhecimento(p.assunto, itens)
    if (!achado) return `Ainda não tenho resposta aprovada para "${p.assunto}". Sugira uma na aba Conhecimento do Assistente.`
    const i = achado.item
    return [`💬 *${i.titulo}*`, '', preencherResposta(i.resposta, { nomeContato: '', vendedor: a.vendedor.nome, empresa: '', moto: null }), ...(i.usos ? ['', `Usada ${i.usos}× · ${i.avancos} lead${i.avancos === 1 ? '' : 's'} avançaram depois.`] : [])].join('\n')
  }
  // LEAD
  const leads = await prisma.lead.findMany({
    where: { vendedorId: a.vendedorId, nomeCliente: { contains: p.nome, mode: 'insensitive' }, estagio: { not: 'PERDIDO' } },
    orderBy: { atualizadoEm: 'desc' }, take: 4,
    select: { id: true, nomeCliente: true, estagio: true, pontuacao: true, etiquetas: true, modeloInteresse: true, assistenteConversas: { orderBy: { ultimaMensagemEm: 'desc' }, take: 1, select: { ultimaMensagemEm: true, mensagens: { where: { remetente: 'CONTATO' }, orderBy: { criadoEm: 'desc' }, take: 1, select: { texto: true, criadoEm: true } } } } },
  })
  if (!leads.length) return `Não achei lead seu com o nome "${p.nome}".`
  return leads.map(l => {
    const ult = l.assistenteConversas[0]?.mensagens[0]
    return [
      `👤 *${l.nomeCliente}* — ${ROTULO_ETAPA[l.estagio] ?? l.estagio}${typeof l.pontuacao === 'number' ? ` · nota ${l.pontuacao}` : ''}`,
      ...(l.modeloInteresse ? [`Interesse: ${l.modeloInteresse}`] : []),
      ...(l.etiquetas.length ? [`Etiquetas: ${l.etiquetas.map(e => ETIQUETAS[e as keyof typeof ETIQUETAS] ?? e).join(', ')}`] : []),
      ...(ult ? [`Última mensagem dele ${tempoDesde(ult.criadoEm, agora)}: "${ult.texto.slice(0, 80)}"`] : []),
    ].join('\n')
  }).join('\n\n')
}
