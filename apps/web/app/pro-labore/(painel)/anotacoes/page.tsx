'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  proLaboreApi, Bloco, CATEGORIAS_NOTA, CategoriaNota, MapaMental, Nota, Pasta,
} from '@/lib/proLaboreApi'
import { PageHeader } from '../../PageHeader'
import EditorBlocos from './EditorBlocos'
import MapaMentalCanvas, { dadosIniciaisDoBoard } from './MapaMental'

const EMOJIS_NOTA = ['📄', '📝', '💡', '🎯', '📌', '✅', '🔥', '📊', '🚀', '⭐', '🗂️', '📅', '💬', '🧠', '⚙️', '📈', '📚', '🧩']

const CATEGORIA_LABEL: Record<CategoriaNota, string> = { TRABALHO: 'Trabalho', IDEIA: 'Ideia', APRENDIZADO: 'Aprendizado', OUTRO: 'Outro' }

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// "há 3 dias" / "há 2 meses" — mesma ideia do "2 months ago" da referência.
function formatarRelativo(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dia${dias > 1 ? 's' : ''}`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`
  const anos = Math.floor(meses / 12)
  return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}`
}

function IconeLixeira() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
    </svg>
  )
}

function IconeTilePasta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  )
}

function IconeTilePagina() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  )
}

function IconeTileMapa() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="6" r="2.6" />
      <circle cx="5" cy="18" r="2.2" />
      <circle cx="19" cy="18" r="2.2" />
      <path d="M10.3 8 6.7 15.7M13.7 8l3.6 7.7" />
    </svg>
  )
}

type VisaoAnotacoes = { tipo: 'pasta'; id: string | null } | { tipo: 'nota'; id: string } | { tipo: 'mapa'; id: string }

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
  pasta, nivel, pastas, notas, mapas, visao, abertas, onAlternarAberta, onAbrirPasta, onAbrirNota, onAbrirMapa, onNovaNota, onNovoMapa,
}: {
  pasta: Pasta
  nivel: number
  pastas: Pasta[]
  notas: Nota[]
  mapas: MapaMental[]
  visao: VisaoAnotacoes
  abertas: Set<string>
  onAlternarAberta: (id: string) => void
  onAbrirPasta: (id: string | null) => void
  onAbrirNota: (id: string) => void
  onAbrirMapa: (id: string) => void
  onNovaNota: (pastaId: string | null) => void
  onNovoMapa: (pastaId: string | null) => void
}) {
  const subpastas = pastas.filter(p => (p.paiId ?? null) === pasta.id)
  const filhosNotas = notas.filter(n => (n.pastaId ?? null) === pasta.id)
  const filhosMapas = mapas.filter(m => (m.pastaId ?? null) === pasta.id)
  const temFilhos = subpastas.length > 0 || filhosNotas.length > 0 || filhosMapas.length > 0
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
              key={p.id} pasta={p} nivel={nivel + 1} pastas={pastas} notas={notas} mapas={mapas} visao={visao} abertas={abertas}
              onAlternarAberta={onAlternarAberta} onAbrirPasta={onAbrirPasta} onAbrirNota={onAbrirNota} onAbrirMapa={onAbrirMapa}
              onNovaNota={onNovaNota} onNovoMapa={onNovoMapa}
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
          {filhosMapas.map(m => (
            <div key={m.id} className={`pl-arvore-item ${visao.tipo === 'mapa' && visao.id === m.id ? 'active' : ''}`} style={{ marginLeft: (nivel + 1) * 14 + 18 }}>
              <button type="button" className="pl-arvore-label" onClick={() => onAbrirMapa(m.id)}>
                <span className="pl-arvore-icone">{m.icone || '🧠'}</span>
                <span className="pl-arvore-nome">{m.titulo || 'Sem título'}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type LinhaTabela =
  | { tipo: 'pasta'; item: Pasta; itens: number }
  | { tipo: 'nota'; item: Nota }
  | { tipo: 'mapa'; item: MapaMental }

function VisaoPasta({
  pasta, pastas, notas, mapas, onAbrirPasta, onAbrirNota, onAbrirMapa, onNovaNota, onNovoMapa, onNovaPasta,
  onRenomearPasta, onIconePasta, onExcluirPasta, onExcluirNota, onExcluirMapa,
}: {
  pasta: Pasta | null
  pastas: Pasta[]
  notas: Nota[]
  mapas: MapaMental[]
  onAbrirPasta: (id: string | null) => void
  onAbrirNota: (id: string) => void
  onAbrirMapa: (id: string) => void
  onNovaNota: () => void
  onNovoMapa: () => void
  onNovaPasta: () => void
  onRenomearPasta: (id: string, nome: string) => void
  onIconePasta: (id: string, icone: string | null) => void
  onExcluirPasta: (id: string) => void
  onExcluirNota: (id: string) => void
  onExcluirMapa: (id: string) => void
}) {
  const [rascunhoNome, setRascunhoNome] = useState(pasta?.nome ?? '')
  useEffect(() => { setRascunhoNome(pasta?.nome ?? '') }, [pasta?.id, pasta?.nome])

  const caminho: Pasta[] = []
  for (let atual = pasta; atual; atual = pastas.find(p => p.id === atual!.paiId) ?? null) caminho.unshift(atual)

  const subpastas = pastas.filter(p => (p.paiId ?? null) === (pasta?.id ?? null))
  const filhosNotas = notas.filter(n => (n.pastaId ?? null) === (pasta?.id ?? null))
  const filhosMapas = mapas.filter(m => (m.pastaId ?? null) === (pasta?.id ?? null))

  const linhas: LinhaTabela[] = [
    ...subpastas.map((p): LinhaTabela => ({
      tipo: 'pasta', item: p,
      itens: pastas.filter(x => (x.paiId ?? null) === p.id).length
        + notas.filter(n => (n.pastaId ?? null) === p.id).length
        + mapas.filter(m => (m.pastaId ?? null) === p.id).length,
    })),
    ...filhosNotas.map((n): LinhaTabela => ({ tipo: 'nota', item: n })),
    ...filhosMapas.map((m): LinhaTabela => ({ tipo: 'mapa', item: m })),
  ].sort((a, b) => new Date(b.item.criadoEm).getTime() - new Date(a.item.criadoEm).getTime())

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

      <div className="pl-fb-tiles">
        <button type="button" className="pl-fb-tile pl-fb-tile-roxo" onClick={onNovoMapa}>
          <span className="pl-fb-tile-icone"><IconeTileMapa /></span>
          <span>+ Novo mapa mental</span>
        </button>
        <button type="button" className="pl-fb-tile pl-fb-tile-azul" onClick={onNovaNota}>
          <span className="pl-fb-tile-icone"><IconeTilePagina /></span>
          <span>+ Nova página</span>
        </button>
        <button type="button" className="pl-fb-tile pl-fb-tile-cinza" onClick={onNovaPasta}>
          <span className="pl-fb-tile-icone"><IconeTilePasta /></span>
          <span>+ Nova pasta</span>
        </button>
      </div>

      {linhas.length === 0 ? (
        <div className="pl-empty pl-card">
          <div className="pl-emoji">📝</div>
          Nada por aqui ainda.
        </div>
      ) : (
        <div className="pl-fb-tabela">
          <div className="pl-fb-tabela-head">
            <span className="pl-fb-col-nome">Nome</span>
            <span className="pl-fb-col-data">Criado</span>
            <span className="pl-fb-col-data">Modificado</span>
            <span className="pl-fb-col-acao" />
          </div>
          {linhas.map(linha => {
            if (linha.tipo === 'pasta') {
              return (
                <div key={linha.item.id} className="pl-fb-linha" onClick={() => onAbrirPasta(linha.item.id)}>
                  <span className="pl-fb-col-nome"><span className="pl-fb-linha-icone">{linha.item.icone || '📁'}</span>{linha.item.nome}</span>
                  <span className="pl-fb-col-data">{formatarData(linha.item.criadoEm)}</span>
                  <span className="pl-fb-col-data">{formatarRelativo(linha.item.atualizadoEm)}{linha.itens > 0 ? ` · ${linha.itens} item${linha.itens > 1 ? 's' : ''}` : ''}</span>
                  <span className="pl-fb-col-acao" />
                </div>
              )
            }
            if (linha.tipo === 'nota') {
              return (
                <div key={linha.item.id} className="pl-fb-linha" onClick={() => onAbrirNota(linha.item.id)}>
                  <span className="pl-fb-col-nome"><span className="pl-fb-linha-icone">{linha.item.icone || '📄'}</span>{linha.item.titulo || 'Sem título'}</span>
                  <span className="pl-fb-col-data">{formatarData(linha.item.criadoEm)}</span>
                  <span className="pl-fb-col-data">{formatarRelativo(linha.item.atualizadoEm)}</span>
                  <span className="pl-fb-col-acao">
                    <button type="button" className="pl-kanban-icon-btn pl-danger" title="Excluir" onClick={e => { e.stopPropagation(); onExcluirNota(linha.item.id) }}>
                      <IconeLixeira />
                    </button>
                  </span>
                </div>
              )
            }
            return (
              <div key={linha.item.id} className="pl-fb-linha" onClick={() => onAbrirMapa(linha.item.id)}>
                <span className="pl-fb-col-nome"><span className="pl-fb-linha-icone">{linha.item.icone || '🧠'}</span>{linha.item.titulo || 'Sem título'}</span>
                <span className="pl-fb-col-data">{formatarData(linha.item.criadoEm)}</span>
                <span className="pl-fb-col-data">{formatarRelativo(linha.item.atualizadoEm)}</span>
                <span className="pl-fb-col-acao">
                  <button type="button" className="pl-kanban-icon-btn pl-danger" title="Excluir" onClick={e => { e.stopPropagation(); onExcluirMapa(linha.item.id) }}>
                    <IconeLixeira />
                  </button>
                </span>
              </div>
            )
          })}
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

function IconeVoltar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

// Board em tela cheia (estilo Whimsical): sem a sidebar/topbar do resto do
// app — só uma barra fina própria (voltar, ícone/título, status, excluir) e
// o canvas ocupando o resto da tela. `position: fixed` cobrindo o app
// inteiro é mais simples que reestruturar a rota/layout só pra essa página.
function PaginaMapaMental({ mapa, onAtualizado, onExcluir, onVoltar }: {
  mapa: MapaMental | null
  onAtualizado: (mapa: MapaMental) => void
  onExcluir: () => void
  onVoltar: () => void
}) {
  const [titulo, setTitulo] = useState(mapa?.titulo ?? '')
  const [icone, setIcone] = useState(mapa?.icone ?? '')
  const [dadosIniciais, setDadosIniciais] = useState(() => dadosIniciaisDoBoard(mapa))
  const [status, setStatus] = useState<'salvo' | 'salvando' | 'erro'>('salvo')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  type CamposMapa = Partial<{ titulo: string; icone: string | null; objetos: NonNullable<MapaMental['objetos']>; conectores: NonNullable<MapaMental['conectores']> }>
  const pendenteRef = useRef<CamposMapa>({})

  useEffect(() => {
    setTitulo(mapa?.titulo ?? '')
    setIcone(mapa?.icone ?? '')
    setDadosIniciais(dadosIniciaisDoBoard(mapa))
    pendenteRef.current = {}
    setStatus('salvo')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa?.id])

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  // Mesmo padrão de merge de campos pendentes do autosave da PaginaNota —
  // ver comentário lá: sem isso, editar o título e mexer no mapa na mesma
  // janela de debounce descartaria o título.
  function agendarSalvar(dados: CamposMapa) {
    if (!mapa) return
    pendenteRef.current = { ...pendenteRef.current, ...dados }
    setStatus('salvando')
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => {
      const paraSalvar = pendenteRef.current
      pendenteRef.current = {}
      try {
        const atualizado = await proLaboreApi.mapasMentais.atualizar(mapa.id, paraSalvar)
        onAtualizado(atualizado)
        setStatus('salvo')
      } catch {
        setStatus('erro')
      }
    }, 500)
  }

  if (!mapa) return <div className="pl-card"><div className="pl-empty">Mapa mental não encontrado.</div></div>

  return (
    <div className="pl-board-fullscreen">
      <div className="pl-board-topbar">
        <button type="button" className="pl-board-voltar" title="Voltar pra Anotações" onClick={onVoltar}>
          <IconeVoltar />
        </button>
        <SeletorIcone
          valor={icone || '🧠'}
          tamanhoClasse="pl-board-topbar-icone"
          onEscolher={novoIcone => { setIcone(novoIcone ?? ''); agendarSalvar({ icone: novoIcone }) }}
        />
        <input
          className="pl-board-topbar-titulo"
          value={titulo}
          placeholder="Sem título"
          onChange={e => { setTitulo(e.target.value); agendarSalvar({ titulo: e.target.value }) }}
        />
        <div className="pl-board-topbar-status">{status === 'salvando' ? 'Salvando...' : status === 'erro' ? 'Erro ao salvar' : 'Salvo'}</div>
        <button type="button" className="pl-kanban-icon-btn pl-danger" title="Excluir" onClick={onExcluir}>
          <IconeLixeira />
        </button>
      </div>

      <div className="pl-board-canvas-area">
        <MapaMentalCanvas
          dadosIniciais={dadosIniciais}
          onChange={dados => agendarSalvar(dados)}
        />
      </div>
    </div>
  )
}

export default function ProLaboreAnotacoesPage() {
  const [pastas, setPastas] = useState<Pasta[]>([])
  const [notas, setNotas] = useState<Nota[]>([])
  const [mapas, setMapas] = useState<MapaMental[]>([])
  const [visao, setVisao] = useState<VisaoAnotacoes>({ tipo: 'pasta', id: null })
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)

  const carregarTudo = useCallback(() => {
    Promise.all([proLaboreApi.pastas.listar(), proLaboreApi.notas.listar(), proLaboreApi.mapasMentais.listar()])
      .then(([ps, ns, ms]) => { setPastas(ps); setNotas(ns); setMapas(ms) })
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

  // As três funções abaixo não tinham tratamento de erro nenhum — se a API
  // falhasse por qualquer motivo (rede, sessão expirada, erro do servidor),
  // o clique no botão simplesmente não fazia nada visível, sem mensagem
  // nenhuma pro usuário (parecia que "não abre").
  async function criarNota(pastaId: string | null) {
    try {
      const nota = await proLaboreApi.notas.criar({ pastaId })
      setNotas(prev => [nota, ...prev])
      setVisao({ tipo: 'nota', id: nota.id })
      if (pastaId) setAbertas(prev => new Set(prev).add(pastaId))
    } catch {
      alert('Não foi possível criar a página. Tente novamente.')
    }
  }

  async function criarMapa(pastaId: string | null) {
    try {
      const mapa = await proLaboreApi.mapasMentais.criar({ pastaId })
      setMapas(prev => [mapa, ...prev])
      setVisao({ tipo: 'mapa', id: mapa.id })
      if (pastaId) setAbertas(prev => new Set(prev).add(pastaId))
    } catch {
      alert('Não foi possível criar o mapa mental. Tente novamente.')
    }
  }

  async function criarPasta(paiId: string | null) {
    try {
      const pasta = await proLaboreApi.pastas.criar({ nome: 'Nova pasta', paiId })
      setPastas(prev => [...prev, pasta])
      setVisao({ tipo: 'pasta', id: pasta.id })
      if (paiId) setAbertas(prev => new Set(prev).add(paiId))
    } catch {
      alert('Não foi possível criar a pasta. Tente novamente.')
    }
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
    setMapas(prev => prev.map(m => (m.pastaId === id ? { ...m, pastaId: paiId } : m)))
    setVisao(atual => (atual.tipo === 'pasta' && atual.id === id ? { tipo: 'pasta', id: paiId } : atual))
  }

  async function excluirNota(id: string) {
    if (!confirm('Excluir essa nota?')) return
    const nota = notas.find(n => n.id === id)
    await proLaboreApi.notas.excluir(id)
    setNotas(prev => prev.filter(n => n.id !== id))
    setVisao(atual => (atual.tipo === 'nota' && atual.id === id ? { tipo: 'pasta', id: nota?.pastaId ?? null } : atual))
  }

  async function excluirMapa(id: string) {
    if (!confirm('Excluir esse mapa mental?')) return
    const mapa = mapas.find(m => m.id === id)
    await proLaboreApi.mapasMentais.excluir(id)
    setMapas(prev => prev.filter(m => m.id !== id))
    setVisao(atual => (atual.tipo === 'mapa' && atual.id === id ? { tipo: 'pasta', id: mapa?.pastaId ?? null } : atual))
  }

  function atualizarNotaLocal(nota: Nota) {
    setNotas(prev => prev.map(n => (n.id === nota.id ? nota : n)))
  }

  function atualizarMapaLocal(mapa: MapaMental) {
    setMapas(prev => prev.map(m => (m.id === mapa.id ? mapa : m)))
  }

  // Board em tela cheia: renderizado fora da sidebar/topbar do resto do app
  // (nem PageHeader nem pl-notion-shell), igual ao comportamento da
  // referência — abrir um mapa mental troca a tela inteira pro canvas.
  if (visao.tipo === 'mapa') {
    const mapa = mapas.find(m => m.id === visao.id) ?? null
    return (
      <PaginaMapaMental
        key={visao.id}
        mapa={mapa}
        onAtualizado={atualizarMapaLocal}
        onExcluir={() => excluirMapa(visao.id)}
        onVoltar={() => setVisao({ tipo: 'pasta', id: mapa?.pastaId ?? null })}
      />
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Anotações"
        subtitle="Páginas de texto e mapas mentais, organizados em pastas — privado, só você vê"
      />

      {carregando ? (
        <div className="pl-card"><div className="pl-hint">Carregando...</div></div>
      ) : (
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
                  key={p.id} pasta={p} nivel={0} pastas={pastas} notas={notas} mapas={mapas} visao={visao} abertas={abertas}
                  onAlternarAberta={alternarAberta}
                  onAbrirPasta={id => setVisao({ tipo: 'pasta', id })}
                  onAbrirNota={id => setVisao({ tipo: 'nota', id })}
                  onAbrirMapa={id => setVisao({ tipo: 'mapa', id })}
                  onNovaNota={criarNota}
                  onNovoMapa={criarMapa}
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
              {mapas.filter(m => (m.pastaId ?? null) === null).map(m => (
                // Nunca "active": abrir um mapa mental sai desta árvore (vira
                // tela cheia, ver early-return de PaginaMapaMental acima).
                <div key={m.id} className="pl-arvore-item">
                  <span className="pl-arvore-chevron invisivel" />
                  <button type="button" className="pl-arvore-label" onClick={() => setVisao({ tipo: 'mapa', id: m.id })}>
                    <span className="pl-arvore-icone">{m.icone || '🧠'}</span>
                    <span className="pl-arvore-nome">{m.titulo || 'Sem título'}</span>
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
                mapas={mapas}
                onAbrirPasta={id => setVisao({ tipo: 'pasta', id })}
                onAbrirNota={id => setVisao({ tipo: 'nota', id })}
                onAbrirMapa={id => setVisao({ tipo: 'mapa', id })}
                onNovaNota={() => criarNota(visao.id)}
                onNovoMapa={() => criarMapa(visao.id)}
                onNovaPasta={() => criarPasta(visao.id)}
                onRenomearPasta={renomearPasta}
                onIconePasta={definirIconePasta}
                onExcluirPasta={excluirPasta}
                onExcluirNota={excluirNota}
                onExcluirMapa={excluirMapa}
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
      )}
    </div>
  )
}
