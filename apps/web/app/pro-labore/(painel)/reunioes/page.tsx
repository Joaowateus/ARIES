'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  proLaboreApi, Bloco, CATEGORIAS_NOTA, CategoriaNota, Nota, Pasta, Reuniao, ReuniaoDetalhe, ReuniaoResumo, TIPOS_REUNIAO, TipoReuniao,
} from '@/lib/proLaboreApi'
import { PageHeader } from '../../PageHeader'
import EditorBlocos from './EditorBlocos'

const EMOJIS_NOTA = ['📄', '📝', '💡', '🎯', '📌', '✅', '🔥', '📊', '🚀', '⭐', '🗂️', '📅', '💬', '🧠', '⚙️', '📈', '📚', '🧩']

const ABAS = [
  { valor: 'REUNIOES' as const, rotulo: 'Reuniões' },
  { valor: 'ANOTACOES' as const, rotulo: 'Anotações' },
]

const TIPO_LABEL: Record<TipoReuniao, string> = { REUNIAO: 'Reunião', AULA: 'Aula', VIDEO: 'Vídeo', OUTRO: 'Outro' }
const CATEGORIA_LABEL: Record<CategoriaNota, string> = { TRABALHO: 'Trabalho', IDEIA: 'Ideia', APRENDIZADO: 'Aprendizado', OUTRO: 'Outro' }

function formatarDuracao(segundos?: number | null): string | null {
  if (!segundos || segundos <= 0) return null
  const min = Math.floor(segundos / 60)
  const seg = Math.round(segundos % 60)
  if (min === 0) return `${seg}s`
  const h = Math.floor(min / 60)
  const minRestante = min % 60
  if (h > 0) return `${h}h${String(minRestante).padStart(2, '0')}`
  return `${min}min${String(seg).padStart(2, '0')}`
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Lê a duração de um arquivo de áudio/vídeo localmente, sem enviar os bytes
// pra lugar nenhum — só metadado, direto no navegador.
function lerDuracaoArquivo(file: File): Promise<number | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const elemento = document.createElement(file.type.startsWith('video') ? 'video' : 'audio')
    const limpar = () => URL.revokeObjectURL(url)
    elemento.preload = 'metadata'
    elemento.onloadedmetadata = () => { const d = elemento.duration; limpar(); resolve(Number.isFinite(d) ? d : null) }
    elemento.onerror = () => { limpar(); resolve(null) }
    elemento.src = url
  })
}

function FormNovaReuniao({ onCriada, onCancelar }: { onCriada: (r: Reuniao) => void; onCancelar: () => void }) {
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoReuniao>('REUNIAO')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [duracaoSegundos, setDuracaoSegundos] = useState<number | null>(null)
  const [transcricao, setTranscricao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function selecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setArquivo(file)
    if (file) {
      if (!titulo) setTitulo(file.name.replace(/\.[^/.]+$/, ''))
      setDuracaoSegundos(await lerDuracaoArquivo(file))
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!titulo.trim()) { setErro('Dê um título pra reunião'); return }
    setSalvando(true)
    try {
      const reuniao = await proLaboreApi.reunioes.criar({
        titulo: titulo.trim(), tipo,
        duracaoSegundos: duracaoSegundos ?? undefined,
        nomeArquivoOriginal: arquivo?.name,
        transcricao: transcricao.trim() || undefined,
      })
      onCriada(reuniao)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="pl-card" style={{ marginBottom: 16 }}>
      <div className="pl-card-title" style={{ marginBottom: 12 }}>Nova reunião</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="pl-field">
          <label>Título</label>
          <input className="pl-input" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Call com fornecedor de motos" />
        </div>

        <div className="pl-field">
          <label>Tipo</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TIPOS_REUNIAO.map(t => (
              <button key={t} type="button" className={`pl-chip ${tipo === t ? 'active' : ''}`} onClick={() => setTipo(t)}>
                {TIPO_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="pl-field">
          <label>Arquivo de áudio/vídeo já gravado (opcional)</label>
          <input type="file" accept="audio/*,video/*" className="pl-input" onChange={selecionarArquivo} />
          {arquivo && (
            <span className="pl-hint">
              {arquivo.name}{duracaoSegundos ? ` — ${formatarDuracao(duracaoSegundos)}` : ''}
            </span>
          )}
        </div>

        <div className="pl-field">
          <label>Transcrição</label>
          <textarea
            className="pl-input pl-textarea"
            rows={6}
            value={transcricao}
            onChange={e => setTranscricao(e.target.value)}
            placeholder="Cole ou digite aqui o que foi conversado. A transcrição automática por IA ainda não está integrada — por enquanto esse texto é seu."
          />
          <span className="pl-hint">A transcrição automática por IA ainda depende de uma integração paga (ex: Whisper) que não está configurada. Por enquanto, escreva/cole aqui.</span>
        </div>

        {erro && <div className="pl-alert pl-alert-error">{erro}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Criar'}</button>
          <button type="button" className="pl-btn pl-btn-ghost" onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </form>
  )
}

function PainelReuniao({ id, onExcluida }: { id: string; onExcluida: () => void }) {
  const [reuniao, setReuniao] = useState<ReuniaoDetalhe | null>(null)
  const [editandoTranscricao, setEditandoTranscricao] = useState(false)
  const [rascunhoTranscricao, setRascunhoTranscricao] = useState('')
  const [novaNota, setNovaNota] = useState('')

  const carregar = useCallback(() => { proLaboreApi.reunioes.obter(id).then(r => { setReuniao(r); setRascunhoTranscricao(r.transcricao ?? '') }) }, [id])
  useEffect(() => { carregar() }, [carregar])

  async function salvarTranscricao() {
    await proLaboreApi.reunioes.atualizar(id, { transcricao: rascunhoTranscricao })
    setEditandoTranscricao(false)
    carregar()
  }

  async function adicionarNota(e: React.FormEvent) {
    e.preventDefault()
    if (!novaNota.trim()) return
    await proLaboreApi.notas.criar({ conteudo: novaNota.trim(), reuniaoId: id })
    setNovaNota('')
    carregar()
  }

  async function excluir() {
    if (!confirm('Excluir essa reunião e o vínculo das notas associadas?')) return
    await proLaboreApi.reunioes.excluir(id)
    onExcluida()
  }

  if (!reuniao) return <div className="pl-card"><div className="pl-hint">Carregando...</div></div>

  return (
    <div className="pl-card">
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">{reuniao.titulo}</div>
          <div className="pl-card-sub">{TIPO_LABEL[reuniao.tipo]} · {formatarData(reuniao.data)}{formatarDuracao(reuniao.duracaoSegundos) ? ` · ${formatarDuracao(reuniao.duracaoSegundos)}` : ''}</div>
        </div>
        <button type="button" className="pl-btn pl-btn-ghost" onClick={excluir}>Excluir</button>
      </div>

      <div className="pl-plano-secao-titulo">Transcrição</div>
      {editandoTranscricao ? (
        <>
          <textarea className="pl-input pl-textarea" rows={10} value={rascunhoTranscricao} onChange={e => setRascunhoTranscricao(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="pl-btn pl-btn-primary" onClick={salvarTranscricao}>Salvar</button>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => { setEditandoTranscricao(false); setRascunhoTranscricao(reuniao.transcricao ?? '') }}>Cancelar</button>
          </div>
        </>
      ) : (
        <div onClick={() => setEditandoTranscricao(true)} style={{ cursor: 'text', whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.6, color: reuniao.transcricao ? 'var(--pl-ink-2)' : 'var(--pl-ink-muted)', minHeight: 60 }}>
          {reuniao.transcricao || 'Sem transcrição ainda — clique aqui pra escrever.'}
        </div>
      )}

      <div className="pl-plano-secao-titulo" style={{ marginTop: 20 }}>Notas dessa reunião</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        {reuniao.notas.length === 0 && <div className="pl-hint">Nenhuma nota ainda.</div>}
        {reuniao.notas.map(n => (
          <div key={n.id} className="pl-card" style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--pl-ink-2)' }}>{n.conteudo}</div>
          </div>
        ))}
      </div>
      <form onSubmit={adicionarNota} style={{ display: 'flex', gap: 8 }}>
        <input className="pl-input" placeholder="Adicionar uma nota..." value={novaNota} onChange={e => setNovaNota(e.target.value)} />
        <button type="submit" className="pl-btn pl-btn-ghost">Adicionar</button>
      </form>
    </div>
  )
}

function AbaReunioes() {
  const [reunioes, setReunioes] = useState<ReuniaoResumo[]>([])
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(() => {
    proLaboreApi.reunioes.listar().then(rs => {
      setReunioes(rs)
      setSelecionadaId(atual => atual ?? rs[0]?.id ?? null)
    }).finally(() => setCarregando(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div className="pl-grid-2">
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          {!mostrarForm && <button type="button" className="pl-btn pl-btn-primary" onClick={() => setMostrarForm(true)}>Nova reunião</button>}
        </div>
        {mostrarForm && (
          <FormNovaReuniao
            onCriada={r => { setMostrarForm(false); setSelecionadaId(r.id); carregar() }}
            onCancelar={() => setMostrarForm(false)}
          />
        )}
        <div className="pl-card" style={{ padding: '14px 10px' }}>
          {carregando && <div className="pl-hint">Carregando...</div>}
          {!carregando && reunioes.length === 0 && (
            <div className="pl-empty">
              <div className="pl-emoji">🎙️</div>
              Nenhuma reunião registrada ainda.
            </div>
          )}
          <div className="pl-chat-list">
            {reunioes.map(r => (
              <button key={r.id} type="button" className={`pl-chat-item ${selecionadaId === r.id ? 'active' : ''}`} onClick={() => setSelecionadaId(r.id)}>
                <div className="pl-chat-item-body">
                  <div className="pl-chat-item-top">
                    <span className="pl-chat-item-name">{r.titulo}</span>
                    <span className="pl-chat-item-time">{formatarData(r.data)}</span>
                  </div>
                  <div className="pl-chat-item-snippet">
                    {TIPO_LABEL[r.tipo]}{formatarDuracao(r.duracaoSegundos) ? ` · ${formatarDuracao(r.duracaoSegundos)}` : ''}{r.quantidadeNotas > 0 ? ` · ${r.quantidadeNotas} nota${r.quantidadeNotas > 1 ? 's' : ''}` : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        {selecionadaId ? (
          <PainelReuniao key={selecionadaId} id={selecionadaId} onExcluida={() => { setSelecionadaId(null); carregar() }} />
        ) : (
          <div className="pl-card"><div className="pl-empty">Selecione uma reunião pra ver os detalhes.</div></div>
        )}
      </div>
    </div>
  )
}

function IconeLixeira() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
    </svg>
  )
}

type VisaoAnotacoes = { tipo: 'pasta'; id: string | null } | { tipo: 'nota'; id: string }

function SeletorIcone({ valor, tamanhoClasse, onEscolher }: { valor: string; tamanhoClasse: string; onEscolher: (icone: string | null) => void }) {
  const [aberto, setAberto] = useState(false)
  return (
    <div className="pl-notion-pagina-icone-wrap">
      <button type="button" className={tamanhoClasse} onClick={() => setAberto(a => !a)}>{valor}</button>
      {aberto && (
        <div className="pl-nota-icone-menu" onMouseLeave={() => setAberto(false)}>
          {EMOJIS_NOTA.map(emoji => (
            <button key={emoji} type="button" onClick={() => { onEscolher(emoji); setAberto(false) }}>{emoji}</button>
          ))}
          <button type="button" className="pl-nota-icone-remover" onClick={() => { onEscolher(null); setAberto(false) }}>Remover ícone</button>
        </div>
      )}
    </div>
  )
}

function NoArvore({
  pasta, nivel, pastas, notas, visao, abertas, onAlternarAberta, onAbrirPasta, onAbrirNota, onNovaNota,
}: {
  pasta: Pasta
  nivel: number
  pastas: Pasta[]
  notas: Nota[]
  visao: VisaoAnotacoes
  abertas: Set<string>
  onAlternarAberta: (id: string) => void
  onAbrirPasta: (id: string | null) => void
  onAbrirNota: (id: string) => void
  onNovaNota: (pastaId: string | null) => void
}) {
  const subpastas = pastas.filter(p => (p.paiId ?? null) === pasta.id)
  const filhosNotas = notas.filter(n => (n.pastaId ?? null) === pasta.id)
  const temFilhos = subpastas.length > 0 || filhosNotas.length > 0
  const aberta = abertas.has(pasta.id)
  const ativa = visao.tipo === 'pasta' && visao.id === pasta.id

  return (
    <div>
      <div className={`pl-arvore-item ${ativa ? 'active' : ''}`} style={{ marginLeft: nivel * 14 }}>
        <button type="button" className={`pl-arvore-chevron ${temFilhos ? '' : 'invisivel'}`} onClick={() => onAlternarAberta(pasta.id)}>
          {temFilhos ? (aberta ? '▾' : '▸') : ''}
        </button>
        <button type="button" className="pl-arvore-label" onClick={() => onAbrirPasta(pasta.id)}>
          <span className="pl-arvore-icone">{pasta.icone || '📁'}</span>
          <span className="pl-arvore-nome">{pasta.nome}</span>
        </button>
        <button type="button" className="pl-arvore-acao" title="Nova página aqui" onClick={() => onNovaNota(pasta.id)}>+</button>
      </div>
      {aberta && (
        <div>
          {subpastas.map(p => (
            <NoArvore
              key={p.id} pasta={p} nivel={nivel + 1} pastas={pastas} notas={notas} visao={visao} abertas={abertas}
              onAlternarAberta={onAlternarAberta} onAbrirPasta={onAbrirPasta} onAbrirNota={onAbrirNota} onNovaNota={onNovaNota}
            />
          ))}
          {filhosNotas.map(n => (
            <div key={n.id} className={`pl-arvore-item ${visao.tipo === 'nota' && visao.id === n.id ? 'active' : ''}`} style={{ marginLeft: (nivel + 1) * 14 + 18 }}>
              <button type="button" className="pl-arvore-label" onClick={() => onAbrirNota(n.id)}>
                <span className="pl-arvore-icone">{n.icone || '📄'}</span>
                <span className="pl-arvore-nome">{n.titulo || 'Sem título'}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VisaoPasta({
  pasta, pastas, notas, onAbrirPasta, onAbrirNota, onNovaNota, onNovaPasta, onRenomearPasta, onIconePasta, onExcluirPasta, onExcluirNota,
}: {
  pasta: Pasta | null
  pastas: Pasta[]
  notas: Nota[]
  onAbrirPasta: (id: string | null) => void
  onAbrirNota: (id: string) => void
  onNovaNota: () => void
  onNovaPasta: () => void
  onRenomearPasta: (id: string, nome: string) => void
  onIconePasta: (id: string, icone: string | null) => void
  onExcluirPasta: (id: string) => void
  onExcluirNota: (id: string) => void
}) {
  const [rascunhoNome, setRascunhoNome] = useState(pasta?.nome ?? '')
  useEffect(() => { setRascunhoNome(pasta?.nome ?? '') }, [pasta?.id, pasta?.nome])

  const caminho: Pasta[] = []
  for (let atual = pasta; atual; atual = pastas.find(p => p.id === atual!.paiId) ?? null) caminho.unshift(atual)

  const subpastas = pastas.filter(p => (p.paiId ?? null) === (pasta?.id ?? null))
  const filhosNotas = notas.filter(n => (n.pastaId ?? null) === (pasta?.id ?? null))

  function salvarNome() {
    const nome = rascunhoNome.trim()
    if (pasta && nome && nome !== pasta.nome) onRenomearPasta(pasta.id, nome)
    else setRascunhoNome(pasta?.nome ?? '')
  }

  return (
    <div>
      <div className="pl-breadcrumb-pastas">
        <button type="button" onClick={() => onAbrirPasta(null)} className={!pasta ? 'active' : ''}>Todas as notas</button>
        {caminho.map(p => (
          <span key={p.id}>
            <span className="pl-breadcrumb-sep">/</span>
            <button type="button" onClick={() => onAbrirPasta(p.id)} className={pasta?.id === p.id ? 'active' : ''}>{p.nome}</button>
          </span>
        ))}
      </div>

      <div className="pl-notion-header">
        {pasta ? (
          <SeletorIcone valor={pasta.icone || '📁'} tamanhoClasse="pl-notion-header-icone-btn" onEscolher={icone => onIconePasta(pasta.id, icone)} />
        ) : (
          <span className="pl-notion-header-icone">🗂️</span>
        )}
        {pasta ? (
          <input
            className="pl-notion-titulo-input"
            value={rascunhoNome}
            onChange={e => setRascunhoNome(e.target.value)}
            onBlur={salvarNome}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          />
        ) : (
          <span className="pl-notion-titulo-input pl-notion-titulo-estatico">Todas as notas</span>
        )}
        {pasta && (
          <button type="button" className="pl-kanban-icon-btn pl-danger" title="Excluir pasta" onClick={() => onExcluirPasta(pasta.id)}>
            <IconeLixeira />
          </button>
        )}
      </div>

      <div className="pl-notion-acoes-rapidas">
        <button type="button" className="pl-btn pl-btn-ghost" onClick={onNovaNota}>+ Nova página</button>
        <button type="button" className="pl-btn pl-btn-ghost" onClick={onNovaPasta}>+ Nova pasta</button>
      </div>

      {subpastas.length === 0 && filhosNotas.length === 0 ? (
        <div className="pl-empty pl-card">
          <div className="pl-emoji">📝</div>
          Nada por aqui ainda.
        </div>
      ) : (
        <div className="pl-notion-lista">
          {subpastas.map(p => {
            const quantidade = pastas.filter(x => (x.paiId ?? null) === p.id).length + notas.filter(n => (n.pastaId ?? null) === p.id).length
            return (
              <div key={p.id} className="pl-notion-lista-item" onClick={() => onAbrirPasta(p.id)}>
                <span className="pl-notion-lista-icone">{p.icone || '📁'}</span>
                <span className="pl-notion-lista-nome">{p.nome}</span>
                {quantidade > 0 && <span className="pl-hint">{quantidade} item{quantidade > 1 ? 's' : ''}</span>}
              </div>
            )
          })}
          {filhosNotas.map(n => (
            <div key={n.id} className="pl-notion-lista-item" onClick={() => onAbrirNota(n.id)}>
              <span className="pl-notion-lista-icone">{n.icone || '📄'}</span>
              <span className="pl-notion-lista-nome">{n.titulo || 'Sem título'}</span>
              <span className="pl-status-badge neutro">{CATEGORIA_LABEL[n.categoria]}</span>
              <button type="button" className="pl-kanban-icon-btn pl-danger" title="Excluir" onClick={e => { e.stopPropagation(); onExcluirNota(n.id) }}>
                <IconeLixeira />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PaginaNota({ nota, onAtualizada, onExcluir }: { nota: Nota | null; onAtualizada: (nota: Nota) => void; onExcluir: () => void }) {
  const [titulo, setTitulo] = useState(nota?.titulo ?? '')
  const [icone, setIcone] = useState(nota?.icone ?? '')
  const [categoria, setCategoria] = useState<CategoriaNota>(nota?.categoria ?? 'TRABALHO')
  const [blocosIniciais, setBlocosIniciais] = useState<Bloco[]>(criarBlocosIniciais(nota))
  const [status, setStatus] = useState<'salvo' | 'salvando' | 'erro'>('salvo')
  const blocosAtuaisRef = useRef<Bloco[]>(blocosIniciais)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  type CamposNota = Partial<{ titulo: string; icone: string | null; categoria: CategoriaNota; blocos: Bloco[] }>
  const pendenteRef = useRef<CamposNota>({})

  useEffect(() => {
    setTitulo(nota?.titulo ?? '')
    setIcone(nota?.icone ?? '')
    setCategoria(nota?.categoria ?? 'TRABALHO')
    const iniciais = criarBlocosIniciais(nota)
    setBlocosIniciais(iniciais)
    blocosAtuaisRef.current = iniciais
    pendenteRef.current = {}
    setStatus('salvo')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nota?.id])

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  function criarBlocosIniciais(n: Nota | null): Bloco[] {
    if (n?.blocos && n.blocos.length > 0) return n.blocos
    return [{ id: 'inicial', tipo: 'paragrafo', texto: n?.conteudo ?? '' }]
  }

  // Acumula os campos pendentes entre chamadas — sem isso, editar o título e
  // logo em seguida um bloco (dentro da mesma janela de debounce) descartaria
  // o título, já que cada chamada só carregava os campos daquela edição.
  function agendarSalvar(dados: CamposNota) {
    if (!nota) return
    pendenteRef.current = { ...pendenteRef.current, ...dados }
    setStatus('salvando')
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => {
      const paraSalvar = pendenteRef.current
      pendenteRef.current = {}
      try {
        const blocos = paraSalvar.blocos ?? blocosAtuaisRef.current
        const conteudo = blocos.map(b => b.texto).filter(Boolean).join('\n')
        const atualizada = await proLaboreApi.notas.atualizar(nota.id, { ...paraSalvar, conteudo })
        onAtualizada(atualizada)
        setStatus('salvo')
      } catch {
        setStatus('erro')
      }
    }, 500)
  }

  if (!nota) return <div className="pl-card"><div className="pl-empty">Nota não encontrada.</div></div>

  return (
    <div className="pl-notion-pagina">
      <div className="pl-notion-pagina-topo">
        <SeletorIcone
          valor={icone || '📄'}
          tamanhoClasse="pl-notion-pagina-icone"
          onEscolher={novoIcone => { setIcone(novoIcone ?? ''); agendarSalvar({ icone: novoIcone }) }}
        />
        <div className="pl-notion-pagina-status">{status === 'salvando' ? 'Salvando...' : status === 'erro' ? 'Erro ao salvar' : 'Salvo'}</div>
        <button type="button" className="pl-kanban-icon-btn pl-danger" title="Excluir" onClick={onExcluir}>
          <IconeLixeira />
        </button>
      </div>

      <input
        className="pl-notion-pagina-titulo"
        value={titulo}
        placeholder="Sem título"
        autoFocus
        onChange={e => { setTitulo(e.target.value); agendarSalvar({ titulo: e.target.value }) }}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {CATEGORIAS_NOTA.map(c => (
          <button
            key={c} type="button" className={`pl-chip ${categoria === c ? 'active' : ''}`}
            onClick={() => { setCategoria(c); agendarSalvar({ categoria: c }) }}
          >
            {CATEGORIA_LABEL[c]}
          </button>
        ))}
      </div>

      <EditorBlocos
        blocosIniciais={blocosIniciais}
        onChange={novos => { blocosAtuaisRef.current = novos; agendarSalvar({ blocos: novos }) }}
      />
    </div>
  )
}

function AbaAnotacoes() {
  const [pastas, setPastas] = useState<Pasta[]>([])
  const [notas, setNotas] = useState<Nota[]>([])
  const [visao, setVisao] = useState<VisaoAnotacoes>({ tipo: 'pasta', id: null })
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)

  const carregarTudo = useCallback(() => {
    Promise.all([proLaboreApi.pastas.listar(), proLaboreApi.notas.listar()])
      .then(([ps, ns]) => { setPastas(ps); setNotas(ns) })
      .finally(() => setCarregando(false))
  }, [])
  useEffect(() => { carregarTudo() }, [carregarTudo])

  function alternarAberta(id: string) {
    setAbertas(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id); else novo.add(id)
      return novo
    })
  }

  async function criarNota(pastaId: string | null) {
    const nota = await proLaboreApi.notas.criar({ pastaId })
    setNotas(prev => [nota, ...prev])
    setVisao({ tipo: 'nota', id: nota.id })
    if (pastaId) setAbertas(prev => new Set(prev).add(pastaId))
  }

  async function criarPasta(paiId: string | null) {
    const pasta = await proLaboreApi.pastas.criar({ nome: 'Nova pasta', paiId })
    setPastas(prev => [...prev, pasta])
    setVisao({ tipo: 'pasta', id: pasta.id })
    if (paiId) setAbertas(prev => new Set(prev).add(paiId))
  }

  async function renomearPasta(id: string, nome: string) {
    setPastas(prev => prev.map(p => (p.id === id ? { ...p, nome } : p)))
    await proLaboreApi.pastas.atualizar(id, { nome })
  }

  async function definirIconePasta(id: string, icone: string | null) {
    setPastas(prev => prev.map(p => (p.id === id ? { ...p, icone } : p)))
    await proLaboreApi.pastas.atualizar(id, { icone })
  }

  async function excluirPasta(id: string) {
    if (!confirm('Excluir essa pasta? Subpastas e notas dentro dela não são apagadas — só sobem pro nível de cima.')) return
    const pasta = pastas.find(p => p.id === id)
    const paiId = pasta?.paiId ?? null
    await proLaboreApi.pastas.excluir(id)
    setPastas(prev => prev.filter(p => p.id !== id).map(p => (p.paiId === id ? { ...p, paiId } : p)))
    setNotas(prev => prev.map(n => (n.pastaId === id ? { ...n, pastaId: paiId } : n)))
    setVisao(atual => (atual.tipo === 'pasta' && atual.id === id ? { tipo: 'pasta', id: paiId } : atual))
  }

  async function excluirNota(id: string) {
    if (!confirm('Excluir essa nota?')) return
    const nota = notas.find(n => n.id === id)
    await proLaboreApi.notas.excluir(id)
    setNotas(prev => prev.filter(n => n.id !== id))
    setVisao(atual => (atual.tipo === 'nota' && atual.id === id ? { tipo: 'pasta', id: nota?.pastaId ?? null } : atual))
  }

  function atualizarNotaLocal(nota: Nota) {
    setNotas(prev => prev.map(n => (n.id === nota.id ? nota : n)))
  }

  if (carregando) return <div className="pl-card"><div className="pl-hint">Carregando...</div></div>

  return (
    <div className="pl-notion-shell">
      <div className="pl-notion-sidebar">
        <div className="pl-notion-sidebar-head">
          <span>Anotações</span>
          <button type="button" className="pl-arvore-acao" title="Nova página" onClick={() => criarNota(null)} style={{ opacity: 1 }}>+</button>
        </div>
        <div className="pl-arvore-raiz">
          <div className={`pl-arvore-item ${visao.tipo === 'pasta' && visao.id === null ? 'active' : ''}`}>
            <span className="pl-arvore-chevron invisivel" />
            <button type="button" className="pl-arvore-label" onClick={() => setVisao({ tipo: 'pasta', id: null })}>
              <span className="pl-arvore-icone">🏠</span>
              <span className="pl-arvore-nome">Todas as notas</span>
            </button>
          </div>
          {pastas.filter(p => (p.paiId ?? null) === null).map(p => (
            <NoArvore
              key={p.id} pasta={p} nivel={0} pastas={pastas} notas={notas} visao={visao} abertas={abertas}
              onAlternarAberta={alternarAberta}
              onAbrirPasta={id => setVisao({ tipo: 'pasta', id })}
              onAbrirNota={id => setVisao({ tipo: 'nota', id })}
              onNovaNota={criarNota}
            />
          ))}
          {notas.filter(n => (n.pastaId ?? null) === null).map(n => (
            <div key={n.id} className={`pl-arvore-item ${visao.tipo === 'nota' && visao.id === n.id ? 'active' : ''}`}>
              <span className="pl-arvore-chevron invisivel" />
              <button type="button" className="pl-arvore-label" onClick={() => setVisao({ tipo: 'nota', id: n.id })}>
                <span className="pl-arvore-icone">{n.icone || '📄'}</span>
                <span className="pl-arvore-nome">{n.titulo || 'Sem título'}</span>
              </button>
            </div>
          ))}
          <button type="button" className="pl-arvore-nova-pasta" onClick={() => criarPasta(null)}>+ Nova pasta</button>
        </div>
      </div>

      <div className="pl-notion-main">
        {visao.tipo === 'pasta' ? (
          <VisaoPasta
            pasta={visao.id ? pastas.find(p => p.id === visao.id) ?? null : null}
            pastas={pastas}
            notas={notas}
            onAbrirPasta={id => setVisao({ tipo: 'pasta', id })}
            onAbrirNota={id => setVisao({ tipo: 'nota', id })}
            onNovaNota={() => criarNota(visao.id)}
            onNovaPasta={() => criarPasta(visao.id)}
            onRenomearPasta={renomearPasta}
            onIconePasta={definirIconePasta}
            onExcluirPasta={excluirPasta}
            onExcluirNota={excluirNota}
          />
        ) : (
          <PaginaNota
            key={visao.id}
            nota={notas.find(n => n.id === visao.id) ?? null}
            onAtualizada={atualizarNotaLocal}
            onExcluir={() => excluirNota(visao.id)}
          />
        )}
      </div>
    </div>
  )
}

export default function ProLaboreReunioesPage() {
  const [abaAtiva, setAbaAtiva] = useState<'REUNIOES' | 'ANOTACOES'>('REUNIOES')

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Reuniões"
        subtitle="Registro pessoal de reuniões, aulas e vídeos, com transcrição e um bloco de anotações livres — privado, só você vê"
      />

      <div className="pl-period-row" style={{ marginTop: 4, marginBottom: 20 }}>
        {ABAS.map(a => (
          <button key={a.valor} type="button" className={`pl-chip ${abaAtiva === a.valor ? 'active' : ''}`} onClick={() => setAbaAtiva(a.valor)}>
            {a.rotulo}
          </button>
        ))}
      </div>

      {abaAtiva === 'REUNIOES' ? <AbaReunioes /> : <AbaAnotacoes />}
    </div>
  )
}
