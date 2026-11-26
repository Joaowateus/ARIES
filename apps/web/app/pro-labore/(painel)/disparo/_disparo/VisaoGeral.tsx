'use client'

// Visão geral (redesign 26/11/2026): primeiro o que está acontecendo e o que precisa de atenção,
// depois o resultado do período (com a variação contra o período anterior e o funil numa barra só),
// os envios por dia, as campanhas em andamento com o progresso, as melhores taxas de resposta e a
// atividade. Tudo vem do servidor (as mesmas tabelas do Disparo); a tabela completa de comparação
// fica recolhida no fim.
import { useEffect, useMemo, useState } from 'react'
import { disparoApi, type VisaoGeralDisparo } from '@/lib/proLaboreApi'
import { SeloStatus, erroDe, n, pct, useEscopo, useMeta } from './util'
import { Quando, Segmentado, quandoTexto } from './ui'

const ROTULO_EVENTO: Record<string, string> = {
  RESPOSTA: 'Respondeu', DESCADASTRO: 'Pediu para sair', FALHA: 'Falha', STATUS_RUNNING: 'Começou a enviar', STATUS_COMPLETED: 'Concluída',
  STATUS_COMPLETED_WITH_ERRORS: 'Concluída com falhas', STATUS_CANCELLED: 'Cancelada', DECIDIR_REENVIO: 'Precisa de decisão',
}
const TOM_EVENTO: Record<string, string> = { RESPOSTA: 'ok', DESCADASTRO: 'warn', FALHA: 'crit', DECIDIR_REENVIO: 'warn', STATUS_COMPLETED_WITH_ERRORS: 'alert' }
type Comp = Awaited<ReturnType<typeof disparoApi.comparativo>>

/** Variação: % para quantidades, pontos percentuais para taxas. */
function Variacao({ atual, antes, taxa }: { atual: number | null; antes: number | null | undefined; taxa?: boolean }) {
  if (atual == null || antes == null) return <span className="dp-var neutra">sem comparação</span>
  if (taxa) {
    const d = Math.round((atual - antes) * 10) / 10
    if (Math.abs(d) < 0.1) return <span className="dp-var neutra">= período anterior</span>
    return <span className={`dp-var ${d > 0 ? 'sobe' : 'desce'}`}>{d > 0 ? '▲' : '▼'} {Math.abs(d).toLocaleString('pt-BR')} pp</span>
  }
  if (!antes) return atual ? <span className="dp-var neutra">sem envios antes</span> : <span className="dp-var neutra">—</span>
  const d = Math.round(((atual - antes) / antes) * 100)
  if (!d) return <span className="dp-var neutra">= período anterior</span>
  return <span className={`dp-var ${d > 0 ? 'sobe' : 'desce'}`}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}%</span>
}

function useAgora(ativo: boolean) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => { if (!ativo) return; const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t) }, [ativo])
  return agora
}

export function VisaoGeral({ abrir }: { abrir: (id: string) => void }) {
  const meta = useMeta()
  const { de } = useEscopo()
  const [dias, setDias] = useState(30)
  const [d, setD] = useState<VisaoGeralDisparo | null>(null)
  const [comp, setComp] = useState<Comp | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    const ler = () => Promise.all([disparoApi.visaoGeral(dias, de), disparoApi.comparativo(dias, de)]).then(([v, c]) => { if (vivo) { setD(v); setComp(c); setErro(null) } }).catch(e => vivo && setErro(erroDe(e)))
    void ler()
    // Atualiza sozinha a cada 30 s (o envio acontece enquanto a tela está aberta).
    const t = setInterval(() => void ler(), 30_000)
    return () => { vivo = false; clearInterval(t) }
  }, [dias, de])
  const agora = useAgora(!!d?.agora?.proximoEnvioEm)
  const ranking = useMemo(() => (comp ?? []).filter(c => c.aceitas > 0 && (c.taxaResposta ?? 0) > 0).sort((a, b) => (b.taxaResposta ?? 0) - (a.taxaResposta ?? 0)).slice(0, 5), [comp])
  if (erro) return <div className="pl-alert pl-alert-error" role="alert">{erro}</div>
  if (!d) return <EsqueletoVisao />
  const semNada = d.campanhas.criadas === 0
  const ag = d.agora ?? { enviando: 0, naFila: 0, pausadas: 0, proximoEnvioEm: null, intervaloSeg: null }
  const atencao = d.atencao ?? []
  // "Enviando" só conta campanha que está saindo de fato (a parada por número sem conexão vai para "Pedem atenção").
  const paradas = new Set(atencao.filter(a => a.motivo === 'SEM_CONEXAO').map(a => a.id))
  const enviando = (d.andamento ?? []).filter(c => c.status === 'RUNNING' && !paradas.has(c.id)).length
  const faltaS = ag.proximoEnvioEm ? Math.max(0, Math.round((new Date(ag.proximoEnvioEm).getTime() - agora) / 1000)) : null
  const funil = [
    { rotulo: 'Destinatários', v: d.destinatarios, t: null as number | null, titulo: 'Quem entrou nas campanhas no período' },
    { rotulo: 'Aceitas', v: d.aceitas, t: d.destinatarios ? (d.aceitas / d.destinatarios) * 100 : null, titulo: 'Aceitas pelo WhatsApp ou pelo Instagram (sobre os destinatários)' },
    { rotulo: 'Entregues', v: d.entregues, t: d.taxaEntrega, titulo: 'Chegaram ao aparelho (sobre as aceitas)' },
    { rotulo: 'Lidas', v: d.lidas, t: d.taxaLeitura, titulo: 'Lidas (sobre as aceitas). Quem desligou a confirmação de leitura nunca aparece como lida' },
    { rotulo: 'Respostas', v: d.respostas, t: d.taxaResposta, titulo: 'Responderam (sobre as aceitas)' },
  ]
  const maxFunil = Math.max(1, ...funil.map(f => f.v))
  const porDia = d.porDia ?? []
  const maxDia = Math.max(1, ...porDia.map(x => x.aceitas + x.falhas))
  const falhasPeriodo = porDia.reduce((a, x) => a + x.falhas, 0)
  return (
    <div className="dp-visao" data-disparo-visao>
      <div className="dp-visao-topo">
        <Segmentado rotulo="Período" valor={dias} mudar={setDias} opcoes={[{ valor: 7, rotulo: '7 dias' }, { valor: 30, rotulo: '30 dias' }, { valor: 90, rotulo: '90 dias' }]} />
        <span className="pl-hint">{n(d.campanhas.criadas)} campanha(s) no total · {n(d.campanhas.concluidas)} concluída(s) · {n(d.campanhas.rascunhos)} em preparação · atualiza a cada 30 s</span>
      </div>

      <section className="dp-faixa-agora" aria-label="Agora">
        <div className="dp-tile" data-tile="agora">
          <div className="dp-tile-rotulo">Agora {enviando > 0 && <span className="dp-selo ok vivo">enviando</span>}</div>
          <div className="dp-tile-valor">{enviando ? `${n(enviando)} ${enviando === 1 ? 'campanha' : 'campanhas'}` : 'Nada enviando'}</div>
          <div className="dp-tile-sub">{!enviando && paradas.size ? `${n(paradas.size)} parada(s) esperando a conexão voltar` : enviando && faltaS == null ? 'esperando a próxima vaga do número' : faltaS != null ? `próxima mensagem ${faltaS > 0 ? `em ${faltaS} s` : 'agora'}${ag.intervaloSeg ? ` · 1 a cada ${ag.intervaloSeg} s` : ''}` : ag.naFila || ag.pausadas ? `${ag.naFila ? `${n(ag.naFila)} na fila` : ''}${ag.naFila && ag.pausadas ? ' · ' : ''}${ag.pausadas ? `${n(ag.pausadas)} pausada(s)` : ''}` : 'nenhuma campanha em andamento'}</div>
        </div>
        <a href="#dp-atencao" className={`dp-tile ${atencao.length ? 'atencao' : ''}`} data-tile="atencao" onClick={e => { if (!atencao.length) e.preventDefault() }}>
          <div className="dp-tile-rotulo">Pedem atenção {atencao.length > 0 && <span className="dp-selo crit">{atencao.length}</span>}</div>
          <div className="dp-tile-valor">{atencao.length ? n(atencao.length) : 'Tudo certo'}</div>
          <div className="dp-tile-sub">{atencao.length ? atencao.slice(0, 2).map(a => a.titulo.toLowerCase()).join(' · ') : 'nenhuma campanha parada ou esperando decisão'}</div>
        </a>
        <div className="dp-tile" data-tile="agendadas">
          <div className="dp-tile-rotulo">Agendadas</div>
          <div className="dp-tile-valor">{n(d.campanhas.agendadas)}</div>
          <div className="dp-tile-sub">{d.proximaAgendada ? <>próxima <Quando iso={d.proximaAgendada.em} /> · {d.proximaAgendada.nome}</> : 'nada agendado'}</div>
        </div>
        {meta.gestao ? (
          <div className="dp-tile" data-tile="aprovacao">
            <div className="dp-tile-rotulo">Aguardando aprovação</div>
            <div className="dp-tile-valor">{n(d.aprovacao?.quantos ?? 0)}</div>
            <div className="dp-tile-sub">{d.aprovacao?.primeira ? <>{d.aprovacao.primeira.de ? `de ${d.aprovacao.primeira.de} · ` : ''}<Quando iso={d.aprovacao.primeira.desde} prefixo="desde" /></> : 'nada esperando você'}</div>
          </div>
        ) : (
          <div className="dp-tile" data-tile="preparacao">
            <div className="dp-tile-rotulo">Em preparação</div>
            <div className="dp-tile-valor">{n(d.campanhas.rascunhos)}</div>
            <div className="dp-tile-sub">rascunhos e campanhas prontas para começar</div>
          </div>
        )}
      </section>

      {atencao.length > 0 && (
        <section className="pl-card dp-painel-atencao" id="dp-atencao" aria-label="Pedem atenção">
          <div className="dp-ph"><b>Pedem atenção</b><span>o que está parado ou esperando uma decisão</span></div>
          <ul className="dp-lista">
            {atencao.map((a, i) => (
              <li key={`${a.id}-${a.motivo}-${i}`} className="dp-item problema">
                <div><div className="dp-item-titulo">{a.nome} <span className={`dp-selo ${a.motivo === 'SEM_CONEXAO' ? 'crit' : 'warn'}`}>{a.titulo}</span></div><div className="dp-item-sub">{a.texto}</div></div>
                <button type="button" className="pl-btn" onClick={() => abrir(a.id)}>Abrir</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {semNada ? (
        <section className="pl-card dp-vazio-grande">
          <h3>Nenhuma campanha ainda</h3>
          <p className="pl-hint">Crie a primeira em “+ Nova campanha”, ou comece por uma estratégia da Jornada do CRM.</p>
        </section>
      ) : (
        <>
          <div className="dp-hero">
            <section className="pl-card dp-resultado" aria-label="Resultado do período">
              <div className="dp-ph"><b>Resultado dos últimos {dias} dias</b><span>comparado aos {dias} dias anteriores</span></div>
              <div className="dp-kpis">
                <div className="dp-kpi"><span>Enviadas</span><b>{n(d.aceitas)}</b><Variacao atual={d.aceitas} antes={d.anterior?.aceitas} /></div>
                <div className="dp-kpi" title="Entregues ÷ aceitas"><span>Taxa de entrega</span><b>{pct(d.taxaEntrega)}</b><Variacao atual={d.taxaEntrega} antes={d.anterior?.taxaEntrega} taxa /></div>
                <div className="dp-kpi" title="Lidas ÷ aceitas"><span>Taxa de leitura</span><b>{pct(d.taxaLeitura)}</b><Variacao atual={d.taxaLeitura} antes={d.anterior?.taxaLeitura} taxa /></div>
                <div className="dp-kpi" title="Respostas ÷ aceitas"><span>Taxa de resposta</span><b>{pct(d.taxaResposta)}</b><Variacao atual={d.taxaResposta} antes={d.anterior?.taxaResposta} taxa /></div>
              </div>
              <div className="dp-funil" aria-label="Funil das mensagens">
                {funil.map(f => (
                  <div key={f.rotulo} className="dp-funil-linha" title={f.titulo}>
                    <span>{f.rotulo}</span>
                    <div className="dp-funil-trilha"><i style={{ width: `${(f.v / maxFunil) * 100}%` }} /></div>
                    <span className="dp-funil-valor">{n(f.v)}{f.t != null ? ` · ${pct(f.t)}` : ''}</span>
                  </div>
                ))}
              </div>
              <p className="dp-nota">Aceitas sobre os destinatários; entregues, lidas e respostas sobre as aceitas. Entregue e lida dependem do aparelho do cliente.</p>
            </section>
            <section className="pl-card dp-dias-painel" aria-label="Envios por dia">
              <div className="dp-ph"><b>Envios por dia</b><span>{falhasPeriodo ? <><i className="dp-leg falha" /> {n(falhasPeriodo)} falha(s)</> : 'sem falhas no período'}</span></div>
              <div className="dp-colunas" role="img" aria-label={`Envios por dia nos últimos ${dias} dias`}>
                {porDia.map((x, i) => {
                  const total = x.aceitas + x.falhas
                  return (
                    <div key={x.dia} className={`dp-col ${i === porDia.length - 1 ? 'hoje' : ''}`} title={`${x.dia.split('-').reverse().join('/')}: ${x.aceitas} enviada(s)${x.falhas ? `, ${x.falhas} falha(s)` : ''}`}>
                      <i style={{ height: `${(total / maxDia) * 100}%` }}>{x.falhas > 0 && <s style={{ height: `${(x.falhas / total) * 100}%` }} />}</i>
                    </div>
                  )
                })}
              </div>
              <div className="dp-eixo"><span>{porDia[0]?.dia.split('-').reverse().slice(0, 2).join('/')}</span><span>{porDia[Math.floor(porDia.length / 2)]?.dia.split('-').reverse().slice(0, 2).join('/')}</span><span>hoje</span></div>
              <p className="dp-nota">Mostra se a operação está parada, constante ou em pico. Maior dia: {n(maxDia)} mensagem(ns).</p>
            </section>
          </div>

          <div className="dp-linha3">
            <section className="pl-card" aria-label="Em andamento">
              <div className="dp-ph"><b>Em andamento</b><span>progresso de cada campanha</span></div>
              {!(d.andamento ?? []).length ? <p className="pl-hint">Nenhuma campanha enviando agora.</p> : (
                <ul className="dp-lista">
                  {(d.andamento ?? []).map(c => {
                    const tot = Math.max(1, c.elegiveis)
                    const parada = c.situacao?.motivo === 'SEM_CONEXAO'
                    return (
                      <li key={c.id} className={`dp-item ${parada ? 'problema' : ''}`}>
                        <div style={{ minWidth: 0 }}>
                          <div className="dp-item-titulo">{c.nome} <SeloStatus status={c.status} parada={parada} /></div>
                          <div className="dp-barra-prog" aria-label={`${c.enviadas} de ${c.elegiveis}`}><i className="ok" style={{ width: `${(c.enviadas / tot) * 100}%` }} /><i className="falha" style={{ width: `${(c.falhas / tot) * 100}%` }} /><i className="parada" style={{ width: `${(c.paradas / tot) * 100}%` }} /></div>
                          <div className="dp-item-sub">{n(c.enviadas)} de {n(c.elegiveis)}{c.remetente ? ` · ${c.canal === 'INSTAGRAM' ? 'Instagram' : `WhatsApp de ${c.remetente}`}` : ''}{c.situacao && c.situacao.motivo !== 'ENVIANDO' ? ` · ${c.situacao.titulo.toLowerCase()}` : ''}</div>
                        </div>
                        <button type="button" className="pl-btn pl-btn-ghost" onClick={() => abrir(c.id)}>Abrir</button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
            <section className="pl-card" aria-label="Melhor taxa de resposta">
              <div className="dp-ph"><b>Melhor taxa de resposta</b><span>campanhas do período</span></div>
              {!ranking.length ? <p className="pl-hint">Ainda sem respostas para comparar.</p> : ranking.map(c => (
                <button key={c.id} type="button" className="dp-rank" onClick={() => abrir(c.id)}>
                  <span className="dp-rank-nome">{c.nome}<span className="dp-rank-trilha"><i style={{ width: `${((c.taxaResposta ?? 0) / Math.max(0.1, ranking[0].taxaResposta ?? 0)) * 100}%` }} /></span></span>
                  <b>{pct(c.taxaResposta)}</b>
                </button>
              ))}
            </section>
            <section className="pl-card" aria-label="Atividade">
              <div className="dp-ph"><b>Atividade</b><span>mais recentes</span></div>
              {!d.atividade.length ? <p className="pl-hint">Nada ainda.</p> : (
                <ul className="dp-linha-tempo">
                  {d.atividade.slice(0, 8).map(e => (
                    <li key={e.id}>
                      <time title={new Date(e.criadoEm).toLocaleString('pt-BR')}>{quandoTexto(e.criadoEm)}</time>
                      <span><b className={`dp-ev ${TOM_EVENTO[e.tipo] ?? ''}`}>{ROTULO_EVENTO[e.tipo] ?? e.tipo}</b>{e.campanha ? ` · ${e.campanha}` : ''}{e.descricao && e.tipo === 'RESPOSTA' ? `: “${e.descricao.replace(/^Instagram: /, '').slice(0, 70)}”` : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <details className="pl-card dp-comparar" data-disparo-comparativo>
            <summary><b>Tabela completa de comparação</b> <span className="pl-hint">{comp?.length ?? 0} campanha(s) que começaram nos últimos {dias} dias</span></summary>
            {!comp?.length ? <p className="pl-hint">Nenhuma campanha começou no período.</p> : (
              <div className="pl-table-wrap" style={{ marginTop: 10 }}>
                <table className="pl-table">
                  <thead><tr><th>Campanha</th><th>Objetivo</th><th>Responsável</th><th>Público</th><th className="pl-right">Aceitas</th><th className="pl-right">Entregues</th><th className="pl-right">Lidas</th><th className="pl-right">Respostas</th><th className="pl-right">Resposta</th><th className="pl-right">Falhas</th><th className="pl-right">Saíram</th></tr></thead>
                  <tbody>
                    {comp.map(c => (
                      <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => abrir(c.id)}>
                        <td><b>{c.nome}</b><div className="pl-hint">{meta.finalidades[c.finalidade]} · <SeloStatus status={c.status} /></div></td>
                        <td>{c.objetivo ?? '—'}</td><td>{c.responsavel ?? '—'}</td><td>{meta.predefinidos.find(p => p.chave === c.publico)?.nome ?? c.publico ?? '—'}</td>
                        <td className="pl-right">{n(c.aceitas)}</td><td className="pl-right">{n(c.entregues)}</td><td className="pl-right">{n(c.lidas)}</td><td className="pl-right">{n(c.respostas)}</td>
                        <td className="pl-right">{pct(c.taxaResposta)}</td><td className="pl-right">{n(c.falhas)}</td><td className="pl-right">{n(c.descadastros)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>
        </>
      )}
    </div>
  )
}

function EsqueletoVisao() {
  return (
    <div className="dp-visao" aria-busy="true" aria-label="Carregando a Visão geral">
      <section className="dp-faixa-agora">{[0, 1, 2, 3].map(i => <div key={i} className="dp-tile"><div className="dp-esq" style={{ width: '40%' }} /><div className="dp-esq alto" /><div className="dp-esq" style={{ width: '70%' }} /></div>)}</section>
      <div className="dp-hero"><div className="pl-card"><div className="dp-esq" style={{ width: '30%' }} /><div className="dp-esq alto" /><div className="dp-esq" /><div className="dp-esq" /></div><div className="pl-card"><div className="dp-esq" style={{ width: '30%' }} /><div className="dp-esq alto" /></div></div>
    </div>
  )
}
