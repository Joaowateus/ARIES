// Captura de leads do WhatsApp — funções puras: intenção de compra de quem
// já é contato conhecido, os dados que o cliente manda por conta própria
// ("DADOS PARA SIMULAÇÃO: CPF... NASCIMENTO...") e a máscara desses dados
// em tudo que vira texto no CRM (observação, card).
import { lerCpf, lerNascimento, lerValor } from './assistenteSimulacao'

// Minúsculas e sem acento, com o mesmo tamanho do texto original (posição a
// posição), para achar os rótulos e recortar os valores do texto original.
function alinhado(texto: string): string {
  let s = ''
  for (const c of texto) {
    const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    s += base.length === c.length ? base : c.toLowerCase().padEnd(c.length, ' ').slice(0, c.length)
  }
  return s
}

const MODELOS = /\b(honda|yamaha|suzuki|kawasaki|dafra|shineray|haojue|royal enfield|bmw|triumph|titan|fan ?1[56]0|start ?160|bros|biz|pop ?110|cg ?1[256]0|xre|sahara|factor|fazer|lander|crosser|tenere|nmax|n-?max|pcx|elite|adv|cb ?(250|300|500|650)|twister|hornet|xj6|mt-?0[379]|ybr|neo|fluo|burgman|intruder|yes|dk ?150|xy ?150|scooter|0 ?km|zero ?km|seminova|seminovas)\b/
const COMPRA = /\b(moto|motos|motinha|financ\w*|parcel\w*|entrada|a vista|consorcio|quanto (custa|e|ta|fica|sai)|qual (o )?(valor|preco)|valor|preco|modelos?|estoque|disponive\w*|anuncio|vi (o|a|seu|sua|no)|interess\w*|cnh|simula\w*|proposta|test ride|troca|avaliar minha|comprar|quero (uma|um|a|o)|tabela|condic\w*|documentacao|transferencia)\b/

/** Contato conhecido escrevendo de compra ("qual o valor da Titan?", "vi o anúncio"). */
export function temIntencaoDeCompra(texto: string, nomesNoEstoque: string[] = []): boolean {
  const n = alinhado(texto)
  if (COMPRA.test(n) || MODELOS.test(n)) return true
  return nomesNoEstoque.some(m => m.length >= 3 && n.includes(alinhado(m)))
}

// ---------- Dados que o cliente manda ----------

const ROTULOS: Array<{ campo: keyof DadosDoCliente; re: RegExp }> = [
  { campo: 'cpf', re: /\bcpf\b\s*[:\-=]?/g },
  { campo: 'nascimento', re: /\b(data de nascimento|data nascimento|nascimento|data nasc\.?|dt\.? nasc\.?)\s*[:\-=]?/g },
  { campo: 'nome', re: /\b(nome completo|nome)\s*:/g },
  { campo: 'telefone', re: /\b(numero de telefone|numero de celular|telefone|celular)\s*[:\-=]?/g },
  { campo: 'email', re: /\b(e-?mail)\s*[:\-=]?/g },
  { campo: 'cnh', re: /\b(possui cnh|tem cnh|cnh)\s*\??\s*(\(\s*sim ou nao\s*\))?\s*[:\-=]?/g },
  { campo: 'entrada', re: /\b(valor de entrada|valor da entrada|entrada)\s*[:\-=]/g },
  { campo: 'parcela', re: /\b(valor confortavel de parcela|valor confortavel da parcela|parcela desejada|valor da parcela|parcela)\s*[:\-=]/g },
  { campo: 'renda', re: /\b(renda mensal|renda)\s*[:\-=]/g },
]

export interface DadosDoCliente {
  cpf: string | null
  nascimento: string | null
  nome: string | null
  telefone: string | null
  email: string | null
  cnh: boolean | null
  entrada: number | null
  parcela: number | null
  renda: number | null
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/

/**
 * Lê a ficha que o cliente manda por conta própria (com rótulos, numa linha
 * ou em várias). Vale com o CPF rotulado ou com ao menos dois rótulos.
 */
export function lerDadosDoCliente(texto: string, hoje = new Date()): DadosDoCliente | null {
  const n = alinhado(texto)
  const achados: Array<{ campo: keyof DadosDoCliente; inicio: number; fim: number }> = []
  for (const r of ROTULOS) {
    for (const m of n.matchAll(r.re)) {
      const inicio = m.index ?? 0
      // "nascimento" dentro de "data de nascimento" já foi achado.
      if (achados.some(a => inicio >= a.inicio && inicio < a.fim)) continue
      achados.push({ campo: r.campo, inicio, fim: inicio + m[0].length })
    }
  }
  achados.sort((a, b) => a.inicio - b.inicio)
  const unicos = achados.filter((a, i) => achados.findIndex(b => b.campo === a.campo) === i)
  if (!unicos.some(a => a.campo === 'cpf') && unicos.length < 2) return null
  const valor = (campo: keyof DadosDoCliente) => {
    const a = achados.find(x => x.campo === campo)
    if (!a) return null
    const proximo = achados.find(x => x.inicio >= a.fim)
    const bruto = texto.slice(a.fim, proximo ? proximo.inicio : undefined)
    const linha = bruto.split('\n').map(l => l.replace(/^[\s*_:\-–=]+|[\s*_]+$/g, '')).find(Boolean)
    return linha ?? null
  }
  const nome = valor('nome')
  const cnh = valor('cnh')
  const email = valor('email')?.match(EMAIL)?.[0] ?? null
  const dados: DadosDoCliente = {
    cpf: lerCpf(valor('cpf') ?? ''),
    nascimento: lerNascimento(valor('nascimento') ?? '', hoje),
    nome: nome && /^[\p{L}][\p{L} .'-]{2,79}$/u.test(nome) && nome.trim().split(/\s+/).length >= 2 ? nome.trim() : null,
    telefone: valor('telefone')?.replace(/\D/g, '').slice(0, 13) || null,
    email,
    cnh: cnh ? (/^s(im)?\b/i.test(alinhado(cnh)) ? true : /^n(ao)?\b/i.test(alinhado(cnh)) ? false : null) : null,
    entrada: valor('entrada') ? lerValor(valor('entrada')!) : null,
    parcela: valor('parcela') ? lerValor(valor('parcela')!) : null,
    renda: valor('renda') ? lerValor(valor('renda')!) : null,
  }
  return Object.values(dados).some(v => v !== null) ? dados : null
}

// ---------- Máscara para o CRM ----------

const CPF_FORMATADO = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g
const ONZE_DIGITOS = /\b\d{11}\b/g
const DATA_NASCIMENTO = /\b\d{1,2}\s*[/.-]\s*\d{1,2}\s*[/.-]\s*(19\d{2}|20[01]\d)\b/g

/**
 * CPF, data de nascimento e e-mail viram marcadores no texto que vai para o
 * CRM. CPF sem pontuação só quando os dígitos verificadores batem (11
 * números soltos podem ser um celular).
 */
export function mascararDadosPessoais(texto: string): string {
  return texto
    .replace(/\b(cpf\s*[:\-=]?\s*)\d[\d.\s-]{9,15}\d/gi, '$1[CPF]')
    .replace(CPF_FORMATADO, '[CPF]')
    .replace(ONZE_DIGITOS, d => (lerCpf(d) ? '[CPF]' : d))
    .replace(DATA_NASCIMENTO, '[data de nascimento]')
    .replace(new RegExp(EMAIL.source, 'g'), '[e-mail]')
}

/** Resumo do que o cliente mandou, sem os dados sensíveis (para a observação do lead). */
export function resumoDosDados(d: DadosDoCliente): string {
  const reais = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`
  return [
    d.nome ? 'nome completo' : null, d.cpf ? 'CPF' : null, d.nascimento ? 'nascimento' : null, d.email ? 'e-mail' : null,
    d.cnh === true ? 'tem CNH' : d.cnh === false ? 'sem CNH' : null,
    d.entrada !== null ? `entrada ${reais(d.entrada)}` : null,
    d.parcela ? `parcela desejada ${reais(d.parcela)}` : null,
    d.renda ? `renda ${reais(d.renda)}` : null,
  ].filter(Boolean).join(' · ')
}

/** "maria teste da silva" → "Maria Teste da Silva". */
export function nomeProprio(nome: string): string {
  const minusculas = ['da', 'de', 'do', 'das', 'dos', 'e']
  return nome.toLowerCase().split(/\s+/).filter(Boolean)
    .map((p, i) => (i > 0 && minusculas.includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ')
}

/** Nome de perfil que não serve como nome do cliente (emoji, número, uma palavra só). */
export function nomeFraco(nome: string | null | undefined): boolean {
  const palavras = (nome ?? '').replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(p => p.length >= 2)
  return palavras.length < 2
}
