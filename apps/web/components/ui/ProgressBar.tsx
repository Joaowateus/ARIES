'use client'

/** Barra de progresso 0-1, com cor por faixa (verde ≥100%, azul ≥60%, laranja abaixo). */
export default function ProgressBar({ percentual, size = 'md' }: { percentual: number; size?: 'sm' | 'md' }) {
  const pct = Math.round(percentual * 100)
  const cor = pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : 'bg-orange-400'
  const altura = size === 'sm' ? 'h-2' : 'h-3'
  return (
    <div className={`bg-gray-100 rounded-full ${altura}`}>
      <div className={`${altura} rounded-full ${cor}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}
