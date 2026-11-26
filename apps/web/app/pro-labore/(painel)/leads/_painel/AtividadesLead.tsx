'use client'

// Aba Atividades do painel do lead (19/11): follows, ligações, atividades da
// etapa e notas numa lista só, ordenada por data, com "+ Follow", "+ Ligação"
// e "+ Nota" no topo. Tudo o que as seções separadas faziam continua aqui:
// ligar, registrar a ligação, agendar avulsa ou iniciar cadência, escrever
// (Ctrl+Enter), editar e apagar notas, abrir o follow.
import { useEffect, useRef, useState } from 'react'
import { proLaboreApi, type FollowLead, type Ligacao, type NotaLead } from '@/lib/proLaboreApi'
import { situacaoFollow } from '../../_follow/follow'
import { ALERTA, BotaoLigar, RESULTADO, RegistrarLigacao, duracao, quandoLigar, rotuloPasso } from '../../_ligacoes/Ligacoes'
import { useConfirmar } from '../../_ui/ui'

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const editada = (n: NotaLead) => new Date(n.atualizadoEm).getTime() - new Date(n.criadoEm).getTime() > 1000
const comAtalho = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); fn() } }

type Item =
  | { tipo: 'follow'; data: string; f: FollowLead }
  | { tipo: 'ligacao'; data: string; l: Ligacao }
  | { tipo: 'nota'; data: string; n: NotaLead }
  | { tipo: 'atividade'; data: string; a: { id: string; agendadoPara: string; nota: string | null } }

export function AtividadesLead({ leadId, nomeCliente, telefone, follows, atividadesEtapa, focarNota, podeEscrever, vejaAlertas, onFollow, onContagemNotas, onLigacoesMudaram, onContagem }: {
  leadId: string
  nomeCliente: string
  telefone: string | null | undefined
  follows: FollowLead[]
  atividadesEtapa: Array<{ id: string; agendadoPara: string; nota: string | null }>
  focarNota: boolean
  podeEscrever: boolean
  vejaAlertas: boolean
  onFollow: () => void
  onContagemNotas: (n: number) => void
  onLigacoesMudaram: () => void
  onContagem?: (n: number) => void
}) {
  const confirmar = useConfirmar()
  const [notas, setNotas] = useState<NotaLead[] | null>(null)
  const [lig, setLig] = useState<{ ligacoes: Ligacao[]; cadencias: Array<{ id: string; nome: string; passos: number }> } | null>(null)
  const [versao, setVersao] = useState(0)
  const [erro, setErro] = useState('')
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null)
  const [registrando, setRegistrando] = useState<Ligacao | null>(null)
  const [novaLig, setNovaLig] = useState<'' | 'avulsa' | 'cadencia'>('')
  const [quando, setQuando] = useState('')
  const [instrucao, setInstrucao] = useState('')
  const [cadenciaId, setCadenciaId] = useState('')
  const campo = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let vivo = true
    proLaboreApi.notasLead.doLead(leadId).then(n => { if (vivo) setNotas(n) }).catch(e => { if (vivo) setErro((e as Error).message) })
    return () => { vivo = false }
  }, [leadId])
  useEffect(() => {
    let vivo = true
    proLaboreApi.ligacoes.doLead(leadId).then(d => { if (vivo) setLig(d) }).catch(e => { if (vivo) setErro((e as Error).message) })
    return () => { vivo = false }
  }, [leadId, versao])
  useEffect(() => { if (focarNota) campo.current?.focus() }, [focarNota])

  const ligacoes = (lig?.ligacoes ?? []).filter(l => l.status !== 'CANCELADA')
  const itens: Item[] = [
    ...follows.map(f => ({ tipo: 'follow' as const, data: f.agendadoPara, f })),
    ...ligacoes.map(l => ({ tipo: 'ligacao' as const, data: l.status === 'FEITA' ? l.registradaEm ?? l.agendadaPara : l.agendadaPara, l })),
    ...(notas ?? []).map(n => ({ tipo: 'nota' as const, data: n.criadoEm, n })),
    ...atividadesEtapa.map(a => ({ tipo: 'atividade' as const, data: a.agendadoPara, a })),
  ].sort((a, b) => b.data.localeCompare(a.data))
  const pendentes = follows.length + ligacoes.filter(l => l.status === 'PENDENTE').length + atividadesEtapa.length
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onContagem?.(pendentes) }, [pendentes])

  async function salvarNota() {
    const t = texto.trim()
    if (!t || salvando) return
    setSalvando(true); setErro('')
    try { const nova = await proLaboreApi.notasLead.criar(leadId, t); const l = [nova, ...(notas ?? [])]; setNotas(l); setTexto(''); onContagemNotas(l.length) } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }
  async function salvarEdicao() {
    if (!editando || !editando.texto.trim() || salvando) return
    setSalvando(true); setErro('')
    try { const n = await proLaboreApi.notasLead.editar(editando.id, editando.texto.trim()); setNotas(a => (a ?? []).map(x => (x.id === n.id ? n : x))); setEditando(null) } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }
  async function apagar(n: NotaLead) {
    if (!(await confirmar({ titulo: 'Apagar esta nota?', acao: 'Apagar', perigo: true }))) return
    try { await proLaboreApi.notasLead.remover(n.id); const l = (notas ?? []).filter(x => x.id !== n.id); setNotas(l); onContagemNotas(l.length) } catch (e) { setErro((e as Error).message) }
  }
  async function agendarLigacao() {
    setErro('')
    try {
      if (novaLig === 'avulsa') {
        if (!quando) { setErro('Escolha o dia e a hora'); return }
        await proLaboreApi.ligacoes.agendar(leadId, { agendadaPara: new Date(quando).toISOString(), ...(instrucao.trim() && { instrucao: instrucao.trim() }) })
      } else if (novaLig === 'cadencia') {
        if (!cadenciaId) { setErro('Escolha a cadência'); return }
        await proLaboreApi.ligacoes.iniciarCadencia(leadId, cadenciaId)
      }
      setNovaLig(''); setQuando(''); setInstrucao(''); setCadenciaId(''); setVersao(v => v + 1); onLigacoesMudaram()
    } catch (e) { setErro((e as Error).message) }
  }

  return (
    <div className="pn-ativ" data-atividades-lead>
      <div className="pn-ativ-barra">
        <button type="button" className="pl-btn" onClick={onFollow} data-mais-follow>+ Follow</button>
        {podeEscrever && <button type="button" className="pl-btn" onClick={() => setNovaLig(v => (v ? '' : 'avulsa'))} aria-expanded={!!novaLig} data-agendar-ligacao>+ Ligação</button>}
        {podeEscrever && <button type="button" className="pl-btn" onClick={() => campo.current?.focus()} data-mais-nota>+ Nota</button>}
      </div>

      {podeEscrever && novaLig && lig && (
        <div className="lg-pn-novo" data-nova-ligacao>
          <div className="fn-seg" role="group" aria-label="Tipo de ligação">
            <button type="button" className={novaLig === 'avulsa' ? 'ativo' : ''} onClick={() => setNovaLig('avulsa')}>Avulsa</button>
            {lig.cadencias.length > 0 && <button type="button" className={novaLig === 'cadencia' ? 'ativo' : ''} onClick={() => setNovaLig('cadencia')} data-iniciar-cadencia>Cadência</button>}
          </div>
          {novaLig === 'avulsa' ? (
            <>
              <input className="pl-input" type="datetime-local" value={quando} onChange={e => setQuando(e.target.value)} aria-label="Quando ligar" data-ligacao-quando />
              <input className="pl-input" placeholder="O que falar (opcional)" value={instrucao} maxLength={1000} onChange={e => setInstrucao(e.target.value)} aria-label="O que falar" />
            </>
          ) : (
            <select className="pl-select" value={cadenciaId} onChange={e => setCadenciaId(e.target.value)} aria-label="Cadência" data-ligacao-cadencia>
              <option value="">Escolha a cadência</option>
              {lig.cadencias.map(c => <option key={c.id} value={c.id}>{c.nome} · {c.passos} ligaç{c.passos > 1 ? 'ões' : 'ão'}</option>)}
            </select>
          )}
          <button type="button" className="pl-btn pl-btn-primary" onClick={() => void agendarLigacao()} data-ligacao-confirmar>{novaLig === 'avulsa' ? 'Agendar' : 'Iniciar'}</button>
          <button type="button" className="pl-btn pl-btn-ghost" onClick={() => { setNovaLig(''); setErro('') }}>Cancelar</button>
        </div>
      )}

      {podeEscrever && (
        <div className="pl-pn-nota-nova" data-notas-lead>
          <textarea ref={campo} className="pl-input" rows={2} maxLength={4000} placeholder="Nota da negociação: o que foi combinado, o que o cliente pediu, o que falta…" value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={comAtalho(() => void salvarNota())} aria-label="Nova nota da negociação" data-nota-campo />
          <div className="pl-pn-nota-barra">
            <span className="pl-hint">Ctrl + Enter salva</span>
            <button type="button" className="pl-btn pl-btn-primary" disabled={!texto.trim() || salvando} onClick={() => void salvarNota()} data-nota-salvar>{salvando && !editando ? 'Salvando…' : 'Salvar nota'}</button>
          </div>
        </div>
      )}
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}

      {(notas === null || lig === null) && !erro ? <p className="pl-hint">Carregando…</p> : itens.length === 0 ? <p className="pl-hint">Nenhuma atividade ainda.</p> : (
        <ol className="pn-ativ-lista" data-lista-atividades>
          {itens.map(it => {
            if (it.tipo === 'follow') {
              const s = situacaoFollow(it.f)
              return (
                <li key={`f${it.f.id}`} className={`pn-ativ-item ${s.tipo.toLowerCase()}`} data-item="follow">
                  <span className="pn-ativ-tipo">{it.f.tipo === 'CREDITO' ? 'Nova análise' : 'Follow'}</span>
                  <button type="button" className="pn-ativ-txt pl-link-action" onClick={onFollow} data-selo-follow={it.f.tipo ?? 'CONTATO'}>{s.texto}{it.f.tipo !== 'CREDITO' && it.f.nota ? ` · ${it.f.nota}` : ''}</button>
                </li>
              )
            }
            if (it.tipo === 'atividade') return (
              <li key={`a${it.a.id}`} className="pn-ativ-item" data-item="atividade">
                <span className="pn-ativ-tipo">Atividade</span>
                <span className="pn-ativ-txt">{it.a.nota ?? 'Atividade da etapa'} · {dataHora(it.a.agendadoPara)}</span>
              </li>
            )
            if (it.tipo === 'ligacao') {
              const l = it.l
              if (l.status === 'PENDENTE') {
                const q = quandoLigar(l.agendadaPara)
                return (
                  <li key={`l${l.id}`} className={`pn-ativ-item ${q.atrasada ? 'atrasado' : ''}`} data-item="ligacao" data-proxima-ligacao>
                    <span className="pn-ativ-tipo">Ligação</span>
                    <span className="pn-ativ-txt"><b className={q.atrasada ? 'lg-quando atrasada' : 'lg-quando'}>{q.texto}</b> · {rotuloPasso(l)}{l.instrucao ? ` · ${l.instrucao}` : ''}</span>
                    {podeEscrever && (
                      <span className="lg-item-acoes">
                        <BotaoLigar ligacao={l} telefone={telefone} onDiscou={x => setLig(d => d && { ...d, ligacoes: d.ligacoes.map(y => (y.id === x.id ? { ...y, ...x } : y)) })} />
                        <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setRegistrando(l)} data-registrar>Registrar</button>
                      </span>
                    )}
                  </li>
                )
              }
              return (
                <li key={`l${l.id}`} className="pn-ativ-item" data-item="ligacao" data-ligacao-feita={l.resultado ?? ''}>
                  <span className="pn-ativ-tipo">Ligação</span>
                  <span className="pn-ativ-txt"><b>{l.resultado ? RESULTADO[l.resultado] : 'Feita'}</b>{l.resultado === 'ATENDEU' ? ` · ${duracao(l.duracaoSeg)}` : ''} · {l.registradaEm ? dataHora(l.registradaEm) : ''}{l.registradaPor ? ` · ${l.registradaPor}` : ''}{l.resumo ? <><br />{l.resumo}</> : null}</span>
                  {vejaAlertas && l.alertas.length > 0 && <span className="lg-alertas">{l.alertas.map(a => <span key={a} className={`lg-alerta ${a === 'ATRASADA' ? 'leve' : ''}`} title={ALERTA[a].explica}>{ALERTA[a].rotulo}</span>)}</span>}
                </li>
              )
            }
            const n = it.n
            return (
              <li key={`n${n.id}`} className="pn-ativ-item" data-item="nota" data-nota={n.id}>
                <span className="pn-ativ-tipo">Nota</span>
                <span className="pn-ativ-txt">
                  <span className="pl-hint">{n.autorNome ?? 'Equipe'} · {dataHora(n.criadoEm)}{editada(n) ? ' · editada' : ''}</span>
                  {editando?.id === n.id ? (
                    <>
                      <textarea className="pl-input" rows={3} maxLength={4000} autoFocus value={editando.texto} onChange={e => setEditando({ id: n.id, texto: e.target.value })} onKeyDown={comAtalho(() => void salvarEdicao())} aria-label="Editar nota" />
                      <span className="pl-pn-nota-acoes">
                        <button type="button" className="pl-btn pl-btn-primary" disabled={!editando.texto.trim() || salvando} onClick={() => void salvarEdicao()}>Salvar</button>
                        <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
                      </span>
                    </>
                  ) : <span className="pn-ativ-nota">{n.texto}</span>}
                  {podeEscrever && n.podeEditar && editando?.id !== n.id && (
                    <span className="pl-pn-nota-acoes">
                      <button type="button" className="pl-link-action" onClick={() => setEditando({ id: n.id, texto: n.texto })}>Editar</button>
                      <button type="button" className="pl-link-action pl-as-perigo" onClick={() => void apagar(n)}>Apagar</button>
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      {registrando && <RegistrarLigacao ligacao={registrando} nomeCliente={nomeCliente} onFechar={() => setRegistrando(null)} onRegistrou={() => { setRegistrando(null); setVersao(v => v + 1); onLigacoesMudaram() }} />}
    </div>
  )
}
