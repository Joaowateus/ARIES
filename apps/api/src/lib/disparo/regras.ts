// ARIES DISPARO — regras puras (sem banco): estados da campanha e transições permitidas,
// configuração padrão, telefone, variáveis de personalização, janela de envio e classificação de erros.
// Tudo aqui é testável sem servidor e usado pelo motor, pelas rotas e pelos testes.

// ---------- Estados da campanha ----------

export const STATUS_CAMPANHA = ['DRAFT', 'VALIDATING', 'NEEDS_REVIEW', 'READY', 'SCHEDULED', 'QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'CANCELLED', 'ARCHIVED'] as const
export type StatusCampanha = typeof STATUS_CAMPANHA[number]

export const ROTULO_STATUS: Record<StatusCampanha, string> = {
  DRAFT: 'Rascunho', VALIDATING: 'Preparando o público', NEEDS_REVIEW: 'Aguardando aprovação', READY: 'Pronta', SCHEDULED: 'Agendada',
  QUEUED: 'Na fila', RUNNING: 'Enviando', PAUSED: 'Pausada', COMPLETED: 'Concluída', COMPLETED_WITH_ERRORS: 'Concluída com falhas',
  CANCELLED: 'Cancelada', ARCHIVED: 'Arquivada',
}

/** Transições permitidas (o backend recusa qualquer outra). */
export const TRANSICOES: Record<StatusCampanha, StatusCampanha[]> = {
  DRAFT: ['VALIDATING', 'CANCELLED', 'ARCHIVED'],
  VALIDATING: ['NEEDS_REVIEW', 'READY', 'DRAFT', 'CANCELLED'],
  NEEDS_REVIEW: ['READY', 'DRAFT', 'CANCELLED'],
  READY: ['SCHEDULED', 'QUEUED', 'DRAFT', 'CANCELLED'],
  SCHEDULED: ['QUEUED', 'READY', 'DRAFT', 'CANCELLED'],
  QUEUED: ['RUNNING', 'PAUSED', 'CANCELLED'],
  RUNNING: ['PAUSED', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'CANCELLED'],
  PAUSED: ['RUNNING', 'QUEUED', 'CANCELLED'],
  COMPLETED: ['ARCHIVED'],
  COMPLETED_WITH_ERRORS: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [],
}
export const podeIr = (de: string, para: StatusCampanha) => (TRANSICOES[de as StatusCampanha] ?? []).includes(para)
/** Estados em que a campanha ainda pode ser editada (editar volta para Rascunho e cria versão). */
export const EDITAVEL: StatusCampanha[] = ['DRAFT', 'NEEDS_REVIEW', 'READY', 'SCHEDULED']
export const FINAL: StatusCampanha[] = ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'CANCELLED', 'ARCHIVED']

// ---------- Finalidade ----------

export const FINALIDADES = ['MARKETING', 'OPERACIONAL', 'RELACIONAMENTO'] as const
export type Finalidade = typeof FINALIDADES[number]
export const ROTULO_FINALIDADE: Record<Finalidade, string> = {
  MARKETING: 'Promocional (marketing)', OPERACIONAL: 'Operacional (aviso de algo em andamento)', RELACIONAMENTO: 'Relacionamento (pós-venda, atendimento)',
}

// ---------- Conteúdo (sequência de passos) ----------

export const TIPOS_PASSO = ['TEXTO', 'IMAGEM', 'AUDIO', 'VIDEO', 'DOCUMENTO'] as const
export type TipoPasso = typeof TIPOS_PASSO[number]
export interface Passo { tipo: TipoPasso; texto?: string | null; midiaId?: string | null; esperarMin?: number }
export interface Conteudo { passos: Passo[]; fallbacks?: Record<string, string>; rodapeSair?: boolean }

// ---------- Configuração (por campanha, com padrão da loja) ----------

export interface ConfigEnvio {
  janela: { inicio: string; fim: string; dias: number[] } // dias: 0=domingo … 6=sábado (hora de Brasília)
  intervaloSeg: number // tempo mínimo entre duas mensagens do mesmo número remetente
  maxPorHora: number
  maxPorDia: number
  pararAoResponder: boolean
  pararAoComprar: boolean
  pararSeVendedorAssumir: boolean
  maxTentativas: number
}
export interface ConfigLoja {
  envio: ConfigEnvio
  /** EXPLICITA: marketing só para quem tem autorização registrada. RELACAO: também para quem já tem relação comercial (lead ou cliente) e não pediu para sair. */
  baseMarketing: 'EXPLICITA' | 'RELACAO'
  exigirAprovacao: boolean
  rodapeSair: string
  palavrasSair: string[]
}
export const CONFIG_PADRAO: ConfigLoja = {
  envio: { janela: { inicio: '09:00', fim: '19:00', dias: [1, 2, 3, 4, 5, 6] }, intervaloSeg: 20, maxPorHora: 90, maxPorDia: 400, pararAoResponder: true, pararAoComprar: true, pararSeVendedorAssumir: true, maxTentativas: 4 },
  baseMarketing: 'EXPLICITA',
  exigirAprovacao: false, // sem aprovação obrigatória (pedido do dono, 25/11/2026); o dono liga em Configurações
  rodapeSair: 'Para não receber mais mensagens como esta, responda SAIR.',
  palavrasSair: ['sair', 'parar', 'pare', 'cancelar', 'descadastrar', 'remover', 'nao quero mais', 'não quero mais', 'stop'],
}
// Só nos testes automatizados (nunca na Vercel): DISPARO_TESTE_SEM_RITMO=1 tira o ritmo mínimo e os limites.
const semRitmo = () => process.env.DISPARO_TESTE_SEM_RITMO === '1' && process.env.VERCEL !== '1'
const num = (v: unknown, padrao: number, min: number, max: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : padrao }
const hora = (v: unknown, padrao: string) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : padrao)
export function lerConfigEnvio(c: unknown, base: ConfigEnvio = CONFIG_PADRAO.envio): ConfigEnvio {
  const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
  const j = (o.janela && typeof o.janela === 'object' ? o.janela : {}) as Record<string, unknown>
  const dias = Array.isArray(j.dias) ? [...new Set(j.dias.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))] : base.janela.dias
  return {
    janela: { inicio: hora(j.inicio, base.janela.inicio), fim: hora(j.fim, base.janela.fim), dias: dias.length ? dias : base.janela.dias },
    // Ritmo mínimo de 8 s entre mensagens do mesmo número: protege o número do vendedor e o atendimento.
    intervaloSeg: num(o.intervaloSeg, base.intervaloSeg, semRitmo() ? 0 : 8, 3600),
    maxPorHora: num(o.maxPorHora, base.maxPorHora, 1, semRitmo() ? 1_000_000 : 400),
    maxPorDia: num(o.maxPorDia, base.maxPorDia, 1, semRitmo() ? 1_000_000 : 3000),
    pararAoResponder: typeof o.pararAoResponder === 'boolean' ? o.pararAoResponder : base.pararAoResponder,
    pararAoComprar: typeof o.pararAoComprar === 'boolean' ? o.pararAoComprar : base.pararAoComprar,
    pararSeVendedorAssumir: typeof o.pararSeVendedorAssumir === 'boolean' ? o.pararSeVendedorAssumir : base.pararSeVendedorAssumir,
    maxTentativas: num(o.maxTentativas, base.maxTentativas, 1, 8),
  }
}
export function lerConfigLoja(c: unknown): ConfigLoja {
  const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
  return {
    envio: lerConfigEnvio(o.envio),
    baseMarketing: o.baseMarketing === 'RELACAO' ? 'RELACAO' : 'EXPLICITA',
    exigirAprovacao: typeof o.exigirAprovacao === 'boolean' ? o.exigirAprovacao : CONFIG_PADRAO.exigirAprovacao,
    rodapeSair: typeof o.rodapeSair === 'string' && o.rodapeSair.trim() ? o.rodapeSair.trim().slice(0, 200) : CONFIG_PADRAO.rodapeSair,
    palavrasSair: Array.isArray(o.palavrasSair) && o.palavrasSair.length ? o.palavrasSair.map(String).map(x => x.trim().toLowerCase()).filter(Boolean).slice(0, 30) : CONFIG_PADRAO.palavrasSair,
  }
}

// ---------- Telefone ----------

export const soDigitos = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')
/** Normaliza para o formato internacional só com dígitos (Brasil: 55 + DDD + número). null = inválido. */
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  let d = soDigitos(bruto)
  if (!d) return null
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 10 || d.length === 11) d = `55${d}` // número brasileiro sem o código do país
  if (d.startsWith('55')) {
    if (d.length !== 12 && d.length !== 13) return null
    const ddd = Number(d.slice(2, 4))
    if (ddd < 11 || ddd > 99) return null
    const assinante = d.slice(4)
    if (/^(\d)\1+$/.test(assinante)) return null // 99999-9999, 00000-0000
    if (d.length === 13 && assinante[0] !== '9') return null
    return d
  }
  return d.length >= 10 && d.length <= 15 ? d : null
}
/** Chave de comparação com o resto do ARIES (os 8 últimos dígitos, como no cadastro automático). */
export const chaveTelefone = (t: string) => soDigitos(t).slice(-8)
export const dddDe = (t: string) => (t.startsWith('55') && t.length >= 12 ? t.slice(2, 4) : null)
export const REGIOES: Record<string, string[]> = {
  Norte: ['91', '92', '93', '94', '95', '96', '97', '68', '69', '63'],
  Nordeste: ['71', '73', '74', '75', '77', '79', '81', '87', '82', '83', '84', '85', '88', '86', '89', '98', '99'],
  'Centro-Oeste': ['61', '62', '64', '65', '66', '67'],
  Sudeste: ['11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28', '31', '32', '33', '34', '35', '37', '38'],
  Sul: ['41', '42', '43', '44', '45', '46', '47', '48', '49', '51', '53', '54', '55'],
}
export const regiaoDoDdd = (ddd: string | null) => (ddd ? Object.entries(REGIOES).find(([, l]) => l.includes(ddd))?.[0] ?? null : null)

// ---------- Variáveis ----------

export const VARIAVEIS = [
  { chave: 'nome', rotulo: 'Nome completo', exemplo: 'Carlos Souza' },
  { chave: 'primeiro_nome', rotulo: 'Primeiro nome', exemplo: 'Carlos' },
  { chave: 'cidade', rotulo: 'Cidade (do levantamento)', exemplo: 'Belém' },
  { chave: 'vendedor', rotulo: 'Vendedor responsável (primeiro nome)', exemplo: 'Naiza' },
  { chave: 'modelo_interesse', rotulo: 'Moto de interesse', exemplo: 'Honda CG 160' },
  { chave: 'ultimo_contato', rotulo: 'Data do último contato', exemplo: '12/11/2026' },
  { chave: 'loja', rotulo: 'Nome da loja', exemplo: 'Aries Motos' },
] as const
export type ChaveVariavel = typeof VARIAVEIS[number]['chave']
export type ValoresVariaveis = Partial<Record<ChaveVariavel, string | null>>
const RE_VAR = /\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/g

/** Variáveis usadas no texto (com o valor alternativo escrito no próprio texto: {{cidade|sua cidade}}). */
export function variaveisUsadas(texto: string): Array<{ chave: string; fallback: string | null }> {
  return [...texto.matchAll(RE_VAR)].map(m => ({ chave: m[1], fallback: m[2] != null ? m[2].trim() : null }))
}
/**
 * Troca as variáveis pelos valores do contato. Sem valor: usa o alternativo do texto ou o da campanha;
 * sem nenhum, devolve faltando (o destinatário não recebe — nunca sai "{{nome}}" para o cliente).
 */
export function renderizar(texto: string, valores: ValoresVariaveis, fallbacks: Record<string, string> = {}): { texto: string; faltando: string[]; desconhecidas: string[] } {
  const faltando: string[] = [], desconhecidas: string[] = []
  const conhecidas = new Set<string>(VARIAVEIS.map(v => v.chave))
  const saida = texto.replace(RE_VAR, (_m, chave: string, fb?: string) => {
    if (!conhecidas.has(chave)) { desconhecidas.push(chave); return '' }
    const v = valores[chave as ChaveVariavel]?.trim()
    if (v) return v
    const alt = fb?.trim() || fallbacks[chave]?.trim()
    if (alt) return alt
    faltando.push(chave)
    return ''
  })
  return { texto: saida.replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ').trim(), faltando: [...new Set(faltando)], desconhecidas: [...new Set(desconhecidas)] }
}

// ---------- Janela de envio (hora de Brasília) ----------

const FUSO = 'America/Sao_Paulo'
export function horaLocal(d: Date): { minutos: number; dia: number } {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(d)
  const h = Number(p.find(x => x.type === 'hour')?.value ?? 0) % 24, m = Number(p.find(x => x.type === 'minute')?.value ?? 0)
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.find(x => x.type === 'weekday')?.value ?? 'Sun')
  return { minutos: h * 60 + m, dia }
}
const minutosDe = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
export function dentroDaJanela(j: ConfigEnvio['janela'], agora: Date): boolean {
  const { minutos, dia } = horaLocal(agora)
  return j.dias.includes(dia) && minutos >= minutosDe(j.inicio) && minutos < minutosDe(j.fim)
}

// ---------- Erros do envio ----------

export type ClasseErro = 'TEMPORARIO' | 'DEFINITIVO' | 'DESCONHECIDO' | 'CONEXAO'
/**
 * Classifica o erro do provedor:
 * - DEFINITIVO: número sem WhatsApp, inválido, bloqueado → não repete.
 * - CONEXAO: o número remetente está desconectado → a campanha espera a conexão (não gasta tentativa).
 * - DESCONHECIDO: o pedido pode ter chegado ao provedor (tempo esgotado) → reconcilia antes de repetir.
 * - TEMPORARIO: o provedor recusou sem enviar (5xx, limite, recusou a conexão) → repete com espera crescente.
 */
export function classificarErro(e: { message?: string; status?: number; talvezEnviado?: boolean }): ClasseErro {
  const m = (e.message ?? '').toLowerCase()
  if (e.talvezEnviado) return 'DESCONHECIDO'
  if (/exists"?\s*:\s*false|not.*(exist|registered|on whatsapp)|n[aã]o (existe|tem whatsapp)|invalid.*(number|jid)|n[uú]mero inv[aá]lido|bad request.*number/.test(m)) return 'DEFINITIVO'
  if (/blocked|bloquead/.test(m)) return 'DEFINITIVO'
  if (/connection closed|not connected|disconnected|desconectad|sem inst[aâ]ncia|instance.*(not found|does not exist)|qr ?code/.test(m) || e.status === 404) return 'CONEXAO'
  if (e.status === 400 || e.status === 422) return 'DEFINITIVO'
  return 'TEMPORARIO'
}
/** Espera antes da próxima tentativa: exponencial (1, 2, 4, 8… min, até 60) com variação de ±25%. */
export function esperaDaTentativa(tentativa: number, aleatorio = Math.random()): number {
  const base = Math.min(60, 2 ** Math.max(0, tentativa - 1)) * 60_000
  return Math.round(base * (0.75 + aleatorio * 0.5))
}

/** A resposta do contato pede para sair? */
export function pedeParaSair(texto: string, palavras: string[] = CONFIG_PADRAO.palavrasSair): boolean {
  const t = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t || t.split(' ').length > 6) return false // frase longa não é pedido de descadastro
  return palavras.some(p => { const q = p.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); return t === q || t.startsWith(`${q} `) || t.endsWith(` ${q}`) })
}
