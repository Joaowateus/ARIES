'use client'

// Canvas de board livre, estilo Whimsical: qualquer objeto (nó de mapa
// mental, forma de diagrama) arrastável pra qualquer posição, conectado
// livremente a qualquer outro objeto — via @xyflow/react (pan, zoom, drag e
// arestas "flutuantes" já vêm prontos da lib, sem precisar reinventar motor
// de canvas). O board é guardado como uma estrutura PLANA (`objetos` +
// `conectores`), não uma árvore — a hierarquia do mapa mental (quem é filho
// de quem) é só um caso particular de conectores partindo de um nó central,
// não uma limitação estrutural do modelo. Mapas antigos (formato legado
// `raiz`, árvore recursiva) são convertidos pra essa estrutura plana na
// primeira abertura, ver `dadosIniciaisDoBoard`.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, Panel, Handle, Position, BaseEdge, NodeToolbar,
  getBezierPath, useInternalNode, useReactFlow, applyNodeChanges,
  type Node, type Edge, type Connection, type NodeProps, type EdgeProps, type NodeTypes, type EdgeTypes, type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { BoardConector, BoardObjeto, MapaMental, NoMapa } from '@/lib/proLaboreApi'

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
function IconeFormas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="11" height="11" rx="2" />
      <circle cx="16.5" cy="16.5" r="5.5" />
    </svg>
  )
}

function gerarIdNo(): string {
  return `n${Date.now()}${Math.random().toString(36).slice(2, 8)}`
}

// Mapas criados antes da posição livre existir não têm x/y no JSON salvo —
// calcula uma posição padrão em camadas (a partir do pai) na primeira
// abertura. Nó que já tem posição (arrastado manualmente, ou já migrado)
// nunca é movido daqui. Só usado pra converter o formato legado (`raiz`).
type NoMapaLegado = Omit<NoMapa, 'x' | 'y' | 'filhos'> & { x?: number; y?: number; filhos: NoMapaLegado[] }

function garantirPosicoes(no: NoMapaLegado, xPadrao: number, yPadrao: number): NoMapa {
  const x = typeof no.x === 'number' ? no.x : xPadrao
  const y = typeof no.y === 'number' ? no.y : yPadrao
  const n = no.filhos.length
  const filhos = no.filhos.map((f, i) => garantirPosicoes(f, x + 280, y + (i - (n - 1) / 2) * 130))
  return { id: no.id, texto: no.texto, x, y, filhos }
}

function arvoreParaBoard(raiz: NoMapa): { objetos: BoardObjeto[]; conectores: BoardConector[] } {
  const objetos: BoardObjeto[] = []
  const conectores: BoardConector[] = []
  function visitar(no: NoMapa, ehCentral: boolean) {
    objetos.push({ id: no.id, tipo: 'noMapa', x: no.x, y: no.y, conteudo: { texto: no.texto, ehCentral } })
    no.filhos.forEach(filho => {
      conectores.push({ id: `${no.id}-${filho.id}`, origemId: no.id, destinoId: filho.id })
      visitar(filho, false)
    })
  }
  visitar(raiz, true)
  return { objetos, conectores }
}

export function criarBoardPadrao(texto = 'Ideia central'): { objetos: BoardObjeto[]; conectores: BoardConector[] } {
  return { objetos: [{ id: gerarIdNo(), tipo: 'noMapa', x: 0, y: 0, conteudo: { texto, ehCentral: true } }], conectores: [] }
}

// Resolve o formato inicial do board a partir do que veio da API: já no
// formato novo (objetos/conectores) → usa direto; só formato legado (raiz)
// → converte a árvore pra plano; nenhum dos dois (mapa novo, ainda sem
// resposta da API) → board padrão com um nó central.
export function dadosIniciaisDoBoard(mapa: MapaMental | null): { objetos: BoardObjeto[]; conectores: BoardConector[] } {
  if (mapa?.objetos && mapa.objetos.length > 0) return { objetos: mapa.objetos, conectores: mapa.conectores ?? [] }
  if (mapa?.raiz) return arvoreParaBoard(garantirPosicoes(mapa.raiz as NoMapaLegado, 0, 0))
  return criarBoardPadrao()
}

const PALETA_RAMOS = ['#5b8def', '#e0a83e', '#e0687a', '#57c785', '#a679e0', '#4fc3d9', '#e08d4f', '#8d9de0']

// --- Catálogo de formas de diagrama (6.2 do mapeamento) — cada forma é só
// uma combinação de largura/altura/clip-path (ou borda, pras sem
// preenchimento). O texto fica numa camada separada por cima do
// preenchimento, nunca dentro da área com clip-path, senão formas
// pontudas (losango/triângulo/estrela) cortariam o próprio texto. ---
export type TipoForma = 'retangulo' | 'pilula' | 'oval' | 'losango' | 'trapezio' | 'triangulo' | 'hexagono' | 'cilindro' | 'linha' | 'colchete' | 'estrela' | 'nuvem'

interface ConfigForma { rotulo: string; atalho: string; largura: number; altura: number; clipPath?: string; borderRadius?: string; semPreenchimento?: boolean }

const CONFIG_FORMA: Record<TipoForma, ConfigForma> = {
  retangulo: { rotulo: 'Retângulo', atalho: 'R', largura: 160, altura: 90, borderRadius: '10px' },
  pilula: { rotulo: 'Pílula', atalho: 'U', largura: 170, altura: 64, borderRadius: '999px' },
  oval: { rotulo: 'Oval', atalho: 'O', largura: 160, altura: 100, borderRadius: '50%' },
  losango: { rotulo: 'Losango', atalho: 'D', largura: 170, altura: 120, clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' },
  trapezio: { rotulo: 'Trapézio', atalho: 'A', largura: 170, altura: 100, clipPath: 'polygon(22% 0%, 78% 0%, 100% 100%, 0% 100%)' },
  triangulo: { rotulo: 'Triângulo', atalho: 'G', largura: 160, altura: 130, clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' },
  hexagono: { rotulo: 'Hexágono', atalho: 'H', largura: 170, altura: 100, clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' },
  cilindro: { rotulo: 'Cilindro', atalho: 'Y', largura: 140, altura: 110, borderRadius: '50% 50% 10px 10px / 22% 22% 10px 10px' },
  linha: { rotulo: 'Linha', atalho: 'L', largura: 180, altura: 14, borderRadius: '999px' },
  colchete: { rotulo: 'Colchete', atalho: 'B', largura: 46, altura: 120, semPreenchimento: true },
  estrela: {
    rotulo: 'Estrela', atalho: 'V', largura: 140, altura: 140,
    clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  },
  nuvem: { rotulo: 'Nuvem', atalho: 'J', largura: 180, altura: 110, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%' },
}

const ORDEM_FORMAS: TipoForma[] = ['retangulo', 'pilula', 'oval', 'losango', 'trapezio', 'triangulo', 'hexagono', 'cilindro', 'linha', 'colchete', 'estrela', 'nuvem']

interface DadosNoMapa extends Record<string, unknown> {
  tipoObjeto: 'noMapa'
  texto: string
  ehCentral: boolean
  cor: string
}

interface DadosForma extends Record<string, unknown> {
  tipoObjeto: 'forma'
  forma: TipoForma
  texto: string
  cor: string
}

type DadosObjeto = DadosNoMapa | DadosForma
type NoFlow = Node<DadosObjeto>

function objetoParaNode(o: BoardObjeto, corHerdada: string): NoFlow {
  if (o.tipo === 'forma') {
    return {
      id: o.id, type: 'forma', position: { x: o.x, y: o.y },
      data: {
        tipoObjeto: 'forma',
        forma: (o.conteudo.forma as TipoForma) ?? 'retangulo',
        texto: (o.conteudo.texto as string) ?? '',
        cor: (o.estilo?.cor as string) ?? corHerdada,
      },
    }
  }
  return {
    id: o.id, type: 'noMapa', position: { x: o.x, y: o.y },
    data: { tipoObjeto: 'noMapa', texto: (o.conteudo.texto as string) ?? '', ehCentral: !!o.conteudo.ehCentral, cor: corHerdada },
  }
}

function nodeParaObjeto(n: NoFlow): BoardObjeto {
  if (n.data.tipoObjeto === 'forma') {
    return {
      id: n.id, tipo: 'forma', x: n.position.x, y: n.position.y,
      estilo: { cor: n.data.cor }, conteudo: { forma: n.data.forma, texto: n.data.texto },
    }
  }
  return {
    id: n.id, tipo: 'noMapa', x: n.position.x, y: n.position.y,
    conteudo: { texto: n.data.texto, ehCentral: n.data.ehCentral },
  }
}

// Monta nodes/edges do React Flow a partir do board plano, calculando a cor
// de cada ramo do mapa mental por BFS a partir do nó central (mesma lógica
// visual de antes, só que operando sobre conectores livres em vez de uma
// árvore fixa — formas soltas sem caminho até o central ficam com a cor
// neutra padrão).
function boardParaFlow(objetos: BoardObjeto[], conectores: BoardConector[]): { nodes: NoFlow[]; edges: Edge[] } {
  const central = objetos.find(o => o.tipo === 'noMapa' && o.conteudo.ehCentral)
  const corPorObjeto = new Map<string, string>()
  if (central) corPorObjeto.set(central.id, 'var(--pl-accent)')

  const saidaPorOrigem = new Map<string, BoardConector[]>()
  conectores.forEach(c => saidaPorOrigem.set(c.origemId, [...(saidaPorOrigem.get(c.origemId) ?? []), c]))

  if (central) {
    const fila = [central.id]
    const visitados = new Set([central.id])
    while (fila.length > 0) {
      const atualId = fila.shift()!
      const corAtual = corPorObjeto.get(atualId) ?? PALETA_RAMOS[0]
      const saidas = saidaPorOrigem.get(atualId) ?? []
      saidas.forEach((c, i) => {
        if (visitados.has(c.destinoId)) return
        visitados.add(c.destinoId)
        corPorObjeto.set(c.destinoId, atualId === central.id ? PALETA_RAMOS[i % PALETA_RAMOS.length] : corAtual)
        fila.push(c.destinoId)
      })
    }
  }

  const nodes = objetos.map(o => objetoParaNode(o, corPorObjeto.get(o.id) ?? 'var(--pl-ink-2)'))
  const edges: Edge[] = conectores.map(c => ({
    id: c.id, source: c.origemId, target: c.destinoId, type: 'flutuante',
    style: { stroke: (c.estilo?.cor as string) ?? corPorObjeto.get(c.destinoId) ?? 'var(--pl-ink-2)', strokeWidth: 2.5 },
  }))
  return { nodes, edges }
}

function flowParaBoard(nodes: NoFlow[], edges: Edge[]): { objetos: BoardObjeto[]; conectores: BoardConector[] } {
  return {
    objetos: nodes.map(nodeParaObjeto),
    conectores: edges.map(e => {
      const cor = e.style && typeof e.style === 'object' && 'stroke' in e.style ? (e.style as { stroke?: string }).stroke : undefined
      return { id: e.id, origemId: e.source, destinoId: e.target, ...(cor ? { estilo: { cor } } : {}) }
    }),
  }
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

// --- Contexto com as ações dos botões do nó, pra não precisar embutir
// funções dentro de `data` (que precisa ficar serializável/simples). ---
const AcoesMapaContext = createContext<{
  onMudarTexto: (id: string, texto: string) => void
  onAdicionarFilho: (id: string) => void
  onExcluir: (id: string) => void
} | null>(null)

function NoMapaNode({ id, data }: NodeProps<NoFlow>) {
  const acoes = useContext(AcoesMapaContext)!
  const d = data as DadosNoMapa
  const [valor, setValor] = useState(d.texto)
  // Nó novo (texto vazio) já abre editando; senão começa só "rótulo" —
  // arrastável em qualquer ponto. Precisa desse split de modo (rótulo vs.
  // input) porque o input, marcado nodrag pra não brigar com seleção de
  // texto, cobre quase o nó inteiro — sem ele, clicar no meio do nó pra
  // arrastar sempre cairia em cima do input e nunca iniciaria o arraste.
  const [editando, setEditando] = useState(d.texto === '')
  useEffect(() => { setValor(d.texto) }, [d.texto])

  function entrarEdicao() { setEditando(true) }
  function sairEdicao() { setEditando(false) }

  return (
    <div className={`pl-mapa-no ${d.ehCentral ? 'pl-mapa-no-central' : ''}`}>
      <NodeToolbar position={Position.Top} offset={10} className="pl-mapa-toolbar nodrag nopan">
        <button type="button" className="pl-mapa-toolbar-btn" title="Editar texto" onClick={entrarEdicao}>✎</button>
        <button type="button" className="pl-mapa-toolbar-btn" title="Adicionar ideia filha" onClick={() => acoes.onAdicionarFilho(id)}>+</button>
        {!d.ehCentral && (
          <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir" onClick={() => acoes.onExcluir(id)}>×</button>
        )}
      </NodeToolbar>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      {editando ? (
        <input
          className="nodrag nopan pl-mapa-no-input"
          autoFocus
          value={valor}
          placeholder={d.ehCentral ? 'Ideia central' : 'Nova ideia'}
          style={{ width: `${Math.max(valor.length, 4) + 2}ch` }}
          onChange={e => { setValor(e.target.value); acoes.onMudarTexto(id, e.target.value) }}
          onBlur={sairEdicao}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
        />
      ) : (
        <div className="pl-mapa-no-texto" onDoubleClick={entrarEdicao} title="Duplo clique pra editar · arraste pra mover">
          {valor || (d.ehCentral ? 'Ideia central' : 'Nova ideia')}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

function FormaNode({ id, data }: NodeProps<NoFlow>) {
  const acoes = useContext(AcoesMapaContext)!
  const d = data as DadosForma
  const [valor, setValor] = useState(d.texto)
  const [editando, setEditando] = useState(d.texto === '')
  useEffect(() => { setValor(d.texto) }, [d.texto])
  const config = CONFIG_FORMA[d.forma]

  function entrarEdicao() { setEditando(true) }
  function sairEdicao() { setEditando(false) }

  return (
    <div className="pl-forma-no" style={{ width: config.largura, height: config.altura }}>
      <div
        className="pl-forma-preenchimento"
        style={config.semPreenchimento
          ? { border: `2.5px solid ${d.cor}`, borderRadius: config.borderRadius }
          : { background: d.cor, clipPath: config.clipPath, borderRadius: config.borderRadius }}
      />
      <NodeToolbar position={Position.Top} offset={10} className="pl-mapa-toolbar nodrag nopan">
        <button type="button" className="pl-mapa-toolbar-btn" title="Editar texto" onClick={entrarEdicao}>✎</button>
        <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir" onClick={() => acoes.onExcluir(id)}>×</button>
      </NodeToolbar>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="pl-forma-conteudo" style={{ color: config.semPreenchimento ? 'var(--pl-ink-1)' : '#fff' }} onDoubleClick={entrarEdicao}>
        {editando ? (
          <input
            className="nodrag nopan pl-forma-input"
            autoFocus
            value={valor}
            placeholder="Texto"
            onChange={e => { setValor(e.target.value); acoes.onMudarTexto(id, e.target.value) }}
            onBlur={sairEdicao}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
          />
        ) : (
          <div className="pl-forma-texto">{valor}</div>
        )}
      </div>
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

const nodeTypes = { noMapa: NoMapaNode, forma: FormaNode } as unknown as NodeTypes
const edgeTypes = { flutuante: EdgeFlutuante } as unknown as EdgeTypes

function Canvas({ dadosIniciais, onChange }: {
  dadosIniciais: { objetos: BoardObjeto[]; conectores: BoardConector[] }
  onChange: (dados: { objetos: BoardObjeto[]; conectores: BoardConector[] }) => void
}) {
  const { fitView } = useReactFlow()
  const [grafo, setGrafo] = useState<{ nodes: NoFlow[]; edges: Edge[] }>(
    () => boardParaFlow(dadosIniciais.objetos, dadosIniciais.conectores),
  )
  // Modo "mão" (pan): desliga o arraste de nó, então segurar e arrastar em
  // qualquer ponto do canvas move a tela em vez de mover o nó — réplica do
  // par cursor/mão da barra da referência.
  const [modoMao, setModoMao] = useState(false)
  const [formasAbertas, setFormasAbertas] = useState(false)
  const centralId = grafo.nodes.find(n => n.data.tipoObjeto === 'noMapa' && n.data.ehCentral)?.id
  const noSelecionadoId = grafo.nodes.find(n => n.selected)?.id ?? centralId ?? grafo.nodes[0]?.id
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
    onChange(flowParaBoard(grafoRef.current.nodes, grafoRef.current.edges))
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
    onChange(flowParaBoard(novoGrafo.nodes, novoGrafo.edges))
  }

  const onMudarTexto = useCallback((id: string, texto: string) => {
    const atual = grafoRef.current
    const nodes = atual.nodes.map(n => (n.id === id ? { ...n, data: { ...n.data, texto } } : n))
    commit({ ...atual, nodes })
  }, [])

  const onAdicionarFilho = useCallback((paiId: string) => {
    const atual = grafoRef.current
    const pai = atual.nodes.find(n => n.id === paiId)
    if (!pai) return
    const paiEhCentral = pai.data.tipoObjeto === 'noMapa' && pai.data.ehCentral
    const filhosExistentes = atual.edges.filter(e => e.source === paiId).length
    const cor = paiEhCentral ? PALETA_RAMOS[filhosExistentes % PALETA_RAMOS.length] : pai.data.cor
    const novoId = gerarIdNo()
    const novoNo: NoFlow = {
      id: novoId, type: 'noMapa',
      position: { x: pai.position.x + 260, y: pai.position.y + filhosExistentes * 90 - (filhosExistentes > 0 ? 45 : 0) },
      data: { tipoObjeto: 'noMapa', texto: '', ehCentral: false, cor },
    }
    const novaAresta: Edge = { id: `${paiId}-${novoId}`, source: paiId, target: novoId, type: 'flutuante', style: { stroke: cor, strokeWidth: 2.5 } }
    commit({ nodes: [...atual.nodes, novoNo], edges: [...atual.edges, novaAresta] })
  }, [])

  const onExcluir = useCallback((id: string) => {
    const atual = grafoRef.current
    const idsRemover = idsDaSubarvore(atual.edges, id)
    const nodes = atual.nodes.filter(n => !idsRemover.has(n.id))
    const edges = atual.edges.filter(e => !idsRemover.has(e.source) && !idsRemover.has(e.target))
    commit({ nodes, edges })
  }, [])

  const onAdicionarForma = useCallback((forma: TipoForma) => {
    const atual = grafoRef.current
    const base = atual.nodes.find(n => n.id === noSelecionadoId) ?? atual.nodes[0]
    const novoId = gerarIdNo()
    const novoNo: NoFlow = {
      id: novoId, type: 'forma',
      position: { x: (base?.position.x ?? 0) + 260, y: base?.position.y ?? 0 },
      data: { tipoObjeto: 'forma', forma, texto: '', cor: PALETA_RAMOS[0] },
    }
    commit({ nodes: [...atual.nodes, novoNo], edges: atual.edges })
  }, [noSelecionadoId])

  // Conectar dois objetos livremente arrastando de um Handle a outro (6.3
  // do mapeamento) — sem estilo customizável ainda (linha reta/curva,
  // tracejado, ponta), só a linha "flutuante" padrão com cor neutra.
  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return
    const atual = grafoRef.current
    const novaAresta: Edge = { id: `c${gerarIdNo()}`, source: params.source, target: params.target, type: 'flutuante', style: { stroke: 'var(--pl-ink-2)', strokeWidth: 2.5 } }
    commit({ ...atual, edges: [...atual.edges, novaAresta] })
  }, [])

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
          onConnect={onConnect}
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
            <button type="button" className="pl-mapa-tv-btn" title="Adicionar ideia" onClick={() => noSelecionadoId && onAdicionarFilho(noSelecionadoId)}>
              <IconeMais />
            </button>
            <div className="pl-mapa-tv-item">
              <button type="button" className={`pl-mapa-tv-btn ${formasAbertas ? 'ativo' : ''}`} title="Formas" onClick={() => setFormasAbertas(v => !v)}>
                <IconeFormas />
              </button>
              {formasAbertas && (
                <div className="pl-mapa-formas-flyout">
                  {ORDEM_FORMAS.map(tipo => (
                    <button
                      key={tipo} type="button" className="pl-mapa-forma-opcao"
                      title={`${CONFIG_FORMA[tipo].rotulo} (${CONFIG_FORMA[tipo].atalho})`}
                      onClick={() => { onAdicionarForma(tipo); setFormasAbertas(false) }}
                    >
                      <span
                        className="pl-mapa-forma-preview"
                        style={CONFIG_FORMA[tipo].semPreenchimento
                          ? { border: '2px solid var(--pl-ink-2)', borderRadius: CONFIG_FORMA[tipo].borderRadius }
                          : { background: 'var(--pl-ink-2)', clipPath: CONFIG_FORMA[tipo].clipPath, borderRadius: CONFIG_FORMA[tipo].borderRadius }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="pl-mapa-tv-btn pl-mapa-tv-btn-danger"
              title="Excluir selecionado"
              disabled={!noSelecionadoId || noSelecionadoId === centralId}
              onClick={() => noSelecionadoId && onExcluir(noSelecionadoId)}
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

export default function MapaMentalCanvas(props: {
  dadosIniciais: { objetos: BoardObjeto[]; conectores: BoardConector[] }
  onChange: (dados: { objetos: BoardObjeto[]; conectores: BoardConector[] }) => void
}) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}
