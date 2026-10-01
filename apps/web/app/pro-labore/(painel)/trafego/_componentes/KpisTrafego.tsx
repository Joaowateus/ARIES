'use client'

// Métricas principais do Gerenciador, com a variação contra o período
// anterior. A cor da variação segue o que é bom pra cada métrica (CPM
// subindo é ruim, CTR subindo é bom), sempre com seta e sinal.
import type { AnaliseTrafego } from '@/lib/proLaboreApi'
import { compacto, moeda, num, pct } from './formato'

type Bom = 'sobe' | 'desce' | 'neutro'

function Delta({ atual, anterior, bom, pontos }: { atual: number | null; anterior: number | null; bom: Bom; pontos?: boolean }) {
  if (atual == null || anterior == null || anterior === 0) return <span className="pl-kpi-vs">sem comparação</span>
  const v = pontos ? atual - anterior : atual / anterior - 1
  if (Math.abs(v) < (pontos ? 0.0005 : 0.005)) return <span className="pl-delta neutral">= estável</span>
  const sobe = v > 0
  const classe = bom === 'neutro' ? 'neutral' : (sobe === (bom === 'sobe') ? 'up' : 'down')
  const texto = pontos ? `${(Math.abs(v) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} p.p.` : pct(Math.abs(v), Math.abs(v) < 0.1 ? 1 : 0)
  return (
    <>
      <span className={`pl-delta ${classe}`}>{sobe ? '▲ +' : '▼ −'}{texto}</span>
      <span className="pl-kpi-vs">vs. período anterior</span>
    </>
  )
}

function Kpi({ rotulo, valor, nota, atual, anterior, bom, pontos, destaque }: {
  rotulo: string; valor: string; nota?: string
  atual: number | null; anterior: number | null; bom: Bom; pontos?: boolean; destaque?: boolean
}) {
  return (
    <div className={`pl-kpi pl-sv-kpi ${destaque ? 'pl-tf-kpi-destaque' : ''}`}>
      <div className="pl-kpi-label">{rotulo}</div>
      <div className="pl-kpi-value">{valor}</div>
      <div className="pl-kpi-foot"><Delta atual={atual} anterior={anterior} bom={bom} pontos={pontos} /></div>
      {nota && <div className="pl-sv-kpi-nota">{nota}</div>}
    </div>
  )
}

export default function KpisTrafego({ analise }: { analise: AnaliseTrafego }) {
  const { totais: t, totaisAnterior: ta, derivadas: d, derivadasAnterior: da, crm } = analise
  const c = analise.conta.moeda
  const cr = analise.funil.find(e => e.connectRate)
  const cliques = analise.funil.find(e => e.chave === 'cliquesLink')
  const crAnt = cr && cliques?.valorAnterior ? cr.valorAnterior / cliques.valorAnterior : null
  const temVideo = t.videoViews > 0
  return (
    <div className="pl-sv-kpis pl-tf-kpis">
      <Kpi rotulo="Investimento" valor={moeda(t.gasto, c)} atual={t.gasto} anterior={ta.gasto} bom="neutro" destaque />
      <Kpi rotulo="Impressões" valor={compacto(t.impressoes)} atual={t.impressoes} anterior={ta.impressoes} bom="sobe" />
      <Kpi rotulo="Alcance" valor={compacto(t.alcance)} nota={analise.alcanceExato ? 'Pessoas únicas (dado da Meta)' : 'Aproximado (soma dos dias)'} atual={t.alcance} anterior={ta.alcance} bom="sobe" />
      <Kpi rotulo="Frequência" valor={d.frequencia != null ? d.frequencia.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—'} nota="Vezes que cada pessoa viu, em média" atual={d.frequencia} anterior={da.frequencia} bom="neutro" />
      <Kpi rotulo="CPM" valor={moeda(d.cpm, c)} nota="Custo por mil impressões" atual={d.cpm} anterior={da.cpm} bom="desce" />
      <Kpi rotulo="CTR (link)" valor={pct(d.ctr, 2)} nota={`CTR todos os cliques: ${pct(d.ctrTodos, 2)}`} atual={d.ctr} anterior={da.ctr} bom="sobe" pontos />
      <Kpi rotulo="CPC (link)" valor={moeda(d.cpc, c)} nota={`${num(t.cliquesLink)} cliques no link`} atual={d.cpc} anterior={da.cpc} bom="desce" />
      {cr && <Kpi rotulo="Connect rate" valor={pct(cr.convAnterior)} nota={`${cr.nome} ÷ cliques no link`} atual={cr.convAnterior} anterior={crAnt} bom="sobe" pontos destaque />}
      {t.conversas > 0 && <Kpi rotulo="Custo por conversa" valor={moeda(d.custoConversa, c)} nota={`${num(t.conversas)} conversas no WhatsApp`} atual={d.custoConversa} anterior={da.custoConversa} bom="desce" />}
      {t.lpv > 0 && <Kpi rotulo="Custo por visualização" valor={moeda(d.custoLpv, c)} nota={`${num(t.lpv)} visualizações da página`} atual={d.custoLpv} anterior={da.custoLpv} bom="desce" />}
      {t.leads > 0 && <Kpi rotulo="CPL (Meta)" valor={moeda(d.cpl, c)} nota={`${num(t.leads)} leads de formulário/site`} atual={d.cpl} anterior={da.cpl} bom="desce" />}
      {crm.leads != null && <Kpi rotulo="Leads no CRM" valor={num(crm.leads)} nota={crm.somenteTrafego ? 'Marcados como “Tráfego”' : 'Todos os cadastrados'} atual={crm.leads} anterior={crm.leadsAnterior} bom="sobe" />}
      {crm.leads != null && <Kpi rotulo="Custo por lead (CRM)" valor={moeda(crm.custoReal, c)} nota="Investimento ÷ leads no CRM" atual={crm.custoReal} anterior={crm.leadsAnterior ? ta.gasto / crm.leadsAnterior : null} bom="desce" destaque />}
      {t.conversasProf2 > 0 && <Kpi rotulo="Conversas engajadas" valor={pct(d.taxaConversaEngajada)} nota={`${num(t.conversasProf2)} com 2+ mensagens · ${moeda(d.custoConversaEngajada, c)} cada`} atual={d.taxaConversaEngajada} anterior={da.taxaConversaEngajada} bom="sobe" pontos />}
      {t.cliquesSaida > 0 && <Kpi rotulo="CTR de saída" valor={pct(d.ctrSaida, 2)} nota={`${num(t.cliquesSaida)} cliques que saíram da Meta`} atual={d.ctrSaida} anterior={da.ctrSaida} bom="sobe" pontos />}
      {t.engajamento > 0 && <Kpi rotulo="Engajamento" valor={pct(d.taxaEngajamento, 2)} nota={`${compacto(t.engajamento)} interações · ${num(t.comentarios)} comentários · ${num(t.salvamentos)} salvos`} atual={d.taxaEngajamento} anterior={da.taxaEngajamento} bom="sobe" pontos />}
      {temVideo && <Kpi rotulo="Hook rate" valor={pct(d.hookRate)} nota="Pararam 3s no vídeo ÷ impressões" atual={d.hookRate} anterior={da.hookRate} bom="sobe" pontos />}
      {temVideo && <Kpi rotulo="Hold rate" valor={pct(d.holdRate)} nota="Assistiram (ThruPlay) ÷ pararam 3s" atual={d.holdRate} anterior={da.holdRate} bom="sobe" pontos />}
      {temVideo && d.tempoMedioVideo != null && <Kpi rotulo="Tempo médio no vídeo" valor={`${d.tempoMedioVideo.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}s`} nota="Quanto cada reprodução durou, em média" atual={d.tempoMedioVideo} anterior={da.tempoMedioVideo} bom="sobe" />}
    </div>
  )
}
