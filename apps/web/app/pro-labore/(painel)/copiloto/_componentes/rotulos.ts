export const TIPO_ACAO: Record<string, string> = {
  RESPONDER: 'WhatsApp', ABORDAR: 'Abordagem', FOLLOW_UP: 'Follow-up', REATIVAR: 'Próxima etapa',
  AGENDA: 'Agenda', ESTUDO: 'Estudo', EQUIPE: 'Equipe', HABITO: 'Hábito', FECHAR: 'Sinal de compra',
}
export const RESULTADO_ACAO: Record<string, string> = { AVANCOU: 'o lead avançou', RESPONDIDA: 'respondida', SEM_EFEITO: 'sem avanço ainda' }
export const ESTAGIO: Record<string, string> = { LEAD: 'Novo', ABORDADO: 'Abordado', NEGOCIACAO: 'Negociação', PROPOSTA: 'Proposta', FECHADO: 'Fechado', PERDIDO: 'Perdido' }
export const TIPO_ESTUDO: Record<string, string> = { VIDEO: 'Vídeo', ARTIGO: 'Artigo', LIVRO: 'Livro', CURSO: 'Curso', PODCAST: 'Podcast', BUSCA: 'Busca' }
export const TIPO_MEMORIA: Record<string, string> = { OBJETIVO: 'Objetivo', PREFERENCIA: 'Preferência', PONTO_FORTE: 'Ponto forte', PONTO_FRACO: 'Ponto a melhorar', APRENDIZADO: 'Aprendizado medido', ESTILO: 'Estilo' }
export const NATUREZA: Record<string, string> = { FATO: 'Fato', HIPOTESE: 'Hipótese', PEDIDO: 'Você pediu' }
export const NIVEL: Record<string, string> = { INICIANTE: 'Iniciante', INTERMEDIARIO: 'Intermediário', AVANCADO: 'Avançado' }

export const num = (v: number | null | undefined, casas = 0) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: casas }))
export const pct = (v: number | null | undefined) => (v == null ? '—' : `${num(v)}%`)
export function horas(h: number | null | undefined): string {
  if (h == null) return '—'
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 48) return `${num(h, 1)} h`
  return `${Math.round(h / 24)} dias`
}
export function espera(min: number | null): string {
  if (min == null) return ''
  if (min < 60) return `${min} min`
  if (min < 48 * 60) return `${Math.round(min / 60)} h`
  return `${Math.round(min / 1440)} dias`
}
export const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
