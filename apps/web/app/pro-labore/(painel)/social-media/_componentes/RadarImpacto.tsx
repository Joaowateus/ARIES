'use client'

import { useId, useState } from 'react'
import type { FaixaImpactoSocial, FormatoPostSocial, PostSocial } from '@/lib/proLaboreApi'
import {
  COR_FORMATO, CartaoViz, EstadoTooltip, LinhaTip, ORDEM_FORMATOS, ROTULO_FAIXA, ROTULO_FORMATO, Tooltip, Vazio,
  caminhoArco, caminhoSetor, dataDeChave, fmtDataHora, fmtDiaMes, fmtNum, fmtPct, useLargura,
} from './viz'

// Faixas de impacto = setores angulares, do eixo X (baixo) ao eixo Y
// (excepcional); dentro de cada setor, o ângulo segue o índice (alcance do
// post ÷ mediana de alcance dos últimos 90 dias).
const FAIXAS: Array<{ faixa: FaixaImpactoSocial; de: number; ate: number }> = [
  { faixa: 'BAIXO', de: 0, ate: 0.7 },
  { faixa: 'MEDIO', de: 0.7, ate: 1.3 },
  { faixa: 'ALTO', de: 1.3, ate: 2.5 },
  { faixa: 'EXCEPCIONAL', de: 2.5, ate: 6 },
]
const SETOR = Math.PI / 2 / FAIXAS.length
const OPACIDADE_ANEL = [0.24, 0.18, 0.13, 0.09, 0.06]
const DIA_MS = 24 * 60 * 60 * 1000

function anguloDoIndice(indice: number): number {
  const i = FAIXAS.findIndex(f => indice < f.ate)
  const k = i === -1 ? FAIXAS.length - 1 : i
  const f = FAIXAS[k]
  // Escala logarítmica no último setor (índices podem ir de 2,5× a 20×+).
  const t = k === FAIXAS.length - 1
    ? Math.min(1, Math.log(Math.max(indice, f.de) / f.de) / Math.log(f.ate / f.de))
    : (indice - f.de) / (f.ate - f.de)
  const pad = 0.1
  return k * SETOR + SETOR * (pad + (1 - 2 * pad) * Math.max(0, Math.min(1, t)))
}

export function RadarImpacto({ posts, medianaReferencia, diasReferencia, periodo, recarregando }: {
  posts: PostSocial[]
  medianaReferencia: number
  diasReferencia: number
  periodo: { inicio: string; fim: string; dias: number }
  recarregando?: boolean
}) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [ativo, setAtivo] = useState<string | null>(null)
  const [isolado, setIsolado] = useState<FormatoPostSocial | null>(null)
  const idArco = useId().replace(/:/g, '')

  const comIndice = posts.filter(p => p.indiceImpacto != null)
  const semIndice = posts.length - comIndice.length

  const w = largura
  const margemEsq = 20
  const R = Math.max(150, Math.min(w - margemEsq - 50, 470))
  const Ra = R + 26
  const ox = margemEsq
  const oy = Ra + 22
  const altura = oy + 58
  const rMin = 14
  // No celular o arco de cada faixa fica curto demais pro rótulo em
  // tamanho normal ("EXCEPCIONAL" cortava) — encolhe fonte e espaçamento.
  const rotuloCompacto = R < 320
  const bandas = Math.max(1, Math.min(5, periodo.dias))
  const fimMs = dataDeChave(periodo.fim).getTime() + DIA_MS
  const inicioMs = dataDeChave(periodo.inicio).getTime()
  const duracao = Math.max(DIA_MS, fimMs - inicioMs)
  const raioDoTempo = (iso: string) => {
    const idade = Math.max(0, Math.min(1, (fimMs - new Date(iso).getTime()) / duracao))
    return rMin + (R - rMin) * idade
  }
  const raioBanda = (i: number) => rMin + ((R - rMin) * i) / bandas
  const px = (r: number, a: number) => ox + r * Math.cos(a)
  const py = (r: number, a: number) => oy - r * Math.sin(a)

  const contagem = FAIXAS.map(f => ({ ...f, n: comIndice.filter(p => p.faixaImpacto === f.faixa).length }))
  const porFormato = ORDEM_FORMATOS.map(f => ({ f, n: comIndice.filter(p => p.formato === f).length }))
  const postAtivo = comIndice.find(p => p.id === ativo) ?? null

  // Pontos vizinhos se sobrepõem em rajadas de posts (mesmo dia, impacto
  // parecido): em vez de alvos fixos que brigam entre si, o mouse ativa o
  // ponto mais próximo do cursor, até 18px de distância.
  function aoMover(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    let melhor: string | null = null
    let menor = 18 * 18
    for (const p of comIndice) {
      if (isolado && p.formato !== isolado) continue
      const a = anguloDoIndice(p.indiceImpacto ?? 0)
      const r = raioDoTempo(p.publicadoEm)
      const d = (px(r, a) - mx) ** 2 + (py(r, a) - my) ** 2
      if (d < menor) { menor = d; melhor = p.id }
    }
    setAtivo(melhor)
  }
  const destaques = [...comIndice].sort((a, b) => (b.indiceImpacto ?? 0) - (a.indiceImpacto ?? 0)).slice(0, 3)

  let tooltip: EstadoTooltip | null = null
  if (postAtivo && postAtivo.indiceImpacto != null) {
    const a = anguloDoIndice(postAtivo.indiceImpacto)
    const r = raioDoTempo(postAtivo.publicadoEm)
    tooltip = {
      x: px(r, a),
      y: py(r, a),
      conteudo: (
        <>
          {postAtivo.thumbnail && <img className="pl-sv-tip-img" src={postAtivo.thumbnail} alt="" />}
          <div className="pl-sv-tip-titulo">{ROTULO_FORMATO[postAtivo.formato]} · {fmtDataHora(postAtivo.publicadoEm)}</div>
          {postAtivo.legenda && <div className="pl-sv-tip-legenda">{postAtivo.legenda}</div>}
          <LinhaTip cor={COR_FORMATO[postAtivo.formato]} valor={fmtNum(postAtivo.alcance)} rotulo={`alcance · ${postAtivo.indiceImpacto.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× a mediana`} />
          <LinhaTip valor={fmtPct(postAtivo.taxaEngajamento)} rotulo="engajamento" />
          <LinhaTip valor={`${fmtNum(postAtivo.salvamentos)} · ${fmtNum(postAtivo.compartilhamentos)}`} rotulo="salvos · compart." />
          <div className="pl-sv-tip-linha" style={{ marginTop: 6 }}>Impacto <b style={{ marginLeft: 4 }}>{ROTULO_FAIXA[postAtivo.faixaImpacto ?? 'MEDIO']}</b></div>
          {postAtivo.permalink && <div className="pl-sv-tip-linha" style={{ marginTop: 4, color: 'var(--pl-ink-muted)' }}>Clique pra abrir no Instagram</div>}
        </>
      ),
    }
  }

  // Rótulo de cada anel (fatia do período) sob o eixo X.
  const rotulosBandas = Array.from({ length: bandas }, (_, i) => {
    const deMs = fimMs - ((i + 1) * duracao) / bandas
    const ateMs = fimMs - (i * duracao) / bandas - 1
    const de = new Date(deMs)
    const ate = new Date(ateMs)
    const chave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const larguraBanda = raioBanda(i + 1) - raioBanda(i)
    const texto = chave(de) === chave(ate) ? fmtDiaMes(chave(ate)) : larguraBanda > 78 ? `${fmtDiaMes(chave(de))}–${fmtDiaMes(chave(ate))}` : fmtDiaMes(chave(de))
    return { x: ox + (raioBanda(i) + raioBanda(i + 1)) / 2, texto }
  })

  return (
    <CartaoViz
      titulo="Radar de impacto das publicações"
      subtitulo={medianaReferencia > 0
        ? `Cada ponto é um post. Quanto mais pro alto, maior o alcance em relação à sua mediana (${fmtNum(medianaReferencia)} contas nos últimos ${diasReferencia} dias); quanto mais pra fora, mais antigo.`
        : 'Cada ponto é um post, posicionado pelo impacto no alcance e pela data.'}
      recarregando={recarregando}
      tabela={{
        colunas: ['Publicado em', 'Formato', 'Alcance', 'Índice (× mediana)', 'Impacto', 'Engajamento'],
        linhas: [...comIndice].sort((a, b) => (b.indiceImpacto ?? 0) - (a.indiceImpacto ?? 0)).map(p => [
          fmtDataHora(p.publicadoEm), ROTULO_FORMATO[p.formato], fmtNum(p.alcance),
          `${(p.indiceImpacto ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}×`, ROTULO_FAIXA[p.faixaImpacto ?? 'MEDIO'], fmtPct(p.taxaEngajamento),
        ]),
      }}
      rodape={semIndice > 0 ? `${semIndice} ${semIndice === 1 ? 'post ainda não tem' : 'posts ainda não têm'} métricas sincronizadas e ${semIndice === 1 ? 'ficou' : 'ficaram'} de fora do radar.` : undefined}
    >
      {comIndice.length === 0 ? <Vazio>Nenhuma publicação com métricas no período.</Vazio> : (
        <div className="pl-sv-radar-layout">
        <div ref={ref} style={{ position: 'relative' }}>
          {w > 0 && (
            <svg
              className="pl-sv-svg"
              width={w}
              height={altura}
              role="img"
              aria-label="Radar de impacto: posts por impacto no alcance e data de publicação"
              onPointerMove={aoMover}
              onPointerLeave={() => setAtivo(null)}
              onClick={() => { const p = comIndice.find(x => x.id === ativo); if (p?.permalink) window.open(p.permalink, '_blank', 'noopener,noreferrer') }}
              style={{ cursor: ativo ? 'pointer' : 'default' }}
            >
              <defs>
                {/* Caminhos de texto no sentido horário: as letras ficam
                    em pé, com o topo virado pra fora do círculo. */}
                <path id={`${idArco}-seta`} d={caminhoArco(ox, oy, Ra, Math.PI / 2 - 0.02, 0.02)} />
                {FAIXAS.map((_, k) => (
                  <path key={k} id={`${idArco}-f${k}`} d={caminhoArco(ox, oy, R - 13, (k + 1) * SETOR - 0.03, k * SETOR + 0.03)} />
                ))}
              </defs>

              {/* Anéis de tempo — mais intensos perto do presente */}
              {Array.from({ length: bandas }, (_, i) => (
                <path key={`b${i}`} d={caminhoSetor(ox, oy, raioBanda(i), raioBanda(i + 1), 0, Math.PI / 2)} fill={`rgba(var(--sv-rgb), ${OPACIDADE_ANEL[Math.min(i, OPACIDADE_ANEL.length - 1)]})`} />
              ))}
              {Array.from({ length: bandas }, (_, i) => (
                <path key={`l${i}`} d={caminhoArco(ox, oy, raioBanda(i + 1), 0, Math.PI / 2)} fill="none" stroke="var(--sv-1)" strokeWidth={i === bandas - 1 ? 2.5 : 1.5} opacity={0.55} />
              ))}
              {/* Divisões entre faixas de impacto (lacuna na cor da superfície) */}
              {[1, 2, 3].map(k => (
                <line key={`d${k}`} x1={ox} y1={oy} x2={px(R, k * SETOR)} y2={py(R, k * SETOR)} stroke="var(--pl-surface)" strokeWidth={2} />
              ))}

              {FAIXAS.map((f, k) => (
                <text key={f.faixa} style={{ fontFamily: 'IBM Plex Mono', fontSize: rotuloCompacto ? 8.5 : 10.5, fontWeight: 700, letterSpacing: rotuloCompacto ? '.02em' : '.12em', fill: 'var(--pl-ink-1)' }}>
                  <textPath href={`#${idArco}-f${k}`} startOffset="50%" textAnchor="middle">{ROTULO_FAIXA[f.faixa].toUpperCase()}</textPath>
                </text>
              ))}

              {/* Seta curva de "impacto", como na referência */}
              <path d={caminhoArco(ox, oy, Ra, 0.02, Math.PI / 2 - 0.02)} fill="none" stroke="var(--sv-1)" strokeWidth={18} strokeLinecap="butt" />
              <path
                d={`M ${px(Ra + 16, Math.PI / 2 - 0.02)} ${py(Ra + 16, Math.PI / 2 - 0.02)} L ${ox - 16} ${oy - Ra} L ${px(Ra - 16, Math.PI / 2 - 0.02)} ${py(Ra - 16, Math.PI / 2 - 0.02)} Z`}
                fill="var(--sv-1)"
              />
              <text style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', fill: 'var(--sv-on-1)' }} dy={3.5}>
                <textPath href={`#${idArco}-seta`} startOffset="50%" textAnchor="middle">IMPACTO NO ALCANCE</textPath>
              </text>

              {/* Pontos (posts) — anel da cor da superfície em volta de cada um */}
              {comIndice.map(p => {
                const a = anguloDoIndice(p.indiceImpacto ?? 0)
                const r = raioDoTempo(p.publicadoEm)
                const apagado = (isolado && p.formato !== isolado) || (ativo != null && ativo !== p.id)
                return (
                  <g key={p.id}>
                    <circle className="marca" cx={px(r, a)} cy={py(r, a)} r={ativo === p.id ? 8 : 6} fill={COR_FORMATO[p.formato]} stroke="var(--pl-surface)" strokeWidth={2} opacity={apagado ? 0.25 : 1} />
                    <circle
                      className="alvo-hover"
                      cx={px(r, a)}
                      cy={py(r, a)}
                      r={12}
                      tabIndex={0}
                      role="link"
                      aria-label={`${ROTULO_FORMATO[p.formato]} de ${fmtDataHora(p.publicadoEm)}: alcance ${fmtNum(p.alcance)}, impacto ${ROTULO_FAIXA[p.faixaImpacto ?? 'MEDIO']}`}
                      // Mouse é tratado pelo "ponto mais próximo" no <svg>; este
                      // alvo fica só pro teclado (Tab + Enter).
                      style={{ pointerEvents: 'none' }}
                      onFocus={() => setAtivo(p.id)}
                      onBlur={() => setAtivo(null)}
                      onKeyDown={e => { if (e.key === 'Enter' && p.permalink) window.open(p.permalink, '_blank', 'noopener,noreferrer') }}
                    />
                  </g>
                )
              })}

              <line className="base" x1={ox} x2={ox + R} y1={oy} y2={oy} />
              {rotulosBandas.map((b, i) => (
                <text key={`t${i}`} className="eixo" x={b.x} y={oy + 16} textAnchor="middle">{b.texto}</text>
              ))}
              <text x={ox} y={oy + 38} className="rotulo-leve">mais recente</text>
              <text x={ox + R} y={oy + 38} className="rotulo-leve" textAnchor="end">mais antigo →</text>
            </svg>
          )}
          <Tooltip estado={tooltip} largura={w} />
        </div>

        <aside className="pl-sv-radar-lado" aria-label="Legenda e destaques do radar">
          <div>
            <div className="pl-sv-radar-bloco-titulo">Formatos · clique pra destacar</div>
            <div className="pl-sv-formatos-filtro">
              {porFormato.map(({ f, n }) => (
                <button
                  key={f}
                  type="button"
                  className="pl-sv-btn-tabela"
                  aria-pressed={isolado === f}
                  title={isolado === f ? 'Mostrar todos os formatos' : `Destacar só ${ROTULO_FORMATO[f]}`}
                  onClick={() => setIsolado(i => (i === f ? null : f))}
                  style={isolado === f ? { borderColor: 'var(--pl-ink-1)', color: 'var(--pl-ink-1)' } : undefined}
                >
                  <i style={{ width: 10, height: 10, borderRadius: '50%', display: 'inline-block', background: COR_FORMATO[f] }} />
                  {ROTULO_FORMATO[f]} <b style={{ fontFamily: 'IBM Plex Mono' }}>{n}</b>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="pl-sv-radar-bloco-titulo">Faixas de impacto</div>
            {[...contagem].reverse().map(c => (
              <div key={c.faixa} className="pl-sv-radar-faixa">
                <span>{ROTULO_FAIXA[c.faixa]}</span>
                <b>{c.n} {c.n === 1 ? 'post' : 'posts'}</b>
                <small>{c.faixa === 'EXCEPCIONAL' ? '2,5× a mediana ou mais' : c.faixa === 'ALTO' ? 'de 1,3× a 2,5× a mediana' : c.faixa === 'MEDIO' ? 'de 0,7× a 1,3× a mediana' : 'abaixo de 0,7× a mediana'}</small>
                <span className="barra"><span style={{ width: `${comIndice.length > 0 ? (c.n / comIndice.length) * 100 : 0}%` }} /></span>
              </div>
            ))}
          </div>

          {destaques.length > 0 && (
            <div>
              <div className="pl-sv-radar-bloco-titulo">Maiores impactos do período</div>
              {destaques.map(p => (
                <a key={p.id} className="pl-sv-radar-destaque" href={p.permalink ?? undefined} target="_blank" rel="noreferrer" onPointerEnter={() => setAtivo(p.id)} onPointerLeave={() => setAtivo(null)}>
                  <span className="pl-sv-post-img">{p.thumbnail ? <img src={p.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}</span>
                  <span className="txt">
                    <div>{p.legenda || 'Sem legenda'}</div>
                    <small><i className="pl-sv-chave" style={{ background: COR_FORMATO[p.formato], width: 8, height: 8, borderRadius: '50%', marginRight: 5 }} />{ROTULO_FORMATO[p.formato]} · {fmtDataHora(p.publicadoEm)}</small>
                  </span>
                  <b>{(p.indiceImpacto ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}×</b>
                </a>
              ))}
            </div>
          )}

          <div className="pl-sv-como-ler">
            <div className="pl-sv-radar-bloco-titulo" style={{ marginBottom: 2 }}>Como ler</div>
            <span>• <b>Ângulo</b>: impacto no alcance em relação à sua mediana — quanto mais pro alto, melhor.</span>
            <span>• <b>Distância do canto</b>: data — perto do canto, mais recente.</span>
            <span>• <b>Cor</b>: formato do post. Passe o mouse num ponto pra ver o post.</span>
          </div>
        </aside>
        </div>
      )}
    </CartaoViz>
  )
}
