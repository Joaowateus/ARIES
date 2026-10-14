'use client'

import { useEffect, useState } from 'react'
import { proLaboreApi, type CpEvolucao } from '@/lib/proLaboreApi'
import { CartaoViz, LinhaTip, Tooltip, Vazio, ticksBonitos, useLargura, type EstadoTooltip } from '../../social-media/_componentes/viz'
import { TIPO_ACAO, ddmm, num } from './rotulos'

const PERIODOS = [14, 30, 90] as const
const ALTURA = 150
const M = { esq: 34, dir: 10, topo: 10, base: 22 }

/** Uma série no tempo: linha de 2 px, cursor com dica e a tabela no cartão. */
function Linha({ titulo, subtitulo, pontos, fmt, maxFixo, inteiro }: { titulo: string; subtitulo: string; pontos: Array<{ dia: string; valor: number | null }>; fmt: (v: number) => string; maxFixo?: number; inteiro?: boolean }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [ativo, setAtivo] = useState<number | null>(null)
  const validos = pontos.filter(p => p.valor != null)
  const max = maxFixo ?? Math.max(1, ...validos.map(p => p.valor!))
  // Contagem: eixo em números inteiros (no mínimo 0 a 4), sem repetir rótulo.
  const ticks = maxFixo ? [0, maxFixo / 4, maxFixo / 2, (3 * maxFixo) / 4, maxFixo] : ticksBonitos(inteiro ? Math.max(4, max) : max)
  const topo = ticks[ticks.length - 1] || 1
  const w = Math.max(0, largura - M.esq - M.dir), h = ALTURA - M.topo - M.base
  const x = (i: number) => M.esq + (pontos.length <= 1 ? w / 2 : (i / (pontos.length - 1)) * w)
  const y = (v: number) => M.topo + h - (v / topo) * h
  let d = '', aberto = false
  pontos.forEach((p, i) => {
    if (p.valor == null) { aberto = false; return }
    d += `${aberto ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`
    aberto = true
  })
  const tip: EstadoTooltip | null = ativo != null && pontos[ativo] ? {
    x: x(ativo), y: pontos[ativo].valor != null ? y(pontos[ativo].valor!) : M.topo,
    conteudo: <><div className="pl-sv-tip-titulo">{ddmm(pontos[ativo].dia)}</div><LinhaTip cor="var(--sv-1)" valor={pontos[ativo].valor != null ? fmt(pontos[ativo].valor!) : '—'} rotulo={titulo} /></>,
  } : null
  const rotulos = pontos.length > 1 ? [0, Math.floor((pontos.length - 1) / 2), pontos.length - 1] : [0]
  return (
    <CartaoViz titulo={titulo} subtitulo={subtitulo} tabela={{ colunas: ['Dia', titulo], linhas: pontos.map(p => [ddmm(p.dia), p.valor != null ? fmt(p.valor) : '—']), alinharDireita: [1] }}>
      {validos.length === 0 ? <Vazio>Ainda sem dias com este dado.</Vazio> : (
        <div ref={ref} style={{ position: 'relative' }}>
          {largura > 0 && (
            <svg className="pl-sv-svg" width={largura} height={ALTURA} role="img" aria-label={`${titulo} por dia`}>
              {ticks.map(t => (
                <g key={t}>
                  <line className={t === 0 ? 'base' : 'grade'} x1={M.esq} x2={M.esq + w} y1={y(t)} y2={y(t)} />
                  <text className="eixo" x={M.esq - 6} y={y(t) + 3.5} textAnchor="end">{fmt(t)}</text>
                </g>
              ))}
              {rotulos.map(i => <text key={i} className="eixo" x={x(i)} y={ALTURA - 6} textAnchor={i === 0 && pontos.length > 1 ? 'start' : i === pontos.length - 1 && pontos.length > 1 ? 'end' : 'middle'}>{ddmm(pontos[i].dia)}</text>)}
              {ativo != null && <line className="grade" x1={x(ativo)} x2={x(ativo)} y1={M.topo} y2={M.topo + h} style={{ stroke: 'var(--pl-ink-muted)' }} />}
              <path d={d} fill="none" stroke="var(--sv-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {pontos.map((p, i) => p.valor != null && (pontos.length <= 20 || i === ativo || i === pontos.length - 1) && (
                <circle key={p.dia} cx={x(i)} cy={y(p.valor)} r={i === ativo ? 5 : 4} fill="var(--sv-1)" stroke="var(--pl-surface)" strokeWidth={2} />
              ))}
              <rect className="alvo-hover" x={M.esq} y={0} width={w} height={ALTURA}
                onPointerMove={e => {
                  const r = (e.currentTarget as SVGRectElement).getBoundingClientRect()
                  const rel = Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)))
                  setAtivo(Math.round(rel * (pontos.length - 1)))
                }}
                onPointerLeave={() => setAtivo(null)} />
            </svg>
          )}
          <Tooltip estado={tip} largura={largura} />
        </div>
      )}
    </CartaoViz>
  )
}

export function Evolucao({ pessoa }: { pessoa?: string }) {
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30)
  const [dados, setDados] = useState<{ chave: string; ev: CpEvolucao } | null>(null)
  const [erro, setErro] = useState('')
  const chave = `${pessoa ?? 'eu'}|${dias}`
  useEffect(() => {
    let cancelado = false
    proLaboreApi.copiloto.evolucao(pessoa, dias).then(ev => { if (!cancelado) setDados({ chave, ev }) }).catch(e => { if (!cancelado) setErro((e as Error).message) })
    return () => { cancelado = true }
  }, [chave, pessoa, dias])

  if (erro) return <div className="pl-alert pl-alert-error">{erro}</div>
  if (!dados) return <div className="pl-hint">Carregando a evolução…</div>
  const { ev } = dados
  const serie = ev.serie
  const tipos = Object.entries(ev.porTipo).filter(([t]) => t !== 'ESTUDO')
  const totalAcoes = serie.reduce((s, d) => s + d.acoes, 0), feitas = serie.reduce((s, d) => s + d.acoesFeitas, 0)

  return (
    <>
      <div className="cp-abas">
        <div className="pl-as-periodos" role="group" aria-label="Período">
          {PERIODOS.map(p => <button key={p} type="button" className={`pl-chip ${dias === p ? 'active' : ''}`} onClick={() => setDias(p)} aria-pressed={dias === p}>{p} dias</button>)}
        </div>
      </div>
      <div className="cp-kpis">
        <div className="cp-kpi"><span>Dias com análise</span><b>{serie.length}</b><small>nos últimos {dias} dias</small></div>
        <div className="cp-kpi"><span>Ações do plano feitas</span><b>{totalAcoes ? `${Math.round((feitas / totalAcoes) * 100)}%` : '—'}</b><small>{feitas} de {totalAcoes} (sem contar estudo)</small></div>
        <div className="cp-kpi"><span>Sequência</span><b>{ev.sequencia}</b><small>{ev.sequencia === 1 ? 'dia seguido' : 'dias seguidos'} com o plano em ação</small></div>
        <div className="cp-kpi"><span>Estudos concluídos</span><b>{ev.estudosConcluidos}</b><small>na trilha</small></div>
      </div>
      {serie.length < 2 && <p className="cp-legenda">A evolução ganha forma a partir do segundo dia: o copiloto guarda os números de cada dia e mostra a tendência aqui.</p>}
      <div className="cp-grade">
        <Linha titulo="Índice do dia" subtitulo="De 0 a 100: resposta, abordagem, carteira, agenda e avanços" pontos={serie.map(d => ({ dia: d.dia, valor: d.indice }))} fmt={v => num(v)} maxFixo={100} />
        <Linha titulo="Leads parados" subtitulo="Sem movimento além do prazo do estágio · quanto menor, melhor" pontos={serie.map(d => ({ dia: d.dia, valor: d.parados }))} fmt={v => num(v)} inteiro />
        <Linha titulo="Tempo até a 1ª abordagem" subtitulo="Horas, mediana de 30 dias · quanto menor, melhor" pontos={serie.map(d => ({ dia: d.dia, valor: d.tempoAbordagemHoras }))} fmt={v => `${num(v, 1)} h`} />
        <Linha titulo="Avanços de estágio na semana" subtitulo="Leads que andaram no funil nos 7 dias até cada dia" pontos={serie.map(d => ({ dia: d.dia, valor: d.movimentos7d }))} fmt={v => num(v)} inteiro />
      </div>

      <section className="cp-card">
        <div className="cp-card-cab"><div><h2>O que funciona com você</h2><p className="cp-sub">Medido: das ações feitas, em quantas o lead avançou ou a conversa foi respondida depois. É assim que o copiloto aprende a ordem do seu plano.</p></div></div>
        {tipos.length === 0 ? <p className="cp-legenda">Ainda sem ações verificadas. O efeito de cada ação é conferido no dia seguinte.</p> : (
          <div className="cp-tabela-rola">
            <table className="cp-tabela" style={{ minWidth: 420 }}>
              <thead><tr><th>Tipo de ação</th><th className="num">Sugeridas</th><th className="num">Feitas</th><th className="num">Com efeito</th></tr></thead>
              <tbody>{tipos.map(([t, x]) => <tr key={t}><td>{TIPO_ACAO[t] ?? t}</td><td className="num">{x.total}</td><td className="num">{x.feitas}</td><td className="num">{x.efeito}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {ev.aprendizados.length > 0 && <ul className="cp-lista" style={{ marginTop: 12 }}>{ev.aprendizados.map(a => <li key={a.texto}>{a.texto}</li>)}</ul>}
      </section>
    </>
  )
}
