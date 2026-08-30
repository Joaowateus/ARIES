'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { PLThemeToggle } from '@/lib/proLaboreTheme'

const NAV = [
  { href: '/pro-labore', label: 'Dashboard' },
  { href: '/pro-labore/vendas', label: 'Vendas' },
  { href: '/pro-labore/vendedores', label: 'Vendedores' },
  { href: '/pro-labore/indicadores', label: 'Indicadores' },
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
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>
  }

  if (!usuario) return null

  return (
    <div className="pl-shell">
      <div className="pl-topbar">
        <div className="pl-brand">
          <div className="pl-brand-mark">
            <svg viewBox="0 0 24 24" fill="none"><path d="M3 17L9 11L13 15L21 6" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /><path d="M15 6H21V12" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <div className="pl-brand-name">Pró-Labore</div>
            <div className="pl-brand-sub">Liquidez da operação &amp; pró-labore</div>
          </div>
        </div>
        <nav className="pl-nav">
          {NAV.map(item => (
            <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="pl-header-right">
          <span className="pl-user">{usuario.nome}</span>
          <PLThemeToggle />
          <button className="pl-logout" onClick={logout}>Sair</button>
        </div>
      </div>

      {children}

      <div className="pl-footer">
        <span>Pró-Labore — módulo pessoal do ARIES.</span>
      </div>
    </div>
  )
}
