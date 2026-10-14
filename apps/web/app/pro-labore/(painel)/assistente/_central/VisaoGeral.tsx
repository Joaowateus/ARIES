'use client'

// Bloco 1 — Resumo executivo: onde a operação está frente à meta, o que mais
// ameaça o mês, de onde vem cada número e o que está em andamento.
import { useState } from 'react'
import { proLaboreApi, type IntelCentral, type IntelFonte, type IntelLeitura } from '@/lib/proLaboreApi'
import type { AbaCentral } from './Central'
import { LeadsPorDia, VendasAcumuladas } from './Graficos'
import { DEPARTAMENTO, SEVERIDADE, STATUS_ACAO, brl, dataBR, dataHoraBR, num, pct, periodoDoMes } from './fmt'

const STATUS_FONTE: Record<IntelFonte['status'], string> = { OK: 'Em dia', ATRASADO: 'Atrasada', ERRO: 'Com erro', SEM_CONEXAO: 'Sem conexão', MANUAL: 'Manual', SEM_DADOS: 'Sem dados' }

function Kpi({ rotulo, valor, nota, destaque, projecao, medidor }: { rotulo: string; valor: string; nota?: React.ReactNode; destaque?: boolean; projecao?: boolean; medidor?: { pct: number | null; marca?: number | null } }) {
  return (
    <div className={`ic-kpi${destaque ? ' destaque' : ''}`}>
      <span>{rotulo}</span>
      <b>{valor}</b>
      {medidor && medidor.pct != null && (
        <div className="ic-medidor" role="img" aria-label={`${Math.round(medidor.pct * 100)}% atingido${medidor.marca != null ? `, ${Math.round(medidor.marca * 100)}% do mês decorrido` : ''}`}>
          <span style={{ width: `${Math.min(100, Math.max(0, medidor.pct * 100))}%` }} />
          {medidor.marca != null && <i style={{ left: `${Math.min(100, medidor.marca * 100)}%` }} />}
        </div>
      )}
      {nota && <small>{nota}</small>}
      {projecao && <span className="ic-tag projecao sem">Projeção</span>}
    </div>
  )
}

export function VisaoGeral({ d, mes, irPara }: { d: IntelCentral; mes: string; irPara: (a: AbaCentral) => void }) {
  const [leitura, setLeitura] = useState<{ mes: string; l: IntelLeitura } | null>(null)
  const [lendo, setLendo] = useState(false)
  const [erroLeitura, setErroLeitura] = useState('')
  const r = d.resumo, m = d.metas
  const decorrido = m.calendario.total ? m.calendario.decorridos / m.calendario.total : null
  const metaConvTotal = d.funil.metasConversao.reduce((a, b) => a * b, 1)
  const leituraAtual = leitura?.mes === mes ? leitura.l : null
  const prioridades = d.diagnosticos.slice(0, 3)

  async function ler() {
    setLendo(true); setErroLeitura('')
    try {
      const { inicio, fim } = periodoDoMes(mes)
      setLeitura({ mes, l: await proLaboreApi.intel.leitura(inicio, fim) })
    } catch (e) { setErroLeitura((e as Error).message) } finally { setLendo(false) }
  }

  return (
    <>
      <section className="ic-card">
        <div className="ic-cab">
          <div>
            <h2>Leitura executiva</h2>
            <p className="ic-sub">A IA só interpreta os números já calculados abaixo: cada número que ela escreve é conferido com os dados e ela nunca recebe valores em reais. Se algo não bater, vale a leitura montada pelas regras.</p>
          </div>
          <button type="button" className="pl-btn pl-btn-primary ic-btn-p" onClick={ler} disabled={lendo}>{lendo ? 'Lendo os números…' : leituraAtual ? 'Gerar de novo' : 'Gerar leitura do dia'}</button>
        </div>
        {erroLeitura && <div className="pl-alert pl-alert-error">{erroLeitura}</div>}
        {leituraAtual ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className={`ic-tag ${leituraAtual.origem === 'IA' ? 'ia' : 'sem'}`} style={{ alignSelf: 'flex-start' }}>{leituraAtual.origem === 'IA' ? 'Escrita pela IA e conferida' : 'Montada pelas regras'}</span>
            <p className="ic-bloco-texto" style={{ fontSize: 14.5 }}>{leituraAtual.resumo}</p>
            <div className="ic-grade">
              {leituraAtual.prioridades.length > 0 && <div><h3 style={{ marginBottom: 8 }}>Prioridades</h3><ol className="ic-lista" style={{ paddingLeft: 18, listStyle: 'decimal' }}>{leituraAtual.prioridades.map(p => <li key={p}>{p}</li>)}</ol></div>}
              {leituraAtual.perguntas.length > 0 && <div><h3 style={{ marginBottom: 8 }}>Perguntas para a reunião</h3><ul className="ic-pontos">{leituraAtual.perguntas.map(p => <li key={p}>{p}</li>)}</ul></div>}
            </div>
          </div>
        ) : <p className="ic-legenda">Clique para gerar a leitura do mês selecionado.</p>}
      </section>

      <div className="ic-kpis">
        <Kpi rotulo="Faturamento do mês" valor={brl(r.faturamento.realizado)} destaque
          medidor={{ pct: r.faturamento.atingimento, marca: decorrido }}
          nota={<>{pct(r.faturamento.atingimento)} da meta de {brl(r.faturamento.meta)} · faltam {brl(r.faturamento.falta)}. Faturamento não é lucro.</>} />
        <Kpi rotulo="Vendas" valor={`${r.vendas.realizado} de ${num(r.vendas.meta)}`}
          medidor={{ pct: r.vendas.meta ? r.vendas.realizado / r.vendas.meta : null, marca: decorrido }}
          nota={<>faltam {num(r.vendas.falta)} · ticket real {brl(r.vendas.ticketReal)}</>} />
        <Kpi rotulo="Projeção do mês (base)" valor={m.projecao.suficiente ? `${num(m.projecao.base)} vendas` : '—'} projecao
          nota={m.projecao.suficiente ? <>entre {num(m.projecao.conservador)} (conservador) e {num(m.projecao.otimista)} (otimista)</> : m.projecao.motivo} />
        <Kpi rotulo="Ritmo necessário" valor={m.ritmoVendas.porDia != null ? `${num(m.ritmoVendas.porDia, 1)} vendas/dia útil` : '—'}
          nota={<>{m.calendario.restantes} de {m.calendario.total} dias úteis restantes · {brl(m.ritmoFaturamento.porDia)} por dia</>} />
        <Kpi rotulo="Leads no mês (CRM)" valor={num(r.leadsMes)}
          nota={<>necessários: {num(m.leadsNecessarios.comConversaoAtual)} na conversão atual · {num(m.leadsNecessarios.comMetas)} nas metas</>} />
        <Kpi rotulo="Conversão lead → venda" valor={pct(r.conversaoTotalRef, 2)}
          nota={<>coorte de referência · meta {pct(metaConvTotal, 2)}</>} />
        {d.acesso.verInvestimento && r.investimento && (
          <Kpi rotulo="Investimento em marketing" valor={brl(r.investimento.realizado)}
            medidor={{ pct: r.investimento.orcamento ? (r.investimento.realizado ?? 0) / r.investimento.orcamento : null, marca: decorrido }}
            nota={<>de {brl(r.investimento.orcamento)} · proporcional ao dia: {brl(r.investimento.proporcional)} · {r.investimento.fonte ?? 'sem fonte'}</>} />
        )}
        {d.acesso.verInvestimento && (
          <Kpi rotulo="CPL do mês (CRM)" valor={brl(r.cplMes)}
            nota={<>máximo para a meta: {brl(m.cplMaximo?.comConversaoAtual ?? m.cplMaximo?.comMetas)}{m.cplMaximo?.comConversaoAtual == null ? ' (nas metas)' : ' (conversão atual)'}</>} />
        )}
        {d.acesso.verInvestimento && (
          <Kpi rotulo="Custo de marketing por venda" valor={brl(r.custoMarketingPorVenda)} nota={<>teto: {brl(m.custoMaximoPorVenda)} (orçamento ÷ meta de vendas)</>} />
        )}
        <Kpi rotulo="Maior gargalo" valor={d.funil.gargalo?.passagem ?? '—'}
          nota={d.funil.gargalo ? <>+{num(d.funil.gargalo.vendasPerdidas)} vendas se esta etapa batesse a meta (coorte de referência)</> : 'Sem amostra suficiente na coorte de referência'} />
      </div>

      <div className="ic-grade">
        <VendasAcumuladas d={d} />
        <LeadsPorDia d={d} />
      </div>

      <div className="ic-grade">
        <section className="ic-card">
          <div className="ic-cab">
            <div><h2>Prioridades agora</h2><p className="ic-sub">Os 3 desvios mais graves pelos critérios das Premissas.</p></div>
            <button type="button" className="pl-btn pl-btn-ghost ic-btn-p" onClick={() => irPara('plano')}>Diagnóstico e plano →</button>
          </div>
          {prioridades.length === 0 ? <p className="ic-legenda">Nenhum desvio acima dos critérios.</p> : (
            <ol className="ic-lista">
              {prioridades.map(x => (
                <li key={x.chave} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}><span className={`ic-tag ${SEVERIDADE[x.severidade].classe}`}>{SEVERIDADE[x.severidade].rotulo}</span><span className="ic-legenda">{DEPARTAMENTO[x.departamento]}</span></span>
                  <b style={{ fontWeight: 600 }}>{x.problema}</b>
                  <span className="ic-legenda">{x.acao}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="ic-card">
          <div className="ic-cab">
            <div><h2>Plano de ação</h2><p className="ic-sub">{d.acoesResumo.abertas} em aberto · {d.acoesResumo.atrasadas} atrasada{d.acoesResumo.atrasadas === 1 ? '' : 's'} · {d.acoesResumo.concluidas} validada{d.acoesResumo.concluidas === 1 ? '' : 's'}</p></div>
            <button type="button" className="pl-btn pl-btn-ghost ic-btn-p" onClick={() => irPara('plano')}>Abrir plano →</button>
          </div>
          {d.acoesResumo.proximas.length === 0 ? <p className="ic-legenda">Nenhuma ação em aberto. Crie a partir de um diagnóstico.</p> : (
            <div>
              {d.acoesResumo.proximas.slice(0, 5).map(a => (
                <div key={a.id} className="ic-linha">
                  <span>{a.titulo}<small>{STATUS_ACAO[a.status]} · {a.responsavelNome ?? 'sem responsável'}</small></span>
                  <b style={{ color: a.prazo && new Date(a.prazo) < new Date() ? 'var(--pl-critical)' : undefined }}>{dataBR(a.prazo)}</b>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="ic-card">
        <div className="ic-cab"><div><h2>De onde vêm os números</h2><p className="ic-sub">Status de cada fonte. &quot;Ao vivo&quot; é o que está no sistema agora; &quot;validado&quot; é o último fechamento diário confirmado na aba.</p></div></div>
        <div className="ic-fontes">
          {d.fontes.map(f => (
            <div key={f.modulo} className="ic-fonte">
              <div className="ic-fonte-cab"><b>{f.nome}</b><span className={`ic-tag ${f.status}`}>{STATUS_FONTE[f.status]}</span></div>
              <small>{f.detalhe}{f.ultimaAtualizacao ? ` Atualizado em ${dataHoraBR(f.ultimaAtualizacao)}.` : ''}</small>
              {f.modulo !== 'GASTO_MANUAL' && <small>{f.fechamento ? <>Validado: versão {f.fechamento.versao} de {dataBR(`${f.fechamento.dia}T12:00:00Z`)}, por {f.fechamento.geradoPorNome}</> : 'Sem fechamento confirmado ainda — os números são ao vivo.'}</small>}
            </div>
          ))}
        </div>
      </section>

      {d.inconsistencias.length > 0 && (
        <section className="ic-card">
          <div className="ic-cab"><div><h2>Inconsistências entre fontes</h2><p className="ic-sub">A Central não esconde divergências: mostra e diz como validar.</p></div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.inconsistencias.map(i => <div key={i.titulo} className="ic-aviso"><b>{i.titulo}</b>{i.detalhe}<div className="ic-legenda" style={{ marginTop: 4 }}>Como validar: {i.validar}</div></div>)}
          </div>
        </section>
      )}
    </>
  )
}
