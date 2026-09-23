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
  ReactFlow, ReactFlowProvider, Background, Controls, Panel, Handle, Position, BaseEdge, NodeToolbar, NodeResizer,
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
function IconeSticky() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 3H3v14l4 4h14V3z" />
      <path d="M17 21v-4a2 2 0 0 1 2-2h2" />
    </svg>
  )
}
function IconeTexto() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  )
}
function IconeIconeBiblioteca() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="5" />
      <polyline points="9 21 9 15 15 15 15 21" />
    </svg>
  )
}
function IconeSecao() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5a2 2 0 0 0-2 2v4" />
      <path d="M15 3h4a2 2 0 0 1 2 2v4" />
      <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
      <path d="M15 21h4a2 2 0 0 0 2-2v-4" />
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

// Cores pastel pra sticky notes — paleta separada da PALETA_RAMOS (que é
// pra linhas/ramos, cores mais saturadas): sticky note de verdade tem
// fundo claro com texto escuro por cima, não o contrário.
const PALETA_STICKY = ['#f5d76e', '#f7a1c4', '#a8e6a3', '#9fd8f7', '#d9b8f5', '#f7b787']

// --- Biblioteca de ícones (6.7 do mapeamento) — subconjunto curado no
// mesmo estilo Feather do resto do app; não é a biblioteca completa da
// referência (que inclui ícones de arquitetura cloud etc.), só os mais
// genéricos/úteis pra anotar um diagrama. ---
export type TipoIcone = 'estrela' | 'coracao' | 'check' | 'alerta' | 'lampada' | 'bandeira' | 'relogio' | 'calendario' | 'cadeado' | 'usuario' | 'seta' | 'pergunta'

const ICONE_PATHS: Record<TipoIcone, React.ReactNode> = {
  estrela: <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" />,
  coracao: <path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 2.5 5 6 5c2 0 3.5 1.2 4 2.5C10.5 6.2 12 5 14 5c3.5 0 5.5 3.5 3.5 7.5C19 16.65 12 21 12 21z" />,
  check: <polyline points="20 6 9 17 4 12" />,
  alerta: (
    <>
      <path d="M12 2 1 21h22L12 2z" />
      <line x1="12" y1="9" x2="12" y2="14" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  lampada: (
    <>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.75V17h8v-2.25A7 7 0 0 0 12 2z" />
    </>
  ),
  bandeira: (
    <>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </>
  ),
  relogio: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  cadeado: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  usuario: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  seta: (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </>
  ),
  pergunta: (
    <>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
      <circle cx="12" cy="12" r="10" />
    </>
  ),
}

const ORDEM_ICONES: TipoIcone[] = ['estrela', 'coracao', 'check', 'alerta', 'lampada', 'bandeira', 'relogio', 'calendario', 'cadeado', 'usuario', 'seta', 'pergunta']

function IconeObjetoSvg({ tipo }: { tipo: TipoIcone }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICONE_PATHS[tipo]}
    </svg>
  )
}

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

interface DadosSticky extends Record<string, unknown> {
  tipoObjeto: 'sticky'
  texto: string
  cor: string
}

interface DadosTexto extends Record<string, unknown> {
  tipoObjeto: 'texto'
  texto: string
}

interface DadosIcone extends Record<string, unknown> {
  tipoObjeto: 'icone'
  icone: TipoIcone
  cor: string
}

interface DadosSecao extends Record<string, unknown> {
  tipoObjeto: 'secao'
  texto: string
  cor: string
}

type DadosObjeto = DadosNoMapa | DadosForma | DadosSticky | DadosTexto | DadosIcone | DadosSecao
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
  if (o.tipo === 'sticky') {
    return {
      id: o.id, type: 'sticky', position: { x: o.x, y: o.y },
      data: { tipoObjeto: 'sticky', texto: (o.conteudo.texto as string) ?? '', cor: (o.estilo?.cor as string) ?? PALETA_STICKY[0] },
    }
  }
  if (o.tipo === 'texto') {
    return {
      id: o.id, type: 'texto', position: { x: o.x, y: o.y },
      data: { tipoObjeto: 'texto', texto: (o.conteudo.texto as string) ?? '' },
    }
  }
  if (o.tipo === 'icone') {
    return {
      id: o.id, type: 'icone', position: { x: o.x, y: o.y },
      data: { tipoObjeto: 'icone', icone: (o.conteudo.icone as TipoIcone) ?? 'estrela', cor: (o.estilo?.cor as string) ?? corHerdada },
    }
  }
  if (o.tipo === 'secao') {
    return {
      id: o.id, type: 'secao', position: { x: o.x, y: o.y }, width: o.largura ?? 420, height: o.altura ?? 280, zIndex: -1,
      data: { tipoObjeto: 'secao', texto: (o.conteudo.texto as string) ?? '', cor: (o.estilo?.cor as string) ?? 'var(--pl-accent)' },
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
  if (n.data.tipoObjeto === 'sticky') {
    return { id: n.id, tipo: 'sticky', x: n.position.x, y: n.position.y, estilo: { cor: n.data.cor }, conteudo: { texto: n.data.texto } }
  }
  if (n.data.tipoObjeto === 'texto') {
    return { id: n.id, tipo: 'texto', x: n.position.x, y: n.position.y, conteudo: { texto: n.data.texto } }
  }
  if (n.data.tipoObjeto === 'icone') {
    return { id: n.id, tipo: 'icone', x: n.position.x, y: n.position.y, estilo: { cor: n.data.cor }, conteudo: { icone: n.data.icone } }
  }
  if (n.data.tipoObjeto === 'secao') {
    return {
      id: n.id, tipo: 'secao', x: n.position.x, y: n.position.y,
      largura: n.width ?? 420, altura: n.height ?? 280,
      estilo: { cor: n.data.cor }, conteudo: { texto: n.data.texto },
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

// Deslocamento em cascata a partir do nó de referência — sem isso, clicar
// em vários botões de "adicionar X" em sequência sem selecionar nada entre
// um clique e outro empilha os objetos exatamente na mesma posição (todos
// usam o mesmo `noSelecionadoId` como base).
function posicaoEmCascata(base: NoFlow | undefined, totalNos: number) {
  const passo = totalNos % 6
  return { x: (base?.position.x ?? 0) + 260 + passo * 220, y: (base?.position.y ?? 0) + passo * 30 }
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

function StickyNode({ id, data }: NodeProps<NoFlow>) {
  const acoes = useContext(AcoesMapaContext)!
  const d = data as DadosSticky
  const [valor, setValor] = useState(d.texto)
  const [editando, setEditando] = useState(d.texto === '')
  useEffect(() => { setValor(d.texto) }, [d.texto])

  function entrarEdicao() { setEditando(true) }
  function sairEdicao() { setEditando(false) }

  return (
    <div className="pl-sticky-no" style={{ background: d.cor }}>
      <NodeToolbar position={Position.Top} offset={10} className="pl-mapa-toolbar nodrag nopan">
        <button type="button" className="pl-mapa-toolbar-btn" title="Editar texto" onClick={entrarEdicao}>✎</button>
        <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir" onClick={() => acoes.onExcluir(id)}>×</button>
      </NodeToolbar>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      {editando ? (
        <textarea
          className="nodrag nopan pl-sticky-textarea"
          autoFocus
          value={valor}
          placeholder="Escreva algo..."
          onChange={e => { setValor(e.target.value); acoes.onMudarTexto(id, e.target.value) }}
          onBlur={sairEdicao}
          onKeyDown={e => { if (e.key === 'Escape') e.currentTarget.blur() }}
        />
      ) : (
        <div className="pl-sticky-texto" onDoubleClick={entrarEdicao}>{valor || 'Escreva algo...'}</div>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

function TextoNode({ id, data }: NodeProps<NoFlow>) {
  const acoes = useContext(AcoesMapaContext)!
  const d = data as DadosTexto
  const [valor, setValor] = useState(d.texto)
  const [editando, setEditando] = useState(d.texto === '')
  useEffect(() => { setValor(d.texto) }, [d.texto])

  function entrarEdicao() { setEditando(true) }
  function sairEdicao() { setEditando(false) }

  return (
    <div className="pl-texto-no">
      <NodeToolbar position={Position.Top} offset={10} className="pl-mapa-toolbar nodrag nopan">
        <button type="button" className="pl-mapa-toolbar-btn" title="Editar texto" onClick={entrarEdicao}>✎</button>
        <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir" onClick={() => acoes.onExcluir(id)}>×</button>
      </NodeToolbar>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      {editando ? (
        <input
          className="nodrag nopan pl-texto-input"
          autoFocus
          value={valor}
          placeholder="Texto"
          style={{ width: `${Math.max(valor.length, 4) + 2}ch` }}
          onChange={e => { setValor(e.target.value); acoes.onMudarTexto(id, e.target.value) }}
          onBlur={sairEdicao}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
        />
      ) : (
        <div className="pl-texto-texto" onDoubleClick={entrarEdicao}>{valor || 'Texto'}</div>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

function IconeNode({ id, data }: NodeProps<NoFlow>) {
  const acoes = useContext(AcoesMapaContext)!
  const d = data as DadosIcone

  return (
    <div className="pl-icone-no" style={{ color: d.cor }}>
      <NodeToolbar position={Position.Top} offset={10} className="pl-mapa-toolbar nodrag nopan">
        <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir" onClick={() => acoes.onExcluir(id)}>×</button>
      </NodeToolbar>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <IconeObjetoSvg tipo={d.icone} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

function SecaoNode({ id, data, selected }: NodeProps<NoFlow>) {
  const acoes = useContext(AcoesMapaContext)!
  const d = data as DadosSecao
  const [valor, setValor] = useState(d.texto)
  const [editando, setEditando] = useState(false)
  useEffect(() => { setValor(d.texto) }, [d.texto])

  function entrarEdicao() { setEditando(true) }
  function sairEdicao() { setEditando(false) }

  return (
    <div className="pl-secao-no" style={{ background: `color-mix(in srgb, ${d.cor} 12%, transparent)`, borderColor: d.cor }}>
      <NodeResizer minWidth={220} minHeight={160} isVisible={!!selected} lineClassName="pl-secao-resize-linha" handleClassName="pl-secao-resize-alca" />
      <NodeToolbar position={Position.Top} offset={10} className="pl-mapa-toolbar nodrag nopan">
        <button type="button" className="pl-mapa-toolbar-btn" title="Renomear" onClick={entrarEdicao}>✎</button>
        <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir" onClick={() => acoes.onExcluir(id)}>×</button>
      </NodeToolbar>
      {editando ? (
        <input
          className="nodrag nopan pl-secao-input"
          autoFocus
          value={valor}
          placeholder="Nome da seção"
          onChange={e => { setValor(e.target.value); acoes.onMudarTexto(id, e.target.value) }}
          onBlur={sairEdicao}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
        />
      ) : (
        <div className="pl-secao-titulo" onDoubleClick={entrarEdicao}>{valor || 'Seção'}</div>
      )}
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

const nodeTypes = {
  noMapa: NoMapaNode, forma: FormaNode, sticky: StickyNode, texto: TextoNode, icone: IconeNode, secao: SecaoNode,
} as unknown as NodeTypes
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
  const [iconesAbertos, setIconesAbertos] = useState(false)
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
    // Nem todo tipo de objeto tem cor própria (ex.: texto livre) — cai pro
    // neutro padrão nesse caso, em vez de herdar uma cor inexistente.
    const corPai = typeof pai.data.cor === 'string' ? pai.data.cor : 'var(--pl-ink-2)'
    const cor = paiEhCentral ? PALETA_RAMOS[filhosExistentes % PALETA_RAMOS.length] : corPai
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
      position: posicaoEmCascata(base, atual.nodes.length),
      data: { tipoObjeto: 'forma', forma, texto: '', cor: PALETA_RAMOS[0] },
    }
    commit({ nodes: [...atual.nodes, novoNo], edges: atual.edges })
  }, [noSelecionadoId])

  const onAdicionarSticky = useCallback(() => {
    const atual = grafoRef.current
    const base = atual.nodes.find(n => n.id === noSelecionadoId) ?? atual.nodes[0]
    const cor = PALETA_STICKY[atual.nodes.filter(n => n.type === 'sticky').length % PALETA_STICKY.length]
    const novoId = gerarIdNo()
    const novoNo: NoFlow = {
      id: novoId, type: 'sticky',
      position: posicaoEmCascata(base, atual.nodes.length),
      data: { tipoObjeto: 'sticky', texto: '', cor },
    }
    commit({ nodes: [...atual.nodes, novoNo], edges: atual.edges })
  }, [noSelecionadoId])

  const onAdicionarTexto = useCallback(() => {
    const atual = grafoRef.current
    const base = atual.nodes.find(n => n.id === noSelecionadoId) ?? atual.nodes[0]
    const novoId = gerarIdNo()
    const novoNo: NoFlow = {
      id: novoId, type: 'texto',
      position: posicaoEmCascata(base, atual.nodes.length),
      data: { tipoObjeto: 'texto', texto: '' },
    }
    commit({ nodes: [...atual.nodes, novoNo], edges: atual.edges })
  }, [noSelecionadoId])

  const onAdicionarIcone = useCallback((icone: TipoIcone) => {
    const atual = grafoRef.current
    const base = atual.nodes.find(n => n.id === noSelecionadoId) ?? atual.nodes[0]
    const novoId = gerarIdNo()
    const novoNo: NoFlow = {
      id: novoId, type: 'icone',
      position: posicaoEmCascata(base, atual.nodes.length),
      data: { tipoObjeto: 'icone', icone, cor: 'var(--pl-accent)' },
    }
    commit({ nodes: [...atual.nodes, novoNo], edges: atual.edges })
  }, [noSelecionadoId])

  const onAdicionarSecao = useCallback(() => {
    const atual = grafoRef.current
    const base = atual.nodes.find(n => n.id === noSelecionadoId) ?? atual.nodes[0]
    const passo = atual.nodes.length % 6
    const novoId = gerarIdNo()
    const novoNo: NoFlow = {
      id: novoId, type: 'secao',
      position: { x: (base?.position.x ?? 0) - 460 - passo * 18, y: (base?.position.y ?? 0) - 140 + passo * 20 },
      width: 420, height: 280, zIndex: -1,
      data: { tipoObjeto: 'secao', texto: 'Seção', cor: 'var(--pl-accent)' },
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
            <button type="button" className="pl-mapa-tv-btn" title="Sticky note" onClick={onAdicionarSticky}>
              <IconeSticky />
            </button>
            <button type="button" className="pl-mapa-tv-btn" title="Texto" onClick={onAdicionarTexto}>
              <IconeTexto />
            </button>
            <div className="pl-mapa-tv-item">
              <button type="button" className={`pl-mapa-tv-btn ${iconesAbertos ? 'ativo' : ''}`} title="Ícones" onClick={() => setIconesAbertos(v => !v)}>
                <IconeIconeBiblioteca />
              </button>
              {iconesAbertos && (
                <div className="pl-mapa-formas-flyout">
                  {ORDEM_ICONES.map(tipo => (
                    <button
                      key={tipo} type="button" className="pl-mapa-forma-opcao" title={tipo}
                      onClick={() => { onAdicionarIcone(tipo); setIconesAbertos(false) }}
                    >
                      <IconeObjetoSvg tipo={tipo} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="pl-mapa-tv-btn" title="Seção" onClick={onAdicionarSecao}>
              <IconeSecao />
            </button>
            <div className="pl-mapa-tv-divisor" />
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
