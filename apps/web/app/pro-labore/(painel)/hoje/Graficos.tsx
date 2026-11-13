'use client'

// Hoje como painel de comando: os gráficos, desenhados à mão em SVG (como os do
// Dashboard), no tema claro e no escuro, com o valor ao passar o mouse e no
// formato brasileiro. Uma série por gráfico, cor pela função (meta, projeção,
// situação), nunca dois eixos.
import { useId, useState } from 'react'
import { fmtValor } from '../_padrao/Padrao'

export type SerieDia = Array<{ dia: string; valor: number }>
const COR = { serie: 'var(--pl-accent-6)', meta: 'var(--pl-ink-muted)', bom: 'var(--pl-good)', atencao: 'var(--pl-accent-4)', critico: 'var(--pl-critical)', grade: 'var(--pl-grid-line, var(--pl-border))' }
export const corFaixa = (f: string | null | undefined) => (f === 'BOM' ? COR.bom : f === 'ATENCAO' ? COR.atencao : f === 'CRITICO' ? COR.critico : 'var(--pl-ink-muted)')
const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

/** Minilinha dos últimos dias (sem eixo; o último ponto destacado). */
export function Minilinha({ serie, cor = COR.serie, altura = 30 }: { serie: SerieDia; cor?: string; altura?: number }) {
  const id = useId()
  if (serie.length < 2) return null
  const max = Math.max(...serie.map(p => p.valor), 1)
  const W = 120, H = altura
  const pts = serie.map((p, i) => [(i / (serie.length - 1)) * W, H - 3 - (p.valor / max) * (H - 6)] as const)
  const linha = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [ux, uy] = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="Tendência dos últimos 30 dias" data-minilinha>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={cor} stopOpacity=".22" /><stop offset="1" stopColor={cor} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,${H} ${linha} ${W},${H}`} fill={`url(#${id})`} />
      <polyline points={linha} fill="none" stroke={cor} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={ux} cy={uy} r="2.6" fill={cor} />
    </svg>
  )
}

/** Variação contra o mesmo período anterior: ▲ verde quando melhora, ▼ vermelho quando piora. */
export function Variacao({ v, melhor = 'MAIOR' }: { v: number | null | undefined; melhor?: string }) {
  if (v == null) return null
  if (Math.abs(v) < 1) return <span className="pl-hint" style={{ fontSize: 12 }} data-variacao="estavel">● estável</span>
  const melhorou = melhor === 'MENOR' ? v < 0 : v > 0
  return <span style={{ fontSize: 12, fontWeight: 600, color: melhor === 'NEUTRO' ? 'var(--pl-ink-2)' : melhorou ? COR.bom : COR.critico }} data-variacao={melhorou ? 'melhor' : 'pior'}>{v > 0 ? '▲' : '▼'} {fmtValor(Math.abs(v), 'PCT')}</span>
}

/** Barra de progresso contra a meta, com a marca de onde o mês deveria estar hoje. */
export function BarraMeta({ pct, esperadoPct, faixa }: { pct: number | null; esperadoPct?: number | null; faixa: string | null }) {
  if (pct == null) return null
  const w = Math.max(0, Math.min(100, pct))
  return (
    <div style={{ position: 'relative', height: 8, borderRadius: 99, background: 'var(--pl-surface-3, var(--pl-surface-2))', marginTop: 6 }} role="img" aria-label={`${pct}% da meta`} data-barra-meta>
      <div style={{ width: `${w}%`, height: '100%', borderRadius: 99, background: corFaixa(faixa), transition: 'width .4s' }} />
      {esperadoPct != null && <div title={`Onde o mês deveria estar hoje: ${Math.round(esperadoPct)}%`} style={{ position: 'absolute', left: `${Math.min(100, esperadoPct)}%`, top: -3, width: 2, height: 14, background: 'var(--pl-ink-1)', borderRadius: 1 }} />}
    </div>
  )
}

/** Ritmo do mês: faturamento acumulado dia a dia, a linha da meta e a projeção até o fim do mês. */
export function RitmoDoMes({ dias, totalDias, meta, previsao, emPct }: { dias: Array<{ dia: string; acumulado: number }>; totalDias: number; meta: number | null; previsao: number | null; emPct?: boolean }) {
  const [foco, setFoco] = useState<number | null>(null)
  if (!dias.length) return <p className="pl-hint">Sem vendas no mês ainda.</p>
  const W = 600, H = 220, PL = 8, PR = 8, PT = 12, PB = 24
  const ultimo = dias[dias.length - 1]
  const max = Math.max(meta ?? 0, previsao ?? 0, ultimo.acumulado, 1) * 1.08
  const x = (i: number) => PL + (i / Math.max(1, totalDias - 1)) * (W - PL - PR)
  const y = (v: number) => PT + (1 - v / max) * (H - PT - PB)
  const linha = dias.map((d, i) => `${x(i).toFixed(1)},${y(d.acumulado).toFixed(1)}`).join(' ')
  const iU = dias.length - 1
  const f = (v: number) => (emPct && meta ? `${Math.round((v / meta) * 100)}% da meta` : fmtValor(v, 'BRL'))
  const marcas = [1, Math.ceil(totalDias / 2), totalDias]
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Faturamento acumulado do mês contra a meta" data-ritmo-mes
        onMouseLeave={() => setFoco(null)}
        onMouseMove={e => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const i = Math.round(((e.clientX - r.left) / r.width * W - PL) / (W - PL - PR) * (totalDias - 1)); setFoco(Math.max(0, Math.min(iU, i))) }}>
        {[0.25, 0.5, 0.75, 1].map(t => <line key={t} x1={PL} x2={W - PR} y1={y(max * t / 1.08)} y2={y(max * t / 1.08)} stroke={COR.grade} strokeWidth="1" />)}
        {meta != null && <>
          <line x1={x(0)} y1={y(0)} x2={x(totalDias - 1)} y2={y(meta)} stroke={COR.meta} strokeWidth="1.5" strokeDasharray="5 5" />
          <text x={W - PR} y={y(meta) - 6} textAnchor="end" fontSize="11" fill="var(--pl-ink-2)">meta {f(meta)}</text>
        </>}
        {previsao != null && <line x1={x(iU)} y1={y(ultimo.acumulado)} x2={x(totalDias - 1)} y2={y(previsao)} stroke={COR.serie} strokeWidth="2" strokeDasharray="2 4" />}
        <polyline points={linha} fill="none" stroke={COR.serie} strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx={x(iU)} cy={y(ultimo.acumulado)} r="4" fill={COR.serie} stroke="var(--pl-surface)" strokeWidth="2" />
        {previsao != null && <circle cx={x(totalDias - 1)} cy={y(previsao)} r="4" fill="var(--pl-surface)" stroke={COR.serie} strokeWidth="2" />}
        {foco != null && <><line x1={x(foco)} x2={x(foco)} y1={PT} y2={H - PB} stroke="var(--pl-ink-muted)" strokeWidth="1" /><circle cx={x(foco)} cy={y(dias[foco].acumulado)} r="4" fill={COR.serie} /></>}
        {marcas.map(d => <text key={d} x={x(d - 1)} y={H - 6} fontSize="11" textAnchor={d === 1 ? 'start' : d === totalDias ? 'end' : 'middle'} fill="var(--pl-ink-muted)">dia {d}</text>)}
      </svg>
      {foco != null && (
        <div className="pl-card" style={{ position: 'absolute', top: 4, left: `${Math.min(70, (foco / Math.max(1, totalDias - 1)) * 100)}%`, padding: '6px 10px', fontSize: 12, pointerEvents: 'none', boxShadow: 'var(--pl-shadow-pop)' }} data-dica-grafico>
          <b>{dataCurta(dias[foco].dia)}</b> · acumulado {f(dias[foco].acumulado)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--pl-ink-2)' }}>
        <span><Traco cor={COR.serie} /> realizado</span>
        <span><Traco cor={COR.serie} tracejado="2 4" /> projeção{previsao != null ? `: ${f(previsao)}` : ''}</span>
        {meta != null && <span><Traco cor={COR.meta} tracejado="5 5" /> ritmo da meta</span>}
      </div>
    </div>
  )
}
function Traco({ cor, tracejado }: { cor: string; tracejado?: string }) {
  return <svg width="18" height="8" aria-hidden style={{ verticalAlign: 'middle' }}><line x1="0" y1="4" x2="18" y2="4" stroke={cor} strokeWidth="2.5" strokeDasharray={tracejado} /></svg>
}

/** Funil do mês: barras horizontais por etapa, com a conversão para a etapa seguinte; o gargalo em destaque. */
export function FunilDoMes({ etapas, gargalo }: { etapas: Array<{ etapa: string; nome: string; chegaram: number; conversao: number | null }>; gargalo: string | null }) {
  const lista = etapas.filter(e => e.chegaram > 0)
  if (!lista.length) return <p className="pl-hint">Sem oportunidades no mês ainda.</p>
  const max = Math.max(...lista.map(e => e.chegaram))
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }} data-funil>
      {lista.map(e => {
        const g = e.etapa === gargalo
        return (
          <li key={e.etapa} data-etapa={e.etapa} data-gargalo={g ? '1' : undefined} title={`${e.nome}: ${e.chegaram} oportunidades${e.conversao != null ? `; ${fmtValor(e.conversao, 'PCT')} seguiram` : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
              <span style={{ fontWeight: g ? 700 : 500, color: g ? COR.critico : 'var(--pl-ink-1)' }}>{e.nome}{g ? ' · gargalo' : ''}</span>
              <span className="pl-hint">{e.chegaram}{e.conversao != null && e.etapa !== 'VENDA' ? ` · ${fmtValor(e.conversao, 'PCT')} seguem` : ''}</span>
            </div>
            <div style={{ height: 10, borderRadius: 4, background: 'var(--pl-surface-2)' }}>
              <div style={{ width: `${Math.max(2, (e.chegaram / max) * 100)}%`, height: '100%', borderRadius: 4, background: g ? COR.critico : 'var(--pl-accent-5)' }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Equipe: vendas do mês por pessoa e as atividades feitas contra as atrasadas. */
export function EquipeGrafico({ pessoas }: { pessoas: Array<{ id: string; nome: string; vendas: number; feitas: number; atrasadas: number }> }) {
  if (!pessoas.length) return <p className="pl-hint">Sem vendas nem atividades no mês ainda.</p>
  const maxV = Math.max(1, ...pessoas.map(p => p.vendas))
  return (
    <div data-equipe-grafico>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(70px, 30%) 1fr auto', gap: '6px 8px', alignItems: 'center', fontSize: 12 }}>
        {pessoas.slice(0, 8).map(p => {
          const tot = p.feitas + p.atrasadas
          return [
            <span key={`n${p.id}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.nome}>{p.nome}</span>,
            <div key={`b${p.id}`} title={`${p.vendas} vendas · ${p.feitas} atividades feitas · ${p.atrasadas} atrasadas`}>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--pl-surface-2)' }}><div style={{ width: `${(p.vendas / maxV) * 100}%`, height: '100%', borderRadius: 4, background: COR.serie }} /></div>
              {tot > 0 && <div style={{ display: 'flex', height: 4, marginTop: 3, borderRadius: 2, overflow: 'hidden', gap: 2 }}><div style={{ flex: p.feitas, background: COR.bom }} /><div style={{ flex: p.atrasadas, background: COR.critico }} /></div>}
            </div>,
            <b key={`v${p.id}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{p.vendas}</b>,
          ]
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--pl-ink-2)' }}>
        <span><Quadrado cor={COR.serie} /> vendas no mês</span><span><Quadrado cor={COR.bom} /> atividades feitas</span><span><Quadrado cor={COR.critico} /> atrasadas</span>
      </div>
    </div>
  )
}
function Quadrado({ cor }: { cor: string }) { return <span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: cor, marginRight: 4 }} /> }

/** Origem do faturamento: uma barra empilhada com a legenda e a parte de cada origem. */
export function OrigemGrafico({ partes, emPct }: { partes: Array<{ chave: string; nome: string; valor: number }>; emPct?: boolean }) {
  const total = partes.reduce((t, p) => t + p.valor, 0)
  if (!total) return <p className="pl-hint">Sem faturamento no mês ainda.</p>
  const cores = ['var(--pl-accent-6)', 'var(--pl-accent-3)', 'var(--pl-accent-5)']
  return (
    <div data-origem-grafico>
      <div style={{ display: 'flex', height: 14, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
        {partes.map((p, i) => p.valor > 0 && <div key={p.chave} style={{ flex: p.valor, background: cores[i] }} title={`${p.nome}: ${fmtValor((p.valor / total) * 100, 'PCT')}`} />)}
      </div>
      <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        {partes.map((p, i) => (
          <li key={p.chave} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Quadrado cor={cores[i]} /><span style={{ flex: 1 }}>{p.nome}</span>
            <b>{fmtValor((p.valor / total) * 100, 'PCT')}</b>
            {!emPct && <span className="pl-hint" style={{ minWidth: 90, textAlign: 'right' }}>{fmtValor(p.valor, 'BRL')}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
