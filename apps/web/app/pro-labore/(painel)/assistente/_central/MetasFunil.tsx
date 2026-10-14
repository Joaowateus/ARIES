'use client'

// Blocos 2, 3 e 4 — Metas e projeção, funil integrado (as três leituras da
// Jornada, nunca misturadas) e custos do funil. Cada número com a fórmula.
import { useState } from 'react'
import type { IntelCentral, IntelEtapa } from '@/lib/proLaboreApi'
import { ETAPAS, NOME_ETAPA, PASSAGENS, brl, dataBR, num, pct, pp } from './fmt'

type Leitura = 'oficial' | 'avanco' | 'coorte'
const LEITURAS: Array<{ valor: Leitura; rotulo: string }> = [
  { valor: 'oficial', rotulo: 'Mês do Dashboard (oficial)' },
  { valor: 'avanco', rotulo: 'Por data de avanço' },
  { valor: 'coorte', rotulo: 'Coorte de referência' },
]

function Linha({ rotulo, valor, nota }: { rotulo: string; valor: React.ReactNode; nota?: string }) {
  return <div className="ic-linha"><span>{rotulo}{nota && <small>{nota}</small>}</span><b>{valor}</b></div>
}

function Barras({ contagens }: { contagens: Record<IntelEtapa, number> }) {
  const max = Math.max(1, ...ETAPAS.map(e => contagens[e]))
  return (
    <div className="ic-funil">
      {ETAPAS.map(e => (
        <div key={e} className="ic-funil-etapa">
          <span>{NOME_ETAPA[e]}</span>
          <div className="ic-funil-trilho" aria-hidden="true"><span style={{ width: `${(contagens[e] / max) * 100}%` }} /></div>
          <b>{num(contagens[e])}</b>
        </div>
      ))}
    </div>
  )
}

export function MetasFunil({ d }: { d: IntelCentral }) {
  const [leitura, setLeitura] = useState<Leitura>('oficial')
  const m = d.metas, p = d.premissas, f = d.funil
  const metaPorVendedor = p.metaVendas != null && (p.vendedores.planejados ?? p.vendedores.cadastrados) > 0 ? p.metaVendas / (p.vendedores.planejados ?? p.vendedores.cadastrados) : null
  const ref = f.referencia

  const contagens = leitura === 'oficial' ? f.oficial.contagens : leitura === 'avanco' ? f.porAvanco.contagens : f.referencia.contagens
  const conversoes = leitura === 'oficial' ? f.oficial.conversoes : leitura === 'coorte' ? ref.conversoes : null
  const explicacao = {
    oficial: `Mesma regra do Dashboard: leads criados no mês, contados pela etapa em que estão hoje${f.oficial.fonte === 'MANUAL' ? ' (o Dashboard deste mês usa números digitados à mão)' : ''}. Atenção: o Fechamento conta todas as vendas do mês, inclusive de leads de meses anteriores.`,
    avanco: 'Quantos leads chegaram a cada etapa dentro do período, pela data em que chegaram — mede o trabalho feito no mês, venha o lead de quando vier.',
    coorte: `Leads criados entre ${dataBR(`${ref.periodo.inicio}T12:00:00Z`)} e ${dataBR(`${ref.periodo.fim}T12:00:00Z`)} (de 90 a 7 dias atrás), pela etapa mais avançada que alcançaram. É a base das conversões, das projeções e dos diagnósticos.`,
  }[leitura]

  return (
    <>
      <div className="ic-grade">
        <section className="ic-card">
          <div className="ic-cab"><div><h2>Metas do mês</h2><p className="ic-sub">Derivadas das Premissas. Mudou a premissa, muda tudo aqui.</p></div></div>
          <Linha rotulo="Meta de faturamento" valor={brl(p.metaFaturamentoMensal)} />
          <Linha rotulo="Ticket médio planejado" valor={brl(p.ticketMedio)} />
          <Linha rotulo="Meta de vendas" valor={num(p.metaVendas)} nota="arredondar para cima (faturamento ÷ ticket)" />
          <Linha rotulo="Vendedores" valor={`${p.vendedores.planejados ?? '—'} planejados · ${p.vendedores.cadastrados} ativos`} />
          <Linha rotulo="Meta por vendedor" valor={metaPorVendedor != null ? `${num(metaPorVendedor, 1)} vendas` : '—'} nota="meta de vendas ÷ vendedores planejados" />
          <Linha rotulo="Dias úteis" valor={`${m.calendario.decorridos} de ${m.calendario.total} · faltam ${m.calendario.restantes}`} nota="o dia de hoje conta como decorrido" />
          <Linha rotulo="Ritmo necessário" valor={m.ritmoVendas.porDia != null ? `${num(m.ritmoVendas.porDia, 2)} vendas/dia` : '—'} nota="vendas que faltam ÷ dias úteis restantes" />
          <Linha rotulo="Faturamento necessário por dia" valor={brl(m.ritmoFaturamento.porDia)} />
          <Linha rotulo="Propostas em aberto" valor={`${m.pipeline.propostasAbertas} → ${num(m.pipeline.vendasEsperadas, 1)} vendas esperadas`} nota={m.pipeline.formula} />
        </section>

        <section className="ic-card">
          <div className="ic-cab"><div><h2>Leads e custo máximo</h2><p className="ic-sub">Quanto a meta exige do topo do funil.</p></div></div>
          <Linha rotulo="Conversão total nas metas" valor={pct(f.metasConversao.reduce((a, b) => a * b, 1), 2)} nota={f.metasConversao.map(x => pct(x, 0)).join(' × ')} />
          <Linha rotulo="Conversão total atual (coorte)" valor={pct(ref.conversaoTotal, 2)} />
          <Linha rotulo="Leads necessários nas metas" valor={num(m.leadsNecessarios.comMetas)} nota="meta de vendas ÷ conversão total, para cima" />
          <Linha rotulo="Leads necessários na conversão atual" valor={num(m.leadsNecessarios.comConversaoAtual)} />
          <Linha rotulo="Leads gerados no mês" valor={`${m.leadsNecessarios.geradosNoMes}${m.leadsNecessarios.faltamComConversaoAtual != null ? ` · faltam ${num(m.leadsNecessarios.faltamComConversaoAtual)}` : ''}`} />
          {m.cplMaximo && <Linha rotulo="CPL máximo nas metas" valor={brl(m.cplMaximo.comMetas)} nota="orçamento ÷ leads necessários" />}
          {m.cplMaximo && <Linha rotulo="CPL máximo na conversão atual" valor={brl(m.cplMaximo.comConversaoAtual)} />}
          {d.acesso.verInvestimento && <Linha rotulo="Custo máximo de marketing por venda" valor={brl(m.custoMaximoPorVenda)} nota="orçamento ÷ meta de vendas" />}
        </section>
      </div>

      <section className="ic-card">
        <div className="ic-cab">
          <div><h2>Projeção do mês <span className="ic-tag projecao sem" style={{ marginLeft: 6, verticalAlign: 'middle' }}>Projeção</span></h2><p className="ic-sub">Estimativa pelo ritmo de vendas, não é resultado.</p></div>
        </div>
        {m.projecao.suficiente ? (
          <div className="ic-kpis">
            <div className="ic-kpi"><span>Conservador</span><b>{num(m.projecao.conservador)} vendas</b><small>{p.metaVendas ? `${pct((m.projecao.conservador ?? 0) / p.metaVendas, 0)} da meta` : ''}</small></div>
            <div className="ic-kpi destaque"><span>Base</span><b>{num(m.projecao.base)} vendas</b><small>{p.metaVendas ? `${pct((m.projecao.base ?? 0) / p.metaVendas, 0)} da meta` : ''} · {brl(d.resumo.faturamento.projecaoBase)}</small></div>
            <div className="ic-kpi"><span>Otimista</span><b>{num(m.projecao.otimista)} vendas</b><small>{p.metaVendas ? `${pct((m.projecao.otimista ?? 0) / p.metaVendas, 0)} da meta` : ''}</small></div>
            <div className="ic-kpi"><span>Ritmo</span><b>{num(m.projecao.ritmoMes, 2)}/dia</b><small>no mês · {num(m.projecao.ritmoRecente, 2)}/dia nos últimos 14 dias</small></div>
          </div>
        ) : <div className="ic-aviso"><b>Sem base para projetar</b>{m.projecao.motivo}</div>}
        <p className="ic-formula">{m.projecao.formula}</p>
      </section>

      <section className="ic-card">
        <div className="ic-cab"><div><h2>Cenários</h2><p className="ic-sub">O que cada conjunto de conversões exige para bater a meta de vendas. Simulação, não resultado.</p></div></div>
        <div className="ic-rola">
          <table className="ic-tabela" style={{ minWidth: 560 }}>
            <thead><tr><th></th>{d.cenarios.map(c => <th key={c.nome} className="num">{c.nome}</th>)}</tr></thead>
            <tbody>
              {PASSAGENS.map((ps, i) => <tr key={ps}><td>{ps}</td>{d.cenarios.map(c => <td key={c.nome} className="num">{pct(c.conversoes[i])}</td>)}</tr>)}
              <tr className="destaque"><td>Conversão total</td>{d.cenarios.map(c => <td key={c.nome} className="num">{pct(c.conversaoTotal, 2)}</td>)}</tr>
              <tr><td>Leads necessários</td>{d.cenarios.map(c => <td key={c.nome} className="num">{num(c.leadsNecessarios)}</td>)}</tr>
              {ETAPAS.slice(1).map(e => <tr key={e}><td className="fraco">{NOME_ETAPA[e]}</td>{d.cenarios.map(c => <td key={c.nome} className="num fraco">{num(c.volumes[e])}</td>)}</tr>)}
              {d.acesso.verInvestimento && <tr><td>CPL máximo</td>{d.cenarios.map(c => <td key={c.nome} className="num">{brl(c.cplMaximo)}</td>)}</tr>}
              {d.acesso.verInvestimento && <tr><td>Custo por venda</td>{d.cenarios.map(c => <td key={c.nome} className="num">{brl(c.custoPorVenda)}</td>)}</tr>}
              <tr><td>Faturamento projetado</td>{d.cenarios.map(c => <td key={c.nome} className="num">{brl(c.faturamentoProjetado)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="ic-card">
        <div className="ic-cab">
          <div><h2>Funil integrado</h2><p className="ic-sub">Três leituras da Jornada de compra. Cada uma responde a uma pergunta diferente; a Central nunca mistura as três.</p></div>
        </div>
        <div className="pl-sv-tabs" role="tablist" aria-label="Leitura do funil" style={{ marginBottom: 12 }}>
          {LEITURAS.map(l => <button key={l.valor} type="button" role="tab" aria-selected={leitura === l.valor} className={leitura === l.valor ? 'ativo' : ''} onClick={() => setLeitura(l.valor)}>{l.rotulo}</button>)}
        </div>
        <p className="ic-legenda" style={{ marginBottom: 12 }}>{explicacao}</p>
        <Barras contagens={contagens} />
        {(conversoes || leitura === 'coorte') && (
          <div className="ic-rola" style={{ marginTop: 14 }}>
            <table className="ic-tabela" style={{ minWidth: 640 }}>
              <thead><tr><th>Passagem</th><th className="num">Conversão</th><th className="num">Meta</th><th className="num">Desvio</th>{leitura === 'coorte' && <><th className="num">Tempo médio</th><th className="num">Perdidos</th><th className="num">+ vendas na meta</th></>}</tr></thead>
              <tbody>
                {PASSAGENS.map((ps, i) => {
                  const c = conversoes?.[i] ?? null
                  const meta = f.metasConversao[i]
                  const gargalo = f.gargalo?.indice === i && leitura === 'coorte'
                  return (
                    <tr key={ps} className={gargalo ? 'destaque' : ''}>
                      <td>{ps}{gargalo && <span className="ic-tag critico" style={{ marginLeft: 6 }}>gargalo</span>}</td>
                      <td className="num">{pct(c)}</td>
                      <td className="num">{pct(meta, 0)}</td>
                      <td className="num" style={{ color: c != null && c < meta ? 'var(--pl-critical)' : undefined }}>{pp(c, meta)}</td>
                      {leitura === 'coorte' && <>
                        <td className="num">{ref.tempoMedioDias[i] != null ? `${num(ref.tempoMedioDias[i], 1)} dias` : '—'}</td>
                        <td className="num">{num(ref.perdas[i]?.absoluta)} <span className="fraco">({pct(ref.perdas[i]?.taxa, 0)})</span></td>
                        <td className="num">{ref.impactoVendas[i] != null && ref.impactoVendas[i]! > 0 ? `+${num(ref.impactoVendas[i], 1)}` : '—'}</td>
                      </>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {leitura === 'oficial' && f.oficial.metasOficiais.length > 0 && (
          <p className="ic-legenda" style={{ marginTop: 10 }}>Metas do funil cadastradas no Dashboard: {f.oficial.metasOficiais.map(x => `${NOME_ETAPA[x.etapa as IntelEtapa] ?? x.etapa} ${x.tipoMeta === 'MAXIMO_CUSTO' ? `até ${brl(x.metaCusto)} por lead` : `${x.tipoMeta === 'MAXIMO_PERDA' ? 'perda máx. ' : ''}${pct(x.metaPct, 0)}`}`).join(' · ')}.</p>
        )}
        {f.gargalo && (
          <div className="ic-gargalo" style={{ marginTop: 14 }}>
            <b>Gargalo: {f.gargalo.passagem}.</b> Na coorte de referência, se esta passagem estivesse na meta, seriam <b>{num(f.gargalo.vendasPerdidas)} vendas a mais</b>{f.gargalo.faturamento != null ? <> (cerca de {brl(f.gargalo.faturamento)} de faturamento)</> : null}, mantidas as outras etapas.
            <div className="ic-formula">impacto = elegíveis × (meta − conversão atual) × conversões das etapas seguintes</div>
          </div>
        )}
        <p className="ic-legenda" style={{ marginTop: 10 }}>Os motivos de perda não são registrados no CRM hoje: a Central mostra quantos se perdem em cada etapa, não o porquê.</p>
      </section>

      {d.acesso.verInvestimento && f.custoAcumulado && (
        <section className="ic-card">
          <div className="ic-cab"><div><h2>Custos do funil</h2><p className="ic-sub">Investimento do mês dividido pelo volume de cada etapa (Mês do Dashboard). Quanto custa chegar a cada etapa.</p></div></div>
          <div className="ic-kpis">
            {ETAPAS.map(e => <div key={e} className="ic-kpi"><span>Custo por {e === 'FECHADO' ? 'venda' : NOME_ETAPA[e].toLowerCase()}</span><b>{brl(f.custoAcumulado![e])}</b><small>{num(f.oficial.contagens[e])} {e === 'FECHADO' ? 'vendas' : 'na etapa'}</small></div>)}
          </div>
          <p className="ic-formula">custo da etapa = investimento do mês ÷ quantidade que chegou à etapa</p>
        </section>
      )}
    </>
  )
}
