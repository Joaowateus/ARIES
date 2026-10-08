'use client'

// Conta do Instagram da EMPRESA (seção 3.2 da especificação do Social
// Media): conexão pelo usuário do sistema do Business Manager, status da
// sincronização com nova tentativa automática, avisos ao gestor, histórico
// e diagnóstico. Não depende do login pessoal de ninguém.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  proLaboreApi,
  type AvisoSocial,
  type ContaInstagramDaEmpresa,
  type DiagnosticoSocialEmpresa,
  type ErroApi,
  type SincronizacaoSocial,
  type SocialMediaConta,
} from '@/lib/proLaboreApi'

function tempoDesde(iso: string | null | undefined): string {
  if (!iso) return 'nunca'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora há pouco'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h}h`
  return `em ${new Date(iso).toLocaleDateString('pt-BR')}`
}
// Mesmo fuso do servidor e do resto do sistema (Belém = Brasília).
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Belem' })

// Linha de status da sincronização: verde com o tempo desde a última, ou
// vermelha com o motivo e a hora da nova tentativa automática.
export function StatusSincronizacao({ conta, sincronizando }: { conta: SocialMediaConta; sincronizando: boolean }) {
  if (sincronizando) return <div className="pl-sv-status rodando"><span className="ponto" aria-hidden="true" />Sincronizando com o Instagram…</div>
  if (conta.ultimoErroSync) {
    return (
      <div className="pl-sv-status falha" role="alert">
        <span className="ponto" aria-hidden="true" />
        <span>
          <b>Falha na sincronização</b> · {conta.ultimoErroSync}
          {conta.proximaTentativaEm && <> Nova tentativa automática às {hora(conta.proximaTentativaEm)}.</>}
          {' '}Última com sucesso {tempoDesde(conta.ultimaSincronizacaoEm)}.
        </span>
      </div>
    )
  }
  return <div className="pl-sv-status ok"><span className="ponto" aria-hidden="true" />Sincronizado {tempoDesde(conta.ultimaSincronizacaoEm)}</div>
}

const PASSOS_TOKEN = [
  <>No <b>business.facebook.com</b>, abra Configurações do negócio → Usuários → <b>Usuários do sistema</b>.</>,
  <>Escolha o usuário do sistema do ARIES (o mesmo do Tráfego) e confira em <b>Atribuir ativos</b> se ele tem a Página da empresa e a conta do Instagram.</>,
  <>Clique em <b>Gerar novo token</b>, escolha o app do ARIES e marque instagram_basic, instagram_manage_insights, pages_show_list, pages_read_engagement, business_management, instagram_manage_comments, instagram_manage_messages e instagram_content_publish.</>,
  <>Copie o token e cole abaixo. Cole só aqui, nunca em mensagem.</>,
]

export function ConectarEmpresa({ conversao, onConectado, onCancelar }: { conversao?: boolean; onConectado: (r: { conta: SocialMediaConta; erroSync: string | null; permissoesFaltando: string[] }) => void; onCancelar?: () => void }) {
  const [token, setToken] = useState('')
  const [contas, setContas] = useState<ContaInstagramDaEmpresa[] | null>(null)
  const [escolhida, setEscolhida] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      const r = await proLaboreApi.socialMedia.conectarEmpresa(token.trim(), escolhida || undefined)
      setToken('')
      onConectado(r)
    } catch (err) {
      const dados = (err as ErroApi).dados as { contas?: ContaInstagramDaEmpresa[] } | undefined
      if (dados?.contas?.length) { setContas(dados.contas); setEscolhida(dados.contas[0].instagramUserId) }
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pl-card pl-sv-empresa">
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">{conversao ? 'Passar a conta para a conexão pela empresa' : 'Conectar pela empresa (recomendado)'}</div>
          <div className="pl-card-sub">
            A conta fica ligada ao Business Manager da MM, não ao login de uma pessoa. Se o responsável mudar, nada para de sincronizar.
            {conversao && ' O histórico já sincronizado continua.'}
          </div>
        </div>
      </div>
      <ol className="pl-sv-empresa-passos">{PASSOS_TOKEN.map((p, i) => <li key={i}>{p}</li>)}</ol>
      <form onSubmit={enviar}>
        <label className="pl-field">
          <span>Token do usuário do sistema</span>
          <textarea className="pl-input" rows={3} style={{ fontFamily: 'monospace', fontSize: 12 }} value={token} onChange={e => setToken(e.target.value)} required placeholder="Cole aqui o token gerado no Business Manager" />
        </label>
        {contas && (
          <fieldset className="pl-sv-empresa-contas">
            <legend>Qual é o Instagram da empresa?</legend>
            {contas.map(c => (
              <label key={c.instagramUserId}>
                <input type="radio" name="ig-empresa" checked={escolhida === c.instagramUserId} onChange={() => setEscolhida(c.instagramUserId)} />
                @{c.nomeUsuario} <small>· Página {c.paginaNome}</small>
              </label>
            ))}
          </fieldset>
        )}
        {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 10 }}>{erro}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="submit" className="pl-btn pl-btn-primary" disabled={enviando}>{enviando ? 'Conectando e sincronizando…' : 'Conectar pela empresa'}</button>
          {onCancelar && <button type="button" className="pl-btn pl-btn-ghost" onClick={onCancelar}>Cancelar</button>}
        </div>
      </form>
    </div>
  )
}

export function DiagnosticoEmpresa({ onTrocarToken, onFechar }: { onTrocarToken: () => void; onFechar: () => void }) {
  const [resultado, setResultado] = useState<DiagnosticoSocialEmpresa | null>(null)
  const [rodando, setRodando] = useState(false)
  const [erro, setErro] = useState('')
  async function rodar() {
    setRodando(true); setErro('')
    try { setResultado(await proLaboreApi.socialMedia.diagnosticoEmpresa()) } catch (e) { setErro((e as Error).message) } finally { setRodando(false) }
  }
  const primeiroErro = resultado?.passos.find(p => p.nivel === 'erro')
  return (
    <div className="pl-card pl-tf-diagcon">
      <div className="pl-tf-diagcon-topo">
        <div>
          <div className="pl-card-title">Diagnóstico da conexão do Instagram</div>
          <div className="pl-card-sub">Testa o token, as permissões, o acesso à conta e a leitura dos dados, e mostra como resolver o que falhar.</div>
        </div>
        <div className="pl-tf-diagcon-acoes">
          <button type="button" className="pl-btn pl-btn-primary pl-tf-btn-peq" disabled={rodando} onClick={() => void rodar()}>{rodando ? 'Testando…' : resultado ? 'Testar de novo' : 'Diagnosticar conexão'}</button>
          <button type="button" className="pl-btn pl-btn-ghost pl-tf-btn-peq" onClick={onFechar}>Fechar</button>
        </div>
      </div>
      {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 10 }}>{erro}</div>}
      {resultado && (
        <div className="pl-tf-diagcon-corpo">
          <ul className="pl-tf-diagcon-passos">
            {resultado.passos.map(p => (
              <li key={p.chave} className={p.nivel === 'ok' ? 'ok' : p.nivel === 'aviso' ? 'aviso' : 'falhou'}>
                <span className="icone" aria-hidden="true">{p.nivel === 'ok' ? '✓' : '!'}</span>
                <div><b>{p.titulo}</b><small>{p.detalhe}</small></div>
              </li>
            ))}
          </ul>
          <div className={`pl-tf-diagcon-resolver ${primeiroErro ? 'falhou' : 'ok'}`}>
            <b>{resultado.resolver.titulo}</b>
            {resultado.resolver.passos.length > 0 && <ol>{resultado.resolver.passos.map((t, i) => <li key={i}>{t}</li>)}</ol>}
            {primeiroErro && (primeiroErro.chave === 'token' || primeiroErro.chave === 'permissoes') && (
              <button type="button" className="pl-btn pl-btn-primary pl-tf-btn-peq" onClick={onTrocarToken}>Colar token novo</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Avisos ao gestor (ex.: falha de sincronização). Falhas seguidas do mesmo
// motivo aparecem como um aviso só, com a contagem.
export function AvisosSocial({ versao }: { versao: string }) {
  const [avisos, setAvisos] = useState<AvisoSocial[]>([])
  useEffect(() => {
    let cancelado = false
    // A falha de sincronização já aparece no status do cartão da conta (e
    // como selo no menu): aqui só os outros avisos, sem repetir a mensagem.
    proLaboreApi.socialMedia.avisos().then(a => { if (!cancelado) setAvisos(a.filter(x => !x.lidaEm && x.tipo !== 'SYNC_FALHA')) }).catch(() => {})
    return () => { cancelado = true }
  }, [versao])
  if (!avisos.length) return null
  return (
    <div className="pl-sv-avisos" role="region" aria-label="Avisos">
      {avisos.map(a => (
        <div key={a.id} className={`pl-sv-aviso ${a.tipo === 'SYNC_FALHA' ? 'erro' : 'info'}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 2 21h20L12 3Zm0 6v5m0 3v.5" /></svg>
          <div style={{ flex: 1 }}>
            <b>{a.titulo}</b>{a.ocorrencias > 1 && <span className="pl-sv-rec-conf">{a.ocorrencias} tentativas</span>}
            <div>{a.texto}</div>
          </div>
          {a.payload?.href && <Link href={a.payload.href} className="pl-link-action">Abrir</Link>}
          <button type="button" className="pl-link-action" onClick={() => { void proLaboreApi.socialMedia.marcarAvisoLido(a.id); setAvisos(l => l.filter(x => x.id !== a.id)) }}>Marcar como lido</button>
        </div>
      ))}
    </div>
  )
}

const NOME_JOB: Record<SincronizacaoSocial['job'], string> = { MANUAL: 'Manual', CONEXAO: 'Conexão', HORA: 'De hora em hora', DIA: 'Diária', RETENTATIVA: 'Nova tentativa' }

export function HistoricoSincronizacoes({ versao }: { versao: string }) {
  const [itens, setItens] = useState<SincronizacaoSocial[] | null>(null)
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    if (!aberto) return
    let cancelado = false
    proLaboreApi.socialMedia.sincronizacoes().then(l => { if (!cancelado) setItens(l) }).catch(() => {})
    return () => { cancelado = true }
  }, [aberto, versao])
  return (
    <details className="pl-sv-historico" onToggle={e => setAberto((e.target as HTMLDetailsElement).open)}>
      <summary>Histórico de sincronizações</summary>
      {!itens ? <div className="pl-hint">Carregando…</div> : itens.length === 0 ? <div className="pl-hint">Nenhuma sincronização registrada ainda.</div> : (
        <ul>
          {itens.map(s => (
            <li key={s.id} className={s.status === 'ERRO' ? 'erro' : s.status === 'SUCESSO' ? 'ok' : ''}>
              <span>{new Date(s.iniciadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              <span>{NOME_JOB[s.job]}</span>
              <span>{s.status === 'ERRO' ? s.erro : s.status === 'SUCESSO' ? `${s.resumo?.insightsAtualizados ?? 0} posts e ${s.resumo?.diasAtualizados ?? 0} dias atualizados` : 'Rodando…'}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
