'use client'

// Biblioteca: modelos de mensagem (um ou mais passos) e arquivos (imagem, áudio, vídeo, documento).
// O arquivo é conferido no servidor pelo conteúdo, fica no armazenamento do sistema e só abre com login.
import { useCallback, useEffect, useState } from 'react'
import { disparoApi, type ConteudoDisparo, type MidiaDisparo, type ModeloDisparo } from '@/lib/proLaboreApi'
import { PassosEditor } from './PassosEditor'
import { dataHora, erroDe, useMeta } from './util'

function Previa({ m }: { m: MidiaDisparo }) {
  const [url, setUrl] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    let u: string | null = null
    disparoApi.midias.arquivo(m.id).then(b => { u = URL.createObjectURL(b); setUrl(u) }).catch(e => setErro(erroDe(e)))
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [m.id])
  if (erro) return <span className="pl-hint">{erro}</span>
  if (!url) return <span className="pl-hint">carregando…</span>
  // eslint-disable-next-line @next/next/no-img-element
  if (m.tipo === 'IMAGEM') return <img src={url} alt={m.nome} className="dp-midia" />
  if (m.tipo === 'AUDIO') return <audio src={url} controls />
  if (m.tipo === 'VIDEO') return <video src={url} controls className="dp-midia" />
  return <a href={url} target="_blank" rel="noreferrer" download={m.nome}>Abrir {m.nome}</a>
}

export function Biblioteca() {
  const meta = useMeta()
  const [modelos, setModelos] = useState<ModeloDisparo[] | null>(null)
  const [midias, setMidias] = useState<MidiaDisparo[]>([])
  const [edit, setEdit] = useState<{ id: string | null; nome: string; conteudo: ConteudoDisparo } | null>(null)
  const [ver, setVer] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const carregar = useCallback(() => { void Promise.all([disparoApi.modelos.listar(), disparoApi.midias.listar()]).then(([a, b]) => { setModelos(a); setMidias(b) }).catch(e => setMsg(erroDe(e))) }, [])
  useEffect(() => { carregar() }, [carregar])
  const pode = meta.nivel === 'EDITAR'
  async function enviar(f: File | undefined) {
    if (!f) return
    if (f.size > meta.capacidades.maxMidiaBytes) { setMsg(`Arquivo grande demais (máx. ${Math.round(meta.capacidades.maxMidiaBytes / 1024 / 1024)} MB)`); return }
    setEnviando(true); setMsg(null)
    try { await disparoApi.midias.enviar(f); setMsg('Arquivo guardado.'); carregar() } catch (e) { setMsg(erroDe(e)) } finally { setEnviando(false) }
  }
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
            <PassosEditor conteudo={edit.conteudo} mudar={c => setEdit({ ...edit, conteudo: c })} midias={midias} />
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
      <section className="pl-card" style={{ marginTop: 16 }}>
        <div className="dp-linha" style={{ justifyContent: 'space-between' }}>
          <div className="pl-card-title">Arquivos</div>
          {pode && <label className="pl-btn pl-btn-primary" style={{ cursor: 'pointer' }}>{enviando ? 'Enviando…' : 'Enviar arquivo'}<input type="file" hidden accept="image/jpeg,image/png,image/webp,audio/*,video/mp4,video/3gpp,application/pdf,.doc,.docx,.xls,.xlsx" onChange={e => void enviar(e.target.files?.[0])} disabled={enviando} /></label>}
        </div>
        <p className="pl-hint">Imagem (JPG, PNG, WebP), áudio (MP3, OGG, M4A — vai como mensagem de voz), vídeo (MP4), PDF, Word ou Excel, até {Math.round(meta.capacidades.maxMidiaBytes / 1024 / 1024)} MB.</p>
        {!midias.length ? <p className="pl-hint">Nenhum arquivo.</p> : (
          <ul className="ar-fila">{midias.map(m => (
            <li key={m.id} className="ar-fila-item" style={{ flexWrap: 'wrap' }}>
              <div><div className="ar-fila-titulo">{m.nome}</div><div className="pl-hint">{m.tipo.toLowerCase()} · {Math.round(m.tamanho / 1024)} KB · {dataHora(m.criadoEm)}{m.criadoPorNome ? ` · ${m.criadoPorNome}` : ''}</div>{ver === m.id && <Previa m={m} />}</div>
              <span className="cc-chips"><button type="button" className="pl-btn" onClick={() => setVer(v => (v === m.id ? null : m.id))}>{ver === m.id ? 'Fechar' : 'Ver'}</button>{pode && <button type="button" className="pl-btn" onClick={() => void disparoApi.midias.arquivar(m.id).then(carregar)}>Arquivar</button>}</span>
            </li>
          ))}</ul>
        )}
      </section>
    </div>
  )
}
