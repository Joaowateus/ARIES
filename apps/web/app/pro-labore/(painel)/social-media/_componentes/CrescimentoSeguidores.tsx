'use client'

import { useState } from 'react'
import type { AnaliseSocialMedia, PontoSerieSocial } from '@/lib/proLaboreApi'
import { CartaoViz, EstadoTooltip, LinhaTip, Tooltip, Vazio, fmtCompacto, fmtDataCompleta, fmtDiaMes, fmtNum, fmtPct, ticksBonitos, useLargura } from './viz'

type Kpis = Extract<AnaliseSocialMedia, { conectado: true }>['kpis']

const MARGEM = { esq: 54, dir: 12 }
const ALT_TOTAL = 150
const ALT_BARRAS = 150
const ESPACO = 26

export function CrescimentoSeguidores({ serie, kpis, recarregando }: { serie: PontoSerieSocial[]; kpis: Kpis; recarregando?: boolean }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [indice, setIndice] = useState<number | null>(null)
  const seg = kpis.seguidores

  const temTotal = serie.filter(p => p.seguidores != null).length >= 2
  const temMovimento = serie.some(p => p.seguidoresGanhos > 0 || p.seguidoresPerdidos > 0)
  const temEstimado = serie.some(p => p.seguidoresEstimado)
  const n = serie.length
  const w = Math.max(0, largura - MARGEM.esq - MARGEM.dir)
  const passoBarra = n > 0 ? w / n : w
  // Mesmo X (centro do dia) nos dois painéis, pra linha e barras alinharem.
  const x = (i: number) => MARGEM.esq + (i + 0.5) * passoBarra
  const espessura = Math.max(2, Math.min(18, passoBarra * 0.6))

  // Painel 1: total (escala própria, não começa do zero — o que importa é a curva)
  const totais = serie.map(p => p.seguidores).filter((v): v is number => v != null)
  const minT = totais.length ? Math.min(...totais) : 0
  const maxT = totais.length ? Math.max(...totais) : 1
  const folga = Math.max(1, (maxT - minT) * 0.15)
  const yT = (v: number) => 12 + (1 - (v - (minT - folga)) / (maxT + folga - (minT - folga))) * (ALT_TOTAL - 24)

  // Painel 2: ganhos (pra cima) x perdidos (pra baixo) — divergente, eixo no zero
  const topo2 = ALT_TOTAL + ESPACO
  const maxG = Math.max(1, ...serie.map(p => p.seguidoresGanhos))
  const maxP = Math.max(1, ...serie.map(p => p.seguidoresPerdidos))
  const escala = ticksBonitos(Math.max(maxG, maxP), 2)
  const lim = escala[escala.length - 1]
  const meioAlt = (ALT_BARRAS - 20) / 2
  const zero = topo2 + 10 + meioAlt
  const yB = (v: number) => zero - (v / lim) * meioAlt
  const alturaSvg = topo2 + ALT_BARRAS + 22

  const passoRotulo = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 64))))

  let tooltip: EstadoTooltip | null = null
  if (indice != null && serie[indice]) {
    const p = serie[indice]
    tooltip = {
      x: x(indice),
      y: p.seguidores != null ? yT(p.seguidores) : zero,
      conteudo: (
        <>
          <div className="pl-sv-tip-titulo">{fmtDataCompleta(p.data)}</div>
          {p.seguidores != null && <LinhaTip cor="var(--sv-1)" valor={fmtNum(p.seguidores)} rotulo={p.seguidoresEstimado ? 'seguidores (estimado)' : 'seguidores'} />}
          <LinhaTip cor="var(--sv-1)" valor={`+${fmtNum(p.seguidoresGanhos)}`} rotulo="novos seguidores" />
          <LinhaTip cor="var(--sv-neg)" valor={`−${fmtNum(p.seguidoresPerdidos)}`} rotulo="deixaram de seguir" />
          <LinhaTip valor={`${p.saldoSeguidores >= 0 ? '+' : '−'}${fmtNum(Math.abs(p.saldoSeguidores))}`} rotulo="saldo do dia" />
        </>
      ),
    }
  }

  const linhaTotal = serie
    .map((p, i) => (p.seguidores != null ? `${x(i).toFixed(1)} ${yT(p.seguidores).toFixed(1)}` : null))
    .filter(Boolean)
    .map((s, i) => `${i ? 'L' : 'M'}${s}`)
    .join(' ')

  function aoMover(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - rect.left - MARGEM.esq) / passoBarra)
    setIndice(Math.min(n - 1, Math.max(0, i)))
  }

  return (
    <CartaoViz
      titulo="Crescimento de seguidores"
      subtitulo="Total de seguidores e movimento diário (entradas e saídas)"
      recarregando={recarregando}
      tabela={{
        colunas: ['Dia', 'Seguidores', 'Novos', 'Deixaram de seguir', 'Saldo'],
        linhas: serie.map(p => [
          fmtDiaMes(p.data),
          p.seguidores != null ? `${fmtNum(p.seguidores)}${p.seguidoresEstimado ? ' (est.)' : ''}` : '—',
          fmtNum(p.seguidoresGanhos), fmtNum(p.seguidoresPerdidos), fmtNum(p.saldoSeguidores),
        ]),
      }}
      rodape={temEstimado ? 'Nos dias sem sincronização, o total é reconstruído a partir do total real mais próximo e do saldo diário informado pelo Instagram (marcado como “estimado”).' : undefined}
    >
      <div className="pl-sv-mini-stats" style={{ marginBottom: 16 }}>
        <div className="pl-sv-mini-stat"><span>Novos seguidores</span><b>+{fmtNum(seg.ganhos)}</b>{seg.ganhosAnterior != null && <small>{fmtNum(seg.ganhosAnterior)} no período anterior</small>}</div>
        <div className="pl-sv-mini-stat"><span>Deixaram de seguir</span><b>−{fmtNum(seg.perdidos)}</b>{seg.perdidosAnterior != null && <small>{fmtNum(seg.perdidosAnterior)} no período anterior</small>}</div>
        <div className="pl-sv-mini-stat"><span>Saldo</span><b>{seg.variacao != null ? `${seg.variacao >= 0 ? '+' : '−'}${fmtNum(Math.abs(seg.variacao))}` : '—'}</b>{seg.taxaCrescimento != null && <small>{fmtPct(seg.taxaCrescimento)} de crescimento</small>}</div>
        <div className="pl-sv-mini-stat"><span>Aproveitamento</span><b>{seg.ganhos > 0 ? fmtPct((seg.ganhos - seg.perdidos) / seg.ganhos, 0) : '—'}</b><small>saldo a cada 100 novos seguidores</small></div>
      </div>
      {!temMovimento && !temTotal ? <Vazio>Sem dados de seguidores nesse período.</Vazio> : (
        <div ref={ref} style={{ position: 'relative' }}>
          {largura > 0 && (
            <svg className="pl-sv-svg" width={largura} height={alturaSvg} role="img" aria-label="Total de seguidores e entradas e saídas por dia" onPointerMove={aoMover} onPointerLeave={() => setIndice(null)}>
              {/* Painel 1 — total */}
              <text className="rotulo-leve" x={MARGEM.esq} y={8}>Total de seguidores</text>
              {temTotal && (
                <>
                  {[minT, maxT].map((t, i) => (
                    <g key={i}>
                      <line className="grade" x1={MARGEM.esq} x2={MARGEM.esq + w} y1={yT(t)} y2={yT(t)} />
                      <text className="eixo" x={MARGEM.esq - 8} y={yT(t) + 3.5} textAnchor="end">{fmtCompacto(t)}</text>
                    </g>
                  ))}
                  <path d={linhaTotal} fill="none" stroke="var(--sv-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {(() => {
                    const ultimo = [...serie.keys()].reverse().find(i => serie[i].seguidores != null)
                    return ultimo != null && <circle cx={x(ultimo)} cy={yT(serie[ultimo].seguidores as number)} r={4} fill="var(--sv-1)" stroke="var(--pl-surface)" strokeWidth={2} />
                  })()}
                </>
              )}
              {!temTotal && <text className="rotulo-leve" x={MARGEM.esq + w / 2} y={ALT_TOTAL / 2} textAnchor="middle">Total disponível a partir das próximas sincronizações</text>}

              {/* Painel 2 — ganhos x perdidos */}
              <text className="rotulo-leve" x={MARGEM.esq} y={topo2 + 2}>Entradas e saídas por dia</text>
              {[lim, -lim].map(t => (
                <g key={t}>
                  <line className="grade" x1={MARGEM.esq} x2={MARGEM.esq + w} y1={yB(t)} y2={yB(t)} />
                  <text className="eixo" x={MARGEM.esq - 8} y={yB(t) + 3.5} textAnchor="end">{t > 0 ? '+' : '−'}{fmtCompacto(Math.abs(t))}</text>
                </g>
              ))}
              {serie.map((p, i) => {
                const cx = x(i)
                const hG = zero - yB(p.seguidoresGanhos)
                const hP = yB(-p.seguidoresPerdidos) - zero
                const rG = Math.min(4, espessura / 2, hG)
                const rP = Math.min(4, espessura / 2, hP)
                const x0 = cx - espessura / 2
                const x1 = cx + espessura / 2
                const apagado = indice != null && indice !== i
                return (
                  <g key={p.data} opacity={apagado ? 0.45 : 1}>
                    {hG > 0 && <path d={`M${x0} ${zero - 1} V${zero - hG + rG} Q${x0} ${zero - hG} ${x0 + rG} ${zero - hG} H${x1 - rG} Q${x1} ${zero - hG} ${x1} ${zero - hG + rG} V${zero - 1} Z`} fill="var(--sv-1)" />}
                    {hP > 0 && <path d={`M${x0} ${zero + 1} V${zero + hP - rP} Q${x0} ${zero + hP} ${x0 + rP} ${zero + hP} H${x1 - rP} Q${x1} ${zero + hP} ${x1} ${zero + hP - rP} V${zero + 1} Z`} fill="var(--sv-neg)" />}
                  </g>
                )
              })}
              <line className="base" x1={MARGEM.esq} x2={MARGEM.esq + w} y1={zero} y2={zero} />
              {serie.map((p, i) => (i % passoRotulo === 0) && (
                <text key={`x${i}`} className="eixo" x={x(i)} y={alturaSvg - 4} textAnchor="middle">{fmtDiaMes(p.data)}</text>
              ))}
              {indice != null && <line x1={x(indice)} x2={x(indice)} y1={12} y2={ALT_TOTAL - 8} stroke="var(--pl-border-strong)" pointerEvents="none" />}
            </svg>
          )}
          <Tooltip estado={tooltip} largura={largura} />
          <div className="pl-sv-legenda">
            <span><i className="linha" style={{ borderTopColor: 'var(--sv-1)' }} />Total de seguidores</span>
            <span><i style={{ background: 'var(--sv-1)' }} />Novos seguidores</span>
            <span><i style={{ background: 'var(--sv-neg)' }} />Deixaram de seguir</span>
          </div>
        </div>
      )}
    </CartaoViz>
  )
}
