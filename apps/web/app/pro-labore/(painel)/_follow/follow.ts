// Rótulos e datas do Follow e da Reativação (CRM). Horário de Brasília.
import type { CanalFollow, FollowLead, MotivoPerda, Temperatura } from '@/lib/proLaboreApi'

export const CANAL_FOLLOW: Record<CanalFollow, string> = { WHATSAPP: 'WhatsApp', LIGACAO: 'Ligação', VISITA: 'Visita', EMAIL: 'E-mail', OUTRO: 'Outro' }
export const MOTIVO_PERDA: Record<MotivoPerda | 'SEM_MOTIVO', string> = {
  SEM_MOMENTO: 'Ainda não é o momento',
  SEM_CREDITO: 'Sem crédito / condição financeira',
  PRECO: 'Achou caro',
  SEM_RESPOSTA: 'Parou de responder',
  CONCORRENCIA: 'Comprou em outro lugar',
  SEM_ESTOQUE: 'Não tínhamos o modelo',
  DESISTIU: 'Desistiu da compra',
  OUTRO: 'Outro motivo',
  SEM_MOTIVO: 'Sem motivo registrado',
}
export const TEMPERATURA: Record<Temperatura, { rotulo: string; dica: string }> = {
  QUENTE: { rotulo: 'Quente', dica: 'Pode voltar logo: retomar em poucos dias' },
  MORNO: { rotulo: 'Morno', dica: 'Precisa de aquecimento: conteúdo e contato periódico' },
  FRIO: { rotulo: 'Frio', dica: 'Longe da compra: contato espaçado' },
}

const FUSO = 'America/Sao_Paulo'
const DIA = 864e5
/** Dia (AAAA-MM-DD) em Brasília. */
export const diaBR = (d: Date) => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10)
const hora = (d: Date) => d.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' })

/** Situação do follow para o selo do card: atrasado, hoje ou futuro. A nova análise de crédito tem o nome dela. */
export function situacaoFollow(f: Pick<FollowLead, 'agendadoPara' | 'tipo'>, agora = new Date()): { tipo: 'ATRASADO' | 'HOJE' | 'FUTURO'; texto: string } {
  const nome = f.tipo === 'CREDITO' ? 'Nova análise' : 'Follow'
  const d = new Date(f.agendadoPara)
  const hoje = diaBR(agora), dia = diaBR(d)
  if (dia < hoje) {
    const dias = Math.round((Date.parse(hoje) - Date.parse(dia)) / DIA)
    return { tipo: 'ATRASADO', texto: `${nome} atrasad${f.tipo === 'CREDITO' ? 'a' : 'o'} ${dias} ${dias === 1 ? 'dia' : 'dias'}` }
  }
  if (dia === hoje) return { tipo: d < agora ? 'ATRASADO' : 'HOJE', texto: `${nome} hoje ${hora(d)}` }
  const amanha = diaBR(new Date(agora.getTime() + DIA))
  if (dia === amanha) return { tipo: 'FUTURO', texto: `${nome} amanhã ${hora(d)}` }
  return { tipo: 'FUTURO', texto: `${nome} ${d.toLocaleDateString('pt-BR', { timeZone: FUSO, weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')} ${hora(d)}` }
}

/** Primeiro nome para as mensagens prontas ({nome}). */
export const primeiroNome = (nome: string) => { const p = nome.trim().split(/\s+/)[0] ?? ''; return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '' }
/** wa.me com a mensagem já escrita (quando não dá para mandar pelo sistema). */
export const linkWhatsappComTexto = (telefone: string | null | undefined, texto: string) => { const l = linkWhatsapp(telefone); return l ? `${l}?text=${encodeURIComponent(texto)}` : null }

/** Data e hora em Brasília a partir de "AAAA-MM-DD" e "HH:mm" (vai como ISO com -03:00). */
export const isoBR = (dia: string, hhmm: string) => `${dia}T${hhmm}:00-03:00`
export function somaDiasBR(dias: number, agora = new Date()) { return diaBR(new Date(agora.getTime() + dias * DIA)) }
export const dataHoraBR = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
export const linkWhatsapp = (telefone?: string | null) => {
  const n = (telefone ?? '').replace(/\D/g, '')
  if (n.length < 10) return null
  return `https://wa.me/${n.length <= 11 ? `55${n}` : n}`
}
