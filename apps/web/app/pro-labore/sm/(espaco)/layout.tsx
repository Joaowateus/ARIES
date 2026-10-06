'use client'

// Espaço do papel Social Media (seção 3.1): menu lateral só com Trabalho e
// Resultado, cartão da conta da empresa e o nome do papel com Sair. O dono
// também entra aqui, no modo "ver como" (só leitura) ou como gestor.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { definirVerComoSocialMedia, proLaboreApi, verComoSocialMediaAtivo, type SmEu, type SmModulo, type SmNivel } from '@/lib/proLaboreApi'
import {
  Botao, CartaoStatusConta, EstadoVazio, IcAtendimento, IcEstoque, IcCalendario, IcDesempenho, IcHoje, IcProducao, IcVendasPorPost,
  SidebarSM, SmApp, haQuanto, type ItemMenu, type StatusConta,
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

function Espaco({ papel, children }: { papel: 'DONO' | 'SOCIAL_MEDIA'; children: React.ReactNode }) {
  const { logout } = useProLaboreAuth()
  const router = useRouter()
  const [eu, setEu] = useState<SmEu | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(() => {
    proLaboreApi.sm.eu().then(r => { setEu(r); setErro(null) }).catch(e => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
  }, [])
  useEffect(() => {
    recarregar()
    // O cartão da conta acompanha a sincronização sem recarregar a página.
    const t = setInterval(recarregar, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [recarregar])

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
  if (!eu || !ctx) return <div style={{ padding: 32 }} className="sm-legenda" role="status">Carregando…</div>

  const verComo = eu.verComo || (papel === 'DONO' && verComoSocialMediaAtivo())
  const grupos: Array<{ rotulo: string; itens: ItemMenu[] }> = [
    { rotulo: 'Trabalho', itens: [
      { href: '/pro-labore/sm', rotulo: 'Hoje', icone: <IcHoje /> },
      ...(ctx.pode('producao') ? [
        { href: '/pro-labore/sm/calendario', rotulo: 'Calendário', icone: <IcCalendario /> },
        { href: '/pro-labore/sm/producao', rotulo: 'Produção', icone: <IcProducao /> },
      ] : []),
      ...(ctx.pode('atendimento') ? [{ href: '/pro-labore/sm/atendimento', rotulo: 'Atendimento', icone: <IcAtendimento />, contador: eu.contadores.atendimento }] : []),
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
    </EspacoSMCtx.Provider>
  )
}
