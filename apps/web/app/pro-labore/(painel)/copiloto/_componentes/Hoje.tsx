'use client'

import Link from 'next/link'
import { useState } from 'react'
import { proLaboreApi, type CpAcao, type CpHoje, type CpStatusAcao } from '@/lib/proLaboreApi'
import type { AbaCopiloto } from '../page'
import { RESULTADO_ACAO, TIPO_ACAO, ddmm, horas, num, pct } from './rotulos'

function Anel({ valor }: { valor: number }) {
  const r = 46, c = 2 * Math.PI * r
  return (
    <div className="cp-anel" role="img" aria-label={`Índice de execução ${valor} de 100`}>
      <svg viewBox="0 0 108 108" aria-hidden="true">
        <circle className="trilho" cx="54" cy="54" r={r} />
        <circle className="valor" cx="54" cy="54" r={r} strokeDasharray={`${(Math.max(0, Math.min(100, valor)) / 100) * c} ${c}`} />
      </svg>
      <div className="cp-anel-num"><b>{valor}</b><span>índice do dia</span></div>
    </div>
  )
}

export function Hoje({ dados, pessoa, escrevendo, onDados, irPara, abrirPessoa, atualizarPessoas }: {
  dados: CpHoje
  pessoa?: string
  escrevendo: boolean
  onDados: (d: CpHoje) => void
  irPara: (a: AbaCopiloto, conversaId?: string) => void
  abrirPessoa: (id: string) => void
  atualizarPessoas: () => void
}) {
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState('')
  const [acoes, setAcoes] = useState<{ base: CpAcao[]; itens: CpAcao[] } | null>(null)
  const [feedback, setFeedback] = useState<{ util: boolean | null; texto: string; enviado: boolean }>({ util: dados.util, texto: '', enviado: false })
  const lista = acoes && acoes.base === dados.acoes ? acoes.itens : dados.acoes
  const r = dados.relatorio
  const f = dados.fatos
  const ro = dados.somenteLeitura
  const equipe = f.pessoa.tipo === 'EQUIPE'

  async function atualizar() {
    setAtualizando(true); setErro('')
    try { onDados(await proLaboreApi.copiloto.atualizar(pessoa)); atualizarPessoas() } catch (e) { setErro((e as Error).message) } finally { setAtualizando(false) }
  }
  async function marcar(a: CpAcao, status: CpStatusAcao) {
    try {
      const nova = await proLaboreApi.copiloto.acao(a.id, status)
      setAcoes({ base: dados.acoes, itens: lista.map(x => (x.id === a.id ? nova : x)) })
    } catch (e) { setErro((e as Error).message) }
  }
  async function avaliar(util: boolean) {
    setFeedback(x => ({ ...x, util }))
    await proLaboreApi.copiloto.feedback(util, feedback.texto || undefined).catch(() => undefined)
    if (feedback.texto) setFeedback(x => ({ ...x, enviado: true }))
  }

  const feitas = lista.filter(a => a.status === 'FEITA').length
  const ultimos = dados.indices.slice(-14)
  const mov = f.movimentos.semana
  const movidos = (mov.ABORDADO ?? 0) + (mov.NEGOCIACAO ?? 0) + (mov.PROPOSTA ?? 0) + (mov.FECHADO ?? 0)

  return (
    <>
      <section className="cp-card" aria-label="Resumo do dia">
        <div className="cp-hero">
          <Anel valor={dados.indice} />
          <div className="cp-hero-texto">
            <p>{r.resumo}</p>
            <div className="cp-hero-meta">
              {escrevendo ? <span className="cp-escrevendo">A IA está escrevendo a análise de hoje…</span>
                : dados.origem === 'IA' ? <span className="cp-selo ia">Análise escrita pela IA sobre os seus números</span>
                  : <span className="cp-selo">Análise pelas regras do sistema{dados.iaLigada ? '' : ' (IA desligada)'}</span>}
              <span className="cp-legenda">Atualizado às {new Date(dados.geradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              {!ro && <button type="button" className="pl-btn pl-btn-ghost" onClick={atualizar} disabled={atualizando || escrevendo}>{atualizando ? 'Lendo de novo…' : 'Atualizar análise'}</button>}
            </div>
            {ultimos.length > 1 && (
              <div title="Índice dos últimos dias">
                <div className="cp-barrinhas" aria-hidden="true">
                  {ultimos.map((d, i) => <i key={d.dia} className={i === ultimos.length - 1 ? 'hoje' : ''} style={{ height: `${Math.max(8, d.indice ?? 0)}%` }} title={`${ddmm(d.dia)}: ${d.indice ?? '—'}`} />)}
                </div>
                <span className="cp-legenda">Índice dos últimos {ultimos.length} dias · o índice soma resposta no WhatsApp, leads abordados, carteira sem parados, agenda e avanços</span>
              </div>
            )}
          </div>
        </div>
        {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }}>{erro}</div>}
      </section>

      <section className="cp-card" aria-label="Plano de hoje">
        <div className="cp-card-cab">
          <div><h2>Plano de hoje</h2><p className="cp-sub">Na ordem de impacto. {feitas} de {lista.length} feitas. O que o CRM comprovar amanhã (lead que avançou, conversa respondida) entra como feito sozinho.</p></div>
        </div>
        {lista.length === 0 ? <p className="cp-legenda">Nada urgente hoje. Use o tempo para prospectar e estudar.</p> : (
          <ol className="cp-plano">
            {lista.map(a => (
              <li key={a.id} className={a.status === 'FEITA' ? 'feita' : a.status === 'IGNORADA' ? 'ignorada' : ''}>
                <button type="button" className={`cp-check ${a.status === 'FEITA' ? 'on' : ''}`} disabled={ro} onClick={() => marcar(a, a.status === 'FEITA' ? 'PENDENTE' : 'FEITA')} aria-label={a.status === 'FEITA' ? `Desmarcar: ${a.texto}` : `Marcar como feita: ${a.texto}`} aria-pressed={a.status === 'FEITA'}>✓</button>
                <div>
                  <div className="cp-acao-tipo">{TIPO_ACAO[a.tipo] ?? a.tipo}{a.resultado ? ` · ${RESULTADO_ACAO[a.resultado] ?? a.resultado}` : ''}</div>
                  <div className="cp-acao-texto">{a.texto}</div>
                  <div className="cp-acao-porque">{a.porque}</div>
                </div>
                <div className="cp-acao-botoes">
                  {a.refTipo === 'CONVERSA' && a.refId && <button type="button" className="cp-link" onClick={() => irPara('conversas', a.refId!)}>Abrir e sugerir resposta</button>}
                  {a.refTipo === 'LEAD' && <Link className="cp-link" href="/pro-labore/leads">Abrir o CRM</Link>}
                  {a.refTipo === 'AGENDA' && <Link className="cp-link" href="/pro-labore/agenda">Abrir a agenda</Link>}
                  {a.refTipo === 'VENDEDOR' && a.refId && <button type="button" className="cp-link" onClick={() => abrirPessoa(a.refId!)}>Ver o copiloto dele</button>}
                  {a.tipo === 'ESTUDO' && <button type="button" className="cp-link" onClick={() => irPara('estudar')}>Abrir a trilha</button>}
                  {!ro && a.status === 'PENDENTE' && <button type="button" className="cp-link mudo" onClick={() => marcar(a, 'IGNORADA')}>Dispensar</button>}
                  {!ro && a.status === 'IGNORADA' && <button type="button" className="cp-link mudo" onClick={() => marcar(a, 'PENDENTE')}>Voltar</button>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="cp-grade-3">
        <section className="cp-card cp-col bom" aria-label="Indo bem">
          <h3><span className="cp-selo ok">Indo bem</span></h3>
          {r.indoBem.length ? <ul className="cp-lista">{r.indoBem.map(t => <li key={t}>{t}</li>)}</ul> : <p className="cp-legenda">Ainda sem um destaque medido nesta semana. Os pontos fortes aparecem quando os números mostram.</p>}
        </section>
        <section className="cp-card cp-col atencao" aria-label="Pontos de atenção">
          <h3><span className="cp-selo atencao">Onde melhorar</span></h3>
          {r.atencao.length ? <ul className="cp-lista">{r.atencao.map(t => <li key={t}>{t}</li>)}</ul> : <p className="cp-legenda">Nenhum ponto de atenção nos números de hoje.</p>}
        </section>
        <section className="cp-card cp-col erro" aria-label="Corrigir já">
          <h3><span className="cp-selo erro">Corrigir já</span></h3>
          {r.erros.length ? <ul className="cp-lista">{r.erros.map(t => <li key={t}>{t}</li>)}</ul> : <p className="cp-legenda">Nenhum erro urgente. Bom sinal.</p>}
        </section>
      </div>

      <div className="cp-grade">
        <section className="cp-card cp-dica" aria-label="Técnica do dia">
          <span className="cp-acao-tipo">Técnica do dia</span>
          <h2 style={{ marginTop: 4 }}>{r.dica.titulo}</h2>
          <p className="cp-sub" style={{ color: 'var(--pl-ink-2)' }}>{r.dica.tecnica}</p>
          <div className="cp-exemplo">“{r.dica.exemplo}”</div>
          <div style={{ marginTop: 8 }}><button type="button" className="cp-link" onClick={() => navigator.clipboard?.writeText(r.dica.exemplo).catch(() => undefined)}>Copiar a frase</button></div>
        </section>
        <section className="cp-card" aria-label="Estudo de hoje">
          <span className="cp-acao-tipo">Estudo de hoje · {dados.perfil.minutosEstudoDia} min</span>
          <h2 style={{ marginTop: 4 }}>{dados.foco.nome}</h2>
          <p className="cp-sub" style={{ color: 'var(--pl-ink-2)' }}>{r.estudoPorque}</p>
          <p className="cp-sub">{dados.foco.descricao}</p>
          <div style={{ marginTop: 10 }}><button type="button" className="pl-btn pl-btn-primary" onClick={() => irPara('estudar')}>Ver o material</button></div>
          <p className="cp-legenda" style={{ marginTop: 12 }}><b>Para pensar:</b> {r.reflexao}</p>
        </section>
      </div>

      <section className="cp-card" aria-label="Números de hoje">
        <div className="cp-card-cab"><div><h2>Os números por trás da análise</h2><p className="cp-sub">Tudo medido no sistema. Leads em aberto e parados: agora; avanços e entradas: últimos 7 dias.</p></div></div>
        <div className="cp-kpis">
          <div className="cp-kpi"><span>Leads em aberto</span><b>{num(f.carteira.total)}</b><small>{num(f.carteira.NEGOCIACAO)} em negociação · {num(f.carteira.PROPOSTA)} com proposta</small></div>
          <div className="cp-kpi"><span>Leads parados</span><b>{num(f.parados.total)}</b><small>{num(f.parados.semAbordar)} novos sem abordagem</small></div>
          <div className="cp-kpi"><span>Leads novos (7 dias)</span><b>{num(f.leadsNovos.semana)}</b><small>{num(f.leadsNovos.semanaAnterior)} nos 7 dias anteriores</small></div>
          <div className="cp-kpi"><span>Avanços de estágio (7 dias)</span><b>{num(movidos)}</b><small>{num(mov.FECHADO ?? 0)} fechados · {num(mov.PERDIDO ?? 0)} perdidos</small></div>
          <div className="cp-kpi"><span>Tempo até a 1ª abordagem</span><b>{horas(f.tempoAbordagemHoras)}</b><small>{f.tempoAbordagemEquipeHoras != null ? `equipe: ${horas(f.tempoAbordagemEquipeHoras)}` : 'mediana de 30 dias'}</small></div>
          <div className="cp-kpi"><span>Lead novo → abordado</span><b>{pct(f.conversao.leadParaAbordado)}</b><small>{f.conversaoEquipe ? `equipe: ${pct(f.conversaoEquipe.leadParaAbordado)}` : `${num(f.conversao.base)} leads em 60 dias`}</small></div>
          <div className="cp-kpi"><span>Proposta → venda</span><b>{pct(f.conversao.propostaParaFechado)}</b><small>{f.conversaoEquipe ? `equipe: ${pct(f.conversaoEquipe.propostaParaFechado)}` : 'leads de 60 dias'}</small></div>
          <div className="cp-kpi"><span>Agenda (7 dias)</span><b>{pct(f.agenda.percentual)}</b><small>{num(f.agenda.concluidas7d)} de {num(f.agenda.previstas7d)} tarefas</small></div>
          <div className="cp-kpi"><span>Vendas no mês</span><b>{num(f.vendas.mes)}</b><small>{f.vendas.percentualMeta != null ? `${pct(f.vendas.percentualMeta)} da meta · ${pct(f.vendas.percentualMesDecorrido)} do mês` : `${num(f.vendas.mesAnteriorMesmoDia)} no mesmo ponto do mês passado`}</small></div>
          {f.whatsapp.conectado && <div className="cp-kpi"><span>WhatsApp esperando você</span><b>{num(f.whatsapp.esperandoAgora + f.whatsapp.semResposta)}</b><small>{f.whatsapp.tempoAssumirMinutos != null ? `assume em ${f.whatsapp.tempoAssumirMinutos < 1 ? 'menos de 1' : num(f.whatsapp.tempoAssumirMinutos)} min (mediana)` : 'conversas de lead'}</small></div>}
        </div>
        <details className="cp-fatos" style={{ marginTop: 14 }}>
          <summary>Ver os achados medidos (fatos que sustentam a análise)</summary>
          <ul className="cp-lista">{dados.achados.map(a => <li key={a.id}><b>{a.tipo === 'FORTE' ? 'Ponto forte' : a.tipo === 'ERRO' ? 'Corrigir' : 'Atenção'}:</b> {a.texto}</li>)}</ul>
        </details>
      </section>

      {equipe && f.equipe && f.equipe.length > 0 && (
        <section className="cp-card" aria-label="Equipe">
          <div className="cp-card-cab"><div><h2>A equipe hoje</h2><p className="cp-sub">Do menor para o maior índice: quem precisa de você primeiro. Clique no nome para abrir o copiloto da pessoa.</p></div></div>
          <div className="cp-tabela-rola">
            <table className="cp-tabela">
              <thead><tr><th>Pessoa</th><th className="num">Índice</th><th className="num">Em aberto</th><th className="num">Parados</th><th className="num">Sem abordar</th><th className="num">Novos 7d</th><th className="num">Avanços 7d</th><th className="num">Novo → abordado</th><th className="num">1ª abordagem</th><th className="num">Agenda</th><th className="num">WhatsApp esperando</th></tr></thead>
              <tbody>
                {[...f.equipe].sort((a, b) => a.indice - b.indice).map(l => (
                  <tr key={l.vendedorId}>
                    <td><button type="button" className="cp-link" onClick={() => abrirPessoa(l.vendedorId)}>{l.nome}</button></td>
                    <td className="num">{l.indice}</td><td className="num">{l.carteira}</td><td className="num">{l.parados}</td><td className="num">{l.semAbordar}</td><td className="num">{l.novos7d}</td>
                    <td className="num">{l.movimentos7d}</td><td className="num">{pct(l.conversaoLeadAbordado)}</td><td className="num">{horas(l.tempoAbordagemHoras)}</td><td className="num">{pct(l.agendaPct)}</td><td className="num">{l.esperandoWhatsapp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {r.hipoteses.length > 0 && (
        <section className="cp-card" aria-label="Leituras do copiloto">
          <h3>Leituras do copiloto <span className="cp-selo atencao" style={{ marginLeft: 6 }}>Hipótese</span></h3>
          <ul className="cp-lista" style={{ marginTop: 10 }}>{r.hipoteses.map(h => <li key={h}>{h}</li>)}</ul>
          <p className="cp-legenda" style={{ marginTop: 8 }}>São leituras, não fatos. Se alguma não fizer sentido, apague na Memória.</p>
        </section>
      )}

      {dados.minha && !ro && (
        <section className="cp-card" aria-label="Avaliar a análise">
          <div className="cp-feedback">
            <span className="cp-sub" style={{ margin: 0 }}>Esta análise te ajudou hoje?</span>
            <button type="button" className={`pl-chip ${feedback.util === true ? 'active' : ''}`} onClick={() => avaliar(true)} aria-pressed={feedback.util === true}>Ajudou</button>
            <button type="button" className={`pl-chip ${feedback.util === false ? 'active' : ''}`} onClick={() => avaliar(false)} aria-pressed={feedback.util === false}>Não ajudou</button>
          </div>
          {feedback.util != null && !feedback.enviado && (
            <div className="cp-chat-form" style={{ marginTop: 10 }}>
              <textarea className="pl-input" placeholder="Conte ao copiloto o que mudar (ele lembra disso nas próximas análises)" value={feedback.texto} onChange={e => setFeedback(x => ({ ...x, texto: e.target.value }))} maxLength={500} />
              <button type="button" className="pl-btn pl-btn-ghost" disabled={!feedback.texto.trim()} onClick={() => avaliar(feedback.util!)}>Enviar</button>
            </div>
          )}
          {feedback.enviado && <p className="cp-legenda" style={{ marginTop: 8 }}>Anotado. O copiloto leva isso em conta a partir de amanhã.</p>}
        </section>
      )}
    </>
  )
}
