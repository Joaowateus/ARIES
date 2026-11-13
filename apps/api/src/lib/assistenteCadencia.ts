// Follow pelo robô escolhido pelo vendedor (Ajuste 3, Parte 2) — biblioteca
// de cadências da loja e o estado da cadência em cada conversa. Funções
// puras; o envio fica no motor (assistenteMotor.ts → rodarCadencias).
// Regras de segurança, as mesmas do follow automático: só em quem já
// conversou no WhatsApp, 1 mensagem por dia por cliente, teto por número,
// horário da loja de segunda a sábado; para sozinha quando o cliente
// responde, pede para parar ou o lead é ganho/perdido.
import type { MidiaFollow, PassoFollow } from './assistenteFollow'

export interface Cadencia { id: string; nome: string; descricao: string; passos: PassoFollow[] }
export type StatusCadencia = 'ATIVO' | 'PAUSADO' | 'CONCLUIDO' | 'PAROU_RESPOSTA' | 'CANCELADO'
export interface CadenciaDaConversa {
  id: string; nome: string; passos: PassoFollow[]
  passo: number // próximo passo a enviar (0 = o primeiro)
  inicioEm: string; proximoEm: string | null
  status: StatusCadencia; autorId: string | null; autorNome: string | null
  enviados: Array<{ passo: number; em: string }>
  motivoFim?: string
}

const p = (dias: number, texto: string, midia: MidiaFollow = 'NENHUMA'): PassoFollow => ({ dias, texto, midia, imagem: null })
export const CADENCIAS_PADRAO: Cadencia[] = [
  {
    id: 'leve', nome: 'Leve (1, 3 e 7 dias)', descricao: 'Para quem parou de responder: lembra sem pressionar.', passos: [
      p(1, 'Oi, {nome}! Tudo bem? Ficou alguma dúvida sobre a {moto}? Estou por aqui. 🙂'),
      p(3, '{nome}, separei umas fotos da {moto} pra você dar uma olhada. Quer que eu monte uma condição?', 'FOTO_MOTO'),
      p(7, '{nome}, vou parar de te chamar por aqui pra não incomodar. Quando quiser retomar, é só me mandar um oi! 👋'),
    ],
  },
  {
    id: 'intensa', nome: 'Intensa (1, 2, 4 e 7 dias)', descricao: 'Lead quente que sumiu: mais presença nos primeiros dias.', passos: [
      p(1, 'Oi, {nome}! Consegui ver a melhor condição pra {moto}. Posso te mandar agora?'),
      p(2, '{nome}, a {moto} tem saído bastante. Quer que eu segure pra você dar uma olhada?', 'FOTO_MOTO'),
      p(4, '{nome}, passando pra saber se ainda faz sentido pra você. Se preferir, te ligo rapidinho.'),
      p(7, '{nome}, vou deixar você à vontade. Quando quiser, é só chamar que eu te atendo na hora! 👋'),
    ],
  },
  {
    id: 'pos-simulacao', nome: 'Depois da simulação (1, 3 e 6 dias)', descricao: 'Mandou a simulação e o cliente não voltou.', passos: [
      p(1, 'Oi, {nome}! Conseguiu ver a simulação da {moto}? Se quiser, ajusto entrada ou parcela.'),
      p(3, '{nome}, dá pra mexer no prazo pra parcela caber melhor. Quer que eu refaça?'),
      p(6, '{nome}, a condição que te passei vale por pouco tempo. Quer garantir? Estou por aqui.'),
    ],
  },
  {
    id: 'reaquecer', nome: 'Reaquecer (7, 15 e 30 dias)', descricao: 'Cliente frio ou "vou pensar": contato espaçado.', passos: [
      p(7, 'Oi, {nome}! Chegaram novidades no estoque. Ainda pensa na {moto}?', 'FOTO_MOTO'),
      p(15, '{nome}, temos condições novas esse mês. Quer que eu te passe?'),
      p(30, '{nome}, passando pra lembrar que estou à disposição quando decidir. Abraço!'),
    ],
  },
]

const MIDIAS: MidiaFollow[] = ['NENHUMA', 'FOTO_MOTO', 'VIDEO_MOTO', 'IMAGEM']
function lerPassos(v: unknown): PassoFollow[] {
  if (!Array.isArray(v)) return []
  return v.map(x => x as Partial<PassoFollow>).filter(x => typeof x?.texto === 'string' && x.texto.trim()).slice(0, 8).map(x => ({
    dias: Math.max(0, Math.min(90, Math.round(Number(x.dias) || 0))), texto: String(x.texto).slice(0, 900),
    midia: MIDIAS.includes(x.midia as MidiaFollow) ? (x.midia as MidiaFollow) : 'NENHUMA', imagem: typeof x.imagem === 'string' ? x.imagem : null,
  }))
}

/** Biblioteca da loja: as salvas (editadas pelo dono) por cima das prontas. */
export function lerCadencias(salvas: unknown): Cadencia[] {
  const lista = Array.isArray(salvas) ? (salvas as Array<Partial<Cadencia>>) : []
  const out: Cadencia[] = []
  for (const c of lista) {
    const passos = lerPassos(c?.passos)
    if (!c?.id || !c.nome || !passos.length) continue
    out.push({ id: String(c.id).slice(0, 40), nome: String(c.nome).slice(0, 60), descricao: String(c.descricao ?? '').slice(0, 160), passos })
  }
  for (const padrao of CADENCIAS_PADRAO) if (!out.some(c => c.id === padrao.id)) out.push(padrao)
  return out
}

const DIA = 86_400_000
/** Quando sai o passo `i`, contando os dias a partir do início da cadência. */
export function quandoDoPasso(c: Pick<CadenciaDaConversa, 'passos' | 'inicioEm'>, i: number): string | null {
  const passo = c.passos[i]
  return passo ? new Date(new Date(c.inicioEm).getTime() + passo.dias * DIA).toISOString() : null
}

export function novaCadencia(c: Cadencia, inicio: Date, autor: { id: string | null; nome: string | null }, passos?: PassoFollow[]): CadenciaDaConversa {
  const ps = passos && lerPassos(passos).length ? lerPassos(passos) : c.passos
  const base: CadenciaDaConversa = { id: c.id, nome: c.nome, passos: ps, passo: 0, inicioEm: inicio.toISOString(), proximoEm: null, status: 'ATIVO', autorId: autor.id, autorNome: autor.nome, enviados: [] }
  return { ...base, proximoEm: quandoDoPasso(base, 0) }
}

export function lerCadenciaDaConversa(v: unknown): CadenciaDaConversa | null {
  const c = v as CadenciaDaConversa | null
  return c && typeof c === 'object' && Array.isArray(c.passos) && typeof c.status === 'string' ? c : null
}

/** Rótulo curto para o card do CRM: "Robô em follow · passo 2 de 3 · próximo 14/11 10:00". */
export function rotuloCadencia(c: CadenciaDaConversa): string {
  const total = c.passos.length
  if (c.status === 'ATIVO') return `Robô em follow (${c.nome.replace(/\s*\(.*\)$/, '')}) · passo ${Math.min(c.passo + 1, total)} de ${total}`
  if (c.status === 'PAUSADO') return `Follow do robô pausado · passo ${Math.min(c.passo + 1, total)} de ${total}`
  if (c.status === 'PAROU_RESPOSTA') return 'Cliente respondeu ao follow do robô'
  if (c.status === 'CONCLUIDO') return 'Follow do robô terminou sem resposta'
  return 'Follow do robô cancelado'
}
