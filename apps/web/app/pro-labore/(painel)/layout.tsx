'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'

const NAV = [
  { href: '/pro-labore', label: 'Dashboard' },
  { href: '/pro-labore/lancamentos', label: 'Lançamentos' },
  { href: '/pro-labore/configuracoes', label: 'Configurações' },
]

export default function ProLaborePainelLayout({ children }: { children: React.ReactNode }) {
  const { usuario, loading, logout } = useProLaboreAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !usuario) router.replace('/pro-labore/login')
  }, [usuario, loading, router])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Carregando...</div>
  }

  if (!usuario) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">₽</span>
              </div>
              <span className="font-semibold text-gray-900">Pró-Labore</span>
            </div>
            <nav className="flex items-center gap-1">
              {NAV.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{usuario.nome}</span>
            <button
              onClick={logout}
              className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
