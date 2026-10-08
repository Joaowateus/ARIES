'use client'

// Comemoração discreta (seção 15, item 7): só em marco real (meta batida,
// conquista, venda creditada), uma vez por marco. Um cartão pequeno, sem
// confete; a animação some para quem pede menos movimento.
import Link from 'next/link'
import type { SmMarco } from '@/lib/proLaboreApi'

const ICONE: Record<SmMarco['tipo'], string> = { META: '✓', CONQUISTA: '★', VENDA: '$' }

export function Comemoracao({ marco, aoFechar }: { marco: SmMarco; aoFechar: () => void }) {
  return (
    <section className={`sm-comemora ${marco.tipo.toLowerCase()}`} aria-label="Comemoração">
      <span className="sm-comemora-ic" aria-hidden="true">{ICONE[marco.tipo]}</span>
      <div className="sm-comemora-texto" role="status">
        <b>{marco.titulo}</b>
        <span>{marco.texto}</span>
      </div>
      <div className="sm-comemora-acoes">
        {marco.href && <Link href={marco.href} className="sm-link-botao" onClick={aoFechar}>Ver</Link>}
        <button type="button" className="sm-btn fantasma" onClick={aoFechar}>Valeu</button>
      </div>
    </section>
  )
}
