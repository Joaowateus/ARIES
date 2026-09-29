'use client'

import { useState } from 'react'
import { Abas, CartaoViz, DIA_CURTO, DIA_LONGO, EstadoTooltip, LinhaTip, ORDEM_DIAS, Tooltip, Vazio, fmtCompacto, fmtNum, fmtPct, useLargura } from './viz'

type Celula = { dia: number; bloco: number; quantidade: number; alcanceMedio: number; taxaEngajamento: number }
type Metrica = 'alcance' | 'engajamento'

const ESCALA = ['var(--sv-seq-1)', 'var(--sv-seq-2)', 'var(--sv-seq-3)', 'var(--sv-seq-4)', 'var(--sv-seq-5)']
const BLOCOS = Array.from({ length: 8 }, (_, b) => `${b * 3}h`)

// Mapa de calor dia × faixa de 3h: cor sequencial (um azul, 5 degraus) pelo
// desempenho médio dos posts publicados ali; célula sem post fica vazia
// (neutra) — "não testado" é diferente de "foi mal".
export function MapaCalorHorarios({ heatmap, recarregando }: { heatmap: Celula[]; recarregando?: boolean }) {
  const [metrica, setMetrica] = useState<Metrica>('alcance')
  const [ativo, setAtivo] = useState<Celula | null>(null)
  const [ref, largura] = useLargura<HTMLDivElement>()

  const valor = (c: Celula) => (metrica === 'alcance' ? c.alcanceMedio : c.taxaEngajamento)
  const comPost = heatmap.filter(c => c.quantidade > 0)
  const max = Math.max(0, ...comPost.map(valor))
  const degrau = (v: number) => Math.min(4, Math.floor((v / (max || 1)) * 5))
  const melhor = comPost.length > 0 ? comPost.reduce((a, b) => (valor(b) > valor(a) ? b : a)) : null

  const margemEsq = 40
  const margemTopo = 22
  const w = largura
  const larguraCel = Math.max(22, (w - margemEsq) / 8)
  const alturaCel = 30
  const altura = margemTopo + alturaCel * 7 + 4

  let tooltip: EstadoTooltip | null = null
  if (ativo) {
    const linha = ORDEM_DIAS.indexOf(ativo.dia)
    tooltip = {
      x: margemEsq + (ativo.bloco + 1) * larguraCel,
      y: margemTopo + linha * alturaCel,
      conteudo: (
        <>
          <div className="pl-sv-tip-titulo">{DIA_LONGO[ativo.dia]} · {ativo.bloco * 3}h–{ativo.bloco * 3 + 3}h</div>
          {ativo.quantidade === 0 ? <div className="pl-sv-tip-linha">Nenhum post nesse horário</div> : (
            <>
              <LinhaTip valor={fmtNum(ativo.alcanceMedio)} rotulo="alcance médio" />
              <LinhaTip valor={fmtPct(ativo.taxaEngajamento)} rotulo="engajamento" />
              <LinhaTip valor={fmtNum(ativo.quantidade)} rotulo={ativo.quantidade === 1 ? 'post' : 'posts'} />
            </>
          )}
        </>
      ),
    }
  }

  return (
    <CartaoViz
      titulo="Mapa de calor: dia × horário"
      subtitulo="Desempenho médio dos posts por dia da semana e faixa de horário (Brasília)"
      recarregando={recarregando}
      acoes={<Abas rotulo="Métrica do mapa" valor={metrica} onChange={setMetrica} opcoes={[{ valor: 'alcance', rotulo: 'Alcance' }, { valor: 'engajamento', rotulo: 'Engajamento' }]} />}
      tabela={{
        colunas: ['Dia', 'Faixa', 'Posts', 'Alcance médio', 'Engajamento'],
        linhas: comPost
          .sort((a, b) => valor(b) - valor(a))
          .map(c => [DIA_LONGO[c.dia], `${c.bloco * 3}h–${c.bloco * 3 + 3}h`, c.quantidade, fmtNum(c.alcanceMedio), fmtPct(c.taxaEngajamento)]),
      }}
      rodape={melhor ? `Melhor combinação no período: ${DIA_LONGO[melhor.dia].toLowerCase()}, ${melhor.bloco * 3}h–${melhor.bloco * 3 + 3}h (${metrica === 'alcance' ? `${fmtNum(melhor.alcanceMedio)} contas em média` : fmtPct(melhor.taxaEngajamento)} · ${melhor.quantidade} ${melhor.quantidade === 1 ? 'post' : 'posts'}).` : undefined}
    >
      {comPost.length === 0 ? <Vazio>Nenhuma publicação no período.</Vazio> : (
        <div ref={ref} style={{ position: 'relative' }}>
          {w > 0 && (
            <svg className="pl-sv-svg" width={w} height={altura} role="img" aria-label="Mapa de calor de desempenho por dia e horário">
              {BLOCOS.map((b, i) => (
                <text key={b} className="eixo" x={margemEsq + i * larguraCel + larguraCel / 2} y={14} textAnchor="middle">{b}</text>
              ))}
              {ORDEM_DIAS.map((dia, linha) => (
                <g key={dia}>
                  <text className="eixo" x={margemEsq - 8} y={margemTopo + linha * alturaCel + alturaCel / 2 + 4} textAnchor="end">{DIA_CURTO[dia]}</text>
                  {Array.from({ length: 8 }, (_, bloco) => {
                    const c = heatmap.find(h => h.dia === dia && h.bloco === bloco) ?? { dia, bloco, quantidade: 0, alcanceMedio: 0, taxaEngajamento: 0 }
                    const x = margemEsq + bloco * larguraCel
                    const y = margemTopo + linha * alturaCel
                    const ehMelhor = melhor && melhor.dia === dia && melhor.bloco === bloco
                    return (
                      <g key={bloco}>
                        <rect
                          className="marca"
                          x={x + 1}
                          y={y + 1}
                          width={larguraCel - 2}
                          height={alturaCel - 2}
                          rx={4}
                          fill={c.quantidade > 0 ? ESCALA[degrau(valor(c))] : 'var(--pl-surface-2)'}
                          stroke={ativo === c || ehMelhor ? 'var(--pl-ink-1)' : 'none'}
                          strokeWidth={ehMelhor ? 1.5 : 1}
                        />
                        {c.quantidade > 0 && larguraCel >= 34 && (
                          <text x={x + larguraCel / 2} y={y + alturaCel / 2 + 4} textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 600, fill: `var(--sv-seq-ink-${degrau(valor(c)) + 1})`, fontFamily: 'IBM Plex Mono' }}>
                            {c.quantidade}
                          </text>
                        )}
                        <rect
                          className="alvo-hover"
                          x={x}
                          y={y}
                          width={larguraCel}
                          height={alturaCel}
                          tabIndex={c.quantidade > 0 ? 0 : -1}
                          aria-label={`${DIA_LONGO[dia]} ${bloco * 3}h: ${c.quantidade} posts, alcance médio ${fmtNum(c.alcanceMedio)}`}
                          onPointerEnter={() => setAtivo(c)}
                          onPointerLeave={() => setAtivo(null)}
                          onFocus={() => setAtivo(c)}
                          onBlur={() => setAtivo(null)}
                        />
                      </g>
                    )
                  })}
                </g>
              ))}
            </svg>
          )}
          <Tooltip estado={tooltip} largura={w} />
          <div className="pl-sv-legenda" style={{ alignItems: 'center' }}>
            <span>menor</span>
            {ESCALA.map(c => <i key={c} style={{ background: c, width: 22, height: 10 }} />)}
            <span>maior {metrica === 'alcance' ? 'alcance médio' : 'engajamento'}</span>
            <span style={{ marginLeft: 8 }}><i style={{ background: 'var(--pl-surface-2)' }} />sem post</span>
            <span>número = qtd. de posts</span>
          </div>
        </div>
      )}
    </CartaoViz>
  )
}

// Seguidores online por hora (dado do próprio Instagram). Série única, sem
// legenda — o título diz o que é; o pico fica no azul de destaque.
export function SeguidoresOnline({ valores, recarregando }: { valores: number[] | null; recarregando?: boolean }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [ativo, setAtivo] = useState<number | null>(null)
  const disponivel = valores != null && valores.some(v => v > 0)
  const max = disponivel ? Math.max(...(valores as number[])) : 0
  const pico = disponivel ? (valores as number[]).indexOf(max) : -1

  const altura = 170
  const margem = { topo: 16, base: 24, esq: 8, dir: 8 }
  const w = largura
  const larguraBarra = (w - margem.esq - margem.dir) / 24
  const h = altura - margem.topo - margem.base
  const espessura = Math.min(24, Math.max(3, larguraBarra - 3))

  let tooltip: EstadoTooltip | null = null
  if (ativo != null && valores) {
    tooltip = {
      x: margem.esq + (ativo + 0.5) * larguraBarra,
      y: margem.topo + h - (valores[ativo] / (max || 1)) * h,
      conteudo: (
        <>
          <div className="pl-sv-tip-titulo">{ativo}h–{ativo + 1}h</div>
          <LinhaTip cor="var(--sv-1)" valor={fmtNum(valores[ativo])} rotulo="seguidores online (média)" />
        </>
      ),
    }
  }

  return (
    <CartaoViz
      titulo="Quando seus seguidores estão online"
      subtitulo={disponivel ? `Média por hora nos últimos dias · pico às ${pico}h` : 'Dado fornecido pelo próprio Instagram'}
      recarregando={recarregando}
      tabela={disponivel ? { colunas: ['Hora', 'Seguidores online (média)'], linhas: (valores as number[]).map((v, i) => [`${i}h`, fmtNum(v)]) } : undefined}
      rodape={disponivel ? 'Horário conforme o fuso configurado na conta do Instagram — pode diferir do seu. Use junto com o mapa de calor (que mede o desempenho real dos seus posts).' : undefined}
    >
      {!disponivel ? <Vazio>O Instagram ainda não liberou esse dado pra conta (exige 100+ seguidores e alguns dias de histórico).</Vazio> : (
        <div ref={ref} style={{ position: 'relative' }}>
          {w > 0 && (
            <svg className="pl-sv-svg" width={w} height={altura} role="img" aria-label={`Seguidores online por hora, pico às ${pico}h`}>
              <line className="base" x1={margem.esq} x2={w - margem.dir} y1={margem.topo + h} y2={margem.topo + h} />
              {(valores as number[]).map((v, i) => {
                const hb = (v / (max || 1)) * h
                const x = margem.esq + i * larguraBarra + (larguraBarra - espessura) / 2
                const y = margem.topo + h - hb
                const r = Math.min(4, espessura / 2, hb)
                return (
                  <g key={i}>
                    <path
                      className={`marca ${ativo != null && ativo !== i ? 'apagada' : ''}`}
                      d={`M${x} ${margem.topo + h} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + espessura - r} Q${x + espessura} ${y} ${x + espessura} ${y + r} V${margem.topo + h} Z`}
                      fill={i === pico ? 'var(--sv-1)' : 'var(--sv-seq-1)'}
                    />
                    <rect className="alvo-hover" x={margem.esq + i * larguraBarra} y={margem.topo} width={larguraBarra} height={h} onPointerEnter={() => setAtivo(i)} onPointerLeave={() => setAtivo(null)} />
                    {i % 3 === 0 && <text className="eixo" x={margem.esq + (i + 0.5) * larguraBarra} y={altura - 6} textAnchor="middle">{i}h</text>}
                  </g>
                )
              })}
              <text x={margem.esq + (pico + 0.5) * larguraBarra} y={margem.topo + h - h - 4} textAnchor="middle" className="rotulo-forte" style={{ fontSize: 11 }}>{fmtCompacto(max)}</text>
            </svg>
          )}
          <Tooltip estado={tooltip} largura={w} />
        </div>
      )}
    </CartaoViz>
  )
}
