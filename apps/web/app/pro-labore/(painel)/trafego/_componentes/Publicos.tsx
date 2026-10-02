'use client'

// Públicos: quem viu, clicou e virou contato — por idade × gênero, região,
// posicionamento, dispositivo e horário. A pergunta de cada gráfico é a
// mesma: esse pedaço do público leva mais investimento do que devolve em
// resultado? (barra de "% do investimento" contra "% dos resultados").
import { useEffect, useState } from 'react'
import { proLaboreApi, type PublicosTrafego, type SegmentoPublicoTrafego } from '@/lib/proLaboreApi'
import { Abas, CartaoViz, Vazio } from '../../social-media/_componentes/viz'
import { moeda, num, pct } from './formato'
import { DivergentePosicionamentos, EmpilhadoDispositivos, InclinacaoPlataformas, MapaRegioes, RelogioHoras } from './GraficosPublico'

type Metrica = 'gasto' | 'resultados' | 'custo' | 'ctr' | 'connect'
const NIVEL = { critico: { rotulo: 'Crítico', icone: '!' }, atencao: { rotulo: 'Atenção', icone: '▲' }, info: { rotulo: 'Informação', icone: 'i' }, positivo: { rotulo: 'Bom sinal', icone: '✓' } } as const

function valorDe(s: SegmentoPublicoTrafego, m: Metrica): number | null {
  if (m === 'gasto') return s.gasto
  if (m === 'resultados') return s.resultados
  if (m === 'custo') return s.custoResultado
  if (m === 'ctr') return s.ctr
  return s.connectRate
}
function fmtMetrica(v: number | null, m: Metrica, c: string) {
  if (m === 'gasto' || m === 'custo') return moeda(v, c)
  if (m === 'resultados') return num(v)
  return pct(v, m === 'ctr' ? 2 : 1)
}

// Selo do custo por resultado contra a média: "36% mais barato" / "2,1x a média".
export function SeloCusto({ indice }: { indice: number | null }) {
  if (indice == null) return <span className="pl-tf-selo neutro">—</span>
  if (Math.abs(indice - 1) < 0.1) return <span className="pl-tf-selo neutro">na média</span>
  if (indice < 1) return <span className="pl-tf-selo barato">▼ {Math.round((1 - indice) * 100)}% mais barato</span>
  return <span className="pl-tf-selo caro">▲ {indice >= 2 ? `${indice.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x a média` : `${Math.round((indice - 1) * 100)}% mais caro`}</span>
}

// ---------- Barras de participação (investimento × resultados) ----------
export interface LinhaParticipacao {
  chave: string; rotulo: string; sub?: string | null
  gasto: number; resultados: number; partGasto: number; partResultados: number
  custoResultado: number | null; indiceCusto: number | null; ctr: number | null; connectRate: number | null
}
export function BarrasParticipacao({ titulo, subtitulo, linhas, moedaConta, nomeResultado, limite = 12, onClicar }: {
  titulo: string; subtitulo?: string; linhas: LinhaParticipacao[]; moedaConta: string; nomeResultado: string; limite?: number
  onClicar?: (l: LinhaParticipacao) => void
}) {
  const [todos, setTodos] = useState(false)
  const visiveis = todos ? linhas : linhas.slice(0, limite)
  const max = Math.max(0.0001, ...linhas.map(l => Math.max(l.partGasto, l.partResultados)))
  return (
    <CartaoViz
      titulo={titulo}
      subtitulo={subtitulo}
      tabela={{
        colunas: ['Segmento', 'Investimento', '% invest.', `Resultados (${nomeResultado})`, '% result.', 'Custo/result.', 'CTR', 'Connect rate'],
        linhas: linhas.map(l => [l.sub ? `${l.rotulo} (${l.sub})` : l.rotulo, moeda(l.gasto, moedaConta), pct(l.partGasto), num(l.resultados), pct(l.partResultados), moeda(l.custoResultado, moedaConta), pct(l.ctr, 2), pct(l.connectRate)]),
      }}
      rodape={linhas.length > limite ? <button type="button" className="pl-link-action" onClick={() => setTodos(v => !v)}>{todos ? 'Mostrar menos' : `Ver todos (${linhas.length})`}</button> : undefined}
    >
      {linhas.length === 0 ? <Vazio>Sem entrega nesse período.</Vazio> : (
        <>
          <div className="pl-tf-part-legenda" aria-hidden="true">
            <span><i className="g" /> % do investimento</span>
            <span><i className="r" /> % dos {nomeResultado}</span>
          </div>
          <ul className="pl-tf-part">
            {visiveis.map(l => (
              <li key={l.chave}>
                <button type="button" className="pl-tf-part-linha" onClick={onClicar ? () => onClicar(l) : undefined} disabled={!onClicar}>
                  <span className="pl-tf-part-nome"><b>{l.rotulo}</b>{l.sub && <small>{l.sub}</small>}</span>
                  <span className="pl-tf-part-barras" role="img" aria-label={`${pct(l.partGasto)} do investimento e ${pct(l.partResultados)} dos ${nomeResultado}`}>
                    <span className="g" style={{ width: `${(l.partGasto / max) * 100}%` }}><em>{pct(l.partGasto, 0)}</em></span>
                    <span className="r" style={{ width: `${(l.partResultados / max) * 100}%` }}><em>{pct(l.partResultados, 0)}</em></span>
                  </span>
                  <span className="pl-tf-part-num">
                    <b>{moeda(l.custoResultado, moedaConta)}</b>
                    <SeloCusto indice={l.indiceCusto} />
                  </span>
                  <span className="pl-tf-part-extra"><small>CTR</small> {pct(l.ctr, 2)}<br /><small>Connect</small> {pct(l.connectRate)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </CartaoViz>
  )
}

// ---------- Idade × gênero ----------
const SEQ = ['var(--sv-seq-1)', 'var(--sv-seq-2)', 'var(--sv-seq-3)', 'var(--sv-seq-4)', 'var(--sv-seq-5)']
const TINTA_SEQ = ['var(--sv-seq-ink-1)', 'var(--sv-seq-ink-2)', 'var(--sv-seq-ink-3)', 'var(--sv-seq-ink-4)', 'var(--sv-seq-ink-5)']

function IdadeGenero({ segs, moedaConta, nomeResultado }: { segs: SegmentoPublicoTrafego[]; moedaConta: string; nomeResultado: string }) {
  const [metrica, setMetrica] = useState<Metrica>('custo')
  const idades = [...new Set(segs.map(s => s.grupo ?? '?'))].sort((a, b) => (a === 'Não informada' ? 1 : b === 'Não informada' ? -1 : a.localeCompare(b)))
  const generos = ['Mulheres', 'Homens', 'Não informado'].filter(g => segs.some(s => s.extra === g && s.impressoes > 0))
  const celula = (idade: string, genero: string) => segs.find(s => s.grupo === idade && s.extra === genero)
  const valores = segs.map(s => valorDe(s, metrica)).filter((v): v is number => v != null && v > 0)
  const max = Math.max(0, ...valores)
  const cor = (s: SegmentoPublicoTrafego | undefined) => {
    if (!s || s.impressoes === 0) return { bg: 'transparent', ink: 'var(--pl-ink-muted)' }
    if (metrica === 'custo') {
      // Divergente em torno da média: azul = mais barato, laranja = mais caro.
      const i = s.indiceCusto
      if (i == null) return { bg: 'var(--pl-surface-2)', ink: 'var(--pl-ink-muted)' }
      // Até ±10% da média conta como "na média" (neutro).
      if (Math.abs(Math.log2(i)) < 0.14) return { bg: 'var(--pl-surface-2)', ink: 'var(--pl-ink-1)' }
      const forca = Math.min(1, Math.abs(Math.log2(i)) / 1.2)
      const base = i < 1 ? 'var(--sv-1)' : 'var(--sv-2)'
      return { bg: `color-mix(in srgb, ${base} ${Math.round(12 + forca * 70)}%, var(--pl-surface-2))`, ink: forca > 0.55 ? '#fff' : 'var(--pl-ink-1)' }
    }
    const v = valorDe(s, metrica)
    if (v == null || v <= 0 || max <= 0) return { bg: 'var(--pl-surface-2)', ink: 'var(--pl-ink-muted)' }
    const d = Math.min(4, Math.floor((v / max) * 5))
    return { bg: SEQ[d], ink: TINTA_SEQ[d] }
  }
  return (
    <CartaoViz
      titulo="Idade × gênero"
      subtitulo={metrica === 'custo' ? 'Custo por resultado comparado à média do período: azul é mais barato, laranja é mais caro' : 'Quanto mais escuro, maior o valor'}
      acoes={<Abas rotulo="Métrica" valor={metrica} onChange={setMetrica} opcoes={[{ valor: 'custo', rotulo: 'Custo/result.' }, { valor: 'gasto', rotulo: 'Investimento' }, { valor: 'resultados', rotulo: 'Resultados' }, { valor: 'ctr', rotulo: 'CTR' }, { valor: 'connect', rotulo: 'Connect' }]} />}
      tabela={{
        colunas: ['Idade', 'Gênero', 'Investimento', `Resultados (${nomeResultado})`, 'Custo/result.', 'vs média', 'CTR', 'Connect rate'],
        linhas: segs.filter(s => s.impressoes > 0).map(s => [s.grupo ?? '', s.extra ?? '', moeda(s.gasto, moedaConta), num(s.resultados), moeda(s.custoResultado, moedaConta), s.indiceCusto != null ? `${s.indiceCusto.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}x` : '—', pct(s.ctr, 2), pct(s.connectRate)]),
      }}
    >
      {segs.length === 0 ? <Vazio>Sem dado de idade e gênero nesse período.</Vazio> : (
        <div className="pl-tf-heat-scroll">
          <table className="pl-tf-heat">
            <thead><tr><th scope="col">Idade</th>{generos.map(g => <th key={g} scope="col">{g}</th>)}</tr></thead>
            <tbody>
              {idades.map(idade => (
                <tr key={idade}>
                  <th scope="row">{idade}</th>
                  {generos.map(g => {
                    const s = celula(idade, g)
                    const { bg, ink } = cor(s)
                    const v = s ? valorDe(s, metrica) : null
                    return (
                      <td key={g} style={{ background: bg, color: ink }}
                        title={s ? `${g} ${idade}: ${moeda(s.gasto, moedaConta)} investidos · ${num(s.resultados)} ${nomeResultado} · ${moeda(s.custoResultado, moedaConta)} cada · CTR ${pct(s.ctr, 2)}` : 'Sem entrega'}>
                        <b>{s && s.impressoes > 0 ? fmtMetrica(v, metrica, moedaConta) : '—'}</b>
                        {s && s.impressoes > 0 && metrica !== 'gasto' && <small>{pct(s.partGasto, 0)} do invest.</small>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {metrica === 'custo' && (
            <div className="pl-tf-heat-legenda" aria-hidden="true">
              <span>mais barato</span><i className="b2" /><i className="b1" /><i className="n" /><i className="c1" /><i className="c2" /><span>mais caro</span>
            </div>
          )}
        </div>
      )}
    </CartaoViz>
  )
}

// Posicionamentos somados por plataforma (Facebook, Instagram…).
function agruparPlataformas(segs: SegmentoPublicoTrafego[]): LinhaParticipacao[] {
  const m = new Map<string, { gasto: number; resultados: number; partGasto: number; partResultados: number; imp: number; cl: number; dest: number }>()
  for (const s of segs) {
    const k = s.grupo ?? s.rotulo
    const a = m.get(k) ?? { gasto: 0, resultados: 0, partGasto: 0, partResultados: 0, imp: 0, cl: 0, dest: 0 }
    a.gasto += s.gasto; a.resultados += s.resultados; a.partGasto += s.partGasto; a.partResultados += s.partResultados
    a.imp += s.impressoes; a.cl += s.cliquesLink; a.dest += s.destino
    m.set(k, a)
  }
  const totG = segs.reduce((x, s) => x + s.gasto, 0), totR = segs.reduce((x, s) => x + s.resultados, 0)
  const medio = totR > 0 ? totG / totR : null
  return [...m.entries()].map(([k, a]) => {
    const custo = a.resultados > 0 ? a.gasto / a.resultados : null
    return {
      chave: k, rotulo: k, gasto: a.gasto, resultados: a.resultados, partGasto: a.partGasto, partResultados: a.partResultados,
      custoResultado: custo, indiceCusto: custo != null && medio ? custo / medio : null,
      ctr: a.imp ? a.cl / a.imp : null, connectRate: a.cl ? a.dest / a.cl : null,
    }
  }).sort((a, b) => b.gasto - a.gasto)
}

// ---------- Seção ----------
const NOME_QUEBRA: Record<string, string> = {
  idadeGenero: 'idade e gênero', regiao: 'região', posicionamento: 'posicionamento', dispositivo: 'dispositivo', hora: 'horário',
}

export default function Publicos({ periodo, filtro, moedaConta, versao, erroConta }: {
  periodo: { inicio: string; fim: string }; filtro: { campanhaId?: string; adsetId?: string }; moedaConta: string; versao: number
  // Erro de sincronização já mostrado no topo da página: se os públicos
  // falharem pelo mesmo motivo, não repete o texto inteiro aqui.
  erroConta?: string | null
}) {
  const [dados, setDados] = useState<PublicosTrafego | null>(null)
  const [erro, setErro] = useState('')
  const [forcar, setForcar] = useState(0)
  const chavePedida = JSON.stringify([periodo.inicio, periodo.fim, filtro, versao, forcar])
  const [chaveCarregada, setChaveCarregada] = useState('')
  const carregando = chavePedida !== chaveCarregada
  useEffect(() => {
    let cancelado = false
    proLaboreApi.trafego.publicos({ inicio: periodo.inicio, fim: periodo.fim, ...filtro, forcar: forcar > 0 })
      .then(d => { if (!cancelado) { setDados(d); setErro('') } })
      .catch(e => { if (!cancelado) setErro((e as Error).message) })
      .finally(() => { if (!cancelado) setChaveCarregada(chavePedida) })
    return () => { cancelado = true }
  }, [periodo.inicio, periodo.fim, filtro, versao, forcar, chavePedida])

  if (!dados) return <div className="pl-card"><p className="pl-hint">{erro || (carregando ? 'Buscando os públicos na Meta…' : '')}</p></div>
  const q = dados.quebras
  const nomeRes = dados.nomeResultado
  const comoLinha = (s: SegmentoPublicoTrafego): LinhaParticipacao => ({ ...s, sub: null })
  const porPlataforma = agruparPlataformas(q.posicionamento.segmentos)
  // Agrupa as quebras que falharam pelo mesmo motivo (normalmente é um só).
  const porErro = new Map<string, string[]>()
  for (const [k, v] of Object.entries(q)) if (v.erro) porErro.set(v.erro, [...(porErro.get(v.erro) ?? []), NOME_QUEBRA[k] ?? k])
  const erros = [...porErro].map(([msg, nomes]) => ({ msg, nomes: nomes.join(', '), repetido: msg === erroConta }))

  return (
    <div className={`pl-tf-publicos ${carregando ? 'pl-tf-recarregando' : ''}`}>
      <div className="pl-card pl-tf-publicos-achados">
        <div className="pl-card-head">
          <div>
            <div className="pl-card-title">O que os públicos dizem</div>
            <div className="pl-card-sub">Comparando custo por resultado ({nomeRes}) entre os pedaços do público que receberam pelo menos 5% do investimento</div>
          </div>
          <button type="button" className="pl-btn pl-btn-ghost pl-tf-btn-peq" disabled={carregando} onClick={() => setForcar(f => f + 1)}>{carregando ? 'Buscando…' : 'Buscar de novo na Meta'}</button>
        </div>
        {erros.map(e => e.repetido
          ? <p key={e.msg} className="pl-hint" style={{ marginTop: 10 }}>Não deu pra buscar {e.nomes} na Meta pelo mesmo motivo do aviso no topo da página.</p>
          : <div key={e.msg} className="pl-alert pl-alert-error" style={{ marginTop: 10 }}>Não deu pra buscar {e.nomes}: {e.msg}</div>)}
        {dados.achados.length === 0 ? <p className="pl-hint" style={{ marginTop: 10 }}>Nenhuma diferença forte entre os públicos nesse período.</p> : (
          <ul className="pl-tf-diag-lista">
            {dados.achados.map((d, i) => (
              <li key={i} className={d.nivel}>
                <span className="pl-tf-diag-icone" aria-hidden="true">{NIVEL[d.nivel].icone}</span>
                <div><b><span className="pl-tf-diag-nivel">{NIVEL[d.nivel].rotulo}</span>{d.titulo}</b><p>{d.texto}</p></div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="pl-tf-publicos-grid">
        <IdadeGenero segs={q.idadeGenero.segmentos} moedaConta={moedaConta} nomeResultado={nomeRes} />
        <InclinacaoPlataformas linhas={porPlataforma} moedaConta={moedaConta} nomeResultado={nomeRes} />
        <DivergentePosicionamentos linhas={q.posicionamento.segmentos.map(comoLinha)} moedaConta={moedaConta} nomeResultado={nomeRes} />
        <MapaRegioes segs={q.regiao.segmentos} moedaConta={moedaConta} nomeResultado={nomeRes} />
        <EmpilhadoDispositivos linhas={q.dispositivo.segmentos.map(comoLinha)} moedaConta={moedaConta} nomeResultado={nomeRes} />
        <RelogioHoras segs={q.hora.segmentos} moedaConta={moedaConta} nomeResultado={nomeRes} />
      </div>
    </div>
  )
}
