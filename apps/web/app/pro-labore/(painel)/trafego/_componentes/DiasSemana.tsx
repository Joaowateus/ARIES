'use client'

// Dias da semana: média por dia de cada dia da semana no período — pra ver
// em que dias o resultado sai mais barato e onde vale reforçar atendimento
// ou orçamento. Média por ocorrência (um período de 10 dias tem 2 segundas
// e 1 domingo, por exemplo).
import { useState } from 'react'
import type { AnaliseTrafego } from '@/lib/proLaboreApi'
import { Abas, CartaoViz, LinhaTip, Tooltip, Vazio, ticksBonitos, useLargura, type EstadoTooltip } from '../../social-media/_componentes/viz'
import { compacto, moeda, pct } from './formato'

type Metrica = 'custo' | 'contatos' | 'gasto' | 'ctr' | 'crm'
const ORDEM = [1, 2, 3, 4, 5, 6, 0]
const CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const ALTURA = 230
const M = { topo: 14, dir: 10, base: 28, esq: 56 }

export default function DiasSemana({ analise }: { analise: AnaliseTrafego }) {
  const c = analise.conta.moeda
  const [metrica, setMetrica] = useState<Metrica>('custo')
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [ativo, setAtivo] = useState<number | null>(null)
  const dias = ORDEM.map(d => analise.semana[d])
  const temCrm = analise.crm.leads != null
  const valor = (w: AnaliseTrafego['semana'][number]): number | null => {
    if (!w.ocorrencias) return null
    if (metrica === 'custo') return w.contatos > 0 ? w.gasto / w.contatos : null
    if (metrica === 'contatos') return w.contatos / w.ocorrencias
    if (metrica === 'gasto') return w.gasto / w.ocorrencias
    if (metrica === 'ctr') return w.impressoes > 0 ? w.cliquesLink / w.impressoes : null
    return w.leadsCrm != null ? w.leadsCrm / w.ocorrencias : null
  }
  const fmt = (v: number | null) => (metrica === 'custo' || metrica === 'gasto' ? moeda(v, c) : metrica === 'ctr' ? pct(v, 2) : v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }))
  const fmtEixo = (v: number) => (metrica === 'custo' || metrica === 'gasto' ? (v >= 1000 ? compacto(v) : moeda(v, c, v < 10 ? 2 : 0)) : metrica === 'ctr' ? pct(v, 1) : compacto(v))
  const valores = dias.map(valor)
  const temDado = valores.some(v => v != null && v > 0)
  const validos = valores.filter((v): v is number => v != null && v > 0)
  // Destaque: o melhor dia (custo menor; nas outras métricas, o maior).
  const melhor = validos.length ? (metrica === 'custo' ? Math.min(...validos) : Math.max(...validos)) : null
  const w = Math.max(0, largura - M.esq - M.dir), h = ALTURA - M.topo - M.base
  const ticks = ticksBonitos(Math.max(0.0001, ...validos))
  const topo = ticks.at(-1) || 1
  const faixa = w / 7
  const y = (v: number) => M.topo + h - (v / topo) * h
  const base = M.topo + h
  const nomeRes = analise.totais.leads === 0 ? 'conversas' : analise.totais.conversas === 0 ? 'leads' : 'contatos'
  let tip: EstadoTooltip | null = null
  if (ativo != null && dias[ativo].ocorrencias) {
    const d = dias[ativo]
    tip = {
      x: M.esq + faixa * (ativo + 0.5), y: y(valores[ativo] ?? 0),
      conteudo: (
        <>
          <div className="pl-sv-tip-titulo">{d.nome} ({d.ocorrencias}× no período)</div>
          <LinhaTip valor={moeda(d.gasto / d.ocorrencias, c)} rotulo="investidos por dia" />
          <LinhaTip valor={(d.contatos / d.ocorrencias).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} rotulo={`${nomeRes} por dia`} />
          <LinhaTip valor={moeda(d.contatos ? d.gasto / d.contatos : null, c)} rotulo="por resultado" />
          {d.leadsCrm != null && <LinhaTip valor={(d.leadsCrm / d.ocorrencias).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} rotulo="leads no CRM por dia" />}
        </>
      ),
    }
  }
  return (
    <CartaoViz
      titulo="Dias da semana"
      subtitulo={metrica === 'custo' ? `Custo por ${nomeRes.replace(/s$/, '')} em cada dia da semana (o mais barato em destaque)` : 'Média por dia — cada dia da semana dividido pelas vezes que aparece no período'}
      acoes={<Abas rotulo="Métrica" valor={metrica} onChange={setMetrica} opcoes={[{ valor: 'custo', rotulo: 'Custo/result.' }, { valor: 'contatos', rotulo: 'Resultados/dia' }, { valor: 'gasto', rotulo: 'Investimento/dia' }, { valor: 'ctr', rotulo: 'CTR' }, ...(temCrm ? [{ valor: 'crm' as const, rotulo: 'Leads CRM/dia' }] : [])]} />}
      tabela={{
        colunas: ['Dia', 'Vezes no período', 'Investimento/dia', `${nomeRes}/dia`, 'Custo/result.', 'CTR', ...(temCrm ? ['Leads CRM/dia'] : [])],
        linhas: dias.map(d => [d.nome, d.ocorrencias, moeda(d.ocorrencias ? d.gasto / d.ocorrencias : null, c), d.ocorrencias ? (d.contatos / d.ocorrencias).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—', moeda(d.contatos ? d.gasto / d.contatos : null, c), pct(d.impressoes ? d.cliquesLink / d.impressoes : null, 2), ...(temCrm ? [d.ocorrencias && d.leadsCrm != null ? (d.leadsCrm / d.ocorrencias).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'] : [])]),
      }}
    >
      {!temDado ? <Vazio>Sem dados no período.</Vazio> : (
        <div ref={ref} style={{ position: 'relative' }}>
          {largura > 0 && (
            <svg className="pl-sv-svg" width={largura} height={ALTURA} role="img" aria-label="Gráfico por dia da semana" onPointerLeave={() => setAtivo(null)}
              onPointerMove={e => { const r = e.currentTarget.getBoundingClientRect(); const i = Math.floor((e.clientX - r.left - M.esq) / (faixa || 1)); setAtivo(i >= 0 && i < 7 ? i : null) }}>
              {ticks.map(t => (
                <g key={t}>
                  <line className="grade" x1={M.esq} x2={M.esq + w} y1={y(t)} y2={y(t)} />
                  <text className="eixo" x={M.esq - 8} y={y(t) + 3.5} textAnchor="end">{fmtEixo(t)}</text>
                </g>
              ))}
              <line className="base" x1={M.esq} x2={M.esq + w} y1={base} y2={base} />
              {valores.map((v, i) => {
                if (v == null || v <= 0) return null
                const bw = Math.min(56, faixa - 14), x0 = M.esq + faixa * i + (faixa - bw) / 2, t = y(v), r = Math.min(4, base - t)
                const destaque = v === melhor
                return (
                  <g key={i}>
                    <path d={`M${x0} ${base} V${t + r} Q${x0} ${t} ${x0 + r} ${t} H${x0 + bw - r} Q${x0 + bw} ${t} ${x0 + bw} ${t + r} V${base} Z`}
                      fill={destaque ? 'var(--sv-1)' : 'var(--sv-seq-1)'} opacity={ativo == null || ativo === i ? 1 : 0.55} />
                    <text className="pl-tf-rotulo-ponto" x={x0 + bw / 2} y={t - 6} textAnchor="middle">{fmt(v)}</text>
                  </g>
                )
              })}
              {dias.map((d, i) => <text key={d.dia} className="eixo" x={M.esq + faixa * (i + 0.5)} y={ALTURA - 8} textAnchor="middle">{CURTO[d.dia]}</text>)}
            </svg>
          )}
          <Tooltip estado={tip} largura={largura} />
        </div>
      )}
    </CartaoViz>
  )
}

