'use client'

// ARIES Disparo — utilitários das telas (formatos, selos de situação, metadados compartilhados).
import { createContext, useContext } from 'react'
import type { MetaDisparo, StatusCampanhaDisparo } from '@/lib/proLaboreApi'

export const MetaCtx = createContext<MetaDisparo | null>(null)
export const useMeta = () => useContext(MetaCtx)!

export const n = (v: number | null | undefined) => (v ?? 0).toLocaleString('pt-BR')
export const pct = (v: number | null | undefined) => (v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
export const dataHora = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')
export const duracao = (ms: number | null | undefined) => { if (ms == null) return '—'; const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min` }
export const erroDe = (e: unknown) => (e instanceof Error ? e.message : 'Não foi possível concluir')

const CLASSE: Partial<Record<StatusCampanhaDisparo, string>> = { RUNNING: 'bom', COMPLETED: 'bom', QUEUED: 'atencao', SCHEDULED: 'atencao', NEEDS_REVIEW: 'atencao', PAUSED: 'atencao', VALIDATING: 'atencao', COMPLETED_WITH_ERRORS: 'critico', CANCELLED: '' }
export function SeloStatus({ status }: { status: StatusCampanhaDisparo }) {
  const meta = useMeta()
  return <span className={`pl-status-badge ${CLASSE[status] ?? ''}`} data-status={status}>{meta?.status[status] ?? status}</span>
}

export const ROTULO_DESTINATARIO: Record<string, string> = { ELEGIVEL: 'Aguardando', EXCLUIDO: 'Excluído', DESCARTADO: 'Versão anterior', EM_ANDAMENTO: 'Em andamento', CONCLUIDO: 'Concluído', RESPONDEU: 'Respondeu', INTERROMPIDO: 'Interrompido', FALHOU: 'Falhou' }
export const ROTULO_MENSAGEM: Record<string, string> = { AGENDADA: 'Na fila', ENVIANDO: 'Enviando', ACEITA: 'Aceita pelo WhatsApp', ENTREGUE: 'Entregue', LIDA: 'Lida', FALHOU: 'Falhou', DESCONHECIDO: 'Sem confirmação', CANCELADA: 'Cancelada', PULADA: 'Não enviada (regra)' }
export const ROTULO_INTERRUPCAO: Record<string, string> = { RESPONDEU: 'respondeu', COMPROU: 'comprou', VENDEDOR_ASSUMIU: 'o vendedor assumiu a conversa', DESCADASTRADO: 'pediu para não receber', BLOQUEADO: 'bloqueado', SEM_AUTORIZACAO: 'sem autorização', CANCELAMENTO: 'campanha cancelada', REVOGADO: 'revogou a autorização', PASSO_REMOVIDO: 'mensagem removida' }
export const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function Numero({ rotulo, valor, detalhe, titulo }: { rotulo: string; valor: string; detalhe?: string; titulo?: string }) {
  return (
    <div className="ar-numero" style={{ cursor: 'default' }} title={titulo}>
      <div className="ar-num-nome"><span>{rotulo}</span></div>
      <div className="ar-num-valor">{valor}</div>
      {detalhe && <div className="ar-num-sub">{detalhe}</div>}
    </div>
  )
}

export function Paginacao({ pagina, total, porPagina, ir }: { pagina: number; total: number; porPagina: number; ir: (p: number) => void }) {
  const ult = Math.max(0, Math.ceil(total / porPagina) - 1)
  if (total <= porPagina) return null
  return (
    <div className="dp-paginacao">
      <button type="button" className="pl-btn" disabled={pagina <= 0} onClick={() => ir(pagina - 1)}>Anterior</button>
      <span className="pl-hint">Página {pagina + 1} de {ult + 1} · {n(total)} no total</span>
      <button type="button" className="pl-btn" disabled={pagina >= ult} onClick={() => ir(pagina + 1)}>Próxima</button>
    </div>
  )
}
