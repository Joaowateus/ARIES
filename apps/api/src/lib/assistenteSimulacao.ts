// Simulação de financiamento — funções puras. É uma estimativa com as taxas
// de referência que a loja cadastra (Tabela Price): não consulta CPF, não
// passa pela IA e nunca diz que o crédito está aprovado.
import { normalizar } from './assistenteRoteiro'

export interface TaxaPrazo { prazo: number; taxa: number } // taxa em % ao mês
export interface ConfigSimulacao {
  taxas: TaxaPrazo[]
  entradaMinimaPct: number
  perguntarRenda: boolean
  // Quanto da renda a parcela pode ocupar para "caber no bolso".
  comprometimentoMax: number
  aviso: string
}

export const SIMULACAO_PADRAO: ConfigSimulacao = {
  taxas: [{ prazo: 12, taxa: 1.79 }, { prazo: 24, taxa: 1.89 }, { prazo: 36, taxa: 1.99 }, { prazo: 48, taxa: 2.09 }],
  entradaMinimaPct: 10,
  perguntarRenda: true,
  comprometimentoMax: 30,
  aviso: 'Simulação ilustrativa, sem IOF e tarifas, sujeita à análise de crédito. {vendedor} confirma as condições com você.',
}

const numero = (v: unknown, min: number, max: number, padrao: number, casas = 0) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return padrao
  const f = 10 ** casas
  return Math.min(max, Math.max(min, Math.round(n * f) / f))
}

export function lerConfigSimulacao(salva: unknown): ConfigSimulacao {
  const c = (salva && typeof salva === 'object' ? salva : {}) as Partial<ConfigSimulacao>
  const taxas = Array.isArray(c.taxas)
    // Prazo fora de 6 a 72 meses ou taxa fora de 0 a 10% ao mês: descarta (não arredonda para dentro).
    ? c.taxas.map(t => ({ prazo: Math.round(Number(t?.prazo)), taxa: Math.round(Number(t?.taxa) * 100) / 100 }))
      .filter(t => t.prazo >= 6 && t.prazo <= 72 && t.taxa >= 0 && t.taxa <= 10)
      .sort((a, b) => a.prazo - b.prazo)
      .filter((t, i, l) => i === 0 || t.prazo !== l[i - 1].prazo)
      .slice(0, 6)
    : SIMULACAO_PADRAO.taxas
  const aviso = typeof c.aviso === 'string' && c.aviso.trim() ? c.aviso.trim().slice(0, 300) : SIMULACAO_PADRAO.aviso
  return {
    taxas: taxas.length ? taxas : SIMULACAO_PADRAO.taxas,
    entradaMinimaPct: numero(c.entradaMinimaPct, 0, 90, SIMULACAO_PADRAO.entradaMinimaPct),
    perguntarRenda: typeof c.perguntarRenda === 'boolean' ? c.perguntarRenda : SIMULACAO_PADRAO.perguntarRenda,
    comprometimentoMax: numero(c.comprometimentoMax, 10, 60, SIMULACAO_PADRAO.comprometimentoMax),
    aviso,
  }
}

/** Parcela da Tabela Price. Taxa zero vira divisão simples. */
export function parcelaPrice(financiado: number, taxaPct: number, prazo: number): number {
  const i = taxaPct / 100
  const p = i === 0 ? financiado / prazo : (financiado * i) / (1 - (1 + i) ** -prazo)
  return Math.round(p * 100) / 100
}

const PULAR = /^(pular|pula|pulo|prefiro nao|nao quero (dizer|informar|falar)|nao sei|sei la|depois|nao vou (dizer|informar))\b/
const ZERO = /^(nao|sem|nenhum|nenhuma|nada|zero|nao tenho)\b/

/**
 * Valor em reais escrito pelo cliente: "3 mil", "R$ 2.500,00", "3,5 mil",
 * "uns 2 mil e 500", "5k". "não"/"nada" = 0; "pular"/"não sei" = null.
 * Número pequeno (menos de 100) é lido como milhar: ninguém dá R$ 5 de entrada.
 */
export function lerValor(bruto: string): number | null {
  const t = normalizar(bruto).replace(/r\$\s*/g, '').trim()
  if (!t || PULAR.test(t)) return null
  const m = t.match(/(\d+(?:[.,]\d+)*)\s*(mil|k)?\b(?:\s*e\s*(\d{1,3})\b)?/)
  if (!m) {
    if (/\bmil\b/.test(t)) return 1000
    return ZERO.test(t) ? 0 : null
  }
  const [, num, milhar, resto] = m
  let s = num
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = !milhar && /,\d{3}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.')
  else if (s.includes('.')) s = /\.\d{3}(\.|$)/.test(s) && !milhar ? s.replace(/\./g, '') : s
  let v = Number(s)
  if (!Number.isFinite(v)) return null
  if (milhar) v = v * 1000 + (resto ? Number(resto) : 0)
  else if (v > 0 && v < 100) v *= 1000
  return Math.round(v)
}

export type AvaliacaoSimulacao = 'CABE' | 'APERTADA' | 'NAO_CABE' | 'SEM_RENDA'
export interface OpcaoSimulacao { prazo: number; taxa: number; parcela: number; comprometimentoPct: number | null }
export interface ResultadoSimulacao {
  valor: number
  entradaInformada: number | null
  entrada: number
  entradaAjustada: boolean
  financiado: number
  renda: number | null
  opcoes: OpcaoSimulacao[]
  avaliacao: AvaliacaoSimulacao
  // Prazo mais curto que cabe no orçamento (ou o mais longo, se nenhum cabe).
  melhorPrazo: number | null
}

/** null quando não há o que financiar (entrada cobre o valor). */
export function simular(d: { valor: number; entrada: number | null; renda: number | null; cfg: ConfigSimulacao }): ResultadoSimulacao | null {
  if (!(d.valor > 0)) return null
  const minima = Math.round((d.valor * d.cfg.entradaMinimaPct) / 100)
  const entrada = Math.max(d.entrada ?? 0, minima)
  if (entrada >= d.valor) return null
  const financiado = d.valor - entrada
  const renda = d.renda && d.renda > 0 ? d.renda : null
  const opcoes = d.cfg.taxas.map(t => {
    const parcela = parcelaPrice(financiado, t.taxa, t.prazo)
    return { prazo: t.prazo, taxa: t.taxa, parcela, comprometimentoPct: renda ? Math.round((parcela / renda) * 1000) / 10 : null }
  })
  let avaliacao: AvaliacaoSimulacao = 'SEM_RENDA'
  let melhorPrazo: number | null = null
  if (renda) {
    const cabe = opcoes.filter(o => (o.comprometimentoPct ?? 100) <= d.cfg.comprometimentoMax)
    const apertada = opcoes.filter(o => (o.comprometimentoPct ?? 100) <= d.cfg.comprometimentoMax + 10)
    if (cabe.length) { avaliacao = 'CABE'; melhorPrazo = cabe[0].prazo } else if (apertada.length) { avaliacao = 'APERTADA'; melhorPrazo = apertada.at(-1)!.prazo } else { avaliacao = 'NAO_CABE'; melhorPrazo = opcoes.at(-1)?.prazo ?? null }
  }
  return { valor: d.valor, entradaInformada: d.entrada, entrada, entradaAjustada: (d.entrada ?? 0) < minima, financiado, renda, opcoes, avaliacao, melhorPrazo }
}

export const reais = (v: number, casas = 0) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}`
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
export const ROTULO_AVALIACAO: Record<AvaliacaoSimulacao, string> = { CABE: 'cabe no bolso', APERTADA: 'parcela apertada', NAO_CABE: 'parcela acima da renda', SEM_RENDA: 'sem renda informada' }

/** Mensagem do WhatsApp para o cliente (sem percentuais da renda dele). */
export function textoSimulacao(r: ResultadoSimulacao, o: { moto: string | null; mostrarPreco: boolean; aviso: string; vendedor: string }): string {
  const taxaMin = Math.min(...r.opcoes.map(x => x.taxa))
  const linhas = [`📊 *Simulação de financiamento*${o.moto ? ` — ${o.moto}` : ''}`, '']
  if (o.mostrarPreco) linhas.push(`Valor: ${reais(r.valor)}`)
  linhas.push(r.entrada > 0 ? `Entrada: ${reais(r.entrada)}${r.entradaAjustada ? ' (entrada mínima)' : ''}` : 'Sem entrada')
  for (const x of r.opcoes) linhas.push(`• ${x.prazo}x de ${reais(x.parcela, 2)}`)
  linhas.push('', `Taxa de referência a partir de ${pct(taxaMin)} ao mês.`)
  if (r.avaliacao === 'CABE' && r.melhorPrazo) linhas.push(`✅ Pelo que você me contou, a opção em ${r.melhorPrazo}x fica confortável no seu orçamento.`)
  else if (r.avaliacao === 'APERTADA' || r.avaliacao === 'NAO_CABE') linhas.push(`Com uma entrada um pouco maior a parcela fica mais leve: ${o.vendedor} te mostra as melhores opções.`)
  linhas.push('', `_${o.aviso}_`)
  return linhas.join('\n')
}

/** Uma linha para o vendedor (com a leitura da renda). */
export function resumoSimulacao(r: ResultadoSimulacao): string {
  const ref = r.opcoes.find(x => x.prazo === r.melhorPrazo) ?? r.opcoes.at(-1)!
  const peso = ref.comprometimentoPct !== null && r.renda ? ` (${ref.comprometimentoPct.toLocaleString('pt-BR')}% da renda de ${reais(r.renda)})` : ''
  return `entrada ${reais(r.entrada)}${r.entradaAjustada ? ' (mínima)' : ''} · ${ref.prazo}x de ${reais(ref.parcela)}${peso} → ${ROTULO_AVALIACAO[r.avaliacao]}`
}

export const TEXTO_RENDA = 'Pra eu te mostrar a parcela que cabe no seu bolso: qual é a sua renda mensal aproximada? Se preferir não dizer, responda *pular*.'

/** A forma de pagamento respondida é financiamento? */
export function vaiFinanciar(formaPagamento: string | null | undefined): boolean {
  return !!formaPagamento && /financ|parcel|prestac/.test(normalizar(formaPagamento))
}
