'use client'

// Ajuste 1: a frase motivacional do dono, no topo do Hoje. Só o dono edita.
import { useEffect, useState } from 'react'
import { proLaboreApi } from '@/lib/proLaboreApi'

export function FraseDoDono() {
  const [frase, setFrase] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { proLaboreApi.parametros.get().then(p => setFrase(p.fraseMotivacional ?? '')).catch(() => setFrase('')) }, [])
  async function salvar() {
    try { const p = await proLaboreApi.parametros.atualizar({ fraseMotivacional: texto.trim() }); setFrase(p.fraseMotivacional ?? ''); setEditando(false); setMsg(null) } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível salvar') }
  }
  if (frase == null) return null
  if (editando) return (
    <div className="pl-card" style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} data-frase-editando>
      <input className="pl-input" style={{ flex: 1, minWidth: 220 }} maxLength={280} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ex.: Cada venda é um passo mais perto da liberdade financeira." aria-label="Frase motivacional" />
      <button type="button" className="pl-btn pl-btn-primary" onClick={() => void salvar()}>Salvar</button>
      <button type="button" className="pl-btn" onClick={() => setEditando(false)}>Cancelar</button>
      {msg && <span className="pl-hint" role="alert">{msg}</span>}
    </div>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }} data-frase-dono>
      <p style={{ margin: 0, flex: 1, fontSize: 15, fontStyle: frase ? 'italic' : 'normal', color: frase ? 'var(--pl-ink-1)' : 'var(--pl-ink-muted)' }}>{frase ? `“${frase}”` : 'Sem frase motivacional. Escreva uma lembrança para você.'}</p>
      <button type="button" className="pl-btn pl-btn-ghost" onClick={() => { setTexto(frase); setEditando(true) }} data-editar-frase>{frase ? 'Editar' : 'Adicionar'}</button>
    </div>
  )
}
