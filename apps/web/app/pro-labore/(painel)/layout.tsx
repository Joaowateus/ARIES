'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { PLThemeToggle } from '@/lib/proLaboreTheme'
import { AriesBrandMark } from '../AriesBrandMark'
import { NavIcon, NavIconName } from '../icons'

interface NavItem { href: string; label: string; icon: NavIconName; donoOnly?: boolean; hideFromVendedor?: boolean }
interface NavGroup { label: string | null; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [
    { href: '/pro-labore', label: 'Dashboard', icon: 'home' },
  ] },
  { label: 'Operação', items: [
    { href: '/pro-labore/leads', label: 'CRM', icon: 'kanban' },
    { href: '/pro-labore/agenda', label: 'Agenda', icon: 'calendar' },
    { href: '/pro-labore/vendas', label: 'Vendas', icon: 'cart', donoOnly: true },
  ] },
  { label: 'Equipe', items: [
    { href: '/pro-labore/vendedores', label: 'Vendedores', icon: 'users', donoOnly: true },
    // Ocorrências é a única aba visível pra supervisor mas escondida de
    // vendedor comum — por isso usa hideFromVendedor em vez de donoOnly.
    { href: '/pro-labore/ocorrencias', label: 'Ocorrências', icon: 'flag', hideFromVendedor: true },
    { href: '/pro-labore/social-media', label: 'Social Media', icon: 'at', donoOnly: true },
  ] },
  { label: 'Sistema', items: [
    { href: '/pro-labore/indicadores', label: 'Indicadores', icon: 'chart', donoOnly: true },
    { href: '/pro-labore/configuracoes', label: 'Configurações', icon: 'gear', donoOnly: true },
  ] },
]

export default function ProLaborePainelLayout({ children }: { children: React.ReactNode }) {
  const { usuario, loading, logout } = useProLaboreAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [menuAberto, setMenuAberto] = useState(false)

  useEffect(() => {
    if (!loading && !usuario) router.replace('/pro-labore/login')
  }, [usuario, loading, router])

  // fecha a gaveta (mobile) ao trocar de página
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

  const isDono = usuario.papel === 'DONO'
  const isVendedor = usuario.papel === 'VENDEDOR'
  const podeVerItem = (item: NavItem) => (!item.donoOnly || isDono) && (!item.hideFromVendedor || !isVendedor)
  const grupos = NAV_GROUPS
    .map(grupo => ({ ...grupo, items: grupo.items.filter(podeVerItem) }))
    .filter(grupo => grupo.items.length > 0)
  const paginaAtual = grupos.flatMap(g => g.items).find(item => item.href === pathname)
  const rotuloPapel = usuario.papel === 'SUPERVISOR' ? 'supervisor' : usuario.papel === 'VENDEDOR' ? 'vendedor' : null

  return (
    <div className="pl-app-shell">
      <aside className={`pl-sidebar ${menuAberto ? 'open' : ''}`}>
        <div className="pl-sidebar-brand">
          <AriesBrandMark size={34} />
          <div>
            <div className="pl-brand-name">Pró-Labore</div>
            <div className="pl-brand-sub">Liquidez &amp; pró-labore</div>
          </div>
          <button type="button" className="pl-menu-toggle pl-sidebar-close" onClick={() => setMenuAberto(false)} aria-label="Fechar menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <nav className="pl-sidebar-nav">
          {grupos.map((grupo, i) => (
            <div key={grupo.label ?? `grupo-${i}`}>
              {grupo.label && <div className="pl-sidebar-group-label">{grupo.label}</div>}
              {grupo.items.map(item => (
                <Link key={item.href} href={item.href} className={`pl-sidebar-link ${pathname === item.href ? 'active' : ''}`}>
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="pl-sidebar-footer">
          <div className="pl-sidebar-user">
            <span className="pl-user">{usuario.nome}{rotuloPapel && <span className="pl-hint" style={{ marginLeft: 6 }}>({rotuloPapel})</span>}</span>
            <PLThemeToggle />
          </div>
          <button className="pl-logout" onClick={logout} style={{ textAlign: 'left' }}>Sair</button>
        </div>
      </aside>

      {menuAberto && <div className="pl-sidebar-backdrop" onClick={() => setMenuAberto(false)} />}

      <div className="pl-main">
        <div className="pl-topbar-v2">
          <div className="pl-breadcrumb">
            <span>Pró-Labore</span>
            {paginaAtual && <><span>/</span><b>{paginaAtual.label}</b></>}
          </div>
          <button type="button" className="pl-menu-toggle" onClick={() => setMenuAberto(true)} aria-label="Abrir menu" aria-expanded={menuAberto}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        </div>

        <div className="pl-shell">
          {children}

          <div className="pl-footer">
            <span>Pró-Labore — módulo pessoal do ARIES.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
