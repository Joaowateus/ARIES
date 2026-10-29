'use client'

// Referências (benchmark): para cada moto do estoque, os vídeos públicos do
// Instagram com mais engajamento (busca pelas hashtags da moto) e os perfis
// que a loja usa como referência, com os melhores vídeos de cada um. O vídeo
// abre aqui mesmo (incorporado do Instagram). A régua é curtidas +
// comentários: o Instagram não informa visualizações nem alcance de outras contas.
import { useCallback, useEffect, useState } from 'react'
import { proLaboreApi, type SmReferencias, type SmVideoReferencia } from '@/lib/proLaboreApi'
import { Banner, Botao, CardEsqueleto, Chip, EstadoVazio, Modal, Rotulo, Segmentado, haQuanto, useToast } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'

const num = (v: number | null) => (v == null ? '—' : v.toLocaleString('pt-BR'))
const trecho = (t: string | null) => (t ? (t.length > 140 ? `${t.slice(0, 139)}…` : t) : '')
/** Endereço de incorporação do Instagram para o post/reel. */
const embed = (permalink: string) => `${permalink.replace(/\?.*$/, '').replace(/\/$/, '')}/embed`

function Video({ v, posicao, aoAssistir }: { v: SmVideoReferencia; posicao: number; aoAssistir: () => void }) {
  return (
    <li className="sm-ref-video" data-video-ref={v.id}>
      <span className="sm-ref-pos" aria-label={`${posicao}º`}>{posicao}</span>
      <div className="sm-ref-video-corpo">
        <div className="sm-ref-numeros">
          <b title="Curtidas + comentários">{num(v.engajamento)}</b><span>engajamento</span>
          <span>· {num(v.curtidas)} curtidas · {num(v.comentarios)} comentários</span>
          {v.taxa != null && <Chip tom="info" titulo="Engajamento ÷ seguidores do perfil">{v.taxa.toLocaleString('pt-BR')}% dos seguidores</Chip>}
        </div>
        <p>{trecho(v.legenda) || <i>sem legenda</i>}</p>
        <div className="sm-ref-meta">
          <span>{v.autor ? `@${v.autor}` : `via #${v.fonte}`}</span>
          {v.formato && <span>{v.formato === 'REELS' ? 'Reels' : 'Vídeo'}</span>}
          {v.publicadoEm && <span>{haQuanto(v.publicadoEm)}</span>}
        </div>
        <div className="sm-ref-acoes">
          <Botao variante="sec" onClick={aoAssistir} data-assistir>Assistir aqui</Botao>
          <a className="sm-ref-link" href={v.permalink} target="_blank" rel="noreferrer">Abrir no Instagram ↗</a>
        </div>
      </div>
    </li>
  )
}

function Hashtags({ chave, hashtags, podeEditar, aoSalvar }: { chave: string; hashtags: string[]; podeEditar: boolean; aoSalvar: (lista: string[]) => Promise<boolean> }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(hashtags.map(h => `#${h}`).join(' '))
  if (!editando) {
    return (
      <span className="sm-ref-tags">
        {hashtags.map(h => <Chip key={h}>#{h}</Chip>)}
        {podeEditar && <button type="button" className="sm-link-botao" onClick={() => setEditando(true)} data-editar-hashtags={chave}>editar</button>}
      </span>
    )
  }
  return (
    <form className="sm-ref-tags-form" onSubmit={async e => { e.preventDefault(); if (await aoSalvar(texto.split(/[\s,]+/).filter(Boolean))) setEditando(false) }}>
      <input className="sm-input" value={texto} onChange={e => setTexto(e.target.value)} placeholder="#cg160 #hondacg160" aria-label="Hashtags da moto (até 3)" data-hashtags-input />
      <Botao type="submit" variante="pri">Salvar</Botao>
      <Botao variante="fantasma" onClick={() => setEditando(false)}>Cancelar</Botao>
    </form>
  )
}

export default function ReferenciasPage() {
  const { pode } = useEspacoSM()
  const toast = useToast()
  const [dados, setDados] = useState<SmReferencias | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aba, setAba] = useState<'motos' | 'perfis'>('motos')
  const [moto, setMoto] = useState<string | null>(null)
  const [novo, setNovo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [assistindo, setAssistindo] = useState<SmVideoReferencia | null>(null)

  const carregar = useCallback(() => {
    proLaboreApi.sm.referencias.ver().then(d => { setDados(d); setErro(null) }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar agora.'))
  }, [])
  useEffect(() => { if (pode('producao')) carregar() }, [carregar, pode])

  async function acao(fn: () => Promise<SmReferencias>, ok?: string) {
    setOcupado(true)
    try { setDados(await fn()); if (ok) toast({ mensagem: ok }); return true }
    catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível concluir', tom: 'bad' }); return false }
    finally { setOcupado(false) }
  }

  if (!pode('producao')) return <div className="sm-card"><EstadoVazio titulo="Sem acesso às referências">O gestor pode liberar o módulo Produção em Equipe → Acessos e permissões.</EstadoVazio></div>
  const motoAtual = dados?.motos.find(m => m.chave === moto) ?? dados?.motos[0] ?? null

  return (
    <>
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Trabalho · Referências</Rotulo>
          <h1 className="sm-ttl sm-h1">Os vídeos que mais engajam, por moto do estoque</h1>
          <p>Referências públicas do Instagram para cada moto que está na loja e dos perfis que servem de exemplo. Atualiza sozinho todo dia.</p>
        </div>
        {dados?.podeEditar && dados.disponivel && <Botao variante="sec" disabled={ocupado} onClick={() => acao(() => proLaboreApi.sm.referencias.atualizar(), 'Referências atualizadas.')} data-atualizar-referencias>{ocupado ? 'Buscando…' : 'Atualizar agora'}</Botao>}
      </header>
      {erro && <p className="sm-erro" role="alert">{erro}</p>}
      {!dados && !erro && <CardEsqueleto linhas={6} texto="Buscando as referências" />}
      {dados && !dados.disponivel && (
        <Banner tom="warn" titulo="Conecte o Instagram da loja pela empresa (Meta)">A busca de vídeos públicos usa a API do Instagram ligada à página do Facebook da loja. O gestor conecta em Social Media → Conexão.</Banner>
      )}
      {dados && dados.disponivel && (
        <div className="sm-ref">
          <p className="sm-legenda sm-ref-nota">
            Ordem por <b>engajamento</b> (curtidas + comentários). O Instagram não informa visualizações nem alcance de vídeos de outras contas. Hashtags pesquisadas nesta semana: {dados.hashtagsSemana.usadas} de {dados.hashtagsSemana.limite} (limite do Instagram).
          </p>
          <Segmentado rotulo="Referências" valor={aba} aoMudar={v => setAba(v)} opcoes={[{ valor: 'motos', rotulo: `Por moto (${dados.motos.length})` }, { valor: 'perfis', rotulo: `Perfis de referência (${dados.perfis.length})` }]} />

          {aba === 'motos' && (dados.motos.length === 0 ? (
            <EstadoVazio titulo="Nenhuma moto no estoque">Cadastre as motos em Estoque: cada modelo ganha as suas referências.</EstadoVazio>
          ) : (
            <div className="sm-ref-grade">
              <nav className="sm-ref-motos" aria-label="Motos do estoque">
                {dados.motos.map(m => (
                  <button key={m.chave} type="button" className={`sm-ref-moto ${motoAtual?.chave === m.chave ? 'ativo' : ''}`} onClick={() => setMoto(m.chave)} data-moto-ref={m.chave}>
                    <b>{m.nome}</b>
                    <span>{m.videos.length ? `${m.videos.length} vídeos` : m.buscadoEm ? 'nada encontrado' : 'aguardando busca'}{m.quantidade > 1 ? ` · ${m.quantidade} no estoque` : ''}</span>
                  </button>
                ))}
              </nav>
              {motoAtual && (
                <section className="sm-card sm-ref-painel" aria-label={motoAtual.nome}>
                  <div className="sm-ref-painel-cab">
                    <h2 className="sm-h-card">{motoAtual.nome}</h2>
                    <Hashtags key={motoAtual.chave + motoAtual.hashtags.join()} chave={motoAtual.chave} hashtags={motoAtual.hashtags} podeEditar={dados.podeEditar} aoSalvar={lista => acao(() => proLaboreApi.sm.referencias.salvarHashtags(motoAtual.chave, lista), 'Hashtags salvas: a moto entra na próxima busca.')} />
                    <span className="sm-legenda">{motoAtual.buscadoEm ? `Buscado ${haQuanto(motoAtual.buscadoEm)}` : 'Ainda não buscado'}</span>
                  </div>
                  {motoAtual.ultimoErro && <Banner tom="warn" titulo="Busca da moto">{motoAtual.ultimoErro}</Banner>}
                  {motoAtual.videos.length === 0 ? <EstadoVazio titulo="Sem vídeos ainda">{motoAtual.buscadoEm ? 'Nenhum vídeo nas hashtags desta moto: tente outras hashtags.' : 'Toque em "Atualizar agora" ou espere a busca automática do dia.'}</EstadoVazio> : (
                    <ol className="sm-ref-lista">{motoAtual.videos.map((v, i) => <Video key={v.id} v={v} posicao={i + 1} aoAssistir={() => setAssistindo(v)} />)}</ol>
                  )}
                </section>
              )}
            </div>
          ))}

          {aba === 'perfis' && (
            <>
              {dados.podeEditar && (
                <form className="sm-ref-novo" onSubmit={async e => { e.preventDefault(); if (await acao(() => proLaboreApi.sm.referencias.adicionarPerfil(novo), 'Perfil adicionado.')) setNovo('') }}>
                  <input className="sm-input" value={novo} onChange={e => setNovo(e.target.value)} placeholder="@perfil.de.referencia ou link do Instagram" aria-label="Perfil de referência" data-novo-perfil-ref />
                  <Botao type="submit" variante="pri" disabled={ocupado || !novo.trim()}>Adicionar</Botao>
                </form>
              )}
              {dados.perfis.length === 0 ? <EstadoVazio titulo="Nenhum perfil de referência">Adicione perfis (contas profissionais) que fazem bons vídeos de moto: os melhores vídeos de cada um aparecem aqui.</EstadoVazio> : dados.perfis.map(p => (
                <section key={p.id} className="sm-card sm-ref-perfil" data-perfil-ref={p.usuario}>
                  <div className="sm-ref-painel-cab">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.fotoUrl ? <img className="sm-ref-foto" src={p.fotoUrl} alt="" /> : <span className="sm-ref-foto" aria-hidden="true">{p.usuario.slice(0, 1).toUpperCase()}</span>}
                    <div>
                      <h2 className="sm-h-card"><a href={`https://www.instagram.com/${p.usuario}/`} target="_blank" rel="noreferrer">@{p.usuario}</a></h2>
                      <span className="sm-legenda">{[p.nome, p.seguidores != null ? `${num(p.seguidores)} seguidores` : null, p.atualizadoEm ? `atualizado ${haQuanto(p.atualizadoEm)}` : null].filter(Boolean).join(' · ')}</span>
                    </div>
                    {dados.podeEditar && <Botao variante="fantasma" disabled={ocupado} onClick={() => acao(() => proLaboreApi.sm.referencias.removerPerfil(p.id), `@${p.usuario} saiu das referências.`)}>Remover</Botao>}
                  </div>
                  {p.ultimoErro && <Banner tom="warn" titulo="Perfil">{p.ultimoErro}</Banner>}
                  {p.videos.length > 0 && <ol className="sm-ref-lista">{p.videos.map((v, i) => <Video key={v.id} v={v} posicao={i + 1} aoAssistir={() => setAssistindo(v)} />)}</ol>}
                </section>
              ))}
            </>
          )}
        </div>
      )}
      {assistindo && (
        <Modal largo titulo={assistindo.autor ? `@${assistindo.autor}` : `#${assistindo.fonte}`} aoFechar={() => setAssistindo(null)}>
          <iframe className="sm-ref-embed" src={embed(assistindo.permalink)} title="Vídeo do Instagram" allow="encrypted-media; picture-in-picture" loading="lazy" data-embed />
        </Modal>
      )}
    </>
  )
}
