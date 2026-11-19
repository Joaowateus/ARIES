'use client'

// Saúde da Central (só o dono): cada fonte com a hora da última atualização, o limite aceito
// e a situação; eventos com erro (com "Tentar de novo"); divergências da conferência diária;
// perguntas sem resposta e respostas marcadas como erradas; e o histórico de cargas e conferências.
// Nada falha em silêncio: o que der errado aparece aqui.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { centralApi, type SaudeCentral as Dados } from '@/lib/proLaboreApi'
import { dataHora, haQuanto } from './util'

const SITUACAO: Record<string, { rotulo: string; classe: string }> = {
  EM_DIA: { rotulo: 'Em dia', classe: 'bom' }, ATRASADA: { rotulo: 'Atrasada', classe: 'atencao' },
  FALHA: { rotulo: 'Com falha', classe: 'critico' }, NAO_INTEGRADA: { rotulo: 'Não integrada', classe: '' },
}
const limiteTxt = (min: number) => (min >= 60 ? `${Math.round(min / 60)} h` : `${min} min`)

export function SaudeCentral() {
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const carregar = useCallback(() => centralApi.saude().then(setD).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar')), [])
  useEffect(() => { void carregar() }, [carregar])

  async function agir(acao: () => Promise<unknown>, ok: string) {
    setOcupado(true); setMsg(null)
    try { await acao(); setMsg(ok); await carregar() } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') } finally { setOcupado(false) }
  }

  if (erro) return <div className="pl-alert pl-alert-error" role="alert">{erro}</div>
  if (!d) return <p className="pl-hint" aria-busy="true">Lendo a saúde das fontes…</p>
  return (
    <div data-central-saude>
      <div className="cc-chips" style={{ marginBottom: 10 }}>
        <span className="pl-hint">Cobertura das fontes: <b>{d.cobertura.toLocaleString('pt-BR')}%</b> · {d.pendentes} evento(s) na fila</span>
        <button type="button" className="pl-btn" disabled={ocupado} onClick={() => void agir(() => centralApi.conferirAgora(), 'Conferência feita.')} data-conferir-agora>Conferir agora</button>
      </div>
      {msg && <p className="pl-hint" role="status">{msg}</p>}

      <section className="cc-grupo">
        <div className="ar-fila-grupo">Fontes</div>
        <div className="cc-tabela-rolagem">
          <table className="pl-table cc-tabela" data-central-fontes>
            <thead><tr><th>Fonte</th><th>Situação</th><th>Última atualização</th><th>Limite</th><th>Na fonte</th><th>No índice</th><th>Última conferência</th><th /></tr></thead>
            <tbody>
              {d.fontes.map(f => (
                <tr key={f.chave} data-fonte={f.chave}>
                  <td><b>{f.nome}</b><div className="pl-hint">{f.descricao}</div>{f.ultimoErro && <div className="pl-hint" role="alert" style={{ color: 'var(--ar-estado-critico)' }}>{f.ultimoErro}</div>}</td>
                  <td><span className={`pl-status-badge ${SITUACAO[f.situacao].classe}`}>{SITUACAO[f.situacao].rotulo}</span>{f.pendentes > 0 && <div className="pl-hint">{f.pendentes} na fila</div>}</td>
                  <td>{f.tipo === 'NAO_INTEGRADA' ? '—' : f.ultimaAtualizacaoEm ? <span title={dataHora(f.ultimaAtualizacaoEm)}>{haQuanto(f.ultimaAtualizacaoEm)}</span> : 'ainda não'}</td>
                  <td>{f.limiteMin ? limiteTxt(f.limiteMin) : '—'}</td>
                  <td>{f.itensFonte ?? '—'}</td>
                  <td>{f.itensIndice ?? '—'}{f.itensFonte != null && !f.cargaInicialEm ? <div className="pl-hint">carga em andamento</div> : null}</td>
                  <td>{f.ultimaConferenciaEm ? haQuanto(f.ultimaConferenciaEm) : '—'}</td>
                  <td>{f.situacao === 'FALHA' && <button type="button" className="pl-btn" disabled={ocupado} onClick={() => void agir(() => centralApi.tentarDeNovo({ fonte: f.chave }), 'Reenviado para processar.')}>Tentar de novo</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cc-grupo" data-central-eventos>
        <div className="ar-fila-grupo">Eventos com erro ({d.eventosComErro.length})</div>
        {!d.eventosComErro.length ? <p className="pl-hint">Nenhum. Tudo o que mudou foi processado.</p> : (
          <ul className="ar-fila">
            {d.eventosComErro.map(e => (
              <li key={e.id} className="ar-fila-item">
                <div>
                  <div className="ar-fila-titulo">{e.fonte} · {e.tentativas} tentativa(s){e.alerta && <span className="pl-status-badge critico" style={{ marginLeft: 6 }}>alerta</span>}</div>
                  <div className="pl-hint">{e.ultimoErro ?? 'sem mensagem'} · desde {dataHora(e.desde)}{e.proximaTentativaEm ? ` · próxima tentativa ${dataHora(e.proximaTentativaEm)}` : ''}</div>
                </div>
                <button type="button" className="pl-btn" disabled={ocupado} onClick={() => void agir(() => centralApi.tentarDeNovo({ eventoId: e.id }), 'Reenviado para processar.')}>Tentar de novo</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cc-grupo" data-central-divergencias>
        <div className="ar-fila-grupo">Divergências da conferência diária ({d.divergencias.length})</div>
        {!d.divergencias.length ? <p className="pl-hint">Nenhuma. O índice bate com as fontes.</p> : (
          <ul className="ar-fila">
            {d.divergencias.map(x => (
              <li key={x.id} className="ar-fila-item">
                <div><div className="ar-fila-titulo">{x.fonte}: {x.descricao}</div><div className="pl-hint">desde {dataHora(x.desde)}{x.registroId ? ` · registro ${x.registroId.slice(0, 10)}…` : ''} · a correção já foi enviada para processar</div></div>
                <button type="button" className="pl-btn" disabled={ocupado} onClick={() => void agir(() => centralApi.resolverDivergencia(x.id), 'Marcada como resolvida.')}>Marcar resolvida</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cc-grupo" data-central-sem-resposta>
        <div className="ar-fila-grupo">Perguntas sem resposta ({d.perguntasSemResposta.length}) e respostas marcadas como erradas ({d.respostasErradas.length})</div>
        {!d.perguntasSemResposta.length && !d.respostasErradas.length ? <p className="pl-hint">Nenhuma pendente.</p> : (
          <ul className="ar-fila">
            {d.respostasErradas.map(p => (
              <li key={p.id} className="ar-fila-item">
                <div><div className="ar-fila-titulo"><span className="pl-status-badge critico">resposta errada</span> {p.pergunta}</div><div className="pl-hint">{p.papel} · {dataHora(p.marcadaErradaEm)} · resposta: {p.resposta.slice(0, 200)}</div></div>
                <button type="button" className="pl-btn" disabled={ocupado} onClick={() => void agir(() => centralApi.perguntaTratada(p.id), 'Tratada.')}>Tratada</button>
              </li>
            ))}
            {d.perguntasSemResposta.map(p => (
              <li key={p.id} className="ar-fila-item">
                <div><div className="ar-fila-titulo">{p.pergunta}</div><div className="pl-hint">{p.papel} · {p.canal === 'WHATSAPP' ? 'WhatsApp' : 'tela'} · {dataHora(p.criadoEm)}</div></div>
                <span className="cc-chips">
                  <Link className="pl-btn" href="/pro-labore/aba/central-conhecimento?sub=comercial">Criar verbete</Link>
                  <button type="button" className="pl-btn" disabled={ocupado} onClick={() => void agir(() => centralApi.perguntaTratada(p.id), 'Tratada.')}>Tratada</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {d.pesquisasSemResultado.length > 0 && <p className="pl-hint">Pesquisas sem resultado (30 dias): {d.pesquisasSemResultado.map(p => `“${p.termo}” (${p.vezes}×)`).join(', ')}</p>}
      </section>

      <details className="ar-detalhes" data-central-cargas><summary>Cargas e conferências ({d.conferencias.length})</summary>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {d.conferencias.map(c => <li key={c.id}>{dataHora(c.inicio)} · {c.tipo === 'CARGA_INICIAL' ? 'carga inicial' : 'conferência'} · {c.fonte} · {c.situacao.toLowerCase()}{c.contagemFonte != null ? ` · fonte ${c.contagemFonte} / índice ${c.contagemIndice}` : ''}{c.divergencias ? ` · ${c.divergencias} divergência(s)` : ''}{c.erro ? ` · ${c.erro}` : ''}</li>)}
        </ul>
      </details>
    </div>
  )
}
