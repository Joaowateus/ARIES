'use client'

// Canvas de mapa mental livre, estilo MindMeister: nó central + ramos que
// saem em qualquer direção, cada nó arrastável pra qualquer posição (via
// @xyflow/react — pan, zoom, drag e arestas "flutuantes" já vêm prontos da
// lib, sem precisar reinventar motor de canvas). A hierarquia (quem é filho
// de quem) só muda pelos botões "+"/"×"; arrastar só reposiciona, nunca
// reparenta — MindMeister de verdade permite os dois, mas reparentar por
// proximidade exigiria uma heurística de "soltar perto de" que não vale o
// esforço aqui.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, Panel, Handle, Position, BaseEdge, NodeToolbar,
  getBezierPath, useInternalNode, useReactFlow, applyNodeChanges,
  type Node, type Edge, type NodeProps, type EdgeProps, type NodeTypes, type EdgeTypes, type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { NoMapa } from '@/lib/proLaboreApi'

// Ícones da toolbar vertical flutuante (réplica da barra da referência) —
// mesmo estilo Feather (stroke, 24x24) do restante do app.
function IconeCursor() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
    </svg>
  )
}
function IconeMao() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-4 0v5" />
      <path d="M14 10V4a2 2 0 0 0-4 0v6" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M7 15a4 4 0 0 0 4 4h2a6 6 0 0 0 6-6v-2a2 2 0 0 0-4 0" />
    </svg>
  )
}
function IconeMais() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function IconeLixeiraToolbar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}
function IconeAjustarTela() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}

function gerarIdNo(): string {
  return `n${Date.now()}${Math.random().toString(36).slice(2, 8)}`
}

export function criarNoMapa(texto = '', x = 0, y = 0): NoMapa {
  return { id: gerarIdNo(), texto, x, y, filhos: [] }
}

// Mapas criados antes da posição livre existir não têm x/y no JSON salvo —
// calcula uma posição padrão em camadas (a partir do pai) na primeira
// abertura. Nó que já tem posição (arrastado manualmente, ou já migrado)
// nunca é movido daqui.
type NoMapaLegado = Omit<NoMapa, 'x' | 'y' | 'filhos'> & { x?: number; y?: number; filhos: NoMapaLegado[] }

function garantirPosicoes(no: NoMapaLegado, xPadrao: number, yPadrao: number): NoMapa {
  const x = typeof no.x === 'number' ? no.x : xPadrao
  const y = typeof no.y === 'number' ? no.y : yPadrao
  const n = no.filhos.length
  const filhos = no.filhos.map((f, i) => garantirPosicoes(f, x + 280, y + (i - (n - 1) / 2) * 130))
  return { id: no.id, texto: no.texto, x, y, filhos }
}

const PALETA_RAMOS = ['#5b8def', '#e0a83e', '#e0687a', '#57c785', '#a679e0', '#4fc3d9', '#e08d4f', '#8d9de0']

interface DadosNo extends Record<string, unknown> {
  texto: string
  ehCentral: boolean
  cor: string
}

type NoFlow = Node<DadosNo>

function arvoreParaFlow(raiz: NoMapa): { nodes: NoFlow[]; edges: Edge[] } {
  const nodes: NoFlow[] = []
  const edges: Edge[] = []

  function visitar(no: NoMapa, ehCentral: boolean, cor: string) {
    nodes.push({ id: no.id, type: 'noMapa', position: { x: no.x, y: no.y }, data: { texto: no.texto, ehCentral, cor } })
    no.filhos.forEach((filho, i) => {
      const corRamo = ehCentral ? PALETA_RAMOS[i % PALETA_RAMOS.length] : cor
      edges.push({
        id: `${no.id}-${filho.id}`, source: no.id, target: filho.id, type: 'flutuante',
        style: { stroke: corRamo, strokeWidth: 2.5 },
      })
      visitar(filho, false, corRamo)
    })
  }

  visitar(raiz, true, 'var(--pl-accent)')
  return { nodes, edges }
}

function idsDaSubarvore(edges: Edge[], raizId: string): Set<string> {
  const filhosPorPai = new Map<string, string[]>()
  edges.forEach(e => filhosPorPai.set(e.source, [...(filhosPorPai.get(e.source) ?? []), e.target]))
  const ids = new Set<string>()
  const pilha = [raizId]
  while (pilha.length > 0) {
    const atual = pilha.pop()!
    if (ids.has(atual)) continue
    ids.add(atual)
    filhosPorPai.get(atual)?.forEach(f => pilha.push(f))
  }
  return ids
}

function reconstruirArvore(nodes: NoFlow[], edges: Edge[], raizId: string): NoMapa {
  const porId = new Map(nodes.map(n => [n.id, n]))
  const filhosPorPai = new Map<string, string[]>()
  edges.forEach(e => filhosPorPai.set(e.source, [...(filhosPorPai.get(e.source) ?? []), e.target]))

  function construir(id: string): NoMapa {
    const no = porId.get(id)!
    return {
      id, texto: no.data.texto, x: no.position.x, y: no.position.y,
      filhos: (filhosPorPai.get(id) ?? []).map(construir),
    }
  }

  return construir(raizId)
}

// --- Contexto com as ações dos botões do nó, pra não precisar embutir
// funções dentro de `data` (que precisa ficar serializável/simples). ---
const AcoesMapaContext = createContext<{
  onMudarTexto: (id: string, texto: string) => void
  onAdicionarFilho: (id: string) => void
  onExcluir: (id: string) => void
} | null>(null)

function NoMapaNode({ id, data }: NodeProps<NoFlow>) {
  const acoes = useContext(AcoesMapaContext)!
  const [valor, setValor] = useState(data.texto)
  // Nó novo (texto vazio) já abre editando; senão começa só "rótulo" —
  // arrastável em qualquer ponto. Precisa desse split de modo (rótulo vs.
  // input) porque o input, marcado nodrag pra não brigar com seleção de
  // texto, cobre quase o nó inteiro — sem ele, clicar no meio do nó pra
  // arrastar sempre cairia em cima do input e nunca iniciaria o arraste.
  const [editando, setEditando] = useState(data.texto === '')
  useEffect(() => { setValor(data.texto) }, [data.texto])

  function entrarEdicao() { setEditando(true) }
  function sairEdicao() { setEditando(false) }

  return (
    <div className={`pl-mapa-no ${data.ehCentral ? 'pl-mapa-no-central' : ''}`}>
      <NodeToolbar position={Position.Top} offset={10} className="pl-mapa-toolbar nodrag nopan">
        <button type="button" className="pl-mapa-toolbar-btn" title="Editar texto" onClick={entrarEdicao}>✎</button>
        <button type="button" className="pl-mapa-toolbar-btn" title="Adicionar ideia filha" onClick={() => acoes.onAdicionarFilho(id)}>+</button>
        {!data.ehCentral && (
          <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir" onClick={() => acoes.onExcluir(id)}>×</button>
        )}
      </NodeToolbar>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      {editando ? (
        <input
          className="nodrag nopan pl-mapa-no-input"
          autoFocus
          value={valor}
          placeholder={data.ehCentral ? 'Ideia central' : 'Nova ideia'}
          style={{ width: `${Math.max(valor.length, 4) + 2}ch` }}
          onChange={e => { setValor(e.target.value); acoes.onMudarTexto(id, e.target.value) }}
          onBlur={sairEdicao}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
        />
      ) : (
        <div className="pl-mapa-no-texto" onDoubleClick={entrarEdicao} title="Duplo clique pra editar · arraste pra mover">
          {valor || (data.ehCentral ? 'Ideia central' : 'Nova ideia')}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

// Aresta "flutuante": em vez de sair de um ponto fixo (esquerda/direita) do
// nó, calcula onde a reta entre os dois centros cruza a borda de cada
// caixa — assim a curva sempre aponta na direção real do outro nó, não
// importa pra onde ele foi arrastado. Técnica padrão da documentação do
// React Flow pra grafos com nós em posição livre.
function interseccaoComNo(noOrigem: ReturnType<typeof useInternalNode>, noAlvo: ReturnType<typeof useInternalNode>) {
  if (!noOrigem || !noAlvo) return { x: 0, y: 0 }
  const largura = noOrigem.measured.width ?? 150
  const altura = noOrigem.measured.height ?? 40
  const posOrigem = noOrigem.internals.positionAbsolute
  const posAlvo = noAlvo.internals.positionAbsolute
  const larguraAlvo = noAlvo.measured.width ?? 150
  const alturaAlvo = noAlvo.measured.height ?? 40

  const w = largura / 2
  const h = altura / 2
  const x2 = posOrigem.x + w
  const y2 = posOrigem.y + h
  const x1 = posAlvo.x + larguraAlvo / 2
  const y1 = posAlvo.y + alturaAlvo / 2

  const xx1 = (x1 - x2) / (2 * w)
  const yy1 = (y1 - y2) / (2 * h)
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1)
  return { x: w * (a * xx1 + 1) + x2, y: h * (a * yy1 + 1) + y2 }
}

function EdgeFlutuante({ id, source, target, style }: EdgeProps) {
  const noOrigem = useInternalNode(source)
  const noAlvo = useInternalNode(target)
  if (!noOrigem || !noAlvo) return null

  const pontoOrigem = interseccaoComNo(noOrigem, noAlvo)
  const pontoAlvo = interseccaoComNo(noAlvo, noOrigem)
  const [caminho] = getBezierPath({
    sourceX: pontoOrigem.x, sourceY: pontoOrigem.y, targetX: pontoAlvo.x, targetY: pontoAlvo.y,
  })

  return <BaseEdge id={id} path={caminho} style={style} />
}

const nodeTypes = { noMapa: NoMapaNode } as unknown as NodeTypes
const edgeTypes = { flutuante: EdgeFlutuante } as unknown as EdgeTypes

function Canvas({ raizInicial, onChange }: { raizInicial: NoMapa; onChange: (raiz: NoMapa) => void }) {
  const raizId = raizInicial.id
  const { fitView } = useReactFlow()
  const [grafo, setGrafo] = useState<{ nodes: NoFlow[]; edges: Edge[] }>(
    () => arvoreParaFlow(garantirPosicoes(raizInicial as NoMapaLegado, 0, 0)),
  )
  // Modo "mão" (pan): desliga o arraste de nó, então segurar e arrastar em
  // qualquer ponto do canvas move a tela em vez de mover o nó — réplica do
  // par cursor/mão da barra da referência.
  const [modoMao, setModoMao] = useState(false)
  const noSelecionadoId = grafo.nodes.find(n => n.selected)?.id ?? raizId
  // grafoRef precisa ficar em dia de forma síncrona (não via useEffect): o
  // xyflow dispara onNodesChange (posição final, dragging:false) e em
  // seguida onNodeDragStop no mesmo evento de mouseup, síncronos entre si —
  // um useEffect só roda depois do commit, tarde demais pro
  // finalizarArraste() de baixo ler a posição que acabou de ser arrastada.
  const grafoRef = useRef(grafo)

  // `fitView` (prop do <ReactFlow>) só roda na montagem. Sem isso, cada nó
  // novo adicionado mais pra fora do enquadramento inicial fica visualmente
  // cortado pelo `overflow: hidden` do canvas — existe no DOM, mas fora da
  // área clicável/arrastável. Reajusta o enquadramento sempre que a
  // quantidade de nós muda (nunca durante um arraste, já que a contagem não
  // muda nesse caso — não atrapalha o usuário reposicionando).
  const totalNos = grafo.nodes.length
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 60)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalNos])

  const onNodesChangeFlow = useCallback((changes: NodeChange<NoFlow>[]) => {
    setGrafo(atual => {
      const novo = { ...atual, nodes: applyNodeChanges(changes, atual.nodes) }
      grafoRef.current = novo
      return novo
    })
  }, [])

  function finalizarArraste() {
    onChange(reconstruirArvore(grafoRef.current.nodes, grafoRef.current.edges, raizId))
  }

  // Nunca chama `onChange` (que sobe até o setState da PaginaMapaMental) de
  // dentro do updater funcional do setGrafo — o React trata isso como
  // "setState de um componente durante o render de outro" e avisa/rejeita.
  // Por isso lê o estado atual via ref e computa o próximo valor antes,
  // fora do updater, e só então chama setGrafo (valor pronto) + onChange
  // como duas instruções comuns do handler.
  function commit(novoGrafo: { nodes: NoFlow[]; edges: Edge[] }) {
    grafoRef.current = novoGrafo
    setGrafo(novoGrafo)
    onChange(reconstruirArvore(novoGrafo.nodes, novoGrafo.edges, raizId))
  }

  const onMudarTexto = useCallback((id: string, texto: string) => {
    const atual = grafoRef.current
    const nodes = atual.nodes.map(n => (n.id === id ? { ...n, data: { ...n.data, texto } } : n))
    commit({ ...atual, nodes })
  }, [onChange, raizId])

  const onAdicionarFilho = useCallback((paiId: string) => {
    const atual = grafoRef.current
    const pai = atual.nodes.find(n => n.id === paiId)
    if (!pai) return
    const filhosExistentes = atual.edges.filter(e => e.source === paiId).length
    const cor = pai.data.ehCentral ? PALETA_RAMOS[filhosExistentes % PALETA_RAMOS.length] : pai.data.cor
    const novoId = gerarIdNo()
    const novoNo: NoFlow = {
      id: novoId, type: 'noMapa',
      position: { x: pai.position.x + 260, y: pai.position.y + filhosExistentes * 90 - (filhosExistentes > 0 ? 45 : 0) },
      data: { texto: '', ehCentral: false, cor },
    }
    const novaAresta: Edge = { id: `${paiId}-${novoId}`, source: paiId, target: novoId, type: 'flutuante', style: { stroke: cor, strokeWidth: 2.5 } }
    commit({ nodes: [...atual.nodes, novoNo], edges: [...atual.edges, novaAresta] })
  }, [onChange, raizId])

  const onExcluir = useCallback((id: string) => {
    const atual = grafoRef.current
    const idsRemover = idsDaSubarvore(atual.edges, id)
    const nodes = atual.nodes.filter(n => !idsRemover.has(n.id))
    const edges = atual.edges.filter(e => !idsRemover.has(e.source) && !idsRemover.has(e.target))
    commit({ nodes, edges })
  }, [onChange, raizId])

  return (
    <AcoesMapaContext.Provider value={{ onMudarTexto, onAdicionarFilho, onExcluir }}>
      <div className="pl-mapa-canvas">
        <ReactFlow
          nodes={grafo.nodes}
          edges={grafo.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChangeFlow}
          onNodeDragStop={finalizarArraste}
          nodesDraggable={!modoMao}
          fitView
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={22} size={1} color="var(--pl-border-strong)" />
          <Controls showInteractive={false} position="bottom-right" orientation="horizontal" />
          <Panel position="top-left" className="pl-mapa-toolbar-vertical">
            <button type="button" className={`pl-mapa-tv-btn ${!modoMao ? 'ativo' : ''}`} title="Selecionar" onClick={() => setModoMao(false)}>
              <IconeCursor />
            </button>
            <button type="button" className={`pl-mapa-tv-btn ${modoMao ? 'ativo' : ''}`} title="Mover tela" onClick={() => setModoMao(true)}>
              <IconeMao />
            </button>
            <div className="pl-mapa-tv-divisor" />
            <button type="button" className="pl-mapa-tv-btn" title="Adicionar ideia" onClick={() => onAdicionarFilho(noSelecionadoId)}>
              <IconeMais />
            </button>
            <button
              type="button"
              className="pl-mapa-tv-btn pl-mapa-tv-btn-danger"
              title="Excluir selecionado"
              disabled={noSelecionadoId === raizId}
              onClick={() => onExcluir(noSelecionadoId)}
            >
              <IconeLixeiraToolbar />
            </button>
            <div className="pl-mapa-tv-divisor" />
            <button type="button" className="pl-mapa-tv-btn" title="Ajustar à tela" onClick={() => fitView({ padding: 0.3, duration: 300 })}>
              <IconeAjustarTela />
            </button>
          </Panel>
        </ReactFlow>
      </div>
    </AcoesMapaContext.Provider>
  )
}

export default function MapaMentalCanvas(props: { raizInicial: NoMapa; onChange: (raiz: NoMapa) => void }) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}
