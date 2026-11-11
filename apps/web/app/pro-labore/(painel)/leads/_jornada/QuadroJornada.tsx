'use client'

// Quadro do CRM na jornada de 10 etapas (PDF 01, seção 7): colunas em três
// fases, tempo do lead na etapa, mover só com o critério cumprido (a tela
// mostra o que falta), levantamento e perda pelo motivo da etapa.
import { useEffect, useState } from 'react'
import { proLaboreApi, type Lead, type EtapaJornada, type ErroApi, type PremissasJornada } from '@/lib/proLaboreApi'
import { ETAPAS_JORNADA, FASES, NOME_ETAPA, NOME_MOTIVO, NOME_DESTINO } from '@/lib/etapasJornada'

const MS_HORA = 3_600_000
function tempoNaEtapa(l: Lead) {
  const desde = l.entrouNaEtapaEm ?? l.criadoEm
  const h = Math.max(0, (Date.now() - new Date(desde).getTime()) / MS_HORA)
  if (h < 1) { const m = Math.floor(h * 60); return m < 1 ? 'agora' : `${m} min` }
  if (h < 24) return `${Math.floor(h)} h`
  const d = Math.floor(h / 24)
  return d === 1 ? '1 dia' : `${d} dias`
}
const MS: Record<string, number> = { MINUTOS: 60_000, HORAS: MS_HORA, DIAS: 24 * MS_HORA }
const UN: Record<string, string> = { MINUTOS: 'min', HORAS: 'h', DIAS: 'd' }
/** Passou do tempo máximo da etapa (Metas e premissas)? */
function estourou(l: Lead, p: PremissasJornada | null) {
  const t = p?.temposMaximos[(l.etapa ?? 'LEAD') as EtapaJornada]
  if (!t || t.valor == null) return null
  const desde = new Date(l.entrouNaEtapaEm ?? l.criadoEm).getTime()
  return { parado: Date.now() - desde > t.valor * MS[t.unidade], max: `${t.valor} ${UN[t.unidade]}` }
}
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

interface Props {
  leads: Lead[]
  vejaEquipe: boolean
  onAbrir: (id: string) => void
  onAtualizar: () => void
  onRegistrarVenda: (lead: Lead) => void
  extraBarra?: React.ReactNode
}

type Aviso = { lead: Lead; destino: EtapaJornada; faltando: string[] } | null

export function QuadroJornada({ leads, vejaEquipe, onAbrir, onAtualizar, onRegistrarVenda, extraBarra }: Props) {
  const [fase, setFase] = useState<'TUDO' | 'PRE_VENDA' | 'VENDA' | 'FECHAMENTO'>(() => {
    const e = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('etapa')
    return FASES.find(x => (x.etapas as string[]).includes(e ?? ''))?.id ?? 'TUDO'
  })
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<EtapaJornada | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [levantamento, setLevantamento] = useState<Lead | null>(null)
  const [perda, setPerda] = useState<{ lead: Lead; motivos: string[] } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [premissas, setPremissas] = useState<PremissasJornada | null>(null)
  const [conversao, setConversao] = useState<Record<string, { chegaram: number; conversao: number | null }>>({})
  // Ajuste 1: o Painel do dono abre o CRM filtrado numa etapa (?etapa=): mostra a fase dela e leva até a coluna.
  const [destaque] = useState<EtapaJornada | null>(() => {
    const e = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('etapa') as EtapaJornada | null
    return e && ETAPAS_JORNADA.includes(e) ? e : null
  })
  useEffect(() => {
    if (!destaque) return
    const t = setTimeout(() => document.querySelector(`[data-coluna="${destaque}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }), 300)
    return () => clearTimeout(t)
  }, [destaque])
  useEffect(() => {
    proLaboreApi.jornada.premissas().then(setPremissas).catch(() => setPremissas(null))
    proLaboreApi.jornada.conversao().then(c => setConversao(Object.fromEntries(c.etapas.map(x => [x.etapa, x])))).catch(() => setConversao({}))
  }, [leads.length])

  const visiveis = FASES.filter(f => fase === 'TUDO' || f.id === fase)
  const porEtapa = (e: EtapaJornada) => leads.filter(l => (l.etapa ?? 'LEAD') === e)

  async function mover(lead: Lead, destino: EtapaJornada, contatoFora?: boolean) {
    if (destino === lead.etapa) return
    if (destino === 'VENDA') { onRegistrarVenda(lead); return }
    setOcupado(true); setErro(null)
    try {
      await proLaboreApi.jornada.mover(lead.id, destino, contatoFora)
      setAviso(null); onAtualizar()
    } catch (e) {
      const d = (e as ErroApi).dados as { faltando?: string[] } | undefined
      if ((e as ErroApi).status === 422 && d?.faltando?.length) setAviso({ lead, destino, faltando: d.faltando })
      else setErro(e instanceof Error ? e.message : 'Não foi possível mover')
    } finally { setOcupado(false) }
  }
  const proxima = (l: Lead): EtapaJornada | null => {
    const i = ETAPAS_JORNADA.indexOf((l.etapa ?? 'LEAD') as EtapaJornada)
    if (l.etapa === 'LEVANTAMENTO' && l.formaPagamento === 'A_VISTA') return 'NEGOCIACAO'
    return i >= 0 && i + 1 < ETAPAS_JORNADA.length ? ETAPAS_JORNADA[i + 1] : null
  }
  async function abrirPerda(lead: Lead) {
    try { const c = await proLaboreApi.jornada.checklist(lead.id); setPerda({ lead, motivos: c.motivos }) } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível abrir') }
  }

  return (
    <div data-quadro-jornada>
      <div className="pl-kanban-barra qj-barra">
        <div role="group" aria-label="Fases da jornada" className="qj-fases">
          {([['TUDO', 'Jornada inteira'], ...FASES.map(f => [f.id, f.nome])] as Array<[typeof fase, string]>).map(([id, nome]) => (
            <button key={id} type="button" className={`pl-chip ${fase === id ? 'active' : ''}`} aria-pressed={fase === id} onClick={() => setFase(id)} data-fase={id}>{nome}</button>
          ))}
        </div>
        <span className="pl-hint qj-dica" title="Só passa quando o critério da etapa está cumprido.">Clique no card para ver tudo do lead · arraste ou use “Avançar”</span>
        {extraBarra}
      </div>
      {erro && <div className="pl-alert" role="alert">{erro}</div>}
      <div className="qj-rola">
        <div className="qj-trilho">
          {visiveis.map(f => (
            <section key={f.id} data-fase-bloco={f.id} className="qj-fase" style={{ flexGrow: f.etapas.length }}>
              <div className="pl-eyebrow qj-fase-nome">{f.nome}</div>
              <div className="qj-colunas">
                {f.etapas.map(e => {
                  const i = ETAPAS_JORNADA.indexOf(e), cards = porEtapa(e)
                  const soma = cards.reduce((t, l) => t + (l.valorNegociacao || 0), 0)
                  return (
                    <div
                      key={e} data-coluna={e}
                      className={`pl-kanban-col ${sobre === e ? 'drop-active' : ''}`}
                      style={destaque === e ? { boxShadow: '0 0 0 2px var(--pl-border-strong)' } : undefined}
                      onDragOver={ev => { ev.preventDefault(); setSobre(e) }}
                      onDragLeave={() => setSobre(s => (s === e ? null : s))}
                      onDrop={ev => { ev.preventDefault(); setSobre(null); const l = leads.find(x => x.id === arrastando); if (l) void mover(l, e) }}
                    >
                      <div className="pl-kanban-col-head">
                        <div>
                          <div className="pl-kanban-col-title">{i + 1}. {NOME_ETAPA[e]}</div>
                          {e !== 'VENDA' && conversao[e]?.conversao != null && <div className="pl-kanban-col-hint" title={`Dos ${conversao[e].chegaram} leads que chegaram a esta etapa nos últimos 30 dias, quantos passaram à seguinte${e === 'MQL' || e === 'SQL' ? ' (sem os à vista)' : e === 'AGENDAMENTO' || e === 'VISITA' ? ' (sem as vendas sem visita)' : ''}`} data-conversao={e}>{conversao[e].conversao}% passam adiante · 30 dias</div>}
                        </div>
                        <div className="pl-kanban-col-lado">
                          <div className="pl-kanban-col-count pl-mono">{cards.length}</div>
                          {soma > 0 && <div className="pl-kanban-col-soma">{moeda(soma)}</div>}
                        </div>
                      </div>
                      <div className="pl-kanban-cards">
                        {cards.length === 0 && <div className="pl-kanban-empty">Nenhum lead nesta etapa</div>}
                        {cards.map(l => {
                          if (l.somenteLeitura) return (
                            <div key={l.id} className="pl-kanban-card pl-kc" data-card={l.id} data-somente-leitura title="Você passou este lead ao vendedor: aqui aparece só a etapa e o resultado">
                              <span className="pl-kanban-card-name pl-kc-nome">{l.nomeCliente}</span>
                              <div className="pl-hint">Passado a {l.vendedor?.nome ?? 'vendedor'} · {l.resultado === 'VENDIDO' ? 'vendido' : l.resultado === 'PERDIDO' ? 'perdido' : 'em andamento'}</div>
                            </div>
                          )
                          const prox = proxima(l)
                          const limite = estourou(l, premissas)
                          return (
                            <div
                              key={l.id} className="pl-kanban-card pl-kc" draggable data-card={l.id}
                              onDragStart={() => setArrastando(l.id)} onDragEnd={() => setArrastando(null)}
                              onClick={() => onAbrir(l.id)} style={{ cursor: 'pointer' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                                <span className="pl-kanban-card-name pl-kc-nome">{l.nomeCliente}</span>
                                <span className={`pl-kanban-card-time ${limite?.parado ? 'stale' : ''}`} title={limite ? `Tempo nesta etapa · máximo ${limite.max} (Metas e premissas)` : 'Tempo nesta etapa'} data-tempo-etapa={limite?.parado ? 'parado' : 'ok'}>{tempoNaEtapa(l)}{limite ? ` / ${limite.max}` : ''}</span>
                              </div>
                              {vejaEquipe && l.vendedor?.nome && <div className="pl-hint">{l.vendedor.nome}</div>}
                              <div className="qj-selos">
                                {l.revisarEtapa && <span className="pl-chip" title="Fechado sem venda confirmada na migração: posicione na etapa certa">revisar etapa</span>}
                                {l.formaPagamento === 'A_VISTA' && <span className="pl-chip">à vista</span>}
                                {l.formaPagamento === 'FINANCIADO' && <span className="pl-chip">financiado</span>}
                                {(e === 'LEVANTAMENTO' || e === 'ABORDADO') && !l.levantamentoCompleto && <span className="pl-chip">levantamento incompleto</span>}
                              </div>
                              <div className="qj-acoes" onClick={ev => ev.stopPropagation()}>
                                {prox && <button type="button" className="pl-btn pl-btn-ghost qj-avancar" disabled={ocupado} onClick={() => void mover(l, prox)} data-avancar title={prox === 'VENDA' ? 'Registrar venda' : `Avançar para ${NOME_ETAPA[prox]}`}>{prox === 'VENDA' ? 'Registrar venda' : `Avançar → ${NOME_ETAPA[prox]}`}</button>}
                                {['ABORDADO', 'LEVANTAMENTO'].includes(e) && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setLevantamento(l)} data-levantamento>Levantamento</button>}
                                {e !== 'VENDA' && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => void abrirPerda(l)} data-perda>Perdido</button>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {aviso && (
        <div className="pl-modal-backdrop" role="dialog" aria-modal="true" data-aviso-criterio onClick={() => setAviso(null)}>
          <div className="pl-modal-panel pl-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>Ainda não dá para mover para {NOME_ETAPA[aviso.destino]}</h3>
            <p className="pl-hint">{aviso.lead.nomeCliente} · falta:</p>
            <ul>{aviso.faltando.map(f => <li key={f}>{f}</li>)}</ul>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {aviso.faltando.some(f => /Confirme que você respondeu/.test(f)) && <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void mover(aviso.lead, aviso.destino, true)} data-confirmar-contato>Confirmo que respondi o cliente</button>}
              {aviso.faltando.some(f => /levantamento|coleta/i.test(f)) && <button type="button" className="pl-btn pl-btn-primary" onClick={() => { setLevantamento(aviso.lead); setAviso(null) }}>Preencher o levantamento</button>}
              <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setAviso(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
      {levantamento && <ModalLevantamento lead={levantamento} onFechar={() => setLevantamento(null)} onSalvo={() => { setLevantamento(null); onAtualizar() }} />}
      {perda && <ModalPerda lead={perda.lead} motivos={perda.motivos} onFechar={() => setPerda(null)} onSalvo={() => { setPerda(null); onAtualizar() }} />}
    </div>
  )
}

function ModalLevantamento({ lead, onFechar, onSalvo }: { lead: Lead; onFechar: () => void; onSalvo: () => void }) {
  const [modelo, setModelo] = useState(lead.modeloInteresse ?? '')
  const [pagamento, setPagamento] = useState(lead.formaPagamento ?? '')
  const [cnh, setCnh] = useState(lead.situacaoCnh ?? '')
  const [entrada, setEntrada] = useState(lead.temEntrada === true ? 'SIM' : lead.temEntrada === false ? 'NAO' : '')
  const [falta, setFalta] = useState<string[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(null)
    try {
      const c = await proLaboreApi.jornada.levantamento(lead.id, {
        modeloInteresse: modelo.trim() || null, formaPagamento: (pagamento || null) as 'A_VISTA' | 'FINANCIADO' | null,
        situacaoCnh: (cnh || null) as 'TEM' | 'EM_PROCESSO' | 'NAO_TEM' | null, temEntrada: entrada === '' ? null : entrada === 'SIM',
      })
      if (c.levantamentoFalta.length) setFalta(c.levantamentoFalta); else onSalvo()
    } catch (er) { setErro(er instanceof Error ? er.message : 'Não foi possível salvar') }
  }
  return (
    <div className="pl-modal-backdrop" role="dialog" aria-modal="true" data-modal-levantamento onClick={onFechar}>
      <form className="pl-modal-panel pl-card" onClick={e => e.stopPropagation()} onSubmit={salvar} style={{ maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>Levantamento · {lead.nomeCliente}</h3>
        <div className="pl-field"><label htmlFor="lv-modelo">Modelo de interesse</label><input id="lv-modelo" className="pl-input" value={modelo} onChange={e => setModelo(e.target.value)} /></div>
        <div className="pl-field"><label htmlFor="lv-pag">Forma de pagamento</label>
          <select id="lv-pag" className="pl-input" value={pagamento} onChange={e => setPagamento(e.target.value)}><option value="">Ainda não sabe</option><option value="FINANCIADO">Financiado</option><option value="A_VISTA">À vista</option></select></div>
        <div className="pl-field"><label htmlFor="lv-cnh">CNH</label>
          <select id="lv-cnh" className="pl-input" value={cnh} onChange={e => setCnh(e.target.value)}><option value="">Não informado</option><option value="TEM">Tem CNH</option><option value="EM_PROCESSO">Tirando</option><option value="NAO_TEM">Não tem</option></select></div>
        <div className="pl-field"><label htmlFor="lv-ent">Tem entrada?</label>
          <select id="lv-ent" className="pl-input" value={entrada} onChange={e => setEntrada(e.target.value)}><option value="">Não informado</option><option value="SIM">Sim</option><option value="NAO">Não</option></select></div>
        {falta && <p className="pl-hint" data-levantamento-falta>Salvo. Ainda falta: {falta.join(', ')}.</p>}
        {erro && <div className="pl-alert" role="alert">{erro}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="pl-btn pl-btn-primary">Salvar</button>
          <button type="button" className="pl-btn pl-btn-ghost" onClick={falta ? onSalvo : onFechar}>{falta ? 'Fechar' : 'Cancelar'}</button>
        </div>
      </form>
    </div>
  )
}

function ModalPerda({ lead, motivos, onFechar, onSalvo }: { lead: Lead; motivos: string[]; onFechar: () => void; onSalvo: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [nota, setNota] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!motivo) { setErro('Escolha o motivo'); return }
    try { await proLaboreApi.jornada.perda(lead.id, motivo, nota.trim() || undefined); onSalvo() } catch (er) { setErro(er instanceof Error ? er.message : 'Não foi possível registrar') }
  }
  return (
    <div className="pl-modal-backdrop" role="dialog" aria-modal="true" data-modal-perda onClick={onFechar}>
      <form className="pl-modal-panel pl-card" onClick={e => e.stopPropagation()} onSubmit={salvar} style={{ maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>Perdido · {lead.nomeCliente}</h3>
        <p className="pl-hint">Escolha o motivo. O destino (Reativação ou encerramento) o sistema aplica sozinho.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {motivos.map(m => (
            <label key={m} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="radio" name="motivo" value={m} checked={motivo === m} onChange={() => setMotivo(m)} />
              {NOME_MOTIVO[m] ?? m}{m === 'PEDIU_NAO_CONTATO' && <span className="pl-hint"> · bloqueia o cliente</span>}
            </label>
          ))}
        </div>
        <div className="pl-field" style={{ marginTop: 10 }}><label htmlFor="pd-nota">Observação (opcional)</label><textarea id="pd-nota" className="pl-input" value={nota} onChange={e => setNota(e.target.value)} rows={2} /></div>
        {erro && <div className="pl-alert" role="alert">{erro}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="pl-btn pl-btn-primary" data-confirmar-perda>Registrar perda</button>
          <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

export { NOME_DESTINO }
