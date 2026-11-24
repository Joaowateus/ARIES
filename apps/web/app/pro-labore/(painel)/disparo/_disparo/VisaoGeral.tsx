'use client'

// Visão geral: campanhas por situação, o que saiu, chegou, foi lido e respondido no período,
// campanhas recentes, atividade e a comparação entre campanhas. Tudo vem do servidor (dados reais).
import { useEffect, useState } from 'react'
import { disparoApi, type VisaoGeralDisparo } from '@/lib/proLaboreApi'
import { Numero, SeloStatus, dataHora, erroDe, n, pct, useMeta } from './util'

const ROTULO_EVENTO: Record<string, string> = {
  RESPOSTA: 'Resposta', DESCADASTRO: 'Descadastro', FALHA: 'Falha', STATUS_RUNNING: 'Começou a enviar', STATUS_COMPLETED: 'Concluída',
  STATUS_COMPLETED_WITH_ERRORS: 'Concluída com falhas', STATUS_CANCELLED: 'Cancelada', DECIDIR_REENVIO: 'Precisa de decisão',
}

export function VisaoGeral({ abrir }: { abrir: (id: string) => void }) {
  const meta = useMeta()
  const [dias, setDias] = useState(30)
  const [d, setD] = useState<VisaoGeralDisparo | null>(null)
  const [comp, setComp] = useState<Awaited<ReturnType<typeof disparoApi.comparativo>> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    Promise.all([disparoApi.visaoGeral(dias), disparoApi.comparativo(dias)]).then(([v, c]) => { if (vivo) { setD(v); setComp(c); setErro(null) } }).catch(e => vivo && setErro(erroDe(e)))
    return () => { vivo = false }
  }, [dias])
  if (erro) return <div className="pl-alert pl-alert-error" role="alert">{erro}</div>
  if (!d) return <p className="pl-hint" aria-busy="true">Lendo as campanhas…</p>
  return (
    <div data-disparo-visao>
      <div className="dp-linha">
        <span className="pl-hint">Período:</span>
        {[7, 30, 90].map(x => <button key={x} type="button" className={`pl-chip ${dias === x ? 'active' : ''}`} onClick={() => setDias(x)}>{x} dias</button>)}
      </div>
      <section className="ar-agora" aria-label="Campanhas">
        <Numero rotulo="Campanhas criadas" valor={n(d.campanhas.criadas)} detalhe={`${n(d.campanhas.rascunhos)} em preparação`} />
        <Numero rotulo="Em andamento" valor={n(d.campanhas.emAndamento)} detalhe="enviando, na fila ou pausadas" />
        <Numero rotulo="Agendadas" valor={n(d.campanhas.agendadas)} />
        <Numero rotulo="Concluídas" valor={n(d.campanhas.concluidas)} />
      </section>
      <section className="ar-agora" aria-label="Mensagens do período">
        <Numero rotulo="Destinatários" valor={n(d.destinatarios)} detalhe={`${n(d.processadas)} mensagens processadas`} />
        <Numero rotulo="Aceitas pelo WhatsApp" valor={n(d.aceitas)} detalhe={`${n(d.falhas)} com falha`} />
        <Numero rotulo="Entregues" valor={n(d.entregues)} detalhe={`taxa de entrega ${pct(d.taxaEntrega)}`} />
        <Numero rotulo="Lidas" valor={n(d.lidas)} detalhe={`taxa de leitura ${pct(d.taxaLeitura)}`} titulo="Quem desligou a confirmação de leitura nunca aparece como lida" />
        <Numero rotulo="Respostas" valor={n(d.respostas)} detalhe={`taxa de resposta ${pct(d.taxaResposta)}`} />
      </section>
      <p className="pl-hint">Origem: mensagens e destinatários das campanhas no período. Entregue e lida chegam do WhatsApp e dependem do aparelho do cliente.</p>

      <div className="pl-grid-2b" style={{ marginTop: 16 }}>
        <section className="pl-card">
          <div className="pl-card-title">Campanhas recentes</div>
          {!d.recentes.length ? <p className="pl-hint">Nenhuma campanha ainda. Comece em Campanhas › Nova campanha.</p> : (
            <ul className="ar-fila">
              {d.recentes.map(c => (
                <li key={c.id} className="ar-fila-item" style={{ cursor: 'pointer' }} onClick={() => abrir(c.id)}>
                  <div>
                    <div className="ar-fila-titulo">{c.nome} <SeloStatus status={c.status} /></div>
                    <div className="pl-hint">{meta.finalidades[c.finalidade]} · {c.totais ? `${n(c.totais.elegiveis)} destinatários` : 'público ainda não preparado'} · {c.iniciadaEm ? `começou ${dataHora(c.iniciadaEm)}` : c.agendadaPara ? `agendada para ${dataHora(c.agendadaPara)}` : 'não iniciada'}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="pl-card">
          <div className="pl-card-title">Atividade</div>
          {!d.atividade.length ? <p className="pl-hint">Nada ainda.</p> : (
            <ul style={{ margin: 0, paddingLeft: 18 }} className="pl-hint">
              {d.atividade.map(e => <li key={e.id}>{dataHora(e.criadoEm)} · <b>{ROTULO_EVENTO[e.tipo] ?? e.tipo}</b>{e.campanha ? ` · ${e.campanha}` : ''}{e.descricao && e.tipo === 'RESPOSTA' ? `: “${e.descricao.slice(0, 80)}”` : ''}</li>)}
            </ul>
          )}
        </section>
      </div>

      <section className="pl-card" style={{ marginTop: 16 }} data-disparo-comparativo>
        <div className="pl-card-title">Comparação entre campanhas ({dias} dias)</div>
        <div className="pl-card-sub">Por campanha, com objetivo, finalidade, responsável e público. Taxa de resposta = quem respondeu ÷ quem recebeu ao menos uma mensagem.</div>
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
      </section>
    </div>
  )
}
