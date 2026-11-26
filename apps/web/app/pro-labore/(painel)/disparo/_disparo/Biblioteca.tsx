'use client'

// Biblioteca: modelos de mensagem (um ou mais passos) e arquivos (imagem, áudio, vídeo, documento),
// enviados do computador ou trazidos do Instagram da empresa. O arquivo é conferido no servidor pelo
// conteúdo, fica no armazenamento do sistema e só abre com login (ou por link temporário).
import { useCallback, useEffect, useState } from 'react'
import { disparoApi, type ConteudoDisparo, type MidiaDisparo, type ModeloDisparo } from '@/lib/proLaboreApi'
import { PassosEditor } from './PassosEditor'
import { erroDe, useMeta } from './util'
import { useAvisar, useConfirmar } from './ui'
import { EnviarDoComputador, ImportarDoInstagram, Miniatura, Visualizador, type TipoMidia } from './Midias'

export function Biblioteca() {
  const meta = useMeta()
  const confirmar = useConfirmar()
  const avisar = useAvisar()
  const [modelos, setModelos] = useState<ModeloDisparo[] | null>(null)
  const [midias, setMidias] = useState<MidiaDisparo[]>([])
  const [edit, setEdit] = useState<{ id: string | null; nome: string; conteudo: ConteudoDisparo } | null>(null)
  const [ver, setVer] = useState<MidiaDisparo | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<TipoMidia | 'TODOS'>('TODOS')
  const [ig, setIg] = useState(false)
  const carregar = useCallback(() => { void Promise.all([disparoApi.modelos.listar(), disparoApi.midias.listar()]).then(([a, b]) => { setModelos(a); setMidias(b) }).catch(e => setMsg(erroDe(e))) }, [])
  const recarregarMidias = useCallback(() => disparoApi.midias.listar().then(b => { setMidias(b); return b }), [])
  useEffect(() => { carregar() }, [carregar])
  const pode = meta.nivel === 'EDITAR'
  const visiveis = midias.filter(m => filtro === 'TODOS' || m.tipo === filtro)
  async function salvarModelo() {
    if (!edit) return
    try { if (edit.id) await disparoApi.modelos.salvar(edit.id, { nome: edit.nome, conteudo: edit.conteudo }); else await disparoApi.modelos.criar({ nome: edit.nome, conteudo: edit.conteudo }); setEdit(null); carregar() } catch (e) { setMsg(erroDe(e)) }
  }
  return (
    <div data-disparo-biblioteca>
      {msg && <p className="pl-hint" role="status">{msg}</p>}
      <section className="pl-card">
        <div className="dp-linha" style={{ justifyContent: 'space-between' }}><div className="pl-card-title">Modelos de mensagem</div>{pode && !edit && <button type="button" className="pl-btn pl-btn-primary" onClick={() => setEdit({ id: null, nome: '', conteudo: { passos: [{ tipo: 'TEXTO', texto: '' }] } })}>Novo modelo</button>}</div>
        {edit ? (
          <div>
            <div className="pl-field"><label htmlFor="md-nome">Nome do modelo</label><input id="md-nome" className="pl-input" value={edit.nome} onChange={e => setEdit({ ...edit, nome: e.target.value })} /></div>
            <PassosEditor conteudo={edit.conteudo} mudar={c => setEdit({ ...edit, conteudo: c })} midias={midias} recarregarMidias={recarregarMidias} />
            <div className="dp-linha dp-rodape"><button type="button" className="pl-btn" onClick={() => setEdit(null)}>Cancelar</button><button type="button" className="pl-btn pl-btn-primary" disabled={edit.nome.trim().length < 2} onClick={() => void salvarModelo()}>Salvar modelo</button></div>
          </div>
        ) : !modelos ? <p className="pl-hint">Carregando…</p> : !modelos.length ? <p className="pl-hint">Nenhum modelo ainda.</p> : (
          <ul className="ar-fila">{modelos.map(m => (
            <li key={m.id} className="ar-fila-item">
              <div><div className="ar-fila-titulo">{m.nome}</div><div className="pl-hint">{m.conteudo.passos.length} mensagem(ns) · {(m.conteudo.passos[0]?.texto ?? '').slice(0, 90)}</div></div>
              {pode && <span className="cc-chips"><button type="button" className="pl-btn" onClick={() => setEdit({ id: m.id, nome: m.nome, conteudo: m.conteudo })}>Editar</button><button type="button" className="pl-btn" onClick={() => void disparoApi.modelos.arquivar(m.id).then(carregar)}>Arquivar</button></span>}
            </li>
          ))}</ul>
        )}
      </section>
      <section className="pl-card" style={{ marginTop: 16 }} data-biblioteca-arquivos>
        <div className="dp-linha" style={{ justifyContent: 'space-between' }}>
          <div className="pl-card-title">Arquivos</div>
          {pode && meta.midias.instagram && <button type="button" className="pl-btn" onClick={() => setIg(true)} data-abrir-instagram>Importar do Instagram (@{meta.midias.instagram})</button>}
        </div>
        {pode && <EnviarDoComputador aoConcluir={ids => { void recarregarMidias(); setMsg(`${ids.length} arquivo(s) na Biblioteca.`) }} />}
        {pode && !meta.midias.instagram && <p className="pl-hint">Para trazer fotos e vídeos do Instagram, conecte o Instagram da empresa em Social Media.</p>}
        <div className="cc-chips" style={{ margin: '10px 0 6px' }}>
          {([['TODOS', 'Todos'], ['IMAGEM', 'Imagens'], ['VIDEO', 'Vídeos'], ['AUDIO', 'Áudios'], ['DOCUMENTO', 'Documentos']] as const).map(([v, r]) => <button key={v} type="button" className={`pl-chip ${filtro === v ? 'active' : ''}`} onClick={() => setFiltro(v)}>{r} ({v === 'TODOS' ? midias.length : midias.filter(m => m.tipo === v).length})</button>)}
        </div>
        {!visiveis.length ? <p className="pl-hint">Nenhum arquivo aqui ainda.</p> : <div className="dp-galeria">{visiveis.map(m => <Miniatura key={m.id} m={m} abrir={() => setVer(m)} />)}</div>}
      </section>
      {ver && <Visualizador m={ver} fechar={() => setVer(null)} acoes={pode ? <button type="button" className="pl-btn" onClick={() => void confirmar({ titulo: 'Tirar este arquivo da Biblioteca?', texto: 'Campanhas que já usam continuam funcionando.', acao: 'Tirar', perigo: true }).then(ok => { if (ok) void disparoApi.midias.arquivar(ver.id).then(() => { setVer(null); avisar('Arquivo tirado da Biblioteca'); void recarregarMidias() }) })}>Tirar da Biblioteca</button> : null} />}
      {ig && <ImportarDoInstagram fechar={() => setIg(false)} aoConcluir={ids => { void recarregarMidias(); setMsg(`${ids.length} arquivo(s) trazido(s) do Instagram.`) }} />}
    </div>
  )
}
