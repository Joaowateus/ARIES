'use client'

// Gráficos da Central. Uma série por gráfico (--sv-1), a meta como linha de
// referência tracejada com rótulo direto, dica no cursor e a tabela no cartão.
import { useState } from 'react'
import type { IntelCentral } from '@/lib/proLaboreApi'
import { CartaoViz, LinhaTip, Tooltip, Vazio, ticksBonitos, useLargura, type EstadoTooltip } from '../../social-media/_componentes/viz'
import { ddmm, num } from './fmt'

const ALTURA = 190
const M = { esq: 36, dir: 14, topo: 14, base: 24 }

/** Dias úteis do mês até cada dia (para a linha da meta acompanhar o calendário). */
function uteisAcumulados(mes: string, diasSemana: number[]): number[] {
  const [a, m] = mes.split('-').map(Number)
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate()
  const out: number[] = []
  let acc = 0
  for (let d = 1; d <= total; d++) {
    if (diasSemana.includes(new Date(Date.UTC(a, m - 1, d)).getUTCDay())) acc++
    out.push(acc)
  }
  return out
}

function eixoX(qtd: number) {
  if (qtd <= 1) return [0]
  return Array.from(new Set([0, Math.round((qtd - 1) / 3), Math.round((2 * (qtd - 1)) / 3), qtd - 1]))
}

export function VendasAcumuladas({ d }: { d: IntelCentral }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [ativo, setAtivo] = useState<number | null>(null)
  const mes = d.periodo.mes
  const uteis = uteisAcumulados(mes, d.premissas.diasUteisSemana)
  const totalUteis = uteis[uteis.length - 1] || 1
  const meta = d.resumo.vendas.meta
  const realizados = d.serieMes.reduce<number[]>((out, p) => [...out, (out[out.length - 1] ?? 0) + p.vendas], [])
  const dias = uteis.map((_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`)
  const metaAcum = uteis.map(u => (meta == null ? null : (meta * u) / totalUteis))
  const max = Math.max(1, meta ?? 0, ...realizados)
  const ticks = ticksBonitos(Math.max(4, max))
  const topo = ticks[ticks.length - 1] || 1
  const w = Math.max(0, largura - M.esq - M.dir), h = ALTURA - M.topo - M.base
  const x = (i: number) => M.esq + (dias.length <= 1 ? w / 2 : (i / (dias.length - 1)) * w)
  const y = (v: number) => M.topo + h - (v / topo) * h
  const linha = realizados.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const linhaMeta = metaAcum.every(v => v != null) ? metaAcum.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v as number).toFixed(1)}`).join('') : ''
  const tip: EstadoTooltip | null = ativo != null ? {
    x: x(ativo), y: y(realizados[ativo] ?? metaAcum[ativo] ?? 0),
    conteudo: <>
      <div className="pl-sv-tip-titulo">{ddmm(dias[ativo])}</div>
      <LinhaTip cor="var(--sv-1)" valor={realizados[ativo] != null ? num(realizados[ativo]) : 'ainda não chegou'} rotulo="vendas acumuladas" />
      {metaAcum[ativo] != null && <LinhaTip cor="var(--pl-ink-2)" tracejado valor={num(metaAcum[ativo], 1)} rotulo="ritmo da meta" />}
      {d.serieMes[ativo] && <LinhaTip valor={num(d.serieMes[ativo].vendas)} rotulo="vendas no dia" />}
    </>,
  } : null
  const ultimo = realizados.length - 1
  return (
    <CartaoViz
      titulo="Vendas acumuladas no mês"
      subtitulo={meta != null ? `Contra o ritmo da meta de ${meta} vendas, distribuída pelos dias úteis` : 'Sem meta de vendas: defina faturamento e ticket nas Premissas'}
      tabela={{ colunas: ['Dia', 'Vendas no dia', 'Acumulado', 'Ritmo da meta'], linhas: dias.map((dia, i) => [ddmm(dia), d.serieMes[i] ? num(d.serieMes[i].vendas) : '—', realizados[i] != null ? num(realizados[i]) : '—', metaAcum[i] != null ? num(metaAcum[i], 1) : '—']), alinharDireita: [1, 2, 3] }}
    >
      <div ref={ref} style={{ position: 'relative' }}>
        {largura > 0 && (
          <svg className="pl-sv-svg" width={largura} height={ALTURA} role="img" aria-label="Vendas acumuladas no mês contra o ritmo da meta">
            {ticks.map(t => (
              <g key={t}>
                <line className={t === 0 ? 'base' : 'grade'} x1={M.esq} x2={M.esq + w} y1={y(t)} y2={y(t)} />
                <text className="eixo" x={M.esq - 6} y={y(t) + 3.5} textAnchor="end">{num(t)}</text>
              </g>
            ))}
            {eixoX(dias.length).map(i => <text key={i} className="eixo" x={x(i)} y={ALTURA - 6} textAnchor={i === 0 ? 'start' : i === dias.length - 1 ? 'end' : 'middle'}>{ddmm(dias[i])}</text>)}
            {linhaMeta && <path d={linhaMeta} className="ic-ref" />}
            {linhaMeta && meta != null && <text className="ic-ref-rotulo" x={x(dias.length - 1) - 4} y={y(meta) - 6} textAnchor="end">meta {meta}</text>}
            {ativo != null && <line className="grade" x1={x(ativo)} x2={x(ativo)} y1={M.topo} y2={M.topo + h} style={{ stroke: 'var(--pl-ink-muted)' }} />}
            {linha && <path d={linha} fill="none" stroke="var(--sv-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
            {ultimo >= 0 && <circle cx={x(ultimo)} cy={y(realizados[ultimo])} r={4} fill="var(--sv-1)" stroke="var(--pl-surface)" strokeWidth={2} />}
            {ultimo >= 0 && <text className="ic-ref-rotulo" x={x(ultimo) + (ultimo > dias.length * 0.8 ? -8 : 8)} y={y(realizados[ultimo]) - 8} textAnchor={ultimo > dias.length * 0.8 ? 'end' : 'start'} style={{ fill: 'var(--pl-ink-1)', fontWeight: 600 }}>{realizados[ultimo]} vendas</text>}
            {ativo != null && realizados[ativo] != null && <circle cx={x(ativo)} cy={y(realizados[ativo])} r={5} fill="var(--sv-1)" stroke="var(--pl-surface)" strokeWidth={2} />}
            <rect className="alvo-hover" x={M.esq} y={0} width={w} height={ALTURA}
              onPointerMove={e => {
                const r = (e.currentTarget as SVGRectElement).getBoundingClientRect()
                const rel = Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)))
                setAtivo(Math.round(rel * (dias.length - 1)))
              }}
              onPointerLeave={() => setAtivo(null)} />
          </svg>
        )}
        <Tooltip estado={tip} largura={largura} />
      </div>
    </CartaoViz>
  )
}

export function LeadsPorDia({ d }: { d: IntelCentral }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [ativo, setAtivo] = useState<number | null>(null)
  const serie = d.serieMes
  const necessarios = d.metas.leadsNecessarios.comConversaoAtual ?? d.metas.leadsNecessarios.comMetas
  const porDiaUtil = necessarios != null && d.metas.calendario.total > 0 ? necessarios / d.metas.calendario.total : null
  const max = Math.max(1, porDiaUtil ?? 0, ...serie.map(p => p.leads))
  const ticks = ticksBonitos(Math.max(4, max))
  const topo = ticks[ticks.length - 1] || 1
  const w = Math.max(0, largura - M.esq - M.dir), h = ALTURA - M.topo - M.base
  const passo = serie.length ? w / serie.length : w
  const larguraBarra = Math.max(2, passo - 2)
  const y = (v: number) => M.topo + h - (v / topo) * h
  const barra = (i: number, v: number) => {
    const x0 = M.esq + i * passo + 1, x1 = x0 + larguraBarra, y0 = M.topo + h, y1 = y(v)
    const r = Math.min(4, larguraBarra / 2, y0 - y1)
    return `M${x0},${y0}V${y1 + r}Q${x0},${y1} ${x0 + r},${y1}H${x1 - r}Q${x1},${y1} ${x1},${y1 + r}V${y0}Z`
  }
  const tip: EstadoTooltip | null = ativo != null && serie[ativo] ? {
    x: M.esq + ativo * passo + passo / 2, y: y(serie[ativo].leads),
    conteudo: <>
      <div className="pl-sv-tip-titulo">{ddmm(serie[ativo].dia)}</div>
      <LinhaTip cor="var(--sv-1)" valor={num(serie[ativo].leads)} rotulo="leads criados no CRM" />
      {porDiaUtil != null && <LinhaTip cor="var(--pl-ink-2)" tracejado valor={num(porDiaUtil, 1)} rotulo="necessário por dia útil" />}
    </>,
  } : null
  return (
    <CartaoViz
      titulo="Leads por dia"
      subtitulo={porDiaUtil != null ? `Criados no CRM, contra os ${num(porDiaUtil, 1)} por dia útil que a meta pede${d.metas.leadsNecessarios.comConversaoAtual != null ? ' na conversão atual' : ' nas metas de conversão'}` : 'Criados no CRM'}
      tabela={{ colunas: ['Dia', 'Leads'], linhas: serie.map(p => [ddmm(p.dia), num(p.leads)]), alinharDireita: [1] }}
    >
      {serie.length === 0 ? <Vazio>Sem dias no período.</Vazio> : (
        <div ref={ref} style={{ position: 'relative' }}>
          {largura > 0 && (
            <svg className="pl-sv-svg" width={largura} height={ALTURA} role="img" aria-label="Leads criados por dia">
              {ticks.map(t => (
                <g key={t}>
                  <line className={t === 0 ? 'base' : 'grade'} x1={M.esq} x2={M.esq + w} y1={y(t)} y2={y(t)} />
                  <text className="eixo" x={M.esq - 6} y={y(t) + 3.5} textAnchor="end">{num(t)}</text>
                </g>
              ))}
              {eixoX(serie.length).map(i => <text key={i} className="eixo" x={M.esq + i * passo + passo / 2} y={ALTURA - 6} textAnchor={i === 0 ? 'start' : i === serie.length - 1 ? 'end' : 'middle'}>{ddmm(serie[i].dia)}</text>)}
              {serie.map((p, i) => p.leads > 0 && <path key={p.dia} d={barra(i, p.leads)} fill="var(--sv-1)" opacity={ativo == null || ativo === i ? 1 : 0.55} />)}
              {porDiaUtil != null && <line className="ic-ref" x1={M.esq} x2={M.esq + w} y1={y(porDiaUtil)} y2={y(porDiaUtil)} />}
              {porDiaUtil != null && <text className="ic-ref-rotulo" x={M.esq + w - 4} y={y(porDiaUtil) - 6} textAnchor="end">necessário {num(porDiaUtil, 1)}/dia útil</text>}
              <rect className="alvo-hover" x={M.esq} y={0} width={w} height={ALTURA}
                onPointerMove={e => {
                  const r = (e.currentTarget as SVGRectElement).getBoundingClientRect()
                  setAtivo(Math.min(serie.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / Math.max(1, r.width)) * serie.length))))
                }}
                onPointerLeave={() => setAtivo(null)} />
            </svg>
          )}
          <Tooltip estado={tip} largura={largura} />
        </div>
      )}
    </CartaoViz>
  )
}
