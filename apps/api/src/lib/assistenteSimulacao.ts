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
  // Bancos parceiros para a pré-análise e se o robô pede a ficha (CPF e
  // nascimento, com autorização) depois da simulação.
  bancos: string[]
  preAnalise: boolean
}

export const SIMULACAO_PADRAO: ConfigSimulacao = {
  taxas: [{ prazo: 12, taxa: 1.79 }, { prazo: 24, taxa: 1.89 }, { prazo: 36, taxa: 1.99 }, { prazo: 48, taxa: 2.09 }],
  entradaMinimaPct: 10,
  perguntarRenda: true,
  comprometimentoMax: 30,
  aviso: 'Simulação ilustrativa, sem IOF e tarifas, sujeita à análise de crédito. {vendedor} confirma as condições com você.',
  bancos: [],
  preAnalise: false,
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
  const bancos = Array.isArray(c.bancos)
    ? c.bancos.filter((b): b is string => typeof b === 'string').map(b => b.trim().slice(0, 40)).filter(Boolean)
      .filter((b, i, l) => l.findIndex(x => x.toLowerCase() === b.toLowerCase()) === i).slice(0, 8)
    : []
  return {
    taxas: taxas.length ? taxas : SIMULACAO_PADRAO.taxas,
    entradaMinimaPct: numero(c.entradaMinimaPct, 0, 90, SIMULACAO_PADRAO.entradaMinimaPct),
    perguntarRenda: typeof c.perguntarRenda === 'boolean' ? c.perguntarRenda : SIMULACAO_PADRAO.perguntarRenda,
    comprometimentoMax: numero(c.comprometimentoMax, 10, 60, SIMULACAO_PADRAO.comprometimentoMax),
    aviso,
    bancos,
    preAnalise: bancos.length > 0 && c.preAnalise === true,
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

// ---------- Pré-análise de crédito ----------
// Nível 2 sem API: com a autorização do cliente o robô pega CPF e data de
// nascimento; o vendedor lança a ficha no portal de cada banco parceiro e
// registra a resposta. Só depois disso alguém fala em "aprovado".

export const STATUS_ANALISE = ['A_ENVIAR', 'EM_ANALISE', 'APROVADA', 'RECUSADA'] as const
export type StatusAnalise = (typeof STATUS_ANALISE)[number]

/** CPF com os dígitos verificadores certos (aceita pontos, traço e espaço) → só os 11 números. */
export function lerCpf(texto: string): string | null {
  const achado = texto.match(/\d{3}[.\s]?\d{3}[.\s]?\d{3}[\s-]?\d{2}/)
  const d = (achado?.[0] ?? texto).replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return null
  const dv = (n: number) => {
    let s = 0
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]) ? d : null
}
export const formatarCpf = (d: string) => `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Data de nascimento ("15/03/1990", "15-3-90", "15 de março de 1990") de quem tem de 18 a 100 anos → "15/03/1990". */
export function lerNascimento(texto: string, hoje = new Date()): string | null {
  const n = normalizar(texto)
  const num = n.match(/\b(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4}|\d{2})\b/)
  const ext = n.match(/\b(\d{1,2})\s+de\s+([a-z]+)\s+(?:de\s+)?(\d{4})\b/)
  const so = n.replace(/\D/g, '')
  let [dia, mes, ano] = [0, 0, 0]
  if (num) [dia, mes, ano] = [Number(num[1]), Number(num[2]), Number(num[3])]
  else if (ext && MESES.includes(ext[2])) [dia, mes, ano] = [Number(ext[1]), MESES.indexOf(ext[2]) + 1, Number(ext[3])]
  else if (so.length === 8) [dia, mes, ano] = [Number(so.slice(0, 2)), Number(so.slice(2, 4)), Number(so.slice(4))]
  else return null
  if (ano < 100) ano += ano > hoje.getUTCFullYear() % 100 ? 1900 : 2000
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null
  const idade = (hoje.getTime() - d.getTime()) / (365.25 * 86_400_000)
  if (idade < 18 || idade > 100) return null
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`
}

const ACEITA = /^(sim|s|pode|claro|autorizo|ok|okay|quero|bora|manda|beleza|blz|com certeza|tudo bem|isso|aceito|faz|fechado|pode ser|vamos)\b/
const RECUSA = /^(nao|n|agora nao|prefiro nao|nao precisa|depois|deixa|melhor nao|dispenso|sem|nem)\b/
export const recusaPreAnalise = (t: string) => RECUSA.test(normalizar(t))
export const aceitaPreAnalise = (t: string) => !recusaPreAnalise(t) && ACEITA.test(normalizar(t))

export const listaNatural = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`)

export const textoConsentimento = (bancos: string[], vendedor: string) =>
  `Quer que ${vendedor} já faça uma *pré-análise de crédito* nos bancos parceiros (${listaNatural(bancos)})? Para isso preciso do seu CPF e da sua data de nascimento, usados só para essa consulta. Responda *sim* para autorizar ou *não*.`
export const TEXTO_CPF = 'Combinado! Me manda o seu CPF (só os números).'
export const TEXTO_CPF_INVALIDO = 'Esse CPF não parece certo 🤔 Confere e me manda de novo, só os números?'
export const TEXTO_NASCIMENTO = 'E a sua data de nascimento? (ex.: 15/03/1990)'
export const TEXTO_NASCIMENTO_INVALIDO = 'Não entendi a data 🤔 Me manda no formato dia/mês/ano, por exemplo 15/03/1990.'
export const textoFichaRecebida = (vendedor: string) => `🔒 Recebido! ${vendedor} faz a pré-análise nos bancos e te retorna com as condições aprovadas.`

export interface AnaliseCredito { banco: string; status: StatusAnalise; entrada: number | null; prazo: number | null; parcela: number | null; taxa: number | null }

/** Leitura da pré-análise para a nota, as etiquetas e o funil. */
export function leituraCredito(ficha: { analises: Array<{ status: string }> } | null | undefined): { ficha: boolean; aprovado: boolean; recusado: boolean } | null {
  if (!ficha) return null
  const s = ficha.analises.map(a => a.status)
  return { ficha: true, aprovado: s.includes('APROVADA'), recusado: s.length > 0 && s.every(x => x === 'RECUSADA') }
}

/** Mensagem ao cliente com a condição que o banco aprovou (lançada pelo vendedor). */
export function textoAprovacao(a: AnaliseCredito, o: { nome: string; vendedor: string }): string {
  const condicao = [a.entrada !== null ? `entrada de ${reais(a.entrada)}` : null, a.prazo && a.parcela ? `${a.prazo}x de ${reais(a.parcela, 2)}` : null].filter(Boolean)
  return [
    `✅ Boa notícia${o.nome ? `, ${o.nome}` : ''}! Sua pré-análise foi aprovada no ${a.banco}${condicao.length ? `: ${condicao.join(' e ')}` : ''}.`,
    '',
    `${o.vendedor} já pode seguir com a sua proposta. Prefere passar na loja ou fechar por aqui?`,
    '',
    '_Sujeito à confirmação dos documentos pelo banco._',
  ].join('\n')
}

/** Ficha para o vendedor colar no portal de cada banco. */
export function textoFicha(f: { nome: string; telefone: string; cpf: string; nascimento: string | null; renda: number | null; moto: string | null; valor: number | null; entrada: number | null; autorizadoEm: Date }): string {
  const quando = f.autorizadoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return [
    `Nome: ${f.nome}`,
    `CPF: ${formatarCpf(f.cpf)}`,
    `Nascimento: ${f.nascimento ?? 'a confirmar'}`,
    `Telefone: ${f.telefone}`,
    ...(f.renda ? [`Renda informada: ${reais(f.renda)}`] : []),
    ...(f.moto || f.valor ? [`Veículo: ${[f.moto, f.valor ? reais(f.valor) : null].filter(Boolean).join(' · ')}`] : []),
    ...(f.entrada !== null ? [`Entrada: ${reais(f.entrada)}`] : []),
    `Autorizou a consulta em ${quando}`,
  ].join('\n')
}
