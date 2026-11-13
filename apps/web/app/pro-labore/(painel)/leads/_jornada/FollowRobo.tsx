'use client'

// Follow pelo robô (Ajuste 3): o vendedor escolhe a cadência para um ou
// vários clientes. Mostra as mensagens de cada passo (dá para ajustar o
// texto para este envio), quando começa e, no fim, quem ficou de fora e por quê.
import { useEffect, useState } from 'react'
import { proLaboreApi, type CadenciaRobo, type PassoCadenciaRobo } from '@/lib/proLaboreApi'

const MIDIA: Record<PassoCadenciaRobo['midia'], string> = { NENHUMA: 'só texto', FOTO_MOTO: 'com foto da moto', VIDEO_MOTO: 'com vídeo da moto', IMAGEM: 'com imagem' }
const hojeLocal = () => { const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16) }

export function FollowRoboModal({ leads, fechar, aoAplicar }: { leads: Array<{ id: string; nome: string }>; fechar: () => void; aoAplicar: () => void }) {
  const [cadencias, setCadencias] = useState<CadenciaRobo[] | null>(null)
  const [escolhida, setEscolhida] = useState<string>('')
  const [passos, setPassos] = useState<PassoCadenciaRobo[]>([])
  const [inicio, setInicio] = useState(hojeLocal())
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ aplicados: number; foraDela: Array<{ nome: string; motivo: string }> } | null>(null)
  useEffect(() => {
    proLaboreApi.jornada.cadencias().then(l => { setCadencias(l); if (l[0]) { setEscolhida(l[0].id); setPassos(l[0].passos) } }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar as cadências'))
  }, [])
  const escolher = (id: string) => { setEscolhida(id); setPassos(cadencias?.find(c => c.id === id)?.passos ?? []) }
  async function aplicar() {
    setEnviando(true); setErro(null)
    try {
      const r = await proLaboreApi.jornada.aplicarCadencia(leads.map(l => l.id), escolhida, new Date(inicio).toISOString(), passos)
      setResultado({ aplicados: r.aplicados, foraDela: r.resultados.filter(x => !x.ok).map(x => ({ nome: leads.find(l => l.id === x.leadId)?.nome ?? x.leadId, motivo: x.motivo ?? '' })) })
      aoAplicar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível') } finally { setEnviando(false) }
  }
  return (
    <div className="pl-modal-backdrop" role="dialog" aria-modal="true" aria-label="Follow pelo robô" onClick={fechar} data-modal-follow-robo>
      <div className="pl-card pl-modal-panel fr-painel" onClick={e => e.stopPropagation()}>
        <div className="pl-card-title">Follow pelo robô</div>
        <div className="pl-card-sub">{leads.length === 1 ? leads[0].nome : `${leads.length} clientes selecionados`} · o robô manda as mensagens no WhatsApp e para sozinho quando o cliente responde (você é avisado).</div>
        {resultado ? (
          <div className="fr-resultado" data-resultado-cadencia>
            <p><b>{resultado.aplicados}</b> {resultado.aplicados === 1 ? 'cliente recebeu' : 'clientes receberam'} a cadência.</p>
            {resultado.foraDela.length > 0 && <><p className="pl-hint">Ficaram de fora:</p><ul>{resultado.foraDela.map(f => <li key={f.nome}><b>{f.nome}</b>: {f.motivo}</li>)}</ul></>}
            <button type="button" className="pl-btn pl-btn-primary" onClick={fechar}>Fechar</button>
          </div>
        ) : !cadencias ? <p className="pl-hint">{erro ?? 'Carregando…'}</p> : (
          <>
            <div className="fr-opcoes" role="radiogroup" aria-label="Cadência">
              {cadencias.map(c => (
                <label key={c.id} className={`fr-opcao ${escolhida === c.id ? 'ativa' : ''}`} data-cadencia={c.id}>
                  <input type="radio" name="cadencia" checked={escolhida === c.id} onChange={() => escolher(c.id)} />
                  <span><b>{c.nome}</b><small>{c.descricao}</small></span>
                </label>
              ))}
            </div>
            <div className="fr-passos">
              {passos.map((p, i) => (
                <div key={i} className="fr-passo">
                  <div className="fr-passo-cab"><b>Dia {p.dias}</b><span className="pl-hint">{MIDIA[p.midia]}</span></div>
                  <textarea className="pl-input" rows={2} value={p.texto} onChange={e => setPassos(ps => ps.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))} aria-label={`Mensagem do dia ${p.dias}`} />
                </div>
              ))}
              <p className="pl-hint" style={{ margin: 0 }}>{'{nome}'} vira o primeiro nome do cliente e {'{moto}'} a moto de interesse.</p>
            </div>
            <label className="fr-inicio"><span className="pl-hint">Começa em</span><input className="pl-input" type="datetime-local" value={inicio} onChange={e => setInicio(e.target.value)} /></label>
            <p className="pl-hint" style={{ margin: '6px 0 12px' }}>Regras: só quem já conversou no WhatsApp, no máximo 1 mensagem por dia por cliente, no horário da loja (segunda a sábado). Se o cliente pedir para parar, nunca mais recebe.</p>
            {erro && <div className="pl-alert" role="alert">{erro}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={fechar}>Cancelar</button>
              <button type="button" className="pl-btn pl-btn-primary" disabled={enviando || !escolhida} onClick={() => void aplicar()} data-aplicar-cadencia>{enviando ? 'Ligando…' : `Ligar o follow${leads.length > 1 ? ` (${leads.length})` : ''}`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Situação do robô e da cadência no card e no painel. */
export function SeloRobo({ lead }: { lead: { preVenda?: { robo: { codigo: string; texto: string } | null; cadencia: { status: string; texto: string; proximoEm: string | null } | null } | null } }) {
  const pv = lead.preVenda
  if (!pv || (!pv.robo && !pv.cadencia)) return null
  const quando = pv.cadencia?.proximoEm ? new Date(pv.cadencia.proximoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null
  return (
    <div className="fr-selos" data-selo-robo>
      {pv.robo && <span className={`fr-selo fr-${pv.robo.codigo.toLowerCase()}`} title={pv.robo.texto} data-robo={pv.robo.codigo}>🤖 {pv.robo.texto}</span>}
      {pv.cadencia && <span className={`fr-selo fr-cad-${pv.cadencia.status.toLowerCase()}`} title={quando ? `${pv.cadencia.texto} · próximo ${quando}` : pv.cadencia.texto} data-cadencia-status={pv.cadencia.status}>↻ {pv.cadencia.texto}{quando ? ` · ${quando}` : ''}</span>}
    </div>
  )
}
