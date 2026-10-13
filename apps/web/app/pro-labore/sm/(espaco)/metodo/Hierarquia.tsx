'use client'

// Hierarquia das métricas do método: a ordem em que o perfil é lido, do
// centro para fora (vendas no centro, seguidores na borda). Os anéis são a
// ordem de leitura, não o tamanho do número; os valores ficam na lista ao
// lado, que também é a leitura acessível do gráfico. Encaminhamentos em
// destaque: é o sinal que mais distribui.
import { useState } from 'react'
import type { SmMetricaHierarquia } from '@/lib/proLaboreApi'

const DESTAQUE: SmMetricaHierarquia['chave'] = 'encaminhamentos'
const LADO = 360
const PASSO = LADO / 7

const compacto = (v: number) => v >= 10000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : v.toLocaleString('pt-BR')

/** Quarto de anel com o centro no canto de baixo à esquerda. */
function quartoDeAnel(r0: number, r1: number): string {
  const y = (r: number) => LADO - r
  if (r0 === 0) return `M0 ${LADO} L0 ${y(r1)} A${r1} ${r1} 0 0 1 ${r1} ${LADO} Z`
  return `M0 ${y(r1)} A${r1} ${r1} 0 0 1 ${r1} ${LADO} L${r0} ${LADO} A${r0} ${r0} 0 0 0 0 ${y(r0)} Z`
}

export function Hierarquia({ metricas, legenda }: { metricas: SmMetricaHierarquia[]; legenda?: string }) {
  const [ativa, setAtiva] = useState<SmMetricaHierarquia['chave'] | null>(null)
  return (
    <div className="sm-hier">
      <svg className="sm-hier-grafico" viewBox={`-4 -4 ${LADO + 8} ${LADO + 8}`} role="img"
        aria-label="Anéis do centro para fora: vendas, MQL, lead, encaminhamentos, alcance, engajamento e seguidores. Os números estão na lista ao lado.">
        {metricas.map((m, i) => {
          const r0 = i * PASSO, r1 = (i + 1) * PASSO
          const destaque = m.chave === DESTAQUE
          return (
            <g key={m.chave} className={`sm-hier-anel${destaque ? ' destaque' : ''}${ativa === m.chave ? ' ativo' : ''}`} style={{ ['--i' as string]: i }}
              onMouseEnter={() => setAtiva(m.chave)} onMouseLeave={() => setAtiva(null)}>
              <path d={quartoDeAnel(r0, r1)} />
              <title>{`${String(i + 1).padStart(2, '0')} ${m.rotulo}: ${m.valor != null ? m.valor.toLocaleString('pt-BR') : 'sem número'}`}</title>
            </g>
          )
        })}
        {metricas.map((m, i) => (
          <text key={m.chave} x={8} y={LADO - (i + 0.5) * PASSO + 4} className={`sm-hier-txt${m.chave === DESTAQUE ? ' destaque' : ''}`}>
            {String(i + 1).padStart(2, '0')} {m.rotulo}
          </text>
        ))}
        <path d={`M0 0 V${LADO} H${LADO}`} className="sm-hier-eixo" />
      </svg>
      <ol className="sm-hier-lista">
        {metricas.map((m, i) => (
          <li key={m.chave} className={`${m.chave === DESTAQUE ? 'destaque' : ''}${ativa === m.chave ? ' ativo' : ''}`}
            onMouseEnter={() => setAtiva(m.chave)} onMouseLeave={() => setAtiva(null)}>
            <span className="sm-hier-n sm-mono">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <div className="sm-hier-linha"><b>{m.rotulo}</b><span className="sm-num">{m.valor != null ? compacto(m.valor) : '—'}</span></div>
              <span className="sm-legenda">{m.valor == null && m.motivo ? m.motivo : m.detalhe}</span>
            </div>
          </li>
        ))}
      </ol>
      {legenda && <p className="sm-legenda sm-hier-rodape">{legenda}</p>}
    </div>
  )
}
