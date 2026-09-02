'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, PainelProLabore, MesPainel, VendedorRanking, ParametroLiquidez } from '@/lib/proLaboreApi'
import { formatMoeda, formatMoedaCompacta, formatPct } from '@/lib/format'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'

const AVATAR_CORES = ['var(--pl-accent)', 'var(--pl-accent-3)', 'var(--pl-accent-4)', 'var(--pl-accent-5)', 'var(--pl-accent-2)', 'var(--pl-accent-6)']

const FUNIL_ICONS: Record<string, React.ReactElement> = {
  leads: <svg viewBox="0 0 24 24" fill="none" stroke="var(--pl-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" /></svg>,
  abordados: <svg viewBox="0 0 24 24" fill="none" stroke="var(--pl-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v10H8l-4 4V5Z" /></svg>,
  negociacao: <svg viewBox="0 0 24 24" fill="none" stroke="var(--pl-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h5l2-3 4 6 2-3h5" /></svg>,
  proposta: <svg viewBox="0 0 24 24" fill="none" stroke="var(--pl-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l4 4v14H7V3Z" /><path d="M10.5 12h5M10.5 15.5h5" /></svg>,
  fechamento: <svg viewBox="0 0 24 24" fill="none" stroke="var(--pl-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 7" /></svg>,
}

function initials(nome: string) {
  return nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

function delta(curr: number, prev: number | undefined, invert = false) {
  if (prev === undefined || prev === 0) return null
  const d = ((curr - prev) / prev) * 100
  const up = invert ? d <= 0 : d >= 0
  return { pct: Math.abs(d), up }
}

function DeltaChip({ curr, prev, invert }: { curr: number; prev: number | undefined; invert?: boolean }) {
  const d = delta(curr, prev, invert)
  if (!d) return null
  return (
    <span className={`pl-delta ${d.up ? 'up' : 'down'}`}>
      <svg viewBox="0 0 10 10" fill="none">
        {d.up
          ? <path d="M5 8.5V1.5M5 1.5L1.5 5M5 1.5L8.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M5 1.5V8.5M5 8.5L1.5 5M5 8.5L8.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      {d.pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
    </span>
  )
}

export default function ProLaboreDashboardPage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel !== 'VENDEDOR'
  const [painel, setPainel] = useState<PainelProLabore | null>(null)
  const [parametro, setParametro] = useState<ParametroLiquidez | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(0)

  useEffect(() => {
    Promise.all([proLaboreApi.painel.get(), proLaboreApi.parametros.get()]).then(([p, param]) => {
      setPainel(p)
      setParametro(param)
      setSelectedIdx(Math.max(0, p.meses.length - 1))
    }).finally(() => setLoading(false))
  }, [])

  const meses = painel?.meses ?? []
  const atual = meses[selectedIdx]
  const anterior = selectedIdx > 0 ? meses[selectedIdx - 1] : undefined

  if (loading) return <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>

  if (meses.length === 0 || !atual) {
    return (
      <div className="pl-empty pl-card">
        <div className="pl-emoji">📊</div>
        <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Nenhum dado ainda este ano</h3>
        <p style={{ marginTop: 6 }}>Registre sua primeira venda para o painel começar a se preencher.</p>
        <Link href="/pro-labore/vendas" className="pl-btn pl-btn-primary" style={{ marginTop: 14, display: 'inline-flex' }}>Registrar venda</Link>
      </div>
    )
  }

  const kpis = [
    { label: 'Receita do mês', value: formatMoeda(atual.receita), color: 'var(--pl-accent)', curr: atual.receita, prev: anterior?.receita },
    isDono
      ? { label: 'Lucro (pró-labore)', value: formatMoeda(atual.proLaboreSacado), color: 'var(--pl-accent-3)', curr: atual.proLaboreSacado, prev: anterior?.proLaboreSacado }
      : { label: 'Comissão do mês', value: formatMoeda(atual.comissaoPaga), color: 'var(--pl-accent-3)', curr: atual.comissaoPaga, prev: anterior?.comissaoPaga },
    { label: 'Ticket médio', value: formatMoeda(atual.ticketMedio), color: 'var(--pl-accent-4)', curr: atual.ticketMedio, prev: anterior?.ticketMedio },
    ...(isDono
      ? [
          { label: 'Comissões pagas', value: formatMoeda(atual.comissaoPaga), color: 'var(--pl-accent-4)', curr: atual.comissaoPaga, prev: anterior?.comissaoPaga },
          { label: 'Gasto com anúncios', value: formatMoeda(atual.gastoAnuncios), color: 'var(--pl-accent-2)', curr: atual.gastoAnuncios, prev: anterior?.gastoAnuncios, invert: true },
          { label: 'ROAS', value: <>{atual.roas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}<span className="pl-unit">×</span></>, color: 'var(--pl-accent-5)', curr: atual.roas, prev: anterior?.roas },
        ]
      : []),
    { label: 'Conversão lead→venda', value: formatPct(atual.conversaoLeadVenda / 100), color: 'var(--pl-accent-6)', curr: atual.conversaoLeadVenda, prev: anterior?.conversaoLeadVenda },
  ]

  return (
    <div>
      <div className="pl-period-row" style={{ marginTop: 4 }}>
        {meses.map((m, i) => (
          <button key={m.mes} type="button" className={`pl-chip ${i === selectedIdx ? 'active' : ''}`} onClick={() => setSelectedIdx(i)}>
            {m.label} {m.ano}
          </button>
        ))}
      </div>

      <div className="pl-kpi-grid" style={{ marginTop: 16 }}>
        {kpis.map(k => (
          <div key={k.label} className="pl-kpi" style={{ ['--k-color' as string]: k.color }}>
            <div className="pl-kpi-label">{k.label}</div>
            <div className="pl-kpi-value">{k.value}</div>
            <div className="pl-kpi-foot">
              <DeltaChip curr={k.curr} prev={k.prev} invert={k.invert} />
              {anterior && <span className="pl-kpi-vs">vs. {anterior.label}</span>}
            </div>
          </div>
        ))}
      </div>

      <AnoEMetas meses={meses} parametro={parametro} onParametroSalvo={setParametro} isDono={isDono} />

      <div className="pl-section-head">
        <div>
          <div className="pl-eyebrow">Balanço financeiro</div>
          <h2 className="pl-section-title">Receita, lucro e verba de anúncios</h2>
        </div>
        <div className="pl-section-note">{meses[0].label}–{meses[meses.length - 1].label} {atual.ano} · clique num ponto do gráfico para inspecionar o mês</div>
      </div>

      <div className="pl-grid-2">
        <div className="pl-card">
          <div className="pl-card-head">
            <div>
              <div className="pl-card-title">Receita mensal</div>
              <div className="pl-card-sub">Soma do valor das vendas fechadas por mês</div>
            </div>
            <div className="pl-legend">
              <div className="pl-legend-item"><span className="pl-legend-swatch" style={{ background: 'var(--pl-accent)' }} />Receita</div>
            </div>
          </div>
          <RevenueChart meses={meses} selectedIdx={selectedIdx} onSelect={setSelectedIdx} />
          <div className="pl-month-detail">
            <div>Mês selecionado<strong>{atual.label} {atual.ano}</strong></div>
            <div>Receita<strong>{formatMoeda(atual.receita)}</strong></div>
            {isDono
              ? <div>Lucro<strong>{formatMoeda(atual.proLaboreSacado)}</strong></div>
              : <div>Comissão<strong>{formatMoeda(atual.comissaoPaga)}</strong></div>}
            <div>Vendas<strong>{atual.quantidadeVendas}</strong></div>
            <div>Ticket médio<strong>{formatMoeda(atual.ticketMedio)}</strong></div>
            {isDono && <div>Comissões<strong>{formatMoeda(atual.comissaoPaga)}</strong></div>}
            {isDono && <div>Gasto anúncios<strong>{formatMoeda(atual.gastoAnuncios)}</strong></div>}
          </div>
        </div>

        <div className="pl-card">
          <div className="pl-card-head">
            <div>
              <div className="pl-card-title">{isDono ? 'Lucro (pró-labore) mensal' : 'Comissão mensal'}</div>
              <div className="pl-card-sub">{isDono ? 'Sacado por venda, até o teto configurado' : 'Paga por venda, até o teto da sua comissão'}</div>
            </div>
          </div>
          <LucroChart meses={meses} selectedIdx={selectedIdx} valorFn={m => (isDono ? m.proLaboreSacado : m.comissaoPaga)} />
          <div className="pl-stat-strip">
            <div className="pl-s"><div className="pl-l">{isDono ? 'Lucro/venda médio' : 'Comissão/venda média'}</div><div className="pl-v">{formatMoeda(atual.quantidadeVendas > 0 ? (isDono ? atual.proLaboreSacado : atual.comissaoPaga) / atual.quantidadeVendas : 0)}</div></div>
            <div className="pl-s"><div className="pl-l">Total no período</div><div className="pl-v">{formatMoeda(meses.reduce((s, m) => s + (isDono ? m.proLaboreSacado : m.comissaoPaga), 0))}</div></div>
          </div>
        </div>
      </div>

      {isDono && (
        <>
          <div className="pl-section-head">
            <div>
              <div className="pl-eyebrow">Comissões</div>
              <h2 className="pl-section-title">Quanto você já pagou aos vendedores</h2>
            </div>
            <div className="pl-section-note">{meses[0].label}–{meses[meses.length - 1].label} {atual.ano}</div>
          </div>
          <div className="pl-card">
            <div className="pl-card-head">
              <div>
                <div className="pl-card-title">Comissões pagas mensal</div>
                <div className="pl-card-sub">Somada por venda, até o teto de cada vendedor</div>
              </div>
            </div>
            <LucroChart meses={meses} selectedIdx={selectedIdx} valorFn={m => m.comissaoPaga} color="var(--pl-accent-4)" />
            <div className="pl-stat-strip">
              <div className="pl-s"><div className="pl-l">Comissão/venda média</div><div className="pl-v">{formatMoeda(atual.quantidadeVendas > 0 ? atual.comissaoPaga / atual.quantidadeVendas : 0)}</div></div>
              <div className="pl-s"><div className="pl-l">Total pago no período</div><div className="pl-v">{formatMoeda(meses.reduce((s, m) => s + m.comissaoPaga, 0))}</div></div>
            </div>
          </div>
        </>
      )}

      <div className="pl-section-head">
        <div>
          <div className="pl-eyebrow">Funil comercial</div>
          <h2 className="pl-section-title">Jornada de compra do cliente</h2>
        </div>
        <div className="pl-section-note">{atual.label} {atual.ano}</div>
      </div>
      <div className="pl-card">
        <FunilJourney funil={atual.funil} />
      </div>

      {isDono && (
        <>
          <div className="pl-section-head">
            <div>
              <div className="pl-eyebrow">Times &amp; investimento</div>
              <h2 className="pl-section-title">Ranking de vendedores e retorno de anúncios</h2>
            </div>
          </div>

          <div className="pl-grid-2b">
            <div className="pl-card">
              <div className="pl-card-head">
                <div>
                  <div className="pl-card-title">Ranking de vendedores</div>
                  <div className="pl-card-sub">Por receita gerada · {atual.label} {atual.ano}</div>
                </div>
              </div>
              <SellerLeaderboard vendedores={atual.vendedores} />
            </div>

            <div className="pl-card">
              <div className="pl-card-head">
                <div>
                  <div className="pl-card-title">ROAS mensal</div>
                  <div className="pl-card-sub">Receita ÷ gasto com anúncios</div>
                </div>
              </div>
              <RoasBars meses={meses} selectedIdx={selectedIdx} />
              <div className="pl-stat-strip">
                <div className="pl-s"><div className="pl-l">Gasto em {atual.label}</div><div className="pl-v">{formatMoeda(atual.gastoAnuncios)}</div></div>
                <div className="pl-s"><div className="pl-l">CAC (custo/venda)</div><div className="pl-v">{formatMoeda(atual.cac)}</div></div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ============ FATURAMENTO ANUAL x META + FRASE MOTIVACIONAL ============ */
function AnoEMetas({ meses, parametro, onParametroSalvo, isDono }: { meses: MesPainel[]; parametro: ParametroLiquidez | null; onParametroSalvo: (p: ParametroLiquidez) => void; isDono: boolean }) {
  if (meses.length === 0) return null
  const ano = meses[0].ano
  const totalAnual = meses.reduce((s, m) => s + m.receita, 0)
  const metaAnual = parametro?.metaFaturamentoAnual ?? 5_000_000
  const pctMeta = metaAnual > 0 ? Math.min(1, totalAnual / metaAnual) : 0
  const faltam = Math.max(0, metaAnual - totalAnual)

  return (
    <div>
      <div className="pl-section-head">
        <div>
          <div className="pl-eyebrow">Visão anual</div>
          <h2 className="pl-section-title">Faturamento acumulado x meta de {ano}</h2>
        </div>
      </div>

      <div className="pl-grid-2b">
        <div className="pl-card">
          <div className="pl-card-head">
            <div>
              <div className="pl-card-title">{isDono ? 'Faturamento anual (atual)' : 'Sua produção anual'}</div>
              <div className="pl-card-sub">Acumulado de {meses[0].label} a {meses[meses.length - 1].label} de {ano}</div>
            </div>
          </div>
          <div className="pl-kpi-value" style={{ fontSize: 32 }}>{formatMoeda(totalAnual)}</div>
        </div>

        <div className="pl-card">
          <div className="pl-card-head">
            <div>
              <div className="pl-card-title">Meta anual</div>
              <div className="pl-card-sub">Objetivo de faturamento para {ano}</div>
            </div>
          </div>
          <div className="pl-kpi-value" style={{ fontSize: 32 }}>{formatMoeda(metaAnual)}</div>
          <div className="pl-bar-track" style={{ marginTop: 14 }}>
            <div className="pl-bar-fill" style={{ width: `${pctMeta * 100}%` }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--pl-ink-muted)', marginTop: 8 }}>
            {formatPct(pctMeta)} da meta atingida{faltam > 0 ? ` — faltam ${formatMoeda(faltam)}` : ' — meta batida! 🎉'}
          </div>
        </div>
      </div>

      <FraseMotivacional parametro={parametro} onSaved={onParametroSalvo} isDono={isDono} />
    </div>
  )
}

function FraseMotivacional({ parametro, onSaved, isDono }: { parametro: ParametroLiquidez | null; onSaved: (p: ParametroLiquidez) => void; isDono: boolean }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(parametro?.fraseMotivacional ?? '')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { setTexto(parametro?.fraseMotivacional ?? '') }, [parametro?.fraseMotivacional])

  async function salvar() {
    setSalvando(true)
    try {
      const atualizado = await proLaboreApi.parametros.atualizar({ fraseMotivacional: texto })
      onSaved(atualizado)
      setEditando(false)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="pl-card" style={{ marginTop: 16 }}>
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">Frase motivacional</div>
          <div className="pl-card-sub">Sua lembrança pessoal, sempre visível no painel</div>
        </div>
        {isDono && !editando && (
          <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setEditando(true)}>
            {parametro?.fraseMotivacional ? 'Editar' : 'Adicionar'}
          </button>
        )}
      </div>
      {editando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea
            className="pl-input"
            rows={2}
            maxLength={280}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Ex: Cada venda é um passo mais perto da liberdade financeira."
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="pl-btn pl-btn-primary" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => { setTexto(parametro?.fraseMotivacional ?? ''); setEditando(false) }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <p style={{ fontFamily: 'Sora', fontSize: 17, fontWeight: 600, fontStyle: 'italic', color: 'var(--pl-ink-1)', margin: 0 }}>
          {parametro?.fraseMotivacional ? `"${parametro.fraseMotivacional}"` : 'Nenhuma frase cadastrada ainda.'}
        </p>
      )}
    </div>
  )
}

/* ============ GRÁFICO DE RECEITA (área, interativo) ============ */
function RevenueChart({ meses, selectedIdx, onSelect }: { meses: MesPainel[]; selectedIdx: number; onSelect: (i: number) => void }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const W = 720, H = 220, padL = 4, padR = 4, padT = 14, padB = 26
  const plotW = W - padL - padR, plotH = H - padT - padB
  const maxV = Math.max(...meses.map(m => m.receita), 1) * 1.12
  const stepX = meses.length > 1 ? plotW / (meses.length - 1) : 0
  const x = (i: number) => padL + i * stepX
  const y = (v: number) => padT + plotH - (v / maxV) * plotH

  const pts = meses.map((m, i) => [x(i), y(m.receita)] as const)
  const areaD = `M ${pts[0][0]} ${padT + plotH} ` + pts.map(p => `L ${p[0]} ${p[1]}`).join(' ') + ` L ${pts[pts.length - 1][0]} ${padT + plotH} Z`
  const lineD = `M ` + pts.map(p => `${p[0]} ${p[1]}`).join(' L ')
  const gridVals = [0, maxV * 0.25, maxV * 0.5, maxV * 0.75, maxV]
  const hover = hoverIdx !== null ? meses[hoverIdx] : null

  return (
    <div className="pl-chart-wrap">
      <svg className="pl-chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--pl-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--pl-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridVals.map((gv, i) => <line key={i} x1={padL} x2={W - padR} y1={y(gv)} y2={y(gv)} className="pl-grid-hline" />)}
        <path d={areaD} fill="url(#revGrad)" stroke="none" />
        <path d={lineD} fill="none" stroke="var(--pl-accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} className="pl-baseline-line" />
        {meses.map((m, i) => (
          <text key={m.mes} x={x(i)} y={H - 6} className="pl-axis-label" textAnchor={i === 0 ? 'start' : i === meses.length - 1 ? 'end' : 'middle'}>{m.label}</text>
        ))}
        {hoverIdx !== null && <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={padT} y2={padT + plotH} className="pl-hover-x" style={{ opacity: 1 }} />}
        {hoverIdx !== null && <circle cx={x(hoverIdx)} cy={y(meses[hoverIdx].receita)} r={4.5} fill="var(--pl-accent)" stroke="var(--pl-surface)" strokeWidth={2} className="pl-hover-dot" style={{ opacity: 1 }} />}
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={i === selectedIdx ? 4.5 : 3} fill={i === selectedIdx ? 'var(--pl-accent)' : 'var(--pl-surface)'} stroke="var(--pl-accent)" strokeWidth={2} />
        ))}
        {meses.map((m, i) => (
          <rect key={m.mes} x={x(i) - stepX / 2} y={padT} width={stepX || W} height={plotH + 14} className="pl-hit"
            onMouseEnter={() => setHoverIdx(i)} onMouseMove={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} onClick={() => onSelect(i)} />
        ))}
      </svg>
      {hover && (
        <div className="pl-tooltip" style={{ left: `${(x(hoverIdx!) / W) * 100}%`, top: `${(y(hover.receita) / H) * 100}%`, opacity: 1 }}>
          <b>{hover.label} {hover.ano}</b>
          Receita {formatMoeda(hover.receita)}<br />Vendas {hover.quantidadeVendas}
        </div>
      )}
    </div>
  )
}

/* ============ GRÁFICO DE LUCRO/COMISSÃO (barras) ============ */
function LucroChart({ meses, selectedIdx, valorFn, color = 'var(--pl-accent-3)' }: { meses: MesPainel[]; selectedIdx: number; valorFn?: (m: MesPainel) => number; color?: string }) {
  const getValor = valorFn ?? ((m: MesPainel) => m.proLaboreSacado)
  const w = 320, h = 190, padL = 4, padR = 4, padT = 10, padB = 24
  const plotW = w - padL - padR, plotH = h - padT - padB
  const maxV = Math.max(...meses.map(getValor), 1) * 1.15
  const slot = plotW / meses.length
  const bw = slot * 0.56

  return (
    <div className="pl-chart-wrap">
      <svg className="pl-chart-svg pl-chart-svg--bars" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {meses.map((m, i) => {
          const bh = (getValor(m) / maxV) * plotH
          const bx = padL + i * slot + (slot - bw) / 2
          const by = padT + plotH - bh
          const isSel = i === selectedIdx
          return (
            <g key={m.mes}>
              <rect x={bx} y={by} width={bw} height={bh} rx={4} fill={isSel ? color : `color-mix(in srgb, ${color} 38%, transparent)`} />
              <text x={bx + bw / 2} y={h - 8} className="pl-axis-label" textAnchor="middle">{m.label}</text>
            </g>
          )
        })}
        <line x1={padL} x2={w - padR} y1={padT + plotH} y2={padT + plotH} className="pl-baseline-line" />
      </svg>
    </div>
  )
}

/* ============ FUNIL COMERCIAL ============ */
function FunilJourney({ funil }: { funil: MesPainel['funil'] }) {
  const stages = [
    { key: 'leads', name: 'Leads', value: funil.leads },
    { key: 'abordados', name: 'Abordados', value: funil.abordados },
    { key: 'negociacao', name: 'Negociação', value: funil.negociacao },
    { key: 'proposta', name: 'Proposta', value: funil.proposta },
    { key: 'fechamento', name: 'Fechamento', value: funil.fechamento },
  ]
  const maxV = Math.max(stages[0].value, 1)

  return (
    <div className="pl-journey">
      {stages.map((stage, i) => {
        const widthPct = Math.max((stage.value / maxV) * 100, 6)
        const convFromPrev = i === 0 ? null : (stages[i - 1].value > 0 ? (stage.value / stages[i - 1].value) * 100 : 0)
        return (
          <div key={stage.key} className="pl-stage">
            <div className="pl-stage-icon">{FUNIL_ICONS[stage.key]}</div>
            <div className="pl-stage-name">{stage.name}</div>
            <div className="pl-stage-value pl-mono">{stage.value.toLocaleString('pt-BR')}</div>
            <div className="pl-stage-bar-track"><div className="pl-stage-bar-fill" style={{ width: `${widthPct}%`, background: 'var(--pl-accent)' }} /></div>
            <div className="pl-stage-conv">
              {convFromPrev === null ? 'topo do funil' : <>conv. anterior <b>{convFromPrev.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</b></>}
            </div>
            {i < stages.length - 1 && (
              <div className="pl-stage-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13M13 6l6 6-6 6" /></svg></div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ============ RANKING DE VENDEDORES ============ */
function SellerLeaderboard({ vendedores }: { vendedores: VendedorRanking[] }) {
  if (vendedores.length === 0) {
    return <div className="pl-empty"><div className="pl-emoji">🏍️</div>Nenhuma venda com vendedor atribuído neste mês.</div>
  }
  const maxRev = vendedores[0].receita

  return (
    <div>
      {vendedores.map((s, i) => {
        const wpct = maxRev > 0 ? (s.receita / maxRev) * 100 : 0
        return (
          <div key={s.id} className="pl-seller-row">
            <div className={`pl-rank ${i === 0 ? 'top' : ''}`}>{i + 1}</div>
            <div className="pl-seller-main">
              <div className="pl-seller-top">
                <div className="pl-seller-name">
                  <span className="pl-avatar" style={{ background: AVATAR_CORES[i % AVATAR_CORES.length] }}>{initials(s.nome)}</span>
                  {s.nome}
                </div>
                <div className="pl-seller-figs">{formatMoeda(s.receita)}</div>
              </div>
              <div className="pl-bar-track"><div className="pl-bar-fill" style={{ width: `${wpct}%` }} /></div>
            </div>
            <div className="pl-seller-meta">{s.quantidadeVendas} venda{s.quantidadeVendas !== 1 ? 's' : ''}<br />comissão {formatMoedaCompacta(s.comissaoPaga)}</div>
          </div>
        )
      })}
    </div>
  )
}

/* ============ ROAS (barras) ============ */
function RoasBars({ meses, selectedIdx }: { meses: MesPainel[]; selectedIdx: number }) {
  const maxV = Math.max(...meses.map(m => m.roas), 1) * 1.1
  return (
    <div className="pl-roas-bars">
      {meses.map((m, i) => {
        const hpct = (m.roas / maxV) * 100
        return (
          <div key={m.mes} className="pl-roas-col">
            <span className="pl-roas-val">{m.roas.toFixed(1)}×</span>
            <div className="pl-roas-bar" style={{ height: `${hpct}%`, opacity: i === selectedIdx ? 1 : 0.55 }} />
            <span className="pl-roas-lbl">{m.label}</span>
          </div>
        )
      })}
    </div>
  )
}
