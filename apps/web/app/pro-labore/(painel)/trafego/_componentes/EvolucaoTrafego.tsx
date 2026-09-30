'use client'

// Evolução dia a dia de uma métrica por vez (um eixo só): barras pra
// quantidades (investimento, cliques, leads…) e linha pra taxas e custos
// (CTR, connect rate, custo por lead…). Passar o mouse mostra o dia; a
// tabela ao lado tem os valores exatos.
import { useMemo, useState } from 'react'
import type { AnaliseTrafego } from '@/lib/proLaboreApi'
import { Abas, CartaoViz, LinhaTip, Tooltip, Vazio, ticksBonitos, useLargura, type EstadoTooltip } from '../../social-media/_componentes/viz'
import { compacto, moeda, num, pct } from './formato'

type Dia = AnaliseTrafego['diario'][number]
type Chave = 'gasto' | 'impressoes' | 'cliquesLink' | 'destino' | 'leadsCrm' | 'ctr' | 'connectRate' | 'cpc' | 'cpm' | 'custoLead'
interface Metrica { chave: Chave; rotulo: string; forma: 'barra' | 'linha'; valor: (d: Dia) => number | null; fmt: (v: number | null) => string; eixo: (v: number) => string; descricao: string }

const ALTURA = 280
const M = { topo: 14, dir: 14, base: 34, esq: 58 }
const fmtDia = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`
const fmtDiaLongo = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })

export default function EvolucaoTrafego({ analise }: { analise: AnaliseTrafego }) {
  const c = analise.conta.moeda
  const nomeDestino = analise.tipoDestino === 'whatsapp' ? 'Conversas' : analise.tipoDestino === 'pagina' ? 'Visualizações' : 'Chegadas'
  const metricas = useMemo<Metrica[]>(() => {
    const brl = (v: number | null) => moeda(v, c)
    const brlEixo = (v: number) => (v >= 1000 ? `R$ ${compacto(v)}` : moeda(v, c, v < 10 ? 2 : 0))
    const lista: Metrica[] = [
      { chave: 'gasto', rotulo: 'Investimento', forma: 'barra', valor: d => d.gasto, fmt: brl, eixo: brlEixo, descricao: 'Quanto foi investido por dia' },
      { chave: 'impressoes', rotulo: 'Impressões', forma: 'barra', valor: d => d.impressoes, fmt: num, eixo: compacto, descricao: 'Vezes que os anúncios apareceram' },
      { chave: 'cliquesLink', rotulo: 'Cliques', forma: 'barra', valor: d => d.cliquesLink, fmt: num, eixo: compacto, descricao: 'Cliques no link por dia' },
      { chave: 'destino', rotulo: nomeDestino, forma: 'barra', valor: d => d.lpv + d.conversas, fmt: num, eixo: compacto, descricao: 'Quem chegou na página ou abriu o WhatsApp' },
      ...(analise.crm.leads != null ? [{ chave: 'leadsCrm' as const, rotulo: 'Leads no CRM', forma: 'barra' as const, valor: (d: Dia) => d.leadsCrm, fmt: num, eixo: compacto, descricao: 'Leads cadastrados no CRM por dia' }] : []),
      { chave: 'ctr', rotulo: 'CTR', forma: 'linha', valor: d => (d.impressoes ? d.cliquesLink / d.impressoes : null), fmt: v => pct(v, 2), eixo: v => pct(v, v < 0.1 ? 1 : 0), descricao: 'Cliques no link ÷ impressões' },
      { chave: 'connectRate', rotulo: 'Connect rate', forma: 'linha', valor: d => (d.cliquesLink ? (d.lpv + d.conversas) / d.cliquesLink : null), fmt: v => pct(v), eixo: v => pct(v, 0), descricao: 'Chegaram ao destino ÷ cliques no link' },
      { chave: 'cpc', rotulo: 'CPC', forma: 'linha', valor: d => (d.cliquesLink ? d.gasto / d.cliquesLink : null), fmt: brl, eixo: brlEixo, descricao: 'Custo por clique no link' },
      { chave: 'cpm', rotulo: 'CPM', forma: 'linha', valor: d => (d.impressoes ? (d.gasto * 1000) / d.impressoes : null), fmt: brl, eixo: brlEixo, descricao: 'Custo por mil impressões' },
      ...(analise.crm.leads != null ? [{ chave: 'custoLead' as const, rotulo: 'Custo/lead CRM', forma: 'linha' as const, valor: (d: Dia) => (d.leadsCrm ? d.gasto / d.leadsCrm : null), fmt: brl, eixo: brlEixo, descricao: 'Investimento do dia ÷ leads cadastrados no dia' }] : []),
    ]
    return lista
  }, [analise, c, nomeDestino])

  const [chave, setChave] = useState<Chave>('gasto')
  const metrica = metricas.find(m => m.chave === chave) ?? metricas[0]
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [indice, setIndice] = useState<number | null>(null)
  const dias = analise.diario
  const valores = dias.map(metrica.valor)
  const temDado = valores.some(v => v != null && v > 0)

  const w = Math.max(0, largura - M.esq - M.dir)
  const h = ALTURA - M.topo - M.base
  const ticks = ticksBonitos(Math.max(...valores.map(v => v ?? 0), metrica.forma === 'linha' ? 0.0001 : 1))
  const topo = ticks.at(-1) || 1
  const n = dias.length
  const faixa = n > 0 ? w / n : 0
  const x = (i: number) => M.esq + faixa * i + faixa / 2
  const y = (v: number) => M.topo + h - (v / topo) * h
  const base = M.topo + h
  const larguraBarra = Math.max(2, Math.min(36, faixa - 2))
  const passo = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 58))))

  const trechos: Array<Array<[number, number]>> = []
  let atual: Array<[number, number]> = []
  valores.forEach((v, i) => {
    if (v != null) atual.push([x(i), y(v)])
    else if (atual.length) { trechos.push(atual); atual = [] }
  })
  if (atual.length) trechos.push(atual)

  function aoMover(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - r.left - M.esq) / (faixa || 1))
    setIndice(i >= 0 && i < n ? i : null)
  }
  function aoTeclar(e: React.KeyboardEvent<SVGSVGElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    setIndice(i => Math.min(n - 1, Math.max(0, (i ?? (e.key === 'ArrowLeft' ? n : -1)) + (e.key === 'ArrowRight' ? 1 : -1))))
  }

  let tooltip: EstadoTooltip | null = null
  if (indice != null && dias[indice]) {
    const d = dias[indice]
    const v = valores[indice]
    tooltip = {
      x: x(indice),
      y: v != null ? y(v) : M.topo,
      conteudo: (
        <>
          <div className="pl-sv-tip-titulo">{fmtDiaLongo(d.data)}</div>
          <LinhaTip cor="var(--sv-1)" valor={metrica.fmt(v)} rotulo={metrica.rotulo} />
          <div className="pl-sv-tip-linha" style={{ marginTop: 5 }}>{moeda(d.gasto, c)} investidos · {num(d.cliquesLink)} cliques{d.leadsCrm != null ? ` · ${num(d.leadsCrm)} leads no CRM` : ''}</div>
        </>
      ),
    }
  }
  const caminho = (pts: Array<[number, number]>) => pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')

  return (
    <CartaoViz
      titulo="Dia a dia"
      subtitulo={metrica.descricao}
      acoes={<Abas rotulo="Métrica do gráfico" opcoes={metricas.map(m => ({ valor: m.chave, rotulo: m.rotulo }))} valor={metrica.chave} onChange={setChave} />}
      tabela={{
        colunas: ['Dia', 'Investimento', 'Impressões', 'Cliques', nomeDestino, ...(analise.crm.leads != null ? ['Leads CRM'] : []), metrica.rotulo],
        linhas: dias.map((d, i) => [fmtDia(d.data), moeda(d.gasto, c), num(d.impressoes), num(d.cliquesLink), num(d.lpv + d.conversas), ...(analise.crm.leads != null ? [num(d.leadsCrm)] : []), metrica.fmt(valores[i])]),
        alinharDireita: [1, 2, 3, 4, 5, 6],
      }}
    >
      {!temDado ? <Vazio>Sem dados dessa métrica no período.</Vazio> : (
        <div ref={ref} style={{ position: 'relative' }}>
          {largura > 0 && (
            <svg
              className="pl-sv-svg" width={largura} height={ALTURA} role="img" tabIndex={0}
              aria-label={`${metrica.rotulo} por dia. Use as setas pra navegar entre os dias.`}
              onPointerMove={aoMover} onPointerLeave={() => setIndice(null)} onKeyDown={aoTeclar} onBlur={() => setIndice(null)}
            >
              {ticks.map(t => (
                <g key={t}>
                  <line className="grade" x1={M.esq} x2={M.esq + w} y1={y(t)} y2={y(t)} />
                  <text className="eixo" x={M.esq - 8} y={y(t) + 3.5} textAnchor="end">{metrica.eixo(t)}</text>
                </g>
              ))}
              <line className="base" x1={M.esq} x2={M.esq + w} y1={base} y2={base} />
              {metrica.forma === 'barra' ? valores.map((v, i) => {
                if (!v) return null
                const topoBarra = y(v)
                const alt = Math.max(1, base - topoBarra)
                const r = Math.min(4, larguraBarra / 2, alt)
                const x0 = x(i) - larguraBarra / 2
                return (
                  <path
                    key={i} opacity={indice == null || indice === i ? 1 : 0.55} fill="var(--sv-1)"
                    d={`M${x0} ${base} V${topoBarra + r} Q${x0} ${topoBarra} ${x0 + r} ${topoBarra} H${x0 + larguraBarra - r} Q${x0 + larguraBarra} ${topoBarra} ${x0 + larguraBarra} ${topoBarra + r} V${base} Z`}
                  />
                )
              }) : trechos.map((t, i) => (
                <g key={i}>
                  <path d={caminho(t)} fill="none" stroke="var(--sv-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {t.length === 1 && <circle cx={t[0][0]} cy={t[0][1]} r={4} fill="var(--sv-1)" stroke="var(--pl-surface)" strokeWidth={2} />}
                </g>
              ))}
              {dias.map((d, i) => (i % passo === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= passo * 0.6) && (
                <text key={d.data} className="eixo" x={x(i)} y={base + 22} textAnchor="middle">{fmtDia(d.data)}</text>
              ))}
              {indice != null && (
                <g pointerEvents="none">
                  <line x1={x(indice)} x2={x(indice)} y1={M.topo} y2={base} stroke="var(--pl-border-strong)" strokeWidth={1} />
                  {metrica.forma === 'linha' && valores[indice] != null && <circle cx={x(indice)} cy={y(valores[indice]!)} r={5} fill="var(--sv-1)" stroke="var(--pl-surface)" strokeWidth={2} />}
                </g>
              )}
            </svg>
          )}
          <Tooltip estado={tooltip} largura={largura} />
        </div>
      )}
    </CartaoViz>
  )
}
