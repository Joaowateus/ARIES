'use client'

// Ponteiro laser: ponto vermelho com um rastro curto que some sozinho.
// Os pontos chegam em coordenadas do MAPA (iguais pra todo mundo) e são
// convertidos pra tela a cada quadro — continua no lugar certo mesmo
// enquanto a vista anima ou quem assiste dá zoom. Tudo via ref + rAF, sem
// re-render do React a cada movimento.
import { useEffect, useRef } from 'react'
import type { MotorMapaMental } from '../../anotacoes/motor-mapa-mental/motor'

type Ponto = { x: number; y: number }

export interface FonteLaser {
  fila: Ponto[] // pontos ainda não mostrados (tocados na velocidade em que foram capturados)
  ativo: boolean
  ultimoEm: number
}

export function criarFonteLaser(): FonteLaser {
  return { fila: [], ativo: false, ultimoEm: 0 }
}

const RASTRO = 14
const PASSO_MS = 40 // mesmo intervalo da captura
const SOME_APOS_MS = 4000

export default function Laser({ motorRef, fonteRef }: { motorRef: React.RefObject<MotorMapaMental | null>; fonteRef: React.RefObject<FonteLaser> }) {
  const svgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    let raf = 0
    let ultimoPasso = 0
    const rastro: Ponto[] = []
    const quadro = (agora: number) => {
      raf = requestAnimationFrame(quadro)
      const svg = svgRef.current, motor = motorRef.current, fonte = fonteRef.current
      if (!svg || !motor || !fonte) return
      // Fila muito atrasada (aba em segundo plano) pula direto pro fim.
      if (fonte.fila.length > 40) fonte.fila.splice(0, fonte.fila.length - 8)
      if (fonte.fila.length && agora - ultimoPasso >= PASSO_MS) {
        ultimoPasso = agora
        rastro.push(fonte.fila.shift()!)
        if (rastro.length > RASTRO) rastro.shift()
        fonte.ultimoEm = Date.now()
      }
      const visivel = fonte.ativo && rastro.length > 0 && Date.now() - fonte.ultimoEm < SOME_APOS_MS
      svg.style.opacity = visivel ? '1' : '0'
      if (!visivel) { if (!fonte.ativo) rastro.length = 0; return }
      const circulos = svg.children
      for (let i = 0; i < RASTRO + 1; i++) {
        const c = circulos[i] as SVGCircleElement
        const p = i < RASTRO ? rastro[rastro.length - RASTRO + i] : rastro[rastro.length - 1]
        if (!p) { c.setAttribute('r', '0'); continue }
        const t = motor.mundoParaTela(p)
        c.setAttribute('cx', String(t.x)); c.setAttribute('cy', String(t.y))
        if (i < RASTRO) {
          const f = (i + 1) / RASTRO
          c.setAttribute('r', String(2 + 4 * f)); c.setAttribute('opacity', String(0.08 + 0.3 * f))
        }
      }
    }
    raf = requestAnimationFrame(quadro)
    return () => cancelAnimationFrame(raf)
  }, [motorRef, fonteRef])

  return (
    <svg ref={svgRef} className="pl-ap-laser" aria-hidden="true">
      {Array.from({ length: RASTRO }, (_, i) => <circle key={i} r="0" fill="#ff3b30" />)}
      <circle r="8" fill="#ff3b30" stroke="#fff" strokeWidth="2.5" style={{ filter: 'drop-shadow(0 0 6px rgba(255,59,48,.8))' }} />
    </svg>
  )
}
