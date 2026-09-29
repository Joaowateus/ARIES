'use client'

import { useState } from 'react'
import { CartaoViz, Vazio, caminhoSetor, fmtCompacto, fmtNum, fmtPct } from './viz'

type Composicao = {
  fonte: 'conta' | 'posts'
  curtidas: number; comentarios: number; compartilhamentos: number; salvamentos: number; respostas: number
}

const PARTES: Array<{ chave: keyof Omit<Composicao, 'fonte'>; rotulo: string; cor: string; dica: string }> = [
  { chave: 'curtidas', rotulo: 'Curtidas', cor: 'var(--sv-1)', dica: 'reação rápida' },
  { chave: 'comentarios', rotulo: 'Comentários', cor: 'var(--sv-2)', dica: 'conversa' },
  { chave: 'compartilhamentos', rotulo: 'Compartilhamentos', cor: 'var(--sv-3)', dica: 'leva o post pra novas pessoas' },
  { chave: 'salvamentos', rotulo: 'Salvamentos', cor: 'var(--sv-4)', dica: 'conteúdo útil — sinal forte pro algoritmo' },
  { chave: 'respostas', rotulo: 'Respostas a stories', cor: 'var(--sv-5)', dica: 'conversa direta' },
]

const TAM = 200
const R_EXT = 94
const R_INT = 64

// Anel segmentado com lacuna de superfície entre as fatias e a lista
// numerada ao lado com valor + % (os números nunca dependem do anel).
export function ComposicaoInteracoes({ composicao, recarregando }: { composicao: Composicao; recarregando?: boolean }) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const total = PARTES.reduce((s, p) => s + composicao[p.chave], 0)
  const partes = PARTES.filter(p => composicao[p.chave] > 0 || p.chave !== 'respostas')
  const lacuna = 0.035 // rad

  // Fatias no sentido horário a partir do topo (12h).
  const fracoes = partes.map(p => (total > 0 ? composicao[p.chave] / total : 0))
  const fatias = partes.map((p, i) => {
    const frac = fracoes[i]
    const antes = fracoes.slice(0, i).reduce((s, f) => s + f, 0)
    const varredura = frac * Math.PI * 2
    const a1 = Math.PI / 2 - antes * Math.PI * 2
    const a0 = a1 - varredura
    const folga = varredura > lacuna * 2 ? lacuna / 2 : 0
    return { ...p, i, frac, a0: a0 + folga, a1: a1 - folga, visivel: varredura > 0.001 }
  })
  const destaque = ativo != null ? fatias[ativo] : null

  return (
    <CartaoViz
      titulo="Composição das interações"
      subtitulo={composicao.fonte === 'conta' ? 'Todas as interações da conta no período (inclui posts antigos e stories)' : 'Interações dos posts publicados no período'}
      recarregando={recarregando}
      tabela={{
        colunas: ['Tipo', 'Quantidade', '% do total'],
        linhas: partes.map(p => [p.rotulo, fmtNum(composicao[p.chave]), fmtPct(total > 0 ? composicao[p.chave] / total : 0)]),
      }}
    >
      {total === 0 ? <Vazio>Nenhuma interação registrada nesse período.</Vazio> : (
        <div className="pl-sv-circular">
          <svg className="pl-sv-svg" width={TAM} height={TAM} viewBox={`0 0 ${TAM} ${TAM}`} role="img" aria-label="Composição das interações por tipo">
            <circle cx={TAM / 2} cy={TAM / 2} r={(R_EXT + R_INT) / 2} fill="none" stroke="var(--pl-surface-2)" strokeWidth={R_EXT - R_INT} />
            {fatias.filter(f => f.visivel).map(f => (
              <path
                key={f.chave}
                className={`marca ${ativo != null && ativo !== f.i ? 'apagada' : ''} ${ativo === f.i ? 'ativa' : ''}`}
                d={caminhoSetor(TAM / 2, TAM / 2, R_INT, ativo === f.i ? R_EXT + 4 : R_EXT, f.a0, f.a1)}
                fill={f.cor}
                tabIndex={0}
                role="img"
                aria-label={`${f.rotulo}: ${fmtNum(composicao[f.chave])} (${fmtPct(f.frac)})`}
                onPointerEnter={() => setAtivo(f.i)}
                onPointerLeave={() => setAtivo(null)}
                onFocus={() => setAtivo(f.i)}
                onBlur={() => setAtivo(null)}
              />
            ))}
            <text x={TAM / 2} y={TAM / 2 - 6} textAnchor="middle" className="rotulo-leve">{destaque ? destaque.rotulo : 'Interações'}</text>
            <text x={TAM / 2} y={TAM / 2 + 16} textAnchor="middle" style={{ fontFamily: 'IBM Plex Mono', fontSize: 20, fontWeight: 700, fill: 'var(--pl-ink-1)' }}>
              {destaque ? fmtPct(destaque.frac, 0) : fmtCompacto(total)}
            </text>
          </svg>
          <div className="pl-sv-lista-num">
            {fatias.map(f => (
              <div
                key={f.chave}
                className="pl-sv-lista-num-item"
                onPointerEnter={() => setAtivo(f.i)}
                onPointerLeave={() => setAtivo(null)}
                style={{ opacity: ativo != null && ativo !== f.i ? 0.5 : 1, transition: 'opacity .15s' }}
              >
                <span className="pl-sv-num" style={{ background: f.cor }}>{String(f.i + 1).padStart(2, '0')}</span>
                <span className="titulo">{f.rotulo}<span className="pct">{f.dica}</span></span>
                <span className="valor">{fmtNum(composicao[f.chave])}<span className="pct">{fmtPct(f.frac)}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </CartaoViz>
  )
}
