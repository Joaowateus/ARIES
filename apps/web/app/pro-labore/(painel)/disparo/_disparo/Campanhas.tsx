'use client'

// Campanhas: lista (paginada no servidor), criação/edição (Assistente) e o acompanhamento de uma
// campanha (atualiza sozinho a cada 5 s enquanto ela está ativa): números, destinatários, o histórico
// de cada um (tentativas, eventos, falhas), decisões sobre envios sem confirmação e o resultado comercial.
import { useCallback, useEffect, useRef, useState } from 'react'
import { disparoApi, type CampanhaDisparo, type ComercialDisparo, type DestinatarioDisparo, type DetalheDestinatarioDisparo, type EventoDisparo, type ItemCampanhaDisparo, type SituacaoEnvioDisparo, type StatusCampanhaDisparo } from '@/lib/proLaboreApi'
import { Assistente } from './Assistente'
import { Numero, Paginacao, Progresso, erroAmigavel, ROTULO_DESTINATARIO, ROTULO_INTERRUPCAO, ROTULO_MENSAGEM, SeloStatus, dataHora, duracao, erroDe, n, pct, useMeta } from './util'

const ATIVAS: StatusCampanhaDisparo[] = ['VALIDATING', 'QUEUED', 'RUNNING', 'SCHEDULED']
const FILTROS: Array<{ rotulo: string; status?: string }> = [
  { rotulo: 'Todas' }, { rotulo: 'Em andamento', status: 'QUEUED,RUNNING,PAUSED' }, { rotulo: 'Aguardando aprovação', status: 'NEEDS_REVIEW' }, { rotulo: 'Agendadas', status: 'SCHEDULED' },
  { rotulo: 'Preparação', status: 'DRAFT,VALIDATING,NEEDS_REVIEW,READY' }, { rotulo: 'Concluídas', status: 'COMPLETED,COMPLETED_WITH_ERRORS' }, { rotulo: 'Canceladas', status: 'CANCELLED' }, { rotulo: 'Arquivadas', status: 'ARCHIVED' },
]

export function Campanhas({ aberta, abrir }: { aberta: string | null; abrir: (id: string | null) => void }) {
  const meta = useMeta()
  const [filtro, setFiltro] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [lista, setLista] = useState<{ total: number; porPagina: number; itens: ItemCampanhaDisparo[] } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState<CampanhaDisparo | null | 'nova'>(null)
  const carregar = useCallback(() => { disparoApi.campanhas.listar({ status: FILTROS[filtro].status, pagina }).then(setLista).catch(e => setErro(erroDe(e))) }, [filtro, pagina])
  useEffect(() => { if (!aberta && !editando) carregar() }, [carregar, aberta, editando])
  const pode = meta.nivel === 'EDITAR'
  // Gestão: campanhas da equipe esperando aprovação (aviso no topo da lista).
  const [aprovar, setAprovar] = useState(0)
  useEffect(() => { if (meta.gestao && !aberta && !editando) disparoApi.campanhas.listar({ status: 'NEEDS_REVIEW' }).then(r => setAprovar(r.total)).catch(() => undefined) }, [meta.gestao, aberta, editando, lista])

  if (editando) return <Assistente campanha={editando === 'nova' ? null : editando} fechar={() => setEditando(null)} abrirMonitor={id => { setEditando(null); abrir(id) }} />
  if (aberta) return <Monitor id={aberta} voltar={() => abrir(null)} editar={c => setEditando(c)} abrir={abrir} />
  return (
    <div data-disparo-campanhas>
      <div className="dp-linha" style={{ justifyContent: 'space-between' }}>
        <div className="cc-chips">{FILTROS.map((x, i) => <button key={x.rotulo} type="button" className={`pl-chip ${filtro === i ? 'active' : ''}`} onClick={() => { setFiltro(i); setPagina(0) }}>{x.rotulo}</button>)}</div>
        {pode && <button type="button" className="pl-btn pl-btn-primary" onClick={() => setEditando('nova')} data-nova-campanha>Nova campanha</button>}
      </div>
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      {aprovar > 0 && FILTROS[filtro].status !== 'NEEDS_REVIEW' && (
        <div className="pl-alert dp-linha" role="status" style={{ justifyContent: 'space-between' }} data-aviso-aprovar>
          <span><b>{aprovar} {aprovar === 1 ? 'campanha da equipe está' : 'campanhas da equipe estão'} esperando sua aprovação.</b> Nada é enviado antes disso.</span>
          <button type="button" className="pl-btn pl-btn-primary" onClick={() => { setFiltro(FILTROS.findIndex(x => x.status === 'NEEDS_REVIEW')); setPagina(0) }}>Ver e aprovar</button>
        </div>
      )}
      {!lista ? <p className="pl-hint" aria-busy="true">Carregando…</p> : !lista.itens.length ? (
        <div className="pl-empty pl-card"><h3 style={{ margin: 0 }}>Nenhuma campanha aqui</h3><p>{pode ? 'Crie a primeira em “Nova campanha”.' : 'Seu acesso é só para acompanhar.'}</p></div>
      ) : (
        <div className="pl-table-wrap">
          <table className="pl-table">
            <thead><tr><th>Campanha</th><th>Situação</th><th>Número</th><th className="pl-right">Destinatários</th><th>Quando</th><th>Responsável</th></tr></thead>
            <tbody>
              {lista.itens.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => abrir(c.id)} data-campanha={c.id}>
                  <td><b>{c.nome}</b><div className="pl-hint">{meta.finalidades[c.finalidade]}{c.objetivo ? ` · ${c.objetivo}` : ''}</div>{c.erro && <div className="pl-hint" style={{ color: 'var(--ar-estado-critico)' }}>{erroAmigavel(c.erro)}</div>}</td>
                  <td><SeloStatus status={c.status} /></td>
                  <td>{c.assistente?.vendedor.nome ?? '—'}</td>
                  <td className="pl-right">{c.totais ? n(c.totais.elegiveis) : '—'}</td>
                  <td>{c.concluidaEm ? `terminou ${dataHora(c.concluidaEm)}` : c.iniciadaEm ? `começou ${dataHora(c.iniciadaEm)}` : c.agendadaPara ? `agendada ${dataHora(c.agendadaPara)}` : '—'}</td>
                  <td>{c.responsavelNome ?? c.criadoPorNome ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Paginacao pagina={pagina} total={lista.total} porPagina={lista.porPagina} ir={setPagina} />
        </div>
      )}
    </div>
  )
}

function Monitor({ id, voltar, editar, abrir }: { id: string; voltar: () => void; editar: (c: CampanhaDisparo) => void; abrir: (id: string) => void }) {
  const meta = useMeta()
  const [c, setC] = useState<CampanhaDisparo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [filtro, setFiltro] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(0)
  const [dest, setDest] = useState<{ total: number; porPagina: number; itens: DestinatarioDisparo[] } | null>(null)
  const [detalhe, setDetalhe] = useState<string | null>(null)
  const [eventos, setEventos] = useState<EventoDisparo[]>([])
  const [comercial, setComercial] = useState<ComercialDisparo | null>(null)
  const pode = meta.nivel === 'EDITAR'

  const carregar = useCallback(() => Promise.all([disparoApi.campanhas.ver(id), disparoApi.campanhas.destinatarios(id, { status: filtro || undefined, busca: busca || undefined, pagina }), disparoApi.campanhas.eventos(id)])
    .then(([cc, d, ev]) => {
      setC(cc); setDest(d); setEventos(ev); setErro(null)
      if (cc.iniciadaEm) disparoApi.campanhas.comercial(id).then(setComercial).catch(() => undefined)
    })
    .catch(e => setErro(erroDe(e))), [id, filtro, busca, pagina])
  useEffect(() => { void carregar() }, [carregar])
  const ativa = !!c && ATIVAS.includes(c.status)
  useEffect(() => { if (!ativa) return; const t = setInterval(() => void carregar(), 5000); return () => clearInterval(t) }, [ativa, carregar])
  // Com a campanha aberta, a própria tela pede as rodadas do envio (a cada 20 s): o envio não fica
  // parado esperando a rotina automática. Uma rodada por vez; o servidor respeita intervalo e limites.
  const enviando = !!c && (['VALIDATING', 'QUEUED', 'RUNNING'].includes(c.status) || (c.status === 'SCHEDULED' && !!c.agendadaPara && new Date(c.agendadaPara) <= new Date()))
  const emRodada = useRef(false)
  const [rodada, setRodada] = useState<{ em: number; texto: string; erro: boolean } | null>(null)
  const rodar = useCallback(() => {
    if (emRodada.current) return
    emRodada.current = true
    disparoApi.processar()
      .then(r => setRodada({ em: Date.now(), erro: false, texto: r.rodou ? `enviou ${r.disparoEnviadas ?? 0}${r.disparoFalhas ? `, ${r.disparoFalhas} falha(s)` : ''}` : (r.motivo ?? 'nada a fazer') }))
      .catch(e => setRodada({ em: Date.now(), erro: true, texto: erroDe(e) }))
      .finally(() => { emRodada.current = false; void carregar() })
  }, [carregar])
  useEffect(() => { if (!enviando) return; rodar(); const t = setInterval(rodar, 20_000); return () => clearInterval(t) }, [enviando, rodar])

  async function agir(fn: () => Promise<unknown>, ok: string, confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return
    setOcupado(true); setMsg(null)
    try { await fn(); setMsg(ok); await carregar() } catch (e) { setMsg(erroDe(e)) } finally { setOcupado(false) }
  }
  if (erro) return <div><button type="button" className="pl-btn" onClick={voltar}>Voltar</button><div className="pl-alert pl-alert-error" role="alert">{erro}</div></div>
  if (!c) return <p className="pl-hint" aria-busy="true">Carregando a campanha…</p>
  const r = c.resumo
  const st = c.status
  return (
    <div data-disparo-monitor={st}>
      <div className="dp-linha" style={{ justifyContent: 'space-between' }}>
        <div><button type="button" className="pl-btn" onClick={voltar}>← Campanhas</button> <b style={{ fontSize: 18, marginLeft: 8 }}>{c.nome}</b> <SeloStatus status={st} /></div>
        {pode && (
          <span className="cc-chips">
            {['DRAFT', 'NEEDS_REVIEW', 'READY', 'SCHEDULED'].includes(st) && <button type="button" className="pl-btn" onClick={() => editar(c)}>Editar</button>}
            {st === 'DRAFT' && <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void agir(() => disparoApi.campanhas.validar(c.id), 'Público em preparação.')}>Preparar o público</button>}
            {st === 'NEEDS_REVIEW' && meta.gestao && <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void agir(() => disparoApi.campanhas.aprovar(c.id), 'Aprovada.')}>Aprovar</button>}
            {st === 'NEEDS_REVIEW' && meta.gestao && <button type="button" className="pl-btn" disabled={ocupado} onClick={() => { const m = window.prompt('Por que devolver?'); if (m) void agir(() => disparoApi.campanhas.reprovar(c.id, m), 'Devolvida ao rascunho.') }}>Devolver</button>}
            {st === 'READY' && <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void agir(async () => { const r = await disparoApi.campanhas.iniciar(c.id, c.agendadaPara); if (r.status === 'QUEUED') rodar() }, c.agendadaPara && new Date(c.agendadaPara) > new Date() ? 'Agendada.' : 'Começou: a primeira mensagem sai em instantes. Deixe esta tela aberta para acompanhar.', `Confirmar o envio para ${n(c.totais?.elegiveis)} contato(s)?`)}>{c.agendadaPara && new Date(c.agendadaPara) > new Date() ? 'Confirmar agendamento' : 'Iniciar agora'}</button>}
            {(st === 'RUNNING' || st === 'QUEUED') && <button type="button" className="pl-btn" disabled={ocupado} onClick={() => void agir(() => disparoApi.campanhas.pausar(c.id), 'Pausada: nenhum envio novo até retomar.')}>Pausar</button>}
            {st === 'PAUSED' && <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void agir(() => disparoApi.campanhas.retomar(c.id), 'Retomada.')}>Retomar</button>}
            {!['COMPLETED', 'COMPLETED_WITH_ERRORS', 'CANCELLED', 'ARCHIVED'].includes(st) && <button type="button" className="pl-btn" disabled={ocupado} onClick={() => void agir(() => disparoApi.campanhas.cancelar(c.id), 'Cancelada: o que não saiu foi cancelado.', 'Cancelar a campanha? O que ainda não foi enviado não sai mais.')}>Cancelar</button>}
            <button type="button" className="pl-btn" disabled={ocupado} onClick={() => void agir(async () => { const nova = await disparoApi.campanhas.duplicar(c.id); abrir(nova.id) }, 'Cópia criada.')}>Duplicar</button>
            {['COMPLETED', 'COMPLETED_WITH_ERRORS', 'CANCELLED', 'DRAFT'].includes(st) && <button type="button" className="pl-btn" disabled={ocupado} onClick={() => void agir(() => disparoApi.campanhas.arquivar(c.id), 'Arquivada.')}>Arquivar</button>}
          </span>
        )}
      </div>
      <p className="pl-hint">{meta.finalidades[c.finalidade]}{c.objetivo ? ` · ${c.objetivo}` : ''} · {c.remetente ? `envia pelo WhatsApp de ${c.remetente.vendedor} ${c.remetente.numero ?? ''}${c.remetente.conectado ? '' : ' (desconectado)'}` : 'sem número'} · criada por {c.criadoPorNome ?? '—'}{c.aprovadoPorNome ? ` · aprovada por ${c.aprovadoPorNome}` : ''} · versão {c.versao}{ativa ? ' · atualiza a cada 5 s' : ''}</p>
      {msg && <p className="pl-hint" role="status">{msg}</p>}
      {c.situacao && <PainelAgora s={c.situacao} status={st} rodada={enviando ? rodada : null} />}
      {(c.erro || r?.erro) && c.situacao?.motivo !== 'SEM_CONEXAO' && <div className="pl-alert pl-alert-error" role="alert">{erroAmigavel(c.erro ?? r?.erro)}</div>}
      {r && r.aDecidir > 0 && <div className="pl-alert" role="status">{r.aDecidir} mensagem(ns) sem confirmação ou com as tentativas esgotadas: decida na lista abaixo (filtro “Falhou”) se reenvia ou considera enviada. O sistema nunca reenvia sozinho o que pode já ter saído.</div>}

      {r && r.elegiveis > 0 && !['DRAFT', 'VALIDATING', 'NEEDS_REVIEW', 'READY'].includes(st) && <Progresso total={r.elegiveis} enviadas={(r.destinatarios.CONCLUIDO ?? 0) + (r.destinatarios.RESPONDEU ?? 0)} falhas={r.destinatarios.FALHOU ?? 0} outras={r.destinatarios.INTERROMPIDO ?? 0} />}
      {r && (
        <>
          <section className="ar-agora" aria-label="Público">
            <Numero rotulo="Selecionados" valor={n(r.selecionados)} />
            <Numero rotulo="Elegíveis" valor={n(r.elegiveis)} />
            <Numero rotulo="Excluídos" valor={n(r.excluidos)} detalhe={Object.entries(r.porMotivo).map(([m, q]) => `${meta.motivos[m] ?? m}: ${q}`).join(' · ').slice(0, 120)} />
            <Numero rotulo="Pendentes / na fila" valor={`${n(r.pendentes)} / ${n(r.naFila)}`} detalhe={`${n(r.processadas)} processadas`} />
            <Numero rotulo="Tempo" valor={duracao(r.tempoMs)} />
          </section>
          <section className="ar-agora" aria-label="Envio">
            <Numero rotulo="Aceitas pelo WhatsApp" valor={n(r.aceitas)} />
            <Numero rotulo="Entregues" valor={n(r.entregues)} detalhe={`taxa ${pct(r.taxaEntrega)}`} />
            <Numero rotulo="Lidas" valor={n(r.lidas)} detalhe={`taxa ${pct(r.taxaLeitura)}`} />
            <Numero rotulo="Respostas" valor={n(r.respostas)} detalhe={`taxa ${pct(r.taxaResposta)} · ${n(r.descadastros)} saíram`} />
            <Numero rotulo="Falhas" valor={n(r.falhas)} detalhe={`${n(r.desconhecidas)} sem confirmação · ${n(r.puladas)} não enviadas por regra`} />
          </section>
          <p className="pl-hint">{r.origem}</p>
        </>
      )}

      <section className="pl-card" style={{ marginTop: 12 }}>
        <div className="dp-linha" style={{ justifyContent: 'space-between' }}>
          <div className="pl-card-title">Destinatários</div>
          <input className="pl-input" style={{ maxWidth: 240 }} placeholder="Buscar por nome ou final do telefone" value={busca} onChange={e => { setBusca(e.target.value); setPagina(0) }} />
        </div>
        <div className="cc-chips">
          {[['', 'Todos'], ['EM_ANDAMENTO', 'Em andamento'], ['CONCLUIDO', 'Concluídos'], ['RESPONDEU', 'Responderam'], ['FALHOU', 'Falhou'], ['INTERROMPIDO', 'Interrompidos'], ['EXCLUIDO', 'Excluídos']].map(([v, rot]) => <button key={v} type="button" className={`pl-chip ${filtro === v ? 'active' : ''}`} onClick={() => { setFiltro(v); setPagina(0) }}>{rot}</button>)}
        </div>
        {dest && (
          <div className="pl-table-wrap" style={{ marginTop: 8 }}>
            <table className="pl-table">
              <thead><tr><th>Contato</th><th>Situação</th><th>Última mensagem</th><th>Detalhe</th></tr></thead>
              <tbody>
                {dest.itens.map(d => {
                  const m = d.mensagens[0]
                  return (
                    <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => setDetalhe(d.id)} data-destinatario={d.status}>
                      <td>{d.nome ?? '—'} <span className="pl-hint pl-mono">{d.telefone}</span></td>
                      <td>{ROTULO_DESTINATARIO[d.status] ?? d.status}{d.respondeuEm ? ` · respondeu ${dataHora(d.respondeuEm)}` : ''}</td>
                      <td>{m ? `${ROTULO_MENSAGEM[m.status] ?? m.status}${m.lidaEm ? ` ${dataHora(m.lidaEm)}` : m.entregueEm ? ` ${dataHora(m.entregueEm)}` : m.aceitaEm ? ` ${dataHora(m.aceitaEm)}` : ''}` : '—'}</td>
                      <td className="pl-hint">{d.motivoExclusao ? meta.motivos[d.motivoExclusao] ?? d.motivoExclusao : d.interrompidoPor ? `parou: ${ROTULO_INTERRUPCAO[d.interrompidoPor] ?? d.interrompidoPor}` : erroAmigavel(m?.ultimoErro)}</td>
                    </tr>
                  )
                })}
                {!dest.itens.length && <tr><td colSpan={4} className="pl-hint">{c.totais ? 'Ninguém neste filtro.' : 'O público ainda não foi preparado.'}</td></tr>}
              </tbody>
            </table>
            <Paginacao pagina={pagina} total={dest.total} porPagina={dest.porPagina} ir={setPagina} />
          </div>
        )}
      </section>

      {comercial && (
        <section className="pl-card" style={{ marginTop: 12 }} data-disparo-comercial>
          <div className="pl-card-title">Depois da campanha ({comercial.janelaDias} dias)</div>
          <section className="ar-agora">
            <Numero rotulo="Leads que receberam" valor={n(comercial.destinatariosComLead)} />
            <Numero rotulo="Avançaram de etapa" valor={n(comercial.oportunidades)} />
            <Numero rotulo="Reativados" valor={n(comercial.leadsReativados)} />
            <Numero rotulo="Fichas · aprovações" valor={`${n(comercial.fichasDeCredito)} · ${n(comercial.aprovacoes)}`} />
            <Numero rotulo="Visitas" valor={n(comercial.visitas)} />
            <Numero rotulo="Vendas" valor={n(comercial.vendas)} detalhe={comercial.receita != null ? comercial.receita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : undefined} />
          </section>
          <p className="pl-hint">{comercial.origem}</p>
        </section>
      )}

      <div className="pl-grid-2b" style={{ marginTop: 12 }}>
        <section className="pl-card"><div className="pl-card-title">Histórico da campanha</div>
          <ul style={{ margin: 0, paddingLeft: 18 }} className="pl-hint">{eventos.map(e => <li key={e.id}>{dataHora(e.criadoEm)} · {e.descricao ?? e.tipo}{e.autorNome ? ` · ${e.autorNome}` : ''}</li>)}</ul>
        </section>
        <section className="pl-card"><div className="pl-card-title">Versões</div>
          <ul style={{ margin: 0, paddingLeft: 18 }} className="pl-hint">{(c.versoes ?? []).map(v => <li key={v.versao}>v{v.versao} · {dataHora(v.criadoEm)} · {v.motivo ?? ''}{v.autorNome ? ` · ${v.autorNome}` : ''}</li>)}</ul>
        </section>
      </div>
      {detalhe && <DetalheDestinatario id={detalhe} fechar={() => setDetalhe(null)} pode={pode} aoMudar={() => void carregar()} />}
    </div>
  )
}

function DetalheDestinatario({ id, fechar, pode, aoMudar }: { id: string; fechar: () => void; pode: boolean; aoMudar: () => void }) {
  const [d, setD] = useState<DetalheDestinatarioDisparo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(() => { disparoApi.destinatario(id).then(setD).catch(e => setErro(erroDe(e))) }, [id])
  useEffect(() => { carregar() }, [carregar])
  async function decidir(mid: string, dec: 'REENVIAR' | 'CONSIDERAR_ENVIADA') {
    try { await disparoApi.decidir(mid, dec); carregar(); aoMudar() } catch (e) { setErro(erroDe(e)) }
  }
  return (
    <div className="pl-modal-backdrop" onClick={fechar}>
      <div className="pl-modal-panel pl-card dp-detalhe" onClick={e => e.stopPropagation()} role="dialog" aria-label="Destinatário">
        <div className="dp-linha" style={{ justifyContent: 'space-between' }}><b>{d?.nome ?? 'Destinatário'}</b><button type="button" className="pl-btn" onClick={fechar}>Fechar</button></div>
        {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
        {!d ? <p className="pl-hint">Carregando…</p> : (
          <>
            <p className="pl-hint">{d.telefone} · {ROTULO_DESTINATARIO[d.status] ?? d.status}{d.interrompidoPor ? ` (${ROTULO_INTERRUPCAO[d.interrompidoPor] ?? d.interrompidoPor})` : ''}{d.respondeuEm ? ` · respondeu ${dataHora(d.respondeuEm)}` : ''}{d.leadId ? ' · ' : ''}{d.leadId && <a href={`/pro-labore/leads?lead=${d.leadId}`}>abrir o lead</a>}</p>
            {d.mensagens.map(m => (
              <div key={m.id} className="dp-passo">
                <div className="dp-linha" style={{ justifyContent: 'space-between' }}><b>Mensagem {m.passo + 1}</b><span>{ROTULO_MENSAGEM[m.status] ?? m.status}</span></div>
                {m.texto && <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0' }}>{m.texto}</p>}
                <p className="pl-hint">Na fila desde {dataHora(m.enviarApos)}{m.aceitaEm ? ` · aceita ${dataHora(m.aceitaEm)}` : ''}{m.entregueEm ? ` · entregue ${dataHora(m.entregueEm)}` : ''}{m.lidaEm ? ` · lida ${dataHora(m.lidaEm)}` : ''}{m.falhouEm ? ` · falhou ${dataHora(m.falhouEm)}` : ''}</p>
                {m.ultimoErro && <p className="pl-hint" style={{ color: 'var(--ar-estado-critico)' }} title={m.ultimoErro}>{erroAmigavel(m.ultimoErro)}</p>}
                {m.tentativasRegistro.length > 0 && <ul className="pl-hint" style={{ margin: 0, paddingLeft: 18 }}>{m.tentativasRegistro.map(t => <li key={`${t.numero}-${t.inicio}`}>tentativa {t.numero} · {dataHora(t.inicio)} · {t.resultado.toLowerCase().replace(/_/g, ' ')}{t.erro ? ` · ${erroAmigavel(t.erro)}` : ''}</li>)}</ul>}
                {pode && (m.status === 'DESCONHECIDO' || (m.status === 'FALHOU' && m.erroClasse === 'ESGOTOU')) && (
                  <div className="dp-linha">
                    <button type="button" className="pl-btn" onClick={() => { if (window.confirm('Reenviar? Se a mensagem já tiver chegado, o cliente recebe duas vezes.')) void decidir(m.id, 'REENVIAR') }}>Reenviar</button>
                    <button type="button" className="pl-btn" onClick={() => void decidir(m.id, 'CONSIDERAR_ENVIADA')}>Considerar enviada</button>
                  </div>
                )}
              </div>
            ))}
            {d.eventos.length > 0 && <><b>Eventos</b><ul className="pl-hint" style={{ margin: 0, paddingLeft: 18 }}>{d.eventos.map(e => <li key={e.id}>{dataHora(e.criadoEm)} · {e.descricao ?? e.tipo}</li>)}</ul></>}
          </>
        )}
      </div>
    </div>
  )
}

const ETAPAS: Array<{ rotulo: string; status: StatusCampanhaDisparo[] }> = [
  { rotulo: 'Montar', status: ['DRAFT', 'VALIDATING'] }, { rotulo: 'Revisar', status: ['NEEDS_REVIEW', 'READY'] }, { rotulo: 'Agendada / na fila', status: ['SCHEDULED', 'QUEUED'] }, { rotulo: 'Enviando', status: ['RUNNING', 'PAUSED'] }, { rotulo: 'Concluída', status: ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'CANCELLED', 'ARCHIVED'] },
]
const TOM: Partial<Record<SituacaoEnvioDisparo['motivo'], string>> = { SEM_CONEXAO: 'critico', LIMITE_DIA: 'atencao', LIMITE_HORA: 'atencao', FORA_DA_JANELA: 'atencao', PAUSADA: 'atencao', ENVIANDO: 'bom', INTERVALO: 'bom' }
const haQuanto = (iso: string | null) => { if (!iso) return 'nunca'; const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000)); return s < 60 ? `há ${s} s` : s < 3600 ? `há ${Math.round(s / 60)} min` : `há ${Math.round(s / 3600)} h` }
const daquiA = (iso: string | null) => { if (!iso) return null; const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000); return s <= 5 ? 'agora' : s < 60 ? `em ${s} s` : s < 3600 ? `em ${Math.round(s / 60)} min` : dataHora(iso) }

/** O que está acontecendo com o envio agora, em linguagem simples, e o caminho da campanha. */
function PainelAgora({ s, status, rodada }: { s: SituacaoEnvioDisparo; status: StatusCampanhaDisparo; rodada: { em: number; texto: string; erro: boolean } | null }) {
  const atual = ETAPAS.findIndex(e => e.status.includes(status))
  const prox = ['ENVIANDO', 'INTERVALO', 'NA_FILA', 'NA_HORA', 'ATENDIMENTO'].includes(s.motivo) ? daquiA(s.proximoEnvioEm) : null
  const ativo = ['PREPARANDO', 'NA_HORA', 'NA_FILA', 'ENVIANDO', 'INTERVALO', 'LIMITE_HORA', 'LIMITE_DIA', 'FORA_DA_JANELA', 'SEM_CONEXAO'].includes(s.motivo)
  return (
    <section className={`pl-card dp-agora ${TOM[s.motivo] ?? ''}`} aria-label="Situação do envio" data-situacao={s.motivo}>
      <ol className="dp-caminho">{ETAPAS.map((e, i) => <li key={e.rotulo} className={i < atual ? 'feita' : i === atual ? 'atual' : ''}>{e.rotulo}</li>)}</ol>
      <div className="dp-agora-titulo"><b>{s.titulo}</b>{prox && <span className="pl-hint"> · próxima mensagem {prox}</span>}</div>
      <p style={{ margin: '4px 0' }}>{s.texto}</p>
      <Cronometros s={s} status={status} proximaRodada={rodada ? rodada.em + 20_000 : null} />
      {rodada && <p className="pl-hint" style={{ margin: '0 0 4px', color: rodada.erro ? 'var(--ar-estado-critico)' : undefined }} role="status">Última rodada pedida por esta tela: {haQuanto(new Date(rodada.em).toISOString())} · {rodada.erro ? `erro: ${rodada.texto}` : rodada.texto}</p>}
      {ativo && (
        <p className="pl-hint" style={{ margin: 0 }}>
          {s.motor.rotinaParada
            ? <>Envio funcionando pelas telas abertas do ARIES (esta e as da equipe){s.motor.ultimaRodadaEm ? ` · última rodada ${haQuanto(s.motor.ultimaRodadaEm)}` : ''}. Para enviar mesmo com o sistema fechado por todos, ligue o “Envio automático” em Configurações.</>
            : <>Envio automático ligado (última rodada {haQuanto(s.motor.ultimaRotinaEm)}): pode fechar esta tela, o envio continua.</>}
        </p>
      )}
    </section>
  )
}

const relogio = (ms: number | null) => { if (ms == null || !Number.isFinite(ms)) return '—'; const t = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sg = t % 60; const p2 = (x: number) => String(x).padStart(2, '0'); return h ? `${h}:${p2(m)}:${p2(sg)}` : `${p2(m)}:${p2(sg)}` }

/** Cronômetros ao vivo (atualizam a cada segundo): próxima mensagem, desde a última, tempo de envio e ritmo médio. */
function Cronometros({ s, status, proximaRodada }: { s: SituacaoEnvioDisparo; status: StatusCampanhaDisparo; proximaRodada: number | null }) {
  const [agora, setAgora] = useState(() => Date.now())
  const vivo = ['QUEUED', 'RUNNING', 'SCHEDULED', 'VALIDATING'].includes(status)
  useEffect(() => { if (!vivo) return; const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t) }, [vivo])
  const t = s.tempos
  if (!t) return null
  const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : null)
  // Se a hora prevista já passou, a mensagem sai na próxima rodada pedida pela tela (a cada 20 s).
  const previsto = ms(s.proximoEnvioEm)
  const prox = previsto != null && previsto <= agora && proximaRodada != null && proximaRodada > agora ? proximaRodada : previsto, ult = ms(t.ultimaEnviadaEm), prim = ms(t.primeiraEnviadaEm), ini = ms(t.iniciadaEm)
  const fimRef = vivo ? agora : (ult ?? agora)
  const ritmo = prim != null && ult != null && t.enviadas > 1 ? (ult - prim) / (t.enviadas - 1) : null
  const mostraProx = vivo && prox != null && ['ENVIANDO', 'INTERVALO', 'NA_FILA', 'NA_HORA', 'ATENDIMENTO', 'AGENDADA', 'FORA_DA_JANELA'].includes(s.motivo)
  return (
    <div className="dp-cronometros" aria-label="Cronômetros do envio" data-cronometros>
      <div><span>Próxima mensagem</span><b className="pl-mono">{mostraProx ? (prox! - agora <= 0 ? 'agora' : prox! - agora > 3600_000 ? new Date(prox!).toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '') : relogio(prox! - agora)) : '—'}</b></div>
      <div><span>Desde a última enviada</span><b className="pl-mono">{ult != null ? relogio(fimRef - ult) : 'nenhuma ainda'}</b></div>
      <div><span>Tempo de envio</span><b className="pl-mono">{ini != null ? relogio(fimRef - ini) : '—'}</b></div>
      <div><span>Ritmo médio</span><b className="pl-mono">{ritmo != null ? `${relogio(ritmo)} / msg` : '—'}</b>{t.intervaloSeg != null && <small className="pl-hint">mínimo {t.intervaloSeg} s · {t.enviadas} enviada(s)</small>}</div>
    </div>
  )
}
