'use client'

// Construtor de públicos: prontos, filtros E/OU (com um nível de subgrupo), seleção manual e a prévia
// (contagem, motivos de exclusão e a lista paginada no servidor — nunca milhares de contatos no navegador).
import { useCallback, useEffect, useRef, useState } from 'react'
import { disparoApi, type CondicaoDisparo, type ConteudoDisparo, type DefinicaoPublicoDisparo, type FinalidadeDisparo, type GrupoDisparo, type PreviaPublicoDisparo } from '@/lib/proLaboreApi'
import { Paginacao, erroDe, n, useMeta } from './util'

const BASES: Array<{ valor: DefinicaoPublicoDisparo['base']; rotulo: string }> = [
  { valor: 'TODOS', rotulo: 'Todos os contatos' }, { valor: 'LEADS', rotulo: 'Leads' }, { valor: 'CLIENTES', rotulo: 'Clientes' }, { valor: 'CONTATARAM', rotulo: 'Quem já escreveu no WhatsApp' }, { valor: 'EQUIPE', rotulo: 'Equipe (WhatsApp conectado)' },
]
const OPS: Record<string, string> = { igual: 'é', em: 'é um destes', contem: 'contém', vazio: 'está vazio', entre: 'entre', ultimos_dias: 'nos últimos (dias)', ha_mais_de_dias: 'há mais de (dias)', maior: 'maior que', menor: 'menor que' }
const ETAPAS = ['LEAD', 'ABORDADO', 'LEVANTAMENTO', 'MQL', 'SQL', 'NEGOCIACAO', 'PROPOSTA', 'AGENDAMENTO', 'VISITA', 'VENDA']
const OPCOES: Record<string, Array<[string, string]>> = {
  situacao: [['ABERTO', 'Lead aberto'], ['PERDIDO', 'Lead perdido'], ['FECHADO', 'Lead com venda'], ['CLIENTE', 'Cliente'], ['CONTATO', 'Só conversa no WhatsApp'], ['EQUIPE', 'Equipe']],
  etapa: ETAPAS.map(e => [e, e.charAt(0) + e.slice(1).toLowerCase()]),
  regiao: [['Norte', 'Norte'], ['Nordeste', 'Nordeste'], ['Centro-Oeste', 'Centro-Oeste'], ['Sudeste', 'Sudeste'], ['Sul', 'Sul']],
  temperatura: [['QUENTE', 'Quente'], ['MORNO', 'Morno'], ['FRIO', 'Frio']],
  interacoes: [['CONVERSOU', 'Já conversou no WhatsApp'], ['NUNCA_CONVERSOU', 'Nunca conversou'], ['VISITOU', 'Teve visita'], ['PROPOSTA', 'Recebeu proposta']],
  reativado: [['true', 'Sim'], ['false', 'Não']],
  autorizacao: [['AUTORIZADO', 'Autorizou'], ['REVOGADO', 'Pediu para sair'], ['BLOQUEADO', 'Bloqueado'], ['SEM_REGISTRO', 'Sem registro']],
  destino_perda: [['REATIVACAO', 'Reativação']],
}
const ehGrupo = (x: CondicaoDisparo | GrupoDisparo): x is GrupoDisparo => Array.isArray((x as GrupoDisparo).itens)

function ValorCondicao({ c, mudar }: { c: CondicaoDisparo; mudar: (v: unknown) => void }) {
  const meta = useMeta()
  if (c.op === 'vazio') return null
  const opcoes = c.campo === 'vendedor' ? meta.vendedores.map(v => [v.id, v.nome] as [string, string]) : OPCOES[c.campo]
  if (c.op === 'entre') {
    const [a, b] = (Array.isArray(c.valor) ? c.valor : ['', '']) as string[]
    const tipo = ['cadastro', 'ultimo_contato', 'ultima_compra'].includes(c.campo) ? 'date' : 'number'
    return <><input className="pl-input dp-curto" type={tipo} value={a ?? ''} onChange={e => mudar([e.target.value, b])} aria-label="De" /><span className="pl-hint">e</span><input className="pl-input dp-curto" type={tipo} value={b ?? ''} onChange={e => mudar([a, e.target.value])} aria-label="Até" /></>
  }
  if (c.op === 'em' && opcoes) {
    const sel = new Set(Array.isArray(c.valor) ? (c.valor as string[]) : [])
    return <span className="cc-chips">{opcoes.map(([v, r]) => <button key={v} type="button" className={`pl-chip ${sel.has(v) ? 'active' : ''}`} onClick={() => { const s = new Set(sel); if (s.has(v)) s.delete(v); else s.add(v); mudar([...s]) }}>{r}</button>)}</span>
  }
  if (opcoes) return <select className="pl-select" value={String(c.valor ?? '')} onChange={e => mudar(e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value)} aria-label="Valor"><option value="">Escolha…</option>{opcoes.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
  const numerico = ['ultimos_dias', 'ha_mais_de_dias', 'maior', 'menor'].includes(c.op)
  return <input className="pl-input dp-curto" type={numerico ? 'number' : 'text'} value={String(c.valor ?? '')} onChange={e => mudar(numerico ? Number(e.target.value) : e.target.value)} placeholder={c.op === 'em' ? 'separe por vírgula' : ''} aria-label="Valor" />
}

function EditorGrupo({ g, mudar, nivel = 0, remover }: { g: GrupoDisparo; mudar: (g: GrupoDisparo) => void; nivel?: number; remover?: () => void }) {
  const meta = useMeta()
  const campos = meta.campos.filter(c => c.campo !== 'vendedor' || meta.gestao)
  const setItem = (i: number, it: CondicaoDisparo | GrupoDisparo) => mudar({ ...g, itens: g.itens.map((x, j) => (j === i ? it : x)) })
  const tirar = (i: number) => mudar({ ...g, itens: g.itens.filter((_, j) => j !== i) })
  return (
    <div className={`dp-grupo ${nivel ? 'dp-subgrupo' : ''}`}>
      <div className="dp-linha">
        <span className="pl-hint">{nivel ? 'Subgrupo:' : 'Combinar as condições com'}</span>
        {(['E', 'OU'] as const).map(o => <button key={o} type="button" className={`pl-chip ${g.op === o ? 'active' : ''}`} onClick={() => mudar({ ...g, op: o })}>{o === 'E' ? 'E (todas)' : 'OU (qualquer uma)'}</button>)}
        {remover && <button type="button" className="pl-btn" onClick={remover}>Tirar subgrupo</button>}
      </div>
      {g.itens.map((it, i) => ehGrupo(it) ? (
        <EditorGrupo key={i} g={it} nivel={nivel + 1} mudar={x => setItem(i, x)} remover={() => tirar(i)} />
      ) : (
        <div key={i} className="dp-condicao">
          <select className="pl-select" value={it.campo} onChange={e => { const campo = e.target.value; const op = meta.campos.find(c => c.campo === campo)?.ops[0] ?? 'igual'; setItem(i, { campo, op, valor: undefined }) }} aria-label="Campo">
            {campos.map(c => <option key={c.campo} value={c.campo}>{c.rotulo}</option>)}
          </select>
          <select className="pl-select" value={it.op} onChange={e => setItem(i, { ...it, op: e.target.value, valor: undefined })} aria-label="Operador">
            {(meta.campos.find(c => c.campo === it.campo)?.ops ?? []).map(o => <option key={o} value={o}>{OPS[o] ?? o}</option>)}
          </select>
          <ValorCondicao c={it} mudar={v => setItem(i, { ...it, valor: it.op === 'em' && typeof v === 'string' ? v.split(',').map(x => x.trim()).filter(Boolean) : v })} />
          <button type="button" className="pl-btn" onClick={() => tirar(i)} aria-label="Tirar condição">✕</button>
        </div>
      ))}
      <div className="dp-linha">
        <button type="button" className="pl-btn" onClick={() => mudar({ ...g, itens: [...g.itens, { campo: 'situacao', op: 'igual', valor: 'ABERTO' }] })}>+ Condição</button>
        {nivel === 0 && <button type="button" className="pl-btn" onClick={() => mudar({ ...g, itens: [...g.itens, { op: g.op === 'E' ? 'OU' : 'E', itens: [] }] })}>+ Subgrupo</button>}
      </div>
    </div>
  )
}

export function PublicoEditor({ definicao, mudar, finalidade, conteudo, assistenteId }: { definicao: DefinicaoPublicoDisparo; mudar: (d: DefinicaoPublicoDisparo) => void; finalidade: FinalidadeDisparo; conteudo?: ConteudoDisparo | null; assistenteId?: string | null }) {
  const meta = useMeta()
  const [busca, setBusca] = useState('')
  const [achados, setAchados] = useState<Awaited<ReturnType<typeof disparoApi.publicos.contatos>>['itens']>([])
  const [previa, setPrevia] = useState<PreviaPublicoDisparo | null>(null)
  const [verExcluidos, setVerExcluidos] = useState(false)
  const [pagina, setPagina] = useState(0)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const ultima = useRef(0)
  const manual = definicao.manual ?? {}
  const filtros = definicao.filtros ?? { op: 'E', itens: [] }

  const atualizar = useCallback(async (p = 0, exc = verExcluidos) => {
    const id = ++ultima.current
    setCarregando(true); setErro(null)
    try {
      const r = await disparoApi.publicos.previa({ definicao, finalidade, conteudo: conteudo ?? null, assistenteId: assistenteId ?? null, pagina: p, excluidos: exc })
      if (id === ultima.current) { setPrevia(r); setPagina(p) }
    } catch (e) { if (id === ultima.current) setErro(erroDe(e)) } finally { if (id === ultima.current) setCarregando(false) }
  }, [definicao, finalidade, conteudo, assistenteId, verExcluidos])
  useEffect(() => { const t = setTimeout(() => void atualizar(0), 600); return () => clearTimeout(t) }, [atualizar])
  useEffect(() => {
    if (busca.trim().length < 2) return
    const t = setTimeout(() => { disparoApi.publicos.contatos(busca).then(r => setAchados(r.itens)).catch(() => setAchados([])) }, 350)
    return () => clearTimeout(t)
  }, [busca])

  const incluidos = manual.incluir ?? []
  return (
    <div className="dp-publico" data-publico-editor>
      <div className="pl-field"><label>Públicos prontos</label>
        <div className="cc-chips">
          {meta.predefinidos.map(p => <button key={p.chave} type="button" title={p.descricao} className={`pl-chip ${definicao.predefinido === p.chave ? 'active' : ''}`} onClick={() => mudar({ ...p.definicao, predefinido: p.chave, manual: definicao.manual })}>{p.nome}</button>)}
        </div>
      </div>
      <div className="pl-field-grid" style={{ marginTop: 12 }}>
        <div className="pl-field"><label htmlFor="dp-base">De onde vêm os contatos</label>
          <select id="dp-base" className="pl-select" value={definicao.base} onChange={e => mudar({ ...definicao, base: e.target.value as DefinicaoPublicoDisparo['base'], predefinido: null })}>
            {BASES.map(b => <option key={b.valor} value={b.valor}>{b.rotulo}</option>)}
          </select>
        </div>
      </div>
      <div className="pl-field" style={{ marginTop: 12 }}><label>Filtros</label>
        <EditorGrupo g={filtros} mudar={g => mudar({ ...definicao, filtros: g, predefinido: null })} />
      </div>
      <div className="pl-field" style={{ marginTop: 12 }}><label htmlFor="dp-busca">Seleção manual</label>
        <input id="dp-busca" className="pl-input" placeholder="Buscar contato por nome ou telefone" value={busca} onChange={e => setBusca(e.target.value)} />
        {busca.trim().length >= 2 && achados.length > 0 && (
          <ul className="ar-fila" style={{ marginTop: 6 }}>
            {achados.map(a => (
              <li key={`${a.tipo}:${a.id}`} className="ar-fila-item">
                <div><div className="ar-fila-titulo">{a.nome}</div><div className="pl-hint">{a.telefone ?? 'sem telefone'} · {a.situacao.toLowerCase()}{a.vendedor ? ` · ${a.vendedor}` : ''}</div></div>
                <button type="button" className="pl-btn" disabled={incluidos.some(x => x.id === a.id)} onClick={() => mudar({ ...definicao, manual: { ...manual, incluir: [...incluidos, { tipo: a.tipo, id: a.id, nome: a.nome }] } })}>Adicionar</button>
              </li>
            ))}
          </ul>
        )}
        {incluidos.length > 0 && (
          <div className="cc-chips" style={{ marginTop: 6 }}>
            {incluidos.map(x => <button key={x.id} type="button" className="pl-chip active" onClick={() => mudar({ ...definicao, manual: { ...manual, incluir: incluidos.filter(y => y.id !== x.id) } })} title="Tirar">{x.nome ?? x.id} ✕</button>)}
            <label className="pl-hint" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={!!manual.apenasManual} onChange={e => mudar({ ...definicao, manual: { ...manual, apenasManual: e.target.checked } })} /> Só estes (ignorar a base e os filtros)</label>
          </div>
        )}
        {(manual.excluir ?? []).length > 0 && <p className="pl-hint">{manual.excluir!.length} número(s) tirado(s) à mão. <button type="button" className="pl-btn" onClick={() => mudar({ ...definicao, manual: { ...manual, excluir: [] } })}>Devolver todos</button></p>}
      </div>

      <section className="dp-previa" aria-live="polite" data-previa>
        <div className="dp-linha" style={{ justifyContent: 'space-between' }}>
          <b>Prévia dos destinatários</b>
          <button type="button" className="pl-btn" onClick={() => void atualizar(0)} disabled={carregando}>{carregando ? 'Contando…' : 'Atualizar'}</button>
        </div>
        {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
        {previa && (
          <>
            <div className="dp-totais">
              <div><span>Selecionados</span><b>{n(previa.selecionados)}</b></div>
              <div><span>Vão receber</span><b data-elegiveis>{n(previa.elegiveis)}</b></div>
              <div><span>Excluídos</span><b>{n(previa.excluidos)}</b></div>
            </div>
            {Object.keys(previa.porMotivo).length > 0 && (
              <ul className="pl-hint" style={{ margin: '6px 0', paddingLeft: 18 }}>
                {Object.entries(previa.porMotivo).sort((a, b) => b[1] - a[1]).map(([m, q]) => <li key={m}>{meta.motivos[m] ?? m}: <b>{n(q)}</b></li>)}
              </ul>
            )}
            {finalidade === 'MARKETING' && previa.porMotivo.SEM_AUTORIZACAO > 0 && <p className="pl-hint">Mensagem promocional só vai para quem autorizou (registre em Públicos › Autorizações){meta.config.baseMarketing === 'RELACAO' ? ' ou já tem relação comercial com a loja' : ''}.</p>}
            {previa.exemplo && <div className="dp-exemplo"><span className="pl-hint">Como o primeiro contato vai receber:</span>{previa.exemplo.map((t, i) => <p key={i}>{t || <i>(arquivo)</i>}</p>)}</div>}
            <div className="dp-linha">
              <button type="button" className={`pl-chip ${!verExcluidos ? 'active' : ''}`} onClick={() => { setVerExcluidos(false); void atualizar(0, false) }}>Quem vai receber</button>
              <button type="button" className={`pl-chip ${verExcluidos ? 'active' : ''}`} onClick={() => { setVerExcluidos(true); void atualizar(0, true) }}>Excluídos</button>
            </div>
            <div className="pl-table-wrap">
              <table className="pl-table">
                <thead><tr><th>Contato</th><th>Telefone</th><th>Situação</th><th>Vendedor</th><th>{verExcluidos ? 'Motivo' : 'Autorização'}</th><th /></tr></thead>
                <tbody>
                  {previa.pagina.map((c, i) => (
                    <tr key={`${c.telefoneCompleto ?? i}`}>
                      <td>{c.nome}</td><td className="pl-mono">{c.telefone ?? '—'}</td><td>{c.situacao.toLowerCase()}{c.etapa ? ` · ${c.etapa.toLowerCase()}` : ''}</td><td>{c.vendedor ?? '—'}</td>
                      <td>{verExcluidos ? meta.motivos[c.motivo ?? ''] ?? c.motivo : c.autorizacao === 'AUTORIZADO' ? 'autorizou' : 'sem registro'}</td>
                      <td>{!verExcluidos && c.telefoneCompleto && <button type="button" className="pl-btn" onClick={() => mudar({ ...definicao, manual: { ...manual, excluir: [...(manual.excluir ?? []), c.telefoneCompleto!] } })}>Tirar</button>}</td>
                    </tr>
                  ))}
                  {!previa.pagina.length && <tr><td colSpan={6} className="pl-hint">Ninguém nesta lista.</td></tr>}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={pagina} total={previa.total} porPagina={previa.porPagina} ir={p => void atualizar(p)} />
          </>
        )}
      </section>
    </div>
  )
}
