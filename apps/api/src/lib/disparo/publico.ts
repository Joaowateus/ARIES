// ARIES DISPARO — construtor de públicos ligado direto ao CRM.
// Fontes: Lead (leads), Cliente (clientes) e AssistenteConversa/AssistenteContatoForaCrm (quem já
// escreveu no WhatsApp). Nada é copiado: o público é uma definição (base + filtros E/OU + seleção
// manual); a lista sai na hora, com as permissões de quem monta. Cada contato aparece uma vez (pelo
// telefone normalizado) e cada excluído tem um motivo só.
import { prisma } from '../prisma'
import { leadWhereDe } from '../escopoLead'
import { chaveTelefone, normalizarTelefone, dddDe, regiaoDoDdd, renderizar, variaveisUsadas, type ConfigLoja, type Conteudo, type Finalidade, type ValoresVariaveis } from './regras'
import { estadosDeAutorizacao } from './autorizacao'

// ---------- Definição ----------

export const BASES = ['TODOS', 'LEADS', 'CLIENTES', 'CONTATARAM', 'EQUIPE'] as const
export type Base = typeof BASES[number]
export interface Condicao { campo: string; op: string; valor?: unknown }
export interface Grupo { op: 'E' | 'OU'; itens: Array<Condicao | Grupo> }
export interface DefinicaoPublico {
  base: Base
  predefinido?: string | null
  filtros?: Grupo | null
  /** Seleção manual: incluir = contatos escolhidos um a um (somente eles, se apenasManual); excluir = telefones tirados da lista. */
  manual?: { incluir?: Array<{ tipo: 'LEAD' | 'CLIENTE' | 'CONVERSA'; id: string; nome?: string | null }>; excluir?: string[]; apenasManual?: boolean; /** Lista colada (números de qualquer pessoa, mesmo fora do CRM). */ numeros?: Array<{ telefone: string; nome?: string | null }> } | null
}

export const ETAPAS = ['LEAD', 'ABORDADO', 'LEVANTAMENTO', 'MQL', 'SQL', 'NEGOCIACAO', 'PROPOSTA', 'AGENDAMENTO', 'VISITA', 'VENDA'] as const
const ETAPA_LEGADA: Record<string, string> = { LEAD: 'LEAD', ABORDADO: 'ABORDADO', NEGOCIACAO: 'NEGOCIACAO', PROPOSTA: 'PROPOSTA', FECHADO: 'VENDA' }

/**
 * Jornada de compra do CRM: um público vivo por etapa (os leads abertos que estão nela agora). Como o
 * público é avaliado de novo a cada uso, ele se atualiza sozinho conforme a equipe move os leads no CRM.
 */
export const JORNADA: Array<{ etapa: typeof ETAPAS[number]; rotulo: string; objetivo: string; sugestao: Array<{ texto: string; esperarDias: number }> }> = [
  { etapa: 'LEAD', rotulo: 'Lead', objetivo: 'Fazer o lead responder (virar Abordado)', sugestao: [
    { esperarDias: 0, texto: 'Oi, {{primeiro_nome}}! Aqui é {{vendedor|a equipe}} da {{loja}}. Vi que você se interessou por {{modelo_interesse|uma moto}}. Posso te ajudar com valores e condições?' },
    { esperarDias: 2, texto: '{{primeiro_nome}}, ainda está procurando {{modelo_interesse|sua moto}}? Consigo montar uma simulação rapidinho pra você.' },
    { esperarDias: 5, texto: 'Oi, {{primeiro_nome}}! Última chamada por aqui: se ainda tiver interesse, é só responder que eu te mando as condições de hoje.' } ] },
  { etapa: 'ABORDADO', rotulo: 'Abordado', objetivo: 'Entender a necessidade (levantamento)', sugestao: [
    { esperarDias: 0, texto: '{{primeiro_nome}}, pra eu te mandar a melhor opção: você pensa em pagar à vista ou financiado? Tem moto pra dar na troca?' },
    { esperarDias: 3, texto: 'Oi, {{primeiro_nome}}! Conseguiu ver minha pergunta? Com essas duas respostas já consigo te passar valores.' } ] },
  { etapa: 'LEVANTAMENTO', rotulo: 'Levantamento', objetivo: 'Qualificar (virar MQL)', sugestao: [
    { esperarDias: 0, texto: '{{primeiro_nome}}, com o que você me contou já dá pra simular. Quer que eu te mande as parcelas da {{modelo_interesse|moto}}?' },
    { esperarDias: 3, texto: 'Oi, {{primeiro_nome}}! Separei uma condição boa pra você esta semana. Posso te mandar?' } ] },
  { etapa: 'MQL', rotulo: 'MQL', objetivo: 'Confirmar o interesse de compra (virar SQL)', sugestao: [
    { esperarDias: 0, texto: '{{primeiro_nome}}, pelo seu perfil a {{modelo_interesse|moto}} cabe direitinho. Quer que eu já veja a aprovação do crédito pra você?' },
    { esperarDias: 4, texto: 'Oi, {{primeiro_nome}}! Ainda posso te ajudar com a {{modelo_interesse|sua moto}}?' } ] },
  { etapa: 'SQL', rotulo: 'SQL', objetivo: 'Levar para a negociação', sugestao: [
    { esperarDias: 0, texto: '{{primeiro_nome}}, vamos fechar os detalhes? Me diz o melhor valor de entrada e de parcela pra você que eu monto a proposta.' } ] },
  { etapa: 'NEGOCIACAO', rotulo: 'Negociação', objetivo: 'Chegar na proposta', sugestao: [
    { esperarDias: 0, texto: '{{primeiro_nome}}, consegui uma condição especial pra fecharmos. Posso te mandar a proposta?' },
    { esperarDias: 3, texto: 'Oi, {{primeiro_nome}}! A condição que conversamos ainda está de pé, mas por pouco tempo. Vamos fechar?' } ] },
  { etapa: 'PROPOSTA', rotulo: 'Proposta', objetivo: 'Agendar a visita ou fechar', sugestao: [
    { esperarDias: 1, texto: '{{primeiro_nome}}, conseguiu ver a proposta? Se quiser, já deixo agendada sua visita aqui na {{loja}} pra ver a moto de perto.' },
    { esperarDias: 4, texto: 'Oi, {{primeiro_nome}}! Ficou alguma dúvida na proposta? Posso ajustar o que precisar.' } ] },
  { etapa: 'AGENDAMENTO', rotulo: 'Agendamento', objetivo: 'Garantir a visita', sugestao: [
    { esperarDias: 0, texto: 'Oi, {{primeiro_nome}}! Passando pra confirmar sua visita aqui na {{loja}}. Qualquer imprevisto, me avisa que a gente remarca.' } ] },
  { etapa: 'VISITA', rotulo: 'Visita', objetivo: 'Fechar a venda', sugestao: [
    { esperarDias: 1, texto: '{{primeiro_nome}}, foi um prazer te receber! Ficou com alguma dúvida? Consigo segurar a condição que conversamos até amanhã.' } ] },
  { etapa: 'VENDA', rotulo: 'Venda', objetivo: 'Pós-venda e indicação', sugestao: [
    { esperarDias: 3, texto: 'Oi, {{primeiro_nome}}! Tudo certo com a moto nova? Qualquer coisa, conte com a gente. E se tiver alguém procurando moto, indica a {{loja}} 😉' } ] },
]
export const definicaoDaEtapa = (etapa: string): DefinicaoPublico => ({ base: 'LEADS', filtros: { op: 'E', itens: etapa === 'VENDA' ? [{ campo: 'etapa', op: 'igual', valor: 'VENDA' }] : [{ campo: 'situacao', op: 'igual', valor: 'ABERTO' }, { campo: 'etapa', op: 'igual', valor: etapa }] } })

/** Públicos prontos (cada um é uma base + filtros, que a pessoa pode ajustar depois). */
export const PREDEFINIDOS: Array<{ chave: string; nome: string; descricao: string; definicao: DefinicaoPublico; grupo?: 'JORNADA' }> = [
  ...JORNADA.map(j => ({ chave: `ETAPA_${j.etapa}`, nome: j.rotulo, descricao: `Leads ${j.etapa === 'VENDA' ? 'que compraram' : 'abertos'} na etapa ${j.rotulo} agora (atualiza sozinho conforme o CRM).`, definicao: definicaoDaEtapa(j.etapa), grupo: 'JORNADA' as const })),
  { chave: 'TODOS_CONTATOS', nome: 'Todos os contatos', descricao: 'Leads, clientes e quem já escreveu no WhatsApp, sem repetir o mesmo número.', definicao: { base: 'TODOS' } },
  { chave: 'TODOS_LEADS', nome: 'Todos os leads', descricao: 'Todos os leads do CRM, de qualquer etapa.', definicao: { base: 'LEADS' } },
  { chave: 'CLIENTES', nome: 'Clientes', descricao: 'Clientes cadastrados e leads com venda.', definicao: { base: 'CLIENTES' } },
  { chave: 'EQUIPE', nome: 'Equipe (WhatsApp conectado)', descricao: 'Cada pessoa da equipe com o WhatsApp conectado ao ARIES (comunicado interno). Use a finalidade Operacional.', definicao: { base: 'EQUIPE' } },
  { chave: 'CONTATARAM', nome: 'Quem já entrou em contato', descricao: 'Quem já escreveu no WhatsApp de algum vendedor.', definicao: { base: 'CONTATARAM' } },
  { chave: 'LEADS_NOVOS', nome: 'Leads novos (30 dias)', descricao: 'Leads cadastrados nos últimos 30 dias.', definicao: { base: 'LEADS', filtros: { op: 'E', itens: [{ campo: 'cadastro', op: 'ultimos_dias', valor: 30 }] } } },
  { chave: 'LEADS_SEM_RESPOSTA', nome: 'Leads sem resposta', descricao: 'Leads abertos ainda em Lead ou Abordado.', definicao: { base: 'LEADS', filtros: { op: 'E', itens: [{ campo: 'situacao', op: 'igual', valor: 'ABERTO' }, { campo: 'etapa', op: 'em', valor: ['LEAD', 'ABORDADO'] }] } } },
  { chave: 'LEADS_RESPONDERAM', nome: 'Leads que responderam', descricao: 'Leads abertos que passaram do Abordado.', definicao: { base: 'LEADS', filtros: { op: 'E', itens: [{ campo: 'situacao', op: 'igual', valor: 'ABERTO' }, { campo: 'etapa', op: 'em', valor: ['LEVANTAMENTO', 'MQL', 'SQL', 'NEGOCIACAO', 'PROPOSTA', 'AGENDAMENTO', 'VISITA'] }] } } },
  { chave: 'EM_NEGOCIACAO', nome: 'Leads em negociação', descricao: 'Negociação, proposta, agendamento ou visita.', definicao: { base: 'LEADS', filtros: { op: 'E', itens: [{ campo: 'situacao', op: 'igual', valor: 'ABERTO' }, { campo: 'etapa', op: 'em', valor: ['NEGOCIACAO', 'PROPOSTA', 'AGENDAMENTO', 'VISITA'] }] } } },
  { chave: 'QUALIFICADOS', nome: 'Leads qualificados', descricao: 'Leads abertos em MQL ou SQL.', definicao: { base: 'LEADS', filtros: { op: 'E', itens: [{ campo: 'situacao', op: 'igual', valor: 'ABERTO' }, { campo: 'etapa', op: 'em', valor: ['MQL', 'SQL'] }] } } },
  { chave: 'NAO_COMPRARAM', nome: 'Leads que não compraram', descricao: 'Leads perdidos.', definicao: { base: 'LEADS', filtros: { op: 'E', itens: [{ campo: 'situacao', op: 'igual', valor: 'PERDIDO' }] } } },
  { chave: 'CLIENTES_ANTIGOS', nome: 'Clientes antigos', descricao: 'Clientes com a última compra há mais de 6 meses.', definicao: { base: 'CLIENTES', filtros: { op: 'E', itens: [{ campo: 'ultima_compra', op: 'ha_mais_de_dias', valor: 180 }] } } },
  { chave: 'REATIVACAO', nome: 'Contatos em reativação', descricao: 'Perdidos marcados para reativar ou que já voltaram a falar.', definicao: { base: 'LEADS', filtros: { op: 'OU', itens: [{ campo: 'destino_perda', op: 'igual', valor: 'REATIVACAO' }, { campo: 'reativado', op: 'igual', valor: true }] } } },
]

/** Campos de filtro (o que a tela oferece). */
export const CAMPOS = [
  { campo: 'origem', rotulo: 'Origem do lead', ops: ['igual', 'em', 'vazio'] },
  { campo: 'cidade', rotulo: 'Cidade', ops: ['contem', 'igual', 'vazio'] },
  { campo: 'regiao', rotulo: 'Região (pelo DDD)', ops: ['igual', 'em'] },
  { campo: 'ddd', rotulo: 'DDD', ops: ['igual', 'em'] },
  { campo: 'situacao', rotulo: 'Situação comercial', ops: ['igual', 'em'] },
  { campo: 'etapa', rotulo: 'Etapa da jornada', ops: ['igual', 'em'] },
  { campo: 'na_etapa', rotulo: 'Tempo na etapa atual (entrou na etapa)', ops: ['ultimos_dias', 'ha_mais_de_dias'] },
  { campo: 'vendedor', rotulo: 'Vendedor responsável', ops: ['igual', 'em', 'vazio'] },
  { campo: 'cadastro', rotulo: 'Data de cadastro', ops: ['entre', 'ultimos_dias', 'ha_mais_de_dias'] },
  { campo: 'ultimo_contato', rotulo: 'Último contato no WhatsApp', ops: ['entre', 'ultimos_dias', 'ha_mais_de_dias', 'vazio'] },
  { campo: 'modelo', rotulo: 'Moto de interesse', ops: ['contem', 'vazio'] },
  { campo: 'valor', rotulo: 'Faixa de preço (valor da negociação)', ops: ['entre', 'maior', 'menor'] },
  { campo: 'temperatura', rotulo: 'Temperatura', ops: ['igual', 'em'] },
  { campo: 'interacoes', rotulo: 'Histórico de interações', ops: ['igual'] },
  { campo: 'ultima_compra', rotulo: 'Última compra', ops: ['ultimos_dias', 'ha_mais_de_dias'] },
  { campo: 'destino_perda', rotulo: 'Destino da perda', ops: ['igual'] },
  { campo: 'reativado', rotulo: 'Já foi reativado', ops: ['igual'] },
  { campo: 'autorizacao', rotulo: 'Permissão de comunicação (marketing)', ops: ['igual'] },
]

// ---------- Contato unificado ----------

export interface Contato {
  telefone: string | null // normalizado
  bruto: string | null
  nome: string
  leadId: string | null
  clienteId: string | null
  conversaId: string | null
  vendedorId: string | null
  vendedorNome: string | null
  origem: string | null
  cidade: string | null
  etapa: string | null
  situacao: 'ABERTO' | 'PERDIDO' | 'FECHADO' | 'CLIENTE' | 'CONTATO' | 'EQUIPE'
  criadoEm: Date | null
  ultimoContato: Date | null
  /** Desde quando o lead está na etapa atual (histórico do CRM). */
  etapaDesde?: Date | null
  ultimaCompra: Date | null
  modelo: string | null
  valor: number | null
  temperatura: string | null
  destinoPerda: string | null
  reativado: boolean
  conversas: number
  visitas: number
  propostas: number
  bloqueado: boolean
  autorizacao: string | null // AUTORIZADO | REVOGADO | BLOQUEADO | null (preenchido depois)
}

interface Leitor { usuarioId: string; papel: string; vendedorId: string | null; sdr?: boolean }

/** Contato avulso (lista colada, fora do CRM): sem lead, cliente nem conversa. */
const CONTATO_AVULSO: Omit<Contato, 'telefone' | 'bruto' | 'nome' | 'criadoEm'> = {
  leadId: null, clienteId: null, conversaId: null, vendedorId: null, vendedorNome: null, origem: 'LISTA', cidade: null, etapa: null, situacao: 'CONTATO',
  ultimoContato: null, ultimaCompra: null, modelo: null, valor: null, temperatura: null, destinoPerda: null, reativado: false, conversas: 0, visitas: 0, propostas: 0, bloqueado: false, autorizacao: null,
}

const DIA = 86_400_000
const PENDENTE = '__PENDENTE__'
const norm = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const lista = (v: unknown) => (Array.isArray(v) ? v.map(String) : v == null || v === '' ? [] : [String(v)])
const data = (v: unknown) => { const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? null : d }

function valorDoCampo(c: Contato, campo: string): unknown {
  switch (campo) {
    case 'origem': return c.origem
    case 'cidade': return c.cidade
    case 'regiao': return regiaoDoDdd(c.telefone ? dddDe(c.telefone) : null)
    case 'ddd': return c.telefone ? dddDe(c.telefone) : null
    case 'situacao': return c.situacao
    case 'etapa': return c.etapa
    case 'na_etapa': return c.etapaDesde ?? null
    case 'vendedor': return c.vendedorId
    case 'cadastro': return c.criadoEm
    case 'ultimo_contato': return c.ultimoContato
    case 'ultima_compra': return c.ultimaCompra
    case 'modelo': return c.modelo
    case 'valor': return c.valor
    case 'temperatura': return c.temperatura
    case 'destino_perda': return c.destinoPerda
    case 'reativado': return c.reativado
    case 'autorizacao': return c.autorizacao ?? 'SEM_REGISTRO'
    default: return undefined
  }
}

/** Avalia uma condição contra o contato (campos ausentes não passam, menos em "vazio"). */
export function passa(c: Contato, cond: Condicao, agora = new Date()): boolean {
  if (cond.campo === 'interacoes') {
    const v = String(cond.valor ?? '')
    return v === 'CONVERSOU' ? c.conversas > 0 : v === 'NUNCA_CONVERSOU' ? c.conversas === 0 : v === 'VISITOU' ? c.visitas > 0 : v === 'PROPOSTA' ? c.propostas > 0 : false
  }
  // A autorização só é conhecida depois de juntar os contatos: na primeira passada, não filtra.
  if (cond.campo === 'autorizacao' && c.autorizacao === PENDENTE) return true
  const v = valorDoCampo(c, cond.campo)
  const vazio = v == null || v === ''
  switch (cond.op) {
    case 'vazio': return cond.valor === false ? !vazio : vazio
    case 'igual': return typeof v === 'boolean' ? v === (cond.valor === true || cond.valor === 'true') : !vazio && norm(String(v)) === norm(String(cond.valor ?? ''))
    case 'em': return !vazio && lista(cond.valor).map(norm).includes(norm(String(v)))
    case 'contem': return !vazio && norm(String(v)).includes(norm(String(cond.valor ?? '')))
    case 'maior': return typeof v === 'number' && v > Number(cond.valor)
    case 'menor': return typeof v === 'number' && v < Number(cond.valor)
    case 'entre': {
      const [a, b] = Array.isArray(cond.valor) ? cond.valor : []
      if (v instanceof Date) { const de = data(a), ate = data(b); if (ate) ate.setUTCHours(23, 59, 59, 999); return (!de || v >= de) && (!ate || v <= ate) }
      if (typeof v === 'number') return (a == null || a === '' || v >= Number(a)) && (b == null || b === '' || v <= Number(b))
      return false
    }
    case 'ultimos_dias': return v instanceof Date && agora.getTime() - v.getTime() <= Number(cond.valor) * DIA
    case 'ha_mais_de_dias': return v instanceof Date && agora.getTime() - v.getTime() > Number(cond.valor) * DIA
    default: return false
  }
}
const ehGrupo = (x: Condicao | Grupo): x is Grupo => Array.isArray((x as Grupo).itens)
export function passaGrupo(c: Contato, g: Grupo | null | undefined, agora = new Date()): boolean {
  if (!g || !g.itens?.length) return true
  const r = g.itens.map(i => (ehGrupo(i) ? passaGrupo(c, i, agora) : passa(c, i, agora)))
  return g.op === 'OU' ? r.some(Boolean) : r.every(Boolean)
}

// ---------- Leitura das fontes ----------

const SITUACAO_LEAD = (estagio: string): Contato['situacao'] => (estagio === 'PERDIDO' ? 'PERDIDO' : estagio === 'FECHADO' ? 'FECHADO' : 'ABERTO')

/** Leads pelo id (a campanha confere, na hora de cada envio, se o contato ainda está no público). */
export const lerLeadsPorId = (q: Leitor, ids: string[]) => lerLeads(q, ids)

async function lerLeads(q: Leitor, ids?: string[]): Promise<Contato[]> {
  const where = leadWhereDe({ usuarioId: q.usuarioId, papel: q.papel, sdr: !!q.sdr, vendedorId: q.vendedorId })
  const ls = await prisma.lead.findMany({
    where: { ...where, ...(ids ? { id: { in: ids } } : {}) },
    select: {
      id: true, nomeCliente: true, telefone: true, vendedorId: true, etapa: true, estagio: true, origemTipo: true, tipoLead: true, criadoEm: true, modeloInteresse: true,
      valorNegociacao: true, temperatura: true, temperaturaManual: true, levantamento: true, clienteId: true, fechadoEm: true, reativadoEm: true, destinoPerda: true,
      vendedor: { select: { nome: true } }, cliente: { select: { bloqueado: true } },
      assistenteConversas: { orderBy: { ultimaMensagemEm: 'desc' }, take: 1, select: { id: true, ultimaMensagemEm: true } },
      historico: { orderBy: { criadoEm: 'desc' }, take: 1, select: { criadoEm: true } },
      _count: { select: { assistenteConversas: true, visitas: true, propostas: true } },
    },
    orderBy: { criadoEm: 'desc' },
  })
  return ls.map(l => {
    const lev = (l.levantamento && typeof l.levantamento === 'object' ? l.levantamento : {}) as Record<string, unknown>
    return {
      telefone: normalizarTelefone(l.telefone), bruto: l.telefone, nome: l.nomeCliente, leadId: l.id, clienteId: l.clienteId, conversaId: l.assistenteConversas[0]?.id ?? null,
      vendedorId: l.vendedorId, vendedorNome: l.vendedor?.nome ?? null, origem: l.origemTipo ?? l.tipoLead ?? null, cidade: typeof lev.cidade === 'string' ? lev.cidade : null,
      etapa: l.etapa ?? ETAPA_LEGADA[l.estagio] ?? null, situacao: SITUACAO_LEAD(l.estagio), criadoEm: l.criadoEm, ultimoContato: l.assistenteConversas[0]?.ultimaMensagemEm ?? null, etapaDesde: l.historico[0]?.criadoEm ?? l.criadoEm,
      ultimaCompra: l.estagio === 'FECHADO' ? l.fechadoEm : null, modelo: l.modeloInteresse, valor: l.valorNegociacao ?? null, temperatura: l.temperaturaManual ?? l.temperatura ?? null,
      destinoPerda: l.destinoPerda, reativado: !!l.reativadoEm, conversas: l._count.assistenteConversas, visitas: l._count.visitas, propostas: l._count.propostas,
      bloqueado: !!l.cliente?.bloqueado, autorizacao: PENDENTE,
    }
  })
}

async function lerClientes(q: Leitor, ids?: string[]): Promise<Contato[]> {
  // Clientes são da loja toda: quem só vê a própria carteira não monta público de clientes.
  if (q.papel !== 'DONO' && q.papel !== 'SUPERVISOR') return []
  const cs = await prisma.cliente.findMany({
    where: { usuarioId: q.usuarioId, ...(ids ? { id: { in: ids } } : {}) },
    select: { id: true, nome: true, telefone: true, bloqueado: true, criadoEm: true, leads: { orderBy: { criadoEm: 'desc' }, take: 5, select: { id: true, estagio: true, fechadoEm: true, vendedorId: true, vendedor: { select: { nome: true } } } } },
  })
  return cs.map(c => {
    const comprou = c.leads.filter(l => l.estagio === 'FECHADO').map(l => l.fechadoEm).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())
    const ult = c.leads[0]
    return {
      telefone: normalizarTelefone(c.telefone), bruto: c.telefone, nome: c.nome, leadId: null, clienteId: c.id, conversaId: null, vendedorId: ult?.vendedorId ?? null, vendedorNome: ult?.vendedor?.nome ?? null,
      origem: null, cidade: null, etapa: comprou.length ? 'VENDA' : null, situacao: 'CLIENTE', criadoEm: c.criadoEm, ultimoContato: null, ultimaCompra: comprou[0] ?? null,
      modelo: null, valor: null, temperatura: null, destinoPerda: null, reativado: false, conversas: 0, visitas: 0, propostas: 0, bloqueado: c.bloqueado, autorizacao: PENDENTE,
    }
  })
}

async function lerConversas(q: Leitor, ids?: string[]): Promise<Contato[]> {
  const gestao = q.papel === 'DONO' || q.papel === 'SUPERVISOR'
  const escopo = gestao ? { vendedor: { usuarioId: q.usuarioId } } : { vendedorId: q.vendedorId ?? '__nenhum__' }
  const [cs, fora] = await Promise.all([
    prisma.assistenteConversa.findMany({
      where: { tipo: 'LEAD', assistente: escopo, ...(ids ? { id: { in: ids } } : {}) },
      orderBy: { ultimaMensagemEm: 'desc' },
      select: { id: true, nomeContato: true, numeroContato: true, leadId: true, criadoEm: true, ultimaMensagemEm: true, respostas: true, assistente: { select: { vendedorId: true, vendedor: { select: { nome: true } } } } },
    }),
    ids ? Promise.resolve([]) : prisma.assistenteContatoForaCrm.findMany({ where: { assistente: escopo, semTelefone: false }, select: { numero: true, nome: true, ultimaEm: true, criadoEm: true, assistente: { select: { vendedorId: true, vendedor: { select: { nome: true } } } } } }),
  ])
  const base = (x: { vendedorId: string; vendedor: { nome: string } }) => ({ vendedorId: x.vendedorId, vendedorNome: x.vendedor.nome })
  const vazio = { clienteId: null, origem: null, etapa: null, ultimaCompra: null, modelo: null, valor: null, temperatura: null, destinoPerda: null, reativado: false, visitas: 0, propostas: 0, bloqueado: false, autorizacao: PENDENTE }
  return [
    ...cs.map(c => {
      const r = (c.respostas && typeof c.respostas === 'object' ? c.respostas : {}) as Record<string, unknown>
      return { ...vazio, ...base(c.assistente), telefone: normalizarTelefone(c.numeroContato), bruto: c.numeroContato, nome: c.nomeContato, leadId: c.leadId, conversaId: c.id, cidade: typeof r.cidade === 'string' ? r.cidade : null, situacao: 'CONTATO' as const, criadoEm: c.criadoEm, ultimoContato: c.ultimaMensagemEm, conversas: 1 }
    }),
    ...fora.map(f => ({ ...vazio, ...base(f.assistente), telefone: normalizarTelefone(f.numero), bruto: f.numero, nome: f.nome ?? f.numero, leadId: null, conversaId: null, cidade: null, situacao: 'CONTATO' as const, criadoEm: f.criadoEm, ultimoContato: f.ultimaEm, conversas: 1 })),
  ]
}

/** A equipe: o WhatsApp conectado de cada pessoa ativa (só a gestão monta este público). */
async function lerEquipe(q: Leitor): Promise<Contato[]> {
  if (q.papel !== 'DONO' && q.papel !== 'SUPERVISOR') return []
  const as = await prisma.assistenteComercial.findMany({ where: { vendedor: { usuarioId: q.usuarioId, ativo: true }, numeroWhatsapp: { not: null } }, select: { numeroWhatsapp: true, criadoEm: true, vendedor: { select: { id: true, nome: true } } } })
  return as.map(a => ({
    telefone: normalizarTelefone(a.numeroWhatsapp), bruto: a.numeroWhatsapp, nome: a.vendedor.nome, leadId: null, clienteId: null, conversaId: null, vendedorId: a.vendedor.id, vendedorNome: a.vendedor.nome,
    origem: null, cidade: null, etapa: null, situacao: 'EQUIPE' as const, criadoEm: a.criadoEm, ultimoContato: null, ultimaCompra: null, modelo: null, valor: null, temperatura: null,
    destinoPerda: null, reativado: false, conversas: 0, visitas: 0, propostas: 0, bloqueado: false, autorizacao: PENDENTE,
  }))
}

/** Junta as fontes num contato por telefone (o lead mais recente manda; o cliente e a conversa completam). */
function juntar(grupos: Contato[][]): { contatos: Contato[]; duplicados: number; semTelefone: Contato[] } {
  const porTel = new Map<string, Contato>()
  const semTelefone: Contato[] = []
  let duplicados = 0
  for (const g of grupos) for (const c of g) {
    if (!c.telefone) { semTelefone.push(c); continue }
    const ja = porTel.get(c.telefone)
    if (!ja) { porTel.set(c.telefone, { ...c }); continue }
    duplicados += 1
    ja.clienteId ??= c.clienteId; ja.conversaId ??= c.conversaId; ja.leadId ??= c.leadId; ja.vendedorId ??= c.vendedorId; ja.vendedorNome ??= c.vendedorNome; ja.cidade ??= c.cidade
    ja.bloqueado ||= c.bloqueado; ja.conversas += c.conversas
    if (c.ultimoContato && (!ja.ultimoContato || c.ultimoContato > ja.ultimoContato)) ja.ultimoContato = c.ultimoContato
    if (c.ultimaCompra && (!ja.ultimaCompra || c.ultimaCompra > ja.ultimaCompra)) ja.ultimaCompra = c.ultimaCompra
  }
  return { contatos: [...porTel.values()], duplicados, semTelefone }
}

// ---------- Resolução do público ----------

export const MOTIVOS: Record<string, string> = {
  SEM_TELEFONE: 'Sem telefone ou número inválido', DUPLICADO: 'Número repetido (fica um só)', BLOQUEADO: 'Contato bloqueado',
  DESCADASTRADO: 'Pediu para não receber (descadastrado)', SEM_AUTORIZACAO: 'Sem autorização para mensagens promocionais',
  NUMERO_REMETENTE: 'É o próprio número que envia a campanha', VARIAVEL_SEM_VALOR: 'Falta um dado usado na mensagem (sem valor alternativo)',
  RETIRADO: 'Retirado à mão da lista',
}
export interface Resultado {
  selecionados: number
  elegiveis: Contato[]
  excluidos: Array<{ contato: Contato; motivo: string }>
  /** Contagem por motivo, cada contato uma vez (duplicados e sem telefone não viram linha). */
  porMotivo: Record<string, number>
}

export async function valoresDoContato(c: Contato, nomeLoja: string): Promise<ValoresVariaveis> {
  return {
    nome: c.nome?.trim() || null, primeiro_nome: c.nome?.trim().split(/\s+/)[0] || null, cidade: c.cidade, vendedor: c.vendedorNome?.split(/\s+/)[0] ?? null,
    modelo_interesse: c.modelo, ultimo_contato: c.ultimoContato ? c.ultimoContato.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : null, loja: nomeLoja || null,
  }
}

/**
 * Lista colada: cada número vira um destinatário. Se o número já é lead/cliente da loja, usa o cadastro
 * (nome, vendedor e variáveis); senão entra como contato avulso, com o nome que veio na lista.
 */
async function contatosDaLista(q: Leitor, lista: Array<{ telefone: string; nome?: string | null }>, agora: Date): Promise<Contato[]> {
  if (!lista.length) return []
  const pedidos = lista.map(x => ({ tel: normalizarTelefone(x.telefone), bruto: x.telefone, nome: x.nome?.trim() || null }))
  const validos = pedidos.filter(x => x.tel)
  const chaves = new Set(validos.map(x => chaveTelefone(x.tel!)))
  // Cadastro existente com o mesmo número (pelos últimos dígitos): aproveita o que o CRM já sabe.
  const doCrm = chaves.size ? (await Promise.all([lerLeads(q), lerClientes(q)])).flat().filter(c => c.telefone && chaves.has(chaveTelefone(c.telefone))) : []
  const porChave = new Map(doCrm.map(c => [chaveTelefone(c.telefone!), c]))
  return pedidos.map(x => {
    const crm = x.tel ? porChave.get(chaveTelefone(x.tel)) : undefined
    if (crm) return { ...crm, nome: crm.nome ?? x.nome }
    return { ...CONTATO_AVULSO, telefone: x.tel, bruto: x.bruto, nome: x.nome ?? (x.tel ? `+${x.tel}` : x.bruto), criadoEm: agora } as Contato
  })
}

export async function resolverPublico(q: Leitor, d: DefinicaoPublico, opcoes: { finalidade?: Finalidade; config: ConfigLoja; conteudo?: Conteudo | null; remetenteNumero?: string | null }, agora = new Date()): Promise<Resultado> {
  const manual = d.manual ?? {}
  const porTipo = (t: 'LEAD' | 'CLIENTE' | 'CONVERSA') => (manual.incluir ?? []).filter(x => x.tipo === t).map(x => x.id)
  const grupos: Contato[][] = []
  if (!manual.apenasManual) {
    if (d.base === 'TODOS' || d.base === 'LEADS') grupos.push(await lerLeads(q))
    if (d.base === 'TODOS' || d.base === 'CLIENTES') {
      grupos.push(await lerClientes(q))
      // Leads com venda também são clientes.
      if (d.base === 'CLIENTES') grupos.push((await lerLeads(q)).filter(c => c.situacao === 'FECHADO'))
    }
    if (d.base === 'TODOS' || d.base === 'CONTATARAM') grupos.push(await lerConversas(q))
    if (d.base === 'EQUIPE') grupos.push(await lerEquipe(q))
  }
  // Seleção manual (sempre entra, mesmo fora dos filtros).
  const manuais: Contato[] = [
    ...(porTipo('LEAD').length ? await lerLeads(q, porTipo('LEAD')) : []),
    ...(porTipo('CLIENTE').length ? await lerClientes(q, porTipo('CLIENTE')) : []),
    ...(porTipo('CONVERSA').length ? await lerConversas(q, porTipo('CONVERSA')) : []),
    ...(await contatosDaLista(q, manual.numeros ?? [], agora)),
  ]
  const filtrados = grupos.map(g => g.filter(c => passaGrupo(c, d.filtros, agora)))
  const { contatos, duplicados, semTelefone } = juntar([manuais, ...filtrados])
  const selecionados = contatos.length + duplicados + semTelefone.length

  // Autorizações (a linha mais recente de cada telefone vale).
  const estados = await estadosDeAutorizacao(q.usuarioId, contatos.map(c => c.telefone!))
  for (const c of contatos) c.autorizacao = estados.get(c.telefone!)?.situacao ?? null
  // Filtro por permissão depois de saber a autorização.
  const usaAutorizacao = JSON.stringify(d.filtros ?? {}).includes('"autorizacao"')
  const candidatos = usaAutorizacao ? contatos.filter(c => passaGrupo(c, d.filtros, agora) || manuais.some(m => m.telefone === c.telefone)) : contatos

  // Números da equipe podem receber (comunicado à empresa toda); só o próprio número que envia fica de fora.
  const remetente = opcoes.remetenteNumero ? normalizarTelefone(opcoes.remetenteNumero) : null
  const retirados = new Set((manual.excluir ?? []).map(t => normalizarTelefone(t)).filter(Boolean) as string[])
  const loja = (await prisma.proLaboreUsuario.findUnique({ where: { id: q.usuarioId }, select: { nome: true } }))?.nome ?? ''
  const textos = (opcoes.conteudo?.passos ?? []).map(p => p.texto ?? '').filter(Boolean)
  const usadas = new Set(textos.flatMap(t => variaveisUsadas(t).map(v => v.chave)))

  const elegiveis: Contato[] = []
  const excluidos: Resultado['excluidos'] = []
  const porMotivo: Record<string, number> = {}
  const excluir = (contato: Contato, motivo: string) => { excluidos.push({ contato, motivo }); porMotivo[motivo] = (porMotivo[motivo] ?? 0) + 1 }
  if (duplicados) porMotivo.DUPLICADO = duplicados
  if (semTelefone.length) porMotivo.SEM_TELEFONE = semTelefone.length
  for (const c of candidatos) {
    const a = c.autorizacao
    if (retirados.has(c.telefone!)) { excluir(c, 'RETIRADO'); continue }
    if (remetente && c.telefone === remetente) { excluir(c, 'NUMERO_REMETENTE'); continue }
    if (c.bloqueado || a === 'BLOQUEADO') { excluir(c, 'BLOQUEADO'); continue }
    if (opcoes.finalidade === 'MARKETING') {
      if (a === 'REVOGADO') { excluir(c, 'DESCADASTRADO'); continue }
      const temRelacao = !!c.leadId || !!c.clienteId
      if (a !== 'AUTORIZADO' && !(opcoes.config.baseMarketing === 'RELACAO' && temRelacao)) { excluir(c, 'SEM_AUTORIZACAO'); continue }
    }
    if (usadas.size) {
      const valores = await valoresDoContato(c, loja)
      if (textos.some(t => renderizar(t, valores, opcoes.conteudo?.fallbacks ?? {}).faltando.length)) { excluir(c, 'VARIAVEL_SEM_VALOR'); continue }
    }
    elegiveis.push(c)
  }
  return { selecionados, elegiveis, excluidos, porMotivo }
}

/** Quantos leads há em cada etapa agora e quantos estão parados nela há mais de 7 dias. */
export async function contagemJornada(usuarioId: string, agora = new Date()) {
  const leads = await lerLeads({ usuarioId, papel: 'DONO', vendedorId: null })
  const limite = agora.getTime() - 7 * DIA
  return JORNADA.map(j => {
    const nela = leads.filter(l => l.etapa === j.etapa && (j.etapa === 'VENDA' || l.situacao === 'ABERTO'))
    return { etapa: j.etapa, rotulo: j.rotulo, objetivo: j.objetivo, total: nela.length, comTelefone: nela.filter(l => l.telefone).length, parados7d: nela.filter(l => (l.etapaDesde ?? l.criadoEm ?? agora).getTime() < limite).length }
  })
}
