'use client'

// Criativos: cada anúncio com a miniatura, o que entregou e como a Meta o
// avalia (rankings), mais dois gráficos de decisão — a matriz investimento
// × custo por resultado (onde pôr e onde tirar verba) e a retenção dos
// vídeos (em que ponto as pessoas largam o vídeo).
import { useMemo, useState } from 'react'
import type { AnaliseTrafego, LinhaTabelaTrafego } from '@/lib/proLaboreApi'
import { Abas, CartaoViz, LinhaTip, Tooltip, Vazio, ticksBonitos, useLargura, type EstadoTooltip } from '../../social-media/_componentes/viz'
import { ROTULO_RESULTADO, SINGULAR_RESULTADO, compacto, moeda, num, pct } from './formato'

const RANKING: Record<string, { rotulo: string; classe: 'bom' | 'medio' | 'ruim' }> = {
  ABOVE_AVERAGE: { rotulo: 'Acima da média', classe: 'bom' },
  AVERAGE: { rotulo: 'Na média', classe: 'medio' },
  BELOW_AVERAGE_35: { rotulo: 'Abaixo (35% piores)', classe: 'ruim' },
  BELOW_AVERAGE_20: { rotulo: 'Abaixo (20% piores)', classe: 'ruim' },
  BELOW_AVERAGE_10: { rotulo: 'Abaixo (10% piores)', classe: 'ruim' },
}
const CHAMADA: Record<string, string> = {
  WHATSAPP_MESSAGE: 'Enviar mensagem (WhatsApp)', MESSAGE_PAGE: 'Enviar mensagem', SIGN_UP: 'Cadastre-se', LEARN_MORE: 'Saiba mais',
  GET_QUOTE: 'Pedir orçamento', CONTACT_US: 'Fale conosco', SHOP_NOW: 'Comprar agora', APPLY_NOW: 'Candidate-se', CALL_NOW: 'Ligar agora',
  SUBSCRIBE: 'Assinar', GET_OFFER: 'Obter oferta', BOOK_NOW: 'Reservar', SEND_MESSAGE: 'Enviar mensagem', INSTAGRAM_MESSAGE: 'Enviar mensagem (Direct)',
}
export const STATUS_OBJETO: Record<string, string> = {
  ACTIVE: 'Ativo', PAUSED: 'Pausado', CAMPAIGN_PAUSED: 'Campanha pausada', ADSET_PAUSED: 'Conjunto pausado', ARCHIVED: 'Arquivado', DELETED: 'Excluído',
  IN_PROCESS: 'Processando', WITH_ISSUES: 'Com problemas', DISAPPROVED: 'Reprovado', PENDING_REVIEW: 'Em análise', PREAPPROVED: 'Pré-aprovado',
  PENDING_BILLING_INFO: 'Pagamento pendente',
}
export function StatusObjeto({ status }: { status: string | null }) {
  if (!status) return null
  const ativo = status === 'ACTIVE'
  const ruim = status === 'DISAPPROVED' || status === 'WITH_ISSUES'
  return <span className={`pl-tf-status ${ativo ? 'ativo' : ruim ? 'ruim' : ''}`}><i aria-hidden="true" />{STATUS_OBJETO[status] ?? status}</span>
}

type Ordem = 'gasto' | 'custo' | 'ctr' | 'hook'
type Resultado = LinhaTabelaTrafego['resultado']

// Tipo de resultado que leva mais investimento (conversa, lead…): custo só
// compara anúncios no mesmo tipo.
function tipoDominante(anuncios: LinhaTabelaTrafego[]): Resultado | undefined {
  const porTipo = new Map<Resultado, number>()
  for (const a of anuncios) if (a.metricas.conversas + a.metricas.leads + a.metricas.lpv > 0) porTipo.set(a.resultado, (porTipo.get(a.resultado) ?? 0) + a.metricas.gasto)
  return [...porTipo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}
const custoNoTipo = (a: LinhaTabelaTrafego, tipo: Resultado) => (a.metricas[tipo] > 0 ? a.metricas.gasto / a.metricas[tipo] : null)

function Miniatura({ a }: { a: LinhaTabelaTrafego }) {
  const [falhou, setFalhou] = useState(false)
  const src = a.estrutura?.imagem ?? a.estrutura?.miniatura
  if (!src || falhou) return <div className="pl-tf-cr-thumb vazio" aria-hidden="true">{a.estrutura?.formato === 'video' ? '▶' : '🖼'}</div>
  return (
    <div className="pl-tf-cr-thumb">
      {/* eslint-disable-next-line @next/next/no-img-element -- miniatura vem do CDN da Meta (URL assinada que muda) */}
      <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFalhou(true)} />
      {a.estrutura?.formato === 'video' && <span className="pl-tf-cr-play" aria-hidden="true">▶</span>}
    </div>
  )
}

function CartaoCriativo({ a, moedaConta, total }: { a: LinhaTabelaTrafego; moedaConta: string; total: number }) {
  const e = a.estrutura
  const m = a.metricas, d = a.derivadas
  const resultados = m[a.resultado]
  const semResultado = m.conversas + m.leads + m.lpv === 0 && m.gasto > 0
  // Sem conversa/lead/visualização, o "resultado" seria clique — não compara
  // com os outros anúncios, então o custo fica em branco.
  const custo = semResultado ? null : a.custoResultado
  const fadiga = a.tendenciaCtr != null && a.tendenciaCtr <= -0.3
  const ranks = [['Qualidade', e?.rankQualidade], ['Engajamento', e?.rankEngajamento], ['Conversão', e?.rankConversao]] as const
  return (
    <li className="pl-tf-anuncio">
      <Miniatura a={a} />
      <div className="pl-tf-cr-corpo">
        <div className="pl-tf-cr-topo">
          <StatusObjeto status={a.status} />
          {semResultado && <span className="pl-tf-flag critico">Sem resultado</span>}
          {fadiga && <span className="pl-tf-flag atencao" title="CTR da 2ª metade do período contra a 1ª">Fadiga · CTR {pct(a.tendenciaCtr, 0)}</span>}
        </div>
        <b className="pl-tf-cr-nome" title={a.nome}>{a.nome}</b>
        <small className="pl-tf-cr-onde" title={`${a.campanhaNome} › ${a.adsetNome}`}>{a.campanhaNome} › {a.adsetNome}</small>
        <dl className="pl-tf-cr-num">
          <div><dt>Investido</dt><dd>{moeda(m.gasto, moedaConta)}<small>{total > 0 ? pct(m.gasto / total, 0) : ''}</small></dd></div>
          <div><dt>{ROTULO_RESULTADO[a.resultado]}</dt><dd>{num(resultados)}</dd></div>
          <div><dt>Custo/result.</dt><dd>{moeda(custo, moedaConta)}</dd></div>
          <div><dt>CTR</dt><dd>{pct(d.ctr, 2)}</dd></div>
          <div><dt>Connect</dt><dd>{pct(m.cliquesLink ? (m.lpv + m.conversas) / m.cliquesLink : null)}</dd></div>
          {m.videoViews > 0 ? <div><dt>Hook / Hold</dt><dd>{pct(d.hookRate, 0)} / {pct(d.holdRate, 0)}</dd></div> : <div><dt>CPM</dt><dd>{moeda(d.cpm, moedaConta)}</dd></div>}
        </dl>
        {ranks.some(([, r]) => r) && (
          <div className="pl-tf-cr-ranks">
            {ranks.map(([nome, r]) => r ? <span key={nome} className={`pl-tf-rank ${RANKING[r]?.classe ?? 'medio'}`} title={`Ranking de ${nome.toLowerCase()} (últimos 7 dias)`}>{nome}: {RANKING[r]?.rotulo ?? r}</span> : null)}
          </div>
        )}
        {(e?.titulo || e?.texto) && (
          <details className="pl-tf-cr-texto">
            <summary>Texto do anúncio{e?.chamada ? ` · ${CHAMADA[e.chamada] ?? e.chamada}` : ''}</summary>
            {e?.titulo && <b>{e.titulo}</b>}
            {e?.texto && <p>{e.texto}</p>}
          </details>
        )}
        <div className="pl-tf-cr-rodape">
          {m.engajamento > 0 && <span title="Reações · comentários · compartilhamentos · salvamentos">{num(m.reacoes)} reações · {num(m.comentarios)} coment. · {num(m.compartilhamentos)} compart. · {num(m.salvamentos)} salvos</span>}
          {e?.previa && <a href={e.previa} target="_blank" rel="noopener noreferrer" className="pl-link-action">Ver anúncio ↗</a>}
        </div>
      </div>
    </li>
  )
}

// ---------- Matriz investimento × custo por resultado ----------
const ALT_M = 320
const MM = { topo: 16, dir: 16, base: 40, esq: 64 }

function MatrizCriativos({ anuncios, moedaConta }: { anuncios: LinhaTabelaTrafego[]; moedaConta: string }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [ativo, setAtivo] = useState<string | null>(null)
  // Só compara anúncios com o mesmo tipo de resultado (conversa com conversa…):
  // o tipo que leva mais investimento.
  const tipo = useMemo(() => tipoDominante(anuncios), [anuncios])
  const pontos = (tipo ? anuncios.filter(a => a.metricas.gasto > 0 && (a.resultado === tipo || a.metricas.conversas + a.metricas.leads + a.metricas.lpv === 0)) : [])
    .map(a => ({ ...a, custoResultado: custoNoTipo(a, tipo!) }))
  if (!tipo || pontos.length < 2) return null
  const comCusto = pontos.filter(a => a.custoResultado != null)
  const gastoMedio = pontos.reduce((s, a) => s + a.metricas.gasto, 0) / pontos.length
  const custoMedio = comCusto.reduce((s, a) => s + a.metricas.gasto, 0) / Math.max(1, comCusto.reduce((s, a) => s + a.metricas[a.resultado], 0))
  const maxCusto = Math.max(custoMedio * 2, ...comCusto.map(a => a.custoResultado!))
  const ticksY = ticksBonitos(maxCusto)
  const topoY = ticksY.at(-1) || 1
  const ticksX = ticksBonitos(Math.max(...pontos.map(a => a.metricas.gasto)))
  const topoX = ticksX.at(-1) || 1
  const w = Math.max(0, largura - MM.esq - MM.dir), h = ALT_M - MM.topo - MM.base
  const faixaSem = 22 // faixa no alto: anúncios sem nenhum resultado
  const x = (v: number) => MM.esq + (v / topoX) * w
  const y = (v: number | null) => (v == null ? MM.topo + faixaSem / 2 : MM.topo + faixaSem + (h - faixaSem) - (Math.min(v, topoY) / topoY) * (h - faixaSem))
  const maxRes = Math.max(1, ...pontos.map(a => a.metricas[tipo]))
  const raio = (a: LinhaTabelaTrafego) => 5 + Math.sqrt(a.metricas[tipo] / maxRes) * 9
  const nomeRes = ROTULO_RESULTADO[tipo]
  const fmtX = (v: number) => (v >= 1000 ? `R$ ${compacto(v)}` : moeda(v, moedaConta, 0))
  const a0 = pontos.find(p => p.id === ativo)
  const tip: EstadoTooltip | null = a0 ? {
    x: x(a0.metricas.gasto), y: y(a0.custoResultado),
    conteudo: (
      <>
        <div className="pl-sv-tip-titulo">{a0.nome}</div>
        <LinhaTip valor={moeda(a0.metricas.gasto, moedaConta)} rotulo="investidos" />
        <LinhaTip valor={num(a0.metricas[tipo])} rotulo={nomeRes} />
        <LinhaTip valor={moeda(a0.custoResultado, moedaConta)} rotulo={`por ${SINGULAR_RESULTADO[tipo]}`} />
        <LinhaTip valor={pct(a0.derivadas.ctr, 2)} rotulo="CTR" />
      </>
    ),
  } : null
  const xm = x(gastoMedio), ym = y(custoMedio)
  return (
    <CartaoViz
      titulo="Onde pôr e onde tirar verba"
      subtitulo={`Cada bolinha é um anúncio: investimento × custo por ${SINGULAR_RESULTADO[tipo]} (tamanho = quantidade de ${nomeRes}). Linhas = médias.`}
      tabela={{
        colunas: ['Anúncio', 'Investimento', nomeRes, 'Custo/result.', 'Quadrante'],
        linhas: pontos.map(a => {
          const caro = a.custoResultado == null || a.custoResultado > custoMedio, muito = a.metricas.gasto > gastoMedio
          return [a.nome, moeda(a.metricas.gasto, moedaConta), num(a.metricas[tipo]), moeda(a.custoResultado, moedaConta), caro ? (muito ? 'Revisar já' : 'Pausar ou testar') : (muito ? 'Manter e escalar' : 'Dar mais verba')]
        }),
      }}
    >
      <div ref={ref} style={{ position: 'relative' }}>
        {largura > 0 && (
          <svg className="pl-sv-svg" width={largura} height={ALT_M} role="img" aria-label="Matriz de anúncios por investimento e custo por resultado">
            {/* Quadrantes */}
            <text className="pl-tf-quad" x={MM.esq + 6} y={MM.topo + faixaSem + 14}>Pausar ou testar</text>
            <text className="pl-tf-quad" x={largura - MM.dir - 6} y={MM.topo + faixaSem + 14} textAnchor="end">Revisar já</text>
            <text className="pl-tf-quad" x={MM.esq + 6} y={MM.topo + h - 6}>Dar mais verba</text>
            <text className="pl-tf-quad" x={largura - MM.dir - 6} y={MM.topo + h - 6} textAnchor="end">Manter e escalar</text>
            <rect x={MM.esq} y={MM.topo} width={w} height={faixaSem} fill="var(--pl-surface-2)" rx={4} />
            <text className="eixo" x={MM.esq - 8} y={MM.topo + faixaSem / 2 + 3.5} textAnchor="end">sem result.</text>
            {ticksY.map(t => (
              <g key={t}>
                <line className="grade" x1={MM.esq} x2={MM.esq + w} y1={y(t)} y2={y(t)} />
                <text className="eixo" x={MM.esq - 8} y={y(t) + 3.5} textAnchor="end">{moeda(t, moedaConta, t < 10 ? 2 : 0)}</text>
              </g>
            ))}
            {ticksX.map(t => <text key={t} className="eixo" x={x(t)} y={MM.topo + h + 18} textAnchor="middle">{fmtX(t)}</text>)}
            <line className="base" x1={MM.esq} x2={MM.esq + w} y1={MM.topo + h} y2={MM.topo + h} />
            <line x1={xm} x2={xm} y1={MM.topo} y2={MM.topo + h} stroke="var(--pl-border-strong)" strokeDasharray="4 4" />
            <line x1={MM.esq} x2={MM.esq + w} y1={ym} y2={ym} stroke="var(--pl-border-strong)" strokeDasharray="4 4" />
            <text className="eixo" x={MM.esq + w / 2} y={ALT_M - 4} textAnchor="middle">Investimento no período →</text>
            {[...pontos].sort((p, q) => raio(q) - raio(p)).map(a => (
              <circle key={a.id} cx={x(a.metricas.gasto)} cy={y(a.custoResultado)} r={raio(a)}
                fill="var(--sv-1)" fillOpacity={ativo == null || ativo === a.id ? 0.85 : 0.35} stroke="var(--pl-surface)" strokeWidth={2}
                onPointerEnter={() => setAtivo(a.id)} onPointerLeave={() => setAtivo(null)} style={{ cursor: 'default' }} />
            ))}
          </svg>
        )}
        <Tooltip estado={tip} largura={largura} />
      </div>
    </CartaoViz>
  )
}

// ---------- Retenção dos vídeos ----------
const ALT_R = 240
const MR = { topo: 14, dir: 18, base: 30, esq: 46 }
const PASSOS = [['Início', 'videoPlays'], ['3s', 'videoViews'], ['25%', 'videoP25'], ['50%', 'videoP50'], ['75%', 'videoP75'], ['95%', 'videoP95'], ['100%', 'videoP100']] as const

function curva(m: LinhaTabelaTrafego['metricas']): number[] | null {
  const base = m.videoPlays || m.videoViews
  if (!base) return null
  return PASSOS.map(([, k]) => Math.min(1, (k === 'videoPlays' ? base : m[k]) / base))
}

function RetencaoVideo({ analise }: { analise: AnaliseTrafego }) {
  const videos = analise.anuncios.filter(a => a.metricas.videoViews > 0).slice(0, 20)
  const [sel, setSel] = useState<string>('')
  const [ref, largura] = useLargura<HTMLDivElement>()
  const geral = curva(analise.totais)
  if (!geral || videos.length === 0) return null
  const escolhido = videos.find(v => v.id === sel)
  const cAd = escolhido ? curva(escolhido.metricas) : null
  const w = Math.max(0, largura - MR.esq - MR.dir), h = ALT_R - MR.topo - MR.base
  const x = (i: number) => MR.esq + (i / (PASSOS.length - 1)) * w
  const y = (v: number) => MR.topo + h - v * h
  const linha = (c: number[]) => c.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const tempo = analise.derivadas.tempoMedioVideo
  return (
    <CartaoViz
      titulo="Retenção dos vídeos"
      subtitulo={`De cada 100 reproduções, quantas chegam a cada ponto do vídeo${tempo ? ` · tempo médio assistido ${tempo.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}s` : ''}`}
      acoes={(
        <select className="pl-select pl-tf-select-peq" aria-label="Comparar com um anúncio" value={sel} onChange={e => setSel(e.target.value)}>
          <option value="">Comparar com um anúncio…</option>
          {videos.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
        </select>
      )}
      tabela={{ colunas: ['Ponto do vídeo', 'Todos os vídeos', ...(escolhido ? [escolhido.nome] : [])], linhas: PASSOS.map(([r], i) => [r, pct(geral[i], 0), ...(cAd ? [pct(cAd[i], 0)] : [])]) }}
    >
      <div ref={ref} style={{ position: 'relative' }}>
        {largura > 0 && (
          <svg className="pl-sv-svg" width={largura} height={ALT_R} role="img" aria-label="Curva de retenção dos vídeos">
            {[0, 0.25, 0.5, 0.75, 1].map(t => (
              <g key={t}>
                <line className="grade" x1={MR.esq} x2={MR.esq + w} y1={y(t)} y2={y(t)} />
                <text className="eixo" x={MR.esq - 8} y={y(t) + 3.5} textAnchor="end">{pct(t, 0)}</text>
              </g>
            ))}
            {PASSOS.map(([r], i) => <text key={r} className="eixo" x={x(i)} y={ALT_R - 8} textAnchor="middle">{r}</text>)}
            <path d={`${linha(geral)} L${x(PASSOS.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill="rgba(var(--sv-rgb), 0.10)" />
            <path d={linha(geral)} fill="none" stroke="var(--sv-1)" strokeWidth={2} strokeLinejoin="round" />
            {geral.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={4} fill="var(--sv-1)" stroke="var(--pl-surface)" strokeWidth={2} />)}
            {geral.map((v, i) => i > 0 && <text key={`t${i}`} className="pl-tf-rotulo-ponto" x={x(i)} y={y(v) - 9} textAnchor="middle">{pct(v, 0)}</text>)}
            {cAd && (
              <>
                <path d={linha(cAd)} fill="none" stroke="var(--sv-2)" strokeWidth={2} strokeDasharray="6 4" strokeLinejoin="round" />
                {cAd.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={4} fill="var(--sv-2)" stroke="var(--pl-surface)" strokeWidth={2} />)}
              </>
            )}
          </svg>
        )}
        <div className="pl-sv-legenda">
          <span><i className="pl-tf-key-linha" style={{ borderTopColor: 'var(--sv-1)' }} /> Todos os vídeos</span>
          {escolhido && <span><i className="pl-tf-key-linha" style={{ borderTopColor: 'var(--sv-2)', borderTopStyle: 'dashed' }} /> {escolhido.nome}</span>}
        </div>
      </div>
    </CartaoViz>
  )
}

// ---------- Seção ----------
export default function Criativos({ analise }: { analise: AnaliseTrafego }) {
  const c = analise.conta.moeda
  const [ordem, setOrdem] = useState<Ordem>('gasto')
  const [todos, setTodos] = useState(false)
  const total = analise.totais.gasto
  const lista = useMemo(() => {
    const tipo = tipoDominante(analise.anuncios)
    // "Menor custo": só o tipo de resultado principal (anúncio de site e de
    // WhatsApp não se comparam); os outros vão pro fim.
    const v = (a: LinhaTabelaTrafego) => (ordem === 'gasto' ? a.metricas.gasto : ordem === 'custo' ? (tipo && a.resultado === tipo ? custoNoTipo(a, tipo) : null) : ordem === 'ctr' ? a.derivadas.ctr : a.derivadas.hookRate)
    return [...analise.anuncios].sort((a, b) => {
      const va = v(a), vb = v(b)
      if (va == null) return 1
      if (vb == null) return -1
      return ordem === 'custo' ? va - vb : vb - va
    })
  }, [analise.anuncios, ordem])
  const visiveis = todos ? lista : lista.slice(0, 9)
  return (
    <div className="pl-tf-criativos">
      <div className="pl-card">
        <div className="pl-tf-tabela-topo">
          <div>
            <div className="pl-card-title">Anúncios ({analise.anuncios.length})</div>
            <div className="pl-card-sub">{analise.temEstrutura ? 'Miniatura, status e ranking da Meta (últimos 7 dias) atualizados a cada sincronização.' : 'Clique em "Atualizar agora" pra trazer miniaturas, status e rankings.'}</div>
          </div>
          <Abas rotulo="Ordenar por" valor={ordem} onChange={setOrdem} opcoes={[{ valor: 'gasto', rotulo: 'Investimento' }, { valor: 'custo', rotulo: 'Menor custo' }, { valor: 'ctr', rotulo: 'CTR' }, { valor: 'hook', rotulo: 'Hook' }]} />
        </div>
        {lista.length === 0 ? <Vazio>Nenhum anúncio com entrega no período.</Vazio> : (
          <>
            <ul className="pl-tf-cr-grade">{visiveis.map(a => <CartaoCriativo key={a.id} a={a} moedaConta={c} total={total} />)}</ul>
            {lista.length > 9 && <button type="button" className="pl-link-action" style={{ marginTop: 10 }} onClick={() => setTodos(v => !v)}>{todos ? 'Mostrar menos' : `Ver todos os ${lista.length} anúncios`}</button>}
          </>
        )}
      </div>
      <div className="pl-tf-criativos-graficos">
        <MatrizCriativos anuncios={analise.anuncios} moedaConta={c} />
        <RetencaoVideo analise={analise} />
      </div>
    </div>
  )
}
