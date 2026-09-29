'use client'

import { useState } from 'react'
import type { AgregadoPostsSocial } from '@/lib/proLaboreApi'
import { Abas, CartaoViz, DIA_CURTO, DIA_LONGO, EstadoTooltip, LinhaTip, ORDEM_DIAS, Tooltip, Vazio, caminhoSetor, fmtCompacto, fmtNum, fmtPct, useLargura } from './viz'

type Metrica = 'alcance' | 'engajamento' | 'publicacoes'
type Dia = { dia: number } & AgregadoPostsSocial

function valorDe(d: Dia, m: Metrica): number {
  if (m === 'alcance') return d.alcanceMedio
  if (m === 'engajamento') return d.taxaEngajamento
  return d.quantidade
}
function formatar(v: number, m: Metrica): string {
  if (m === 'engajamento') return fmtPct(v)
  if (m === 'alcance') return fmtCompacto(v)
  return fmtNum(v)
}

// Leque em semicírculo (radial de colunas): um gomo por dia, ângulos
// iguais, o comprimento do gomo a partir do miolo é o valor. O dia de
// melhor desempenho fica no azul de destaque e os outros num tom de apoio
// — o tamanho já mostra a ordem, a cor só aponta o protagonista.
export function LequeDiasSemana({ porDiaSemana, recarregando }: { porDiaSemana: Dia[]; recarregando?: boolean }) {
  const [metrica, setMetrica] = useState<Metrica>('alcance')
  const [ativo, setAtivo] = useState<number | null>(null)
  const [ref, largura] = useLargura<HTMLDivElement>()

  const dias = ORDEM_DIAS.map(d => porDiaSemana.find(x => x.dia === d) ?? { dia: d, quantidade: 0, alcanceMedio: 0, visualizacoesMedias: 0, interacoesMedias: 0, taxaEngajamento: 0, salvamentosMedios: 0, compartilhamentosMedios: 0, seguidoresGerados: 0 })
  const totalPosts = dias.reduce((s, d) => s + d.quantidade, 0)
  const max = Math.max(...dias.map(d => valorDe(d, metrica)), 0)
  const melhor = max > 0 ? dias.reduce((a, b) => (valorDe(b, metrica) > valorDe(a, metrica) ? b : a)) : null

  const w = largura
  const R = Math.max(60, Math.min(w / 2 - 64, 190))
  const r0 = Math.max(34, R * 0.26)
  const cx = w / 2
  const cy = R + 46
  const altura = cy + 30
  const fatia = Math.PI / 7
  const lacuna = 0.028

  let tooltip: EstadoTooltip | null = null
  if (ativo != null) {
    const d = dias[ativo]
    const meio = Math.PI - (ativo + 0.5) * fatia
    const r = r0 + ((R - r0) * valorDe(d, metrica)) / (max || 1)
    tooltip = {
      x: cx + r * Math.cos(meio),
      y: cy - r * Math.sin(meio),
      conteudo: (
        <>
          <div className="pl-sv-tip-titulo">{DIA_LONGO[d.dia]}</div>
          <LinhaTip cor="var(--sv-1)" valor={fmtNum(d.quantidade)} rotulo={d.quantidade === 1 ? 'publicação' : 'publicações'} />
          <LinhaTip valor={fmtNum(d.alcanceMedio)} rotulo="alcance médio" />
          <LinhaTip valor={fmtPct(d.taxaEngajamento)} rotulo="taxa de engajamento" />
          <LinhaTip valor={fmtNum(d.interacoesMedias)} rotulo="interações médias" />
        </>
      ),
    }
  }

  return (
    <CartaoViz
      titulo="Desempenho por dia da semana"
      subtitulo={`Média dos posts publicados em cada dia · ${totalPosts} ${totalPosts === 1 ? 'publicação analisada' : 'publicações analisadas'}`}
      recarregando={recarregando}
      acoes={<Abas rotulo="Métrica do leque" valor={metrica} onChange={setMetrica} opcoes={[{ valor: 'alcance', rotulo: 'Alcance' }, { valor: 'engajamento', rotulo: 'Engajamento' }, { valor: 'publicacoes', rotulo: 'Nº de posts' }]} />}
      tabela={{
        colunas: ['Dia', 'Publicações', 'Alcance médio', 'Taxa de engajamento', 'Interações médias'],
        linhas: dias.map(d => [DIA_LONGO[d.dia], d.quantidade, fmtNum(d.alcanceMedio), fmtPct(d.taxaEngajamento), fmtNum(d.interacoesMedias)]),
      }}
      rodape={totalPosts > 0 && totalPosts < 10 ? 'Poucas publicações no período — use um intervalo maior (30 ou 90 dias) pra um padrão mais confiável.' : undefined}
    >
      {totalPosts === 0 ? <Vazio>Nenhuma publicação no período.</Vazio> : (
        <div ref={ref} style={{ position: 'relative' }}>
          {w > 0 && (
            <svg className="pl-sv-svg" width={w} height={altura} role="img" aria-label="Leque de desempenho por dia da semana">
              {dias.map((d, i) => {
                const a1 = Math.PI - i * fatia - lacuna / 2
                const a0 = Math.PI - (i + 1) * fatia + lacuna / 2
                const v = valorDe(d, metrica)
                const r = r0 + ((R - r0) * v) / (max || 1)
                const ehMelhor = melhor?.dia === d.dia
                const meio = (a0 + a1) / 2
                const rotR = R + 16
                const lx = cx + rotR * Math.cos(meio)
                const ly = cy - rotR * Math.sin(meio)
                const ancora = Math.cos(meio) > 0.25 ? 'start' : Math.cos(meio) < -0.25 ? 'end' : 'middle'
                return (
                  <g key={d.dia}>
                    <path d={caminhoSetor(cx, cy, r0, R, a0, a1)} fill="var(--pl-surface-2)" />
                    {v > 0 && (
                      <path
                        className={`marca ${ativo != null && ativo !== i ? 'apagada' : ''} ${ativo === i ? 'ativa' : ''}`}
                        d={caminhoSetor(cx, cy, r0, r, a0, a1)}
                        fill={ehMelhor ? 'var(--sv-1)' : 'var(--sv-seq-1)'}
                      />
                    )}
                    {/* alvo de hover = o gomo inteiro (trilho + valor), maior que a marca */}
                    <path
                      className="alvo-hover"
                      d={caminhoSetor(cx, cy, r0, R + 8, a0, a1)}
                      tabIndex={0}
                      role="img"
                      aria-label={`${DIA_LONGO[d.dia]}: ${formatar(v, metrica)}, ${d.quantidade} publicações`}
                      onPointerEnter={() => setAtivo(i)}
                      onPointerLeave={() => setAtivo(null)}
                      onFocus={() => setAtivo(i)}
                      onBlur={() => setAtivo(null)}
                    />
                    <text x={lx} y={ly - 3} textAnchor={ancora} className={ehMelhor ? 'rotulo-forte' : ''} style={ehMelhor ? undefined : { fontWeight: 600 }}>{DIA_CURTO[d.dia]}</text>
                    <text x={lx} y={ly + 11} textAnchor={ancora} className="eixo">{d.quantidade > 0 ? formatar(v, metrica) : '—'}</text>
                  </g>
                )
              })}
              <circle cx={cx} cy={cy} r={r0 - 6} fill="var(--pl-surface-2)" />
              <text x={cx} y={cy - 8} textAnchor="middle" className="rotulo-leve">melhor dia</text>
              <text x={cx} y={cy + 10} textAnchor="middle" className="rotulo-forte" style={{ fontSize: 14 }}>{melhor ? DIA_CURTO[melhor.dia] : '—'}</text>
              <line x1={cx - R - 8} x2={cx + R + 8} y1={cy} y2={cy} className="base" />
            </svg>
          )}
          <Tooltip estado={tooltip} largura={w} />
          <div className="pl-sv-legenda">
            <span><i style={{ background: 'var(--sv-1)' }} />Melhor dia</span>
            <span><i style={{ background: 'var(--sv-seq-1)' }} />Demais dias</span>
            <span><i style={{ background: 'var(--pl-surface-2)' }} />Escala até o máximo</span>
          </div>
        </div>
      )}
    </CartaoViz>
  )
}
