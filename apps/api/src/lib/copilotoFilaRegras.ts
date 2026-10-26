// Copiloto Comercial: regras da fila de "próxima melhor ação" (funções
// puras; a coleta no banco fica em copilotoFila.ts). A fila é calculada ao vivo (o
// plano do dia fica congelado de manhã; a fila acompanha o que acontece
// durante o dia). Junta os sinais que o sistema já tem de cada lead —
// WhatsApp esperando, follow vencido, etiquetas da jornada (crédito
// aprovado, pediu visita, pediu simulação), nota da conversa e tempo parado —
// e diz quem atender primeiro e o próximo passo. É a ideia do "next best
// action" do HubSpot e do Pipedrive, por regra fixa e explicável: sem IA e
// sem valor em reais.
import { PARADO_APOS, primeiroNome, rankEstagio } from './copilotoEtapas'

export type TipoMotivo =
  | 'WHATS_ESPERANDO' | 'CREDITO_APROVADO' | 'WHATS_SEM_RESPOSTA' | 'FOLLOW_ATRASADO' | 'PEDIU_VISITA'
  | 'FICHA_CREDITO' | 'FOLLOW_HOJE' | 'PEDIU_SIMULACAO' | 'QUENTE_PARADO' | 'NOVO_SEM_ABORDAGEM' | 'PARADO'
export type GrupoFila = 'WHATSAPP' | 'FOLLOW' | 'COMPRA' | 'CARTEIRA'

/** Peso de cada motivo: quanto maior, mais perto da venda ou maior o risco de perder. */
export const PESO: Record<TipoMotivo, number> = {
  WHATS_ESPERANDO: 92, CREDITO_APROVADO: 90, WHATS_SEM_RESPOSTA: 84, FOLLOW_ATRASADO: 80, PEDIU_VISITA: 78,
  FICHA_CREDITO: 74, FOLLOW_HOJE: 70, PEDIU_SIMULACAO: 66, QUENTE_PARADO: 62, NOVO_SEM_ABORDAGEM: 58, PARADO: 40,
}
export const GRUPO: Record<TipoMotivo, GrupoFila> = {
  WHATS_ESPERANDO: 'WHATSAPP', WHATS_SEM_RESPOSTA: 'WHATSAPP', FOLLOW_ATRASADO: 'FOLLOW', FOLLOW_HOJE: 'FOLLOW',
  CREDITO_APROVADO: 'COMPRA', PEDIU_VISITA: 'COMPRA', FICHA_CREDITO: 'COMPRA', PEDIU_SIMULACAO: 'COMPRA', QUENTE_PARADO: 'COMPRA',
  NOVO_SEM_ABORDAGEM: 'CARTEIRA', PARADO: 'CARTEIRA',
}
export const ROTULO_MOTIVO: Record<TipoMotivo, string> = {
  WHATS_ESPERANDO: 'WhatsApp esperando', CREDITO_APROVADO: 'Crédito aprovado', WHATS_SEM_RESPOSTA: 'Cliente sem resposta',
  FOLLOW_ATRASADO: 'Follow atrasado', PEDIU_VISITA: 'Pediu visita', FICHA_CREDITO: 'Ficha de crédito', FOLLOW_HOJE: 'Follow hoje',
  PEDIU_SIMULACAO: 'Pediu simulação', QUENTE_PARADO: 'Quente parado', NOVO_SEM_ABORDAGEM: 'Sem abordagem', PARADO: 'Parado',
}
// Etiquetas que não puxam ação sozinhas, mas mudam a conversa.
const SINAL_ETIQUETA: Record<string, string> = {
  OBJECAO_PRECO: 'Objeção de preço', SUMIU_24H: 'Sumiu há 24h', CREDITO_RECUSADO: 'Crédito recusado',
  SEM_CNH: 'Sem CNH', RESTRICAO_NOME: 'Restrição no nome', PARCELA_NAO_CABE: 'Parcela não cabe', TEM_TROCA: 'Tem troca',
}
const NOME_ETAPA: Record<string, string> = { LEAD: 'Lead novo', ABORDADO: 'Abordado', NEGOCIACAO: 'Negociação', PROPOSTA: 'Proposta' }

export interface EntradaFila {
  leadId: string | null
  nome: string
  estagio: string | null
  modelo: string | null
  vendedor: string | null
  pontuacao: number | null
  etiquetas: string[]
  diasParado: number
  semAbordagem: boolean
  horasDesdeCriacao: number
  follow: { id: string; atrasoDias: number; nota: string | null; canal: string | null } | null
  conversa: { id: string; situacao: 'ESPERANDO' | 'SEM_RESPOSTA' | null; horas: number } | null
}

export interface MotivoFila { tipo: TipoMotivo; texto: string; passo: string }
export interface ItemFila {
  chave: string
  leadId: string | null
  conversaId: string | null
  followId: string | null
  nome: string
  estagio: string | null
  modelo: string | null
  vendedor: string | null
  pontuacao: number | null
  prioridade: number
  grupo: GrupoFila
  motivo: MotivoFila
  sinais: string[]
  passo: string
}

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`
const tempo = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)}h` : plural(Math.round(h / 24), 'dia', 'dias'))
const CANAL: Record<string, string> = { WHATSAPP: 'WhatsApp', LIGACAO: 'ligação', VISITA: 'visita', EMAIL: 'e-mail', OUTRO: 'contato' }

const PASSO_PARADO: Record<string, string> = {
  ABORDADO: 'Faça uma pergunta de diagnóstico (uso, entrada, prazo) para puxar para a negociação.',
  NEGOCIACAO: 'Retome com uma condição nova ou uma pergunta sobre o que falta para fechar.',
  PROPOSTA: 'Pergunte o que falta para decidir e proponha um prazo para a resposta.',
}

/** Todos os motivos de um lead para entrar na fila (vazio = nada a fazer agora). */
export function motivosDe(e: EntradaFila): MotivoFila[] {
  const m: MotivoFila[] = []
  const tem = (t: string) => e.etiquetas.includes(t)
  if (e.conversa?.situacao === 'ESPERANDO') m.push({ tipo: 'WHATS_ESPERANDO', texto: `Esperando sua resposta no WhatsApp há ${tempo(e.conversa.horas)}`, passo: 'Responda agora: quem responde em minutos vende mais. O Copiloto sugere a mensagem.' })
  if (e.conversa?.situacao === 'SEM_RESPOSTA') m.push({ tipo: 'WHATS_SEM_RESPOSTA', texto: `A última mensagem é do cliente, sem resposta há ${tempo(e.conversa.horas)}`, passo: 'Retome com uma pergunta sobre o que ele precisa para decidir.' })
  if (tem('CREDITO_APROVADO')) m.push({ tipo: 'CREDITO_APROVADO', texto: 'Crédito aprovado na pré-análise', passo: 'Ligue e marque a assinatura ou a visita: é a venda mais perto de fechar.' })
  if (e.follow) {
    const nota = e.follow.nota?.trim()
    const como = CANAL[e.follow.canal ?? ''] ?? 'contato'
    if (e.follow.atrasoDias > 0) m.push({ tipo: 'FOLLOW_ATRASADO', texto: `Follow atrasado há ${plural(e.follow.atrasoDias, 'dia', 'dias')}${nota ? `: ${nota}` : ''}`, passo: nota ? `Faça o combinado (${como}) e registre o resultado.` : `Faça o follow por ${como} e registre o resultado.` })
    else m.push({ tipo: 'FOLLOW_HOJE', texto: `Follow marcado para hoje${nota ? `: ${nota}` : ''}`, passo: `Faça o follow por ${como} e registre o resultado.` })
  }
  if (tem('PEDIU_VISITA')) m.push({ tipo: 'PEDIU_VISITA', texto: 'Pediu para visitar a loja', passo: 'Confirme o dia e o horário da visita e deixe a moto separada.' })
  if (tem('FICHA_CREDITO') && !tem('CREDITO_APROVADO') && !tem('CREDITO_RECUSADO')) m.push({ tipo: 'FICHA_CREDITO', texto: 'Ficha de crédito recebida, sem resposta dos bancos', passo: 'Mande a ficha para os bancos e registre a resposta na conversa.' })
  if (tem('PEDIU_SIMULACAO') && !tem('SIMULOU')) m.push({ tipo: 'PEDIU_SIMULACAO', texto: 'Pediu simulação e ainda não recebeu', passo: 'Envie a simulação com duas opções de entrada.' })
  if ((e.pontuacao ?? 0) >= 70 && e.diasParado >= 1 && e.estagio) m.push({ tipo: 'QUENTE_PARADO', texto: `Lead quente (nota ${e.pontuacao}) sem movimento há ${plural(e.diasParado, 'dia', 'dias')}`, passo: 'Puxe para a próxima etapa hoje, enquanto o interesse está alto.' })
  if (e.estagio === 'LEAD' && e.semAbordagem && e.horasDesdeCriacao >= 0.5) m.push({ tipo: 'NOVO_SEM_ABORDAGEM', texto: `Lead novo sem abordagem há ${tempo(e.horasDesdeCriacao)}`, passo: 'Faça a primeira abordagem com uma pergunta sobre a moto que ele procura.' })
  if (e.estagio && e.estagio !== 'LEAD' && e.diasParado >= (PARADO_APOS[e.estagio] ?? 99)) m.push({ tipo: 'PARADO', texto: `${NOME_ETAPA[e.estagio] ?? e.estagio} parado há ${plural(e.diasParado, 'dia', 'dias')}`, passo: PASSO_PARADO[e.estagio] ?? 'Retome o contato.' })
  return m
}

/** Monta o item da fila: o motivo mais forte manda, os outros viram sinais. */
export function itemDaFila(e: EntradaFila): ItemFila | null {
  const motivos = motivosDe(e)
  if (!motivos.length) return null
  const peso = (x: MotivoFila) => PESO[x.tipo] + (x.tipo === 'PARADO' ? rankEstagio(e.estagio) * 5 : 0) + (x.tipo === 'NOVO_SEM_ABORDAGEM' && e.horasDesdeCriacao < 24 ? 4 : 0)
  const ordenados = [...motivos].sort((a, b) => peso(b) - peso(a))
  const principal = ordenados[0]
  const bonus = Math.min(5, Math.round((e.pontuacao ?? 0) / 20)) + Math.min(6, (motivos.length - 1) * 2)
  const sinais = [
    ...ordenados.slice(1).map(x => ROTULO_MOTIVO[x.tipo]),
    ...Object.entries(SINAL_ETIQUETA).filter(([k]) => e.etiquetas.includes(k)).map(([, v]) => v),
  ]
  let passo = principal.passo
  if (e.etiquetas.includes('OBJECAO_PRECO')) passo += ' Ele já levantou preço: mostre a parcela que cabe antes do valor total.'
  else if (e.etiquetas.includes('SUMIU_24H') && GRUPO[principal.tipo] !== 'WHATSAPP') passo += ' Ele sumiu: volte com uma novidade (condição, estoque), não com cobrança.'
  return {
    chave: e.leadId ?? `conversa:${e.conversa?.id}`,
    leadId: e.leadId, conversaId: e.conversa?.id ?? null, followId: e.follow?.id ?? null,
    nome: e.nome, estagio: e.estagio, modelo: e.modelo, vendedor: e.vendedor, pontuacao: e.pontuacao,
    prioridade: Math.min(100, peso(principal) + bonus), grupo: GRUPO[principal.tipo],
    motivo: principal, sinais, passo,
  }
}


// ---------- Sinais fortes no plano da manhã ----------

/** Mesma forma da ação do plano do dia (copilotoFatos.AcaoPlano). */
export interface AcaoDoPlano { tipo: string; texto: string; porque: string; refTipo?: string; refId?: string; estagioNaHora?: string }
const NO_PLANO: Partial<Record<TipoMotivo, { tipo: string; texto: (nome: string) => string }>> = {
  CREDITO_APROVADO: { tipo: 'FECHAR', texto: n => `Fechar com ${n}: crédito aprovado` },
  PEDIU_VISITA: { tipo: 'FECHAR', texto: n => `Confirmar a visita de ${n}` },
  FICHA_CREDITO: { tipo: 'FECHAR', texto: n => `Mandar a ficha de ${n} para os bancos` },
  PEDIU_SIMULACAO: { tipo: 'FECHAR', texto: n => `Enviar a simulação para ${n}` },
  FOLLOW_ATRASADO: { tipo: 'FOLLOW_UP', texto: n => `Fazer o follow atrasado de ${n}` },
  FOLLOW_HOJE: { tipo: 'FOLLOW_UP', texto: n => `Fazer o follow de ${n}` },
}

/**
 * Leva para o plano do dia os sinais de compra e os follows da fila (até
 * `max`), logo depois das respostas de WhatsApp: é o que está mais perto da
 * venda. Lead que já está no plano não repete; o estudo fica por último.
 */
export function juntarSinaisNoPlano(plano: AcaoDoPlano[], itens: ItemFila[], max = 3): AcaoDoPlano[] {
  const ja = new Set(plano.map(p => p.refId).filter(Boolean))
  const sinais: AcaoDoPlano[] = []
  for (const i of itens) {
    const regra = NO_PLANO[i.motivo.tipo]
    if (!regra || !i.leadId || ja.has(i.leadId) || sinais.length >= max) continue
    const quem = i.vendedor ? ` (${i.vendedor})` : ''
    sinais.push({ tipo: regra.tipo, texto: `${regra.texto(primeiroNome(i.nome))}${quem}`, porque: `${i.motivo.texto}. ${i.passo}`, refTipo: 'LEAD', refId: i.leadId, estagioNaHora: i.estagio ?? undefined })
  }
  const responder = plano.filter(p => p.tipo === 'RESPONDER')
  const estudo = plano.filter(p => p.tipo === 'ESTUDO')
  const resto = plano.filter(p => p.tipo !== 'RESPONDER' && p.tipo !== 'ESTUDO')
  return [...responder, ...sinais, ...resto].slice(0, 6).concat(estudo)
}
