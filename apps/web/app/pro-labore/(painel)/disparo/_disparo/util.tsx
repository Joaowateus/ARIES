'use client'

// ARIES Disparo — utilitários das telas (formatos, selos de situação, metadados compartilhados).
import { createContext, useContext, useState } from 'react'
import { disparoApi, type ConfigEnvioDisparo, type MetaDisparo, type StatusCampanhaDisparo } from '@/lib/proLaboreApi'

export const MetaCtx = createContext<MetaDisparo | null>(null)
export const useMeta = () => useContext(MetaCtx)!
/** Recarrega os metadados (ex.: depois de o dono mudar uma regra da loja). */
export const RecarregarMetaCtx = createContext<() => void>(() => undefined)

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
export const ROTULO_INTERRUPCAO: Record<string, string> = { RESPONDEU: 'respondeu', COMPROU: 'comprou', VENDEDOR_ASSUMIU: 'o vendedor assumiu a conversa', DESCADASTRADO: 'pediu para não receber', BLOQUEADO: 'bloqueado', SEM_AUTORIZACAO: 'sem autorização', CANCELAMENTO: 'campanha cancelada', REVOGADO: 'revogou a autorização', PASSO_REMOVIDO: 'mensagem removida', SAIU_DO_PUBLICO: 'saiu do público (mudou de etapa)' }
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

/** Erro técnico do WhatsApp/servidor → frase que qualquer pessoa entende. */
export function erroAmigavel(erro: string | null | undefined): string {
  if (!erro) return ''
  const e = erro.toLowerCase()
  if (/connection closed|not connected|disconnected|desconectad/.test(e)) return 'O WhatsApp do remetente estava sem conexão: a mensagem voltou para a fila e sai quando a conexão voltar'
  if (/exists"?\s*:\s*false|not.*(exist|registered|on whatsapp)|n[aã]o (existe|tem whatsapp)|invalid.*(number|jid)/.test(e)) return 'Este número não tem WhatsApp'
  if (/blocked|bloquead/.test(e)) return 'O número bloqueou ou não aceita mensagens'
  if (/demorou demais|timeout|timed out/.test(e)) return 'O WhatsApp demorou a responder: o ARIES confere se saiu antes de qualquer reenvio'
  if (/servidor do whatsapp não configurado/.test(e)) return 'O servidor do WhatsApp não está configurado'
  if (/^sem valor para/.test(e)) return erro.replace(/^Sem valor para:/i, 'Falta no cadastro:')
  if (/internal server error|http 5\d\d/.test(e)) return 'Falha passageira no servidor do WhatsApp: tenta de novo sozinho'
  return erro.replace(/^error:\s*/i, '')
}

/** Hora de Brasília agora: dia da semana (0=dom) e minutos do dia. */
function agoraBrasilia(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)
  const v = (t: string) => p.find(x => x.type === t)?.value ?? ''
  return { dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(v('weekday')), minutos: Number(v('hour')) * 60 + Number(v('minute')) }
}
const minutosDe = (h: string) => { const [a, b] = h.split(':').map(Number); return (a || 0) * 60 + (b || 0) }
/** Se agora está fora da janela de envio, explica quando a campanha vai começar a enviar. */
export function avisoJanela(j: ConfigEnvioDisparo['janela']): string | null {
  const { dia, minutos } = agoraBrasilia()
  if (j.dias.includes(dia) && minutos >= minutosDe(j.inicio) && minutos < minutosDe(j.fim)) return null
  for (let i = 0; i < 8; i += 1) {
    const d = (dia + i) % 7
    if (!j.dias.includes(d)) continue
    if (i === 0 && minutos >= minutosDe(j.inicio)) continue
    return `Agora está fora do horário de envio desta campanha (${j.inicio}–${j.fim}, ${j.dias.map(x => DIAS[x]).join(', ')}). Ela fica na fila e começa ${i === 0 ? 'hoje' : i === 1 ? 'amanhã' : DIAS[d].toLowerCase()} às ${j.inicio}.`
  }
  return 'Nenhum dia marcado na janela de envio: ajuste no passo Agendamento.'
}

/**
 * Promocional sem autorização: explica por que os contatos ficaram de fora e mostra o que fazer.
 * O dono pode liberar ali mesmo a regra "leads e clientes da loja" (legítimo interesse).
 */
export function AvisoAutorizacao({ quantos, aoMudar }: { quantos: number; aoMudar?: () => void }) {
  const meta = useMeta()
  const recarregar = useContext(RecarregarMetaCtx)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  if (!quantos) return null
  async function liberar() {
    if (!window.confirm('Liberar mensagens promocionais para os leads e clientes da loja que nunca pediram para sair?\n\nA base é o legítimo interesse (relação comercial existente). Toda promoção leva no fim a opção de responder SAIR, e quem responder sai na hora. Você pode voltar atrás em Disparo › Configurações.')) return
    setOcupado(true); setErro(null)
    try { await disparoApi.config.salvar({ baseMarketing: 'RELACAO' }); recarregar(); aoMudar?.() } catch (e) { setErro(erroDe(e)) } finally { setOcupado(false) }
  }
  const relacao = meta.config.baseMarketing === 'RELACAO'
  return (
    <div className="pl-alert dp-aviso" role="status" data-aviso-autorizacao>
      <b>{n(quantos)} contato(s) ficaram de fora por ser uma campanha Promocional.</b>
      <p style={{ margin: '4px 0' }}>{relacao
        ? 'Pela regra da loja, promoção vai para quem autorizou e para leads e clientes da loja. Estes não têm nenhum dos dois (ou pediram para sair).'
        : 'Pela regra atual da loja, promoção só vai para quem autorizou (registro com base legal e evidência).'}</p>
      <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
        <li>Se não é promoção (aviso, lembrete, pós-venda), troque a finalidade para <b>Operacional</b> ou <b>Relacionamento</b> no passo 1.</li>
        <li>Registre quem autorizou em <b>Públicos › Autorizações</b>.</li>
        {!relacao && !meta.dono && <li>Ou peça ao dono para liberar promoções para os leads e clientes da loja.</li>}
      </ul>
      {!relacao && meta.dono && <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void liberar()} data-liberar-relacao>{ocupado ? 'Liberando…' : 'Liberar promoções para leads e clientes da loja'}</button>}
      {erro && <p className="pl-hint" style={{ color: 'var(--ar-estado-critico)' }}>{erro}</p>}
    </div>
  )
}

/** Barra de progresso da campanha: enviadas, falhas e não enviadas por regra sobre o total. */
export function Progresso({ total, enviadas, falhas, outras }: { total: number; enviadas: number; falhas: number; outras: number }) {
  if (!total) return null
  const p = (x: number) => `${Math.min(100, (x / total) * 100)}%`
  const feitas = Math.min(total, enviadas + falhas + outras)
  return (
    <div className="dp-progresso" aria-label={`${feitas} de ${total} processados`} data-progresso>
      <div className="dp-progresso-barra"><span className="ok" style={{ width: p(enviadas) }} /><span className="falha" style={{ width: p(falhas) }} /><span className="outra" style={{ width: p(outras) }} /></div>
      <div className="dp-progresso-legenda"><b>{Math.round((feitas / total) * 100)}%</b> · {n(enviadas)} contato(s) com tudo enviado{falhas ? ` · ${n(falhas)} com falha` : ''}{outras ? ` · ${n(outras)} parados por regra (respondeu, saiu…)` : ''} · {n(Math.max(0, total - feitas))} a caminho · de {n(total)}</div>
    </div>
  )
}
