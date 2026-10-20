'use client'

// Marcar como perdido: o cliente sai do funil e vai para a Reativação com o
// motivo, uma nota e a temperatura (quão perto ele está de voltar).
import './follow.css'
import { useEffect, useState } from 'react'
import type { MotivoPerda, Temperatura } from '@/lib/proLaboreApi'
import { MOTIVO_PERDA, TEMPERATURA } from './follow'

export function PerdaModal({ nomeCliente, onFechar, onConfirmar }: {
  nomeCliente: string
  onFechar: () => void
  onConfirmar: (perda: { motivoPerda: MotivoPerda; notaPerda?: string; temperatura?: Temperatura }) => Promise<void>
}) {
  const [motivo, setMotivo] = useState<MotivoPerda | ''>('')
  const [nota, setNota] = useState('')
  const [temperatura, setTemperatura] = useState<Temperatura>('MORNO')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar])

  async function confirmar() {
    if (!motivo) return
    setSalvando(true); setErro('')
    try { await onConfirmar({ motivoPerda: motivo, notaPerda: nota.trim() || undefined, temperatura }); onFechar() } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  return (
    <div className="pl-modal-backdrop" onClick={onFechar}>
      <div className="pl-card pl-modal-panel fw-janela" role="dialog" aria-modal="true" aria-labelledby="fw-perda-titulo" onClick={e => e.stopPropagation()}>
        <div className="fw-cab">
          <div><div className="pl-eyebrow">Marcar como perdido</div><h2 id="fw-perda-titulo">{nomeCliente}</h2></div>
          <button type="button" className="fw-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <p className="fw-legenda">O cliente sai do funil e vai para a <b>Reativação</b>, com todas as informações, para ser aquecido e retomado depois. Os números do funil continuam iguais.</p>
        <div className="pl-field">
          <label htmlFor="fw-motivo">Por que não avançou?</label>
          <select id="fw-motivo" className="pl-select" value={motivo} onChange={e => setMotivo(e.target.value as MotivoPerda)} required>
            <option value="">Escolha o motivo</option>
            {(Object.keys(MOTIVO_PERDA) as Array<MotivoPerda | 'SEM_MOTIVO'>).filter(k => k !== 'SEM_MOTIVO').map(k => <option key={k} value={k}>{MOTIVO_PERDA[k]}</option>)}
          </select>
        </div>
        <div className="pl-field">
          <label>Temperatura</label>
          <div className="fw-rapidos" role="group" aria-label="Temperatura">
            {(['QUENTE', 'MORNO', 'FRIO'] as Temperatura[]).map(t => <button key={t} type="button" className={`pl-chip fw-temp ${t.toLowerCase()} ${temperatura === t ? 'active' : ''}`} aria-pressed={temperatura === t} onClick={() => setTemperatura(t)}>{TEMPERATURA[t].rotulo}</button>)}
          </div>
          <small className="fw-legenda">{TEMPERATURA[temperatura].dica}</small>
        </div>
        <div className="pl-field"><label htmlFor="fw-nota-perda">Observação (opcional)</label><textarea id="fw-nota-perda" className="pl-input" rows={2} maxLength={2000} value={nota} onChange={e => setNota(e.target.value)} placeholder="Ex.: quer comprar depois de receber o 13º" /></div>
        {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
        <div className="fw-botoes">
          <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Cancelar</button>
          <button type="button" className="pl-btn pl-btn-primary" disabled={!motivo || salvando} onClick={confirmar}>{salvando ? 'Salvando…' : 'Enviar para a Reativação'}</button>
        </div>
      </div>
    </div>
  )
}
