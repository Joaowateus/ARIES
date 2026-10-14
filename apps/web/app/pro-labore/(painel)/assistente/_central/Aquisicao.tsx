'use client'

// Blocos 5 e 6 — Tráfego (plataforma × CRM, qualidade, atribuição, ritmo do
// orçamento) e a jornada orgânica do Social Media até a venda.
import type { IntelCentral } from '@/lib/proLaboreApi'
import { brl, num, pct } from './fmt'

function Kpi({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: React.ReactNode }) {
  return <div className="ic-kpi"><span>{rotulo}</span><b>{valor}</b>{nota && <small>{nota}</small>}</div>
}
function variacao(atual: number | null | undefined, anterior: number | null | undefined) {
  if (atual == null || anterior == null || anterior === 0) return null
  const v = (atual - anterior) / anterior
  return `${v > 0 ? '+' : ''}${pct(v, 0)} vs. período anterior`
}

function Trafego({ t, d }: { t: NonNullable<IntelCentral['trafego']>; d: IntelCentral }) {
  const p = t.plataforma
  const cplMax = d.metas.cplMaximo?.comConversaoAtual ?? d.metas.cplMaximo?.comMetas ?? null
  return (
    <>
      <div className="ic-kpis">
        <Kpi rotulo="Investido no período" valor={brl(p?.gasto)} nota="Meta Ads (plataforma)" />
        <Kpi rotulo="Impressões" valor={num(p?.impressoes)} nota={`CPM ${brl(p?.cpm)}`} />
        <Kpi rotulo="Cliques no link" valor={num(p?.cliquesLink)} nota={`CTR ${pct(p?.ctr, 2)} · CPC ${brl(p?.cpc)}`} />
        <Kpi rotulo="Conversas iniciadas" valor={num(p?.conversas)} nota="WhatsApp/Direct, pela plataforma" />
        <Kpi rotulo="Leads na plataforma" valor={num(p?.leads)} nota={`custo por resultado ${brl(p?.custoResultado)}`} />
        <Kpi rotulo="Leads de tráfego no CRM" valor={num(t.crm.leadsTrafego)} nota={<>CPL no CRM {brl(t.crm.cplCrm)}{cplMax != null ? ` · máx. ${brl(cplMax)}` : ''}</>} />
      </div>
      <p className="ic-legenda">A plataforma conta cliques e conversas; o lead que vale é o que entrou no CRM. Diferença grande entre os dois indica lead que não chegou ao vendedor ou não foi cadastrado.</p>

      <div className="ic-grade">
        <section className="ic-card">
          <div className="ic-cab"><div><h3>Qualidade do tráfego</h3><p className="ic-sub">Leads que chegam à negociação (coorte do período), tráfego contra os demais canais.</p></div></div>
          {[{ nome: 'Tráfego pago', q: t.qualidade.trafego }, { nome: 'Demais canais', q: t.qualidade.outros }].map(x => (
            <div key={x.nome} className="ic-funil-etapa" style={{ marginBottom: 8 }}>
              <span>{x.nome}</span>
              <div className="ic-funil-trilho" aria-hidden="true"><span style={{ width: `${Math.min(100, (x.q.taxaNegociacao ?? 0) * 100)}%` }} /></div>
              <b>{pct(x.q.taxaNegociacao, 0)}</b>
            </div>
          ))}
          <p className="ic-legenda">{t.qualidade.trafego.negociacao} de {t.qualidade.trafego.leads} leads de tráfego · {t.qualidade.outros.negociacao} de {t.qualidade.outros.leads} dos demais.</p>
        </section>
        <section className="ic-card">
          <div className="ic-cab"><div><h3>Ritmo do orçamento</h3><p className="ic-sub">Gasto do mês contra o orçamento proporcional aos dias corridos.</p></div></div>
          <div className="ic-linha"><span>Gasto no mês</span><b>{brl(t.ritmo.gastoMes)}</b></div>
          <div className="ic-linha"><span>Orçamento proporcional até hoje</span><b>{brl(t.ritmo.orcamentoProporcional)}</b></div>
          <div className="ic-linha"><span>Ritmo</span><b>{pct(t.ritmo.pct, 0)}</b></div>
          <div className="ic-linha"><span>Projeção do mês no ritmo atual <span className="ic-tag projecao sem">Projeção</span></span><b>{brl(t.ritmo.projecaoMes)}</b></div>
          <div className="ic-linha"><span>Orçamento do mês</span><b>{brl(d.premissas.orcamentoMarketing)}</b></div>
        </section>
        <section className="ic-card">
          <div className="ic-cab"><div><h3>Atribuição de vendas</h3><p className="ic-sub">{t.atribuicao.regra}</p></div></div>
          <div className="ic-linha"><span>Vendas atribuídas no mês</span><b>{num(t.atribuicao.vendas)}</b></div>
          <div className="ic-linha"><span>Faturamento atribuído</span><b>{brl(t.atribuicao.faturamento)}</b></div>
          <div className="ic-linha"><span>Custo por venda atribuída</span><b>{brl(t.atribuicao.custoPorVenda)}</b></div>
          <div className="ic-linha"><span>ROAS<small>faturamento ÷ investimento — não é lucro</small></span><b>{t.atribuicao.roas != null ? `${num(t.atribuicao.roas, 1)}×` : '—'}</b></div>
        </section>
      </div>

      <section className="ic-card">
        <div className="ic-cab"><div><h3>Campanhas no período</h3><p className="ic-sub">Números da plataforma. O lead do CRM não guarda a campanha de origem, então venda por campanha não é calculada.</p></div></div>
        {t.campanhas.length === 0 ? <p className="ic-legenda">Sem campanhas com entrega no período.</p> : (
          <div className="ic-rola">
            <table className="ic-tabela" style={{ minWidth: 720 }}>
              <thead><tr><th>Campanha</th><th className="num">Investido</th><th className="num">Impressões</th><th className="num">Cliques no link</th><th className="num">CTR</th><th className="num">CPC</th><th className="num">Conversas</th><th className="num">Leads</th><th className="num">Custo/result.</th></tr></thead>
              <tbody>{t.campanhas.map(c => (
                <tr key={c.id}><td>{c.nome}</td><td className="num">{brl(c.gasto)}</td><td className="num">{num(c.impressoes)}</td><td className="num">{num(c.cliquesLink)}</td><td className="num">{pct(c.ctr, 2)}</td><td className="num">{brl(c.cpc)}</td><td className="num">{num(c.conversas)}</td><td className="num">{num(c.leads)}</td><td className="num">{brl(c.custoResultado)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function Social({ s }: { s: NonNullable<IntelCentral['social']> }) {
  const etapas = [
    { nome: 'Alcance médio por dia', valor: num(s.distribuicao?.alcanceMedioDia), nota: variacao(s.distribuicao?.alcanceMedioDia, s.distribuicao?.alcanceMedioDiaAnterior) },
    { nome: 'Visualizações', valor: num(s.distribuicao?.visualizacoes), nota: variacao(s.distribuicao?.visualizacoes, s.distribuicao?.visualizacoesAnterior) },
    { nome: 'Interações', valor: num(s.interesse?.interacoes), nota: `engajamento ${pct(s.interesse?.taxaEngajamento, 2)}` },
    { nome: 'Visitas ao perfil', valor: num(s.interesse?.visitasPerfil), nota: variacao(s.interesse?.visitasPerfil, s.interesse?.visitasPerfilAnterior) },
    { nome: 'Toques nos links do perfil', valor: num(s.interesse?.toquesLinks), nota: `${num(s.interesse?.cliquesLinksRastreados)} cliques em links rastreados` },
    { nome: 'Novos seguidores', valor: num(s.conversao?.novosSeguidores), nota: `líquido ${num(s.conversao?.crescimentoLiquido)} · ${pct(s.conversao?.taxaVisitaSeguidor, 1)} das visitas` },
    { nome: 'Leads orgânicos no CRM', valor: num(s.conversao?.leadsOrganicos), nota: 'canal orgânico/Instagram no CRM' },
    { nome: 'Vendas atribuídas', valor: num(s.conversao?.vendasAtribuidas), nota: `faturamento ${brl(s.conversao?.faturamentoAtribuido)}` },
  ]
  return (
    <>
      <div className="ic-kpis">
        <Kpi rotulo="Publicações no feed" valor={`${num(s.producao?.publicacoesNoFeed)} de ${num(s.producao?.metaPublicacoes)}`} nota={`${num(s.producao?.diasComPost)} dias com post · maior intervalo ${num(s.producao?.maiorIntervalo)} dias`} />
        <Kpi rotulo="Pautas da produção" valor={`${num(s.producao?.publicadasPelaProducao)} de ${num(s.producao?.planejadas)}`} nota="publicadas / planejadas no período" />
        <Kpi rotulo="Reels" valor={num(s.atencao?.reels)} nota={s.atencao?.tempoMedioAssistidoSeg != null ? `tempo médio assistido ${num(s.atencao.tempoMedioAssistidoSeg, 1)} s` : 'sem tempo assistido'} />
        <Kpi rotulo="Alcance de não seguidores" valor={pct(s.distribuicao?.shareNaoSeguidores, 0)} nota="parte do alcance que é descoberta" />
      </div>
      <section className="ic-card">
        <div className="ic-cab"><div><h3>Jornada orgânica até a venda</h3><p className="ic-sub">Do alcance à venda, em etapas. As primeiras vêm do Instagram; leads e vendas vêm do CRM.</p></div></div>
        <ol className="ic-pauta">
          {etapas.map(e => (
            <li key={e.nome}>
              <div><div className="ic-pauta-q">{e.nome}<b style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{e.valor}</b></div>{e.nota && <div className="ic-pauta-r">{e.nota}</div>}</div>
            </li>
          ))}
        </ol>
        {s.qualidade && <p className="ic-legenda" style={{ marginTop: 10 }}>Qualidade dos dados: {s.qualidade}.</p>}
      </section>
    </>
  )
}

export function Aquisicao({ d }: { d: IntelCentral }) {
  return (
    <>
      <section className="ic-card">
        <div className="ic-cab"><div><h2>Tráfego pago</h2><p className="ic-sub">{d.trafego?.conta ? `Conta ${d.trafego.conta}. ` : ''}Investimento, entrega, qualidade dos leads e quanto custa cada venda.</p></div></div>
        {!d.trafego ? <p className="ic-legenda">Seu acesso não inclui os números de Tráfego.</p>
          : !d.trafego.conectado ? <div className="ic-aviso"><b>Conta de anúncios não conectada</b>Conecte na aba Tráfego para a Central ler investimento, entrega e campanhas. Enquanto isso, o investimento vem do gasto digitado em Indicadores (se houver).</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><Trafego t={d.trafego} d={d} /></div>}
      </section>
      <section className="ic-card">
        <div className="ic-cab"><div><h2>Social Media</h2><p className="ic-sub">{d.social?.conta ? `@${d.social.conta}. ` : ''}Produção, distribuição, interesse e conversão do orgânico.</p></div></div>
        {!d.social ? <p className="ic-legenda">Sem dados de Social Media.</p>
          : !d.social.conectado ? <div className="ic-aviso"><b>Instagram não conectado</b>{d.social.erro ?? 'Conecte o Instagram da empresa na aba Social Media.'}</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><Social s={d.social} /></div>}
      </section>
    </>
  )
}
