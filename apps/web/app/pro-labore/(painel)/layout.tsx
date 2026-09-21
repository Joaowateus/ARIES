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
    { href: '/pro-labore/social-media', label: 'Social Media', icon: 'at', donoOnly: true },
  ] },
  { label: 'Equipe', items: [
    { href: '/pro-labore/vendedores', label: 'Vendedores', icon: 'users', donoOnly: true },
    // Ocorrências é a única aba visível pra supervisor mas escondida de
    // vendedor comum — por isso usa hideFromVendedor em vez de donoOnly.
    { href: '/pro-labore/ocorrencias', label: 'Ocorrências', icon: 'flag', hideFromVendedor: true },
  ] },
  { label: 'Sistema', items: [
    { href: '/pro-labore/indicadores', label: 'Indicadores', icon: 'chart', donoOnly: true },
    { href: '/pro-labore/configuracoes', label: 'Configurações', icon: 'gear', donoOnly: true },
  ] },
]

const CHAVE_SIDEBAR_COLAPSADA = 'pl_sidebar_colapsada'
const CHAVE_GRUPOS_COLAPSADOS = 'pl_sidebar_grupos_colapsados'

export default function ProLaborePainelLayout({ children }: { children: React.ReactNode }) {
  const { usuario, loading, logout } = useProLaboreAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [menuAberto, setMenuAberto] = useState(false)

  // Colapso da sidebar inteira (vira uma trilha só de ícones) e colapso
  // independente de cada grupo (Operação/Equipe/Sistema) — cada um com a
  // própria preferência salva, lida só depois de montar pra não conflitar
  // com a renderização inicial do servidor (que não tem acesso ao localStorage).
  const [sidebarColapsada, setSidebarColapsada] = useState(false)
  const [gruposColapsados, setGruposColapsados] = useState<string[]>([])

  useEffect(() => {
    if (localStorage.getItem(CHAVE_SIDEBAR_COLAPSADA) === '1') setSidebarColapsada(true)
    const salvos = localStorage.getItem(CHAVE_GRUPOS_COLAPSADOS)
    if (salvos) {
      try { setGruposColapsados(JSON.parse(salvos)) } catch { /* ignora preferência corrompida */ }
    }
  }, [])

  function alternarSidebar() {
    setSidebarColapsada(atual => {
      const novo = !atual
      localStorage.setItem(CHAVE_SIDEBAR_COLAPSADA, novo ? '1' : '0')
      return novo
    })
  }

  function alternarGrupo(label: string) {
    setGruposColapsados(atual => {
      const novo = atual.includes(label) ? atual.filter(l => l !== label) : [...atual, label]
      localStorage.setItem(CHAVE_GRUPOS_COLAPSADOS, JSON.stringify(novo))
      return novo
    })
  }

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
      <aside className={`pl-sidebar ${menuAberto ? 'open' : ''} ${sidebarColapsada ? 'collapsed' : ''}`}>
        <div className="pl-sidebar-brand">
          <AriesBrandMark size={34} />
          <div className="pl-sidebar-brand-text">
            <div className="pl-brand-name">Pró-Labore</div>
            <div className="pl-brand-sub">Liquidez &amp; pró-labore</div>
          </div>
          <button
            type="button"
            className="pl-sidebar-collapse-toggle"
            onClick={alternarSidebar}
            aria-label={sidebarColapsada ? 'Expandir menu' : 'Recolher menu'}
            title={sidebarColapsada ? 'Expandir menu' : 'Recolher menu'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={sidebarColapsada ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} />
            </svg>
          </button>
          <button type="button" className="pl-menu-toggle pl-sidebar-close" onClick={() => setMenuAberto(false)} aria-label="Fechar menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <nav className="pl-sidebar-nav">
          {grupos.map((grupo, i) => {
            const colapsado = !!grupo.label && gruposColapsados.includes(grupo.label)
            return (
              <div key={grupo.label ?? `grupo-${i}`}>
                {grupo.label && (
                  <button
                    type="button"
                    className="pl-sidebar-group-label"
                    onClick={() => alternarGrupo(grupo.label!)}
                    aria-expanded={!colapsado}
                  >
                    <span>{grupo.label}</span>
                    <svg className={`pl-sidebar-group-chevron ${colapsado ? 'collapsed' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                )}
                {(sidebarColapsada || !colapsado) && grupo.items.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`pl-sidebar-link ${pathname === item.href ? 'active' : ''}`}
                    title={sidebarColapsada ? item.label : undefined}
                  >
                    <NavIcon name={item.icon} />
                    <span className="pl-sidebar-link-label">{item.label}</span>
                  </Link>
                ))}
              </div>
            )
          })}
        </nav>

        <div className="pl-sidebar-footer">
          <div className="pl-sidebar-user">
            <span className="pl-user">{usuario.nome}{rotuloPapel && <span className="pl-hint" style={{ marginLeft: 6 }}>({rotuloPapel})</span>}</span>
            <PLThemeToggle />
          </div>
          <button className="pl-logout" onClick={logout} title="Sair" aria-label="Sair">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            <span className="pl-logout-label">Sair</span>
          </button>
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
