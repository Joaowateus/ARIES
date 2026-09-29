'use client'

import { useMemo, useState } from 'react'
import type { PontoSerieSocial } from '@/lib/proLaboreApi'
import { Abas, CartaoViz, EstadoTooltip, LinhaTip, Tooltip, Vazio, fmtCompacto, fmtDataCompleta, fmtDiaMes, fmtNum, fmtPct, ticksBonitos, useLargura, variacao } from './viz'

type Metrica = 'alcance' | 'visualizacoes' | 'interacoes' | 'contasEngajadas' | 'visitasPerfil' | 'toquesLinks'

const METRICAS: Array<{ valor: Metrica; rotulo: string; descricao: string }> = [
  { valor: 'alcance', rotulo: 'Alcance', descricao: 'Contas únicas alcançadas por dia' },
  { valor: 'visualizacoes', rotulo: 'Visualizações', descricao: 'Vezes que o conteúdo foi visto por dia' },
  { valor: 'interacoes', rotulo: 'Interações', descricao: 'Curtidas, comentários, compartilhamentos, salvos e respostas por dia' },
  { valor: 'contasEngajadas', rotulo: 'Contas engajadas', descricao: 'Contas únicas que interagiram por dia' },
  { valor: 'visitasPerfil', rotulo: 'Visitas ao perfil', descricao: 'Visitas ao perfil por dia' },
  { valor: 'toquesLinks', rotulo: 'Toques em links', descricao: 'Toques no link da bio e botões de contato por dia' },
]

const ALTURA = 300
const MARGEM = { topo: 14, dir: 14, base: 40, esq: 50 }

export function EvolucaoDiaria({ serie, serieAnterior, recarregando }: {
  serie: PontoSerieSocial[]
  serieAnterior: PontoSerieSocial[]
  recarregando?: boolean
}) {
  const [metrica, setMetrica] = useState<Metrica>('alcance')
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [indice, setIndice] = useState<number | null>(null)

  const disponiveis = METRICAS.filter(m => m.valor === 'alcance' || serie.some(p => p[m.valor] > 0) || serieAnterior.some(p => p[m.valor] > 0))
  const info = METRICAS.find(m => m.valor === metrica) ?? METRICAS[0]
  const temAnterior = serieAnterior.some(p => p.temDados)
  const temDados = serie.some(p => p.temDados)

  const geo = useMemo(() => {
    const n = serie.length
    const w = Math.max(0, largura - MARGEM.esq - MARGEM.dir)
    const h = ALTURA - MARGEM.topo - MARGEM.base
    const valores = [...serie.filter(p => p.temDados), ...(temAnterior ? serieAnterior.filter(p => p.temDados) : [])].map(p => p[metrica])
    const ticks = ticksBonitos(Math.max(1, ...valores))
    const topo = ticks[ticks.length - 1]
    const x = (i: number) => MARGEM.esq + (n <= 1 ? w / 2 : (i / (n - 1)) * w)
    const y = (v: number) => MARGEM.topo + h - (v / topo) * h
    // Quebra a linha nos dias sem dado em vez de ligar por cima do buraco.
    const trechos = (pontos: PontoSerieSocial[]) => {
      const lista: Array<Array<[number, number]>> = []
      let atual: Array<[number, number]> = []
      pontos.forEach((p, i) => {
        if (p.temDados) atual.push([x(i), y(p[metrica])])
        else if (atual.length) { lista.push(atual); atual = [] }
      })
      if (atual.length) lista.push(atual)
      return lista
    }
    return { n, w, h, ticks, x, y, trechosAtual: trechos(serie), trechosAnterior: temAnterior ? trechos(serieAnterior) : [] }
  }, [serie, serieAnterior, metrica, largura, temAnterior])

  const passoRotulo = Math.max(1, Math.ceil(geo.n / Math.max(2, Math.floor(geo.w / 64))))

  function aoMover(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    if (geo.n === 0) return
    const i = geo.n <= 1 ? 0 : Math.round(((px - MARGEM.esq) / geo.w) * (geo.n - 1))
    setIndice(Math.min(geo.n - 1, Math.max(0, i)))
  }

  function aoTeclar(e: React.KeyboardEvent<SVGSVGElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    setIndice(i => {
      const base = i ?? (e.key === 'ArrowLeft' ? geo.n : -1)
      return Math.min(geo.n - 1, Math.max(0, base + (e.key === 'ArrowRight' ? 1 : -1)))
    })
  }

  let tooltip: EstadoTooltip | null = null
  if (indice != null && serie[indice]) {
    const p = serie[indice]
    const a = serieAnterior[indice]
    const delta = p.temDados && a?.temDados ? variacao(p[metrica], a[metrica]) : null
    tooltip = {
      x: geo.x(indice),
      y: p.temDados ? geo.y(p[metrica]) : MARGEM.topo,
      conteudo: (
        <>
          <div className="pl-sv-tip-titulo">{fmtDataCompleta(p.data)}</div>
          <LinhaTip cor="var(--sv-1)" valor={p.temDados ? fmtNum(p[metrica]) : 'sem dado'} rotulo={info.rotulo.toLowerCase()} />
          {temAnterior && a && <LinhaTip cor="var(--pl-ink-muted)" valor={a.temDados ? fmtNum(a[metrica]) : 'sem dado'} rotulo={`em ${fmtDiaMes(a.data)}`} />}
          {delta != null && <div className="pl-sv-tip-linha" style={{ marginTop: 5 }}>{delta >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(delta), 0)} vs. mesmo dia do período anterior</div>}
          {p.publicacoes > 0 && <div className="pl-sv-tip-linha" style={{ marginTop: 5 }}>{p.publicacoes} {p.publicacoes === 1 ? 'publicação' : 'publicações'} no dia</div>}
        </>
      ),
    }
  }

  const caminho = (pts: Array<[number, number]>) => pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')
  const base = MARGEM.topo + geo.h

  return (
    <CartaoViz
      titulo="Evolução diária"
      subtitulo={info.descricao}
      recarregando={recarregando}
      acoes={<Abas rotulo="Métrica do gráfico" opcoes={disponiveis.map(m => ({ valor: m.valor, rotulo: m.rotulo }))} valor={metrica} onChange={setMetrica} />}
      tabela={{
        colunas: ['Dia', info.rotulo, ...(temAnterior ? ['Dia anterior', 'Período anterior'] : []), 'Publicações'],
        linhas: serie.map((p, i) => [
          fmtDiaMes(p.data),
          p.temDados ? fmtNum(p[metrica]) : '—',
          ...(temAnterior ? [fmtDiaMes(serieAnterior[i]?.data ?? p.data), serieAnterior[i]?.temDados ? fmtNum(serieAnterior[i][metrica]) : '—'] : []),
          p.publicacoes,
        ]),
      }}
      rodape={!temAnterior && temDados ? 'Sem métricas diárias do período anterior pra comparação — o Instagram só devolve os últimos 30 dias, e o histórico daqui pra frente vai sendo guardado a cada sincronização.' : undefined}
    >
      {!temDados ? (
        <Vazio>Nenhuma métrica diária da conta nesse período. O Instagram só disponibiliza os últimos 30 dias — escolha um período mais recente.</Vazio>
      ) : (
        <div ref={ref} style={{ position: 'relative' }}>
          {largura > 0 && (
            <svg
              className="pl-sv-svg"
              width={largura}
              height={ALTURA}
              role="img"
              aria-label={`${info.rotulo} por dia. Use as setas pra navegar entre os dias.`}
              tabIndex={0}
              onPointerMove={aoMover}
              onPointerLeave={() => setIndice(null)}
              onKeyDown={aoTeclar}
              onBlur={() => setIndice(null)}
            >
              {geo.ticks.map(t => (
                <g key={t}>
                  <line className="grade" x1={MARGEM.esq} x2={MARGEM.esq + geo.w} y1={geo.y(t)} y2={geo.y(t)} />
                  <text className="eixo" x={MARGEM.esq - 8} y={geo.y(t) + 3.5} textAnchor="end">{fmtCompacto(t)}</text>
                </g>
              ))}
              <line className="base" x1={MARGEM.esq} x2={MARGEM.esq + geo.w} y1={base} y2={base} />

              {geo.trechosAnterior.map((t, i) => (
                <path key={`a${i}`} d={caminho(t)} fill="none" stroke="var(--pl-ink-muted)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.75} />
              ))}
              {geo.trechosAtual.map((t, i) => (
                <g key={`c${i}`}>
                  {t.length > 1 && <path d={`${caminho(t)} L${t[t.length - 1][0]} ${base} L${t[0][0]} ${base} Z`} fill="rgba(var(--sv-rgb), 0.10)" />}
                  <path d={caminho(t)} fill="none" stroke="var(--sv-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {t.length === 1 && <circle cx={t[0][0]} cy={t[0][1]} r={4} fill="var(--sv-1)" stroke="var(--pl-surface)" strokeWidth={2} />}
                </g>
              ))}

              {/* Dias com publicação no feed — marcados logo abaixo do eixo */}
              {serie.map((p, i) => p.publicacoes > 0 && (
                <circle key={`p${i}`} cx={geo.x(i)} cy={base + 9} r={Math.min(4.5, 2.5 + p.publicacoes * 0.6)} fill="var(--sv-1)" opacity={0.55} />
              ))}
              {serie.map((p, i) => (i % passoRotulo === 0 || i === geo.n - 1) && (i === geo.n - 1 || geo.n - 1 - i >= passoRotulo * 0.6) && (
                <text key={`x${i}`} className="eixo" x={geo.x(i)} y={base + 28} textAnchor="middle">{fmtDiaMes(p.data)}</text>
              ))}

              {indice != null && (
                <g pointerEvents="none">
                  <line x1={geo.x(indice)} x2={geo.x(indice)} y1={MARGEM.topo} y2={base} stroke="var(--pl-border-strong)" strokeWidth={1} />
                  {temAnterior && serieAnterior[indice]?.temDados && (
                    <circle cx={geo.x(indice)} cy={geo.y(serieAnterior[indice][metrica])} r={4} fill="var(--pl-ink-muted)" stroke="var(--pl-surface)" strokeWidth={2} />
                  )}
                  {serie[indice].temDados && (
                    <circle cx={geo.x(indice)} cy={geo.y(serie[indice][metrica])} r={5} fill="var(--sv-1)" stroke="var(--pl-surface)" strokeWidth={2} />
                  )}
                </g>
              )}
            </svg>
          )}
          <Tooltip estado={tooltip} largura={largura} />
          <div className="pl-sv-legenda">
            <span><i className="linha" style={{ borderTopColor: 'var(--sv-1)' }} />Período selecionado</span>
            {temAnterior && <span><i className="linha" style={{ borderTopColor: 'var(--pl-ink-muted)' }} />Período anterior (mesmo nº de dias)</span>}
            <span><i className="ponto" style={{ background: 'var(--sv-1)', opacity: 0.55 }} />Dia com publicação</span>
          </div>
        </div>
      )}
    </CartaoViz>
  )
}
