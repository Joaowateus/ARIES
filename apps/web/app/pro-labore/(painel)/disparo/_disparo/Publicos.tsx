'use client'

// Públicos: os salvos (uma definição, nunca uma cópia dos contatos) e as autorizações de comunicação
// (quem autorizou mensagens promocionais, quem pediu para sair, quem está bloqueado), com o histórico.
// Redesign 26/11: subabas Públicos | Autorizações, públicos salvos em cartões com os critérios,
// galeria dos prontos e o registro de autorização numa janela. As mesmas regras e chamadas.
import { useCallback, useEffect, useState } from 'react'
import { disparoApi, type AutorizacaoDisparo, type DefinicaoPublicoDisparo, type GrupoDisparo, type PublicoSalvoDisparo } from '@/lib/proLaboreApi'
import { PublicoEditor } from './PublicoEditor'
import { Paginacao, dataHora, erroDe, n, useMeta } from './util'
import { MenuAcoes, Quando, Segmentado, useAvisar, useConfirmar } from './ui'

type Edicao = { id: string | null; nome: string; descricao: string; definicao: DefinicaoPublicoDisparo }
const ROT_BASE: Record<string, string> = { TODOS: 'Todos os contatos', LEADS: 'Leads', CLIENTES: 'Clientes', CONTATARAM: 'Quem escreveu no WhatsApp', EQUIPE: 'Equipe', INSTAGRAM_DM: 'Direct do Instagram', INSTAGRAM_COMENTARIOS: 'Comentários do Instagram', CAMPANHA: 'Quem recebeu uma campanha' }
const contarCondicoes = (g: GrupoDisparo | null | undefined): number => (g?.itens ?? []).reduce((t, x) => t + ('itens' in x && Array.isArray(x.itens) ? contarCondicoes(x as GrupoDisparo) : 1), 0)

/** Os critérios do público em poucas etiquetas (base, pronto, filtros e escolhidos à mão). */
function Criterios({ d }: { d: DefinicaoPublicoDisparo }) {
  const meta = useMeta()
  const m = d.manual ?? {}
  const filtros = contarCondicoes(d.filtros)
  const pronto = d.predefinido ? meta.predefinidos.find(p => p.chave === d.predefinido)?.nome : null
  const itens = [
    !m.apenasManual && (d.base === 'CAMPANHA' && d.campanha ? (d.campanha.quem === 'RESPONDERAM' ? 'Responderam a uma campanha' : 'Não responderam a uma campanha') : pronto ?? ROT_BASE[d.base] ?? d.base),
    !m.apenasManual && filtros > 0 && `${filtros} filtro${filtros > 1 ? 's' : ''}`,
    (m.incluir?.length ?? 0) > 0 && `${n(m.incluir!.length)} escolhido(s)`,
    (m.numeros?.length ?? 0) > 0 && `${n(m.numeros!.length)} da lista colada`,
    (m.excluir?.length ?? 0) > 0 && `${n(m.excluir!.length)} tirado(s)`,
    m.apenasManual && 'só os escolhidos',
  ].filter(Boolean) as string[]
  return <span className="dp-criterios">{itens.map(t => <i key={t}>{t}</i>)}</span>
}

export function Publicos() {
  const [aba, setAba] = useState<'publicos' | 'autorizacoes'>('publicos')
  return (
    <div data-disparo-publicos>
      <div className="dp-subabas" role="tablist" aria-label="Públicos e autorizações">
        <button type="button" role="tab" aria-selected={aba === 'publicos'} className={aba === 'publicos' ? 'on' : ''} onClick={() => setAba('publicos')}>Públicos</button>
        <button type="button" role="tab" aria-selected={aba === 'autorizacoes'} className={aba === 'autorizacoes' ? 'on' : ''} onClick={() => setAba('autorizacoes')} data-aba-autorizacoes>Autorizações</button>
      </div>
      {aba === 'publicos' ? <PublicosSalvos /> : <Autorizacoes />}
    </div>
  )
}

function PublicosSalvos() {
  const meta = useMeta()
  const confirmar = useConfirmar()
  const avisar = useAvisar()
  const [lista, setLista] = useState<PublicoSalvoDisparo[] | null>(null)
  const [edit, setEdit] = useState<Edicao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(() => { disparoApi.publicos.listar().then(setLista).catch(e => setErro(erroDe(e))) }, [])
  useEffect(() => { carregar() }, [carregar])
  const pode = meta.nivel === 'EDITAR'
  async function salvar() {
    if (!edit) return
    try {
      const b = { nome: edit.nome, descricao: edit.descricao || null, definicao: edit.definicao }
      if (edit.id) await disparoApi.publicos.salvar(edit.id, b); else await disparoApi.publicos.criar(b)
      setEdit(null); avisar('Público salvo'); carregar()
    } catch (e) { setErro(erroDe(e)) }
  }
  async function arquivar(p: PublicoSalvoDisparo) {
    if (!(await confirmar({ titulo: `Arquivar o público “${p.nome}”?`, texto: 'Ele sai da lista. Campanhas que já usaram continuam com a lista delas.', acao: 'Arquivar' }))) return
    try { await disparoApi.publicos.arquivar(p.id); avisar('Público arquivado'); carregar() } catch (e) { avisar(erroDe(e), 'erro') }
  }
  const grupos: Array<[string, string, typeof meta.predefinidos]> = [
    ['CRM', 'Do CRM', meta.predefinidos.filter(p => !p.grupo)],
    ['JORNADA', 'Etapas da jornada (atualizam sozinhas)', meta.predefinidos.filter(p => p.grupo === 'JORNADA')],
    ['INSTAGRAM', 'Instagram (só em campanha pelo direct)', meta.gestao ? meta.predefinidos.filter(p => p.grupo === 'INSTAGRAM') : []],
  ]

  if (edit) return (
    <section className="pl-card">
      <header className="dp-assist-topo"><div><h2>{edit.id ? `Editar: ${edit.nome}` : 'Novo público'}</h2><p className="pl-hint">Um público guarda os critérios; a lista é montada de novo do CRM a cada campanha.</p></div><button type="button" className="pl-btn pl-btn-ghost" onClick={() => setEdit(null)}>Fechar</button></header>
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      <div className="pl-field-grid" style={{ marginTop: 12 }}>
        <div className="pl-field"><label htmlFor="pb-nome">Nome do público</label><input id="pb-nome" className="pl-input" value={edit.nome} onChange={e => setEdit({ ...edit, nome: e.target.value })} /></div>
        <div className="pl-field"><label htmlFor="pb-desc">Descrição</label><input id="pb-desc" className="pl-input" value={edit.descricao} onChange={e => setEdit({ ...edit, descricao: e.target.value })} /></div>
      </div>
      <div style={{ marginTop: 12 }}><PublicoEditor definicao={edit.definicao} mudar={d => setEdit({ ...edit, definicao: d })} finalidade="MARKETING" /></div>
      <div className="dp-linha dp-rodape"><button type="button" className="pl-btn pl-btn-ghost" onClick={() => setEdit(null)}>Cancelar</button><button type="button" className="pl-btn pl-btn-primary" disabled={edit.nome.trim().length < 2} onClick={() => void salvar()}>Salvar público</button></div>
    </section>
  )

  return (
    <>
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      <section className="dp-bloco">
        <div className="dp-bloco-topo">
          <div><h3>Públicos salvos</h3><p className="pl-hint">Um público guarda os critérios; a lista é montada de novo do CRM a cada campanha.</p></div>
          {pode && <button type="button" className="pl-btn pl-btn-primary" onClick={() => setEdit({ id: null, nome: '', descricao: '', definicao: { base: 'LEADS' } })}>Novo público</button>}
        </div>
        {!lista ? <p className="pl-hint" aria-busy="true">Carregando…</p> : !lista.length ? (
          <div className="pl-card dp-vazio-grande"><h3>Nenhum público salvo</h3><p className="pl-hint">Salve uma combinação de filtros que você usa sempre, ou comece de um público pronto abaixo.</p></div>
        ) : (
          <div className="dp-cartoes">
            {lista.map(p => (
              <article key={p.id} className="dp-cartao" data-publico-salvo={p.id}>
                <div className="dp-cartao-topo"><b>{p.nome}</b>{pode && <MenuAcoes itens={[{ rotulo: 'Arquivar', aoClicar: () => void arquivar(p) }]} />}</div>
                {p.descricao && <p className="pl-hint">{p.descricao}</p>}
                <Criterios d={p.definicao} />
                <div className="dp-cartao-rodape"><span className="pl-hint">atualizado <Quando iso={p.atualizadoEm} />{p.criadoPorNome ? ` · ${p.criadoPorNome}` : ''}</span>{pode && <button type="button" className="pl-btn" onClick={() => setEdit({ id: p.id, nome: p.nome, descricao: p.descricao ?? '', definicao: p.definicao })}>Editar</button>}</div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="dp-bloco" data-publicos-prontos>
        <div className="dp-bloco-topo"><div><h3>Públicos prontos</h3><p className="pl-hint">Aparecem na criação da campanha. {pode ? 'Para ajustar um deles e guardar, clique em “Personalizar”.' : ''}</p></div></div>
        {grupos.filter(g => g[2].length).map(([k, titulo, itens]) => (
          <div key={k} className="dp-galeria-prontos">
            <span className="dp-config-rotulo">{titulo}</span>
            <div className="dp-cartoes compactos">
              {itens.map(p => (
                <article key={p.chave} className="dp-cartao">
                  <b>{p.nome}</b>
                  {p.descricao && <p className="pl-hint">{p.descricao}</p>}
                  {pode && k !== 'INSTAGRAM' && <div className="dp-cartao-rodape"><span /><button type="button" className="pl-btn pl-btn-ghost" onClick={() => setEdit({ id: null, nome: p.nome, descricao: p.descricao ?? '', definicao: { ...p.definicao, predefinido: p.chave } })}>Personalizar</button></div>}
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  )
}

const ROT_SIT: Record<string, string> = { AUTORIZADO: 'Autorizou', REVOGADO: 'Pediu para sair', BLOQUEADO: 'Bloqueado' }
const ROT_ORIG: Record<string, string> = { MANUAL: 'registro manual', IMPORTACAO: 'lista importada', RESPOSTA_SAIR: 'respondeu SAIR', SISTEMA: 'sistema' }

function Autorizacoes() {
  const meta = useMeta()
  const avisar = useAvisar()
  const [tel, setTel] = useState('')
  const [situacao, setSituacao] = useState('')
  const [pagina, setPagina] = useState(0)
  const [d, setD] = useState<{ total: number; porPagina: number; atual: { situacao: string } | null; itens: AutorizacaoDisparo[] } | null>(null)
  const [novo, setNovo] = useState({ telefones: '', situacao: (meta.gestao ? 'AUTORIZADO' : 'REVOGADO') as 'AUTORIZADO' | 'REVOGADO' | 'BLOQUEADO', baseLegal: 'CONSENTIMENTO', evidencia: '' })
  const [aberto, setAberto] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(() => { disparoApi.autorizacoes.listar({ telefone: tel || undefined, situacao: situacao || undefined, pagina }).then(setD).catch(e => setErro(erroDe(e))) }, [tel, situacao, pagina])
  useEffect(() => { const t = setTimeout(carregar, 300); return () => clearTimeout(t) }, [carregar])
  useEffect(() => {
    if (!aberto) return
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aberto])
  const pode = meta.nivel === 'EDITAR'
  async function registrar() {
    const telefones = novo.telefones.split(/[\n,;]+/).map(x => x.trim()).filter(Boolean)
    if (!telefones.length) return
    setMsg(null)
    try {
      const r = await disparoApi.autorizacoes.registrar({ telefones, situacao: novo.situacao, baseLegal: novo.situacao === 'AUTORIZADO' ? novo.baseLegal : null, evidencia: novo.evidencia || null })
      if (r.invalidos.length) setMsg(`${r.registrados} registrado(s) · inválidos: ${r.invalidos.join(', ')}.`)
      else { avisar(`${r.registrados} registrado(s)`); setAberto(false) }
      setNovo({ ...novo, telefones: '', evidencia: '' }); carregar()
    } catch (e) { setMsg(erroDe(e)) }
  }
  return (
    <div data-disparo-autorizacoes>
      <p className="pl-hint dp-publico-guia">Mensagem promocional só vai para quem autorizou{meta.config.baseMarketing === 'RELACAO' ? ' ou já tem relação comercial com a loja' : ''}. Quem responde SAIR, PARAR ou CANCELAR sai sozinho de todas as promocionais. Bloqueado não recebe nada. Cada mudança fica no histórico e não pode ser apagada.</p>
      <div className="dp-ferramentas">
        <input className="pl-input dp-busca" type="search" placeholder="Consultar um telefone" value={tel} onChange={e => { setTel(e.target.value); setPagina(0) }} aria-label="Consultar um telefone" />
        <Segmentado rotulo="Situação" pequeno valor={situacao} mudar={s => { setSituacao(s); setPagina(0) }} opcoes={['', 'AUTORIZADO', 'REVOGADO', 'BLOQUEADO'].map(s => ({ valor: s, rotulo: s ? ROT_SIT[s] : 'Todas' }))} />
        {pode && <button type="button" className="pl-btn pl-btn-primary dp-ferramentas-fim" onClick={() => { setMsg(null); setAberto(true) }} data-registrar-autorizacao>Registrar autorização</button>}
      </div>
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      {d?.atual && <p className="pl-hint">Situação atual deste telefone: <span className={`dp-selo ${d.atual.situacao === 'AUTORIZADO' ? 'ok' : 'crit'}`}>{ROT_SIT[d.atual.situacao]}</span></p>}
      {d && (
        <div className="pl-card pl-table-wrap dp-tabela-cartao">
          <table className="pl-table">
            <thead><tr><th>Quando</th><th>Telefone</th><th>Situação</th><th>Base legal / evidência</th><th>Origem</th></tr></thead>
            <tbody>{d.itens.map(a => <tr key={a.id}><td title={dataHora(a.criadoEm)}><Quando iso={a.criadoEm} /></td><td className="pl-mono">{a.telefone}</td><td><span className={`dp-selo ${a.situacao === 'AUTORIZADO' ? 'ok' : a.situacao === 'BLOQUEADO' ? 'crit' : 'warn'}`}>{ROT_SIT[a.situacao]}</span></td><td className="pl-hint">{a.baseLegal ? meta.basesLegais.find(b => b.chave === a.baseLegal)?.rotulo : ''}{a.evidencia ? ` · ${a.evidencia}` : ''}</td><td className="pl-hint">{ROT_ORIG[a.origem] ?? a.origem}{a.registradoPorNome ? ` · ${a.registradoPorNome}` : ''}</td></tr>)}
              {!d.itens.length && <tr><td colSpan={5} className="pl-hint">Nenhum registro.</td></tr>}</tbody>
          </table>
          <Paginacao pagina={pagina} total={d.total} porPagina={d.porPagina} ir={setPagina} />
        </div>
      )}
      {aberto && (
        <div className="dp-modal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) setAberto(false) }}>
          <div className="dp-modal dp-modal-largo" role="dialog" aria-modal="true" aria-labelledby="au-titulo">
            <h3 id="au-titulo">Registrar autorização</h3>
            <div className="dp-modal-campos">
              <div className="pl-field"><label htmlFor="au-sit">Registrar como</label>
                <select id="au-sit" className="pl-select" value={novo.situacao} onChange={e => setNovo({ ...novo, situacao: e.target.value as typeof novo.situacao })}>
                  {meta.gestao && <option value="AUTORIZADO">Autorizou mensagens promocionais</option>}<option value="REVOGADO">Pediu para não receber</option><option value="BLOQUEADO">Bloquear (não recebe nada)</option>
                </select>
              </div>
              <div className="pl-field"><label htmlFor="au-tel">Telefone(s)</label><textarea id="au-tel" className="pl-input" rows={3} autoFocus value={novo.telefones} onChange={e => setNovo({ ...novo, telefones: e.target.value })} placeholder={meta.dono ? 'Um ou vários (um por linha)' : 'Um telefone'} /></div>
              {novo.situacao === 'AUTORIZADO' && <>
                <div className="pl-field"><label htmlFor="au-base">Base legal</label><select id="au-base" className="pl-select" value={novo.baseLegal} onChange={e => setNovo({ ...novo, baseLegal: e.target.value })}>{meta.basesLegais.map(b => <option key={b.chave} value={b.chave}>{b.rotulo}</option>)}</select></div>
                <div className="pl-field"><label htmlFor="au-evid">Evidência (onde e como autorizou)</label><input id="au-evid" className="pl-input" value={novo.evidencia} onChange={e => setNovo({ ...novo, evidencia: e.target.value })} placeholder="Ex.: termo assinado na loja em 20/11" /></div>
              </>}
            </div>
            {msg && <p className="pl-hint" role="status">{msg}</p>}
            <div className="dp-modal-acoes">
              <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setAberto(false)}>Voltar</button>
              <button type="button" className="pl-btn pl-btn-primary" disabled={!novo.telefones.trim()} onClick={() => void registrar()}>Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
