'use client'

// Hoje como painel de comando: a linha de indicadores principais (número,
// variação, tendência de 30 dias e, na previsão, a barra contra a meta), o
// ritmo do mês e os gráficos da operação (funil, equipe e origem).
import Link from 'next/link'
import type { BussolaHoje, NumeroHoje, PainelHoje } from '@/lib/proLaboreApi'
import { fmtValor, subDoNumero } from '../_padrao/Padrao'
import { BarraMeta, EquipeGrafico, FunilDoMes, Minilinha, OrigemGrafico, RitmoDoMes, Variacao, corFaixa, type SerieDia } from './Graficos'

interface Kpi { chave: string; nome: string; valor: string; sub: string | null; variacao: number | null; melhor: string; faixa: string | null; serie: SerieDia | null; meta?: { pct: number | null; esperado: number | null } | null; href?: string }
const SERIE_DO_NUMERO: Record<string, string> = { previsao_fechamento: 'faturamento', faturamento: 'faturamento', vendas: 'vendas', pro_labore: 'pro_labore', leads_novos: 'leads_novos', leads_passados: 'leads_novos', atividades_feitas: 'atividades_feitas' }

export function montarKpis(papel: string, numeros: NumeroHoje[], b: BussolaHoje | null, p: PainelHoje | null): Kpi[] {
  const serie = (k: string) => (p?.series[SERIE_DO_NUMERO[k]] ?? null)
  const hojeDia = Number(new Date(Date.now() - 3 * 3600e3).toISOString().slice(8, 10))
  const kpis: Kpi[] = numeros.slice(0, 3).map(n => ({
    chave: n.chave, nome: n.nome, valor: n.naoDefinido ? '—' : fmtValor(n.valor, n.unidade), sub: subDoNumero(n) || null,
    variacao: n.variacao, melhor: n.melhor, faixa: n.status, serie: serie(n.chave),
    meta: n.chave === 'previsao_fechamento' && n.alvo?.valor ? { pct: n.valor != null ? Math.round((n.valor / n.alvo.valor) * 100) : null, esperado: p ? (hojeDia / p.ritmo.totalDias) * 100 : null } : null,
  }))
  // Dono e supervisor: vendas do mês e conversão, ao lado dos três números aprovados.
  if ((papel === 'DONO' || papel === 'SUPERVISOR') && b) {
    const m = (area: string, chave: string) => b.bussola.cartoes.find(c => c.area === area)?.metricas.find(x => x.chave === chave)
    const extra = [m('RESULTADO', 'vendas'), m('VENDEDORES', 'conversao_lead_venda')].filter(Boolean)
    const pos = papel === 'DONO' ? 1 : 3
    kpis.splice(pos, 0, ...extra.map(x => ({ chave: x!.chave, nome: x!.chave === 'vendas' ? 'Vendas do mês' : x!.nome, valor: x!.texto, sub: x!.comparacao ?? null, variacao: x!.variacao ?? null, melhor: x!.melhor ?? 'MAIOR', faixa: x!.faixa, serie: serie(x!.chave) })))
  }
  return kpis
}

export function LinhaKpis({ kpis }: { kpis: Kpi[] }) {
  return (
    <section aria-label="Indicadores principais" data-agora data-kpis style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))', gap: 10, marginBottom: 14 }}>
      {kpis.map(k => (
        <div key={k.chave} className="pl-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2, borderTop: `3px solid ${corFaixa(k.faixa)}` }} data-kpi={k.chave} data-numero={k.chave}>
          <span className="pl-hint" style={{ fontSize: 12 }}>{k.nome}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <b style={{ fontSize: 24, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' }}>{k.valor}</b>
            <Variacao v={k.variacao} melhor={k.melhor} />
          </div>
          {k.meta && <><BarraMeta pct={k.meta.pct} esperadoPct={k.meta.esperado} faixa={k.faixa} /><span className="pl-hint" style={{ fontSize: 11 }}>{k.meta.pct}% da meta{k.meta.esperado != null ? ` · ideal hoje: ${Math.round(k.meta.esperado)}%` : ''}</span></>}
          {!k.meta && k.serie && <Minilinha serie={k.serie} />}
          {k.sub && <span className="pl-hint" style={{ fontSize: 11, lineHeight: 1.35 }}>{k.sub}</span>}
        </div>
      ))}
    </section>
  )
}

export function CartaoRitmo({ p, papel }: { p: PainelHoje; papel: string }) {
  const r = p.ritmo
  const emPct = papel !== 'DONO' && papel !== 'SUPERVISOR' && papel !== 'FINANCEIRO'
  return (
    <section className="pl-card" aria-label="Ritmo do mês" data-cartao-ritmo>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <div className="pl-card-title" style={{ margin: 0 }}>Ritmo do mês</div>
        {r.pct != null && <span style={{ fontSize: 13, fontWeight: 600, color: corFaixa(r.faixa) }}>{r.pct}% da meta · {r.texto}</span>}
      </div>
      <RitmoDoMes dias={r.dias} totalDias={r.totalDias} meta={r.meta} previsao={r.previsao} emPct={emPct} />
    </section>
  )
}

export function GraficosOperacao({ p, papel }: { p: PainelHoje; papel: string }) {
  const cartao = (titulo: string, href: string, filho: React.ReactNode, data: string) => (
    <section className="pl-card" aria-label={titulo} data-grafico={data} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div className="pl-card-title" style={{ margin: 0 }}>{titulo}</div><Link href={href} className="pl-hint" style={{ fontSize: 12 }}>Abrir →</Link></div>
      {filho}
    </section>
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 12, marginBottom: 16 }} data-graficos-operacao>
      {cartao(papel === 'VENDEDOR' || papel === 'SDR' ? 'Meu funil do mês' : 'Funil do mês', '/pro-labore/leads', <FunilDoMes etapas={p.funil.etapas} gargalo={p.funil.gargalo} />, 'funil')}
      {p.equipe && cartao('Equipe no mês', '/pro-labore/equipe', <EquipeGrafico pessoas={p.equipe} />, 'equipe')}
      {p.origem && cartao('Origem do faturamento', '/pro-labore/origem-vendas', <OrigemGrafico partes={p.origem} emPct={papel !== 'DONO'} />, 'origem')}
    </div>
  )
}
