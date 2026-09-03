'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { PLThemeToggle } from '@/lib/proLaboreTheme'

const NAV = [
  { href: '/pro-labore', label: 'Dashboard' },
  { href: '/pro-labore/vendas', label: 'Vendas', donoOnly: true },
  { href: '/pro-labore/leads', label: 'Leads' },
  { href: '/pro-labore/vendedores', label: 'Vendedores', donoOnly: true },
  { href: '/pro-labore/indicadores', label: 'Indicadores', donoOnly: true },
  { href: '/pro-labore/configuracoes', label: 'Configurações', donoOnly: true },
]

export default function ProLaborePainelLayout({ children }: { children: React.ReactNode }) {
  const { usuario, loading, logout } = useProLaboreAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [menuAberto, setMenuAberto] = useState(false)

  useEffect(() => {
    if (!loading && !usuario) router.replace('/pro-labore/login')
  }, [usuario, loading, router])

  // fecha o menu-gaveta (mobile) ao trocar de página
  useEffect(() => { setMenuAberto(false) }, [pathname])

  // trava o scroll do fundo enquanto a gaveta está aberta, e fecha com Esc
  useEffect(() => {
    if (!menuAberto) return
    document.body.style.overflow = 'hidden'
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuAberto(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuAberto])

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>
  }

  if (!usuario) return null

  const isDono = usuario.papel !== 'VENDEDOR'
  const nav = NAV.filter(item => !item.donoOnly || isDono)

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
        <button type="button" className="pl-menu-toggle" onClick={() => setMenuAberto(true)} aria-label="Abrir menu" aria-expanded={menuAberto}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>

        <div className={`pl-drawer ${menuAberto ? 'open' : ''}`}>
          <div className="pl-drawer-head">
            <span className="pl-drawer-title">Menu</span>
            <button type="button" className="pl-menu-toggle" onClick={() => setMenuAberto(false)} aria-label="Fechar menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <nav className="pl-nav">
            {nav.map(item => (
              <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="pl-header-right">
            <span className="pl-user">{usuario.nome}{!isDono && <span className="pl-hint" style={{ marginLeft: 6 }}>(vendedor)</span>}</span>
            <PLThemeToggle />
            <button className="pl-logout" onClick={logout}>Sair</button>
          </div>
        </div>

        {menuAberto && <div className="pl-drawer-backdrop" onClick={() => setMenuAberto(false)} />}
      </div>

      {children}

      <div className="pl-footer">
        <span>Pró-Labore — módulo pessoal do ARIES.</span>
      </div>
    </div>
  )
}
