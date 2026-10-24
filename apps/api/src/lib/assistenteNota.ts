// Nota do lead (0–100) pela conversa do WhatsApp — função pura, sem banco e
// sem IA. Cada ponto tem um motivo legível, para o vendedor entender por
// que o lead está quente ou frio (e a loja conseguir ajustar os pesos).

import { ConfigAssistente, normalizar, respostaDoCampo } from './assistenteRoteiro'

export interface SinalNota { chave: string; rotulo: string; pontos: number }
export interface NotaLead { nota: number; faixa: FaixaNota; sinais: SinalNota[] }
export type FaixaNota = 'QUENTE' | 'MORNO' | 'FRIO'

export function faixaNota(nota: number): FaixaNota {
  return nota >= 70 ? 'QUENTE' : nota >= 40 ? 'MORNO' : 'FRIO'
}

const URGENCIA = /\b(hoje|agora|ainda hoje|amanha|essa semana|esta semana|urgente|o quanto antes|pra ja|para ja|rapido|logo)\b/
const QUER_COMPRAR = /\b(quero comprar|vou comprar|vou levar|quero levar|quero fechar|fechar negocio|fechar o negocio|como faco (pra|para) comprar|posso ir ai|vou ai|passar ai|passo ai|visitar|ver pessoalmente|ver de perto|test ride|reservar|reserva pra mim|separa pra mim|segura pra mim)\b/
const CONDICOES = /\b(parcela|parcelas|entrada|financia|financiamento|financiar|documentacao|transferencia|garantia|aceita troca|na troca)\b/
const OBJECOES: Array<{ chave: string; rotulo: string; re: RegExp }> = [
  { chave: 'preco', rotulo: 'Achou caro', re: /\b(caro|cara demais|salgad|puxad|fora do (meu )?orcamento|nao cabe)\b/ },
  { chave: 'adiar', rotulo: 'Quer pensar / adiar', re: /\b(vou pensar|pensar melhor|depois eu (vejo|falo)|mais pra frente|mais para frente|agora nao)\b/ },
  { chave: 'credito', rotulo: 'Restrição no nome', re: /\b(nome sujo|negativad|spc|serasa|score baixo|cpf sujo)\b/ },
]
const SEM_ENTRADA = /^(nao|sem|nenhum|nada|zero|ainda nao)\b/

export interface DadosNota {
  cfg: ConfigAssistente
  origem: string | null
  respostas: Record<string, string>
  // Mensagens do cliente na conversa (qualquer ordem).
  textosDoContato: string[]
  resultado?: string | null
  // Leitura da simulação de financiamento (CABE, APERTADA, NAO_CABE, SEM_RENDA).
  simulacao?: string | null
  // Pré-análise de crédito: ficha autorizada e a resposta dos bancos.
  credito?: { ficha: boolean; aprovado: boolean; recusado: boolean } | null
}

export function calcularNota({ cfg, origem, respostas, textosDoContato, resultado, simulacao, credito }: DadosNota): NotaLead {
  const sinais: SinalNota[] = []
  const somar = (chave: string, rotulo: string, pontos: number) => sinais.push({ chave, rotulo, pontos })
  const textos = textosDoContato.map(normalizar)
  const tudo = textos.join(' \n ')

  if (origem === 'ANUNCIO') somar('origem', 'Veio de anúncio', 15)
  else if (origem === 'GATILHO') somar('origem', 'Chamou por frase de campanha', 10)
  else if (origem === 'CONTATO_NOVO') somar('origem', 'Contato novo', 5)

  if (respostaDoCampo(cfg, respostas, 'modeloInteresse')) somar('moto', 'Disse a moto que quer', 15)

  const pagamento = normalizar(respostaDoCampo(cfg, respostas, 'formaPagamento') ?? '')
  if (/vista/.test(pagamento)) somar('pagamento', 'Pagamento à vista', 20)
  else if (/financ|troca|parcel|consorcio|cartao/.test(pagamento)) somar('pagamento', 'Já sabe como vai pagar', 12)
  else if (pagamento) somar('pagamento', 'Respondeu a forma de pagamento', 6)

  const entrada = normalizar(respostaDoCampo(cfg, respostas, 'valorEntrada') ?? '')
  if (entrada && !SEM_ENTRADA.test(entrada)) somar('entrada', 'Tem entrada', 15)

  const perguntas = cfg.perguntas.length
  if (perguntas > 0 && cfg.perguntas.every(p => respostas[p.id])) somar('roteiro', 'Respondeu todas as perguntas', 10)

  if (URGENCIA.test(tudo)) somar('urgencia', 'Tem pressa', 15)
  if (QUER_COMPRAR.test(tudo)) somar('intencao', 'Quer comprar ou visitar a loja', 15)
  if (CONDICOES.test(tudo)) somar('condicoes', 'Perguntou condições', 5)
  if (resultado === 'PEDIU_ATENDENTE') somar('atendente', 'Pediu para falar com o vendedor', 10)
  if (textos.length >= 4) somar('engajado', 'Conversa ativa', 5)
  if (simulacao) somar('simulou', 'Fez a simulação de financiamento', 5)
  if (simulacao === 'CABE') somar('parcela', 'Parcela cabe na renda', 10)
  else if (simulacao === 'NAO_CABE') somar('parcela', 'Parcela acima da renda', -10)
  if (credito?.ficha) somar('ficha', 'Autorizou a pré-análise de crédito', 10)
  if (credito?.aprovado) somar('credito', 'Crédito pré-aprovado no banco', 20)
  else if (credito?.recusado) somar('credito', 'Crédito recusado nos bancos', -20)

  for (const o of OBJECOES) if (o.re.test(tudo)) somar(`objecao:${o.chave}`, o.rotulo, -10)
  if (resultado === 'DESISTIU') somar('desistiu', 'Pediu para parar', -60)

  const nota = Math.max(0, Math.min(100, sinais.reduce((t, s) => t + s.pontos, 0)))
  return { nota, faixa: faixaNota(nota), sinais }
}
