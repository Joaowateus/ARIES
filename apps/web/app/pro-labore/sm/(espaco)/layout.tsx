'use client'

// Espaço do papel Social Media (seção 3.1): menu lateral só com Trabalho e
// Resultado, cartão da conta da empresa e o nome do papel com Sair. O dono
// também entra aqui, no modo "ver como" (só leitura) ou como gestor.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { usePLTema } from '@/lib/proLaboreTheme'
import { definirVerComoSocialMedia, proLaboreApi, verComoSocialMediaAtivo, type SmAbaAssistente, type SmEu, type SmModulo, type SmNivel } from '@/lib/proLaboreApi'
import {
  Botao, CardEsqueleto, CartaoStatusConta, EstadoVazio, IcAtendimento, IcEstoque, IcCalendario, IcDesempenho, IcHoje, IcProducao, IcVendasPorPost,
  ListaAtalhos, PaletaSM, SidebarSM, SmApp, haQuanto, type ComandoPaleta, type ItemMenu, type StatusConta,
} from '../_ui'
import { EspacoSMCtx, atende } from './EspacoSM'

export default function LayoutEspacoSM({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useProLaboreAuth()
  const router = useRouter()
  useEffect(() => {
    if (loading) return
    if (!usuario) router.replace('/pro-labore/login')
    else if (usuario.papel === 'VENDEDOR' || usuario.papel === 'SUPERVISOR') router.replace('/pro-labore')
  }, [usuario, loading, router])
  if (loading || !usuario || (usuario.papel !== 'DONO' && usuario.papel !== 'SOCIAL_MEDIA')) return null
  return (
    <SmApp style={{ minHeight: '100vh' }}>
      <Espaco papel={usuario.papel}>{children}</Espaco>
    </SmApp>
  )
}

function textoConta(conta: NonNullable<SmEu['conta']>): { status: StatusConta; texto: string } {
  if (conta.status === 'bad') return { status: 'bad', texto: 'Falha na sincronização' }
  if (!conta.ultimaSincronizacaoEm) return { status: 'neutro', texto: 'Aguardando a primeira sincronização' }
  const ha = haQuanto(conta.ultimaSincronizacaoEm)
  return conta.status === 'warn' ? { status: 'warn', texto: `Última sincronização ${ha}` } : { status: 'ok', texto: ha === 'agora' ? 'Sincronizado agora' : `Sincronizado ${ha}` }
}

// Subtítulo de cada tela na paleta de comandos.
const SUB_TELA: Record<string, string> = {
  '/pro-labore/sm': 'Recepção e o que fazer agora',
  '/pro-labore/sm/calendario': 'A semana e as regras de publicação',
  '/pro-labore/sm/producao': 'Da ideia ao agendado',
  '/pro-labore/sm/atendimento': 'Direct e comentários',
  '/pro-labore/sm/estoque': 'Motos na loja',
  '/pro-labore/sm/desempenho': 'O que funcionou e por quê',
  '/pro-labore/sm/vendas-por-post': 'Leads e vendas de cada post',
}

// Telas cheias, sem o menu lateral: primeiro acesso (tela 08), modo foco (tela 09) e retrospectiva (tela 11).
const TELA_CHEIA = ['/pro-labore/sm/boas-vindas', '/pro-labore/sm/foco', '/pro-labore/sm/retrospectiva']

function Espaco({ papel, children }: { papel: 'DONO' | 'SOCIAL_MEDIA'; children: React.ReactNode }) {
  const { logout } = useProLaboreAuth()
  const router = useRouter()
  const caminho = usePathname()
  const [eu, setEu] = useState<SmEu | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const recarregar = useCallback(() => {
    proLaboreApi.sm.eu().then(r => { setEu(r); setErro(null) }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível abrir agora. Tente de novo em instantes.'))
  }, [])

  // Tema guardado nas Preferências (seção 15): vale em qualquer aparelho.
  // Aplica quando a escolha salva muda (não a cada troca local, que já salva).
  const plTema = usePLTema()
  const temaSalvo = eu?.tema ?? null
  useEffect(() => {
    if (!plTema || !temaSalvo) return
    const alvo = temaSalvo === 'CLARO' ? 'light' : 'dark'
    if (plTema.tema !== alvo) plTema.setTema(alvo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temaSalvo])
  useEffect(() => {
    recarregar()
    // O cartão da conta acompanha a sincronização sem recarregar a página.
    const t = setInterval(recarregar, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [recarregar])

  // Paleta de comandos (tela 10): aberta na tela em que foi chamada; mudar de tela fecha.
  const [paletaEm, setPaletaEm] = useState<string | null>(null)
  const [verAtalhos, setVerAtalhos] = useState(false)
  const paletaAberta = paletaEm === caminho

  // Atalhos globais (seção 11.3). Ctrl/Cmd + K vale em qualquer tela (menos nas
  // boas-vindas); os de uma letra não valem em campo de texto, com janela
  // aberta nem nas telas cheias (o modo foco tem os dele).
  useEffect(() => {
    if (!eu || caminho === '/pro-labore/sm/boas-vindas') return
    const { niveis, somenteLeitura } = eu
    const pode = (m: SmModulo, minimo: SmNivel = 'LEITURA') => atende(niveis[m], minimo)
    let g = 0
    function tecla(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setVerAtalhos(false)
        setPaletaEm(p => (p === caminho ? null : caminho))
        return
      }
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      const alvo = e.target as HTMLElement | null
      if (alvo?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return
      if (TELA_CHEIA.includes(caminho) || document.querySelector('[role="dialog"][aria-modal="true"]')) return
      const k = e.key.toLowerCase()
      const ir = (href: string) => { e.preventDefault(); router.push(href) }
      const avisar = (evento: string) => { e.preventDefault(); window.dispatchEvent(new Event(evento)) }
      if (g && Date.now() - g < 1500) {
        g = 0
        if (k === 'h') ir('/pro-labore/sm')
        else if (k === 'c' && pode('producao')) ir('/pro-labore/sm/calendario')
        else if (k === 'a' && pode('atendimento')) ir('/pro-labore/sm/atendimento')
        return
      }
      if (k === 'g') { g = Date.now(); return }
      if (e.key === '?') { e.preventDefault(); setVerAtalhos(true); return }
      if (k === 'f') ir('/pro-labore/sm/foco')
      else if (k === 'n' && pode('producao', 'COMPLETO') && !somenteLeitura) {
        if (caminho === '/pro-labore/sm/producao') avisar('sm:nova-pauta'); else ir('/pro-labore/sm/producao?nova=1')
      } else if (k === 'l' && pode('atendimento', 'COMPLETO') && !somenteLeitura) {
        if (caminho === '/pro-labore/sm/atendimento') avisar('sm:virar-lead'); else ir('/pro-labore/sm/atendimento?lead=1')
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [eu, caminho, router])

  // Primeiro acesso do Social Media: as boas-vindas vêm antes de tudo (seção 3.1).
  useEffect(() => {
    if (eu?.onboardingPendente && caminho !== '/pro-labore/sm/boas-vindas') router.replace('/pro-labore/sm/boas-vindas')
  }, [eu, caminho, router])

  const ctx = useMemo(() => eu && {
    eu,
    recarregar,
    pode: (m: SmModulo, minimo: SmNivel = 'LEITURA') => atende(eu.niveis[m], minimo),
  }, [eu, recarregar])

  function sairDoVerComo() {
    definirVerComoSocialMedia(false)
    router.push('/pro-labore/equipe/acessos')
  }

  if (erro && !eu) {
    return (
      <div style={{ padding: 32 }}>
        <EstadoVazio titulo="Não foi possível abrir o espaço do Social Media" acao={<Botao onClick={recarregar}>Tentar de novo</Botao>}>{erro}</EstadoVazio>
      </div>
    )
  }
  if (!eu || !ctx) return <div style={{ padding: 32, maxWidth: 960 }}><CardEsqueleto linhas={5} texto="Abrindo o espaço do Social Media" /></div>

  const verComo = eu.verComo || (papel === 'DONO' && verComoSocialMediaAtivo())
  const grupos: Array<{ rotulo: string; itens: ItemMenu[] }> = [
    { rotulo: 'Trabalho', itens: [
      { href: '/pro-labore/sm', rotulo: 'Hoje', icone: <IcHoje />, atalho: 'G H' },
      ...(ctx.pode('producao') ? [
        { href: '/pro-labore/sm/calendario', rotulo: 'Calendário', icone: <IcCalendario />, atalho: 'G C' },
        { href: '/pro-labore/sm/producao', rotulo: 'Produção', icone: <IcProducao /> },
      ] : []),
      ...(ctx.pode('atendimento') ? [{ href: '/pro-labore/sm/atendimento', rotulo: 'Atendimento', icone: <IcAtendimento />, contador: eu.contadores.atendimento, atalho: 'G A' }] : []),
      // O estoque é mantido pelo gestor (decisão P3). No menu do papel ele só
      // aparece quando o gestor libera o módulo como Completo.
      ...(eu.visao === 'GESTOR' || ctx.pode('estoque', 'COMPLETO') ? [{ href: '/pro-labore/sm/estoque', rotulo: 'Estoque', icone: <IcEstoque /> }] : []),
    ] },
    { rotulo: 'Resultado', itens: [
      ...(ctx.pode('analise') ? [{ href: '/pro-labore/sm/desempenho', rotulo: 'Desempenho', icone: <IcDesempenho /> }] : []),
      ...(ctx.pode('vendas') ? [{ href: '/pro-labore/sm/vendas-por-post', rotulo: 'Vendas por post', icone: <IcVendasPorPost /> }] : []),
    ] },
  ].filter(g => g.itens.length > 0)

  const conta = eu.conta
  const statusConta = conta && textoConta(conta)

  // Comandos da paleta: as telas e os atalhos que o papel pode usar.
  const podeEditarPauta = ctx.pode('producao', 'COMPLETO') && !eu.somenteLeitura
  const podeLead = ctx.pode('atendimento', 'COMPLETO') && !eu.somenteLeitura
  const esperando = eu.contadores.atendimento
  const comandos: ComandoPaleta[] = [
    { id: 'foco', ini: '▶', tom: 'nav', titulo: 'Começar modo foco', sub: 'O ritual do dia, uma coisa por vez', atalho: ['F'], palavras: 'ritual tarefas', executar: () => router.push('/pro-labore/sm/foco') },
    ...(podeEditarPauta ? [{ id: 'nova', ini: '+', tom: 'pri' as const, titulo: 'Nova pauta', sub: 'Abre o formulário na Produção', atalho: ['N'], palavras: 'criar post',
      executar: () => (caminho === '/pro-labore/sm/producao' ? window.dispatchEvent(new Event('sm:nova-pauta')) : router.push('/pro-labore/sm/producao?nova=1')) }] : []),
    ...(podeLead ? [{ id: 'lead', ini: 'L', tom: 'nav' as const, titulo: 'Responder e virar lead', sub: 'Abre a conversa com o formulário do CRM', atalho: ['L'], palavras: 'crm cliente',
      executar: () => (caminho === '/pro-labore/sm/atendimento' ? window.dispatchEvent(new Event('sm:virar-lead')) : router.push('/pro-labore/sm/atendimento?lead=1')) }] : []),
    ...grupos.flatMap(g => g.itens).map(i => ({
      id: `ir:${i.href}`, ini: i.icone, tom: 'nav' as const, titulo: `Ir para ${i.rotulo}`,
      sub: i.href === '/pro-labore/sm/atendimento' && esperando ? `${esperando} ${esperando === 1 ? 'conversa esperando' : 'conversas esperando'}` : SUB_TELA[i.href] ?? i.rotulo,
      atalho: i.atalho?.split(' '), palavras: i.href === '/pro-labore/sm' ? 'inicio recepcao' : undefined, executar: () => router.push(i.href),
    })),
    {
      id: 'tema', ini: '◐', tom: 'nav', titulo: plTema?.tema === 'light' ? 'Usar o tema escuro' : 'Usar o tema claro', sub: 'Fica guardado nas suas preferências', palavras: 'aparencia modo noturno claro escuro',
      executar: () => {
        const novo = plTema?.tema === 'light' ? 'dark' : 'light'
        plTema?.setTema(novo)
        if (!verComo) proLaboreApi.sm.preferencias.salvar({ tema: novo === 'light' ? 'CLARO' : 'ESCURO' }).then(recarregar).catch(() => undefined)
      },
    },
    { id: 'retro', ini: '★', tom: 'nav', titulo: 'Abrir a retrospectiva', sub: 'A semana em 5 partes: conquistas, metas, post, aprendizado e focos', palavras: 'semana relatorio conquistas', executar: () => router.push('/pro-labore/sm/retrospectiva') },
    ...(verComo ? [] : [{ id: 'preferencias', ini: '⚙', tom: 'nav' as const, titulo: 'Preferências', sub: 'Como te chamar, hora do ritual e avisos', palavras: 'configuracoes ajustes', executar: () => router.push('/pro-labore/sm/preferencias') }]),
    { id: 'atalhos', ini: '?', tom: 'nav', titulo: 'Ver todos os atalhos', sub: 'Atalhos do dia a dia', atalho: ['?'], palavras: 'teclado ajuda', executar: () => setVerAtalhos(true) },
  ]
  const abas: SmAbaAssistente[] = [
    ...(ctx.pode('producao') ? ['producao', 'calendario'] as const : []),
    ...(ctx.pode('atendimento') ? ['atendimento'] as const : []),
    ...(ctx.pode('analise') ? ['desempenho'] as const : []),
    ...(ctx.pode('vendas') ? ['atribuicao'] as const : []),
  ]
  const camadas = (
    <>
      {paletaAberta && <PaletaSM key={paletaEm} comandos={comandos} ia={eu.ia.ligada} abas={abas} aoFechar={() => setPaletaEm(null)} />}
      {verAtalhos && <ListaAtalhos aoFechar={() => setVerAtalhos(false)} />}
    </>
  )

  if (TELA_CHEIA.includes(caminho)) {
    return <EspacoSMCtx.Provider value={ctx}>{children}{camadas}</EspacoSMCtx.Provider>
  }
  if (eu.onboardingPendente) return <div style={{ padding: 32, maxWidth: 960 }}><CardEsqueleto linhas={5} texto="Abrindo as boas-vindas" /></div>

  return (
    <EspacoSMCtx.Provider value={ctx}>
      {verComo && (
        <div className="sm-aviso-verComo" role="status">
          <span>Você está vendo o que o Social Media enxerga. Só leitura: nada do que fizer aqui é salvo.</span>
          <Botao onClick={sairDoVerComo}>Sair da pré-visualização</Botao>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: verComo ? 'calc(100vh - 56px)' : '100vh' }}>
        <div style={{ flex: '1 1 232px', display: 'flex' }}>
          <SidebarSM
            grupos={grupos}
            papel={eu.visao === 'GESTOR' ? 'Gestor' : 'Social Media'}
            subtitulo={eu.visao === 'GESTOR' ? 'Social Media · visão do gestor' : 'Social Media · acesso isolado'}
            aoSair={papel === 'SOCIAL_MEDIA' ? logout : undefined}
            aoBuscar={() => { setVerAtalhos(false); setPaletaEm(caminho) }}
            preferencias={verComo ? undefined : '/pro-labore/sm/preferencias'}
            conta={
              <>
                {conta && statusConta
                  ? <CartaoStatusConta usuario={conta.usuario} tipo={conta.tipoConexao === 'EMPRESA' ? 'Conta da empresa' : 'Conta pessoal'} status={statusConta.status} texto={statusConta.texto} />
                  : <CartaoStatusConta usuario="Instagram" tipo="Não conectado" status="neutro" texto="O gestor precisa conectar a conta da empresa" />}
                {papel === 'DONO' && !verComo && <Link href="/pro-labore" className="sm-btn">Voltar ao painel</Link>}
              </>
            }
          />
        </div>
        <main style={{ flex: '999 1 560px', minWidth: 0, padding: 'clamp(20px, 4vw, 32px) clamp(16px, 4vw, 40px) 56px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {children}
        </main>
      </div>
      {camadas}
    </EspacoSMCtx.Provider>
  )
}
