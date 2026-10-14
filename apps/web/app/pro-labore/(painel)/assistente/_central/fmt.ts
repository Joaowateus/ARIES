// Formatação da Central de Inteligência. Valores nulos aparecem como "—":
// a Central nunca preenche um número que não existe.
import type { IntelDepartamento, IntelEtapa, IntelSeveridade, IntelStatusAcao } from '@/lib/proLaboreApi'

type N = number | null | undefined
export const SEM = '—'

export function brl(v: N, casas?: number): string {
  if (v == null || !Number.isFinite(v)) return SEM
  const c = casas ?? (Math.abs(v) < 100 ? 2 : 0)
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: c, maximumFractionDigits: c })
}
/** Razão (0,25) → "25%". */
export function pct(v: N, casas = 1): string {
  if (v == null || !Number.isFinite(v)) return SEM
  return `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`
}
export function num(v: N, casas = 0): string {
  if (v == null || !Number.isFinite(v)) return SEM
  return v.toLocaleString('pt-BR', { maximumFractionDigits: casas })
}
/** Diferença em pontos percentuais entre duas razões. */
export function pp(atual: N, meta: N): string {
  if (atual == null || meta == null) return SEM
  const d = (atual - meta) * 100
  return `${d > 0 ? '+' : ''}${d.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`
}
export const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
export const dataBR = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : SEM)
export const dataHoraBR = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : SEM)
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const nomeMes = (aaaamm: string) => `${MESES[Number(aaaamm.slice(5, 7)) - 1]} de ${aaaamm.slice(0, 4)}`

export const ETAPAS: IntelEtapa[] = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA', 'FECHADO']
export const NOME_ETAPA: Record<IntelEtapa, string> = { LEAD: 'Lead', ABORDADO: 'Abordado', NEGOCIACAO: 'Em negociação', PROPOSTA: 'Proposta', FECHADO: 'Fechamento' }
export const PASSAGENS = ['Lead → Abordado', 'Abordado → Negociação', 'Negociação → Proposta', 'Proposta → Fechamento']

export const SEVERIDADE: Record<IntelSeveridade, { rotulo: string; classe: string }> = {
  CRITICO: { rotulo: 'Crítico', classe: 'critico' },
  ALTO: { rotulo: 'Alto', classe: 'alto' },
  MODERADO: { rotulo: 'Moderado', classe: 'moderado' },
  MONITORAMENTO: { rotulo: 'Monitorar', classe: 'monitorar' },
}
export const DEPARTAMENTO: Record<IntelDepartamento, string> = { TRAFEGO: 'Tráfego', SOCIAL_MEDIA: 'Social Media', COMERCIAL: 'Comercial', GESTAO: 'Gestão', FINANCEIRO: 'Financeiro' }
export const STATUS_ACAO: Record<IntelStatusAcao, string> = {
  IDENTIFICADA: 'Identificada', AGUARDANDO_APROVACAO: 'Aguardando aprovação', PLANEJADA: 'Planejada', EM_EXECUCAO: 'Em execução',
  AGUARDANDO_VALIDACAO: 'Aguardando validação', CONCLUIDA: 'Concluída', NAO_ATINGIU: 'Não atingiu o resultado', CANCELADA: 'Cancelada',
}
export const STATUS_ABERTOS: IntelStatusAcao[] = ['IDENTIFICADA', 'AGUARDANDO_APROVACAO', 'PLANEJADA', 'EM_EXECUCAO', 'AGUARDANDO_VALIDACAO']

/** Número que já vem em pontos percentuais (0 a 100) → "25%". */
export function pct100(v: N, casas = 1): string {
  if (v == null || !Number.isFinite(v)) return SEM
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`
}
/** Valor de um indicador (ações e fechamentos): PCT já vem de 0 a 100. */
export function valorIndicador(v: N, unidade: string | null | undefined): string {
  if (unidade === 'PCT') return pct100(v)
  if (unidade === 'BRL') return brl(v)
  if (unidade === 'HORAS') return v == null ? SEM : `${num(v, 1)} h`
  return num(v, 1)
}

/** Mês corrente no horário de Brasília (AAAA-MM). */
export function mesAtual(): string {
  return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7)
}
export function hojeBR(): string {
  return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)
}
/** Início e fim do mês escolhido (o mês corrente vai até hoje). */
export function periodoDoMes(mes: string): { inicio: string; fim: string } {
  const [a, m] = mes.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
  const hoje = hojeBR()
  return { inicio: `${mes}-01`, fim: ultimo > hoje ? hoje : ultimo }
}
export function ultimosMeses(qtd: number): string[] {
  const [a, m] = mesAtual().split('-').map(Number)
  return Array.from({ length: qtd }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - i, 1))
    return d.toISOString().slice(0, 7)
  })
}
