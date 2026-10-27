'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { proLaboreApi } from '@/lib/proLaboreApi'
import { PLThemeToggle } from '@/lib/proLaboreTheme'
import { AriesBrandMark } from '../AriesBrandMark'
import { NavIcon, NavIconName } from '../icons'
import { AvisoBanco } from './_banco/AvisoBanco'
import { PaletaComandos } from './_comando/PaletaComandos'

// `modulo`: chave do módulo nos acessos da equipe (lib/acessos.ts da API).
// paraEquipe: aparece para toda a equipe mesmo sem o módulo (a página mostra a versão pessoal).
interface NavItem { href: string; label: string; icon: NavIconName; modulo?: string; donoOnly?: boolean; hideFromVendedor?: boolean; paraEquipe?: boolean }
interface NavGroup { label: string | null; items: NavItem[] }

// Abas organizadas por trabalho (antes, "Operação" juntava 11 itens):
// Vendas (o dia a dia comercial), Rotina, Marketing, Gestão (números e
// dinheiro), Equipe e Sistema.
const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [
    { href: '/pro-labore', label: 'Dashboard', icon: 'home', modulo: 'painel' },
  ] },
  { label: 'Vendas', items: [
    { href: '/pro-labore/leads', label: 'CRM', icon: 'kanban', modulo: 'crm' },
    // Lembretes de ligação (avulsos e cadências) com auditoria; mesmo escopo do CRM.
    { href: '/pro-labore/ligacoes', label: 'Ligações', icon: 'phone', modulo: 'crm' },
    // Cada pessoa tem o próprio copiloto (o escopo é feito no backend); o dono vê o da equipe.
    { href: '/pro-labore/copiloto', label: 'Copiloto Comercial', icon: 'spark', modulo: 'copiloto' },
    // Sem donoOnly/hideFromVendedor de propósito — cada vendedor tem o
    // próprio assistente, ligado ao próprio número, então todo mundo
    // precisa enxergar a própria aba (o escopo por pessoa é feito no backend).
    { href: '/pro-labore/assistente', label: 'Assistente Comercial', icon: 'chat', modulo: 'assistente' },
    { href: '/pro-labore/reativacao', label: 'Reativação', icon: 'refresh', modulo: 'crm' },
  ] },
  { label: 'Rotina', items: [
    { href: '/pro-labore/agenda', label: 'Agenda', icon: 'calendar', modulo: 'agenda' },
    // Sem donoOnly/hideFromVendedor: bloco pessoal de reuniões/anotações,
    // cada um só vê o próprio (escopo feito no backend).
    { href: '/pro-labore/reunioes', label: 'Reuniões', icon: 'mic', modulo: 'reunioes' },
    { href: '/pro-labore/anotacoes', label: 'Anotações', icon: 'notebook', modulo: 'anotacoes' },
  ] },
  { label: 'Marketing', items: [
    // Sem donoOnly: cada pessoa conecta o próprio Instagram e só vê o dela.
    { href: '/pro-labore/social-media', label: 'Social Media', icon: 'at', modulo: 'socialMedia' },
    { href: '/pro-labore/trafego', label: 'Tráfego', icon: 'funnel', modulo: 'trafego', donoOnly: true },
  ] },
  { label: 'Gestão', items: [
    { href: '/pro-labore/vendas', label: 'Vendas', icon: 'cart', modulo: 'vendas', donoOnly: true },
    // Salários, investimentos, custos e outros gastos, com recibo.
    { href: '/pro-labore/financeiro', label: 'Financeiro', icon: 'wallet', modulo: 'financeiro', donoOnly: true },
    { href: '/pro-labore/indicadores', label: 'Indicadores', icon: 'chart', modulo: 'indicadores', donoOnly: true },
    { href: '/pro-labore/plano-crescimento', label: 'Plano de Crescimento', icon: 'compass', modulo: 'planoCrescimento', donoOnly: true },
  ] },
  { label: 'Equipe', items: [
    { href: '/pro-labore/vendedores', label: 'Vendedores', icon: 'users', modulo: 'vendedores', donoOnly: true },
    // Ocorrências: a gestão é do dono e de quem tem o módulo; o resto da
    // equipe abre a mesma aba e vê só as próprias (Minhas ocorrências).
    { href: '/pro-labore/ocorrencias', label: 'Ocorrências', icon: 'flag', modulo: 'ocorrencias', paraEquipe: true },
    // Tela 07 da especificação do Social Media: o que o papel enxerga e o convite.
    { href: '/pro-labore/equipe/acessos', label: 'Acessos e permissões', icon: 'shield', donoOnly: true },
  ] },
  { label: 'Sistema', items: [
    { href: '/pro-labore/configuracoes', label: 'Configurações', icon: 'gear', modulo: 'configuracoes', donoOnly: true },
  ] },
]

// Aviso no topo quando o acesso à área é só para ver.
const AVISO_SO_VER: Record<string, string> = {
  agenda: 'Você pode ver e concluir as suas tarefas. Criar e mudar tarefas depende do gestor.',
}

// Módulo da página aberta: o item do menu com o caminho mais longo que bate.
function itemDaPagina(pathname: string): NavItem | undefined {
  return NAV_GROUPS.flatMap(g => g.items)
    .filter(i => pathname === i.href || (i.href !== '/pro-labore' && pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

// O Social Media abre no painel só a Agenda, as Reuniões e as Anotações liberadas.
function smPodeAbrir(acessos: Record<string, string> | undefined, pathname: string) {
  const modulo = itemDaPagina(pathname)?.modulo
  return !!modulo && ['agenda', 'reunioes', 'anotacoes'].includes(modulo) && !!acessos?.[modulo] && acessos[modulo] !== 'NENHUM'
}

const CHAVE_SIDEBAR_COLAPSADA = 'pl_sidebar_colapsada'
const iniciaisDe = (nome: string) => nome.trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('') || '?'
const CHAVE_GRUPOS_COLAPSADOS = 'pl_sidebar_grupos_colapsados'

export default function ProLaborePainelLayout({ children }: { children: React.ReactNode }) {
  const { usuario, loading, logout, recarregar } = useProLaboreAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [menuAberto, setMenuAberto] = useState(false)
  const smConferido = useRef<string | null>(null)

  // Colapso da sidebar inteira (vira uma trilha só de ícones) e colapso
  // independente de cada grupo (Operação/Equipe/Sistema) — cada um com a
  // própria preferência salva, lida só depois de montar pra não conflitar
  // com a renderização inicial do servidor (que não tem acesso ao localStorage).
  const [sidebarColapsada, setSidebarColapsada] = useState(false)
  // Apresentação ao vivo agora (aba Reuniões): selo no menu pra equipe
  // descobrir que começou, de qualquer tela do sistema.
  const [reunioesAoVivo, setReunioesAoVivo] = useState(0)
  // Pedidos da equipe pra apresentar esperando o dono responder.
  const [pedidosReuniao, setPedidosReuniao] = useState(0)
  // Avisos do Instagram da empresa (ex.: falha de sincronização) ainda
  // abertos: selo no menu, visível de qualquer tela. Some sozinho quando a
  // sincronização volta a funcionar.
  const [avisosSocial, setAvisosSocial] = useState<string[]>([])
  // Follows do CRM atrasados ou marcados para hoje: lembrete no menu.
  const [followsDia, setFollowsDia] = useState({ atrasados: 0, hoje: 0 })
  // Ligações atrasadas e de hoje: selo no item Ligações.
  const [ligacoesDia, setLigacoesDia] = useState({ atrasadas: 0, hoje: 0 })
  // Uma chamada só para os selos, e nenhuma enquanto a aba do navegador está
  // escondida (volta a buscar quando a pessoa reabre a aba).
  useEffect(() => {
    if (!usuario) return
    let cancelado = false
    const buscar = () => {
      if (document.hidden) return
      proLaboreApi.barraLateral().then(b => {
        if (cancelado) return
        setReunioesAoVivo(b.aoVivo)
        setPedidosReuniao(b.pedidosReuniao)
        if (b.follows) setFollowsDia(b.follows)
        if (b.ligacoes) setLigacoesDia(b.ligacoes)
        setAvisosSocial(b.avisosSocial)
      }).catch(() => undefined)
    }
    buscar()
    const t = setInterval(buscar, 45_000)
    document.addEventListener('visibilitychange', buscar)
    return () => { cancelado = true; clearInterval(t); document.removeEventListener('visibilitychange', buscar) }
  }, [usuario])
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
    // O papel Social Media tem espaço próprio; aqui ele só entra nas
    // ferramentas pessoais que o gestor liberou (a API também barra o resto).
    // Antes de mandar de volta, confere com a API: o gestor pode ter acabado
    // de liberar o módulo e a sessão guardada no navegador ainda não sabe.
    // Confere uma vez só por página (recarregar muda o usuário e roda isto de novo).
    else if (usuario?.papel === 'SOCIAL_MEDIA' && !smPodeAbrir(usuario.acessos, pathname)) {
      if (smConferido.current === pathname) { router.replace('/pro-labore/sm'); return }
      smConferido.current = pathname
      void recarregar().then(u => { if (!smPodeAbrir(u?.acessos, pathname)) router.replace('/pro-labore/sm') })
    }
  }, [usuario, loading, router, pathname, recarregar])

  // Sem o Dashboard liberado, a entrada do sistema vira o primeiro módulo que a pessoa tem.
  useEffect(() => {
    const a = usuario && usuario.papel !== 'DONO' ? usuario.acessos : null
    if (!a || pathname !== '/pro-labore' || (a.painel ?? 'NENHUM') !== 'NENHUM') return
    const primeiro = NAV_GROUPS.flatMap(g => g.items).find(i => i.modulo && (a[i.modulo] ?? 'NENHUM') !== 'NENHUM')
    if (primeiro) router.replace(primeiro.href)
  }, [usuario, pathname, router])

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

  if (!usuario || (usuario.papel === 'SOCIAL_MEDIA' && !smPodeAbrir(usuario.acessos, pathname))) return null

  const isDono = usuario.papel === 'DONO'
  const isVendedor = usuario.papel === 'VENDEDOR'
  // Acessos da equipe: o menu mostra só os módulos liberados para esse login.
  // Sem o mapa (sessão antiga em cache), vale a regra fixa de antes.
  const acessos = isDono ? null : usuario.acessos ?? null
  const nivelDe = (item?: NavItem) => (!item?.modulo || !acessos ? null : acessos[item.modulo] ?? 'NENHUM')
  const daEquipe = usuario.papel === 'VENDEDOR' || usuario.papel === 'SUPERVISOR'
  const podeVerItem = (item: NavItem) => {
    if (isDono) return true
    if (item.paraEquipe && daEquipe) return true
    if (acessos) return item.modulo ? nivelDe(item) !== 'NENHUM' : !item.donoOnly
    return !item.donoOnly && (!item.hideFromVendedor || !isVendedor)
  }
  const itemAtual = itemDaPagina(pathname)
  const nivelModulo = nivelDe(itemAtual)
  // Sem o módulo, a aba "para a equipe" abre na versão pessoal em vez de bloquear.
  const nivelAtual = nivelModulo === 'NENHUM' && itemAtual?.paraEquipe && daEquipe ? null : nivelModulo
  const grupos = [
    // Social Media: volta para o espaço dele, acima das ferramentas liberadas.
    ...(usuario.papel === 'SOCIAL_MEDIA' ? [{ label: null, items: [{ href: '/pro-labore/sm', label: 'Social Media', icon: 'at' as NavIconName }] }] : []),
    ...NAV_GROUPS.map(grupo => ({ ...grupo, items: grupo.items.filter(podeVerItem) })),
  ].filter(grupo => grupo.items.length > 0)
  const itensVisiveis = grupos.flatMap(g => g.items)
  const paginaAtual = itensVisiveis.find(item => item.href === pathname)
  const grupoAtual = grupos.find(g => g.items.some(item => item.href === itemAtual?.href))?.label ?? null
  const podeCrm = itensVisiveis.some(item => item.href === '/pro-labore/leads')
  const abrirPaleta = () => { setMenuAberto(false); window.dispatchEvent(new Event('pl-abrir-paleta')) }
  const rotuloPapel = usuario.papel === 'SUPERVISOR' ? 'supervisor' : usuario.papel === 'VENDEDOR' ? 'vendedor' : usuario.papel === 'SOCIAL_MEDIA' ? 'social media' : null

  return (
    <div className="pl-app-shell">
      <aside className={`pl-sidebar ${menuAberto ? 'open' : ''} ${sidebarColapsada ? 'collapsed' : ''}`}>
        <div className="pl-sidebar-brand">
          <AriesBrandMark size={28} />
          <div className="pl-sidebar-brand-text">
            <div className="pl-brand-name">Pró-Labore</div>
            <div className="pl-brand-sub">Gestão comercial</div>
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
                    className={`pl-sidebar-link ${pathname === item.href || (item.href !== '/pro-labore' && pathname.startsWith(`${item.href}/`)) ? 'active' : ''}`}
                    title={sidebarColapsada ? item.label : undefined}
                  >
                    <NavIcon name={item.icon} />
                    <span className="pl-sidebar-link-label">{item.label}</span>
                    {item.href === '/pro-labore/reunioes' && reunioesAoVivo > 0 && (
                      <span className="pl-nav-aovivo" title="Apresentação ao vivo agora"><span className="pl-ap-pulso" aria-hidden="true" />{!sidebarColapsada && 'AO VIVO'}</span>
                    )}
                    {item.href === '/pro-labore/social-media' && avisosSocial.length > 0 && (
                      <span className="pl-nav-alerta" title={avisosSocial.join(' · ')} aria-label={`${avisosSocial.length} ${avisosSocial.length === 1 ? 'aviso' : 'avisos'} do Instagram`}>!</span>
                    )}
                    {item.href === '/pro-labore/leads' && followsDia.atrasados + followsDia.hoje > 0 && (
                      <span className={`pl-nav-pedidos ${followsDia.atrasados > 0 ? 'pl-nav-follow-atrasado' : ''}`} title={[followsDia.atrasados && `${followsDia.atrasados} follow${followsDia.atrasados > 1 ? 's' : ''} atrasado${followsDia.atrasados > 1 ? 's' : ''}`, followsDia.hoje && `${followsDia.hoje} para hoje`].filter(Boolean).join(' · ')} data-follows-menu>{followsDia.atrasados + followsDia.hoje}</span>
                    )}
                    {item.href === '/pro-labore/ligacoes' && ligacoesDia.atrasadas + ligacoesDia.hoje > 0 && (
                      <span className={`pl-nav-pedidos ${ligacoesDia.atrasadas > 0 ? 'pl-nav-follow-atrasado' : ''}`} title={[ligacoesDia.atrasadas && `${ligacoesDia.atrasadas} atrasada${ligacoesDia.atrasadas > 1 ? 's' : ''}`, ligacoesDia.hoje && `${ligacoesDia.hoje} para hoje`].filter(Boolean).join(' · ')} data-ligacoes-menu>{ligacoesDia.atrasadas + ligacoesDia.hoje}</span>
                    )}
                    {item.href === '/pro-labore/reunioes' && reunioesAoVivo === 0 && pedidosReuniao > 0 && (
                      <span className="pl-nav-pedidos" title={`${pedidosReuniao} ${pedidosReuniao === 1 ? 'pedido' : 'pedidos'} da equipe pra apresentar`}>{pedidosReuniao}</span>
                    )}
                  </Link>
                ))}
              </div>
            )
          })}
        </nav>

        <div className="pl-sidebar-footer">
          <div className="pl-sidebar-tema"><span>Tema</span><PLThemeToggle /></div>
          <div className="pl-sidebar-user" title={`${usuario.nome}${rotuloPapel ? ` (${rotuloPapel})` : ''}`}>
            <span className="pl-sb-avatar" aria-hidden="true">{iniciaisDe(usuario.nome)}</span>
            <span className="pl-sidebar-user-texto"><b>{usuario.nome}</b><small>{rotuloPapel ?? 'gestor'}</small></span>
            <button className="pl-logout" onClick={logout} title="Sair" aria-label="Sair">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {menuAberto && <div className="pl-sidebar-backdrop" onClick={() => setMenuAberto(false)} />}
      <PaletaComandos itens={itensVisiveis.map(({ href, label }) => ({ href, label }))} podeCrm={podeCrm} />

      <div className="pl-main">
        <header className="pl-topbar-v2">
          <button type="button" className="pl-menu-toggle" onClick={() => setMenuAberto(true)} aria-label="Abrir menu" aria-expanded={menuAberto}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div className="pl-breadcrumb">
            <span>{grupoAtual ?? 'Pró-Labore'}</span>
            {paginaAtual && <><span aria-hidden="true">/</span><b>{paginaAtual.label}</b></>}
          </div>
          <div className="pl-topbar-acoes">
            <button type="button" className="pl-topo-busca" onClick={abrirPaleta} aria-label="Buscar aba, lead ou ação" data-abrir-paleta>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <span>Buscar…</span>
              <kbd>Ctrl K</kbd>
            </button>
            <PLThemeToggle />
          </div>
        </header>

        <div className="pl-shell">
          {nivelAtual === 'NENHUM' ? (
            <div className="pl-card pl-sem-acesso" role="alert">
              <div className="pl-card-title">Seu acesso não inclui {itemAtual?.label}</div>
              <p className="pl-card-sub">Peça ao gestor para liberar essa área em Acessos e permissões.{grupos[0]?.items[0] ? <> Enquanto isso, você pode usar <Link href={grupos[0].items[0].href}>{grupos[0].items[0].label}</Link>.</> : null}</p>
            </div>
          ) : (
            <>
              {isDono && <AvisoBanco />}
              {nivelAtual === 'VER' && itemAtual?.modulo !== 'painel' && (
                <div className="pl-alert pl-so-ver" role="status">{AVISO_SO_VER[itemAtual!.modulo!] ?? `Seu acesso a ${itemAtual!.label} é só para ver: dá para consultar, mas não mudar nada.`}</div>
              )}
              {children}
            </>
          )}

          <div className="pl-footer">
            <span>Pró-Labore — módulo pessoal do ARIES.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
