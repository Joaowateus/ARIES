'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  proLaboreApi, Bloco, CATEGORIAS_NOTA, CategoriaNota, LoteAnotacoes, MapaMental, MapaMentalVersao, Nota, Pasta,
} from '@/lib/proLaboreApi'
import { PageHeader } from '../../PageHeader'
import EditorBlocos from './EditorBlocos'
import MapaMentalCanvas, {
  dadosIniciaisDoBoard, gerarBoardDoTemplate, TEMAS_BOARD, TemaBoard, TEMPLATES_BOARD, CONFIGURACAO_PADRAO, ConfiguracaoBoard,
} from './MapaMental'
import EscolherPasta from './EscolherPasta'
import EnviarParaReunioes from './EnviarParaReunioes'
import {
  AcoesNavegador, Chave, FolhaArvore, NoArvore, Ordem, Trilha, VisaoPasta, caminhoAte, chaveDe, descendentes, formatarRelativo, partesDa,
} from './Navegador'

const EMOJIS_NOTA = ['📄', '📝', '💡', '🎯', '📌', '✅', '🔥', '📊', '🚀', '⭐', '🗂️', '📅', '💬', '🧠', '⚙️', '📈', '📚', '🧩']

const CATEGORIA_LABEL: Record<CategoriaNota, string> = { TRABALHO: 'Trabalho', IDEIA: 'Ideia', APRENDIZADO: 'Aprendizado', OUTRO: 'Outro' }

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

type VisaoAnotacoes = { tipo: 'pasta'; id: string | null } | { tipo: 'nota'; id: string } | { tipo: 'mapa'; id: string } | { tipo: 'lixeira' }

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

function IconeRestaurar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  )
}

// Lixeira do board (6.13/Fase 2) — só mapas mentais entram aqui (escopo do
// item do mapeamento); nota/pasta continuam com exclusão direta como
// sempre foram. Purga automática (30 dias) é preguiçosa, feita pelo
// backend na hora de listar — ver DIAS_RETENCAO_LIXEIRA na rota.
function VisaoLixeira({ mapas, onAbrirPasta, onRestaurar, onExcluirDefinitivo }: {
  mapas: MapaMental[]
  onAbrirPasta: (id: string | null) => void
  onRestaurar: (id: string) => void
  onExcluirDefinitivo: (id: string) => void
}) {
  return (
    <div>
      <div className="pl-breadcrumb-pastas">
        <button type="button" onClick={() => onAbrirPasta(null)}>Todas as notas</button>
        <span className="pl-breadcrumb-sep">/</span>
        <button type="button" className="active">Lixeira</button>
      </div>

      <div className="pl-notion-header">
        <span className="pl-notion-header-icone">🗑️</span>
        <span className="pl-notion-titulo-input pl-notion-titulo-estatico">Lixeira</span>
      </div>
      <p className="pl-hint" style={{ marginTop: -8, marginBottom: 18 }}>
        Mapas mentais excluídos ficam aqui por {30} dias antes de serem apagados em definitivo.
      </p>

      {mapas.length === 0 ? (
        <div className="pl-empty pl-card">
          <div className="pl-emoji">🗑️</div>
          A lixeira está vazia.
        </div>
      ) : (
        <div className="pl-fb-tabela">
          <div className="pl-fb-tabela-head">
            <span className="pl-fb-col-nome">Nome</span>
            <span className="pl-fb-col-data">Excluído</span>
            <span className="pl-fb-col-data" />
            <span className="pl-fb-col-acao" />
          </div>
          {mapas.map(m => (
            <div key={m.id} className="pl-fb-linha">
              <span className="pl-fb-col-nome"><span className="pl-fb-linha-icone">{m.icone || '🧠'}</span>{m.titulo || 'Sem título'}</span>
              <span className="pl-fb-col-data">{m.excluidoEm ? formatarRelativo(m.excluidoEm) : ''}</span>
              <span className="pl-fb-col-data" />
              <span className="pl-fb-col-acao" style={{ gap: 4 }}>
                <button type="button" className="pl-kanban-icon-btn" title="Restaurar" onClick={() => onRestaurar(m.id)}>
                  <IconeRestaurar />
                </button>
                <button type="button" className="pl-kanban-icon-btn pl-danger" title="Excluir definitivamente" onClick={() => onExcluirDefinitivo(m.id)}>
                  <IconeLixeira />
                </button>
              </span>
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

function IconeVoltar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function IconeApresentar() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 16v4M8 20h8" /><path d="m10 8 4 2-4 2z" fill="currentColor" />
    </svg>
  )
}

function IconePastaMover() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /><path d="M10 13h6M13 10l3 3-3 3" />
    </svg>
  )
}

function IconeHistorico() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  )
}

// Board em tela cheia (estilo Whimsical): sem a sidebar/topbar do resto do
// app — só uma barra fina própria (voltar, ícone/título, status, excluir) e
// o canvas ocupando o resto da tela. `position: fixed` cobrindo o app
// inteiro é mais simples que reestruturar a rota/layout só pra essa página.
function PaginaMapaMental({ mapa, onAtualizado, onExcluir, onVoltar, onMover, onApresentar }: {
  mapa: MapaMental | null
  onAtualizado: (mapa: MapaMental) => void
  onExcluir: () => void
  onVoltar: () => void
  onMover: () => void
  onApresentar: () => void
}) {
  const [titulo, setTitulo] = useState(mapa?.titulo ?? '')
  const [icone, setIcone] = useState(mapa?.icone ?? '')
  const [tema, setTema] = useState<TemaBoard>((mapa?.tema as TemaBoard) || TEMAS_BOARD[0].id)
  const [temaMenuAberto, setTemaMenuAberto] = useState(false)
  const [configuracao, setConfiguracao] = useState<ConfiguracaoBoard>(
    () => ({ ...CONFIGURACAO_PADRAO, ...(mapa?.configuracao as Partial<ConfiguracaoBoard> | null | undefined) }),
  )
  const [dadosIniciais, setDadosIniciais] = useState(() => dadosIniciaisDoBoard(mapa))
  const [status, setStatus] = useState<'salvo' | 'salvando' | 'erro'>('salvo')
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [versoes, setVersoes] = useState<MapaMentalVersao[]>([])
  const [carregandoVersoes, setCarregandoVersoes] = useState(false)
  // Muda a cada restauração pra forçar o <MapaMentalCanvas> a remontar do
  // zero com `dadosIniciais` novo — ele só lê esse prop na inicialização
  // (useState preguiçoso), então só trocar o valor do prop não bastaria.
  const [versaoRestaurada, setVersaoRestaurada] = useState(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  type CamposMapa = Partial<{
    titulo: string; icone: string | null; tema: TemaBoard
    configuracao: Record<string, unknown> | null
    objetos: NonNullable<MapaMental['objetos']>; conectores: NonNullable<MapaMental['conectores']>
  }>
  const pendenteRef = useRef<CamposMapa>({})

  useEffect(() => {
    setTitulo(mapa?.titulo ?? '')
    setIcone(mapa?.icone ?? '')
    setTema((mapa?.tema as TemaBoard) || TEMAS_BOARD[0].id)
    setConfiguracao({ ...CONFIGURACAO_PADRAO, ...(mapa?.configuracao as Partial<ConfiguracaoBoard> | null | undefined) })
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

  async function alternarHistorico() {
    const abrindo = !historicoAberto
    setHistoricoAberto(abrindo)
    if (abrindo && mapa) {
      setCarregandoVersoes(true)
      try {
        setVersoes(await proLaboreApi.mapasMentais.versoes.listar(mapa.id))
      } catch {
        alert('Não foi possível carregar o histórico. Tente novamente.')
      } finally {
        setCarregandoVersoes(false)
      }
    }
  }

  async function restaurarVersao(versaoId: string) {
    if (!mapa) return
    if (!confirm('Restaurar essa versão? O estado atual do board vira uma versão nova, então nada se perde.')) return
    try {
      const atualizado = await proLaboreApi.mapasMentais.versoes.restaurar(mapa.id, versaoId)
      onAtualizado(atualizado)
      setDadosIniciais(dadosIniciaisDoBoard(atualizado))
      setVersaoRestaurada(v => v + 1)
      setHistoricoAberto(false)
    } catch {
      alert('Não foi possível restaurar essa versão. Tente novamente.')
    }
  }

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
        <div className="pl-board-tema-wrap">
          <button type="button" className={`pl-kanban-icon-btn ${temaMenuAberto ? 'ativo' : ''}`} title="Tema do board" onClick={() => setTemaMenuAberto(a => !a)}>
            <span className="pl-board-tema-amostra" style={{ background: TEMAS_BOARD.find(t => t.id === tema)?.amostra }} />
          </button>
          {temaMenuAberto && (
            <div className="pl-board-tema-menu" onMouseLeave={() => setTemaMenuAberto(false)}>
              {TEMAS_BOARD.map(t => (
                <button
                  key={t.id} type="button"
                  className={`pl-board-tema-opcao ${tema === t.id ? 'ativo' : ''}`}
                  onClick={() => { setTema(t.id); agendarSalvar({ tema: t.id }); setTemaMenuAberto(false) }}
                >
                  <span className="pl-board-tema-amostra" style={{ background: t.amostra }} />
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="pl-board-topbar-btn" title="Levar uma cópia pra aba Reuniões e apresentar pra equipe" onClick={onApresentar}>
          <IconeApresentar /> <span>Apresentar nas Reuniões</span>
        </button>
        <button type="button" className="pl-kanban-icon-btn" title="Mover pra outra pasta" onClick={onMover}>
          <IconePastaMover />
        </button>
        <button type="button" className={`pl-kanban-icon-btn ${historicoAberto ? 'ativo' : ''}`} title="Histórico de versões" onClick={alternarHistorico}>
          <IconeHistorico />
        </button>
        <button type="button" className="pl-kanban-icon-btn pl-danger" title="Excluir" onClick={onExcluir}>
          <IconeLixeira />
        </button>
      </div>

      <div className="pl-board-corpo">
        <div className="pl-board-canvas-area">
          <MapaMentalCanvas
            key={versaoRestaurada}
            dadosIniciais={dadosIniciais}
            onChange={dados => agendarSalvar(dados)}
            tema={tema}
            configuracao={configuracao}
            onMudarConfiguracao={cfg => { setConfiguracao(cfg); agendarSalvar({ configuracao: cfg as unknown as Record<string, unknown> }) }}
          />
        </div>
        {historicoAberto && (
          <div className="pl-board-historico">
            <div className="pl-board-historico-topo">
              <span>Histórico de versões</span>
              <button type="button" className="pl-mapa-toolbar-btn" title="Fechar" onClick={() => setHistoricoAberto(false)}>×</button>
            </div>
            {carregandoVersoes ? (
              <div className="pl-hint" style={{ padding: 12 }}>Carregando...</div>
            ) : versoes.length === 0 ? (
              <div className="pl-hint" style={{ padding: 12 }}>
                Sem versões salvas ainda — uma nova versão é criada automaticamente a cada intervalo de edição.
              </div>
            ) : (
              <div className="pl-board-historico-lista">
                {versoes.map(v => (
                  <div key={v.id} className="pl-board-historico-item">
                    <span>{formatarRelativo(v.criadoEm)}</span>
                    <button type="button" className="pl-chip" onClick={() => restaurarVersao(v.id)}>Restaurar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface ResultadoBusca {
  tipo: 'pasta' | 'nota' | 'mapa'
  id: string
  titulo: string
  icone: string
}

const ROTULO_TIPO_BUSCA: Record<ResultadoBusca['tipo'], string> = { pasta: 'Pasta', nota: 'Nota', mapa: 'Mapa mental' }

// Paleta de comando (Ctrl/Cmd+K): busca por substring em pastas/notas/mapas
// de Anotações. Escopo deliberadamente limitado a este recurso — não é uma
// busca global do ARIES, só um "quick-open" tipo Whimsical/Notion dentro da
// própria aba.
function ComandoBusca({
  aberta, pastas, notas, mapas, onFechar, onAbrirPasta, onAbrirNota, onAbrirMapa,
}: {
  aberta: boolean
  pastas: Pasta[]
  notas: Nota[]
  mapas: MapaMental[]
  onFechar: () => void
  onAbrirPasta: (id: string) => void
  onAbrirNota: (id: string) => void
  onAbrirMapa: (id: string) => void
}) {
  const [texto, setTexto] = useState('')
  const [indice, setIndice] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!aberta) return
    setTexto('')
    setIndice(0)
    const id = setTimeout(() => inputRef.current?.focus(), 10)
    return () => clearTimeout(id)
  }, [aberta])

  if (!aberta) return null

  const termo = texto.trim().toLowerCase()
  const todos: ResultadoBusca[] = [
    ...pastas.map(p => ({ tipo: 'pasta' as const, id: p.id, titulo: p.nome || 'Sem nome', icone: p.icone || '📁' })),
    ...notas.map(n => ({ tipo: 'nota' as const, id: n.id, titulo: n.titulo || 'Sem título', icone: n.icone || '📄' })),
    ...mapas.map(m => ({ tipo: 'mapa' as const, id: m.id, titulo: m.titulo || 'Sem título', icone: m.icone || '🧠' })),
  ]
  const resultados = termo ? todos.filter(r => r.titulo.toLowerCase().includes(termo)).slice(0, 20) : todos.slice(0, 8)

  function selecionar(r: ResultadoBusca) {
    if (r.tipo === 'pasta') onAbrirPasta(r.id)
    else if (r.tipo === 'nota') onAbrirNota(r.id)
    else onAbrirMapa(r.id)
    onFechar()
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onFechar() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIndice(i => Math.min(resultados.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndice(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); const r = resultados[indice]; if (r) selecionar(r) }
  }

  return (
    <div className="pl-cmdk-backdrop" onClick={onFechar}>
      <div className="pl-cmdk-panel" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="pl-cmdk-input"
          placeholder="Buscar notas, mapas e pastas..."
          value={texto}
          onChange={e => { setTexto(e.target.value); setIndice(0) }}
          onKeyDown={aoTeclar}
        />
        <div className="pl-cmdk-lista">
          {resultados.length === 0 ? (
            <div className="pl-cmdk-vazio">Nada encontrado.</div>
          ) : resultados.map((r, i) => (
            <button
              type="button"
              key={`${r.tipo}-${r.id}`}
              className={`pl-cmdk-item ${i === indice ? 'ativo' : ''}`}
              onMouseEnter={() => setIndice(i)}
              onClick={() => selecionar(r)}
            >
              <span className="pl-cmdk-item-icone">{r.icone}</span>
              <span className="pl-cmdk-item-titulo">{r.titulo}</span>
              <span className="pl-cmdk-item-tipo">{ROTULO_TIPO_BUSCA[r.tipo]}</span>
            </button>
          ))}
        </div>
        <div className="pl-cmdk-rodape">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>Enter</kbd> abrir</span>
          <span><kbd>Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  )
}

// Escolha de template ao criar um mapa mental novo: em vez de sempre abrir
// com "Ideia central" vazia, oferece alguns pontos de partida já populados
// (ver TEMPLATES_BOARD/gerarBoardDoTemplate em MapaMental.tsx).
function EscolhaTemplateModal({ aberta, onFechar, onEscolher }: {
  aberta: boolean
  onFechar: () => void
  onEscolher: (templateId: string) => void
}) {
  if (!aberta) return null
  return (
    <div className="pl-modal-backdrop" onClick={onFechar}>
      <div className="pl-card pl-modal-panel pl-template-painel" onClick={e => e.stopPropagation()}>
        <div className="pl-card-head">
          <div>
            <div className="pl-card-title">Novo mapa mental</div>
            <div className="pl-card-sub">Escolha um ponto de partida.</div>
          </div>
        </div>
        <div className="pl-template-grade">
          {TEMPLATES_BOARD.map(t => (
            <button type="button" key={t.id} className="pl-template-opcao" onClick={() => onEscolher(t.id)}>
              <span className="pl-template-icone">{t.icone}</span>
              <span className="pl-template-label">{t.label}</span>
              <span className="pl-template-descricao">{t.descricao}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Onde a pessoa está fica na URL (?pasta=, ?nota=, ?mapa=, ?lixeira=1):
// o botão voltar do navegador funciona, recarregar a página não perde o
// lugar e dá pra abrir um item direto por link (ex.: vindo de Reuniões).
function lerVisao(params: URLSearchParams): VisaoAnotacoes {
  if (params.get('lixeira')) return { tipo: 'lixeira' }
  const mapa = params.get('mapa')
  if (mapa) return { tipo: 'mapa', id: mapa }
  const nota = params.get('nota')
  if (nota) return { tipo: 'nota', id: nota }
  return { tipo: 'pasta', id: params.get('pasta') }
}

function urlDa(v: VisaoAnotacoes): string {
  const q = new URLSearchParams()
  if (v.tipo === 'lixeira') q.set('lixeira', '1')
  else if (v.tipo === 'pasta') { if (v.id) q.set('pasta', v.id) }
  else q.set(v.tipo, v.id)
  return `/pro-labore/anotacoes${q.size ? `?${q}` : ''}`
}

const CHAVE_ORDEM = 'pl_anotacoes_ordem'

function lerOrdemSalva(): Ordem {
  try {
    const v = localStorage.getItem(CHAVE_ORDEM)
    return v === 'nome' || v === 'criado' ? v : 'modificado'
  } catch {
    return 'modificado'
  }
}

function CabecalhoPasta({ pasta, onRenomear, onIcone, onExcluir }: {
  pasta: Pasta | null
  onRenomear: (id: string, nome: string) => void
  onIcone: (id: string, icone: string | null) => void
  onExcluir: (id: string) => void
}) {
  const [rascunhoNome, setRascunhoNome] = useState(pasta?.nome ?? '')
  function salvarNome() {
    const nome = rascunhoNome.trim()
    if (pasta && nome && nome !== pasta.nome) onRenomear(pasta.id, nome)
    else setRascunhoNome(pasta?.nome ?? '')
  }
  return (
    <div className="pl-notion-header">
      {pasta ? (
        <SeletorIcone valor={pasta.icone || '📁'} tamanhoClasse="pl-notion-header-icone-btn" onEscolher={icone => onIcone(pasta.id, icone)} />
      ) : (
        <span className="pl-notion-header-icone">🗂️</span>
      )}
      {pasta ? (
        <input
          className="pl-notion-titulo-input"
          value={rascunhoNome}
          aria-label="Nome da pasta"
          onChange={e => setRascunhoNome(e.target.value)}
          onBlur={salvarNome}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        />
      ) : (
        <span className="pl-notion-titulo-input pl-notion-titulo-estatico">Todas as notas</span>
      )}
      {pasta && (
        <button type="button" className="pl-kanban-icon-btn pl-danger" title="Excluir pasta" onClick={() => onExcluir(pasta.id)}>
          <IconeLixeira />
        </button>
      )}
    </div>
  )
}

function MoverItens({ chaves, pastas, nomeDe, paiDe, onFechar, onMover, onPastaCriada }: {
  chaves: Chave[]
  pastas: Pasta[]
  nomeDe: (c: Chave) => string
  paiDe: (c: Chave) => string | null
  onFechar: () => void
  onMover: (destino: string | null) => Promise<void>
  onPastaCriada: (p: Pasta) => void
}) {
  const pastasMovidas = chaves.map(partesDa).filter(p => p.tipo === 'pasta').map(p => p.id)
  const bloqueadas = descendentes(pastas, pastasMovidas)
  const pais = new Set(chaves.map(paiDe))
  const [destino, setDestino] = useState<string | null>(pais.size === 1 ? [...pais][0] : null)
  const [movendo, setMovendo] = useState(false)
  const jaEstaoLa = chaves.every(c => paiDe(c) === destino)
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar])
  return (
    <div className="pl-rn-modal" role="dialog" aria-modal="true" aria-label="Mover" onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div className="pl-card pl-rn-modal-caixa pl-cp-caixa">
        <div className="pl-card-title">{chaves.length === 1 ? `Mover “${nomeDe(chaves[0])}”` : `Mover ${chaves.length} itens`}</div>
        <p className="pl-card-sub" style={{ margin: '4px 0 12px' }}>Escolha a pasta de destino{pastasMovidas.length ? ' (uma pasta não pode ir pra dentro dela mesma)' : ''}.</p>
        <EscolherPasta pastas={pastas} valor={destino} onEscolher={setDestino} bloqueadas={bloqueadas} onPastaCriada={onPastaCriada} />
        <div className="pl-ap-nova-botoes">
          <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Cancelar</button>
          <button
            type="button" className="pl-btn pl-btn-primary" disabled={movendo || jaEstaoLa}
            onClick={async () => { setMovendo(true); await onMover(destino); setMovendo(false) }}
          >{movendo ? 'Movendo…' : jaEstaoLa ? 'Já está aqui' : 'Mover para cá'}</button>
        </div>
      </div>
    </div>
  )
}

function pastaDaVisao(v: VisaoAnotacoes, ns: Nota[], ms: MapaMental[]): string | null {
  if (v.tipo === 'pasta') return v.id
  if (v.tipo === 'nota') return ns.find(n => n.id === v.id)?.pastaId ?? null
  if (v.tipo === 'mapa') return ms.find(m => m.id === v.id)?.pastaId ?? null
  return null
}

function Anotacoes() {
  const router = useRouter()
  const params = useSearchParams()
  const visao = lerVisao(params)
  const visaoRef = useRef(visao)
  useEffect(() => { visaoRef.current = visao })

  const [pastas, setPastas] = useState<Pasta[]>([])
  const [notas, setNotas] = useState<Nota[]>([])
  const [mapas, setMapas] = useState<MapaMental[]>([])
  const [lixeira, setLixeira] = useState<MapaMental[]>([])
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [ordem, setOrdem] = useState<Ordem>(lerOrdemSalva)
  const [movendo, setMovendo] = useState<Chave[] | null>(null)
  const [enviando, setEnviando] = useState<MapaMental | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; desfazer?: () => Promise<void> } | null>(null)
  const avisoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [alvoSoltar, setAlvoSoltar] = useState<string | null>(null)
  const arrastandoRef = useRef<Chave[]>([])
  // Escolha de template ao criar um mapa mental novo (null = fechada).
  const [escolhaTemplate, setEscolhaTemplate] = useState<{ pastaId: string | null } | null>(null)


  // Abre na barra lateral o caminho até onde a pessoa está.
  function expandirAte(pastaId: string | null, ps: Pasta[] = pastas) {
    if (!pastaId) return
    const ids = caminhoAte(ps, pastaId).map(p => p.id)
    setAbertas(prev => (ids.every(id => prev.has(id)) ? prev : new Set([...prev, ...ids])))
  }

  const navegar = (v: VisaoAnotacoes, substituir = false) => {
    expandirAte(pastaDaVisao(v, notas, mapas))
    const url = urlDa(v)
    if (substituir) router.replace(url, { scroll: false })
    else router.push(url, { scroll: false })
  }

  const carregarTudo = useCallback(() => {
    Promise.all([proLaboreApi.pastas.listar(), proLaboreApi.notas.listar(), proLaboreApi.mapasMentais.listar()])
      .then(([ps, ns, ms]) => {
        setPastas(ps); setNotas(ns); setMapas(ms)
        const pastaAtual = pastaDaVisao(visaoRef.current, ns, ms)
        if (pastaAtual) setAbertas(new Set(caminhoAte(ps, pastaAtual).map(p => p.id)))
      })
      .finally(() => setCarregando(false))
  }, [])
  useEffect(() => { carregarTudo() }, [carregarTudo])

  // Lixeira aberta (inclusive direto pelo link): busca o que tem lá.
  useEffect(() => {
    if (visao.tipo !== 'lixeira') return
    let cancelado = false
    proLaboreApi.mapasMentais.lixeira()
      .then(l => { if (!cancelado) setLixeira(l) })
      .catch(() => { if (!cancelado) alert('Não foi possível carregar a lixeira. Tente novamente.') })
    return () => { cancelado = true }
  }, [visao.tipo])

  // Ctrl/Cmd+K abre a paleta de comando de qualquer lugar dentro de
  // Anotações — inclusive com um mapa mental aberto em tela cheia.
  useEffect(() => {
    function aoTeclarGlobal(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setBuscaAberta(true)
      }
    }
    window.addEventListener('keydown', aoTeclarGlobal)
    return () => window.removeEventListener('keydown', aoTeclarGlobal)
  }, [])

  useEffect(() => () => { if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current) }, [])

  function avisar(texto: string, desfazer?: () => Promise<void>) {
    if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current)
    setAviso({ texto, desfazer })
    avisoTimerRef.current = setTimeout(() => setAviso(null), desfazer ? 8000 : 4000)
  }

  function mudarOrdem(o: Ordem) {
    setOrdem(o)
    try { localStorage.setItem(CHAVE_ORDEM, o) } catch { /* sem armazenamento local: só não lembra */ }
  }

  function alternarAberta(id: string) {
    setAbertas(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id); else novo.add(id)
      return novo
    })
  }

  // ---------- Itens: nome, pasta de cada um, lote pra API ----------
  function paiDe(c: Chave): string | null {
    const { tipo, id } = partesDa(c)
    if (tipo === 'pasta') return pastas.find(p => p.id === id)?.paiId ?? null
    if (tipo === 'nota') return notas.find(n => n.id === id)?.pastaId ?? null
    return mapas.find(m => m.id === id)?.pastaId ?? null
  }
  function nomeDe(c: Chave): string {
    const { tipo, id } = partesDa(c)
    if (tipo === 'pasta') return pastas.find(p => p.id === id)?.nome ?? 'Pasta'
    if (tipo === 'nota') return notas.find(n => n.id === id)?.titulo || 'Sem título'
    return mapas.find(m => m.id === id)?.titulo || 'Sem título'
  }
  function lote(chaves: Chave[]): Required<LoteAnotacoes> {
    const l = { pastas: [] as string[], notas: [] as string[], mapas: [] as string[] }
    chaves.map(partesDa).forEach(({ tipo, id }) => { l[tipo === 'pasta' ? 'pastas' : tipo === 'nota' ? 'notas' : 'mapas'].push(id) })
    return l
  }
  function aplicarMovimento(chaves: Chave[], destino: string | null) {
    const l = lote(chaves)
    setPastas(prev => prev.map(p => (l.pastas.includes(p.id) ? { ...p, paiId: destino } : p)))
    setNotas(prev => prev.map(n => (l.notas.includes(n.id) ? { ...n, pastaId: destino } : n)))
    setMapas(prev => prev.map(m => (l.mapas.includes(m.id) ? { ...m, pastaId: destino } : m)))
  }

  async function moverItens(chaves: Chave[], destino: string | null): Promise<boolean> {
    const mudam = chaves.filter(c => paiDe(c) !== destino)
    if (!mudam.length) return true
    const pastasMovidas = lote(mudam).pastas
    if (destino && descendentes(pastas, pastasMovidas).has(destino)) {
      avisar('Uma pasta não pode ir pra dentro dela mesma')
      return false
    }
    const origens = new Map<string | null, Chave[]>()
    mudam.forEach(c => { const o = paiDe(c); origens.set(o, [...(origens.get(o) ?? []), c]) })
    try {
      await proLaboreApi.anotacoes.mover(lote(mudam), destino)
    } catch (e) {
      alert((e as Error).message)
      return false
    }
    aplicarMovimento(mudam, destino)
    expandirAte(destino)
    const nomeDestino = destino ? pastas.find(p => p.id === destino)?.nome ?? 'a pasta' : 'Todas as notas'
    avisar(`${mudam.length === 1 ? `“${nomeDe(mudam[0])}” movido` : `${mudam.length} itens movidos`} para ${nomeDestino}`, async () => {
      for (const [origem, cs] of origens) {
        await proLaboreApi.anotacoes.mover(lote(cs), origem)
        aplicarMovimento(cs, origem)
      }
      avisar('Pronto, voltou pro lugar')
    })
    return true
  }

  async function excluirItens(chaves: Chave[]) {
    if (!chaves.length) return
    const l = lote(chaves)
    let pergunta: string
    if (chaves.length === 1) {
      const nome = nomeDe(chaves[0])
      pergunta = l.pastas.length ? `Excluir a pasta “${nome}”? O que estiver dentro dela não é apagado — sobe pra pasta de cima.`
        : l.notas.length ? `Excluir a página “${nome}”? Não dá pra desfazer.`
          : `Mover o mapa mental “${nome}” pra lixeira? Dá pra restaurar por 30 dias.`
    } else {
      const partes = [
        l.notas.length && `${l.notas.length} ${l.notas.length === 1 ? 'página' : 'páginas'} (não dá pra desfazer)`,
        l.pastas.length && `${l.pastas.length} ${l.pastas.length === 1 ? 'pasta' : 'pastas'} (o conteúdo sobe pra pasta de cima)`,
        l.mapas.length && `${l.mapas.length} ${l.mapas.length === 1 ? 'mapa mental vai' : 'mapas mentais vão'} pra lixeira`,
      ].filter(Boolean)
      pergunta = `Excluir ${chaves.length} itens?\n\n• ${partes.join('\n• ')}`
    }
    if (!confirm(pergunta)) return
    try {
      await proLaboreApi.anotacoes.excluir(l)
    } catch (e) {
      alert((e as Error).message)
      return
    }
    // Mesmas regras do servidor: conteúdo das pastas sobe até a primeira
    // pasta de cima que não foi excluída junto.
    const apagar = new Set(l.pastas)
    const destinoDe = (id: string): string | null => {
      let atual = pastas.find(p => p.id === id)?.paiId ?? null
      while (atual && apagar.has(atual)) atual = pastas.find(p => p.id === atual)?.paiId ?? null
      return atual
    }
    const destinos = new Map(l.pastas.map(id => [id, destinoDe(id)]))
    const subir = <T extends { pastaId?: string | null }>(x: T): T => (x.pastaId && apagar.has(x.pastaId) ? { ...x, pastaId: destinos.get(x.pastaId) ?? null } : x)
    setPastas(prev => prev.filter(p => !apagar.has(p.id)).map(p => (p.paiId && apagar.has(p.paiId) ? { ...p, paiId: destinos.get(p.paiId) ?? null } : p)))
    setNotas(prev => prev.filter(n => !l.notas.includes(n.id)).map(subir))
    setMapas(prev => prev.filter(m => !l.mapas.includes(m.id)).map(subir))

    const v = visaoRef.current
    if (v.tipo === 'pasta' && v.id && apagar.has(v.id)) navegar({ tipo: 'pasta', id: destinos.get(v.id) ?? null }, true)
    else if (v.tipo === 'nota' && l.notas.includes(v.id)) navegar({ tipo: 'pasta', id: notas.find(n => n.id === v.id)?.pastaId ?? null }, true)
    else if (v.tipo === 'mapa' && l.mapas.includes(v.id)) navegar({ tipo: 'pasta', id: mapas.find(m => m.id === v.id)?.pastaId ?? null }, true)

    const soMapas = l.notas.length === 0 && l.pastas.length === 0
    avisar(
      soMapas ? `${l.mapas.length === 1 ? 'Mapa mental movido' : `${l.mapas.length} mapas mentais movidos`} pra lixeira` : `${chaves.length === 1 ? 'Item excluído' : `${chaves.length} itens excluídos`}`,
      soMapas ? async () => {
        const restaurados = await Promise.all(l.mapas.map(id => proLaboreApi.mapasMentais.restaurar(id)))
        setMapas(prev => [...restaurados, ...prev])
        avisar('Restaurado')
      } : undefined,
    )
  }

  async function duplicarItens(chaves: Chave[]) {
    const l = lote(chaves)
    try {
      const novasNotas = await Promise.all(l.notas.map(id => {
        const n = notas.find(x => x.id === id)!
        return proLaboreApi.notas.criar({
          titulo: `${n.titulo || 'Sem título'} (cópia)`.slice(0, 200), conteudo: n.conteudo, blocos: n.blocos ?? undefined,
          icone: n.icone ?? null, categoria: n.categoria, pastaId: n.pastaId ?? null,
        })
      }))
      const novosMapas = await Promise.all(l.mapas.map(id => {
        const m = mapas.find(x => x.id === id)!
        const { objetos, conectores } = dadosIniciaisDoBoard(m)
        return proLaboreApi.mapasMentais.criar({
          titulo: `${m.titulo || 'Sem título'} (cópia)`.slice(0, 200), icone: m.icone ?? null, tema: m.tema ?? null,
          objetos, conectores, configuracao: m.configuracao ?? null, pastaId: m.pastaId ?? null,
        })
      }))
      setNotas(prev => [...novasNotas, ...prev])
      setMapas(prev => [...novosMapas, ...prev])
      const total = novasNotas.length + novosMapas.length
      if (total) avisar(total === 1 ? 'Cópia criada' : `${total} cópias criadas`)
      if (l.pastas.length) avisar(`${total ? `${total} ${total === 1 ? 'cópia criada' : 'cópias criadas'}. ` : ''}Pastas não são duplicadas.`)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  async function renomear(c: Chave, nome: string) {
    const { tipo, id } = partesDa(c)
    try {
      if (tipo === 'pasta') {
        await renomearPasta(id, nome)
      } else if (tipo === 'nota') {
        setNotas(prev => prev.map(n => (n.id === id ? { ...n, titulo: nome } : n)))
        await proLaboreApi.notas.atualizar(id, { titulo: nome })
      } else {
        setMapas(prev => prev.map(m => (m.id === id ? { ...m, titulo: nome } : m)))
        await proLaboreApi.mapasMentais.atualizar(id, { titulo: nome })
      }
    } catch (e) {
      alert((e as Error).message)
    }
  }

  // As três funções abaixo avisam quando a API falha — antes o clique
  // simplesmente não fazia nada visível (parecia que "não abre").
  async function criarNota(pastaId: string | null) {
    try {
      const nota = await proLaboreApi.notas.criar({ pastaId })
      setNotas(prev => [nota, ...prev])
      navegar({ tipo: 'nota', id: nota.id })
    } catch {
      alert('Não foi possível criar a página. Tente novamente.')
    }
  }

  async function criarMapa(pastaId: string | null, templateId: string = 'vazio') {
    try {
      const { objetos, conectores } = gerarBoardDoTemplate(templateId)
      // 'vazio'/'brainstorm' começam só com nós de mapa mental (noMapa) — já
      // abrem no motor fiel à referência. 'kanban'/'processo' usam seção/
      // sticky/forma, que esse motor não sabe desenhar, então ficam no board
      // livre ('manual', o padrão) igual antes.
      const configuracao = templateId === 'vazio' || templateId === 'brainstorm'
        ? { ...CONFIGURACAO_PADRAO, layout: 'mapaMental' as const }
        : undefined
      const mapa = await proLaboreApi.mapasMentais.criar({ pastaId, objetos, conectores, configuracao })
      setMapas(prev => [mapa, ...prev])
      navegar({ tipo: 'mapa', id: mapa.id })
    } catch {
      alert('Não foi possível criar o mapa mental. Tente novamente.')
    }
  }

  async function criarPasta(paiId: string | null) {
    try {
      const pasta = await proLaboreApi.pastas.criar({ nome: 'Nova pasta', paiId })
      setPastas(prev => [...prev, pasta])
      navegar({ tipo: 'pasta', id: pasta.id })
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

  async function restaurarMapa(id: string) {
    try {
      const mapa = await proLaboreApi.mapasMentais.restaurar(id)
      setLixeira(prev => prev.filter(m => m.id !== id))
      setMapas(prev => [mapa, ...prev])
      avisar('Mapa mental restaurado')
    } catch {
      alert('Não foi possível restaurar. Tente novamente.')
    }
  }

  async function excluirMapaDefinitivo(id: string) {
    if (!confirm('Excluir esse mapa mental em definitivo? Não dá pra desfazer.')) return
    try {
      await proLaboreApi.mapasMentais.excluirDefinitivo(id)
      setLixeira(prev => prev.filter(m => m.id !== id))
    } catch {
      alert('Não foi possível excluir. Tente novamente.')
    }
  }

  function atualizarNotaLocal(nota: Nota) {
    setNotas(prev => prev.map(n => (n.id === nota.id ? nota : n)))
  }

  function atualizarMapaLocal(mapa: MapaMental) {
    setMapas(prev => prev.map(m => (m.id === mapa.id ? mapa : m)))
  }

  function abrirItem(c: Chave) {
    const { tipo, id } = partesDa(c)
    navegar(tipo === 'pasta' ? { tipo: 'pasta', id } : { tipo, id })
  }

  function podeSoltarEm(destino: string | null, chaves: Chave[]): boolean {
    if (!chaves.length) return false
    return !(destino && descendentes(pastas, lote(chaves).pastas).has(destino))
  }

  // Alvos de soltar (pastas, trilha, "Todas as notas"): o destino vem no
  // atributo data-destino ("" = fora de pasta).
  const destinoDoAlvo = (e: React.DragEvent) => e.currentTarget.getAttribute('data-destino') || null
  function arrastarSobre(e: React.DragEvent) {
    const destino = destinoDoAlvo(e)
    if (!podeSoltarEm(destino, arrastandoRef.current)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const alvo = destino ?? 'raiz'
    setAlvoSoltar(a => (a === alvo ? a : alvo))
  }
  function sairDoAlvo(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    const alvo = destinoDoAlvo(e) ?? 'raiz'
    setAlvoSoltar(a => (a === alvo ? null : a))
  }
  function soltarNoAlvo(e: React.DragEvent) {
    e.preventDefault()
    const destino = destinoDoAlvo(e)
    const chaves = arrastandoRef.current
    arrastandoRef.current = []
    setAlvoSoltar(null)
    if (podeSoltarEm(destino, chaves)) void moverItens(chaves, destino)
  }

  const acoes: AcoesNavegador = {
    abrir: abrirItem,
    abrirPasta: id => navegar({ tipo: 'pasta', id }),
    mover: chaves => setMovendo(chaves),
    duplicar: chaves => { void duplicarItens(chaves) },
    excluir: chaves => { void excluirItens(chaves) },
    renomear: (c, nome) => { void renomear(c, nome) },
    enviarReunioes: id => setEnviando(mapas.find(m => m.id === id) ?? null),
    iniciarArraste: (e, chaves) => {
      arrastandoRef.current = chaves
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', chaves.map(nomeDe).join(', '))
    },
    terminarArraste: () => { arrastandoRef.current = []; setAlvoSoltar(null) },
    propsSoltar: destino => ({ 'data-destino': destino ?? '', onDragOver: arrastarSobre, onDragLeave: sairDoAlvo, onDrop: soltarNoAlvo }),
    alvoSoltar,
  }

  const modais = (
    <>
      <ComandoBusca
        aberta={buscaAberta}
        pastas={pastas}
        notas={notas}
        mapas={mapas}
        onFechar={() => setBuscaAberta(false)}
        onAbrirPasta={id => navegar({ tipo: 'pasta', id })}
        onAbrirNota={id => navegar({ tipo: 'nota', id })}
        onAbrirMapa={id => navegar({ tipo: 'mapa', id })}
      />
      {movendo && (
        <MoverItens
          chaves={movendo} pastas={pastas} nomeDe={nomeDe} paiDe={paiDe}
          onFechar={() => setMovendo(null)}
          onPastaCriada={p => setPastas(prev => [...prev, p])}
          onMover={async destino => { if (await moverItens(movendo, destino)) setMovendo(null) }}
        />
      )}
      {enviando && <EnviarParaReunioes mapa={enviando} onFechar={() => setEnviando(null)} />}
      {aviso && (
        <div className="pl-an-aviso" role="status">
          <span>{aviso.texto}</span>
          {aviso.desfazer && (
            <button type="button" onClick={() => { const d = aviso.desfazer!; setAviso(null); void d().catch(e => alert((e as Error).message)) }}>Desfazer</button>
          )}
          <button type="button" className="fechar" aria-label="Fechar aviso" onClick={() => setAviso(null)}>×</button>
        </div>
      )}
    </>
  )

  // Board em tela cheia: renderizado fora da sidebar/topbar do resto do app
  // (nem PageHeader nem pl-notion-shell), igual ao comportamento da
  // referência — abrir um mapa mental troca a tela inteira pro canvas.
  if (visao.tipo === 'mapa') {
    if (carregando) return <div className="pl-card"><div className="pl-hint">Carregando...</div></div>
    const mapa = mapas.find(m => m.id === visao.id) ?? null
    return (
      <>
        <PaginaMapaMental
          key={visao.id}
          mapa={mapa}
          onAtualizado={atualizarMapaLocal}
          onExcluir={() => { void excluirItens([chaveDe('mapa', visao.id)]) }}
          onVoltar={() => navegar({ tipo: 'pasta', id: mapa?.pastaId ?? null })}
          onMover={() => setMovendo([chaveDe('mapa', visao.id)])}
          onApresentar={() => setEnviando(mapa)}
        />
        {modais}
      </>
    )
  }

  const ativo: Chave | null = visao.tipo === 'pasta' ? (visao.id ? chaveDe('pasta', visao.id) : null) : visao.tipo === 'nota' ? chaveDe('nota', visao.id) : null
  const notaAberta = visao.tipo === 'nota' ? notas.find(n => n.id === visao.id) ?? null : null
  const pastaAberta = visao.tipo === 'pasta' && visao.id ? pastas.find(p => p.id === visao.id) ?? null : null

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
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" className="pl-arvore-acao" title="Buscar (Ctrl+K)" onClick={() => setBuscaAberta(true)} style={{ opacity: 1 }}>🔍</button>
                <button type="button" className="pl-arvore-acao" title="Nova página" onClick={() => criarNota(null)} style={{ opacity: 1 }}>+</button>
              </div>
            </div>
            <div className="pl-arvore-raiz">
              <div className={`pl-arvore-item ${visao.tipo === 'pasta' && visao.id === null ? 'active' : ''} ${alvoSoltar === 'raiz' ? 'pl-an-alvo' : ''}`} data-destino="" onDragOver={arrastarSobre} onDragLeave={sairDoAlvo} onDrop={soltarNoAlvo}>
                <span className="pl-arvore-chevron invisivel" />
                <button type="button" className="pl-arvore-label" onClick={() => navegar({ tipo: 'pasta', id: null })}>
                  <span className="pl-arvore-icone">🏠</span>
                  <span className="pl-arvore-nome">Todas as notas</span>
                </button>
              </div>
              {pastas.filter(p => (p.paiId ?? null) === null).map(p => (
                <NoArvore
                  key={p.id} pasta={p} nivel={0} pastas={pastas} notas={notas} mapas={mapas} ativo={ativo} abertas={abertas}
                  onAlternarAberta={alternarAberta} onNovaNota={criarNota} acoes={acoes}
                />
              ))}
              {notas.filter(n => (n.pastaId ?? null) === null).map(n => (
                <FolhaArvore key={n.id} chave={chaveDe('nota', n.id)} icone={n.icone || '📄'} nome={n.titulo || 'Sem título'} recuo={18} ativo={ativo} acoes={acoes} />
              ))}
              {mapas.filter(m => (m.pastaId ?? null) === null).map(m => (
                <FolhaArvore key={m.id} chave={chaveDe('mapa', m.id)} icone={m.icone || '🧠'} nome={m.titulo || 'Sem título'} recuo={18} ativo={ativo} acoes={acoes} />
              ))}
              <button type="button" className="pl-arvore-nova-pasta" onClick={() => criarPasta(null)}>+ Nova pasta</button>
              <div className={`pl-arvore-item ${visao.tipo === 'lixeira' ? 'active' : ''}`} style={{ marginTop: 10 }}>
                <span className="pl-arvore-chevron invisivel" />
                <button type="button" className="pl-arvore-label" onClick={() => navegar({ tipo: 'lixeira' })}>
                  <span className="pl-arvore-icone">🗑️</span>
                  <span className="pl-arvore-nome">Lixeira</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pl-notion-main">
            {visao.tipo === 'lixeira' ? (
              <VisaoLixeira
                mapas={lixeira}
                onAbrirPasta={id => navegar({ tipo: 'pasta', id })}
                onRestaurar={restaurarMapa}
                onExcluirDefinitivo={excluirMapaDefinitivo}
              />
            ) : visao.tipo === 'pasta' ? (
              visao.id && !pastaAberta ? (
                <div className="pl-empty pl-card">
                  <div className="pl-emoji">📁</div>
                  Pasta não encontrada — pode ter sido excluída.
                  <div style={{ marginTop: 10 }}><button type="button" className="pl-btn pl-btn-ghost" onClick={() => navegar({ tipo: 'pasta', id: null }, true)}>Ir pra Todas as notas</button></div>
                </div>
              ) : (
                <VisaoPasta
                  key={visao.id ?? 'raiz'}
                  pasta={pastaAberta}
                  pastas={pastas}
                  notas={notas}
                  mapas={mapas}
                  ordem={ordem}
                  onOrdem={mudarOrdem}
                  atalhosAtivos={!movendo && !enviando && !buscaAberta && !escolhaTemplate}
                  acoes={acoes}
                  cabecalho={
                    <CabecalhoPasta
                      key={pastaAberta ? `${pastaAberta.id}-${pastaAberta.nome}` : 'raiz'}
                      pasta={pastaAberta}
                      onRenomear={(id, nome) => { void renomearPasta(id, nome) }}
                      onIcone={(id, icone) => { void definirIconePasta(id, icone) }}
                      onExcluir={id => { void excluirItens([chaveDe('pasta', id)]) }}
                    />
                  }
                  tiles={
                    <div className="pl-fb-tiles">
                      <button type="button" className="pl-fb-tile pl-fb-tile-roxo" onClick={() => setEscolhaTemplate({ pastaId: visao.id })}>
                        <span className="pl-fb-tile-icone"><IconeTileMapa /></span>
                        <span>+ Novo mapa mental</span>
                      </button>
                      <button type="button" className="pl-fb-tile pl-fb-tile-azul" onClick={() => criarNota(visao.id)}>
                        <span className="pl-fb-tile-icone"><IconeTilePagina /></span>
                        <span>+ Nova página</span>
                      </button>
                      <button type="button" className="pl-fb-tile pl-fb-tile-cinza" onClick={() => criarPasta(visao.id)}>
                        <span className="pl-fb-tile-icone"><IconeTilePasta /></span>
                        <span>+ Nova pasta</span>
                      </button>
                    </div>
                  }
                />
              )
            ) : (
              <>
                {notaAberta && (
                  <div className="pl-an-topo">
                    <button type="button" className="pl-an-voltar" onClick={() => navegar({ tipo: 'pasta', id: notaAberta.pastaId ?? null })} title="Voltar pra pasta">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
                      Voltar
                    </button>
                    <Trilha pastas={pastas} atual={notaAberta.pastaId ?? null} acoes={acoes} final={notaAberta.titulo || 'Sem título'} />
                    <span className="pl-an-topo-espaco" />
                    <button type="button" className="pl-an-topo-btn" onClick={() => setMovendo([chaveDe('nota', notaAberta.id)])}>Mover</button>
                    <button type="button" className="pl-an-topo-btn" onClick={() => { void duplicarItens([chaveDe('nota', notaAberta.id)]) }}>Duplicar</button>
                  </div>
                )}
                <PaginaNota
                  key={visao.id}
                  nota={notaAberta}
                  onAtualizada={atualizarNotaLocal}
                  onExcluir={() => { void excluirItens([chaveDe('nota', visao.id)]) }}
                />
              </>
            )}
          </div>
        </div>
      )}

      {modais}

      <EscolhaTemplateModal
        aberta={escolhaTemplate !== null}
        onFechar={() => setEscolhaTemplate(null)}
        onEscolher={templateId => {
          if (escolhaTemplate) criarMapa(escolhaTemplate.pastaId, templateId)
          setEscolhaTemplate(null)
        }}
      />
    </div>
  )
}

export default function ProLaboreAnotacoesPage() {
  return (
    <Suspense fallback={<div className="pl-card"><div className="pl-hint">Carregando...</div></div>}>
      <Anotacoes />
    </Suspense>
  )
}
