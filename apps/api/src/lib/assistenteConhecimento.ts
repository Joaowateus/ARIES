// Base de conhecimento do Assistente Comercial — funções puras (sem banco),
// usadas pelo aprendizado, pelo robô e pelas sugestões: reconhecer de qual
// dúvida/objeção uma mensagem fala, dizer se uma mensagem parece dúvida ou
// objeção e os modelos prontos que a loja revisa antes de usar.
import { normalizar, preencher, type ContextoRoteiro } from './assistenteRoteiro'

export const TIPOS_CONHECIMENTO = ['DUVIDA', 'OBJECAO', 'ARGUMENTO', 'GATILHO'] as const
export type TipoConhecimento = (typeof TIPOS_CONHECIMENTO)[number]
export const STATUS_CONHECIMENTO = ['PARA_REVISAR', 'ATIVO', 'ARQUIVADO'] as const
export const ETAPAS_CONHECIMENTO = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA'] as const

// Texto só com letras/números e espaços, sem acento: "Aceita TROCA?!" → "aceita troca".
export function paraBusca(texto: string): string {
  return normalizar(texto).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function normalizarPalavraChave(p: string): string {
  return paraBusca(p).slice(0, 40)
}

// A palavra-chave casa no começo de uma palavra e aceita um final curto
// (parcela → parcelas, financia → financiar), sem pegar palavra maior.
function casaPalavra(texto: string, chave: string): boolean {
  if (!chave) return false
  const folga = chave.length >= 5 ? 4 : 2
  const re = new RegExp(`(?:^| )${chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-z0-9]{0,${folga}}(?= |$)`)
  return re.test(texto)
}

export interface ItemBusca { id: string; palavrasChave: string[] }
export interface Achado<T> { item: T; pontos: number; casadas: string[] }

/** Itens da base que a mensagem menciona, do mais forte para o mais fraco. */
export function acharConhecimento<T extends ItemBusca>(texto: string, itens: T[]): Achado<T>[] {
  const t = paraBusca(texto)
  if (!t) return []
  const achados: Achado<T>[] = []
  for (const item of itens) {
    const casadas = item.palavrasChave.map(normalizarPalavraChave).filter(k => k && casaPalavra(t, k))
    if (!casadas.length) continue
    // Expressão de várias palavras vale mais que uma palavra solta.
    const pontos = casadas.reduce((s, k) => s + k.split(' ').length * 2 + k.length / 20, 0)
    achados.push({ item, pontos, casadas })
  }
  return achados.sort((a, b) => b.pontos - a.pontos)
}

const COMECA_PERGUNTA = /^(qual|quais|quanto|quantos|quantas|como|onde|quando|tem|teria|tem como|voces|vcs|aceita|aceitam|faz|fazem|da pra|da para|posso|pode|podem|consigo|precisa|preciso|e possivel|vale|ja vem|vem com|inclui|sai|fica|existe|trabalham|financia)\b/
const OBJECAO = /\b(caro|cara demais|salgad|vou pensar|pensar melhor|depois eu|mais pra frente|mais para frente|nao tenho (entrada|dinheiro)|sem entrada|nome sujo|negativad|spc|serasa|score|juros|desconto|mais barat|outra loja|concorr|nao sei se|talvez|agora nao|nao consigo|nao cabe|apertad|fora do (meu )?orcamento)/

/** Mensagem do cliente que vale a pena aprender: pergunta ou objeção (e não resposta de roteiro). */
export function pareceDuvidaOuObjecao(texto: string): boolean {
  const bruto = texto.trim()
  if (bruto.length < 6 || bruto.length > 500) return false
  const t = paraBusca(bruto)
  if (!/[a-z]{3}/.test(t)) return false
  return bruto.includes('?') || COMECA_PERGUNTA.test(t) || OBJECAO.test(t)
}

const PREENCHIMENTO = /^(oi+|ola|opa|e ai|eai|bom dia|boa tarde|boa noite|tudo bem|tudo bom|td bem|blz|beleza|ok|okay|certo|entendi|entao|hm+|ah|ta|obrigad[oa]|vlw|valeu)$/

/** O que sobra da mensagem sem as perguntas e as saudações ("A CG 160, aceita troca?" → "A CG 160"). */
export function parteAfirmativa(texto: string): string {
  return texto.split(/[,;\n]+|(?<=[.!?])\s+/).map(s => s.trim()).filter(s => {
    const t = paraBusca(s)
    return t.length >= 2 && !s.includes('?') && !COMECA_PERGUNTA.test(t) && !PREENCHIMENTO.test(t)
  }).join(', ')
}

/** Resposta aprovada com os marcadores trocados ({moto} = moto de interesse do lead). */
export function preencherResposta(modelo: string, ctx: ContextoRoteiro & { moto?: string | null }): string {
  const moto = ctx.moto?.trim()
  const comMoto = moto ? modelo.replace(/\{moto\}/g, moto) : modelo.replace(/\{moto\}/g, 'a moto')
  return preencher(comMoto, ctx)
}

export interface ItemResposta { id: string; titulo: string; palavrasChave: string[]; resposta: string }
// No máximo três respostas da base por conversa: depois disso, é com o vendedor.
export const MAX_RESPOSTAS_DA_BASE = 3

/** Resposta aprovada para a mensagem do cliente, se ela for dúvida/objeção que a base cobre. */
export function respostaDaBase<T extends ItemResposta>(texto: string, itens: T[], jaUsados: string[]): T | null {
  if (!itens.length || jaUsados.length >= MAX_RESPOSTAS_DA_BASE || !pareceDuvidaOuObjecao(texto)) return null
  const [melhor] = acharConhecimento(texto, itens.filter(i => i.resposta && !jaUsados.includes(i.id)))
  return melhor && melhor.pontos >= 2 ? melhor.item : null
}

export interface ModeloPronto { chave: string; tipo: TipoConhecimento; titulo: string; palavrasChave: string[]; rascunho: string; etapa?: string }

// Objeções e dúvidas mais comuns em loja de motos. Entram PARA_REVISAR: a
// loja confere se o texto bate com o que pratica (financeiras, garantia,
// documentação) antes de o robô usar.
export const MODELOS_PRONTOS: ModeloPronto[] = [
  { chave: 'pronto:caro', tipo: 'OBJECAO', titulo: 'Achei caro', etapa: 'NEGOCIACAO',
    palavrasChave: ['caro', 'muito caro', 'salgado', 'puxado', 'fora do orcamento', 'nao cabe no bolso'],
    rascunho: 'Entendo, {nome}! Preço pesa mesmo. Posso te mostrar como fica nas parcelas e, se fizer sentido, separar uma opção que caiba melhor no seu bolso. O que pesa mais pra você hoje: a parcela ou a entrada?' },
  { chave: 'pronto:pensar', tipo: 'OBJECAO', titulo: 'Vou pensar', etapa: 'NEGOCIACAO',
    palavrasChave: ['vou pensar', 'pensar melhor', 'depois eu vejo', 'mais pra frente', 'ainda nao sei', 'vou ver com'],
    rascunho: 'Claro, {nome}, decisão boa é decisão pensada. Pra te ajudar: o que ainda te deixa em dúvida — o valor, a moto ou o momento? Assim eu já separo o que você precisa saber.' },
  { chave: 'pronto:nome-sujo', tipo: 'OBJECAO', titulo: 'Estou com o nome negativado',
    palavrasChave: ['nome sujo', 'negativado', 'negativada', 'spc', 'serasa', 'score baixo', 'restricao', 'cpf sujo'],
    rascunho: 'Pode falar disso aqui sem problema, {nome}. A aprovação é analisada caso a caso, e {vendedor} pode fazer uma consulta pra ver o que dá pra fazer. Quer que ele veja isso pra você?' },
  { chave: 'pronto:entrada', tipo: 'DUVIDA', titulo: 'Precisa de entrada? / Não tenho entrada',
    palavrasChave: ['entrada', 'sem entrada', 'nao tenho entrada', 'zero de entrada', 'entrada minima'],
    rascunho: 'Boa pergunta, {nome}! A entrada depende da análise do financiamento. {vendedor} consegue simular com e sem entrada pra você comparar. Prefere ver primeiro a opção com a menor entrada?' },
  { chave: 'pronto:parcela', tipo: 'DUVIDA', titulo: 'Qual o valor da parcela?', etapa: 'NEGOCIACAO',
    palavrasChave: ['parcela', 'prestacao', 'quanto fica por mes', 'mensal', 'em quantas vezes'],
    rascunho: 'A parcela muda conforme a entrada e o prazo, {nome}. {vendedor} faz uma simulação certinha pra você. Você já pensa em dar alguma entrada ou prefere sem?' },
  { chave: 'pronto:troca', tipo: 'DUVIDA', titulo: 'Aceita minha moto na troca?',
    palavrasChave: ['troca', 'aceita troca', 'pega na troca', 'minha moto na troca', 'avaliacao', 'avaliar minha'],
    rascunho: 'Dá pra avaliar a sua sim, {nome}! Me manda o modelo, o ano e umas fotos dela que {vendedor} já te passa como ficaria na troca.' },
  { chave: 'pronto:financiamento', tipo: 'DUVIDA', titulo: 'Vocês financiam? Como funciona?',
    palavrasChave: ['financia', 'financiamento', 'financiar', 'banco', 'credito', 'aprovacao', 'simulacao', 'simular'],
    rascunho: 'Trabalhamos com financiamento sim, {nome}! Pra simular, {vendedor} vai precisar de alguns dados seus. Quer que eu já peça pra ele preparar a simulação de {moto}?' },
  { chave: 'pronto:garantia', tipo: 'DUVIDA', titulo: 'Tem garantia?',
    palavrasChave: ['garantia', 'revisao', 'revisoes', 'assistencia'],
    rascunho: 'Ótima pergunta, {nome}! {vendedor} te explica certinho a garantia de {moto} e o que está incluso. Quer que ele te mande os detalhes?' },
  { chave: 'pronto:documentacao', tipo: 'DUVIDA', titulo: 'Documentação, transferência e emplacamento',
    palavrasChave: ['documento', 'documentacao', 'transferencia', 'emplacamento', 'ipva', 'licenciamento', 'placa', 'crlv'],
    rascunho: 'Sobre a documentação, {nome}, {vendedor} te explica tudo o que está incluso e o que precisa. Quer que ele te mande a lista agora?' },
  { chave: 'pronto:endereco', tipo: 'DUVIDA', titulo: 'Onde fica a loja? Qual o horário?',
    palavrasChave: ['endereco', 'onde fica', 'localizacao', 'horario', 'que horas abre', 'que horas fecha', 'sabado', 'domingo', 'como chegar'],
    rascunho: 'Estamos te esperando, {nome}! {vendedor} te manda a localização e o melhor horário pra vir. Qual dia fica bom pra você?' },
  { chave: 'pronto:visita', tipo: 'DUVIDA', titulo: 'Posso ver ou testar a moto?', etapa: 'NEGOCIACAO',
    palavrasChave: ['test ride', 'testar', 'ver pessoalmente', 'visitar', 'passar ai', 'ir na loja', 'agendar', 'ver a moto'],
    rascunho: 'Pode sim, {nome}! Vale muito ver {moto} de perto. Qual dia e horário ficam bons pra você? Já deixo {vendedor} te esperando.' },
  { chave: 'pronto:entrega', tipo: 'DUVIDA', titulo: 'Tem pronta entrega? Quanto tempo demora?',
    palavrasChave: ['pronta entrega', 'entrega', 'demora', 'prazo', 'quando chega', 'disponivel', 'ainda tem'],
    rascunho: '{vendedor} confere agora a disponibilidade de {moto} pra você, {nome}. Se tiver, já dá pra combinar a retirada. Você quer pra quando?' },
  { chave: 'pronto:cores', tipo: 'DUVIDA', titulo: 'Tem em outras cores ou outras opções?',
    palavrasChave: ['outra cor', 'outras cores', 'cores', 'qual cor', 'tem na cor', 'outras opcoes', 'outro modelo'],
    rascunho: 'Te ajudo a achar a ideal, {nome}! Qual cor ou estilo você prefere? Com isso {vendedor} já separa as opções que temos.' },
  { chave: 'pronto:concorrente', tipo: 'OBJECAO', titulo: 'Vi mais barato em outro lugar', etapa: 'NEGOCIACAO',
    palavrasChave: ['outra loja', 'mais barato', 'concorrente', 'achei mais barato', 'oferta melhor', 'la ta mais'],
    rascunho: 'Obrigado por contar, {nome}! Vale comparar o que vem junto: procedência, revisão, documentação e o atendimento depois da compra. Me manda o que te ofereceram que {vendedor} vê o que consegue fazer por você.' },
  { chave: 'pronto:consorcio', tipo: 'DUVIDA', titulo: 'Vocês trabalham com consórcio?',
    palavrasChave: ['consorcio', 'carta de credito', 'carta contemplada'],
    rascunho: '{vendedor} te explica as opções que temos para quem tem consórcio ou carta de crédito, {nome}. Sua carta já está contemplada?' },
  { chave: 'pronto:procedencia', tipo: 'ARGUMENTO', titulo: 'Moto revisada e com procedência',
    palavrasChave: ['procedencia', 'revisada', 'estado da moto', 'conservada', 'batida', 'leilao'],
    rascunho: 'Aqui toda moto passa por revisão e tem a procedência conferida, {nome}. {vendedor} pode te mandar fotos e vídeo de {moto} pra você ver os detalhes. Quer?' },
]
