// Respostas diretas, sem IA, para as perguntas de registro mais comuns:
// "último lead da Naiza", "última mensagem que a Naiza recebeu/mandou", "últimas mensagens do cliente Carlos".
// Usadas quando a IA não está ligada (sem a chave) ou falhou: o Pergunte não cai em "não sei"
// para algo que está no sistema. Usam as mesmas consultas da Central, com as permissões de quem pergunta.
import { prisma } from '../prisma'
import { NOME_ETAPA, type Etapa } from '../etapasJornada'
import type { CtxCentral } from './contexto'
import { Reservas, executarConsulta } from './consultas'

const FUSO = 'America/Sao_Paulo'
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const quando = (iso: string | Date) => new Date(iso).toLocaleString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' às')

export interface RespostaDireta { resposta: string; consultas: string[]; fonte: string; tela: string | null }

/** Pessoa da equipe citada na pergunta (primeiro nome ou nome completo). */
async function pessoaCitada(usuarioId: string, p: string): Promise<{ id: string; nome: string } | null> {
  const equipe = await prisma.vendedor.findMany({ where: { usuarioId }, select: { id: true, nome: true, ativo: true }, orderBy: { ativo: 'desc' } })
  let melhor: { id: string; nome: string; peso: number } | null = null
  for (const v of equipe) {
    const nome = norm(v.nome).trim()
    const primeiro = nome.split(/\s+/)[0]
    for (const alvo of [nome, primeiro]) {
      if (alvo.length < 3) continue
      if (new RegExp(`(^|[^a-z])${alvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(p) && (!melhor || alvo.length > melhor.peso)) melhor = { id: v.id, nome: v.nome, peso: alvo.length }
    }
  }
  return melhor ? { id: melhor.id, nome: melhor.nome } : null
}

const primeiroNome = (n: string) => n.split(/\s+/)[0]

export async function respostaDireta(ctx: CtxCentral, pergunta: string): Promise<RespostaDireta | null> {
  const p = norm(pergunta)
  const ultimo = /\b(ultim[oa]s?|mais recentes?|recentes?)\b/.test(p)
  const falaMensagem = /\b(mensage(m|ns)|msg|conversa|conversas|whats|whatsapp|zap)\b/.test(p)
  const falaLead = /\b(lead|leads|cliente|clientes|contato)\b/.test(p)
  if (!ultimo || (!falaMensagem && !falaLead)) return null
  // "último cliente que comprou" é venda, não lead: fica para as outras consultas.
  if (!falaMensagem && /\b(vend|compr|fatur|fechou|fechad)/.test(p)) return null
  const pessoa = await pessoaCitada(ctx.pessoa.usuarioId, p)

  // --- Mensagens ---
  if (falaMensagem) {
    const recebe = /\b(recebeu|recebida|recebidas|chegou|chegaram|recebe)\b/.test(p)
    const manda = /\b(mandou|enviou|enviada|enviadas|respondeu|mandada|mandadas|envia|manda)\b/.test(p)
    const quem = recebe && !manda ? 'CLIENTE' : manda && !recebe ? 'LOJA' : 'TODAS'
    const plural = /\b(ultimas|mensagens|conversas)\b/.test(p)
    const limite = plural ? 5 : 1
    const r = new Reservas()
    const ex = await executarConsulta(ctx, 'mensagens', { ...(pessoa ? { vendedor: pessoa.nome } : {}), quem, limite }, r)
    const d = ex.dados as { mensagens?: Array<{ canal: string; quando: string; cliente: string | null; telefone: string | null; consultor: string | null; quem: string; texto: string; tela: string | null }>; avisos?: string[] }
    const lista = d.mensagens ?? []
    const de = pessoa ? ` ${quem === 'CLIENTE' ? 'recebida' : quem === 'LOJA' ? 'enviada' : 'da conversa'} por ${primeiroNome(pessoa.nome)}` : quem === 'CLIENTE' ? ' recebida' : quem === 'LOJA' ? ' enviada pela loja' : ''
    if (!lista.length) return { resposta: d.avisos?.length ? d.avisos.join(' ') : `Não encontrei mensagem${de}.`, consultas: ['Conversas'], fonte: 'whatsapp', tela: ex.tela }
    const linha = (m: typeof lista[number]) => `${quando(m.quando)} · ${m.canal} · ${m.quem}${m.quem === 'Cliente' ? '' : m.consultor ? ` (${primeiroNome(m.consultor)})` : ''} · cliente ${m.cliente ?? 'sem nome'}${m.telefone ? ` (${m.telefone})` : ''}: “${r.preencher(m.texto)}”`
    const resposta = limite === 1
      ? `Última mensagem${de}: ${linha(lista[0])}`
      : `Últimas ${lista.length} mensagens${de}:\n${lista.map(m => `- ${linha(m)}`).join('\n')}`
    return { resposta, consultas: ['Conversas'], fonte: 'whatsapp', tela: lista[0].tela ?? ex.tela }
  }

  // --- Último lead ---
  if (!ctx.leads) return { resposta: 'Seu acesso não inclui os leads do CRM.', consultas: ['Leads'], fonte: 'leads', tela: null }
  if (pessoa && ctx.pessoal && pessoa.id !== ctx.pessoa.vendedorId) return { resposta: 'Este perfil vê só os próprios leads.', consultas: ['Leads'], fonte: 'leads', tela: null }
  const plural = /\b(ultimos|leads|clientes)\b/.test(p)
  const leads = await prisma.lead.findMany({
    where: { AND: [ctx.leads, ...(pessoa ? [{ vendedorId: pessoa.id }] : [])] }, orderBy: { criadoEm: 'desc' }, take: plural ? 5 : 1,
    select: { id: true, nomeCliente: true, telefone: true, modeloInteresse: true, etapa: true, estagio: true, criadoEm: true, origemTipo: true, tipoLead: true, vendedor: { select: { nome: true } } },
  })
  const de = pessoa ? ` de ${primeiroNome(pessoa.nome)}` : ''
  if (!leads.length) return { resposta: `Não encontrei lead${de}.`, consultas: ['Leads'], fonte: 'leads', tela: '/pro-labore/leads' }
  const tel = (t: string | null) => { const x = (t ?? '').replace(/\D/g, ''); return x.length >= 4 ? `, telefone final ${x.slice(-4)}` : '' }
  const linha = (l: typeof leads[number]) => `${l.nomeCliente}${tel(l.telefone)} — ${l.modeloInteresse ? `interesse em ${l.modeloInteresse}, ` : ''}etapa ${l.etapa ? NOME_ETAPA[l.etapa as Etapa] ?? l.etapa : l.estagio}${l.origemTipo ?? l.tipoLead ? `, origem ${l.origemTipo ?? l.tipoLead}` : ''}${!pessoa && l.vendedor ? `, com ${primeiroNome(l.vendedor.nome)}` : ''}, criado em ${quando(l.criadoEm)}`
  const resposta = leads.length === 1 && !plural
    ? `O último lead${de} é ${linha(leads[0])}.`
    : `Últimos ${leads.length} leads${de}:\n${leads.map(l => `- ${linha(l)}`).join('\n')}`
  return { resposta, consultas: ['Leads'], fonte: 'leads', tela: `/pro-labore/leads?lead=${leads[0].id}` }
}
