'use client'

// Públicos: os salvos (uma definição, nunca uma cópia dos contatos) e as autorizações de comunicação
// (quem autorizou mensagens promocionais, quem pediu para sair, quem está bloqueado), com o histórico.
import { useCallback, useEffect, useState } from 'react'
import { disparoApi, type AutorizacaoDisparo, type DefinicaoPublicoDisparo, type PublicoSalvoDisparo } from '@/lib/proLaboreApi'
import { PublicoEditor } from './PublicoEditor'
import { Paginacao, dataHora, erroDe, useMeta } from './util'

export function Publicos() {
  const meta = useMeta()
  const [lista, setLista] = useState<PublicoSalvoDisparo[] | null>(null)
  const [edit, setEdit] = useState<{ id: string | null; nome: string; descricao: string; definicao: DefinicaoPublicoDisparo } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(() => { disparoApi.publicos.listar().then(setLista).catch(e => setErro(erroDe(e))) }, [])
  useEffect(() => { carregar() }, [carregar])
  const pode = meta.nivel === 'EDITAR'
  async function salvar() {
    if (!edit) return
    try {
      const b = { nome: edit.nome, descricao: edit.descricao || null, definicao: edit.definicao }
      if (edit.id) await disparoApi.publicos.salvar(edit.id, b); else await disparoApi.publicos.criar(b)
      setEdit(null); carregar()
    } catch (e) { setErro(erroDe(e)) }
  }
  return (
    <div data-disparo-publicos>
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      {edit ? (
        <section className="pl-card">
          <div className="pl-field-grid">
            <div className="pl-field"><label htmlFor="pb-nome">Nome do público</label><input id="pb-nome" className="pl-input" value={edit.nome} onChange={e => setEdit({ ...edit, nome: e.target.value })} /></div>
            <div className="pl-field"><label htmlFor="pb-desc">Descrição</label><input id="pb-desc" className="pl-input" value={edit.descricao} onChange={e => setEdit({ ...edit, descricao: e.target.value })} /></div>
          </div>
          <div style={{ marginTop: 12 }}><PublicoEditor definicao={edit.definicao} mudar={d => setEdit({ ...edit, definicao: d })} finalidade="MARKETING" /></div>
          <div className="dp-linha dp-rodape"><button type="button" className="pl-btn" onClick={() => setEdit(null)}>Cancelar</button><button type="button" className="pl-btn pl-btn-primary" disabled={edit.nome.trim().length < 2} onClick={() => void salvar()}>Salvar público</button></div>
        </section>
      ) : (
        <section className="pl-card">
          <div className="dp-linha" style={{ justifyContent: 'space-between' }}><div className="pl-card-title">Públicos salvos</div>{pode && <button type="button" className="pl-btn pl-btn-primary" onClick={() => setEdit({ id: null, nome: '', descricao: '', definicao: { base: 'LEADS' } })}>Novo público</button>}</div>
          <p className="pl-hint">Um público guarda os critérios; a lista é montada de novo do CRM a cada campanha.</p>
          {!lista ? <p className="pl-hint">Carregando…</p> : !lista.length ? <p className="pl-hint">Nenhum público salvo. Os prontos ({meta.predefinidos.map(p => p.nome).join(', ')}) aparecem na criação da campanha.</p> : (
            <ul className="ar-fila">
              {lista.map(p => (
                <li key={p.id} className="ar-fila-item">
                  <div><div className="ar-fila-titulo">{p.nome}</div><div className="pl-hint">{p.descricao ?? ''} · atualizado {dataHora(p.atualizadoEm)}{p.criadoPorNome ? ` · ${p.criadoPorNome}` : ''}</div></div>
                  {pode && <span className="cc-chips"><button type="button" className="pl-btn" onClick={() => setEdit({ id: p.id, nome: p.nome, descricao: p.descricao ?? '', definicao: p.definicao })}>Editar</button><button type="button" className="pl-btn" onClick={() => void disparoApi.publicos.arquivar(p.id).then(carregar)}>Arquivar</button></span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <Autorizacoes />
    </div>
  )
}

const ROT_SIT: Record<string, string> = { AUTORIZADO: 'Autorizou', REVOGADO: 'Pediu para sair', BLOQUEADO: 'Bloqueado' }
const ROT_ORIG: Record<string, string> = { MANUAL: 'registro manual', IMPORTACAO: 'lista importada', RESPOSTA_SAIR: 'respondeu SAIR', SISTEMA: 'sistema' }

function Autorizacoes() {
  const meta = useMeta()
  const [tel, setTel] = useState('')
  const [situacao, setSituacao] = useState('')
  const [pagina, setPagina] = useState(0)
  const [d, setD] = useState<{ total: number; porPagina: number; atual: { situacao: string } | null; itens: AutorizacaoDisparo[] } | null>(null)
  const [novo, setNovo] = useState({ telefones: '', situacao: 'AUTORIZADO' as 'AUTORIZADO' | 'REVOGADO' | 'BLOQUEADO', baseLegal: 'CONSENTIMENTO', evidencia: '' })
  const [msg, setMsg] = useState<string | null>(null)
  const carregar = useCallback(() => { disparoApi.autorizacoes.listar({ telefone: tel || undefined, situacao: situacao || undefined, pagina }).then(setD).catch(e => setMsg(erroDe(e))) }, [tel, situacao, pagina])
  useEffect(() => { const t = setTimeout(carregar, 300); return () => clearTimeout(t) }, [carregar])
  const pode = meta.nivel === 'EDITAR'
  async function registrar() {
    const telefones = novo.telefones.split(/[\n,;]+/).map(x => x.trim()).filter(Boolean)
    if (!telefones.length) return
    setMsg(null)
    try {
      const r = await disparoApi.autorizacoes.registrar({ telefones, situacao: novo.situacao, baseLegal: novo.situacao === 'AUTORIZADO' ? novo.baseLegal : null, evidencia: novo.evidencia || null })
      setMsg(`${r.registrados} registrado(s)${r.invalidos.length ? ` · inválidos: ${r.invalidos.join(', ')}` : ''}.`)
      setNovo({ ...novo, telefones: '', evidencia: '' }); carregar()
    } catch (e) { setMsg(erroDe(e)) }
  }
  return (
    <section className="pl-card" style={{ marginTop: 16 }} data-disparo-autorizacoes>
      <div className="pl-card-title">Autorizações de comunicação</div>
      <p className="pl-hint">Mensagem promocional só vai para quem autorizou{meta.config.baseMarketing === 'RELACAO' ? ' ou já tem relação comercial com a loja' : ''}. Quem responde SAIR, PARAR ou CANCELAR sai sozinho de todas as promocionais. Bloqueado não recebe nada. Cada mudança fica no histórico e não pode ser apagada.</p>
      {pode && (
        <div className="pl-field-grid" style={{ marginTop: 8 }}>
          <div className="pl-field"><label htmlFor="au-tel">Telefone(s)</label><textarea id="au-tel" className="pl-input" rows={2} value={novo.telefones} onChange={e => setNovo({ ...novo, telefones: e.target.value })} placeholder={meta.dono ? 'Um ou vários (um por linha)' : 'Um telefone'} /></div>
          <div className="pl-field"><label htmlFor="au-sit">Registrar como</label>
            <select id="au-sit" className="pl-select" value={novo.situacao} onChange={e => setNovo({ ...novo, situacao: e.target.value as typeof novo.situacao })}>
              {meta.gestao && <option value="AUTORIZADO">Autorizou mensagens promocionais</option>}<option value="REVOGADO">Pediu para não receber</option><option value="BLOQUEADO">Bloquear (não recebe nada)</option>
            </select>
          </div>
          {novo.situacao === 'AUTORIZADO' && <>
            <div className="pl-field"><label htmlFor="au-base">Base legal</label><select id="au-base" className="pl-select" value={novo.baseLegal} onChange={e => setNovo({ ...novo, baseLegal: e.target.value })}>{meta.basesLegais.map(b => <option key={b.chave} value={b.chave}>{b.rotulo}</option>)}</select></div>
            <div className="pl-field"><label htmlFor="au-evid">Evidência (onde e como autorizou)</label><input id="au-evid" className="pl-input" value={novo.evidencia} onChange={e => setNovo({ ...novo, evidencia: e.target.value })} placeholder="Ex.: termo assinado na loja em 20/11" /></div>
          </>}
          <div className="pl-field" style={{ alignSelf: 'end' }}><button type="button" className="pl-btn pl-btn-primary" onClick={() => void registrar()}>Registrar</button></div>
        </div>
      )}
      {msg && <p className="pl-hint" role="status">{msg}</p>}
      <div className="dp-linha" style={{ marginTop: 10 }}>
        <input className="pl-input" style={{ maxWidth: 220 }} placeholder="Consultar um telefone" value={tel} onChange={e => { setTel(e.target.value); setPagina(0) }} />
        {['', 'AUTORIZADO', 'REVOGADO', 'BLOQUEADO'].map(s => <button key={s} type="button" className={`pl-chip ${situacao === s ? 'active' : ''}`} onClick={() => { setSituacao(s); setPagina(0) }}>{s ? ROT_SIT[s] : 'Todas'}</button>)}
      </div>
      {d?.atual && <p className="pl-hint">Situação atual deste telefone: <b>{ROT_SIT[d.atual.situacao]}</b></p>}
      {d && (
        <div className="pl-table-wrap" style={{ marginTop: 8 }}>
          <table className="pl-table">
            <thead><tr><th>Quando</th><th>Telefone</th><th>Situação</th><th>Base legal / evidência</th><th>Origem</th></tr></thead>
            <tbody>{d.itens.map(a => <tr key={a.id}><td>{dataHora(a.criadoEm)}</td><td className="pl-mono">{a.telefone}</td><td>{ROT_SIT[a.situacao]}</td><td className="pl-hint">{a.baseLegal ? meta.basesLegais.find(b => b.chave === a.baseLegal)?.rotulo : ''}{a.evidencia ? ` · ${a.evidencia}` : ''}</td><td className="pl-hint">{ROT_ORIG[a.origem] ?? a.origem}{a.registradoPorNome ? ` · ${a.registradoPorNome}` : ''}</td></tr>)}
              {!d.itens.length && <tr><td colSpan={5} className="pl-hint">Nenhum registro.</td></tr>}</tbody>
          </table>
          <Paginacao pagina={pagina} total={d.total} porPagina={d.porPagina} ir={setPagina} />
        </div>
      )}
    </section>
  )
}
