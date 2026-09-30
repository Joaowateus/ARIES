'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function duracaoDesde(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

// Volta pra mesma pasta/departamento de onde a apresentação está.
export function linkBiblioteca(a: { departamentoId: string | null; pastaId: string | null }): string {
  const q = new URLSearchParams()
  if (a.departamentoId) q.set('dep', a.departamentoId)
  if (a.pastaId) q.set('pasta', a.pastaId)
  return `/pro-labore/reunioes${q.size ? `?${q}` : ''}`
}

export function tempoRelativo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}

// Tela cheia do quadro (apresentar/assistir sem o resto do sistema).
export function useTelaCheia<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [cheia, setCheia] = useState(false)
  useEffect(() => {
    const ao = () => setCheia(document.fullscreenElement === ref.current && !!ref.current)
    document.addEventListener('fullscreenchange', ao)
    return () => document.removeEventListener('fullscreenchange', ao)
  }, [])
  const alternar = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void ref.current?.requestFullscreen?.()
  }, [])
  return { ref, cheia, alternar }
}

const svg = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

export function IconeVoltar() {
  return <svg {...svg}><path d="M15 18l-6-6 6-6" /></svg>
}
export function IconeLaser() {
  return <svg {...svg}><circle cx="12" cy="12" r="3" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></svg>
}
export function IconeLink() {
  return <svg {...svg}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
}
export function IconePainel() {
  return <svg {...svg}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></svg>
}
export function IconeTelaCheia({ cheia }: { cheia: boolean }) {
  return cheia
    ? <svg {...svg}><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
    : <svg {...svg}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
}
export function IconeEnquadrar() {
  return <svg {...svg}><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" /></svg>
}
export function IconeCopiarAnotacoes() {
  return <svg {...svg}><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2" /><path d="M11 13h6M11 17h4" /></svg>
}
