// Assistente pessoal do vendedor no chat "Você" — funções puras: entender a
// pergunta. Sem IA: os números saem do sistema (ver assistentePessoalDados).
// O chat "Você" é onde muita gente anota coisas, então só vira pergunta o
// que começa com "?" / "assistente" ou termina com "?" e casa com um assunto
// conhecido. Anotação comum continua ignorada.
import { normalizar } from './assistenteRoteiro'
import { lerValor } from './assistenteSimulacao'

export type Pergunta =
  | { tipo: 'HOJE' }
  | { tipo: 'ESPERANDO' }
  | { tipo: 'SEMANA' }
  | { tipo: 'MES' }
  | { tipo: 'QUENTES' }
  | { tipo: 'FOLLOWS' }
  | { tipo: 'FICHA'; moto: string }
  | { tipo: 'RESPOSTA'; assunto: string }
  | { tipo: 'LEAD'; nome: string }
  // Moto do estoque ou valor em reais ("? simular CG 160 entrada 3 mil renda 2500").
  | { tipo: 'SIMULAR'; alvo: string; entrada: number | null; renda: number | null }
  | { tipo: 'AJUDA' }

const CHAMADA = /^(\?+|@?assistente\b[\s,:-]*)/

export function interpretarPergunta(bruto: string): Pergunta | null {
  const original = bruto.trim()
  if (!original || original.length > 300) return null
  const n0 = normalizar(original)
  const chamou = CHAMADA.test(n0)
  const ehPergunta = original.endsWith('?')
  if (!chamou && !ehPergunta) return null
  const n = n0.replace(CHAMADA, '').replace(/[?!.\s]+$/, '').trim()
  // Texto com aspas preservado para "o que respondo para 'tá caro'".
  const semChamada = original.replace(/^(\?+|@?assistente\b[\s,:-]*)/i, '').replace(/[?!.\s]+$/, '').trim()
  if (!n) return chamou ? { tipo: 'AJUDA' } : null

  if (/^(ajuda|menu|comandos|o que (voce|vc) faz|o que (voce|vc) sabe)$/.test(n)) return { tipo: 'AJUDA' }
  if (/(quem (esta|ta|tá) esperando|quem (falta|preciso|tenho que) responder|quem me chamou|esperando (minha )?resposta|pendentes?$)/.test(n)) return { tipo: 'ESPERANDO' }
  if (/(leads? quentes?|quem (esta|ta) quente|^quentes?$|quem (esta|ta) (mais )?pronto pra comprar)/.test(n)) return { tipo: 'QUENTES' }
  if (/(meus follows|follows? (de|pra|para) hoje|follows? (pendentes?|atrasados?)|^follows?$|retornos? (de|pra|para) hoje)/.test(n)) return { tipo: 'FOLLOWS' }
  if (/(semana)/.test(n) && /(como|conversao|resultado|numero|desempenho|producao|vendi|vendas|leads?|minha|^semana$)/.test(n)) return { tipo: 'SEMANA' }
  if (/(\bmes\b)/.test(n) && /(como|conversao|resultado|numero|desempenho|producao|vendi|vendas|leads?|meu|^mes$)/.test(n)) return { tipo: 'MES' }
  if (/^(como (eu )?(estou|to|tou|ta|esta|vou)( indo)?( hoje)?|como (foi|esta|ta) (o )?(meu )?dia|meu dia|resumo( do dia| de hoje)?|hoje|meus numeros( de hoje)?|minha producao( de hoje)?)$/.test(n)) return { tipo: 'HOJE' }

  const simulacao = semChamada.match(/^simul(?:ar|a|e|a[cç][aã]o(?:\s+d[aoe])?)\s+(.{2,120})$/i)
  if (simulacao) {
    const resto = simulacao[1]
    const trecho = (re: RegExp) => resto.match(re)?.[1]?.trim() ?? null
    const entrada = /\bsem entrada\b/i.test(resto) ? '0' : trecho(/\bentrada\s+(?:de\s+)?(.+?)(?=\s+(?:e\s+)?renda\b|$)/i) ?? trecho(/\b(?:com\s+)?([\d.,]+\s*(?:mil|k)?)\s+de\s+entrada\b/i)
    const renda = trecho(/\brenda\s+(?:de\s+)?(.+?)(?=\s+(?:e\s+)?(?:com\s+)?entrada\b|$)/i)
    const alvo = resto.split(/\s+(?:com\s+|e\s+)?(?:sem\s+)?(?:entrada|renda)\b|\s+com\s+[\d.,]+\s*(?:mil|k)?\s+de\s+entrada\b/i)[0].trim()
    if (alvo) return { tipo: 'SIMULAR', alvo, entrada: entrada === null ? null : lerValor(entrada), renda: renda === null ? null : lerValor(renda) }
  }

  const ficha = semChamada.match(/^(?:ficha|dados|infos?|informa[cç](?:ão|oes|ões)|detalhes)\s+(?:d[aoe]\s+)?(.{2,60})$/i)
  if (ficha) return { tipo: 'FICHA', moto: ficha[1].trim() }
  const temNoEstoque = n.match(/^tem (?:a |o )?(.{2,60}?) (?:no estoque|disponivel|ainda)$/)
  if (temNoEstoque) return { tipo: 'FICHA', moto: temNoEstoque[1] }

  const resposta = semChamada.match(/^(?:o que|como)\s+(?:eu\s+)?(?:respondo|falo|digo|respondo|responder|contorno)\s+(?:pra|para|quando|se|a|ao|o)?\s*(?:o cliente\s+)?(?:diz|fala|disser|falar)?\s*(.{2,120})$/i)
  if (resposta) return { tipo: 'RESPOSTA', assunto: resposta[1].replace(/^["'“‘]|["'”’]$/g, '').trim() }

  const lead = semChamada.match(/^(?:como\s+(?:est[aá]|t[aá])\s+(?:o|a)\s+|lead\s+|cliente\s+)(.{2,60})$/i)
  if (lead && !/^(dia|semana|mes|mês|hoje)$/i.test(lead[1])) return { tipo: 'LEAD', nome: lead[1].trim() }

  return chamou ? { tipo: 'AJUDA' } : null
}

export const TEXTO_AJUDA_PESSOAL = [
  '🤖 *Pode me perguntar* (comece com ? ou termine com ?):',
  '',
  '• *como estou hoje?* — seus números do dia',
  '• *quem está esperando?* — leads sem resposta sua',
  '• *minha semana?* / *meu mês?* — leads, avanços e vendas',
  '• *leads quentes?* — quem está mais perto de comprar',
  '• *meus follows?* — retornos de hoje e atrasados',
  '• *ficha da XRE 300?* — a ficha do estoque',
  '• *o que respondo para "tá caro"?* — a resposta aprovada da loja',
  '• *como está a Ana?* — etapa, nota e última mensagem do lead',
  '• *simular CG 160 entrada 3 mil renda 2500?* — parcelas com as taxas da loja',
].join('\n')
