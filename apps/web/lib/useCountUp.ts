import { useEffect, useRef, useState } from 'react'

// Anima um número de onde estava até o novo valor (ease-out), pra dar aquele
// "efeito de contagem" quando o filtro de mês troca — sem libs externas, só
// requestAnimationFrame. Primeiro valor renderiza direto (sem animar do
// zero), só troca de mês/vendedor/período é que anima.
export function useCountUp(target: number, duration = 700): number {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      fromRef.current = target
      return
    }
    const from = fromRef.current
    const to = target
    if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) {
      setDisplay(to)
      fromRef.current = to
      return
    }
    let raf = 0
    const start = performance.now()
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (to - from) * eased)
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return display
}
