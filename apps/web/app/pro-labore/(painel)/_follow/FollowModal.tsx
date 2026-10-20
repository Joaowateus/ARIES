'use client'

// Botão Follow do card: agenda quando retomar o contato com o cliente, por
// onde e o que falar. Com um follow pendente, dá para marcar como feito
// (com o resultado) e já agendar o próximo, reagendar ou cancelar.
import './follow.css'
import { useEffect, useState } from 'react'
import { proLaboreApi, type CanalFollow, type FollowLead, type NovoFollow } from '@/lib/proLaboreApi'
import { CANAL_FOLLOW, dataHoraBR, diaBR, isoBR, linkWhatsapp, situacaoFollow, somaDiasBR } from './follow'

const RAPIDOS: Array<{ rotulo: string; dias: number; hora: string }> = [
  { rotulo: 'Amanhã 9h', dias: 1, hora: '09:00' },
  { rotulo: 'Em 2 dias', dias: 2, hora: '10:00' },
  { rotulo: 'Em 3 dias', dias: 3, hora: '10:00' },
  { rotulo: 'Em 1 semana', dias: 7, hora: '10:00' },
  { rotulo: 'Em 15 dias', dias: 15, hora: '10:00' },
  { rotulo: 'Em 30 dias', dias: 30, hora: '10:00' },
]

function Agendador({ valor, onChange }: { valor: { dia: string; hora: string; canal: CanalFollow; nota: string }; onChange: (v: { dia: string; hora: string; canal: CanalFollow; nota: string }) => void }) {
  return (
    <div className="fw-agendar">
      <div className="fw-rapidos" role="group" aria-label="Atalhos de data">
        {RAPIDOS.map(r => {
          const dia = somaDiasBR(r.dias)
          const ativo = valor.dia === dia && valor.hora === r.hora
          return <button key={r.rotulo} type="button" className={`pl-chip ${ativo ? 'active' : ''}`} aria-pressed={ativo} onClick={() => onChange({ ...valor, dia, hora: r.hora })}>{r.rotulo}</button>
        })}
      </div>
      <div className="fw-linha">
        <div className="pl-field"><label htmlFor="fw-dia">Dia</label><input id="fw-dia" type="date" className="pl-input" value={valor.dia} min={diaBR(new Date())} onChange={e => onChange({ ...valor, dia: e.target.value })} required /></div>
        <div className="pl-field"><label htmlFor="fw-hora">Hora</label><input id="fw-hora" type="time" className="pl-input" value={valor.hora} onChange={e => onChange({ ...valor, hora: e.target.value })} required /></div>
      </div>
      <div className="pl-field">
        <label>Por onde</label>
        <div className="fw-rapidos" role="group" aria-label="Canal">
          {(Object.keys(CANAL_FOLLOW) as CanalFollow[]).map(c => <button key={c} type="button" className={`pl-chip ${valor.canal === c ? 'active' : ''}`} aria-pressed={valor.canal === c} onClick={() => onChange({ ...valor, canal: c })}>{CANAL_FOLLOW[c]}</button>)}
        </div>
      </div>
      <div className="pl-field"><label htmlFor="fw-nota">O que falar (opcional)</label><textarea id="fw-nota" className="pl-input" rows={2} maxLength={1000} value={valor.nota} onChange={e => onChange({ ...valor, nota: e.target.value })} placeholder="Ex.: mandar as fotos da moto e a simulação do financiamento" /></div>
    </div>
  )
}

const novoValor = () => ({ dia: somaDiasBR(1), hora: '09:00', canal: 'WHATSAPP' as CanalFollow, nota: '' })
const paraEnvio = (v: ReturnType<typeof novoValor>): NovoFollow => ({ agendadoPara: new Date(isoBR(v.dia, v.hora)).toISOString(), canal: v.canal, nota: v.nota.trim() || undefined })

export function FollowModal({ lead, pendente, onFechar, onMudou }: {
  lead: { id: string; nomeCliente: string; telefone?: string | null }
  pendente: FollowLead | null
  onFechar: () => void
  onMudou: () => void
}) {
  const [modo, setModo] = useState<'ver' | 'agendar' | 'feito'>(pendente ? 'ver' : 'agendar')
  const [valor, setValor] = useState(novoValor)
  const [resultado, setResultado] = useState('')
  const [agendarProximo, setAgendarProximo] = useState(true)
  const [historico, setHistorico] = useState<FollowLead[] | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const whats = linkWhatsapp(lead.telefone)

  useEffect(() => { proLaboreApi.follows.doLead(lead.id).then(h => setHistorico(h.filter(f => f.status !== 'PENDENTE').slice(0, 5))).catch(() => setHistorico([])) }, [lead.id])
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar])

  async function rodar(fn: () => Promise<unknown>) {
    setSalvando(true); setErro('')
    try { await fn(); onMudou(); onFechar() } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }
  const agendar = () => rodar(() => proLaboreApi.follows.agendar(lead.id, paraEnvio(valor)))
  const concluir = () => rodar(() => proLaboreApi.follows.encerrar(pendente!.id, { status: 'FEITO', resultado: resultado.trim() || undefined, proximo: agendarProximo ? paraEnvio(valor) : undefined }))
  const cancelar = () => rodar(() => proLaboreApi.follows.encerrar(pendente!.id, { status: 'CANCELADO' }))
  const sit = pendente ? situacaoFollow(pendente) : null

  return (
    <div className="pl-modal-backdrop" onClick={onFechar}>
      <div className="pl-card pl-modal-panel fw-janela" role="dialog" aria-modal="true" aria-labelledby="fw-titulo" onClick={e => e.stopPropagation()}>
        <div className="fw-cab">
          <div>
            <div className="pl-eyebrow">Follow</div>
            <h2 id="fw-titulo">{lead.nomeCliente}</h2>
          </div>
          <button type="button" className="fw-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        {pendente && sit && (
          <div className={`fw-pendente ${sit.tipo.toLowerCase()}`}>
            <b>{sit.texto}</b>
            <span>{pendente.canal ? CANAL_FOLLOW[pendente.canal] : 'Sem canal'}{pendente.nota ? ` · ${pendente.nota}` : ''}</span>
            {whats && <a className="pl-link-action" href={whats} target="_blank" rel="noreferrer">Abrir o WhatsApp do cliente</a>}
          </div>
        )}

        {modo === 'ver' && pendente && (
          <div className="fw-botoes">
            <button type="button" className="pl-btn pl-btn-primary" onClick={() => { setModo('feito'); setValor(novoValor()) }}>Fiz o follow</button>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setModo('agendar')}>Reagendar</button>
            <button type="button" className="pl-btn pl-btn-ghost" disabled={salvando} onClick={cancelar}>Cancelar follow</button>
          </div>
        )}

        {modo === 'feito' && (
          <>
            <div className="pl-field"><label htmlFor="fw-res">Como foi? (opcional)</label><textarea id="fw-res" className="pl-input" rows={2} maxLength={1000} value={resultado} onChange={e => setResultado(e.target.value)} placeholder="Ex.: respondeu, quer ver a moto no sábado" /></div>
            <label className="fw-check"><input type="checkbox" checked={agendarProximo} onChange={e => setAgendarProximo(e.target.checked)} /> Agendar o próximo follow</label>
            {agendarProximo && <Agendador valor={valor} onChange={setValor} />}
            <div className="fw-botoes">
              <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setModo('ver')}>Voltar</button>
              <button type="button" className="pl-btn pl-btn-primary" disabled={salvando} onClick={concluir}>{salvando ? 'Salvando…' : agendarProximo ? 'Salvar e agendar' : 'Salvar'}</button>
            </div>
          </>
        )}

        {modo === 'agendar' && (
          <>
            {pendente && <p className="fw-legenda">O follow de agora será trocado pelo novo.</p>}
            <Agendador valor={valor} onChange={setValor} />
            <div className="fw-botoes">
              {pendente && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setModo('ver')}>Voltar</button>}
              <button type="button" className="pl-btn pl-btn-primary" disabled={salvando || !valor.dia || !valor.hora} onClick={agendar}>{salvando ? 'Agendando…' : 'Agendar follow'}</button>
            </div>
          </>
        )}

        {erro && <div className="pl-alert pl-alert-error">{erro}</div>}

        {historico && historico.length > 0 && (
          <div className="fw-historico">
            <div className="fw-rotulo">Últimos contatos</div>
            {historico.map(f => (
              <div key={f.id} className="fw-hist-item">
                <span className={`fw-status ${f.status === 'FEITO' ? 'feito' : ''}`}>{f.status === 'FEITO' ? 'Feito' : 'Cancelado'}</span>
                <div><b>{dataHoraBR(f.feitoEm ?? f.agendadoPara)}</b>{f.canal ? ` · ${CANAL_FOLLOW[f.canal]}` : ''}{f.resultado ? <div className="fw-legenda">{f.resultado}</div> : null}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
