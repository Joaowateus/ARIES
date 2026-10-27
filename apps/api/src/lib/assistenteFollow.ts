// Follow automático do Assistente — funções puras. Regras de segurança (o
// número é o WhatsApp do vendedor):
// - só em conversa de lead que o vendedor já assumiu e respondeu (quem
//   chamou primeiro foi o cliente; o follow nunca abre conversa);
// - conta a partir da 1ª resposta do vendedor depois da última mensagem do
//   cliente; o cliente respondeu, a sequência recomeça do zero;
// - no máximo 1 mensagem automática por dia por lead e um teto por número;
// - só de segunda a sábado, no horário configurado (Brasília);
// - pediu para parar ou o lead fechou: não manda mais; lead perdido só
//   recebe o fluxo de resgate, se o dono ligar.

// Fluxos por situação: em que ponto da negociação o cliente sumiu. O fluxo
// é escolhido quando a sequência começa e fica até o cliente responder (aí
// recomeça do zero, já pelo ponto novo). Lead perdido tem o fluxo de
// resgate, que começa desligado.
export type SituacaoFollow = 'SEM_RESPOSTA' | 'APOS_SIMULACAO' | 'APOS_APROVACAO' | 'REATIVACAO'
export const SITUACOES_FOLLOW: SituacaoFollow[] = ['SEM_RESPOSTA', 'APOS_SIMULACAO', 'APOS_APROVACAO', 'REATIVACAO']
export const ROTULO_SITUACAO: Record<SituacaoFollow, string> = {
  SEM_RESPOSTA: 'Parou de responder', APOS_SIMULACAO: 'Sumiu depois da simulação', APOS_APROVACAO: 'Sumiu depois da aprovação', REATIVACAO: 'Lead perdido (resgate)',
}
export type MidiaFollow = 'NENHUMA' | 'FOTO_MOTO' | 'VIDEO_MOTO' | 'IMAGEM'
export const MIDIAS_FOLLOW: MidiaFollow[] = ['NENHUMA', 'FOTO_MOTO', 'VIDEO_MOTO', 'IMAGEM']
// imagem: a foto própria do passo (/pro-labore/imagens/<chave>), quando midia = IMAGEM.
export interface PassoFollow { dias: number; texto: string; midia: MidiaFollow; imagem: string | null }
// AVISAR_VENDEDOR: 2 dias depois do último passo sem resposta, vira follow do vendedor no CRM.
export type FimFluxo = 'NADA' | 'AVISAR_VENDEDOR'
export interface FluxoFollow { situacao: SituacaoFollow; ativo: boolean; passos: PassoFollow[]; aoFinal: FimFluxo }
// Crédito recusado em todos os bancos: follow do vendedor para refazer a pré-análise em N dias.
export interface CreditoFollow { ativo: boolean; dias: number; texto: string }
export interface ConfigFollow { fluxos: FluxoFollow[]; tetoDiario: number; horaInicio: number; horaFim: number; credito: CreditoFollow }

const passo = (dias: number, texto: string, midia: MidiaFollow = 'NENHUMA'): PassoFollow => ({ dias, texto, midia, imagem: null })
export const FOLLOW_PADRAO: ConfigFollow = {
  fluxos: [
    {
      situacao: 'SEM_RESPOSTA', ativo: true, aoFinal: 'NADA', passos: [
        passo(1, 'Oi, {nome}! Passando pra saber se ficou alguma dúvida sobre {moto}. Posso te ajudar em alguma coisa? 🙂'),
        passo(3, '{nome}, lembrei de você! Quer que eu faça uma simulação sem compromisso? Te passo tudo certinho por aqui.', 'FOTO_MOTO'),
        passo(7, '{nome}, vou parar de te mandar mensagem por aqui pra não incomodar. Se ainda tiver interesse, é só me chamar que eu te atendo na hora! 👋'),
      ],
    },
    {
      situacao: 'APOS_SIMULACAO', ativo: true, aoFinal: 'AVISAR_VENDEDOR', passos: [
        passo(1, 'Oi, {nome}! Conseguiu ver a simulação que te mandei? Se quiser, ajusto a entrada ou o prazo pra caber melhor no seu bolso. 🙂'),
        passo(3, '{nome}, ainda pensando em {moto}? Posso adiantar a pré-análise de crédito: é rapidinho e sem compromisso.', 'FOTO_MOTO'),
        passo(7, '{nome}, vou parar de te mandar mensagem por aqui pra não incomodar. Quando quiser retomar a simulação, é só me chamar! 👋'),
      ],
    },
    {
      situacao: 'APOS_APROVACAO', ativo: true, aoFinal: 'AVISAR_VENDEDOR', passos: [
        passo(1, '{nome}, viu que o seu crédito foi aprovado? 🎉 Quer combinar um horário pra vir ver {moto}?'),
        passo(3, '{nome}, as condições aprovadas podem mudar com o tempo no banco. Quer que eu já deixe tudo encaminhado pra você?'),
        passo(6, '{nome}, vou parar de te mandar mensagem por aqui. Sua aprovação fica registrada comigo: quando quiser seguir, é só me chamar! 👋'),
      ],
    },
    {
      situacao: 'REATIVACAO', ativo: false, aoFinal: 'NADA', passos: [
        passo(15, 'Oi, {nome}! Aqui é {vendedor}. Faz um tempinho que conversamos sobre {moto}. Chegaram novidades no estoque: quer dar uma olhada? 🏍️'),
        passo(30, '{nome}, ainda pensando em trocar de moto? Se quiser, refaço a simulação com as condições de agora.', 'FOTO_MOTO'),
        passo(60, '{nome}, passando só pra lembrar que estou à disposição. Quando for o momento, é só me chamar! 👋'),
      ],
    },
  ],
  tetoDiario: 30,
  horaInicio: 9,
  horaFim: 19,
  credito: {
    ativo: true,
    dias: 30,
    texto: 'Oi, {nome}! Tudo bem? Aqui é {vendedor}. Os bancos atualizam as análises de crédito com frequência: quer que eu tente de novo o financiamento pra você? Sem compromisso 🙂',
  },
}

const inteiro = (v: unknown, min: number, max: number, padrao: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao
}
const IMAGEM_GUARDADA = /^\/pro-labore\/imagens\/[A-Za-z0-9_-]{20,40}$/
/** Dias de cada passo: até 30 nos fluxos da negociação; o resgate de perdido vai até 180. */
export const limiteDias = (s: SituacaoFollow) => (s === 'REATIVACAO' ? { min: 3, max: 180 } : { min: 1, max: 30 })

function lerPassos(lista: unknown, s: SituacaoFollow): PassoFollow[] {
  if (!Array.isArray(lista)) return []
  const { min, max } = limiteDias(s)
  return lista
    .filter(p => p && typeof p.texto === 'string' && p.texto.trim())
    .map(p => {
      const imagem = typeof p.imagem === 'string' && IMAGEM_GUARDADA.test(p.imagem) ? p.imagem : null
      const midia: MidiaFollow = MIDIAS_FOLLOW.includes(p.midia) && (p.midia !== 'IMAGEM' || imagem) ? p.midia : 'NENHUMA'
      return { dias: inteiro(p.dias, min, max, min), texto: String(p.texto).trim().slice(0, 600), midia, imagem: midia === 'IMAGEM' ? imagem : null }
    })
    .sort((a, b) => a.dias - b.dias)
    .filter((p, i, l) => i === 0 || p.dias > l[i - 1].dias)
    .slice(0, 5)
}

/**
 * Config salva + padrão. Aceita a config antiga (uma cadência só em
 * `passos`), que vira o fluxo "Parou de responder"; nela os fluxos novos
 * começam desligados, para nada diferente sair antes de o dono revisar.
 */
export function lerConfigFollow(salva: unknown): ConfigFollow {
  const c = (salva && typeof salva === 'object' ? salva : {}) as Partial<ConfigFollow> & { passos?: unknown }
  const antiga = !Array.isArray(c.fluxos) && Array.isArray(c.passos)
  const salvos = Array.isArray(c.fluxos) ? c.fluxos : antiga ? [{ situacao: 'SEM_RESPOSTA', ativo: true, aoFinal: 'NADA', passos: c.passos }] : []
  const fluxos = FOLLOW_PADRAO.fluxos.map(padrao => {
    const f = salvos.find(x => x && x.situacao === padrao.situacao) as Partial<FluxoFollow> | undefined
    if (!f) return antiga ? { ...padrao, ativo: false } : padrao
    const passos = lerPassos(f.passos, padrao.situacao)
    return {
      situacao: padrao.situacao,
      ativo: typeof f.ativo === 'boolean' ? f.ativo : padrao.ativo,
      passos: passos.length ? passos : padrao.passos,
      aoFinal: f.aoFinal === 'AVISAR_VENDEDOR' || f.aoFinal === 'NADA' ? f.aoFinal : padrao.aoFinal,
    }
  })
  const cr = (c.credito && typeof c.credito === 'object' ? c.credito : {}) as Partial<CreditoFollow>
  const horaInicio = inteiro(c.horaInicio, 7, 20, FOLLOW_PADRAO.horaInicio)
  return {
    fluxos,
    tetoDiario: inteiro(c.tetoDiario, 1, 100, FOLLOW_PADRAO.tetoDiario),
    horaInicio,
    horaFim: Math.max(horaInicio + 1, inteiro(c.horaFim, 8, 21, FOLLOW_PADRAO.horaFim)),
    credito: {
      ativo: typeof cr.ativo === 'boolean' ? cr.ativo : FOLLOW_PADRAO.credito.ativo,
      dias: inteiro(cr.dias, 7, 120, FOLLOW_PADRAO.credito.dias),
      texto: typeof cr.texto === 'string' && cr.texto.trim() ? cr.texto.trim().slice(0, 600) : FOLLOW_PADRAO.credito.texto,
    },
  }
}

export const fluxoDa = (cfg: ConfigFollow, s: SituacaoFollow): FluxoFollow => cfg.fluxos.find(f => f.situacao === s) ?? FOLLOW_PADRAO.fluxos.find(f => f.situacao === s)!

/** Em que ponto da negociação o cliente sumiu (lead aberto): o marco mais adiantado. */
export function situacaoDoFollow(d: { aprovacaoEnviadaEm: Date | null; temSimulacao: boolean }): SituacaoFollow {
  if (d.aprovacaoEnviadaEm) return 'APOS_APROVACAO'
  if (d.temSimulacao) return 'APOS_SIMULACAO'
  return 'SEM_RESPOSTA'
}

/**
 * O fluxo da conversa. Com passo já enviado, segue o fluxo em que começou
 * (conversa antiga sem fluxo gravado = "Parou de responder"); desligado no
 * meio, para. Sem passo enviado, vale a situação de agora; fluxo da situação
 * desligado cai no "Parou de responder".
 */
export function escolherFluxo(cfg: ConfigFollow, d: { situacao: SituacaoFollow; fluxoAtual: string | null; passo: number }): FluxoFollow | null {
  if (d.passo > 0) {
    const atual = fluxoDa(cfg, SITUACOES_FOLLOW.includes(d.fluxoAtual as SituacaoFollow) ? d.fluxoAtual as SituacaoFollow : 'SEM_RESPOSTA')
    return atual.ativo ? atual : null
  }
  const daSituacao = fluxoDa(cfg, d.situacao)
  if (daSituacao.ativo) return daSituacao
  const geral = fluxoDa(cfg, 'SEM_RESPOSTA')
  return d.situacao !== 'REATIVACAO' && geral.ativo ? geral : null
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
export function proximoFollow(d: { passos: PassoFollow[]; passo: number; parado: string | null; baseEm: Date | null; ultimoFollowEm: Date | null; agora: Date }): (PassoFollow & { indice: number; devidoEm: Date }) | null {
  if (d.parado || !d.baseEm) return null
  const p = d.passos[d.passo]
  if (!p) return null
  const devidoEm = new Date(d.baseEm.getTime() + p.dias * DIA)
  if (devidoEm > d.agora) return null
  if (d.ultimoFollowEm && d.agora.getTime() - d.ultimoFollowEm.getTime() < INTERVALO_MINIMO) return null
  return { ...p, indice: d.passo, devidoEm }
}

/** Quando o próximo passo fica devido (para a fila da tela), ignorando horário e teto. */
export function quandoDevido(d: { passos: PassoFollow[]; passo: number; parado: string | null; baseEm: Date | null; ultimoFollowEm: Date | null }): Date | null {
  if (d.parado || !d.baseEm) return null
  const p = d.passos[d.passo]
  if (!p) return null
  const porDias = d.baseEm.getTime() + p.dias * DIA
  const porIntervalo = d.ultimoFollowEm ? d.ultimoFollowEm.getTime() + INTERVALO_MINIMO : 0
  return new Date(Math.max(porDias, porIntervalo))
}

/** Último passo enviado e 2 dias sem resposta: hora de passar para o vendedor (fluxo com "avisar o vendedor"). */
export function fimDoFluxo(d: { fluxo: FluxoFollow; passo: number; ultimoFollowEm: Date | null; agora: Date }): boolean {
  return d.fluxo.aoFinal === 'AVISAR_VENDEDOR' && d.passo === d.fluxo.passos.length && !!d.ultimoFollowEm && d.agora.getTime() - d.ultimoFollowEm.getTime() >= 2 * DIA
}

/** Início do dia em Brasília (para o teto diário). */
export function inicioDoDiaBrt(agora: Date): Date {
  const d = new Date(agora.getTime() - BRT_MS)
  d.setUTCHours(0, 0, 0, 0)
  return new Date(d.getTime() + BRT_MS)
}
