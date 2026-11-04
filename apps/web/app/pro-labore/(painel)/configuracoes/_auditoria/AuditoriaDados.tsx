'use client'

// Auditoria dos dados: mês a mês, o que ficou repetido depois da importação do
// banco antigo (vendas, recibos, Financeiro e leads). Mostra os dois registros
// lado a lado; você confere, escolhe e corrige. Tudo que sai fica guardado e a
// correção pode ser desfeita.
import { useEffect, useMemo, useState } from 'react'
import { proLaboreApi, type AchadoAuditoria, type AuditoriaDados as Dados, type TipoAchadoAuditoria, type VendaRevisao } from '@/lib/proLaboreApi'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const nomeMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`
const TIPOS: Array<{ tipo: TipoAchadoAuditoria; rotulo: string }> = [
  { tipo: 'vendas', rotulo: 'Vendas' },
  { tipo: 'pagamentos', rotulo: 'Recibos de comissão e pró-labore' },
  { tipo: 'financeiro', rotulo: 'Financeiro' },
  { tipo: 'leads', rotulo: 'Leads' },
]
const CONFIANCA: Record<AchadoAuditoria['confianca'], string> = { alta: 'Repetida com certeza', media: 'Provável repetida', conferir: 'Conferir' }
const POR_PAGINA = 40

export function AuditoriaDados() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [tipo, setTipo] = useState<TipoAchadoAuditoria>('vendas')
  const [mes, setMes] = useState('')
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [dataAntiga, setDataAntiga] = useState<Set<string>>(new Set())
  const [inverter, setInverter] = useState<Set<string>>(new Set())
  const [limite, setLimite] = useState(POR_PAGINA)
  const [ocupado, setOcupado] = useState<'corrigir' | 'desfazer' | null>(null)
  const [andamento, setAndamento] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    setCarregando(true)
    try {
      const d = await proLaboreApi.sistema.auditoria.ver()
      setDados(d)
      setMarcados(new Set(d.achados.filter(a => a.sugerido).map(a => a.chave)))
      setDataAntiga(new Set()); setInverter(new Set())
      const primeiro = TIPOS.find(t => d.resumo[t.tipo].total > 0)
      if (primeiro) setTipo(primeiro.tipo)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível auditar') }
    finally { setCarregando(false) }
  }
  useEffect(() => { void carregar() }, [])

  const lista = useMemo(() => (dados?.achados ?? []).filter(a => a.tipo === tipo && (!mes || a.mesRemovido === mes || a.mesMantido === mes)), [dados, tipo, mes])
  const mesesComAchados = useMemo(() => [...new Set((dados?.achados ?? []).filter(a => a.tipo === tipo).map(a => a.mesRemovido))].sort().reverse(), [dados, tipo])

  function alternar(chave: string) {
    setMarcados(m => { const n = new Set(m); if (n.has(chave)) n.delete(chave); else n.add(chave); return n })
  }
  function marcarLista(sim: boolean) {
    setMarcados(m => { const n = new Set(m); for (const a of lista) { if (sim) n.add(a.chave); else n.delete(a.chave) } return n })
  }

  async function corrigir() {
    if (!dados) return
    const chaves = dados.achados.filter(a => marcados.has(a.chave)).map(a => a.chave)
    if (!chaves.length) return
    if (!window.confirm(`Corrigir ${chaves.length} ${chaves.length === 1 ? 'item' : 'itens'}? Os registros repetidos saem e ficam guardados: dá para desfazer depois.`)) return
    setOcupado('corrigir'); setErro(null); setOk(null)
    let correcaoId: string | null = null, feitos = 0, falhas = 0, pendentes = chaves, tentativas = 0
    try {
      for (let i = 0; i < 300 && pendentes.length; i++) {
        try {
          const r = await proLaboreApi.sistema.auditoria.corrigir({ chaves: pendentes, dataAntiga: [...dataAntiga], inverter: [...inverter], correcaoId })
          correcaoId = r.correcaoId; feitos += r.feitos; falhas += r.falhas.length; pendentes = r.restantes; tentativas = 0
          setAndamento(`${feitos} de ${chaves.length} corrigidos…`)
        } catch (e) {
          if (++tentativas >= 4) throw e
          await new Promise(res => setTimeout(res, 3000 * tentativas))
        }
      }
      setOk(`Pronto: ${feitos} ${feitos === 1 ? 'item corrigido' : 'itens corrigidos'}${falhas ? ` (${falhas} não deu para corrigir; continuam na lista)` : ''}. Os números do Dashboard já estão atualizados.`)
    } catch (e) {
      setErro(`${e instanceof Error ? e.message : 'A correção parou'}. O que já foi corrigido ficou; toque de novo para continuar.`)
    } finally {
      setOcupado(null); setAndamento(null); await carregar()
    }
  }

  async function desfazer() {
    const c = dados?.ultimaCorrecao
    if (!c || !window.confirm(`Desfazer a correção de ${new Date(c.criadoEm).toLocaleString('pt-BR')} (${c.quantidade} itens)? Tudo volta como estava antes dela.`)) return
    setOcupado('desfazer'); setErro(null); setOk(null)
    try {
      for (let i = 0; i < 200; i++) { const r = await proLaboreApi.sistema.auditoria.desfazer(c.id); if (!r.restantes) break }
      setOk('Correção desfeita: tudo voltou como estava.')
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível desfazer') }
    finally { setOcupado(null); await carregar() }
  }

  if (!dados) {
    return carregando ? null : erro ? <section className="pl-card" style={{ marginBottom: 20 }}><div className="pl-alert pl-alert-error" role="alert">{erro}</div></section> : null
  }
  const totalAchados = dados.achados.length
  const marcadosTotal = dados.achados.filter(a => marcados.has(a.chave)).length
  const mesesComDiferenca = dados.meses.filter(m => m.repetidas > 0 || m.leadsRepetidos > 0)

  return (
    <section className="pl-card" id="auditoria" style={{ marginBottom: 20 }} data-auditoria-dados>
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">Auditoria dos dados</div>
          <div className="pl-card-sub">Confere, mês a mês, o que ficou repetido depois da importação do banco antigo: a mesma venda, recibo, pagamento ou lead lançado duas vezes (às vezes com outra data, até em outro mês). Fica o que foi lançado aqui; o repetido sai e fica guardado para desfazer.</div>
        </div>
        <button type="button" className="pl-btn pl-btn-ghost" onClick={() => void carregar()} disabled={carregando || !!ocupado} data-auditar>{carregando ? 'Auditando…' : 'Auditar de novo'}</button>
      </div>

      {!dados.origemConhecida && <div className="pl-alert" style={{ marginBottom: 12 }}>Não encontrei o registro da importação do banco antigo, então só aparecem as vendas repetidas dentro do mesmo banco (para conferir).</div>}

      {totalAchados === 0 ? (
        <div className="pl-alert pl-alert-success" data-auditoria-limpa>Nenhum registro repetido encontrado. Os números de cada mês batem com os lançamentos.</div>
      ) : (
        <div className="pl-alert" style={{ marginBottom: 12 }} data-auditoria-resumo>
          Encontrei <b>{TIPOS.filter(t => dados.resumo[t.tipo].total).map(t => `${dados.resumo[t.tipo].total} ${t.rotulo.toLowerCase()}`).join(', ')}</b> para corrigir ou conferir
          {mesesComDiferenca.length > 0 && <>, em {mesesComDiferenca.length} {mesesComDiferenca.length === 1 ? 'mês' : 'meses'}</>}. Os já marcados são os repetidos com o banco antigo; os de “Conferir” vêm desmarcados.
        </div>
      )}

      <h3 style={{ margin: '14px 0 8px', fontSize: 14 }}>Mês a mês: como está e como fica</h3>
      <div className="pl-table-wrap">
        <table className="pl-table" data-auditoria-meses>
          <thead><tr><th>Mês</th><th style={{ textAlign: 'right' }}>Vendas</th><th style={{ textAlign: 'right' }}>Fechados no CRM</th><th style={{ textAlign: 'right' }}>Receita hoje</th><th style={{ textAlign: 'right' }}>Repetidas</th><th style={{ textAlign: 'right' }}>Receita corrigida</th><th style={{ textAlign: 'right' }}>Lucro corrigido</th><th style={{ textAlign: 'right' }}>Comissões corrigidas</th><th style={{ textAlign: 'right' }}>Leads (repetidos)</th></tr></thead>
          <tbody>
            {dados.meses.map(m => (
              <tr key={m.mes} data-mes-auditoria={m.mes} style={m.repetidas || m.leadsRepetidos ? { background: 'var(--pl-surface-2, rgba(255,200,0,0.06))' } : undefined}>
                <td><button type="button" className="pl-link" style={{ background: 'none', border: 0, padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => { setMes(m.mes); setLimite(POR_PAGINA) }}>{nomeMes(m.mes)}</button></td>
                <td style={{ textAlign: 'right' }}>{m.vendas}{m.repetidas ? ` → ${m.vendasCorrigidas}` : ''}</td>
                <td style={{ textAlign: 'right' }}>{m.fechadosCrm}{m.vendas > m.fechadosCrm && <span className="pl-hint"> ({m.vendasSemLead} sem lead)</span>}</td>
                <td style={{ textAlign: 'right' }}>{brl(m.receita)}</td>
                <td style={{ textAlign: 'right' }}>{m.repetidas ? <b>{m.repetidas} · {brl(m.receitaRepetida)}</b> : '—'}</td>
                <td style={{ textAlign: 'right' }}>{m.repetidas ? <b>{brl(m.receitaCorrigida)}</b> : brl(m.receita)}</td>
                <td style={{ textAlign: 'right' }}>{brl(m.proLaboreCorrigido)}</td>
                <td style={{ textAlign: 'right' }}>{brl(m.comissaoCorrigida)}</td>
                <td style={{ textAlign: 'right' }}>{m.leads}{m.leadsRepetidos ? ` (${m.leadsRepetidos})` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pl-hint" style={{ marginTop: 6 }}>“Corrigida” considera os itens marcados como repetidos com o banco antigo. Toque no mês para ver os repetidos dele e a lista completa das vendas do mês.</p>
      {mes && <RevisaoMes key={mes + (dados.geradoEm)} mes={mes} onFechar={() => setMes('')} onCorrigido={() => void carregar()} />}

      {totalAchados > 0 && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '16px 0 10px' }} role="tablist">
            {TIPOS.map(t => (
              <button key={t.tipo} type="button" role="tab" aria-selected={tipo === t.tipo} className={`pl-btn ${tipo === t.tipo ? 'pl-btn-primary' : 'pl-btn-ghost'}`} onClick={() => { setTipo(t.tipo); setMes(''); setLimite(POR_PAGINA) }} data-aba-auditoria={t.tipo}>
                {t.rotulo} ({dados.resumo[t.tipo].total})
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <select className="pl-input" value={mes} onChange={e => { setMes(e.target.value); setLimite(POR_PAGINA) }} style={{ maxWidth: 200 }} aria-label="Mês" data-filtro-mes>
              <option value="">Todos os meses</option>
              {mesesComAchados.map(m => <option key={m} value={m}>{nomeMes(m)}</option>)}
            </select>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => marcarLista(true)}>Marcar todos da lista</button>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => marcarLista(false)}>Desmarcar todos da lista</button>
          </div>

          {lista.length === 0 ? <p className="pl-hint">Nada nesta aba{mes ? ' neste mês' : ''}.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lista.slice(0, limite).map(a => (
                <label key={a.chave} className="pl-card" style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }} data-achado={a.chave}>
                  <input type="checkbox" checked={marcados.has(a.chave)} onChange={() => alternar(a.chave)} style={{ marginTop: 4 }} aria-label="Corrigir este item" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                      <span className="pl-chip" data-confianca={a.confianca}>{CONFIANCA[a.confianca]}</span>
                      <span className="pl-hint">{a.motivo}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                      {(() => {
                        const inv = inverter.has(a.chave) && !!a.manter
                        const sai = inv ? a.manter! : a.remover, fica = inv ? a.remover : a.manter
                        const origem = (r: typeof a.remover) => (r.antigo ? ' (banco antigo)' : ' (lançado aqui)')
                        return <>
                          <Registro titulo={`Sai${origem(sai)}`} r={sai} tipo={a.tipo} />
                          {fica && <Registro titulo={`Fica${origem(fica)}`} r={fica} tipo={a.tipo} />}
                        </>
                      })()}
                    </div>
                    {a.tipo === 'vendas' && a.manter && (dia(a.manter.data) !== dia(a.remover.data) || a.manter.valor !== a.remover.valor) && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }} onClick={e => e.stopPropagation()} data-qual-fica>
                        <span className="pl-hint">Qual fica (com o valor e a data dela):</span>
                        <label><input type="radio" name={`fica-${a.chave}`} checked={!inverter.has(a.chave)} onChange={() => setInverter(s => { const n = new Set(s); n.delete(a.chave); return n })} /> {dia(a.manter.data)} · {brl(a.manter.valor)}{a.manter.antigo ? ' (banco antigo)' : ' (lançada aqui)'}</label>
                        <label><input type="radio" name={`fica-${a.chave}`} checked={inverter.has(a.chave)} onChange={() => setInverter(s => new Set(s).add(a.chave))} data-fica-outra /> {dia(a.remover.data)} · {brl(a.remover.valor)}{a.remover.antigo ? ' (banco antigo)' : ' (lançada aqui)'}</label>
                      </div>
                    )}
                  </div>
                </label>
              ))}
              {lista.length > limite && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setLimite(l => l + POR_PAGINA)}>Mostrar mais ({lista.length - limite})</button>}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
            <button type="button" className="pl-btn pl-btn-primary" disabled={!!ocupado || !marcadosTotal} onClick={() => void corrigir()} data-corrigir-auditoria>
              {ocupado === 'corrigir' ? 'Corrigindo…' : `Corrigir ${marcadosTotal} ${marcadosTotal === 1 ? 'item marcado' : 'itens marcados'}`}
            </button>
            {andamento && <span className="pl-hint">{andamento}</span>}
          </div>
        </>
      )}

      {dados.ultimaCorrecao && (
        <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }} data-ultima-correcao>
          <span className="pl-hint">Última correção: {new Date(dados.ultimaCorrecao.criadoEm).toLocaleString('pt-BR')}, {dados.ultimaCorrecao.quantidade} itens.</span>
          <button type="button" className="pl-btn pl-btn-ghost" disabled={!!ocupado} onClick={() => void desfazer()} data-desfazer-auditoria>{ocupado === 'desfazer' ? 'Desfazendo…' : 'Desfazer esta correção'}</button>
        </div>
      )}
      {ok && <div className="pl-alert pl-alert-success" style={{ marginTop: 12 }} role="status">{ok}</div>}
      {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }} role="alert">{erro}</div>}
    </section>
  )
}

function Registro({ titulo, r, tipo }: { titulo: string; r: AchadoAuditoria['remover']; tipo: TipoAchadoAuditoria }) {
  return (
    <div style={{ border: '1px solid var(--pl-border)', borderRadius: 8, padding: '8px 10px', minWidth: 0 }}>
      <div className="pl-hint" style={{ fontSize: 12, marginBottom: 2 }}>{titulo}</div>
      <div><b>{dia(r.data)}</b>{tipo !== 'leads' && <> · <b>{brl(r.valor)}</b></>}</div>
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.rotulo}</div>
      {r.detalhe && <div className="pl-hint" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.detalhe}</div>}
    </div>
  )
}

// Revisão manual: todas as vendas do mês, com a origem, para tirar uma a uma o que não é verdade.
function RevisaoMes({ mes, onFechar, onCorrigido }: { mes: string; onFechar: () => void; onCorrigido: () => void }) {
  const [vendas, setVendas] = useState<VendaRevisao[] | null>(null)
  const [fechadosCrm, setFechadosCrm] = useState(0)
  const [tirar, setTirar] = useState<Set<string>>(new Set())
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  useEffect(() => { proLaboreApi.sistema.auditoria.vendasDoMes(mes).then(r => { setVendas(r.vendas); setFechadosCrm(r.fechadosCrm) }).catch(e => setMsg({ ok: false, texto: e instanceof Error ? e.message : 'Não foi possível carregar' })) }, [mes])
  if (!vendas) return msg ? <div className="pl-alert pl-alert-error" role="alert">{msg.texto}</div> : <p className="pl-hint">Carregando as vendas de {nomeMes(mes)}…</p>
  const total = vendas.reduce((s, v) => s + v.valor, 0)
  const fica = vendas.filter(v => !tirar.has(v.id))
  const antigas = vendas.filter(v => v.antigo).length

  async function remover() {
    const ids = [...tirar]
    if (!ids.length || !window.confirm(`Tirar ${ids.length} ${ids.length === 1 ? 'venda' : 'vendas'} de ${nomeMes(mes)}? Elas ficam guardadas e dá para desfazer depois.`)) return
    setOcupado(true); setMsg(null)
    try {
      let pend = ids.map(id => `manual:vendas:${id}`), correcaoId: string | null = null, feitos = 0
      for (let i = 0; i < 50 && pend.length; i++) {
        const r = await proLaboreApi.sistema.auditoria.corrigir({ chaves: pend, dataAntiga: [], correcaoId })
        correcaoId = r.correcaoId; feitos += r.feitos; pend = r.restantes
      }
      setMsg({ ok: true, texto: `Pronto: ${feitos} ${feitos === 1 ? 'venda tirada' : 'vendas tiradas'} de ${nomeMes(mes)}.` })
      setTirar(new Set())
      const nova = await proLaboreApi.sistema.auditoria.vendasDoMes(mes); setVendas(nova.vendas); setFechadosCrm(nova.fechadosCrm)
      onCorrigido()
    } catch (e) { setMsg({ ok: false, texto: e instanceof Error ? e.message : 'Não foi possível tirar' }) }
    finally { setOcupado(false) }
  }

  return (
    <div className="pl-card" style={{ padding: 14, marginTop: 12 }} data-revisao-mes={mes}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <b>Todas as vendas de {nomeMes(mes)}: {vendas.length} · {brl(total)}</b>
        <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Fechar</button>
      </div>
      <p className="pl-hint" style={{ margin: '6px 0 10px' }}>{antigas} vieram do banco antigo e {vendas.length - antigas} foram lançadas aqui. No CRM, <b>{fechadosCrm} {fechadosCrm === 1 ? 'lead foi fechado' : 'leads foram fechados'}</b> neste mês; {vendas.filter(v => !v.noCrm).length} das vendas não estão ligadas a nenhum lead. Marque as que não são verdade (repetidas ou de outro mês) e veja o total ficar certo antes de tirar.</p>
      {vendas.some(v => !v.noCrm) && <button type="button" className="pl-btn pl-btn-ghost" style={{ marginBottom: 10 }} onClick={() => setTirar(new Set(vendas.filter(v => !v.noCrm).map(v => v.id)))} data-marcar-sem-crm>Marcar as que não estão no CRM ({vendas.filter(v => !v.noCrm).length})</button>}
      <div className="pl-table-wrap">
        <table className="pl-table">
          <thead><tr><th>Tirar</th><th>Data</th><th style={{ textAlign: 'right' }}>Valor</th><th>Vendedor</th><th>Cliente / observação</th><th>No CRM</th><th>Origem</th></tr></thead>
          <tbody>
            {vendas.map(v => (
              <tr key={v.id} data-venda-revisao={v.id} style={tirar.has(v.id) ? { opacity: 0.5, textDecoration: 'line-through' } : undefined}>
                <td><input type="checkbox" checked={tirar.has(v.id)} onChange={() => setTirar(s => { const n = new Set(s); if (n.has(v.id)) n.delete(v.id); else n.add(v.id); return n })} aria-label="Tirar esta venda" /></td>
                <td>{dia(v.data)}</td>
                <td style={{ textAlign: 'right' }}>{brl(v.valor)}</td>
                <td>{v.vendedor ?? <span className="pl-hint">Sem vendedor</span>}</td>
                <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[v.cliente, v.observacao].filter(Boolean).join(' · ') || '—'}</td>
                <td>{v.noCrm ? 'Sim' : <span className="pl-hint">Não</span>}</td>
                <td><span className="pl-chip">{v.antigo ? 'Banco antigo' : `Lançada aqui em ${new Date(v.lancadaEm).toLocaleDateString('pt-BR')}`}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
        <span>Fica: <b data-total-fica>{fica.length} vendas · {brl(fica.reduce((s, v) => s + v.valor, 0))}</b></span>
        <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado || !tirar.size} onClick={() => void remover()} data-tirar-vendas>{ocupado ? 'Tirando…' : `Tirar ${tirar.size} ${tirar.size === 1 ? 'venda' : 'vendas'}`}</button>
      </div>
      {msg && <div className={`pl-alert ${msg.ok ? 'pl-alert-success' : 'pl-alert-error'}`} style={{ marginTop: 10 }} role={msg.ok ? 'status' : 'alert'}>{msg.texto}</div>}
    </div>
  )
}
