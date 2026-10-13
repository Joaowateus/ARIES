// Nomes exibidos da Central Estratégica de Conteúdo.
import type { CtEtapa, CtPeriodo, CtStatus, CtStatusCiclo, CtTipoItem, CtTipoProva } from '@/lib/proLaboreApi'

export const STATUS_ROTULO: Record<CtStatus, string> = {
  PLANEJADO: 'Planejado', ROTEIRIZADO: 'Roteirizado', AGUARDANDO_APROVACAO: 'Aguardando aprovação', APROVADO: 'Aprovado', PRONTO_GRAVAR: 'Pronto para gravar',
  GRAVADO: 'Gravado', EM_EDICAO: 'Em edição', PRONTO_PUBLICAR: 'Pronto para publicar', AGENDADO: 'Agendado', PUBLICADO: 'Publicado', ANALISADO: 'Análise concluída',
}
export const STATUS_TOM: Record<CtStatus, 'ok' | 'warn' | 'bad' | 'info' | 'learn' | 'neutro'> = {
  PLANEJADO: 'neutro', ROTEIRIZADO: 'info', AGUARDANDO_APROVACAO: 'warn', APROVADO: 'ok', PRONTO_GRAVAR: 'learn', GRAVADO: 'learn', EM_EDICAO: 'learn',
  PRONTO_PUBLICAR: 'info', AGENDADO: 'info', PUBLICADO: 'ok', ANALISADO: 'ok',
}
export const ORDEM_STATUS: CtStatus[] = ['PLANEJADO', 'ROTEIRIZADO', 'AGUARDANDO_APROVACAO', 'APROVADO', 'PRONTO_GRAVAR', 'GRAVADO', 'EM_EDICAO', 'PRONTO_PUBLICAR', 'AGENDADO', 'PUBLICADO', 'ANALISADO']
export const chegou = (s: CtStatus, alvo: CtStatus) => ORDEM_STATUS.indexOf(s) >= ORDEM_STATUS.indexOf(alvo)

export const ETAPA_NOME: Record<CtEtapa, string> = { TOPO: 'Topo', MEIO: 'Meio', FUNDO: 'Fundo' }
export const PERIODO_NOME: Record<CtPeriodo, string> = { MANHA: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite' }
export const PERIODO_ETAPA: Record<CtPeriodo, CtEtapa> = { MANHA: 'TOPO', TARDE: 'MEIO', NOITE: 'FUNDO' }
export const CICLO_ROTULO: Record<CtStatusCiclo, string> = { RASCUNHO: 'Rascunho: aguardando aprovação', APROVADO: 'Aprovado', FECHADO: 'Fechado', ARQUIVADO: 'Versão arquivada' }
export const ORIGEM_ROTEIRO: Record<string, string> = { MODELO: 'Roteiro-base', IA: 'Escrito pela IA', MANUAL: 'Revisado à mão' }
export const ALVO_TIPO: Record<string, string> = { DOR: 'Dor', DESEJO: 'Desejo', OBJECAO: 'Objeção', PERGUNTA: 'Pergunta real' }
export const ITEM_ROTULO: Record<CtTipoItem, string> = { GANCHO: 'Gancho', PERGUNTA: 'Pergunta real', OBJECAO: 'Objeção do atendimento', APRENDIZADO: 'Aprendizado', SUGESTAO: 'Sugestão' }
export const NATUREZA_ROTULO: Record<string, string> = { FATO: 'Fato', HIPOTESE: 'Hipótese', SUGESTAO: 'Sugestão' }
export const PROVA_ROTULO: Record<CtTipoProva, string> = {
  FOTO_VIDEO: 'Fotos e vídeos de motos reais', INFO_PRODUTO: 'Informação verificada do produto', CONDICAO_COMERCIAL: 'Condição comercial aprovada', GARANTIA: 'Termos de garantia',
  DOCUMENTACAO: 'Documentação', INSPECAO: 'Demonstração de inspeção', AVALIACAO_CLIENTE: 'Avaliação de cliente', DEPOIMENTO: 'Depoimento com consentimento',
  BASTIDORES: 'Bastidores do atendimento', FAQ: 'Pergunta frequente real', POS_VENDA: 'Processo de pós-venda',
}
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const diaSemana = (iso: string) => SEM[new Date(`${iso}T12:00:00Z`).getUTCDay()]
export const num = (n?: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR'))
