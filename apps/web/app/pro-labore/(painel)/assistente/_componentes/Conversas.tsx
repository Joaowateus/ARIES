'use client'

import Link from 'next/link'
import { Fragment, useEffect, useRef, useState } from 'react'
import { proLaboreApi, urlArquivoApi, type AcaoConversaAssistente, type AssistenteConversa, type AssistenteConversaDetalhe, type StatusConversaAssistente, type TipoConversaAssistente } from '@/lib/proLaboreApi'
import { ORIGEM, RESULTADO, ROTULO_ESTAGIO, STATUS_CONVERSA, fmtTelefone, horaCurta, iniciais, tempoRelativo } from './util'
import { ChipNota, NotaDoLead, SugestoesConversa } from './SugestoesConversa'
import { BotaoEnviarMoto } from './EnviarMoto'
import { EtiquetasLead } from './jornada'

const ATUALIZAR_MS = 8000

const FILTROS: Array<{ valor: StatusConversaAssistente | ''; rotulo: string }> = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'AGUARDANDO_VENDEDOR', rotulo: 'Esperando você' },
  { valor: 'ATIVA', rotulo: 'Com o assistente' },
  { valor: 'ASSUMIDA', rotulo: 'Com o vendedor' },
  { valor: 'ENCERRADA', rotulo: 'Encerradas' },
]

// Negrito do WhatsApp (*texto*) e quebras de linha.
function TextoWhats({ texto }: { texto: string }) {
  const partes = texto.split(/(\*[^*\n]+\*)/g)
  return <>{partes.map((p, i) => (p.startsWith('*') && p.endsWith('*') && p.length > 2 ? <b key={i}>{p.slice(1, -1)}</b> : <Fragment key={i}>{p}</Fragment>))}</>
}

function useRelogio(ms: number): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), ms)
    return () => clearInterval(id)
  }, [ms])
  return tick
}

export function Conversas({ vendedorId, conectado, nomeVendedor, focoInicial, onMudou }: {
  vendedorId?: string
  conectado: boolean
  nomeVendedor: string
  focoInicial?: StatusConversaAssistente | ''
  onMudou?: () => void
}) {
  const [tipo, setTipo] = useState<TipoConversaAssistente>('LEAD')
  const [status, setStatus] = useState<StatusConversaAssistente | ''>(focoInicial ?? '')
  const [buscaDigitada, setBuscaDigitada] = useState('')
  const [busca, setBusca] = useState('')
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null)
  const [lista, setLista] = useState<{ chave: string; itens: AssistenteConversa[] } | null>(null)
  const [detalhe, setDetalhe] = useState<{ chave: string; conversa: AssistenteConversaDetalhe } | null>(null)
  const [texto, setTexto] = useState('')
  // Resposta da base escolhida nas sugestões (conta no placar dela, mesmo editada).
  const [conhecimentoId, setConhecimentoId] = useState<string | undefined>()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)
  const tick = useRelogio(ATUALIZAR_MS)
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setBusca(buscaDigitada.trim()), 300)
    return () => clearTimeout(t)
  }, [buscaDigitada])

  const filtroEfetivo = tipo === 'SUPORTE' ? '' : status
  const chaveLista = `${vendedorId}|${tipo}|${filtroEfetivo}|${busca}`
  useEffect(() => {
    let cancelado = false
    proLaboreApi.assistente.conversas({ vendedorId, tipo, status: filtroEfetivo || undefined, busca: busca || undefined })
      .then(itens => { if (!cancelado) setLista({ chave: chaveLista, itens }) })
      .catch(() => { if (!cancelado) setLista(l => l ?? { chave: chaveLista, itens: [] }) })
    return () => { cancelado = true }
  }, [chaveLista, vendedorId, tipo, filtroEfetivo, busca, tick, versao])

  const itens = lista?.itens ?? []
  const idAberto = selecionadaId ?? (tipo === 'SUPORTE' ? itens[0]?.id ?? null : null)

  useEffect(() => {
    if (!idAberto) return
    let cancelado = false
    proLaboreApi.assistente.conversa(idAberto)
      .then(conversa => { if (!cancelado) setDetalhe({ chave: idAberto, conversa }) })
      .catch(() => undefined)
    return () => { cancelado = true }
  }, [idAberto, tick, versao])

  const conversa = detalhe && detalhe.chave === idAberto ? detalhe.conversa : null
  const qtdMensagens = conversa?.mensagens.length ?? 0
  useEffect(() => {
    // Rola só a caixa da conversa (não a página) até a última mensagem.
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [idAberto, qtdMensagens])

  async function enviar() {
    if (!conversa || !texto.trim()) return
    setEnviando(true)
    setErro('')
    try {
      await proLaboreApi.assistente.enviar(conversa.id, texto.trim(), conhecimentoId)
      setTexto('')
      setConhecimentoId(undefined)
      setVersao(v => v + 1)
      onMudou?.()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  async function enviarMoto(motoId: string) {
    if (!conversa) return
    setErro('')
    try {
      await proLaboreApi.assistente.enviarMoto(conversa.id, motoId)
      setVersao(v => v + 1)
      onMudou?.()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function executar(acao: AcaoConversaAssistente) {
    if (!conversa) return
    if (acao === 'NAO_E_LEAD' && !confirm('Marcar como "não é lead"? A conversa é encerrada e o assistente nunca mais responde esse número.')) return
    setErro('')
    try {
      await proLaboreApi.assistente.acao(conversa.id, acao)
      setVersao(v => v + 1)
      onMudou?.()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  const carregandoLista = !lista || lista.chave !== chaveLista

  return (
    <div className="pl-as-conversas">
      <div className="pl-card pl-as-lista">
        <div className="pl-as-lista-topo">
          <div className="pl-sv-tabs" role="tablist" aria-label="Tipo de conversa">
            {(['LEAD', 'SUPORTE'] as const).map(t => (
              <button key={t} type="button" role="tab" aria-selected={tipo === t} className={tipo === t ? 'ativo' : ''} onClick={() => { setTipo(t); setSelecionadaId(null) }}>
                {t === 'LEAD' ? 'Leads' : 'Suporte ao vendedor'}
              </button>
            ))}
          </div>
          {tipo === 'LEAD' && (
            <>
              <input className="pl-input" type="search" placeholder="Buscar nome ou número" value={buscaDigitada} onChange={e => setBuscaDigitada(e.target.value)} aria-label="Buscar conversa" />
              <div className="pl-as-filtros">
                {FILTROS.map(f => (
                  <button key={f.valor} type="button" className={`pl-chip ${status === f.valor ? 'active' : ''}`} onClick={() => { setStatus(f.valor); setSelecionadaId(null) }}>{f.rotulo}</button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className={`pl-as-lista-itens ${carregandoLista && lista ? 'recarregando' : ''}`}>
          {!lista ? <div className="pl-hint" style={{ padding: 16 }}>Carregando…</div> : itens.length === 0 ? (
            <div className="pl-empty" style={{ padding: '28px 12px' }}>
              {tipo === 'SUPORTE'
                ? <>Nenhum comando ainda. No WhatsApp, abra a conversa com você mesmo (“Você”) e mande <b>menu</b>.</>
                : busca || status ? 'Nenhuma conversa com esse filtro.' : 'Nenhum lead atendido ainda. Quando alguém novo chamar no WhatsApp, a conversa aparece aqui.'}
            </div>
          ) : (
            <div className="pl-chat-list">
              {itens.map(c => (
                <button key={c.id} type="button" className={`pl-chat-item ${idAberto === c.id ? 'active' : ''}`} onClick={() => { setSelecionadaId(c.id); setTexto(''); setConhecimentoId(undefined) }}>
                  <div className="pl-chat-item-avatar">{tipo === 'SUPORTE' ? '🤖' : iniciais(c.nomeContato)}</div>
                  <div className="pl-chat-item-body">
                    <div className="pl-chat-item-top">
                      <span className="pl-chat-item-name">{tipo === 'SUPORTE' ? 'Comandos no chat “Você”' : c.nomeContato}</span>
                      <span className="pl-chat-item-time">{tempoRelativo(c.ultimaMensagemEm)}</span>
                    </div>
                    <div className="pl-chat-item-snippet">{c.mensagens[0]?.texto.replace(/\*/g, '') ?? '—'}</div>
                    {tipo === 'LEAD' && (
                      <div className="pl-as-item-tags">
                        <span className={`pl-status-badge ${STATUS_CONVERSA[c.status].classe}`}>{STATUS_CONVERSA[c.status].rotulo}</span>
                        {typeof c.nota === 'number' && <ChipNota nota={c.nota} />}
                        {c.lead && <span className="pl-as-tag">No CRM</span>}
                        {c.robo === false && <span className="pl-as-tag" title="Entrou pelo cadastro automático sem o robô responder">Sem robô</span>}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`pl-card pl-as-chat ${idAberto ? 'aberto' : ''}`}>
        {!idAberto ? (
          <div className="pl-empty" style={{ margin: 'auto' }}>
            <div className="pl-emoji">💬</div>
            Escolha uma conversa pra ver o histórico, as respostas do roteiro e responder.
          </div>
        ) : !conversa ? <div className="pl-hint" style={{ padding: 16 }}>Carregando conversa…</div> : (
          <>
            <div className="pl-as-chat-topo">
              <button type="button" className="pl-btn pl-btn-ghost pl-as-voltar" onClick={() => setSelecionadaId(null)} aria-label="Voltar pra lista">←</button>
              <div className="pl-chat-item-avatar" style={{ width: 40, height: 40, flex: 'none' }}>{conversa.tipo === 'SUPORTE' ? '🤖' : iniciais(conversa.nomeContato)}</div>
              <div className="pl-as-chat-nome">
                <div className="pl-card-title">{conversa.tipo === 'SUPORTE' ? `Suporte — ${nomeVendedor}` : conversa.nomeContato}</div>
                <div className="pl-card-sub">
                  {conversa.tipo === 'LEAD'
                    ? <><a href={`https://wa.me/${conversa.numeroContato}`} target="_blank" rel="noreferrer" className="pl-mono">{fmtTelefone(conversa.numeroContato)}</a>{conversa.origem && <> · {ORIGEM[conversa.origem].rotulo}</>} · desde {horaCurta(conversa.criadoEm)}</>
                    : 'Comandos que o vendedor mandou no chat “Você” e as respostas do assistente'}
                </div>
              </div>
              {conversa.tipo === 'LEAD' && <span className={`pl-status-badge ${STATUS_CONVERSA[conversa.status].classe}`}>{STATUS_CONVERSA[conversa.status].rotulo}</span>}
            </div>

            {conversa.tipo === 'LEAD' && (
              <div className="pl-as-chat-acoes">
                {conversa.status === 'ATIVA' && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => executar('ASSUMIR')}>Assumir conversa</button>}
                {conversa.status === 'AGUARDANDO_VENDEDOR' && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => executar('ASSUMIR')}>Marcar como assumida</button>}
                {conversa.status === 'ASSUMIDA' && !conversa.resultado && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => executar('DEVOLVER')}>Devolver pro assistente</button>}
                {conversa.lead
                  ? <Link href="/pro-labore/leads" className="pl-btn pl-btn-ghost">No CRM: {ROTULO_ESTAGIO[conversa.lead.estagio] ?? conversa.lead.estagio} →</Link>
                  : conversa.status !== 'ENCERRADA' && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => executar('CRIAR_LEAD')}>Criar lead no CRM</button>}
                {conversa.status !== 'ENCERRADA' && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => executar('ENCERRAR')}>Encerrar</button>}
                {conversa.status !== 'ENCERRADA' && <button type="button" className="pl-btn pl-btn-ghost pl-as-perigo" onClick={() => executar('NAO_E_LEAD')}>Não é lead</button>}
                {conversa.status !== 'ENCERRADA' && conectado && <BotaoEnviarMoto key={conversa.id} onEnviar={enviarMoto} />}
              </div>
            )}

            <div className="pl-as-chat-corpo">
              <div className="pl-as-thread" aria-live="polite" ref={threadRef}>
                {conversa.mensagens.map(m => {
                  const lado = m.remetente === 'CONTATO' ? (conversa.tipo === 'SUPORTE' ? 'vendedor' : 'contato') : m.remetente === 'ASSISTENTE' ? 'assistente' : 'vendedor'
                  const direita = conversa.tipo === 'SUPORTE' ? m.remetente === 'CONTATO' : m.remetente !== 'CONTATO'
                  return (
                    <div key={m.id} className={`pl-as-bolha-linha ${direita ? 'direita' : ''}`}>
                      <div className={`pl-as-bolha ${lado}`}>
                        {m.remetente !== 'CONTATO' && conversa.tipo === 'LEAD' && <span className="pl-as-bolha-autor">{m.remetente === 'ASSISTENTE' ? (m.origem === 'FOLLOW' ? 'Follow automático' : 'Assistente') : nomeVendedor}</span>}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {m.midiaUrl && <img className="pl-as-bolha-foto" src={urlArquivoApi(m.midiaUrl)} alt="Foto enviada" loading="lazy" />}
                        {!(m.midiaUrl && m.texto === '[imagem]') && <div className="pl-as-bolha-texto"><TextoWhats texto={m.texto} /></div>}
                        <span className="pl-as-bolha-hora">{horaCurta(m.criadoEm)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {conversa.tipo === 'LEAD' && (
                <aside className="pl-as-respostas">
                  <NotaDoLead nota={conversa.nota} sinais={conversa.sinais} />
                  {(conversa.lead?.etiquetas?.length ?? 0) > 0 && (
                    <div className="pl-as-etiquetas-quadro">
                      <div className="pl-as-subtitulo">Etiquetas</div>
                      <EtiquetasLead etiquetas={conversa.lead!.etiquetas} />
                    </div>
                  )}
                  <div className="pl-as-subtitulo">Respostas do roteiro</div>
                  {conversa.resultado && <div className="pl-as-resultado">{RESULTADO[conversa.resultado]}</div>}
                  {!conversa.resultado && conversa.totalPerguntas > 0 && (
                    <div className="pl-sv-meter" style={{ margin: '4px 0 10px' }} aria-label={`${Math.min(conversa.etapaRoteiro, conversa.totalPerguntas)} de ${conversa.totalPerguntas} perguntas`}>
                      <span style={{ width: `${(Math.min(conversa.etapaRoteiro, conversa.totalPerguntas) / conversa.totalPerguntas) * 100}%` }} />
                    </div>
                  )}
                  {conversa.resumo.length === 0
                    ? <div className="pl-hint" style={{ fontSize: 12 }}>Ainda sem respostas.</div>
                    : (
                      <dl className="pl-as-dl">
                        {conversa.resumo.map(l => (
                          <Fragment key={l.rotulo}><dt>{l.rotulo}</dt><dd>{l.valor}</dd></Fragment>
                        ))}
                      </dl>
                    )}
                  {conversa.status === 'ASSUMIDA' && (
                    <div className="pl-as-follow-quadro" data-follow-conversa>
                      <div className="pl-as-subtitulo">Follow automático</div>
                      {conversa.followParado === 'PEDIU_PARAR' ? <div className="pl-hint">O cliente pediu para parar: não recebe mais.</div>
                        : conversa.followParado === 'VENDEDOR' ? (
                          <><div className="pl-hint">Parado nesta conversa.</div><button type="button" className="pl-vt-link" onClick={() => executar('RETOMAR_FOLLOW')} data-retomar-follow>Retomar</button></>
                        ) : (
                          <><div className="pl-hint">{conversa.followPasso ? `${conversa.followPasso} enviado${conversa.followPasso > 1 ? 's' : ''} desde a última resposta.` : 'Nenhum enviado desde a última resposta.'}</div><button type="button" className="pl-vt-link" onClick={() => executar('PARAR_FOLLOW')} data-parar-follow>Parar nesta conversa</button></>
                        )}
                    </div>
                  )}
                  {conversa.assumidaEm && conversa.aguardandoVendedorEm && (
                    <div className="pl-hint" style={{ fontSize: 11.5, marginTop: 10 }}>
                      Respondido {Math.max(0, Math.round((new Date(conversa.assumidaEm).getTime() - new Date(conversa.aguardandoVendedorEm).getTime()) / 60_000))} min depois de ficar pronto.
                    </div>
                  )}
                </aside>
              )}
            </div>

            {erro && <div className="pl-alert pl-alert-error" style={{ margin: '0 16px 10px' }}>{erro}</div>}
            {conversa.tipo === 'LEAD' && conversa.status !== 'ENCERRADA' && conectado && (
              <SugestoesConversa conversaId={conversa.id} versao={qtdMensagens} onUsar={(t, id) => { setTexto(t); setConhecimentoId(id) }} onEnviarMoto={enviarMoto} />
            )}
            {conversa.status !== 'ENCERRADA' && (
              <form className="pl-as-composer" onSubmit={e => { e.preventDefault(); enviar() }}>
                <textarea
                  className="pl-input pl-textarea"
                  rows={2}
                  placeholder={conectado ? (conversa.tipo === 'LEAD' ? `Responder como ${nomeVendedor} (sai pelo WhatsApp dele) — Ctrl+Enter envia` : 'Mandar mensagem no chat “Você”') : 'WhatsApp desconectado — reconecte pra responder por aqui'}
                  value={texto}
                  disabled={!conectado || enviando}
                  onChange={e => { setTexto(e.target.value); if (!e.target.value.trim()) setConhecimentoId(undefined) }}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); enviar() } }}
                />
                <button type="submit" className="pl-btn pl-btn-primary" disabled={!conectado || enviando || !texto.trim()}>{enviando ? 'Enviando…' : 'Enviar'}</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
