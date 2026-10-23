// Follow automático do Assistente — funções puras. Regras de segurança (o
// número é o WhatsApp do vendedor):
// - só em conversa de lead que o vendedor já assumiu e respondeu (quem
//   chamou primeiro foi o cliente; o follow nunca abre conversa);
// - conta a partir da 1ª resposta do vendedor depois da última mensagem do
//   cliente; o cliente respondeu, a sequência recomeça do zero;
// - no máximo 1 mensagem automática por dia por lead e um teto por número;
// - só de segunda a sábado, no horário configurado (Brasília);
// - pediu para parar, o lead fechou ou foi perdido: não manda mais.

export type MidiaFollow = 'NENHUMA' | 'FOTO_MOTO' | 'VIDEO_MOTO'
export const MIDIAS_FOLLOW: MidiaFollow[] = ['NENHUMA', 'FOTO_MOTO', 'VIDEO_MOTO']
export interface PassoFollow { dias: number; texto: string; midia: MidiaFollow }
export interface ConfigFollow { passos: PassoFollow[]; tetoDiario: number; horaInicio: number; horaFim: number }

export const FOLLOW_PADRAO: ConfigFollow = {
  passos: [
    { dias: 1, midia: 'NENHUMA', texto: 'Oi, {nome}! Passando pra saber se ficou alguma dúvida sobre {moto}. Posso te ajudar em alguma coisa? 🙂' },
    { dias: 3, midia: 'FOTO_MOTO', texto: '{nome}, lembrei de você! Quer que eu faça uma simulação sem compromisso? Te passo tudo certinho por aqui.' },
    { dias: 7, midia: 'NENHUMA', texto: '{nome}, vou parar de te mandar mensagem por aqui pra não incomodar. Se ainda tiver interesse, é só me chamar que eu te atendo na hora! 👋' },
  ],
  tetoDiario: 30,
  horaInicio: 9,
  horaFim: 19,
}

const inteiro = (v: unknown, min: number, max: number, padrao: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao
}

/** Config salva + padrão; passos em ordem crescente de dias, sem repetir o dia. */
export function lerConfigFollow(salva: unknown): ConfigFollow {
  const c = (salva && typeof salva === 'object' ? salva : {}) as Partial<ConfigFollow>
  const passos = Array.isArray(c.passos)
    ? c.passos
      .filter(p => p && typeof p.texto === 'string' && p.texto.trim())
      .map(p => ({ dias: inteiro(p.dias, 1, 30, 1), texto: String(p.texto).trim().slice(0, 600), midia: MIDIAS_FOLLOW.includes(p.midia) ? p.midia : 'NENHUMA' as MidiaFollow }))
      .sort((a, b) => a.dias - b.dias)
      .filter((p, i, l) => i === 0 || p.dias > l[i - 1].dias)
      .slice(0, 5)
    : FOLLOW_PADRAO.passos
  const horaInicio = inteiro(c.horaInicio, 7, 20, FOLLOW_PADRAO.horaInicio)
  return {
    passos: passos.length ? passos : FOLLOW_PADRAO.passos,
    tetoDiario: inteiro(c.tetoDiario, 1, 100, FOLLOW_PADRAO.tetoDiario),
    horaInicio,
    horaFim: Math.max(horaInicio + 1, inteiro(c.horaFim, 8, 21, FOLLOW_PADRAO.horaFim)),
  }
}

// Brasília não tem horário de verão desde 2019: UTC−3 o ano todo.
const BRT_MS = 3 * 3600e3
export function horaBrasilia(agora: Date): { hora: number; diaSemana: number } {
  const d = new Date(agora.getTime() - BRT_MS)
  return { hora: d.getUTCHours(), diaSemana: d.getUTCDay() }
}

/** Segunda a sábado, entre horaInicio e horaFim. */
export function dentroDoHorario(agora: Date, cfg: ConfigFollow): boolean {
  const { hora, diaSemana } = horaBrasilia(agora)
  return diaSemana >= 1 && diaSemana <= 6 && hora >= cfg.horaInicio && hora < cfg.horaFim
}

export interface MensagemFollow { remetente: string; criadoEm: Date }

/**
 * Quando a bola ficou com o cliente: a 1ª mensagem do vendedor depois da
 * última do cliente. Sem resposta do vendedor (ou o cliente falou por
 * último), não há follow — quem deve resposta é a loja.
 */
export function baseDoFollow(mensagens: MensagemFollow[]): Date | null {
  const ordem = [...mensagens].sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime())
  const ultimaDoCliente = ordem.filter(m => m.remetente === 'CONTATO').at(-1)
  if (!ultimaDoCliente) return null
  return ordem.find(m => m.remetente === 'VENDEDOR' && m.criadoEm > ultimaDoCliente.criadoEm)?.criadoEm ?? null
}

const DIA = 86_400_000
const INTERVALO_MINIMO = 20 * 3600e3

/** O passo que cabe agora (com o índice), ou null. */
export function proximoFollow(d: { cfg: ConfigFollow; passo: number; parado: string | null; baseEm: Date | null; ultimoFollowEm: Date | null; agora: Date }): (PassoFollow & { indice: number; devidoEm: Date }) | null {
  if (d.parado || !d.baseEm) return null
  const p = d.cfg.passos[d.passo]
  if (!p) return null
  const devidoEm = new Date(d.baseEm.getTime() + p.dias * DIA)
  if (devidoEm > d.agora) return null
  if (d.ultimoFollowEm && d.agora.getTime() - d.ultimoFollowEm.getTime() < INTERVALO_MINIMO) return null
  return { ...p, indice: d.passo, devidoEm }
}

/** Quando o próximo passo fica devido (para a fila da tela), ignorando horário e teto. */
export function quandoDevido(d: { cfg: ConfigFollow; passo: number; parado: string | null; baseEm: Date | null; ultimoFollowEm: Date | null }): Date | null {
  if (d.parado || !d.baseEm) return null
  const p = d.cfg.passos[d.passo]
  if (!p) return null
  const porDias = d.baseEm.getTime() + p.dias * DIA
  const porIntervalo = d.ultimoFollowEm ? d.ultimoFollowEm.getTime() + INTERVALO_MINIMO : 0
  return new Date(Math.max(porDias, porIntervalo))
}

/** Início do dia em Brasília (para o teto diário). */
export function inicioDoDiaBrt(agora: Date): Date {
  const d = new Date(agora.getTime() - BRT_MS)
  d.setUTCHours(0, 0, 0, 0)
  return new Date(d.getTime() + BRT_MS)
}
