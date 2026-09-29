import type { CampoLeadAssistente, OrigemConversaAssistente, ResultadoConversaAssistente, StatusConversaAssistente } from '@/lib/proLaboreApi'

export function fmtTelefone(digitos: string | null | undefined): string {
  const d = (digitos ?? '').replace(/\D/g, '')
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    const resto = d.slice(4)
    return `+55 ${d.slice(2, 4)} ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`
  }
  return d ? `+${d}` : '—'
}

// Nome cadastrado em caixa alta ("BRENDA ALMEIDA") fica estranho no meio
// de uma frase — normaliza pra "Brenda Almeida".
export function nomeProprio(nome: string): string {
  const minusculas = ['da', 'de', 'do', 'das', 'dos', 'e']
  return nome.toLowerCase().split(/\s+/).filter(Boolean)
    .map((p, i) => (i > 0 && minusculas.includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ')
}

export function iniciais(nome: string): string {
  const partes = nome.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean)
  return (partes.slice(0, 2).map(p => p[0]).join('') || '#').toUpperCase()
}

export function tempoRelativo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `há ${horas}h`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? 'ontem' : `há ${dias} dias`
}

export function horaCurta(iso: string): string {
  const d = new Date(iso)
  const hoje = new Date()
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  if (d.toDateString() === hoje.toDateString()) return hora
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })} ${hora}`
}

export function fmtMinutos(min: number | null | undefined): string {
  if (min == null) return '—'
  if (min < 1) return '< 1 min'
  if (min < 60) return `${Math.round(min)} min`
  const h = min / 60
  if (h < 24) return `${h.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`
  return `${(h / 24).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`
}

export const STATUS_CONVERSA: Record<StatusConversaAssistente, { rotulo: string; classe: string }> = {
  ATIVA: { rotulo: 'Com o assistente', classe: 'neutro' },
  AGUARDANDO_VENDEDOR: { rotulo: 'Esperando você', classe: 'atencao' },
  ASSUMIDA: { rotulo: 'Com o vendedor', classe: 'bom' },
  ENCERRADA: { rotulo: 'Encerrada', classe: 'neutro' },
}

export const RESULTADO: Record<ResultadoConversaAssistente, string> = {
  QUALIFICADO: 'Respondeu tudo',
  PEDIU_ATENDENTE: 'Pediu atendente',
  DESISTIU: 'Pediu pra parar',
  NAO_E_LEAD: 'Não era lead',
}

export const ORIGEM: Record<OrigemConversaAssistente, { rotulo: string; descricao: string }> = {
  ANUNCIO: { rotulo: 'Anúncio', descricao: 'Clicou num anúncio que abre o WhatsApp' },
  GATILHO: { rotulo: 'Frase de campanha', descricao: 'Mandou uma das frases de campanha configuradas' },
  CONTATO_NOVO: { rotulo: 'Contato novo', descricao: 'Primeira conversa com o vendedor, sem sinal de campanha' },
}

export const CAMPOS_LEAD: Array<{ valor: CampoLeadAssistente; rotulo: string }> = [
  { valor: 'modeloInteresse', rotulo: 'Veículo de interesse (vai pro campo do CRM)' },
  { valor: 'nomeCompleto', rotulo: 'Nome completo (vira o nome do lead)' },
  { valor: 'formaPagamento', rotulo: 'Forma de pagamento' },
  { valor: 'valorEntrada', rotulo: 'Valor de entrada' },
  { valor: 'veiculoTroca', rotulo: 'Veículo na troca' },
  { valor: 'cidade', rotulo: 'Cidade' },
  { valor: 'melhorHorario', rotulo: 'Melhor horário pra contato' },
  { valor: 'outro', rotulo: 'Outro (só nas observações)' },
]

export const ROTULO_ESTAGIO: Record<string, string> = {
  LEAD: 'Lead', ABORDADO: 'Abordado', NEGOCIACAO: 'Negociação', PROPOSTA: 'Proposta', FECHADO: 'Venda fechada', PERDIDO: 'Perdido',
}
