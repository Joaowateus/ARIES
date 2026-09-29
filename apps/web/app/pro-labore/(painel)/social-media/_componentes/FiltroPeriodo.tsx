'use client'

import { useEffect, useRef, useState } from 'react'
import { chaveDeData, fmtDiaMes } from './viz'

export type PresetPeriodo = 'hoje' | '7d' | 'semana' | '30d' | 'mes' | 'mes-anterior' | '90d' | 'custom'
export interface Periodo { inicio: string; fim: string; preset: PresetPeriodo }

const DIA_MS = 24 * 60 * 60 * 1000

// Presets no fuso do navegador — o fim nunca passa de hoje (um período
// que termina no futuro só acrescentaria dias vazios no gráfico).
export function periodoDoPreset(preset: Exclude<PresetPeriodo, 'custom'>): Periodo {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const menos = (dias: number) => new Date(hoje.getTime() - dias * DIA_MS)
  switch (preset) {
    case 'hoje': return { inicio: chaveDeData(hoje), fim: chaveDeData(hoje), preset }
    case '7d': return { inicio: chaveDeData(menos(6)), fim: chaveDeData(hoje), preset }
    case 'semana': return { inicio: chaveDeData(menos((hoje.getDay() + 6) % 7)), fim: chaveDeData(hoje), preset }
    case '30d': return { inicio: chaveDeData(menos(29)), fim: chaveDeData(hoje), preset }
    case 'mes': return { inicio: chaveDeData(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fim: chaveDeData(hoje), preset }
    case 'mes-anterior': return {
      inicio: chaveDeData(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)),
      fim: chaveDeData(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
      preset,
    }
    case '90d': return { inicio: chaveDeData(menos(89)), fim: chaveDeData(hoje), preset }
  }
}

const PRESETS: Array<{ id: Exclude<PresetPeriodo, 'custom'>; rotulo: string }> = [
  { id: 'hoje', rotulo: 'Hoje' },
  { id: '7d', rotulo: '7 dias' },
  { id: 'semana', rotulo: 'Esta semana' },
  { id: '30d', rotulo: '30 dias' },
  { id: 'mes', rotulo: 'Este mês' },
  { id: 'mes-anterior', rotulo: 'Mês passado' },
  { id: '90d', rotulo: '90 dias' },
]

const SECOES = [
  ['sv-visao', 'Visão geral'],
  ['sv-conteudo', 'Conteúdo'],
  ['sv-horarios', 'Quando postar'],
  ['sv-crescimento', 'Crescimento'],
  ['sv-audiencia', 'Audiência'],
  ['sv-comercial', 'Resultado comercial'],
  ['sv-publicacoes', 'Todas as publicações'],
] as const

export function FiltroPeriodo({ periodo, onChange, comparacao }: {
  periodo: Periodo
  onChange: (p: Periodo) => void
  comparacao: { inicio: string; fim: string } | null
}) {
  const [aberto, setAberto] = useState(false)
  const [inicio, setInicio] = useState(periodo.inicio)
  const [fim, setFim] = useState(periodo.fim)
  const wrapRef = useRef<HTMLDivElement>(null)
  const hoje = chaveDeData(new Date())

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  function aplicarCustom() {
    if (!inicio || !fim) return
    const [a, b] = inicio <= fim ? [inicio, fim] : [fim, inicio]
    onChange({ inicio: a, fim: b, preset: 'custom' })
    setAberto(false)
  }

  return (
    <div className="pl-sv-toolbar">
      <div className="pl-sv-toolbar-row">
        {PRESETS.map(p => (
          <button key={p.id} type="button" className={`pl-chip ${periodo.preset === p.id ? 'active' : ''}`} onClick={() => onChange(periodoDoPreset(p.id))}>
            {p.rotulo}
          </button>
        ))}
        <div style={{ position: 'relative' }} ref={wrapRef}>
          <button type="button" className={`pl-chip ${periodo.preset === 'custom' ? 'active' : ''}`} onClick={() => { setInicio(periodo.inicio); setFim(periodo.fim); setAberto(a => !a) }} aria-expanded={aberto}>
            Personalizado
          </button>
          {aberto && (
            <div className="pl-sv-custom-pop">
              <div className="pl-field">
                <label htmlFor="sv-inicio">De</label>
                <input id="sv-inicio" type="date" className="pl-input" value={inicio} max={hoje} onChange={e => setInicio(e.target.value)} />
              </div>
              <div className="pl-field">
                <label htmlFor="sv-fim">Até</label>
                <input id="sv-fim" type="date" className="pl-input" value={fim} max={hoje} onChange={e => setFim(e.target.value)} />
              </div>
              <button type="button" className="pl-btn pl-btn-primary" disabled={!inicio || !fim} onClick={aplicarCustom}>Aplicar período</button>
            </div>
          )}
        </div>
        <div className="pl-sv-periodo-label">
          <b>{periodo.inicio === periodo.fim ? fmtDiaMes(periodo.inicio) : `${fmtDiaMes(periodo.inicio)} – ${fmtDiaMes(periodo.fim)}`}</b>
          {comparacao && <span>comparado com {comparacao.inicio === comparacao.fim ? fmtDiaMes(comparacao.inicio) : `${fmtDiaMes(comparacao.inicio)} – ${fmtDiaMes(comparacao.fim)}`}</span>}
        </div>
      </div>
      <nav className="pl-sv-nav" aria-label="Seções da análise">
        {SECOES.map(([id, rotulo]) => <a key={id} href={`#${id}`}>{rotulo}</a>)}
      </nav>
    </div>
  )
}
