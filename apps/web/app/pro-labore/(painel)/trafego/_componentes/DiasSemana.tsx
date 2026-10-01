'use client'

// Calendário do período: cada quadradinho é um dia (linhas = dias da semana,
// colunas = semanas), colorido pela métrica escolhida. Mostra ao mesmo tempo
// o padrão por dia da semana (a média de cada linha, à direita) e o que
// mudou ao longo das semanas — um dia fora da curva salta aos olhos.
import { useState } from 'react'
import type { AnaliseTrafego } from '@/lib/proLaboreApi'
import { Abas, CartaoViz, Vazio } from '../../social-media/_componentes/viz'
import { moeda, num, pct, singular } from './formato'
import { corIndice } from './GraficosPublico'

type Metrica = 'contatos' | 'custo' | 'gasto' | 'crm' | 'ctr'
type Dia = AnaliseTrafego['diario'][number]
const LINHAS = [1, 2, 3, 4, 5, 6, 0]
const CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const SEQ = ['var(--sv-seq-1)', 'var(--sv-seq-2)', 'var(--sv-seq-3)', 'var(--sv-seq-4)', 'var(--sv-seq-5)']
const TINTA = ['var(--sv-seq-ink-1)', 'var(--sv-seq-ink-2)', 'var(--sv-seq-ink-3)', 'var(--sv-seq-ink-4)', 'var(--sv-seq-ink-5)']
const DIA_MS = 86_400_000
const dataUTC = (s: string) => new Date(`${s}T12:00:00Z`)
const chave = (d: Date) => d.toISOString().slice(0, 10)

export default function DiasSemana({ analise }: { analise: AnaliseTrafego }) {
  const c = analise.conta.moeda
  const temCrm = analise.crm.leads != null
  const [metrica, setMetrica] = useState<Metrica>('contatos')
  const [ativo, setAtivo] = useState<string | null>(null)
  const nomeRes = analise.totais.leads === 0 ? 'conversas' : analise.totais.conversas === 0 ? 'leads' : 'contatos'
  const porDia = new Map(analise.diario.map(d => [d.data, d]))
  const contatos = (d: Dia) => d.conversas + d.leads
  const valor = (d: Dia): number | null => {
    if (metrica === 'contatos') return contatos(d)
    if (metrica === 'gasto') return d.gasto
    if (metrica === 'crm') return d.leadsCrm
    if (metrica === 'ctr') return d.impressoes ? d.cliquesLink / d.impressoes : null
    return contatos(d) ? d.gasto / contatos(d) : null
  }
  const fmt = (v: number | null) => (metrica === 'gasto' || metrica === 'custo' ? moeda(v, c, v != null && v >= 100 ? 0 : 2) : metrica === 'ctr' ? pct(v, 2) : num(v))
  const totGasto = analise.diario.reduce((s, d) => s + d.gasto, 0), totCont = analise.diario.reduce((s, d) => s + contatos(d), 0)
  const custoMedio = totCont ? totGasto / totCont : null
  const valores = analise.diario.map(valor).filter((v): v is number => v != null)
  const max = Math.max(0, ...valores)
  const cor = (d: Dia | undefined) => {
    if (!d) return null
    const v = valor(d)
    if (metrica === 'custo') return v == null ? { bg: 'var(--pl-surface-2)', ink: 'var(--pl-ink-muted)' } : corIndice(custoMedio ? v / custoMedio : null)
    if (v == null || v <= 0 || max <= 0) return { bg: 'var(--pl-surface-2)', ink: 'var(--pl-ink-muted)' }
    const k = Math.min(4, Math.floor((v / max) * 5))
    return { bg: SEQ[k], ink: TINTA[k] }
  }

  // Semanas de segunda a domingo cobrindo o período.
  const inicio = dataUTC(analise.periodo.inicio), fim = dataUTC(analise.periodo.fim)
  const segunda = new Date(inicio.getTime() - ((inicio.getUTCDay() + 6) % 7) * DIA_MS)
  const semanas: Date[] = []
  for (let t = segunda.getTime(); t <= fim.getTime(); t += 7 * DIA_MS) semanas.push(new Date(t))
  const celula = (sem: Date, diaSemana: number) => chave(new Date(sem.getTime() + ((diaSemana + 6) % 7) * DIA_MS))

  // Média de cada dia da semana (linha do calendário).
  const mediaLinha = (diaSemana: number) => {
    const ds = analise.diario.filter(d => dataUTC(d.data).getUTCDay() === diaSemana)
    if (!ds.length) return null
    if (metrica === 'custo') { const g = ds.reduce((s, d) => s + d.gasto, 0), r = ds.reduce((s, d) => s + contatos(d), 0); return r ? g / r : null }
    if (metrica === 'ctr') { const i = ds.reduce((s, d) => s + d.impressoes, 0); return i ? ds.reduce((s, d) => s + d.cliquesLink, 0) / i : null }
    const vs = ds.map(valor).filter((v): v is number => v != null)
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null
  }
  const medias = LINHAS.map(mediaLinha)
  const maxMedia = Math.max(0, ...medias.map(v => v ?? 0))
  const validas = medias.filter((v): v is number => v != null && v > 0)
  const melhor = validas.length ? (metrica === 'custo' ? Math.min(...validas) : Math.max(...validas)) : null
  const sel = ativo ? porDia.get(ativo) : null
  const temDado = analise.diario.some(d => d.gasto > 0)

  return (
    <CartaoViz
      titulo="Calendário do período"
      subtitulo={metrica === 'custo' ? `Custo por ${singular(nomeRes)} de cada dia contra a média do período: azul mais barato, laranja mais caro` : 'Cada quadradinho é um dia; à direita, a média de cada dia da semana'}
      acoes={<Abas rotulo="Métrica do calendário" valor={metrica} onChange={setMetrica} opcoes={[{ valor: 'contatos', rotulo: 'Resultados' }, { valor: 'custo', rotulo: 'Custo/result.' }, { valor: 'gasto', rotulo: 'Investimento' }, ...(temCrm ? [{ valor: 'crm' as const, rotulo: 'Leads CRM' }] : []), { valor: 'ctr', rotulo: 'CTR' }]} />}
      tabela={{
        colunas: ['Dia', 'Investimento', nomeRes, 'Custo/result.', 'CTR', ...(temCrm ? ['Leads CRM'] : [])],
        linhas: analise.diario.map(d => [`${CURTO[dataUTC(d.data).getUTCDay()]} ${d.data.slice(8, 10)}/${d.data.slice(5, 7)}`, moeda(d.gasto, c), num(contatos(d)), moeda(contatos(d) ? d.gasto / contatos(d) : null, c), pct(d.impressoes ? d.cliquesLink / d.impressoes : null, 2), ...(temCrm ? [num(d.leadsCrm)] : [])]),
      }}
    >
      {!temDado ? <Vazio>Sem investimento no período.</Vazio> : (
        <div className="pl-tf-cal-wrap">
          <div className="pl-tf-cal" style={{ gridTemplateColumns: `34px repeat(${semanas.length}, minmax(18px, 42px)) minmax(130px, 220px)` }}>
            <span />
            {semanas.map((s, i) => <span key={i} className="pl-tf-cal-sem">{i % 2 === 0 || semanas.length <= 6 ? `${chave(s).slice(8, 10)}/${chave(s).slice(5, 7)}` : ''}</span>)}
            <span className="pl-tf-cal-sem">Média do dia</span>
            {LINHAS.map((ds, li) => (
              <div key={ds} className="pl-tf-cal-linha">
                <span className="pl-tf-cal-dia">{CURTO[ds]}</span>
                {semanas.map((s, si) => {
                  const k = celula(s, ds)
                  const d = porDia.get(k)
                  const e = cor(d)
                  if (!e || !d) return <span key={si} className="pl-tf-cal-cel fora" />
                  return (
                    <button key={si} type="button" className={`pl-tf-cal-cel ${ativo === k ? 'ativo' : ''}`} style={{ background: e.bg, color: e.ink }}
                      onMouseEnter={() => setAtivo(k)} onMouseLeave={() => setAtivo(null)} onFocus={() => setAtivo(k)} onBlur={() => setAtivo(null)}
                      aria-label={`${CURTO[ds]} ${k.slice(8, 10)}/${k.slice(5, 7)}: ${fmt(valor(d))}`}>
                      {k.slice(8, 10)}
                    </button>
                  )
                })}
                <span className={`pl-tf-cal-media ${medias[li] != null && medias[li] === melhor ? 'melhor' : ''}`}>
                  <i style={{ width: `${medias[li] != null && maxMedia > 0 ? (medias[li]! / maxMedia) * 100 : 0}%` }} />
                  <b>{fmt(medias[li])}</b>
                </span>
              </div>
            ))}
          </div>
          <div className="pl-tf-cal-info">
            {sel ? (
              <><b>{CURTO[dataUTC(sel.data).getUTCDay()]}, {sel.data.slice(8, 10)}/{sel.data.slice(5, 7)}</b> · {moeda(sel.gasto, c)} investidos · {num(contatos(sel))} {nomeRes} · {moeda(contatos(sel) ? sel.gasto / contatos(sel) : null, c)} cada{sel.leadsCrm != null && <> · {num(sel.leadsCrm)} leads no CRM</>}</>
            ) : <>Passe o mouse num dia. {melhor != null && <>Melhor dia da semana em destaque à direita.</>}</>}
          </div>
        </div>
      )}
    </CartaoViz>
  )
}
