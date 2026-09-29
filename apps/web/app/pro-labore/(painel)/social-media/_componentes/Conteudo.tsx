'use client'

import { useState } from 'react'
import type { AnaliseSocialMedia, RecomendacaoSocial } from '@/lib/proLaboreApi'
import { CartaoViz, Vazio, fmtNum, fmtPct, fmtSeg } from './viz'

type Analise = Extract<AnaliseSocialMedia, { conectado: true }>

export function HashtagsELegendas({ analise, recarregando }: { analise: Analise; recarregando?: boolean }) {
  const { hashtags, legendas, hashtagsComparativo } = analise
  const topTags = hashtags.slice(0, 10)
  const maxAlcance = Math.max(1, ...topTags.map(t => t.alcanceMedio))
  const legendasComPost = legendas.filter(l => l.quantidade > 0)
  const maxEr = Math.max(0.0001, ...legendasComPost.map(l => l.taxaEngajamento))
  const { com, sem } = hashtagsComparativo

  return (
    <CartaoViz
      titulo="Hashtags e legendas"
      subtitulo="O que acompanha os posts que performam melhor"
      recarregando={recarregando}
      tabela={{
        colunas: ['Item', 'Posts', 'Alcance médio', 'Engajamento'],
        linhas: [
          ...hashtags.map(t => [`#${t.tag}`, t.quantidade, fmtNum(t.alcanceMedio), fmtPct(t.taxaEngajamento)]),
          ...legendas.map(l => [`Legenda: ${l.faixa}`, l.quantidade, fmtNum(l.alcanceMedio), fmtPct(l.taxaEngajamento)]),
        ],
      }}
    >
      <div className="pl-sv-grid pl-sv-grid-2-eq" style={{ gap: 28 }}>
        <div>
          <div className="pl-card-sub" style={{ marginBottom: 8, fontWeight: 600, color: 'var(--pl-ink-2)' }}>Hashtags mais usadas · alcance médio dos posts</div>
          {topTags.length === 0 ? <Vazio>Nenhuma hashtag nas legendas do período.</Vazio> : topTags.map(t => (
            <div key={t.tag} className="pl-sv-hbar" title={`${t.quantidade} posts · engajamento ${fmtPct(t.taxaEngajamento)}`}>
              <span className="nome">#{t.tag} <span style={{ color: 'var(--pl-ink-muted)', fontSize: 11 }}>· {t.quantidade}</span></span>
              <span className="pl-sv-hbar-trilho"><span style={{ width: `${(t.alcanceMedio / maxAlcance) * 100}%` }} /></span>
              <b>{fmtNum(t.alcanceMedio)}</b>
            </div>
          ))}
          {com.quantidade > 0 && sem.quantidade > 0 && (
            <div className="pl-sv-mini-stats" style={{ marginTop: 14 }}>
              <div className="pl-sv-mini-stat"><span>Com hashtag</span><b>{fmtNum(com.alcanceMedio)}</b><small>alcance médio · {com.quantidade} posts</small></div>
              <div className="pl-sv-mini-stat"><span>Sem hashtag</span><b>{fmtNum(sem.alcanceMedio)}</b><small>alcance médio · {sem.quantidade} posts</small></div>
            </div>
          )}
        </div>
        <div>
          <div className="pl-card-sub" style={{ marginBottom: 8, fontWeight: 600, color: 'var(--pl-ink-2)' }}>Tamanho da legenda · taxa de engajamento</div>
          {legendasComPost.length === 0 ? <Vazio>Nenhuma publicação no período.</Vazio> : legendas.map(l => (
            <div key={l.faixa} className="pl-sv-hbar" style={{ opacity: l.quantidade === 0 ? 0.45 : 1 }}>
              <span className="nome">{l.faixa} <span style={{ color: 'var(--pl-ink-muted)', fontSize: 11 }}>· {l.quantidade}</span></span>
              <span className="pl-sv-hbar-trilho">
                <span style={{ width: `${(l.taxaEngajamento / maxEr) * 100}%`, background: l.taxaEngajamento === maxEr && legendasComPost.length > 1 ? 'var(--sv-1)' : 'var(--sv-seq-1)' }} />
              </span>
              <b>{l.quantidade > 0 ? fmtPct(l.taxaEngajamento) : '—'}</b>
            </div>
          ))}
          <div className="pl-sv-rodape">Número ao lado de cada item = quantidade de posts. Grupos com 1–2 posts são indicativos, não conclusivos.</div>
        </div>
      </div>
    </CartaoViz>
  )
}

const NAVEGACAO = [
  { chave: 'avancos', rotulo: 'Avançou', cor: 'var(--sv-1)' },
  { chave: 'proximoStory', rotulo: 'Pulou pra outra conta', cor: 'var(--sv-2)' },
  { chave: 'retornos', rotulo: 'Voltou', cor: 'var(--sv-3)' },
  { chave: 'saidas', rotulo: 'Saiu', cor: 'var(--sv-4)' },
] as const

export function ReelsEStories({ analise, recarregando }: { analise: Analise; recarregando?: boolean }) {
  const { reels, stories } = analise
  const totalNav = NAVEGACAO.reduce((s, n) => s + stories[n.chave], 0)
  return (
    <div className="pl-sv-grid pl-sv-grid-2-eq">
      <CartaoViz titulo="Reels" subtitulo="Desempenho médio dos reels publicados no período" recarregando={recarregando}>
        {reels.quantidade === 0 ? <Vazio>Nenhum reel publicado no período.</Vazio> : (
          <div className="pl-sv-mini-stats">
            <div className="pl-sv-mini-stat"><span>Reels</span><b>{fmtNum(reels.quantidade)}</b><small>publicados</small></div>
            <div className="pl-sv-mini-stat"><span>Visualizações</span><b>{fmtNum(reels.visualizacoesMedias)}</b><small>média por reel</small></div>
            <div className="pl-sv-mini-stat"><span>Alcance</span><b>{fmtNum(reels.alcanceMedio)}</b><small>média por reel</small></div>
            <div className="pl-sv-mini-stat"><span>Tempo assistido</span><b>{fmtSeg(reels.tempoMedioAssistidoSeg)}</b><small>média por visualização</small></div>
            <div className="pl-sv-mini-stat"><span>Compartilhamento</span><b>{fmtPct(reels.taxaCompartilhamento)}</b><small>de quem foi alcançado</small></div>
            <div className="pl-sv-mini-stat"><span>Engajamento</span><b>{fmtPct(reels.taxaEngajamento)}</b><small>interações ÷ alcance</small></div>
          </div>
        )}
      </CartaoViz>
      <CartaoViz
        titulo="Stories"
        subtitulo="Stories registrados enquanto estavam no ar"
        recarregando={recarregando}
        rodape="O Instagram só entrega métricas de story nas 24h em que ele fica no ar — os que surgem e somem entre duas sincronizações não entram aqui."
        tabela={stories.quantidade > 0 ? {
          colunas: ['Métrica', 'Valor'],
          linhas: [
            ['Stories', stories.quantidade], ['Alcance médio', fmtNum(stories.alcanceMedio)], ['Visualizações médias', fmtNum(stories.visualizacoesMedias)],
            ['Respostas', stories.respostas], ['Visitas ao perfil', stories.visitasPerfil], ['Seguidores', stories.seguidoresGerados],
            ...NAVEGACAO.map(n => [n.rotulo, fmtNum(stories[n.chave])]),
          ],
        } : undefined}
      >
        {stories.quantidade === 0 ? <Vazio>Nenhum story registrado no período.</Vazio> : (
          <>
            <div className="pl-sv-mini-stats">
              <div className="pl-sv-mini-stat"><span>Stories</span><b>{fmtNum(stories.quantidade)}</b><small>registrados</small></div>
              <div className="pl-sv-mini-stat"><span>Alcance</span><b>{fmtNum(stories.alcanceMedio)}</b><small>média por story</small></div>
              <div className="pl-sv-mini-stat"><span>Respostas</span><b>{fmtNum(stories.respostas)}</b><small>no período</small></div>
              <div className="pl-sv-mini-stat"><span>Visitas ao perfil</span><b>{fmtNum(stories.visitasPerfil)}</b><small>vindas de stories</small></div>
            </div>
            {totalNav > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="pl-card-sub" style={{ marginBottom: 8, fontWeight: 600, color: 'var(--pl-ink-2)' }}>O que o público fez depois de ver</div>
                <div className="pl-sv-split" role="img" aria-label="Navegação nos stories">
                  {NAVEGACAO.map(n => stories[n.chave] > 0 && <span key={n.chave} style={{ width: `${(stories[n.chave] / totalNav) * 100}%`, background: n.cor }} />)}
                </div>
                <div className="pl-sv-split-legenda">
                  {NAVEGACAO.map(n => (
                    <span key={n.chave}><i className="pl-sv-chave" style={{ background: n.cor, marginRight: 6 }} />{n.rotulo} <b>{fmtPct(stories[n.chave] / totalNav, 0)}</b></span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CartaoViz>
    </div>
  )
}

const TIPO_REC: Record<RecomendacaoSocial['tipo'], { rotulo: string; icone: React.ReactNode }> = {
  alerta: { rotulo: 'Atenção', icone: <path d="M12 3 2 21h20L12 3Zm0 6v5m0 3v.5" /> },
  oportunidade: { rotulo: 'Oportunidade', icone: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></> },
  destaque: { rotulo: 'Ponto forte', icone: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" /> },
  info: { rotulo: 'Observação', icone: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-9v.5" /></> },
}

const VISIVEIS_INICIO = 6

export function Recomendacoes({ itens }: { itens: RecomendacaoSocial[] }) {
  const [todas, setTodas] = useState(false)
  if (itens.length === 0) {
    return <div className="pl-card"><Vazio>Ainda sem dados suficientes nesse período pra gerar recomendações — tente um período maior.</Vazio></div>
  }
  const lista = todas ? itens : itens.slice(0, VISIVEIS_INICIO)
  return (
    <>
    <div className="pl-sv-recs">
      {lista.map(r => (
        <article key={r.id} className={`pl-sv-rec ${r.tipo}`}>
          <span className="pl-sv-rec-tag">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TIPO_REC[r.tipo].icone}</svg>
            {TIPO_REC[r.tipo].rotulo}
          </span>
          <div className="pl-sv-rec-titulo">{r.titulo}</div>
          <div className="pl-sv-rec-detalhe">{r.detalhe}</div>
        </article>
      ))}
    </div>
    {itens.length > VISIVEIS_INICIO && (
      <button type="button" className="pl-btn pl-btn-ghost" style={{ marginTop: 12 }} onClick={() => setTodas(t => !t)}>
        {todas ? 'Mostrar menos' : `Ver todas as ${itens.length} análises`}
      </button>
    )}
    </>
  )
}
