'use client'

// Gráficos dos públicos — cada quebra com a forma que combina com o dado:
// inclinação (plataformas: % do investimento → % dos resultados), barras
// divergentes (posicionamentos: mais barato/mais caro que a média), mapa do
// Brasil (regiões), barras 100% empilhadas (dispositivos) e relógio de 24h
// (horário). Toda forma tem a tabela equivalente no botão "Tabela".
import { useState } from 'react'
import type { SegmentoPublicoTrafego } from '@/lib/proLaboreApi'
import { Abas, CartaoViz, Vazio, useLargura } from '../../social-media/_componentes/viz'
import { compacto, moeda, num, pct } from './formato'
import { SeloCusto, type LinhaParticipacao } from './Publicos'

// Cores categóricas em ordem fixa por entidade (nunca pela posição no ranking).
const CAT = ['var(--sv-1)', 'var(--sv-2)', 'var(--sv-3)', 'var(--sv-4)', 'var(--sv-5)']
const OUTROS = 'var(--pl-ink-muted)'
function corPorOrdem(ordem: string[]) {
  return (nome: string) => {
    const i = ordem.indexOf(nome)
    return i >= 0 && i < CAT.length ? CAT[i] : OUTROS
  }
}

function tabelaParticipacao(linhas: LinhaParticipacao[], moedaConta: string, nomeResultado: string) {
  return {
    colunas: ['Segmento', 'Investimento', '% invest.', `Resultados (${nomeResultado})`, '% result.', 'Custo/result.', 'CTR', 'Connect rate'],
    linhas: linhas.map(l => [l.rotulo, moeda(l.gasto, moedaConta), pct(l.partGasto), num(l.resultados), pct(l.partResultados), moeda(l.custoResultado, moedaConta), pct(l.ctr, 2), pct(l.connectRate)]),
  }
}

// Rótulos de um eixo sem se sobrepor: mantém a ordem e empurra pra baixo.
function espalhar(ys: number[], minimo: number, topo: number, base: number): number[] {
  const ordem = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  for (let k = 1; k < ordem.length; k++) if (ordem[k].y - ordem[k - 1].y < minimo) ordem[k].y = ordem[k - 1].y + minimo
  const excesso = ordem.length ? ordem[ordem.length - 1].y - base : 0
  if (excesso > 0) for (const o of ordem) o.y = Math.max(topo, o.y - excesso)
  const out = new Array<number>(ys.length)
  for (const o of ordem) out[o.i] = o.y
  return out
}

// ---------- Inclinação: plataformas ----------
const ORDEM_PLATAFORMAS = ['Instagram', 'Facebook', 'Audience Network', 'Messenger', 'WhatsApp', 'Threads']

export function InclinacaoPlataformas({ linhas, moedaConta, nomeResultado }: { linhas: LinhaParticipacao[]; moedaConta: string; nomeResultado: string }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const cor = corPorOrdem(ORDEM_PLATAFORMAS)
  const visiveis = linhas.filter(l => l.gasto > 0)
  const ALT = 230, topo = 26, base = ALT - 14
  const max = Math.max(0.01, ...visiveis.flatMap(l => [l.partGasto, l.partResultados]))
  const y = (v: number) => base - (v / max) * (base - topo)
  const xE = Math.min(150, largura * 0.32), xD = largura - Math.min(150, largura * 0.32)
  const yE = espalhar(visiveis.map(l => y(l.partGasto)), 15, topo, base)
  const yD = espalhar(visiveis.map(l => y(l.partResultados)), 15, topo, base)
  return (
    <CartaoViz
      titulo="Plataformas"
      subtitulo={`De onde sai a verba e de onde vêm os ${nomeResultado}. Linha subindo = a plataforma devolve mais do que leva.`}
      tabela={tabelaParticipacao(linhas, moedaConta, nomeResultado)}
    >
      {visiveis.length === 0 ? <Vazio>Sem entrega nesse período.</Vazio> : (
        <div ref={ref}>
          {largura > 0 && (
            <svg className="pl-sv-svg" width={largura} height={ALT} role="img" aria-label={`Participação de cada plataforma no investimento e nos ${nomeResultado}`}>
              <text className="eixo" x={xE} y={12} textAnchor="middle">% do investimento</text>
              <text className="eixo" x={xD} y={12} textAnchor="middle">% dos {nomeResultado}</text>
              <line className="grade" x1={xE} x2={xE} y1={topo - 6} y2={base} />
              <line className="grade" x1={xD} x2={xD} y1={topo - 6} y2={base} />
              {visiveis.map((l, i) => {
                const sobe = l.partResultados >= l.partGasto
                return (
                  <g key={l.chave}>
                    <line x1={xE} y1={y(l.partGasto)} x2={xD} y2={y(l.partResultados)} stroke={cor(l.rotulo)} strokeWidth={2.5} strokeDasharray={sobe ? undefined : '6 4'} />
                    <circle cx={xE} cy={y(l.partGasto)} r={5} fill={cor(l.rotulo)} stroke="var(--pl-surface)" strokeWidth={2} />
                    <circle cx={xD} cy={y(l.partResultados)} r={5} fill={cor(l.rotulo)} stroke="var(--pl-surface)" strokeWidth={2} />
                    <text className="pl-tf-rotulo-lado" x={xE - 10} y={yE[i] + 4} textAnchor="end">{l.rotulo} <tspan className="v">{pct(l.partGasto, 0)}</tspan></text>
                    <text className="pl-tf-rotulo-lado" x={xD + 10} y={yD[i] + 4}><tspan className="v">{pct(l.partResultados, 0)}</tspan> {moeda(l.custoResultado, moedaConta)}</text>
                  </g>
                )
              })}
            </svg>
          )}
          <div className="pl-sv-legenda">
            {visiveis.map(l => <span key={l.chave}><i style={{ background: cor(l.rotulo) }} /> {l.rotulo}</span>)}
            <span className="pl-tf-legenda-nota">linha tracejada = devolve menos do que leva</span>
          </div>
        </div>
      )}
    </CartaoViz>
  )
}

// ---------- Barras divergentes: posicionamentos ----------
export function DivergentePosicionamentos({ linhas, moedaConta, nomeResultado }: { linhas: LinhaParticipacao[]; moedaConta: string; nomeResultado: string }) {
  const [todos, setTodos] = useState(false)
  const comGasto = linhas.filter(l => l.gasto > 0)
  const ordenadas = [...comGasto].sort((a, b) => (a.indiceCusto ?? 99) - (b.indiceCusto ?? 99))
  const visiveis = todos ? ordenadas : ordenadas.slice(0, 10)
  // Escala fixa: o fim do trilho é 2,8x (ou 1/2,8) a média — diferenças de
  // 20% continuam visíveis mesmo com um posicionamento muito fora da curva.
  const maxLog = 1.5
  const media = comGasto.reduce((s, l) => s + l.gasto, 0) / Math.max(1, comGasto.reduce((s, l) => s + l.resultados, 0))
  return (
    <CartaoViz
      titulo="Posicionamentos"
      subtitulo={`Custo por resultado de cada posicionamento contra a média (${moeda(media, moedaConta)}). Para a esquerda, mais barato; para a direita, mais caro.`}
      tabela={tabelaParticipacao(ordenadas, moedaConta, nomeResultado)}
      rodape={ordenadas.length > 10 ? <button type="button" className="pl-link-action" onClick={() => setTodos(v => !v)}>{todos ? 'Mostrar menos' : `Ver todos (${ordenadas.length})`}</button> : undefined}
    >
      {comGasto.length === 0 ? <Vazio>Sem entrega nesse período.</Vazio> : (
        <div className="pl-tf-div">
          <div className="pl-tf-div-eixo" aria-hidden="true"><span>mais barato</span><span>média</span><span>mais caro</span></div>
          <ul>
            {visiveis.map(l => {
              const i = l.indiceCusto
              const larg = i ? (Math.min(maxLog, Math.abs(Math.log2(i))) / maxLog) * 50 : 0
              const barato = i != null && i < 1
              return (
                <li key={l.chave}>
                  <span className="pl-tf-div-nome"><b>{l.rotulo}</b><small>{pct(l.partGasto, 0)} do invest. · {moeda(l.custoResultado, moedaConta)}</small></span>
                  <span className="pl-tf-div-trilho" role="img" aria-label={i ? `${(i).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} vezes a média` : 'sem resultado'}>
                    <i className="centro" />
                    {i ? <span className={barato ? 'barato' : 'caro'} style={barato ? { right: '50%', width: `${larg}%` } : { left: '50%', width: `${larg}%` }} /> : <em>sem resultado</em>}
                  </span>
                  <span className="pl-tf-div-selo"><SeloCusto indice={i} /></span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </CartaoViz>
  )
}

// ---------- Mapa do Brasil: regiões ----------
const UF_POR_NOME: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'federal district': 'DF', 'distrito federal': 'DF',
  'espirito santo': 'ES', goias: 'GO', maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA',
  paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
  rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
}
// Cartograma em grade (coluna, linha) — cada estado do mesmo tamanho, na
// posição aproximada do mapa.
const GRADE: Record<string, [number, number]> = {
  RR: [2, 0], AP: [4, 0],
  AM: [1, 1], PA: [3, 1], MA: [4, 1], CE: [5, 1], RN: [6, 1],
  AC: [0, 2], RO: [1, 2], MT: [2, 2], TO: [3, 2], PI: [4, 2], PE: [5, 2], PB: [6, 2],
  MS: [2, 3], GO: [3, 3], DF: [4, 3], BA: [5, 3], AL: [6, 3],
  PR: [2, 4], SP: [3, 4], MG: [4, 4], ES: [5, 4], SE: [6, 4],
  SC: [2, 5], RJ: [4, 5],
  RS: [2, 6],
}
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s*\((state|province|region)\)$/, '').replace(/^state of /, '').trim()
const SEQ = ['var(--sv-seq-1)', 'var(--sv-seq-2)', 'var(--sv-seq-3)', 'var(--sv-seq-4)', 'var(--sv-seq-5)']
const TINTA = ['var(--sv-seq-ink-1)', 'var(--sv-seq-ink-2)', 'var(--sv-seq-ink-3)', 'var(--sv-seq-ink-4)', 'var(--sv-seq-ink-5)']

// Cor divergente pelo índice de custo (azul = mais barato, laranja = mais caro).
export function corIndice(i: number | null): { bg: string; ink: string } {
  if (i == null) return { bg: 'var(--pl-surface-2)', ink: 'var(--pl-ink-muted)' }
  const l = Math.log2(i)
  if (Math.abs(l) < 0.14) return { bg: 'var(--pl-surface-2)', ink: 'var(--pl-ink-1)' }
  const forca = Math.min(1, Math.abs(l) / 1.2)
  return { bg: `color-mix(in srgb, ${i < 1 ? 'var(--sv-1)' : 'var(--sv-2)'} ${Math.round(18 + forca * 66)}%, var(--pl-surface-2))`, ink: forca > 0.55 ? '#fff' : 'var(--pl-ink-1)' }
}

type MetricaMapa = 'gasto' | 'custo' | 'resultados'
export function MapaRegioes({ segs, moedaConta, nomeResultado }: { segs: SegmentoPublicoTrafego[]; moedaConta: string; nomeResultado: string }) {
  const [metrica, setMetrica] = useState<MetricaMapa>('gasto')
  const [ativo, setAtivo] = useState<string | null>(null)
  const porUf = new Map<string, SegmentoPublicoTrafego>()
  const fora: SegmentoPublicoTrafego[] = []
  for (const s of segs) {
    const uf = UF_POR_NOME[normalizar(s.rotulo)]
    if (uf) porUf.set(uf, s); else if (s.gasto > 0) fora.push(s)
  }
  const valor = (s: SegmentoPublicoTrafego) => (metrica === 'gasto' ? s.gasto : metrica === 'resultados' ? s.resultados : s.custoResultado)
  const max = Math.max(0, ...[...porUf.values()].map(s => (metrica === 'custo' ? 0 : (valor(s) ?? 0))))
  const estilo = (s: SegmentoPublicoTrafego | undefined) => {
    if (!s || s.impressoes === 0) return { bg: 'transparent', ink: 'var(--pl-ink-muted)', borda: true }
    if (metrica === 'custo') return { ...corIndice(s.indiceCusto), borda: false }
    const v = valor(s) ?? 0
    if (v <= 0 || max <= 0) return { bg: 'var(--pl-surface-2)', ink: 'var(--pl-ink-muted)', borda: false }
    const d = Math.min(4, Math.floor((v / max) * 5))
    return { bg: SEQ[d], ink: TINTA[d], borda: false }
  }
  const fmt = (s: SegmentoPublicoTrafego) => (metrica === 'gasto' ? (s.gasto >= 1000 ? compacto(s.gasto) : Math.round(s.gasto).toLocaleString('pt-BR')) : metrica === 'resultados' ? compacto(s.resultados) : s.custoResultado != null ? s.custoResultado.toLocaleString('pt-BR', { maximumFractionDigits: s.custoResultado < 10 ? 2 : 0 }) : '—')
  const sel = ativo ? porUf.get(ativo) : null
  const lider = [...porUf.entries()].sort((a, b) => b[1].gasto - a[1].gasto)[0]
  const mostrar = sel ? [ativo!, sel] as const : lider ? lider : null
  return (
    <CartaoViz
      titulo="Regiões"
      subtitulo={metrica === 'custo' ? 'Custo por resultado contra a média: azul mais barato, laranja mais caro' : metrica === 'gasto' ? `Investimento por estado (${moedaConta === 'BRL' ? 'R$' : moedaConta}) — quanto mais escuro, mais verba` : `${nomeResultado} por estado`}
      acoes={<Abas rotulo="Métrica do mapa" valor={metrica} onChange={setMetrica} opcoes={[{ valor: 'gasto', rotulo: 'Investimento' }, { valor: 'custo', rotulo: 'Custo/result.' }, { valor: 'resultados', rotulo: 'Resultados' }]} />}
      tabela={{
        colunas: ['Estado', 'Investimento', '% invest.', `Resultados (${nomeResultado})`, 'Custo/result.', 'CTR'],
        linhas: segs.filter(s => s.gasto > 0).map(s => [s.rotulo, moeda(s.gasto, moedaConta), pct(s.partGasto), num(s.resultados), moeda(s.custoResultado, moedaConta), pct(s.ctr, 2)]),
      }}
    >
      {segs.length === 0 ? <Vazio>Sem dado por região nesse período.</Vazio> : (
        <div className="pl-tf-mapa-wrap">
          <div className="pl-tf-mapa" role="img" aria-label="Mapa do Brasil por estado">
            {Object.entries(GRADE).map(([uf, [c, r]]) => {
              const s = porUf.get(uf)
              const e = estilo(s)
              return (
                <button key={uf} type="button" className={`pl-tf-uf ${e.borda ? 'vazio' : ''} ${ativo === uf ? 'ativo' : ''}`}
                  style={{ gridColumn: c + 1, gridRow: r + 1, background: e.bg, color: e.ink }}
                  onMouseEnter={() => setAtivo(uf)} onMouseLeave={() => setAtivo(null)} onFocus={() => setAtivo(uf)} onBlur={() => setAtivo(null)}
                  aria-label={s ? `${s.rotulo}: ${moeda(s.gasto, moedaConta)}, ${num(s.resultados)} ${nomeResultado}, ${moeda(s.custoResultado, moedaConta)} cada` : `${uf}: sem entrega`}>
                  <b>{uf}</b>
                  {s && s.impressoes > 0 && <small>{fmt(s)}</small>}
                </button>
              )
            })}
          </div>
          <div className="pl-tf-mapa-info">
            {mostrar ? (
              <>
                <small>{sel ? 'Estado' : 'Maior investimento'}</small>
                <b>{mostrar[1].rotulo}</b>
                <dl>
                  <div><dt>Investimento</dt><dd>{moeda(mostrar[1].gasto, moedaConta)} <small>({pct(mostrar[1].partGasto, 0)})</small></dd></div>
                  <div><dt>{nomeResultado}</dt><dd>{num(mostrar[1].resultados)} <small>({pct(mostrar[1].partResultados, 0)})</small></dd></div>
                  <div><dt>Custo/result.</dt><dd>{moeda(mostrar[1].custoResultado, moedaConta)}</dd></div>
                  <div><dt>CTR</dt><dd>{pct(mostrar[1].ctr, 2)}</dd></div>
                </dl>
                <SeloCusto indice={mostrar[1].indiceCusto} />
              </>
            ) : <small>Passe o mouse num estado.</small>}
            {fora.length > 0 && <p className="pl-hint" style={{ marginTop: 10 }}>Fora do mapa: {fora.map(f => `${f.rotulo} (${pct(f.partGasto, 0)})`).join(', ')}</p>}
          </div>
        </div>
      )}
    </CartaoViz>
  )
}

// ---------- 100% empilhado: dispositivos ----------
const ORDEM_DISPOSITIVOS = ['Celular Android', 'iPhone', 'Computador', 'iPad', 'Tablet Android']

export function EmpilhadoDispositivos({ linhas, moedaConta, nomeResultado }: { linhas: LinhaParticipacao[]; moedaConta: string; nomeResultado: string }) {
  const cor = corPorOrdem(ORDEM_DISPOSITIVOS)
  const visiveis = linhas.filter(l => l.gasto > 0)
  const barra = (chave: 'partGasto' | 'partResultados', rotulo: string) => (
    <div className="pl-tf-emp-linha">
      <span className="pl-tf-emp-rot">{rotulo}</span>
      <div className="pl-tf-emp-barra" role="img" aria-label={`${rotulo}: ${visiveis.map(l => `${l.rotulo} ${pct(l[chave], 0)}`).join(', ')}`}>
        {visiveis.map(l => l[chave] > 0 && (
          <span key={l.chave} style={{ width: `${l[chave] * 100}%`, background: cor(l.rotulo) }} title={`${l.rotulo}: ${pct(l[chave])}`}>
            {l[chave] >= 0.09 && <em>{pct(l[chave], 0)}</em>}
          </span>
        ))}
      </div>
    </div>
  )
  return (
    <CartaoViz
      titulo="Dispositivos"
      subtitulo={`Como o investimento e os ${nomeResultado} se dividem entre aparelhos`}
      tabela={tabelaParticipacao(linhas, moedaConta, nomeResultado)}
    >
      {visiveis.length === 0 ? <Vazio>Sem entrega nesse período.</Vazio> : (
        <div className="pl-tf-emp">
          {barra('partGasto', 'Investimento')}
          {barra('partResultados', nomeResultado.charAt(0).toUpperCase() + nomeResultado.slice(1))}
          <ul className="pl-tf-emp-legenda">
            {visiveis.map(l => (
              <li key={l.chave}>
                <i style={{ background: cor(l.rotulo) }} aria-hidden="true" />
                <b>{l.rotulo}</b>
                <span>{moeda(l.custoResultado, moedaConta)}</span>
                <SeloCusto indice={l.indiceCusto} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </CartaoViz>
  )
}

// ---------- Relógio de 24h: horário ----------
type MetricaHora = 'resultados' | 'gasto' | 'custo' | 'ctr'
export function RelogioHoras({ segs, moedaConta, nomeResultado }: { segs: SegmentoPublicoTrafego[]; moedaConta: string; nomeResultado: string }) {
  const [metrica, setMetrica] = useState<MetricaHora>('resultados')
  const [ativo, setAtivo] = useState<number | null>(null)
  const valor = (s: SegmentoPublicoTrafego) => (metrica === 'resultados' ? s.resultados : metrica === 'gasto' ? s.gasto : metrica === 'custo' ? s.custoResultado : s.ctr)
  const valores = segs.map(valor)
  const max = Math.max(0, ...valores.map(v => v ?? 0))
  const temDado = segs.some(s => s.impressoes > 0)
  // Melhor janela de 3h (mais resultado por real) — destacada no relógio.
  let melhor = -1, razao = 0
  for (let h = 0; h < 24; h++) {
    const j = [0, 1, 2].map(i => segs[(h + i) % 24])
    const g = j.reduce((s, x) => s + x.gasto, 0), r = j.reduce((s, x) => s + x.resultados, 0)
    if (g > 0 && r / g > razao) { razao = r / g; melhor = h }
  }
  const naJanela = (h: number) => melhor >= 0 && ((h - melhor + 24) % 24) < 3
  const T = 300, cx = T / 2, cy = T / 2, r0 = 46, r1 = T / 2 - 26
  const ang = (h: number) => (h / 24) * 2 * Math.PI - Math.PI / 2
  const ponto = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
  const fatia = (h: number, r: number) => {
    const a0 = ang(h) + 0.02, a1 = ang(h + 1) - 0.02
    return `M${ponto(r0, a0)} L${ponto(r, a0)} A${r} ${r} 0 0 1 ${ponto(r, a1)} L${ponto(r0, a1)} A${r0} ${r0} 0 0 0 ${ponto(r0, a0)} Z`
  }
  const fmt = (v: number | null) => (metrica === 'resultados' ? num(v) : metrica === 'ctr' ? pct(v, 2) : moeda(v, moedaConta))
  const s = ativo != null ? segs[ativo] : null
  const hh = (h: number) => `${String(h % 24).padStart(2, '0')}h`
  return (
    <CartaoViz
      titulo="Horário do dia"
      subtitulo={melhor >= 0 ? `Em laranja, a melhor janela: ${hh(melhor)}–${hh(melhor + 3)} (mais ${nomeResultado} por real). Fuso da conta de anúncios.` : 'Fuso da conta de anúncios.'}
      acoes={<Abas rotulo="Métrica do relógio" valor={metrica} onChange={setMetrica} opcoes={[{ valor: 'resultados', rotulo: 'Resultados' }, { valor: 'gasto', rotulo: 'Investimento' }, { valor: 'custo', rotulo: 'Custo/result.' }, { valor: 'ctr', rotulo: 'CTR' }]} />}
      tabela={{ colunas: ['Hora', 'Investimento', `Resultados (${nomeResultado})`, 'Custo/result.', 'CTR', 'Connect rate'], linhas: segs.map(x => [x.rotulo, moeda(x.gasto, moedaConta), num(x.resultados), moeda(x.custoResultado, moedaConta), pct(x.ctr, 2), pct(x.connectRate)]) }}
    >
      {!temDado ? <Vazio>Sem dado por horário nesse período.</Vazio> : (
        <div className="pl-tf-relogio">
          <svg viewBox={`0 0 ${T} ${T}`} className="pl-sv-svg" role="img" aria-label="Relógio de 24 horas" onPointerLeave={() => setAtivo(null)}>
            {[0.5, 1].map(f => <circle key={f} cx={cx} cy={cy} r={r0 + (r1 - r0) * f} fill="none" className="grade" />)}
            {segs.map((x, h) => {
              const v = valores[h]
              const r = v != null && v > 0 && max > 0 ? r0 + (v / max) * (r1 - r0) : r0 + 2
              return (
                <path key={h} d={fatia(h, r)} fill={naJanela(h) ? 'var(--sv-2)' : 'var(--sv-1)'}
                  opacity={ativo == null || ativo === h ? (v ? 1 : 0.25) : 0.4}
                  onPointerEnter={() => setAtivo(h)} />
              )
            })}
            {[0, 3, 6, 9, 12, 15, 18, 21].map(h => {
              const a = ang(h + 0.5)
              return <text key={h} className="eixo" x={cx + (r1 + 14) * Math.cos(a)} y={cy + (r1 + 14) * Math.sin(a) + 3.5} textAnchor="middle">{hh(h)}</text>
            })}
            <text x={cx} y={cy - 4} textAnchor="middle" className="pl-tf-relogio-hora">{s ? `${hh(ativo!)}–${hh(ativo! + 1)}` : 'Dia todo'}</text>
            <text x={cx} y={cy + 14} textAnchor="middle" className="pl-tf-relogio-valor">{s ? fmt(valor(s)) : fmt(metrica === 'resultados' ? segs.reduce((a, x) => a + x.resultados, 0) : metrica === 'gasto' ? segs.reduce((a, x) => a + x.gasto, 0) : null)}</text>
          </svg>
          <div className="pl-tf-relogio-info">
            {s ? (
              <dl>
                <div><dt>Investido</dt><dd>{moeda(s.gasto, moedaConta)}</dd></div>
                <div><dt>{nomeResultado}</dt><dd>{num(s.resultados)}</dd></div>
                <div><dt>Custo/result.</dt><dd>{moeda(s.custoResultado, moedaConta)}</dd></div>
                <div><dt>CTR</dt><dd>{pct(s.ctr, 2)}</dd></div>
              </dl>
            ) : <p className="pl-hint">Passe o mouse numa hora do relógio.</p>}
            <div className="pl-sv-legenda"><span><i style={{ background: 'var(--sv-1)' }} /> Hora</span>{melhor >= 0 && <span><i style={{ background: 'var(--sv-2)' }} /> Melhor janela de 3h</span>}</div>
          </div>
        </div>
      )}
    </CartaoViz>
  )
}
