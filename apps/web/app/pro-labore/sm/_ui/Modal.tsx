'use client'

// Janela modal acessível: role="dialog", foco no primeiro campo, Esc fecha,
// Tab fica dentro da janela e o foco volta para quem abriu.
import { useEffect, useRef, type ReactNode } from 'react'
import { IcFechar } from './icones'

export function Modal({ titulo, aoFechar, children, rotulo }: { titulo: string; aoFechar: () => void; children: ReactNode; rotulo?: string }) {
  const caixa = useRef<HTMLDivElement>(null)
  const fechar = useRef(aoFechar)
  useEffect(() => { fechar.current = aoFechar })

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null
    const el = caixa.current
    const focaveis = () => [...(el?.querySelectorAll<HTMLElement>('input, select, textarea, button, a[href], [tabindex]:not([tabindex="-1"])') ?? [])].filter(x => !x.hasAttribute('disabled'))
    const primeiro = focaveis().find(x => x.tagName !== 'BUTTON') ?? focaveis()[0]
    primeiro?.focus()
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); fechar.current() }
      if (e.key === 'Tab') {
        const f = focaveis()
        if (!f.length) return
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
      }
    }
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('keydown', tecla); anterior?.focus?.() }
  }, [])

  return (
    <div className="sm-modal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) aoFechar() }}>
      <div ref={caixa} className="sm-modal" role="dialog" aria-modal="true" aria-label={rotulo ?? titulo}>
        <div className="sm-modal-cab">
          <h2 className="sm-ttl">{titulo}</h2>
          <button type="button" className="sm-btn fantasma icone" aria-label="Fechar" onClick={aoFechar}><IcFechar /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
