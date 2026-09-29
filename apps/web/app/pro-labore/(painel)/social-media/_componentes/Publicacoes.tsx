'use client'

import { useMemo, useState } from 'react'
import type { PostSocial } from '@/lib/proLaboreApi'
import {
  Abas, COR_FORMATO, CartaoViz, EstadoTooltip, ORDEM_FORMATOS, ROTULO_FAIXA, ROTULO_FORMATO, Tooltip, Vazio,
  chaveDeData, dataDeChave, fmtCompacto, fmtDataCompleta, fmtDataHora, fmtNum, fmtPct, fmtSeg, useLargura,
} from './viz'

type Ordem = 'alcance' | 'taxaEngajamento' | 'interacoes' | 'salvamentos' | 'compartilhamentos' | 'visualizacoes' | 'seguidoresGerados'

const ORDENS: Array<{ valor: Ordem; rotulo: string; fmt: (p: PostSocial) => string }> = [
  { valor: 'alcance', rotulo: 'Alcance', fmt: p => fmtNum(p.alcance) },
  { valor: 'taxaEngajamento', rotulo: 'Engajamento', fmt: p => fmtPct(p.taxaEngajamento) },
  { valor: 'visualizacoes', rotulo: 'Visualizações', fmt: p => fmtNum(p.visualizacoes) },
  { valor: 'salvamentos', rotulo: 'Salvos', fmt: p => fmtNum(p.salvamentos) },
  { valor: 'compartilhamentos', rotulo: 'Compartilh.', fmt: p => fmtNum(p.compartilhamentos) },
  { valor: 'seguidoresGerados', rotulo: 'Seguidores', fmt: p => fmtNum(p.seguidoresGerados) },
]

const COR_FAIXA: Record<string, string> = { EXCEPCIONAL: 'var(--pl-good)', ALTO: 'var(--sv-1)', MEDIO: 'var(--pl-ink-muted)', BAIXO: 'var(--pl-accent-4)' }

function Miniatura({ post, classe }: { post: PostSocial; classe?: string }) {
  const [falhou, setFalhou] = useState(false)
  if (!post.thumbnail || falhou) return <div className="sem-img">{ROTULO_FORMATO[post.formato]}</div>
  return <img className={classe} src={post.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFalhou(true)} />
}

export function TopPublicacoes({ posts, recarregando }: { posts: PostSocial[]; recarregando?: boolean }) {
  const [ordem, setOrdem] = useState<Ordem>('alcance')
  const [sentido, setSentido] = useState<'melhores' | 'piores'>('melhores')
  const comInsight = posts.filter(p => !p.semInsights)
  const lista = [...comInsight].sort((a, b) => (sentido === 'melhores' ? b[ordem] - a[ordem] : a[ordem] - b[ordem])).slice(0, 8)
  const info = ORDENS.find(o => o.valor === ordem) ?? ORDENS[0]

  return (
    <CartaoViz
      titulo={sentido === 'melhores' ? 'Publicações em destaque' : 'Publicações com menor desempenho'}
      subtitulo={sentido === 'melhores' ? `As que mais se destacaram em ${info.rotulo.toLowerCase()} — referência do que repetir` : `As de menor ${info.rotulo.toLowerCase()} — referência do que evitar ou reformular`}
      recarregando={recarregando}
      acoes={(
        <>
          <Abas rotulo="Melhores ou piores" valor={sentido} onChange={setSentido} opcoes={[{ valor: 'melhores', rotulo: 'Melhores' }, { valor: 'piores', rotulo: 'Piores' }]} />
          <Abas rotulo="Ordenar por" valor={ordem} onChange={setOrdem} opcoes={ORDENS.map(o => ({ valor: o.valor, rotulo: o.rotulo }))} />
        </>
      )}
    >
      {lista.length === 0 ? <Vazio>Nenhuma publicação com métricas no período.</Vazio> : (
        <div className="pl-sv-posts">
          {lista.map((p, i) => (
            <a key={p.id} className="pl-sv-post" href={p.permalink ?? undefined} target="_blank" rel="noreferrer" title="Abrir no Instagram">
              <div className="pl-sv-post-img">
                <Miniatura post={p} />
                <span className="pl-sv-post-rank">#{i + 1}</span>
                <span className="pl-sv-post-formato"><i style={{ background: COR_FORMATO[p.formato] }} />{ROTULO_FORMATO[p.formato]}</span>
              </div>
              <div className="pl-sv-post-body">
                <div className="pl-sv-post-data">
                  <span>{fmtDataHora(p.publicadoEm)}</span>
                  {p.faixaImpacto && <span className="pl-sv-faixa" style={{ color: COR_FAIXA[p.faixaImpacto] }}>{ROTULO_FAIXA[p.faixaImpacto]}</span>}
                </div>
                <div className="pl-sv-post-legenda">{p.legenda || <em style={{ color: 'var(--pl-ink-muted)' }}>Sem legenda</em>}</div>
                <div className="pl-sv-post-metricas">
                  <span><b>{fmtCompacto(p.alcance)}</b> alcance</span>
                  <span><b>{fmtPct(p.taxaEngajamento)}</b> engaj.</span>
                  <span><b>{fmtNum(p.salvamentos)}</b> salvos</span>
                  <span><b>{fmtNum(p.compartilhamentos)}</b> compart.</span>
                  {ordem === 'visualizacoes' && <span><b>{fmtCompacto(p.visualizacoes)}</b> visualiz.</span>}
                  {ordem === 'seguidoresGerados' && <span><b>{fmtNum(p.seguidoresGerados)}</b> seguidores</span>}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </CartaoViz>
  )
}

const ESCALA_CAL = ['var(--pl-surface-2)', 'var(--sv-seq-2)', 'var(--sv-seq-3)', 'var(--sv-seq-5)']
const DIA_MS = 24 * 60 * 60 * 1000

// Calendário de publicações (grade semana × dia, estilo "contribuições"):
// mostra constância e buracos de uma vez, pra qualquer tamanho de período.
export function CalendarioPublicacoes({ posts, periodo, recarregando }: { posts: PostSocial[]; periodo: { inicio: string; fim: string }; recarregando?: boolean }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [ativo, setAtivo] = useState<{ dia: string; x: number; y: number } | null>(null)
  const porDia = useMemo(() => {
    const m = new Map<string, PostSocial[]>()
    for (const p of posts) m.set(p.dia, [...(m.get(p.dia) ?? []), p])
    return m
  }, [posts])

  const inicio = dataDeChave(periodo.inicio)
  const fim = dataDeChave(periodo.fim)
  const segundaInicial = new Date(inicio.getTime() - ((inicio.getDay() + 6) % 7) * DIA_MS)
  const semanas = Math.ceil((fim.getTime() - segundaInicial.getTime() + DIA_MS) / (7 * DIA_MS))
  const margemEsq = 30
  const margemTopo = 18
  const cel = Math.max(12, Math.min(26, Math.floor((largura - margemEsq) / Math.max(1, semanas)) - 3))
  const passo = cel + 3
  const alturaSvg = margemTopo + passo * 7
  const larguraSvg = Math.max(largura, margemEsq + semanas * passo)

  const diasNoPeriodo = Math.round((fim.getTime() - inicio.getTime()) / DIA_MS) + 1
  const hojeChave = chaveDeData(new Date())
  const diasComPost = [...porDia.keys()].filter(d => d >= periodo.inicio && d <= periodo.fim).length
  let maiorGap = 0
  let gap = 0
  for (let t = inicio.getTime(); t <= fim.getTime(); t += DIA_MS) {
    gap = porDia.has(chaveDeData(new Date(t))) ? 0 : gap + 1
    maiorGap = Math.max(maiorGap, gap)
  }

  let tooltip: EstadoTooltip | null = null
  if (ativo) {
    const lista = porDia.get(ativo.dia) ?? []
    tooltip = {
      x: ativo.x,
      y: ativo.y,
      conteudo: (
        <>
          <div className="pl-sv-tip-titulo">{fmtDataCompleta(ativo.dia)}</div>
          {lista.length === 0 ? <div className="pl-sv-tip-linha">Sem publicação no feed</div> : lista.map(p => (
            <div key={p.id} className="pl-sv-tip-linha">
              <span className="pl-sv-tip-key" style={{ borderTopColor: COR_FORMATO[p.formato] }} />
              <b>{fmtCompacto(p.alcance)}</b><span>{ROTULO_FORMATO[p.formato]} · {String(p.hora).padStart(2, '0')}h</span>
            </div>
          ))}
        </>
      ),
    }
  }

  return (
    <CartaoViz
      titulo="Calendário de publicações"
      subtitulo={`${diasComPost} de ${diasNoPeriodo} dias com post no feed · maior intervalo sem postar: ${maiorGap} ${maiorGap === 1 ? 'dia' : 'dias'}`}
      recarregando={recarregando}
      tabela={{
        colunas: ['Dia', 'Publicações', 'Formatos'],
        linhas: [...porDia.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([dia, lista]) => [fmtDataCompleta(dia), lista.length, lista.map(p => ROTULO_FORMATO[p.formato]).join(', ')]),
      }}
    >
      <div ref={ref} style={{ position: 'relative', overflowX: diasNoPeriodo <= 62 ? 'visible' : 'auto' }}>
        {diasNoPeriodo <= 62 && (
          <div className="pl-sv-cal" role="grid" aria-label="Calendário de publicações">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => <div key={d} className="pl-sv-cal-cab" role="columnheader">{d}</div>)}
            {Array.from({ length: semanas * 7 }, (_, i) => {
              const data = new Date(segundaInicial.getTime() + i * DIA_MS)
              const chave = chaveDeData(data)
              const fora = chave < periodo.inicio || chave > periodo.fim
              const lista = porDia.get(chave) ?? []
              // Fundo neutro (leve tom azul quando teve post): a quantidade e o
              // formato ficam nos pontos, sem competir com a cor da célula.
              const fundo = fora ? undefined : lista.length === 0 ? 'var(--pl-surface-2)' : 'rgba(var(--sv-rgb), 0.16)'
              const tinta = fora ? 'var(--pl-ink-muted)' : lista.length === 0 ? 'var(--pl-ink-muted)' : 'var(--pl-ink-1)'
              return (
                <div
                  key={chave}
                  role="gridcell"
                  className={`pl-sv-cal-dia ${fora ? 'fora' : ''} ${chave === hojeChave ? 'hoje' : ''}`}
                  style={{ background: fundo, color: tinta, opacity: fora ? 0.35 : 1 }}
                  tabIndex={!fora && lista.length > 0 ? 0 : -1}
                  aria-label={`${fmtDataCompleta(chave)}: ${lista.length} publicações`}
                  onPointerEnter={e => !fora && setAtivo({ dia: chave, x: (e.currentTarget as HTMLElement).offsetLeft + (e.currentTarget as HTMLElement).offsetWidth, y: (e.currentTarget as HTMLElement).offsetTop })}
                  onPointerLeave={() => setAtivo(null)}
                  onFocus={e => setAtivo({ dia: chave, x: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth, y: e.currentTarget.offsetTop })}
                  onBlur={() => setAtivo(null)}
                >
                  <span className="num">{data.getDate() === 1 ? data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '') : data.getDate()}</span>
                  {lista.length > 0 && (
                    <span className="pontos">
                      {lista.slice(0, 4).map(p => <i key={p.id} style={{ background: COR_FORMATO[p.formato] }} />)}
                      {lista.length > 4 && <em>+{lista.length - 4}</em>}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {diasNoPeriodo > 62 && largura > 0 && (
          <svg className="pl-sv-svg" width={larguraSvg} height={alturaSvg} role="img" aria-label="Calendário de publicações por dia">
            {['Seg', '', 'Qua', '', 'Sex', '', 'Dom'].map((d, i) => d && (
              <text key={i} className="eixo" x={margemEsq - 6} y={margemTopo + i * passo + cel / 2 + 4} textAnchor="end">{d}</text>
            ))}
            {Array.from({ length: semanas }, (_, s) => {
              const segunda = new Date(segundaInicial.getTime() + s * 7 * DIA_MS)
              const mudaMes = s === 0 || new Date(segunda.getTime() - 7 * DIA_MS).getMonth() !== segunda.getMonth()
              return (
                <g key={s}>
                  {mudaMes && <text className="eixo" x={margemEsq + s * passo} y={11}>{segunda.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</text>}
                  {Array.from({ length: 7 }, (_, d) => {
                    const data = new Date(segunda.getTime() + d * DIA_MS)
                    const chave = chaveDeData(data)
                    if (chave < periodo.inicio || chave > periodo.fim) return null
                    const qtd = porDia.get(chave)?.length ?? 0
                    const x = margemEsq + s * passo
                    const y = margemTopo + d * passo
                    return (
                      <rect
                        key={d}
                        x={x}
                        y={y}
                        width={cel}
                        height={cel}
                        rx={3}
                        fill={ESCALA_CAL[Math.min(3, qtd)]}
                        stroke={ativo?.dia === chave ? 'var(--pl-ink-1)' : 'none'}
                        tabIndex={qtd > 0 ? 0 : -1}
                        aria-label={`${fmtDataCompleta(chave)}: ${qtd} publicações`}
                        onPointerEnter={() => setAtivo({ dia: chave, x: x + cel, y })}
                        onPointerLeave={() => setAtivo(null)}
                        onFocus={() => setAtivo({ dia: chave, x: x + cel, y })}
                        onBlur={() => setAtivo(null)}
                        style={{ cursor: 'default' }}
                      />
                    )
                  })}
                </g>
              )
            })}
          </svg>
        )}
        <Tooltip estado={tooltip} largura={largura} />
      </div>
      <div className="pl-sv-legenda" style={{ alignItems: 'center' }}>
        {diasNoPeriodo <= 62 ? (
          <>
            <span><i style={{ background: 'rgba(var(--sv-rgb), 0.16)' }} />Dia com post</span>
            {ORDEM_FORMATOS.map(f => <span key={f}><i className="ponto" style={{ background: COR_FORMATO[f] }} />{ROTULO_FORMATO[f]}</span>)}
            <span>· um ponto por publicação</span>
          </>
        ) : (
          <>
            <span>posts no dia:</span>
            {['0', '1', '2', '3+'].map((r, i) => <span key={r}><i style={{ background: ESCALA_CAL[i] }} />{r}</span>)}
          </>
        )}
      </div>
    </CartaoViz>
  )
}

type Coluna = { chave: keyof PostSocial | 'post'; rotulo: string; num?: boolean; fmt: (p: PostSocial) => React.ReactNode; csv: (p: PostSocial) => string | number }

const COLUNAS: Coluna[] = [
  { chave: 'publicadoEm', rotulo: 'Publicado', fmt: p => fmtDataHora(p.publicadoEm), csv: p => p.publicadoEm },
  { chave: 'formato', rotulo: 'Formato', fmt: p => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i className="pl-sv-chave" style={{ background: COR_FORMATO[p.formato] }} />{ROTULO_FORMATO[p.formato]}</span>, csv: p => ROTULO_FORMATO[p.formato] },
  { chave: 'alcance', rotulo: 'Alcance', num: true, fmt: p => fmtNum(p.alcance), csv: p => p.alcance },
  { chave: 'visualizacoes', rotulo: 'Visualiz.', num: true, fmt: p => fmtNum(p.visualizacoes), csv: p => p.visualizacoes },
  { chave: 'curtidas', rotulo: 'Curtidas', num: true, fmt: p => fmtNum(p.curtidas), csv: p => p.curtidas },
  { chave: 'comentarios', rotulo: 'Coment.', num: true, fmt: p => fmtNum(p.comentarios), csv: p => p.comentarios },
  { chave: 'compartilhamentos', rotulo: 'Compart.', num: true, fmt: p => fmtNum(p.compartilhamentos), csv: p => p.compartilhamentos },
  { chave: 'salvamentos', rotulo: 'Salvos', num: true, fmt: p => fmtNum(p.salvamentos), csv: p => p.salvamentos },
  { chave: 'taxaEngajamento', rotulo: 'Engaj.', num: true, fmt: p => fmtPct(p.taxaEngajamento), csv: p => (p.taxaEngajamento * 100).toFixed(2) },
  { chave: 'visitasPerfil', rotulo: 'Visitas', num: true, fmt: p => fmtNum(p.visitasPerfil), csv: p => p.visitasPerfil },
  { chave: 'seguidoresGerados', rotulo: 'Seguid.', num: true, fmt: p => fmtNum(p.seguidoresGerados), csv: p => p.seguidoresGerados },
  { chave: 'tempoMedioAssistidoSeg', rotulo: 'Retenção', num: true, fmt: p => fmtSeg(p.tempoMedioAssistidoSeg), csv: p => p.tempoMedioAssistidoSeg?.toFixed(1) ?? '' },
  { chave: 'indiceImpacto', rotulo: 'Impacto', num: true, fmt: p => (p.indiceImpacto != null ? `${p.indiceImpacto.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}×` : '—'), csv: p => p.indiceImpacto?.toFixed(2) ?? '' },
]

function csvSeguro(v: string | number): string {
  const s = String(v)
  // Neutraliza fórmula (CSV injection) e escapa aspas.
  const seguro = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${seguro.replace(/"/g, '""')}"`
}

export function TabelaPublicacoes({ posts, periodo, recarregando }: { posts: PostSocial[]; periodo: { inicio: string; fim: string }; recarregando?: boolean }) {
  const [ordem, setOrdem] = useState<{ chave: Coluna['chave']; desc: boolean }>({ chave: 'publicadoEm', desc: true })
  const [limite, setLimite] = useState(15)
  const ordenados = useMemo(() => {
    const valor = (p: PostSocial) => (ordem.chave === 'post' ? p.publicadoEm : (p[ordem.chave as keyof PostSocial] ?? -1))
    return [...posts].sort((a, b) => {
      const va = valor(a)
      const vb = valor(b)
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return ordem.desc ? -cmp : cmp
    })
  }, [posts, ordem])

  function exportarCsv() {
    const cabecalho = ['Link', 'Legenda', ...COLUNAS.map(c => c.rotulo)]
    const linhas = ordenados.map(p => [p.permalink ?? '', p.legenda ?? '', ...COLUNAS.map(c => c.csv(p))])
    const csv = [cabecalho, ...linhas].map(l => l.map(csvSeguro).join(';')).join('\n')
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `instagram-publicacoes-${periodo.inicio}-a-${periodo.fim}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <CartaoViz
      titulo="Todas as publicações do período"
      subtitulo={`${posts.length} ${posts.length === 1 ? 'publicação' : 'publicações'} no feed · clique no cabeçalho pra ordenar`}
      recarregando={recarregando}
      acoes={posts.length > 0 && <button type="button" className="pl-sv-btn-tabela" onClick={exportarCsv}>Exportar CSV</button>}
    >
      {posts.length === 0 ? <Vazio>Nenhuma publicação no período.</Vazio> : (
        <>
          <div className="pl-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="pl-table pl-sv-tabela-posts">
              <thead>
                <tr>
                  <th>Post</th>
                  {COLUNAS.map(c => (
                    <th key={c.chave} className={c.num ? 'pl-right' : ''} onClick={() => setOrdem(o => ({ chave: c.chave, desc: o.chave === c.chave ? !o.desc : true }))} aria-sort={ordem.chave === c.chave ? (ordem.desc ? 'descending' : 'ascending') : 'none'}>
                      {c.rotulo}{ordem.chave === c.chave ? (ordem.desc ? ' ↓' : ' ↑') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenados.slice(0, limite).map(p => (
                  <tr key={p.id}>
                    <td>
                      <a href={p.permalink ?? undefined} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 260 }}>
                        <span className="pl-sv-post-img" style={{ width: 36, height: 36, flex: 'none', borderRadius: 6, overflow: 'hidden' }}><Miniatura post={p} classe="pl-sv-thumb-mini" /></span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--pl-ink-2)' }}>{p.legenda || 'Sem legenda'}</span>
                      </a>
                    </td>
                    {COLUNAS.map(c => <td key={c.chave} className={c.num ? 'pl-right' : ''}>{p.semInsights && c.num && c.chave !== 'curtidas' && c.chave !== 'comentarios' ? '—' : c.fmt(p)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ordenados.length > limite && (
            <button type="button" className="pl-btn pl-btn-ghost" style={{ marginTop: 12 }} onClick={() => setLimite(l => l + 30)}>
              Mostrar mais ({ordenados.length - limite} restantes)
            </button>
          )}
        </>
      )}
    </CartaoViz>
  )
}
