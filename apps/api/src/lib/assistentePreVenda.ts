// Pré-venda do Assistente (Ajuste 3) — funções puras. O robô trabalha nas
// primeiras etapas (Lead → Abordado → Levantamento) e entrega ao vendedor,
// na porta do MQL, a ficha pronta para simular. Aqui:
// - ler respostas livres ("quero a Titan financiada com 2 mil de entrada,
//   tenho CNH") e tirar delas pagamento, entrada, CNH, parcela, prazo e troca;
// - transformar as respostas do roteiro nos campos do lead (levantamento);
// - dizer o que ainda falta para a ficha ficar pronta.
// Sem IA: regras. Valores em dinheiro nunca vão para a IA.
import { normalizar, type CampoLead } from './assistenteRoteiro'

export type Pagamento = 'A_VISTA' | 'FINANCIADO'
export type Cnh = 'TEM' | 'EM_PROCESSO' | 'NAO_TEM'

/** Valor em reais escrito pelo cliente: "2 mil", "2.500", "R$ 1500,00", "2k", "3 mil e 500". */
export function lerValor(texto: string): number | null {
  const n = normalizar(texto).replace(/r\$/g, ' ')
  const mil = n.match(/(\d+(?:[.,]\d+)?)\s*(?:mil|k)\b(?:\s*e\s*(\d{1,3}))?/)
  if (mil) { const base = Number(mil[1].replace(',', '.')) * 1000; return Math.round(base + (mil[2] ? Number(mil[2]) : 0)) }
  const num = n.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/)
  if (!num) return null
  const v = Number(num[1].replace(/\./g, '')) + (num[2] ? Number(`0.${num[2]}`) : 0)
  return Number.isFinite(v) && v > 0 ? v : null
}

export function lerPagamento(texto: string): Pagamento | null {
  const n = normalizar(texto)
  if (/\b(a vista|avista|dinheiro|pix|pagar tudo|tudo de uma vez)\b/.test(n)) return 'A_VISTA'
  if (/\b(financ\w*|parcel\w*|prestac\w*|consorcio|carne|boleto|credito|cdc)\b/.test(n) || /\b\d{2}\s*(x|vezes)\b/.test(n)) return 'FINANCIADO'
  return null
}

export function lerCnh(texto: string): Cnh | null {
  const n = normalizar(texto)
  const fala = /\b(cnh|carteira|habilitac\w*|habilitad\w*|categoria a)\b/.test(n)
  if (!fala && !/^(tenho|nao tenho|estou tirando|tirando)$/.test(n)) return null
  if (/\b(tirando|em processo|fazendo (a )?(auto ?escola|cnh|carteira)|vou tirar|autoescola|auto escola)\b/.test(n)) return 'EM_PROCESSO'
  if (/\b(nao tenho|sem (cnh|carteira|habilitacao)|nao sou habilitad\w*|nao possuo)\b/.test(n)) return 'NAO_TEM'
  if (/\b(tenho|possuo|sou habilitad\w*|habilitado|ja tenho|categoria a)\b/.test(n)) return 'TEM'
  return null
}

/** Entrada: valor, "sem entrada" (0) ou nada. */
export function lerEntrada(texto: string): { tem: boolean; valor: number | null } | null {
  const n = normalizar(texto)
  if (/\b(sem entrada|nao tenho entrada|nao tenho nada de entrada|zero de entrada|entrada zero|nao tenho (dinheiro|valor))\b/.test(n) || /^(nao|nao tenho|nada|zero|0)$/.test(n)) return { tem: false, valor: null }
  if (/\bentrada\b/.test(n) || /\b(de|com) \d/.test(n)) {
    const v = lerValor(n.replace(/\b\d{2}\s*(x|vezes|meses)\b/g, ' ').replace(/\bparcela[^\d]*\d[\d.,]*\s*(mil|k)?/g, ' '))
    if (v != null && v >= 100) return { tem: true, valor: v }
    if (/\b(tenho|sim|da pra dar|consigo dar)\b/.test(n)) return { tem: true, valor: null }
  }
  return null
}

export function lerParcela(texto: string): number | null {
  const n = normalizar(texto)
  const m = n.match(/\b(?:parcela|prestac\w*|por mes|mensal|ate)\b[^\d]{0,20}(\d[\d.,]*\s*(?:mil|k)?)/) ?? n.match(/(\d[\d.,]*)\s*(?:por mes|reais por mes|mensais|ao mes)/)
  if (!m) return null
  const v = lerValor(m[1])
  return v != null && v >= 50 && v <= 20_000 ? v : null
}

export function lerPrazo(texto: string): number | null {
  const n = normalizar(texto)
  const m = n.match(/\b(\d{2})\s*(?:x|vezes|meses|parcelas)\b/)
  const v = m ? Number(m[1]) : null
  return v && v >= 6 && v <= 72 ? v : null
}

export function lerTroca(texto: string): string | null {
  const n = normalizar(texto)
  if (!/\b(troca|trocar|dar na troca|minha moto|meu carro|tenho uma)\b/.test(n)) return null
  if (/\b(nao tenho|sem) (troca|moto|veiculo)\b/.test(n)) return null
  return texto.trim().slice(0, 120)
}

/** O que dá para tirar de uma mensagem livre, por campo do roteiro. */
export function extrairDoTexto(texto: string): Partial<Record<CampoLead, string>> {
  const out: Partial<Record<CampoLead, string>> = {}
  const pg = lerPagamento(texto); if (pg) out.formaPagamento = pg === 'A_VISTA' ? 'À vista' : 'Financiado'
  const cnh = lerCnh(texto); if (cnh) out.situacaoCnh = cnh === 'TEM' ? 'Tenho CNH' : cnh === 'EM_PROCESSO' ? 'Estou tirando' : 'Não tenho'
  const en = lerEntrada(texto); if (en) out.valorEntrada = en.tem ? (en.valor != null ? `R$ ${en.valor.toLocaleString('pt-BR')}` : 'Tenho entrada') : 'Sem entrada'
  const pa = lerParcela(texto); if (pa) out.parcelaDesejada = `R$ ${pa.toLocaleString('pt-BR')}`
  const pr = lerPrazo(texto); if (pr) out.prazoDesejado = `${pr} meses`
  const tr = lerTroca(texto); if (tr) out.veiculoTroca = tr
  return out
}

export interface Levantamento {
  modeloInteresse: string | null
  motoId: string | null
  formaPagamento: Pagamento | null
  troca: string | null
  situacaoCnh: Cnh | null
  temEntrada: boolean | null
  entradaValor: number | null
  parcelaDesejada: number | null
  prazoMeses: number | null
  cidade: string | null
  melhorHorario: string | null
}

type Pergunta = { id: string; campo: CampoLead }
/** "Quero a Titan 160 financiada com 2 mil de entrada" → "Titan 160" (o resto já foi para os outros campos). */
export function limparModelo(t: string | null): string | null {
  if (!t) return null
  const corte = t.search(/\s*(,|\.|\bfinanc|\ba vista\b|\bà vista\b|\bcom\s+\d|\bcom entrada|\bentrada\b|\btenho\b|\bparcel|\bate\b|\baté\b|\bpra\s+(dar|pagar)|\bno\s+(pix|cartao|cartão)|\d{2}\s*x\b)/i)
  const base = (corte > 0 ? t.slice(0, corte) : t).replace(/^\s*(oi|ola|olá|bom dia|boa tarde|boa noite)[,!.\s]*/i, '').replace(/^\s*(eu\s+)?(quero|queria|gostaria( de)?|tenho interesse( na| no| em)?|interesse( na| no| em)?|procuro|procurando)\s+(a|o|uma|um|na|no)?\s*/i, '').trim()
  return (base || t).slice(0, 80)
}
/** As respostas do roteiro viram o levantamento do lead (o que não deu para entender fica nulo). */
export function levantamentoDasRespostas(perguntas: Pergunta[], respostas: Record<string, string>): Levantamento {
  const r = (campo: CampoLead) => { const p = perguntas.find(x => x.campo === campo && respostas[x.id]); return p ? respostas[p.id] : null }
  const pagTexto = r('formaPagamento')
  let formaPagamento = pagTexto ? lerPagamento(pagTexto) : null
  const trocaPag = pagTexto && /troca/i.test(normalizar(pagTexto)) ? pagTexto : null
  const entradaTexto = r('valorEntrada')
  const en = entradaTexto ? lerEntrada(entradaTexto) ?? lerEntrada(`entrada ${entradaTexto}`) ?? (lerValor(entradaTexto) ? { tem: true, valor: lerValor(entradaTexto) } : null) : null
  const cnhTexto = r('situacaoCnh')
  const parcelaTexto = r('parcelaDesejada'), prazoTexto = r('prazoDesejado')
  const prazo = prazoTexto ? (lerPrazo(prazoTexto) ?? (Number(normalizar(prazoTexto).match(/\d{2}/)?.[0]) || null)) : null
  const troca = r('veiculoTroca') ?? trocaPag
  // Quem tem troca e vai financiar o resto: o pagamento fica "financiado" quando a parcela ou o prazo aparecem.
  if (!formaPagamento && (parcelaTexto || prazo)) formaPagamento = 'FINANCIADO'
  return {
    modeloInteresse: limparModelo(r('modeloInteresse')),
    motoId: respostas._motoId ?? null,
    formaPagamento,
    troca: troca && !/^(nao|nao tenho|sem troca)$/i.test(normalizar(troca)) ? troca.slice(0, 120) : null,
    situacaoCnh: cnhTexto ? lerCnh(/cnh|carteira|habilit/i.test(cnhTexto) ? cnhTexto : `cnh ${cnhTexto}`) : null,
    // À vista: a "entrada" é o pagamento inteiro.
    temEntrada: formaPagamento === 'A_VISTA' ? true : en ? en.tem : null,
    entradaValor: en?.valor ?? null,
    parcelaDesejada: parcelaTexto ? (lerParcela(`parcela ${parcelaTexto}`) ?? lerValor(parcelaTexto)) : null,
    prazoMeses: prazo,
    cidade: r('cidade'),
    melhorHorario: r('melhorHorario'),
  }
}

/** O que falta para a ficha ficar pronta para simular (os 4 critérios do levantamento + a forma de pagamento). */
export function faltaParaSimular(l: Levantamento): string[] {
  const falta: string[] = []
  if (!l.modeloInteresse && !l.motoId) falta.push('modelo')
  if (!l.formaPagamento) falta.push('forma de pagamento')
  if (l.formaPagamento !== 'A_VISTA' && l.temEntrada == null) falta.push('entrada')
  if (!l.situacaoCnh) falta.push('CNH')
  return falta
}
