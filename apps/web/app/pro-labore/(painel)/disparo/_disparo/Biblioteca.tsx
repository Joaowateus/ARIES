'use client'

// Biblioteca: modelos de mensagem (um ou mais passos) e arquivos (imagem, áudio, vídeo, documento),
// enviados do computador ou trazidos do Instagram da empresa. O arquivo é conferido no servidor pelo
// conteúdo, fica no armazenamento do sistema e só abre com login (ou por link temporário).
// Redesign 26/11: abas Arquivos | Modelos, filtros e busca numa barra, soltar arquivos em qualquer
// lugar da aba e modelos mostrados como balões de mensagem. As mesmas chamadas.
import { useCallback, useEffect, useState } from 'react'
import { disparoApi, type ConteudoDisparo, type MidiaDisparo, type ModeloDisparo } from '@/lib/proLaboreApi'
import { PassosEditor } from './PassosEditor'
import { erroDe, n, useMeta } from './util'
import { MenuAcoes, Quando, Segmentado, useAvisar, useConfirmar } from './ui'
import { EnviarDoComputador, ImportarDoInstagram, Miniatura, Visualizador, type TipoMidia } from './Midias'

const ROT_MIDIA: Record<string, string> = { IMAGEM: 'Imagem', AUDIO: 'Áudio', VIDEO: 'Vídeo', DOCUMENTO: 'Documento' }
const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function Biblioteca() {
  const meta = useMeta()
  const confirmar = useConfirmar()
  const avisar = useAvisar()
  const [aba, setAba] = useState<'arquivos' | 'modelos'>('arquivos')
  const [modelos, setModelos] = useState<ModeloDisparo[] | null>(null)
  const [midias, setMidias] = useState<MidiaDisparo[] | null>(null)
  const [edit, setEdit] = useState<{ id: string | null; nome: string; conteudo: ConteudoDisparo } | null>(null)
  const [ver, setVer] = useState<MidiaDisparo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<TipoMidia | 'TODOS'>('TODOS')
  const [busca, setBusca] = useState('')
  const [ig, setIg] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [soltos, setSoltos] = useState<{ arquivos: File[]; n: number } | null>(null)
  const carregar = useCallback(() => { void Promise.all([disparoApi.modelos.listar(), disparoApi.midias.listar()]).then(([a, b]) => { setModelos(a); setMidias(b) }).catch(e => setErro(erroDe(e))) }, [])
  const recarregarMidias = useCallback(() => disparoApi.midias.listar().then(b => { setMidias(b); return b }), [])
  useEffect(() => { carregar() }, [carregar])
  const pode = meta.nivel === 'EDITAR'
  const todas = midias ?? []
  const q = sem(busca.trim())
  const visiveis = todas.filter(m => (filtro === 'TODOS' || m.tipo === filtro) && (!q || sem(m.nome).includes(q)))
  const modelosVisiveis = (modelos ?? []).filter(m => !q || sem(m.nome).includes(q) || m.conteudo.passos.some(p => sem(p.texto ?? '').includes(q)))
  const aoEnviar = useCallback((ids: string[]) => { void recarregarMidias(); avisar(`${ids.length} arquivo(s) na Biblioteca`) }, [recarregarMidias, avisar])

  async function salvarModelo() {
    if (!edit) return
    try {
      if (edit.id) await disparoApi.modelos.salvar(edit.id, { nome: edit.nome, conteudo: edit.conteudo }); else await disparoApi.modelos.criar({ nome: edit.nome, conteudo: edit.conteudo })
      setEdit(null); avisar('Modelo salvo'); carregar()
    } catch (e) { setErro(erroDe(e)) }
  }
  async function arquivarModelo(m: ModeloDisparo) {
    if (!(await confirmar({ titulo: `Arquivar o modelo “${m.nome}”?`, texto: 'Ele sai da Biblioteca. Campanhas que já usaram continuam com as mensagens delas.', acao: 'Arquivar' }))) return
    try { await disparoApi.modelos.arquivar(m.id); avisar('Modelo arquivado'); carregar() } catch (e) { avisar(erroDe(e), 'erro') }
  }

  if (edit) return (
    <section className="pl-card" data-disparo-biblioteca>
      <header className="dp-assist-topo"><div><h2>{edit.id ? `Editar: ${edit.nome}` : 'Novo modelo'}</h2><p className="pl-hint">Um modelo é um ponto de partida: na campanha você ajusta à vontade.</p></div><button type="button" className="pl-btn pl-btn-ghost" onClick={() => setEdit(null)}>Fechar</button></header>
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      <div className="pl-field" style={{ margin: '12px 0' }}><label htmlFor="md-nome">Nome do modelo</label><input id="md-nome" className="pl-input" value={edit.nome} onChange={e => setEdit({ ...edit, nome: e.target.value })} /></div>
      <PassosEditor conteudo={edit.conteudo} mudar={c => setEdit({ ...edit, conteudo: c })} midias={todas} recarregarMidias={recarregarMidias} />
      <div className="dp-linha dp-rodape"><button type="button" className="pl-btn pl-btn-ghost" onClick={() => setEdit(null)}>Cancelar</button><button type="button" className="pl-btn pl-btn-primary" disabled={edit.nome.trim().length < 2} onClick={() => void salvarModelo()}>Salvar modelo</button></div>
    </section>
  )

  return (
    <div data-disparo-biblioteca>
      <div className="dp-subabas" role="tablist" aria-label="Biblioteca">
        <button type="button" role="tab" aria-selected={aba === 'arquivos'} className={aba === 'arquivos' ? 'on' : ''} onClick={() => setAba('arquivos')}>Arquivos{midias && <small>{todas.length}</small>}</button>
        <button type="button" role="tab" aria-selected={aba === 'modelos'} className={aba === 'modelos' ? 'on' : ''} onClick={() => setAba('modelos')} data-aba-modelos>Modelos{modelos && <small>{modelos.length}</small>}</button>
      </div>
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}

      {aba === 'arquivos' ? (
        <section className={`dp-biblio${arrastando ? ' sobre' : ''}`} data-biblioteca-arquivos
          onDragOver={e => { if (!pode || !e.dataTransfer.types.includes('Files')) return; e.preventDefault(); setArrastando(true) }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false) }}
          onDrop={e => { if (!pode) return; e.preventDefault(); setArrastando(false); const fs = [...e.dataTransfer.files]; if (fs.length) setSoltos(s => ({ arquivos: fs, n: (s?.n ?? 0) + 1 })) }}>
          <div className="dp-ferramentas">
            <Segmentado rotulo="Tipo de arquivo" pequeno valor={filtro} mudar={setFiltro} opcoes={([['TODOS', 'Todos'], ['IMAGEM', 'Imagens'], ['VIDEO', 'Vídeos'], ['AUDIO', 'Áudios'], ['DOCUMENTO', 'Documentos']] as const).map(([v, r]) => ({ valor: v, rotulo: <>{r} <small className="dp-seg-n">{v === 'TODOS' ? todas.length : todas.filter(m => m.tipo === v).length}</small></> }))} />
            <input className="pl-input dp-busca" type="search" placeholder="Buscar pelo nome" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar arquivo pelo nome" />
            {pode && meta.midias.instagram && <button type="button" className="pl-btn dp-ferramentas-fim" onClick={() => setIg(true)} data-abrir-instagram>Importar do Instagram</button>}
          </div>
          {pode && <EnviarDoComputador aoConcluir={aoEnviar} soltos={soltos} />}
          {pode && !meta.midias.instagram && <p className="pl-hint">Para trazer fotos e vídeos do Instagram, conecte o Instagram da empresa em Social Media.</p>}
          {!midias ? <p className="pl-hint" aria-busy="true">Carregando…</p> : !visiveis.length ? (
            <div className="pl-card dp-vazio-grande"><h3>{todas.length ? 'Nada com esse filtro' : 'Nenhum arquivo ainda'}</h3><p className="pl-hint">{todas.length ? 'Mude o tipo ou a busca.' : pode ? 'Arraste fotos, vídeos, áudios ou PDFs para cá.' : 'Quem edita o Disparo pode enviar arquivos.'}</p></div>
          ) : <div className="dp-galeria">{visiveis.map(m => <Miniatura key={m.id} m={m} abrir={() => setVer(m)} />)}</div>}
          {arrastando && <div className="dp-soltar" aria-hidden="true"><b>Solte para enviar à Biblioteca</b><span>Qualidade original, sem compressão</span></div>}
        </section>
      ) : (
        <section data-biblioteca-modelos>
          <div className="dp-ferramentas">
            <input className="pl-input dp-busca" type="search" placeholder="Buscar pelo nome ou texto" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar modelo" />
            {pode && <button type="button" className="pl-btn pl-btn-primary dp-ferramentas-fim" onClick={() => setEdit({ id: null, nome: '', conteudo: { passos: [{ tipo: 'TEXTO', texto: '' }] } })}>Novo modelo</button>}
          </div>
          {!modelos ? <p className="pl-hint" aria-busy="true">Carregando…</p> : !modelosVisiveis.length ? (
            <div className="pl-card dp-vazio-grande"><h3>{modelos.length ? 'Nenhum modelo com essa busca' : 'Nenhum modelo ainda'}</h3><p className="pl-hint">Guarde as mensagens que a equipe usa sempre; na campanha, é só escolher.</p></div>
          ) : (
            <div className="dp-cartoes">
              {modelosVisiveis.map(m => (
                <article key={m.id} className="dp-cartao dp-modelo" data-modelo={m.id}>
                  <div className="dp-cartao-topo"><b>{m.nome}</b>{pode && <MenuAcoes itens={[{ rotulo: 'Arquivar', aoClicar: () => void arquivarModelo(m) }]} />}</div>
                  <div className="dp-balao-area">
                    {m.conteudo.passos.slice(0, 2).map((p, i) => (
                      <div key={i} className="dp-balao">
                        {p.tipo !== 'TEXTO' && <span className="dp-balao-midia">{ROT_MIDIA[p.tipo] ?? p.tipo}</span>}
                        {p.texto ? <p>{p.texto}</p> : p.tipo === 'TEXTO' ? <p className="dp-balao-vazio">mensagem vazia</p> : null}
                      </div>
                    ))}
                    {m.conteudo.passos.length > 2 && <small className="pl-hint">+ {m.conteudo.passos.length - 2} mensagem(ns)</small>}
                  </div>
                  <div className="dp-cartao-rodape"><span className="pl-hint">{n(m.conteudo.passos.length)} mensagem(ns) · <Quando iso={m.atualizadoEm} />{m.criadoPorNome ? ` · ${m.criadoPorNome}` : ''}</span>{pode && <button type="button" className="pl-btn" onClick={() => setEdit({ id: m.id, nome: m.nome, conteudo: m.conteudo })}>Editar</button>}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {ver && <Visualizador m={ver} fechar={() => setVer(null)} acoes={pode ? <button type="button" className="pl-btn" onClick={() => void confirmar({ titulo: 'Tirar este arquivo da Biblioteca?', texto: 'Campanhas que já usam continuam funcionando.', acao: 'Tirar', perigo: true }).then(ok => { if (ok) void disparoApi.midias.arquivar(ver.id).then(() => { setVer(null); avisar('Arquivo tirado da Biblioteca'); void recarregarMidias() }) })}>Tirar da Biblioteca</button> : null} />}
      {ig && <ImportarDoInstagram fechar={() => setIg(false)} aoConcluir={ids => { void recarregarMidias(); avisar(`${ids.length} arquivo(s) trazido(s) do Instagram`) }} />}
    </div>
  )
}
