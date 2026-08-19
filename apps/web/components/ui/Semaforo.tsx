'use client'

const CORES: Record<string, string> = {
  verde: 'bg-green-100 text-green-700 border-green-200',
  amarelo: 'bg-amber-100 text-amber-700 border-amber-200',
  vermelho: 'bg-red-100 text-red-700 border-red-200',
}

const ICONES: Record<string, string> = { verde: '🟢', amarelo: '🟡', vermelho: '🔴' }

export default function Semaforo({ status }: { status: 'verde' | 'amarelo' | 'vermelho' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${CORES[status]}`}>
      {ICONES[status]}
    </span>
  )
}
