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
import { AvisoLigacao } from './_ligacoes/AvisoLigacao'
import type { LigacaoAgora } from '@/lib/proLaboreApi'

// `modulo`: chave do módulo nos acessos da equipe (lib/acessos.ts da API).
// paraEquipe: aparece para toda a equipe mesmo sem o módulo (a página mostra a versão pessoal).
// gestao: só dono e supervisor (a página é da gestão, mesmo com o módulo liberado).
interface NavPagina { href: string; label: string; modulo?: string; donoOnly?: boolean; hideFromVendedor?: boolean; paraEquipe?: boolean; gestao?: boolean }
// Item do menu: uma página só ou várias páginas juntas, que viram abas no topo da tela.
interface NavItem extends NavPagina { icon: NavIconName; abas?: NavPagina[] }
interface NavGroup { label: string | null; items: NavItem[] }

// Menu enxuto (fase 6): o que é do mesmo trabalho fica num item só, com abas
// no topo — CRM (Funil e Perdidos), Meu dia (Agenda e Ligações), Análise
// (Central de Inteligência, Plano de Crescimento e Indicadores) e Equipe
// (Vendedores, Acessos e Ocorrências). Os endereços antigos continuam valendo.
const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [
    { href: '/pro-labore', label: 'Dashboard', icon: 'home', modulo: 'painel' },
  ] },
  { label: 'Vendas', items: [
    { href: '/pro-labore/leads', label: 'CRM', icon: 'kanban', modulo: 'crm', abas: [
      { href: '/pro-labore/leads', label: 'Funil', modulo: 'crm' },
      { href: '/pro-labore/credito', label: 'Crédito', modulo: 'crm' },
      { href: '/pro-labore/reativacao', label: 'Perdidos (Reativação)', modulo: 'crm' },
    ] },
    // Agenda do dia e os lembretes de ligação (avulsos e cadências), lado a lado.
    { href: '/pro-labore/agenda', label: 'Meu dia', icon: 'calendar', abas: [
      { href: '/pro-labore/agenda', label: 'Agenda', modulo: 'agenda' },
      { href: '/pro-labore/ligacoes', label: 'Ligações', modulo: 'crm' },
    ] },
    // Cada vendedor tem o próprio assistente, ligado ao próprio número (escopo no backend).
    { href: '/pro-labore/whatsapp', label: 'WhatsApp', icon: 'chat', modulo: 'assistente' },
    // Cada pessoa tem o próprio copiloto (o escopo é feito no backend); o dono vê o da equipe.
    { href: '/pro-labore/copiloto', label: 'Copiloto', icon: 'spark', modulo: 'copiloto' },
  ] },
  { label: 'Gestão', items: [
    { href: '/pro-labore/vendas', label: 'Vendas', icon: 'cart', modulo: 'vendas', donoOnly: true },
    // Salários, investimentos, custos e outros gastos, com recibo.
    { href: '/pro-labore/financeiro', label: 'Financeiro', icon: 'wallet', modulo: 'financeiro', donoOnly: true },
    { href: '/pro-labore/assistente', label: 'Análise', icon: 'compass', abas: [
      { href: '/pro-labore/assistente', label: 'Central de Inteligência', modulo: 'assistente', gestao: true },
      { href: '/pro-labore/plano-crescimento', label: 'Plano de Crescimento', modulo: 'planoCrescimento', donoOnly: true },
      { href: '/pro-labore/indicadores', label: 'Indicadores', modulo: 'indicadores', donoOnly: true },
    ] },
  ] },
  { label: 'Marketing', items: [
    // Sem donoOnly: cada pessoa conecta o próprio Instagram e só vê o dela.
    { href: '/pro-labore/social-media', label: 'Social Media', icon: 'at', modulo: 'socialMedia' },
    { href: '/pro-labore/trafego', label: 'Tráfego', icon: 'funnel', modulo: 'trafego', donoOnly: true },
  ] },
  { label: 'Rotina', items: [
    // Bloco pessoal de reuniões/anotações, cada um só vê o próprio (escopo no backend).
    { href: '/pro-labore/reunioes', label: 'Reuniões', icon: 'mic', modulo: 'reunioes' },
    { href: '/pro-labore/anotacoes', label: 'Anotações', icon: 'notebook', modulo: 'anotacoes' },
  ] },
  { label: 'Equipe', items: [
    { href: '/pro-labore/vendedores', label: 'Equipe', icon: 'users', abas: [
      { href: '/pro-labore/vendedores', label: 'Vendedores', modulo: 'vendedores', donoOnly: true },
      { href: '/pro-labore/equipe/acessos', label: 'Acessos e permissões', donoOnly: true },
      // A gestão é do dono e de quem tem o módulo; o resto da equipe vê só as próprias.
      { href: '/pro-labore/ocorrencias', label: 'Ocorrências', modulo: 'ocorrencias', paraEquipe: true },
      // PDF 02: Saúde dos dados e a auditoria — dono vê tudo, supervisor a da equipe.
      { href: '/pro-labore/dados', label: 'Dados e auditoria', gestao: true },
    ] },
  ] },
  { label: 'Sistema', items: [
    { href: '/pro-labore/configuracoes', label: 'Configurações', icon: 'gear', modulo: 'configuracoes', donoOnly: true },
  ] },
]
// Nomes antigos que a busca (Ctrl+K) continua achando.
const APELIDOS: Record<string, string[]> = {
  '/pro-labore/whatsapp': ['Assistente Comercial'],
  '/pro-labore/copiloto': ['Copiloto Comercial'],
  '/pro-labore/reativacao': ['Reativação'],
  '/pro-labore/assistente': ['Assistente Comercial (gestão)'],
}
const paginasDo = (item: NavItem): NavPagina[] => item.abas ?? [item]
const bate = (pathname: string, href: string) => pathname === href || (href !== '/pro-labore' && pathname.startsWith(`${href}/`))

// Aviso no topo quando o acesso à área é só para ver.
const AVISO_SO_VER: Record<string, string> = {
  agenda: 'Você pode ver e concluir as suas tarefas. Criar e mudar tarefas depende do gestor.',
}

// Módulo da página aberta: a página do menu com o caminho mais longo que bate.
function itemDaPagina(pathname: string): NavPagina | undefined {
  return NAV_GROUPS.flatMap(g => g.items.flatMap(paginasDo))
    .filter(i => bate(pathname, i.href))
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
  // Ligações da própria pessoa que chegaram na hora: aviso na tela (e no computador).
  const [ligacoesAgora, setLigacoesAgora] = useState<LigacaoAgora[]>([])
  // Ligou, registrou ou adiou pelo aviso: busca os selos de novo na hora.
  const [versaoBarra, setVersaoBarra] = useState(0)
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
        if (b.ligacoes) { setLigacoesDia({ atrasadas: b.ligacoes.atrasadas, hoje: b.ligacoes.hoje }); setLigacoesAgora(b.ligacoes.agora ?? []) }
        setAvisosSocial(b.avisosSocial)
      }).catch(() => undefined)
    }
    buscar()
    const t = setInterval(buscar, 45_000)
    document.addEventListener('visibilitychange', buscar)
    return () => { cancelado = true; clearInterval(t); document.removeEventListener('visibilitychange', buscar) }
  }, [usuario, versaoBarra])
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
  const nivelDe = (item?: NavPagina) => (!item?.modulo || !acessos ? null : acessos[item.modulo] ?? 'NENHUM')
  const daEquipe = usuario.papel === 'VENDEDOR' || usuario.papel === 'SUPERVISOR'
  const podeVerItem = (item: NavPagina) => {
    if (item.gestao && !isDono && usuario.papel !== 'SUPERVISOR') return false
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
    ...NAV_GROUPS.map(grupo => ({
      ...grupo,
      // Item com abas: aparece se alguma aba é liberada e abre na primeira liberada.
      items: grupo.items.flatMap((item): NavItem[] => {
        if (!item.abas) return podeVerItem(item) ? [item] : []
        const abas = item.abas.filter(podeVerItem)
        return abas.length ? [{ ...item, href: abas[0].href, abas }] : []
      }),
    })),
  ].filter(grupo => grupo.items.length > 0)
  const itensVisiveis = grupos.flatMap(g => g.items)
  const paginasVisiveis = itensVisiveis.flatMap(paginasDo)
  const itemDoMenuAtual = itemAtual ? itensVisiveis.find(i => paginasDo(i).some(p => p.href === itemAtual.href)) : undefined
  const ativo = (item: NavItem) => item === itemDoMenuAtual
  const paginaAtual = itemAtual && bate(pathname, itemAtual.href) ? paginasVisiveis.find(p => p.href === itemAtual.href) : undefined
  const grupoAtual = grupos.find(g => g.items.includes(itemDoMenuAtual as NavItem))?.label ?? null
  const abasDoTopo = itemDoMenuAtual?.abas && itemDoMenuAtual.abas.length > 1 ? itemDoMenuAtual.abas : null
  const temPagina = (item: NavItem, href: string) => paginasDo(item).some(p => p.href === href)
  const podeCrm = paginasVisiveis.some(item => item.href === '/pro-labore/leads')
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
                    className={`pl-sidebar-link ${ativo(item) ? 'active' : ''}`}
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
                    {temPagina(item, '/pro-labore/leads') && followsDia.atrasados + followsDia.hoje > 0 && (
                      <span className={`pl-nav-pedidos ${followsDia.atrasados > 0 ? 'pl-nav-follow-atrasado' : ''}`} title={[followsDia.atrasados && `${followsDia.atrasados} follow${followsDia.atrasados > 1 ? 's' : ''} atrasado${followsDia.atrasados > 1 ? 's' : ''}`, followsDia.hoje && `${followsDia.hoje} para hoje`].filter(Boolean).join(' · ')} data-follows-menu>{followsDia.atrasados + followsDia.hoje}</span>
                    )}
                    {temPagina(item, '/pro-labore/ligacoes') && ligacoesDia.atrasadas + ligacoesDia.hoje > 0 && (
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
      <PaletaComandos itens={[
        ...itensVisiveis.map(({ href, label }) => ({ href, label })),
        ...itensVisiveis.flatMap(i => (i.abas && i.abas.length > 1 ? i.abas.map(a => ({ href: a.href, label: `${i.label} · ${a.label}` })) : [])),
        ...paginasVisiveis.flatMap(p => (APELIDOS[p.href] ?? []).map(label => ({ href: p.href, label }))),
      ]} podeCrm={podeCrm} />
      <AvisoLigacao itens={ligacoesAgora} onMudou={() => setVersaoBarra(v => v + 1)} />

      <div className="pl-main">
        <header className="pl-topbar-v2">
          <button type="button" className="pl-menu-toggle" onClick={() => setMenuAberto(true)} aria-label="Abrir menu" aria-expanded={menuAberto}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div className="pl-breadcrumb">
            <span>{grupoAtual ?? 'Pró-Labore'}</span>
            {itemDoMenuAtual && <><span aria-hidden="true">/</span><b>{itemDoMenuAtual.label}</b></>}
            {abasDoTopo && paginaAtual && <><span aria-hidden="true">/</span><b>{paginaAtual.label}</b></>}
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
              {abasDoTopo && (
                <nav className="pl-hub-abas" aria-label={itemDoMenuAtual!.label} data-abas-topo>
                  {abasDoTopo.map(a => (
                    <Link key={a.href} href={a.href} className={a.href === itemAtual?.href ? 'ativo' : ''} aria-current={a.href === itemAtual?.href ? 'page' : undefined}>
                      {a.label}
                      {a.href === '/pro-labore/ligacoes' && ligacoesDia.atrasadas + ligacoesDia.hoje > 0 && <span className="pl-hub-abas-n">{ligacoesDia.atrasadas + ligacoesDia.hoje}</span>}
                    </Link>
                  ))}
                </nav>
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
