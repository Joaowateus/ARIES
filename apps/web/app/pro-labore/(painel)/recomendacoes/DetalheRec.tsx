'use client'

// PDF 03 · detalhe de uma Recomendação: evidência (métricas do dicionário,
// período e comparação), força (hipótese nunca vira certeza), impacto
// (sempre estimativa), ação, roteamento, atividades, avaliação e histórico.
import { useEffect, useState } from 'react'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { proLaboreApi, recApi, type RecDetalhe } from '@/lib/proLaboreApi'

export const FORCA = { COMPROVADA: { nome: 'Evidência comprovada', classe: 'pl-faixa-bom' }, PADRAO: { nome: 'Padrão observado', classe: 'pl-faixa-atencao' }, HIPOTESE: { nome: 'Hipótese', classe: 'pl-faixa-critico' } } as const
export const STATUS: Record<string, string> = { NOVA: 'Nova', ACEITA: 'Aceita', DESCARTADA: 'Descartada', EM_EXECUCAO: 'Em execução', AVALIADA: 'Avaliada', ENCERRADA: 'Encerrada' }
export const AREA: Record<string, string> = { ATENDIMENTO: 'Atendimento', FUNIL: 'Funil', ATIVIDADES: 'Atividades', CREDITO: 'Crédito', ANUNCIOS: 'Anúncios', RESULTADO: 'Resultado do mês', REATIVACAO: 'Reativação', MARKETING: 'Marketing', GESTAO: 'Gestão', PESSOAS: 'Pessoas' }
const UN: Record<string, (n: number) => string> = {
  MIN: n => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} min`, PCT: n => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
  BRL: n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), X: n => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}×`, QTD: n => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
}
const fmt = (u: string, n: number | null | undefined) => (n == null ? '—' : (UN[u] ?? UN.QTD)(n))
const dia = (s: string) => s.split('-').reverse().slice(0, 2).join('/')
const per = (p: { inicio: string; fim: string } | null | undefined) => (p ? `${dia(p.inicio)} a ${dia(p.fim)}` : '')
const quando = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '—')

export function ForcaChip({ forca }: { forca: keyof typeof FORCA }) {
  return <span className={`pl-chip-faixa ${FORCA[forca].classe}`} data-forca={forca}>{FORCA[forca].nome}</span>
}

export function DetalheRec({ id, onFechar, onMudou, avaliarPertinencia }: { id: string; onFechar: () => void; onMudou?: () => void; avaliarPertinencia?: boolean }) {
  const [r, setR] = useState<RecDetalhe | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [nota, setNota] = useState('')
  // PDF 04 · "Aceitar e atribuir": a gestão escolhe quem executa as atividades.
  const { usuario } = useProLaboreAuth()
  const gestao = usuario?.papel === 'DONO' || usuario?.papel === 'SUPERVISOR'
  const [equipe, setEquipe] = useState<Array<{ id: string; nome: string }>>([])
  const [atribuir, setAtribuir] = useState('')
  useEffect(() => { recApi.detalhe(id).then(setR).catch(e => setErro(e instanceof Error ? e.message : 'Indisponível')) }, [id])
  useEffect(() => { if (gestao) proLaboreApi.vendedores.listar().then(v => setEquipe(v.filter(x => x.ativo).map(x => ({ id: x.id, nome: x.nome })))).catch(() => setEquipe([])) }, [gestao])
  async function agir(fn: () => Promise<RecDetalhe | { ok: boolean }>) {
    setErro(null)
    try { const x = await fn(); if ('id' in x) setR(x as RecDetalhe); else setR(await recApi.detalhe(id)); onMudou?.() } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível') }
  }
  return (
    <div className="pl-modal-backdrop" onClick={onFechar} role="dialog" aria-modal="true" aria-label="Recomendação">
      <div className="pl-card pl-modal-panel" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()} data-rec-detalhe={id}>
        {!r && !erro && <p className="pl-hint">Carregando…</p>}
        {erro && <div className="pl-alert" role="alert">{erro}</div>}
        {r && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div className="pl-eyebrow">{r.codigo} · {AREA[r.area] ?? r.area} · {STATUS[r.status]}{r.tipo === 'FUNCIONANDO' ? ' · está funcionando' : ''}</div>
              <div className="pl-card-title">{r.titulo}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}><ForcaChip forca={r.forca} /><span className="pl-hint">Nível 1: o ARIES só recomenda, não executa nada.</span></div>
              {r.forca === 'HIPOTESE' && <p className="pl-hint" style={{ margin: '6px 0 0' }}>É uma hipótese: há sinal nos números, mas ainda não é certeza.</p>}
            </div>
            {r.evidencia.orientacao && <p style={{ margin: 0 }} data-orientacao>{r.evidencia.orientacao}</p>}
            <section data-evidencia>
              <div className="pl-eyebrow">Evidência (dicionário de métricas)</div>
              <table className="pl-table"><thead><tr><th>Métrica</th><th>Agora</th><th>Antes</th><th>Casos</th></tr></thead>
                <tbody>{r.evidencia.metricas.map(m => (
                  <tr key={m.chave + m.nome}><td>{m.nome}<div className="pl-hint">{per(m.periodo)}{m.periodoAnterior ? ` contra ${per(m.periodoAnterior)}` : ''}</div></td><td>{fmt(m.unidade, m.valor)}</td><td>{m.periodoAnterior ? fmt(m.unidade, m.anterior) : m.anterior != null ? `padrão ${fmt(m.unidade, m.anterior)}` : '—'}</td><td>{m.amostra}</td></tr>
                ))}</tbody></table>
              <p className="pl-hint" style={{ margin: '4px 0 0' }}>{r.evidencia.resumo} · {r.evidencia.casos} casos (mínimo {r.evidencia.volumeMinimo}) · sem dados suspeitos nem clientes bloqueados</p>
            </section>
            {r.impacto && <div><div className="pl-eyebrow">Impacto estimado</div><p style={{ margin: 0 }}>{r.impacto.unidade === 'FATURAMENTO' ? fmt('BRL', r.impacto.valor) : r.impacto.valor} · {r.impacto.texto}</p></div>}
            <div><div className="pl-eyebrow">Ação sugerida</div><p style={{ margin: 0 }}>{r.acaoSugerida}</p></div>
            <div className="pl-hint">Quem decide: {r.destinatario ?? '—'}{r.acompanham.filter(Boolean).length ? ` · acompanha: ${r.acompanham.filter(Boolean).join(', ')}` : ''} · prazo {quando(r.prazo)}</div>
            {r.motivoDescarte && <div className="pl-hint">Descartada: {r.motivoDescarte}</div>}

            {r.podeDecidir && (
              <div style={{ display: 'grid', gap: 6 }} data-decidir>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {gestao && equipe.length > 0 && (
                    <select className="pl-input" style={{ width: 'auto' }} value={atribuir} onChange={e => setAtribuir(e.target.value)} aria-label="Atribuir a" data-atribuir>
                      <option value="">Atribuir a: {r.destinatario ?? 'quem recebeu'}</option>{equipe.map(p => <option key={p.id} value={p.id}>Atribuir a: {p.nome}</option>)}
                    </select>
                  )}
                  <button type="button" className="pl-btn pl-btn-primary" onClick={() => void agir(() => recApi.aceitar(r.id, atribuir || undefined))} data-aceitar>{gestao ? 'Aceitar e atribuir' : 'Aceitar e criar as atividades'}</button>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input className="pl-input" style={{ flex: '1 1 240px' }} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo do descarte (obrigatório)" data-motivo />
                  <button type="button" className="pl-btn" disabled={motivo.trim().length < 5} onClick={() => void agir(() => recApi.descartar(r.id, motivo))} data-descartar>Descartar</button>
                </div>
              </div>
            )}

            {r.atividades.length > 0 && (
              <section data-atividades-rec>
                <div className="pl-eyebrow">Atividades geradas</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>{r.atividades.map(a => (
                  <li key={a.id} style={{ marginBottom: 4 }}>
                    {a.codigo} · {a.oQueFazer} · {a.responsavel ?? '—'} · prazo {quando(a.prazo)} · <b>{a.status === 'PENDENTE' ? 'pendente' : a.status === 'EXECUTADA' ? 'feita' : 'cancelada'}</b>
                    {a.tipo === 'ACAO_RECOMENDACAO' && a.status === 'PENDENTE' && ['ACEITA', 'EM_EXECUCAO'].includes(r.status) && (
                      <button type="button" className="pl-btn" style={{ marginLeft: 6, padding: '1px 8px' }} onClick={() => void agir(() => recApi.concluirAtividade(r.id, a.id, 'Feito'))} data-concluir-atv>Marcar feita</button>
                    )}
                  </li>
                ))}</ul>
              </section>
            )}

            {r.status === 'EM_EXECUCAO' && r.executadaEm && (
              <section data-avaliar>
                <div className="pl-eyebrow">Avaliar o resultado</div>
                <p className="pl-hint" style={{ margin: '0 0 6px' }}>Compara o indicador antes do aceite com o depois da execução. Outras mudanças no mesmo período aparecem junto: a melhora não é atribuída só a esta ação.</p>
                <input className="pl-input" value={nota} onChange={e => setNota(e.target.value)} placeholder="Observação (opcional)" />
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {(['MANTER', 'AJUSTAR', 'REVERTER'] as const).map(x => <button key={x} type="button" className="pl-btn" onClick={() => void agir(() => recApi.avaliar(r.id, x, nota))} data-resultado={x}>{x === 'MANTER' ? 'Manter' : x === 'AJUSTAR' ? 'Ajustar' : 'Reverter'}</button>)}
                </div>
              </section>
            )}
            {r.indicadorDepois && (
              <section data-resultado-rec>
                <div className="pl-eyebrow">Resultado: {r.resultado === 'MANTER' ? 'manter' : r.resultado === 'AJUSTAR' ? 'ajustar' : 'reverter'}</div>
                <p style={{ margin: 0 }}>{r.indicadorAntes?.metrica ?? 'Indicador'}: antes {r.indicadorAntes?.valor ?? '—'} ({per(r.indicadorAntes?.periodo)}) · depois {r.indicadorDepois.valor ?? '—'} ({per(r.indicadorDepois.periodo)}){r.indicadorDepois.periodoCurto ? ' · período curto, leia com cautela' : ''}</p>
                {(r.indicadorDepois.outrasMudancas.recomendacoes.length > 0 || r.indicadorDepois.outrasMudancas.parametros.length > 0) && (
                  <p className="pl-hint" style={{ margin: '4px 0 0' }}>Também mudou no período: {[...r.indicadorDepois.outrasMudancas.recomendacoes.map(x => `${x.codigo} ${x.titulo}`), ...r.indicadorDepois.outrasMudancas.parametros.map(x => `parâmetro ${x.nome}`)].join('; ')}</p>
                )}
                {r.status === 'AVALIADA' && <button type="button" className="pl-btn" style={{ marginTop: 6 }} onClick={() => void agir(() => recApi.encerrar(r.id))} data-encerrar>Encerrar</button>}
              </section>
            )}

            {r.detector === 'boa_pratica' && r.alvoTipo === 'BOA_PRATICA' && gestao && (r.status === 'NOVA' || r.status === 'ACEITA') && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} data-compartilhar>
                <span className="pl-hint" style={{ width: '100%' }}>Boa prática: você decide se vira aprendizado da equipe. Sem nomes e sem ranking, salvo se quiser reconhecer a pessoa.</span>
                <button type="button" className="pl-btn pl-btn-primary" onClick={() => void agir(async () => { await recApi.compartilhar(r.id, false); return recApi.detalhe(r.id) })} data-compartilhar-sem-nome>Compartilhar com a equipe (sem nomes)</button>
                <button type="button" className="pl-btn" onClick={() => void agir(async () => { await recApi.compartilhar(r.id, true); return recApi.detalhe(r.id) })} data-reconhecer>Reconhecer a pessoa</button>
              </div>
            )}
            {avaliarPertinencia && (
              <section data-pertinencia>
                <div className="pl-eyebrow">Teste de utilidade: esta recomendação é pertinente?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className={`pl-btn ${r.minhaAvaliacao?.pertinente === true ? 'pl-btn-primary' : ''}`} onClick={() => void agir(() => recApi.pertinencia(r.id, true))} data-pertinente="sim">Pertinente</button>
                  <button type="button" className={`pl-btn ${r.minhaAvaliacao?.pertinente === false ? 'pl-btn-primary' : ''}`} onClick={() => void agir(() => recApi.pertinencia(r.id, false))} data-pertinente="nao">Não pertinente</button>
                </div>
              </section>
            )}

            <details><summary className="pl-hint">Histórico ({r.historico.length})</summary>
              <ul style={{ paddingLeft: 18 }}>{r.historico.map((h, i) => <li key={i}>{quando(h.em)} · {h.quem} · {h.acao === 'CRIACAO' ? 'criou' : `${h.campo}: ${h.valorAnterior ?? '—'} → ${h.valorNovo ?? '—'}`}</li>)}</ul>
            </details>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="pl-btn" onClick={onFechar}>Fechar</button></div>
          </div>
        )}
      </div>
    </div>
  )
}
