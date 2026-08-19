'use client'

import Link from 'next/link'

const CORES: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  purple: 'bg-purple-50 text-purple-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  orange: 'bg-orange-50 text-orange-700',
  slate: 'bg-slate-50 text-slate-700',
  red: 'bg-red-50 text-red-700',
}

export default function StatCard({
  label, value, href, color = 'slate', destaque,
}: {
  label: string
  value: number | string
  href?: string
  color?: keyof typeof CORES
  destaque?: boolean
}) {
  const conteudo = (
    <div className={`bg-white rounded-xl border p-5 h-full ${destaque ? 'border-red-300' : 'border-gray-200'}`}>
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${CORES[color]} mb-3`}>
        <span className="font-bold text-lg">{typeof value === 'string' ? value[0] : value}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
  return href ? <Link href={href}>{conteudo}</Link> : conteudo
}
