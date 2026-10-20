'use client'

// Aviso do tamanho do banco (só o dono vê). No plano gratuito do Supabase o
// banco tem 500 MB; ao passar, fica só de leitura e o sistema não salva nada
// novo. A partir de 400 MB o aviso aparece; perto do limite fica crítico e
// não dá para dispensar.
import { useEffect, useState } from 'react'
import { proLaboreApi, type SaudeBanco } from '@/lib/proLaboreApi'

const CHAVE = 'pl_aviso_banco_dispensado'
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)
const mb = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} MB`

export function AvisoBanco() {
  const [saude, setSaude] = useState<SaudeBanco | null>(null)
  const [dispensado, setDispensado] = useState(() => { try { return localStorage.getItem(CHAVE) === hoje() } catch { return false } })

  useEffect(() => {
    let cancelado = false
    const medir = () => proLaboreApi.sistema.banco().then(s => { if (!cancelado) setSaude(s) }).catch(() => undefined)
    medir()
    const id = setInterval(medir, 30 * 60_000)
    return () => { cancelado = true; clearInterval(id) }
  }, [])

  if (!saude || saude.nivel === 'OK') return null
  const critico = saude.nivel === 'CRITICO'
  if (!critico && dispensado) return null
  const pct = Math.min(100, Math.round((saude.usadoMB / saude.limiteMB) * 100))
  return (
    <div className={`pl-sv-aviso ${critico ? 'erro' : 'atencao'} pl-aviso-banco`} role={critico ? 'alert' : 'status'} data-aviso-banco={saude.nivel}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>
      <div className="pl-aviso-banco-texto">
        <b style={{ color: 'var(--pl-ink-1)' }}>{critico ? 'Banco de dados quase cheio' : 'Banco de dados chegando no limite'}: {mb(saude.usadoMB)} de {mb(saude.limiteMB)} ({pct}%)</b>
        <div>Ao chegar em {mb(saude.limiteMB)}, o plano gratuito deixa o banco só para leitura: dá para consultar, mas o sistema não salva nada novo. Peça ao responsável técnico para liberar espaço ou avaliar outro plano{critico ? ' ainda hoje' : ''}.</div>
        <div className="pl-aviso-banco-barra" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      </div>
      {!critico && (
        <button type="button" className="pl-btn pl-btn-ghost" style={{ padding: '5px 10px', fontSize: 12, flex: 'none' }} onClick={() => { try { localStorage.setItem(CHAVE, hoje()) } catch { /* sem armazenamento */ } setDispensado(true) }}>Lembrar amanhã</button>
      )}
    </div>
  )
}
