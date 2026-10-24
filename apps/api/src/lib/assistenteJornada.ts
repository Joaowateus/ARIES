// Jornada do lead — funções puras: etiquetas pela conversa do WhatsApp e o
// próximo passo no funil. O avanço é conservador: só para frente, uma etapa
// por vez, nunca para Fechado/Perdido, e não repete um avanço desfeito.
import { ConfigAssistente, normalizar, respostaDoCampo } from './assistenteRoteiro'

export const ETIQUETAS = {
  QUENTE: 'Quente',
  FINANCIAMENTO: 'Financiamento',
  A_VISTA: 'À vista',
  TEM_TROCA: 'Tem troca',
  SEM_ENTRADA: 'Sem entrada',
  PEDIU_SIMULACAO: 'Pediu simulação',
  OBJECAO_PRECO: 'Objeção de preço',
  PEDIU_VISITA: 'Pediu visita',
  SUMIU_24H: 'Sumiu há 24h',
  SIMULOU: 'Simulou',
  PARCELA_CABE: 'Parcela cabe',
  PARCELA_APERTADA: 'Parcela apertada',
  PARCELA_NAO_CABE: 'Parcela não cabe',
  FICHA_CREDITO: 'Ficha de crédito',
  CREDITO_APROVADO: 'Crédito aprovado',
  CREDITO_RECUSADO: 'Crédito recusado',
} as const
export type Etiqueta = keyof typeof ETIQUETAS

const FINANCIA = /\b(financia|financiamento|financiar|financiado|parcela|parcelas|parcelar|parcelado|consorcio)\b/
const A_VISTA = /\ba vista\b/
const TROCA = /\b(na troca|dar na troca|pra troca|aceita troca|aceitam troca|minha moto|tenho uma moto|tenho um carro)\b/
const SEM_ENTRADA_RESPOSTA = /^(nao|sem|nenhum|nada|zero|ainda nao)\b/
const SEM_ENTRADA = /\b(sem entrada|nao tenho entrada|nao tenho dinheiro (pra|para|de) entrada)\b/
const SIMULACAO = /\b(simula|simulacao|simular|quanto fica|quanto ficaria|valor da parcela|parcela de quanto|em quantas vezes|quantas parcelas|faz uma simulacao)\b/
const PRECO = /\b(caro|cara demais|salgad\w*|puxad\w*|desconto|mais barat\w*|fora do (meu )?orcamento|nao cabe)\b/
const VISITA = /\b(visitar|visita|passar ai|passo ai|vou ai|ir ai|ver pessoalmente|ver de perto|test ride|endereco|onde fica|onde voces ficam|horario de funcionamento|que horas abre|ate que horas)\b/
const DOCUMENTOS = /\b(documentos|documentacao|quais documentos|cnh|comprovante de renda|comprovante de residencia)\b/
// O que o vendedor manda quando a proposta saiu.
const PROPOSTA = /\b(proposta|segue a simulacao|segue o orcamento|simulacao aprovada|ficha aprovada|credito aprovado|aprovad[oa] no banco|pre-?analise foi aprovada|condicao especial pra voce)\b/

const DIA = 86_400_000

export interface DadosEtiquetas {
  cfg: ConfigAssistente
  respostas: Record<string, string>
  textosDoContato: string[]
  nota: number | null
  ultimaDoContatoEm: Date | null
  // Última mensagem da loja (vendedor ou assistente).
  ultimaNossaEm: Date | null
  agora: Date
  // Leitura da simulação de financiamento, se houve.
  simulacao?: string | null
  credito?: { ficha: boolean; aprovado: boolean; recusado: boolean } | null
}

export function etiquetasDoLead(d: DadosEtiquetas): Etiqueta[] {
  const tudo = d.textosDoContato.map(normalizar).join(' \n ')
  const pagamento = normalizar(respostaDoCampo(d.cfg, d.respostas, 'formaPagamento') ?? '')
  const entrada = normalizar(respostaDoCampo(d.cfg, d.respostas, 'valorEntrada') ?? '')
  const e: Etiqueta[] = []
  if ((d.nota ?? 0) >= 70) e.push('QUENTE')
  if (/financ|parcel|consorcio/.test(pagamento) || FINANCIA.test(tudo)) e.push('FINANCIAMENTO')
  if (/vista/.test(pagamento) || A_VISTA.test(tudo)) e.push('A_VISTA')
  if (/troca/.test(pagamento) || TROCA.test(tudo)) e.push('TEM_TROCA')
  if ((entrada && SEM_ENTRADA_RESPOSTA.test(entrada)) || SEM_ENTRADA.test(tudo)) e.push('SEM_ENTRADA')
  if (SIMULACAO.test(tudo)) e.push('PEDIU_SIMULACAO')
  if (PRECO.test(tudo)) e.push('OBJECAO_PRECO')
  if (VISITA.test(tudo)) e.push('PEDIU_VISITA')
  if (d.simulacao) e.push('SIMULOU')
  if (d.simulacao === 'CABE') e.push('PARCELA_CABE')
  else if (d.simulacao === 'APERTADA') e.push('PARCELA_APERTADA')
  else if (d.simulacao === 'NAO_CABE') e.push('PARCELA_NAO_CABE')
  if (d.credito?.ficha) e.push('FICHA_CREDITO')
  if (d.credito?.aprovado) e.push('CREDITO_APROVADO')
  else if (d.credito?.recusado) e.push('CREDITO_RECUSADO')
  if (d.ultimaNossaEm && (!d.ultimaDoContatoEm || d.ultimaNossaEm > d.ultimaDoContatoEm) && d.agora.getTime() - d.ultimaNossaEm.getTime() >= DIA) e.push('SUMIU_24H')
  return e
}

export const RANK_ETAPA: Record<string, number> = { LEAD: 0, ABORDADO: 1, NEGOCIACAO: 2, PROPOSTA: 3, FECHADO: 4 }
export const ROTULO_ETAPA: Record<string, string> = { LEAD: 'Lead', ABORDADO: 'Abordado', NEGOCIACAO: 'Negociação', PROPOSTA: 'Proposta', FECHADO: 'Fechado', PERDIDO: 'Perdido' }

export interface DadosAvanco {
  estagio: string
  vendedorRespondeu: boolean
  textosDoContato: string[]
  textosDoVendedor: string[]
  etiquetas: Etiqueta[]
  nota: number | null
  // Etapas de avanços desfeitos pelo vendedor: não tenta de novo.
  desfeitos: string[]
}
export interface Avanco { para: 'ABORDADO' | 'NEGOCIACAO' | 'PROPOSTA'; motivo: string }

export function proximaEtapa(d: DadosAvanco): Avanco | null {
  const contato = d.textosDoContato.map(normalizar).join(' \n ')
  let r: Avanco | null = null
  if (d.estagio === 'LEAD' && d.vendedorRespondeu) r = { para: 'ABORDADO', motivo: 'o vendedor respondeu' }
  else if (d.estagio === 'ABORDADO') {
    if (d.etiquetas.includes('CREDITO_APROVADO')) r = { para: 'NEGOCIACAO', motivo: 'crédito pré-aprovado no banco' }
    else if (d.etiquetas.includes('PEDIU_SIMULACAO')) r = { para: 'NEGOCIACAO', motivo: 'pediu simulação' }
    else if (d.etiquetas.includes('PEDIU_VISITA')) r = { para: 'NEGOCIACAO', motivo: 'quer visitar a loja' }
    else if (DOCUMENTOS.test(contato)) r = { para: 'NEGOCIACAO', motivo: 'perguntou da documentação' }
    else if ((d.nota ?? 0) >= 70) r = { para: 'NEGOCIACAO', motivo: `nota ${d.nota} na conversa` }
  } else if (d.estagio === 'NEGOCIACAO' && d.textosDoVendedor.some(t => PROPOSTA.test(normalizar(t)))) {
    r = { para: 'PROPOSTA', motivo: 'você enviou a proposta' }
  }
  return r && !d.desfeitos.includes(r.para) ? r : null
}

/** Mudança manual recente para trás (o vendedor rebaixou o lead): o assistente não mexe por 7 dias. */
export function rebaixadoHaPouco(historico: Array<{ estagioAnterior: string | null; estagioNovo: string; origem: string | null; criadoEm: Date }>, agora: Date): boolean {
  return historico.some(h => !h.origem && h.estagioAnterior && (RANK_ETAPA[h.estagioNovo] ?? 9) < (RANK_ETAPA[h.estagioAnterior] ?? -1) && agora.getTime() - h.criadoEm.getTime() < 7 * DIA)
}
