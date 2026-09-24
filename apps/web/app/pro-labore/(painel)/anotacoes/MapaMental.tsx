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
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, Panel, Handle, Position, BaseEdge, NodeToolbar, NodeResizer,
  EdgeLabelRenderer, MarkerType,
  getBezierPath, useInternalNode, useReactFlow, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type Connection, type NodeProps, type EdgeProps, type NodeTypes, type EdgeTypes, type NodeChange, type EdgeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toPng } from 'html-to-image'
import { BoardConector, BoardObjeto, MapaMental, NoMapa } from '@/lib/proLaboreApi'

// Temas visuais do canvas (fundo + padrão de pontilhado/grade) — catálogo
// espelhado em TEMAS_BOARD no backend (proLabore.ts), que só valida o id.
// Persistido em MapaMental.tema; ausente/null usa o primeiro ('claro').
// A cor de fundo/pontilhado em si NÃO mora aqui: fica só em CSS, via
// `[data-tema="..."]` em .pl-mapa-canvas (ver pro-labore.css). Motivo: nós
// "sem fundo próprio" do board (texto de ramo do mapa mental, texto livre)
// pintam a letra com var(--pl-ink-1), que já muda sozinho entre claro/escuro
// pelo tema do ARIES — um fundo de canvas fixo em hex, independente disso,
// deixaria o texto ilegível sempre que o tema do app não bater com o do
// board. Cada tema não-'claro' redefine --pl-ink-1/--pl-surface/etc. só
// dentro do canvas, virando um "escopo de tema" próprio nesse pedaço da
// tela — 'claro' não redefine nada, é literalmente o comportamento padrão
// de antes dessa feature existir (var(--pl-bg) do app, claro ou escuro).
export interface TemaCatalogo { id: string; label: string; variante: BackgroundVariant; amostra: string }
export const TEMAS_BOARD: TemaCatalogo[] = [
  { id: 'claro', label: 'Claro', variante: BackgroundVariant.Dots, amostra: '#f4f5f8' },
  { id: 'escuro', label: 'Escuro', variante: BackgroundVariant.Dots, amostra: '#191b22' },
  { id: 'quente', label: 'Quente', variante: BackgroundVariant.Dots, amostra: '#fbf3e6' },
  { id: 'quadriculado', label: 'Quadriculado', variante: BackgroundVariant.Lines, amostra: '#eef2fb' },
]
export type TemaBoard = (typeof TEMAS_BOARD)[number]['id']

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
function IconeDesfazer() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10h10a5 5 0 0 1 0 10h-2" />
      <polyline points="8 5 3 10 8 15" />
    </svg>
  )
}
function IconeRefazer() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10H11a5 5 0 0 0 0 10h2" />
      <polyline points="16 5 21 10 16 15" />
    </svg>
  )
}
function IconeExportar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}
function IconeApresentar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <polygon points="10 8 15 10.5 10 13" fill="currentColor" stroke="none" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}
function IconeSetaEsquerda() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}
function IconeSetaDireita() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
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
function IconeTabela() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  )
}
function IconeModoDiagrama() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M8.5 8.5l7 7" />
    </svg>
  )
}
function IconeModoWireframe() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
    </svg>
  )
}
function IconeModoTarefas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <rect x="14" y="3" width="7" height="10" rx="1" />
    </svg>
  )
}
function IconeFrame() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="3" y1="7" x2="21" y2="7" />
    </svg>
  )
}
function IconeBotaoWireframe() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="8" rx="4" />
    </svg>
  )
}
function IconeInputWireframe() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="8" rx="1" />
      <line x1="6" y1="12" x2="12" y2="12" />
    </svg>
  )
}
function IconeAvatarWireframe() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
    </svg>
  )
}
function IconePilha() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="4" rx="1" />
      <rect x="4" y="10" width="16" height="4" rx="1" />
      <rect x="4" y="16" width="16" height="4" rx="1" />
    </svg>
  )
}
function IconeTarefaCard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <polyline points="7 12 10 15 17 8" />
    </svg>
  )
}
function IconeMarcador() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  )
}
function IconeMarcaTexto() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l6-6 4 4-6 6H9v-4z" />
      <path d="M3 21l4-4" />
    </svg>
  )
}
function IconeComentario() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}
function IconeResolver() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// Ícones da barra de seleção múltipla (alinhar/distribuir/agrupar/camadas/
// travar) — mesmo estilo Feather do resto do arquivo.
function IconeAlinharEsq() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="2" x2="4" y2="22" />
      <rect x="7" y="5" width="7" height="4" />
      <rect x="7" y="11" width="13" height="4" />
      <rect x="7" y="17" width="4" height="4" />
    </svg>
  )
}
function IconeAlinharCentroH() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="2" x2="12" y2="22" />
      <rect x="8.5" y="5" width="7" height="4" />
      <rect x="5.5" y="11" width="13" height="4" />
      <rect x="10" y="17" width="4" height="4" />
    </svg>
  )
}
function IconeAlinharDir() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="20" y1="2" x2="20" y2="22" />
      <rect x="10" y="5" width="7" height="4" />
      <rect x="4" y="11" width="13" height="4" />
      <rect x="13" y="17" width="4" height="4" />
    </svg>
  )
}
function IconeAlinharTopo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="2" y1="4" x2="22" y2="4" />
      <rect x="5" y="7" width="4" height="7" />
      <rect x="11" y="7" width="4" height="13" />
      <rect x="17" y="7" width="4" height="4" />
    </svg>
  )
}
function IconeAlinharMeio() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="2" y1="12" x2="22" y2="12" />
      <rect x="5" y="8.5" width="4" height="7" />
      <rect x="11" y="5.5" width="4" height="13" />
      <rect x="17" y="10" width="4" height="4" />
    </svg>
  )
}
function IconeAlinharBase() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="2" y1="20" x2="22" y2="20" />
      <rect x="5" y="13" width="4" height="7" />
      <rect x="11" y="7" width="4" height="13" />
      <rect x="17" y="16" width="4" height="4" />
    </svg>
  )
}
function IconeDistribuirH() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="8" width="4" height="8" />
      <rect x="10" y="8" width="4" height="8" />
      <rect x="18" y="8" width="4" height="8" />
    </svg>
  )
}
function IconeDistribuirV() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="8" y="2" width="8" height="4" />
      <rect x="8" y="10" width="8" height="4" />
      <rect x="8" y="18" width="8" height="4" />
    </svg>
  )
}
function IconeAgrupar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
      <path d="M11 7h4a2 2 0 0 1 2 2v4" />
    </svg>
  )
}
function IconeDesagrupar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  )
}
function IconeTrazerFrente() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="12" height="12" rx="1" opacity="0.4" />
      <rect x="9" y="9" width="12" height="12" rx="1" />
    </svg>
  )
}
function IconeEnviarTras() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="12" height="12" rx="1" />
      <rect x="9" y="9" width="12" height="12" rx="1" opacity="0.4" />
    </svg>
  )
}
function IconeCadeadoSelecao() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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

// Templates prontos (6.13 do mapeamento): pontos de partida populados em vez
// de sempre abrir um board vazio. Cada um monta objetos/conectores no MESMO
// formato genérico do board (nenhum tipo de objeto novo) — 'brainstorm'
// reaproveita a árvore de noMapa (cores calculadas automaticamente por
// boardParaFlow via BFS a partir do central, igual "Adicionar filho"),
// 'kanban' usa seção (coluna) + sticky (card de exemplo) e 'processo' usa
// formas conectadas com seta, um fluxograma simples.
export interface TemplateBoard { id: string; label: string; descricao: string; icone: string }
export const TEMPLATES_BOARD: TemplateBoard[] = [
  { id: 'vazio', label: 'Board em branco', descricao: 'Só a ideia central, pra começar do zero.', icone: '⬜' },
  { id: 'brainstorm', label: 'Brainstorm', descricao: 'Ideia central com três ramos pra desenvolver.', icone: '🧠' },
  { id: 'kanban', label: 'Kanban simples', descricao: 'Três colunas: A Fazer, Fazendo e Feito.', icone: '📋' },
  { id: 'processo', label: 'Mapa de processo', descricao: 'Fluxo de etapas conectadas por setas.', icone: '➡️' },
]

export function gerarBoardDoTemplate(templateId: string): { objetos: BoardObjeto[]; conectores: BoardConector[] } {
  if (templateId === 'brainstorm') {
    const central = gerarIdNo()
    const ramos = [gerarIdNo(), gerarIdNo(), gerarIdNo()]
    return {
      objetos: [
        { id: central, tipo: 'noMapa', x: 0, y: 0, conteudo: { texto: 'Ideia central', ehCentral: true } },
        { id: ramos[0], tipo: 'noMapa', x: 300, y: -160, conteudo: { texto: 'Ramo 1', ehCentral: false } },
        { id: ramos[1], tipo: 'noMapa', x: 300, y: 0, conteudo: { texto: 'Ramo 2', ehCentral: false } },
        { id: ramos[2], tipo: 'noMapa', x: 300, y: 160, conteudo: { texto: 'Ramo 3', ehCentral: false } },
      ],
      conectores: ramos.map(destinoId => ({ id: gerarIdNo(), origemId: central, destinoId })),
    }
  }
  if (templateId === 'kanban') {
    const colunas = [{ nome: 'A Fazer', x: 0 }, { nome: 'Fazendo', x: 460 }, { nome: 'Feito', x: 920 }]
    const objetos: BoardObjeto[] = []
    colunas.forEach((col, i) => {
      objetos.push({
        id: gerarIdNo(), tipo: 'secao', x: col.x, y: 0, largura: 420, altura: 480,
        conteudo: { texto: col.nome }, estilo: { cor: PALETA_RAMOS[i % PALETA_RAMOS.length] },
      })
      objetos.push({
        id: gerarIdNo(), tipo: 'sticky', x: col.x + 30, y: 80,
        conteudo: { texto: 'Tarefa de exemplo' }, estilo: { cor: PALETA_STICKY[i % PALETA_STICKY.length] },
      })
    })
    return { objetos, conectores: [] }
  }
  if (templateId === 'processo') {
    const etapas: { texto: string; forma: TipoForma }[] = [
      { texto: 'Início', forma: 'pilula' },
      { texto: 'Etapa 1', forma: 'retangulo' },
      { texto: 'Decisão?', forma: 'losango' },
      { texto: 'Etapa 2', forma: 'retangulo' },
      { texto: 'Fim', forma: 'pilula' },
    ]
    const ids = etapas.map(() => gerarIdNo())
    return {
      objetos: etapas.map((etapa, i) => ({
        id: ids[i], tipo: 'forma', x: i * 240, y: 0,
        conteudo: { forma: etapa.forma, texto: etapa.texto }, estilo: { cor: PALETA_RAMOS[0] },
      })),
      conectores: ids.slice(0, -1).map((origemId, i) => ({
        id: gerarIdNo(), origemId, destinoId: ids[i + 1], estilo: { seta: true },
      })),
    }
  }
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

// Tabela (6.6 do mapeamento) — grade simples de células de texto, sem
// fórmulas/cálculos (fora de escopo por decisão explícita da referência) e
// sem conteúdo rico por célula (imagem/menção) nem reordenar linha/coluna
// arrastando — v1 cobre inserir/adicionar/remover linha e coluna e ordenar
// por coluna, que já é o essencial de "tabela num board".
interface DadosTabela extends Record<string, unknown> {
  tipoObjeto: 'tabela'
  linhas: string[][]
}

// Desenho à mão livre (6.9) — traço único capturado por gesto de
// arrastar; `pontos` são relativos ao canto superior-esquerdo do objeto
// (já inclui a folga de `espessura`), não em coordenadas absolutas do
// board, pra mover o objeto não exigir recalcular o traço inteiro.
// Marcador vs. marca-texto (Shift+H) é só um preset de espessura/cor/
// opacidade na criação, não um tipo separado. Sem borracha dedicada —
// apagar um traço é excluir o objeto pela seleção normal, como qualquer
// outro objeto do board.
interface DadosDesenho extends Record<string, unknown> {
  tipoObjeto: 'desenho'
  pontos: { x: number; y: number }[]
  cor: string
  espessura: number
  opacidade: number
}

// --- Modo Wireframe (6.10): frame (tela), botão, input, avatar. Retângulo/
// círculo/linha do wireframe reaproveitam o catálogo de formas (6.2) em vez
// de duplicar tipos; "Anotação" reaproveita o objeto de texto livre.
// Overlays (modais sobre frames) ficam de fora — exigiriam um conceito de
// camadas/contenção que o board ainda não tem. ---
interface DadosFrame extends Record<string, unknown> {
  tipoObjeto: 'frame'
  texto: string
}

interface DadosBotao extends Record<string, unknown> {
  tipoObjeto: 'botao'
  texto: string
}

interface DadosInputWireframe extends Record<string, unknown> {
  tipoObjeto: 'inputWireframe'
  texto: string
}

interface DadosAvatar extends Record<string, unknown> {
  tipoObjeto: 'avatar'
}

// --- Modo Tarefas (6.11): pilha (coluna) + tarefa (card, com toggle de
// concluída — a diferença real entre um card de tarefa e um sticky note
// qualquer). Sem mover cards entre pilhas automaticamente ao arrastar perto
// (exigiria detecção espacial de "soltar dentro de") nem votação em cards
// (é uma dinâmica de facilitação ao vivo, fica pra quando existir
// colaboração em tempo real — Fase 2). ---
interface DadosPilha extends Record<string, unknown> {
  tipoObjeto: 'pilha'
  texto: string
}

interface DadosTarefa extends Record<string, unknown> {
  tipoObjeto: 'tarefa'
  texto: string
  concluida: boolean
}

// Comentário fixado no board (6.9/colaboração) — decisão explícita: como
// hoje cada board é privado (só quem é dono daquela conta/vendedor enxerga,
// ver reuniaoWhereBase no backend), não existe "outra pessoa" pra @mencionar
// nem pra notificar. Vira uma autoanotação em thread (várias mensagens,
// sem autor — sempre é a mesma pessoa), fixada num ponto do canvas,
// marcável como resolvida. Menção/notificação ficam pra quando existir
// board de verdade compartilhado entre pessoas (Fase 2, item em aberto).
interface MensagemComentario { id: string; texto: string; criadoEm: string }
interface DadosComentario extends Record<string, unknown> {
  tipoObjeto: 'comentario'
  mensagens: MensagemComentario[]
  resolvido: boolean
}

type DadosObjeto =
  | DadosNoMapa | DadosForma | DadosSticky | DadosTexto | DadosIcone | DadosSecao | DadosTabela
  | DadosDesenho | DadosFrame | DadosBotao | DadosInputWireframe | DadosAvatar | DadosPilha | DadosTarefa
  | DadosComentario
type NoFlow = Node<DadosObjeto>

function objetoParaNode(o: BoardObjeto, corHerdada: string): NoFlow {
  // grupoId (agrupamento) mora dentro de `conteudo` (não é um campo
  // dedicado do BoardObjeto) pra não precisar mexer no schema/validação
  // do backend; travado/zIndex já eram campos de primeira classe.
  const grupoId = o.conteudo.grupoId as string | undefined
  const base = {
    id: o.id, position: { x: o.x, y: o.y },
    ...(o.travado ? { draggable: false } : {}),
    ...(typeof o.zIndex === 'number' ? { zIndex: o.zIndex } : {}),
  }
  if (o.tipo === 'forma') {
    return {
      ...base, type: 'forma',
      data: {
        tipoObjeto: 'forma', grupoId,
        forma: (o.conteudo.forma as TipoForma) ?? 'retangulo',
        texto: (o.conteudo.texto as string) ?? '',
        cor: (o.estilo?.cor as string) ?? corHerdada,
      },
    }
  }
  if (o.tipo === 'sticky') {
    return {
      ...base, type: 'sticky',
      data: { tipoObjeto: 'sticky', grupoId, texto: (o.conteudo.texto as string) ?? '', cor: (o.estilo?.cor as string) ?? PALETA_STICKY[0] },
    }
  }
  if (o.tipo === 'texto') {
    return { ...base, type: 'texto', data: { tipoObjeto: 'texto', grupoId, texto: (o.conteudo.texto as string) ?? '' } }
  }
  if (o.tipo === 'icone') {
    return {
      ...base, type: 'icone',
      data: { tipoObjeto: 'icone', grupoId, icone: (o.conteudo.icone as TipoIcone) ?? 'estrela', cor: (o.estilo?.cor as string) ?? corHerdada },
    }
  }
  if (o.tipo === 'secao') {
    return {
      ...base, type: 'secao', width: o.largura ?? 420, height: o.altura ?? 280,
      zIndex: typeof o.zIndex === 'number' ? o.zIndex : -1,
      data: { tipoObjeto: 'secao', grupoId, texto: (o.conteudo.texto as string) ?? '', cor: (o.estilo?.cor as string) ?? 'var(--pl-accent)' },
    }
  }
  if (o.tipo === 'tabela') {
    return {
      ...base, type: 'tabela',
      data: { tipoObjeto: 'tabela', grupoId, linhas: (o.conteudo.linhas as string[][]) ?? [['', '', ''], ['', '', '']] },
    }
  }
  if (o.tipo === 'desenho') {
    return {
      ...base, type: 'desenho',
      data: {
        tipoObjeto: 'desenho', grupoId,
        pontos: (o.conteudo.pontos as { x: number; y: number }[]) ?? [],
        cor: (o.estilo?.cor as string) ?? 'var(--pl-ink-1)',
        espessura: (o.estilo?.espessura as number) ?? 3,
        opacidade: (o.estilo?.opacidade as number) ?? 1,
      },
    }
  }
  if (o.tipo === 'frame') {
    return {
      ...base, type: 'frame', width: o.largura ?? 320, height: o.altura ?? 480,
      zIndex: typeof o.zIndex === 'number' ? o.zIndex : -1,
      data: { tipoObjeto: 'frame', grupoId, texto: (o.conteudo.texto as string) ?? '' },
    }
  }
  if (o.tipo === 'botao') {
    return { ...base, type: 'botao', data: { tipoObjeto: 'botao', grupoId, texto: (o.conteudo.texto as string) ?? '' } }
  }
  if (o.tipo === 'inputWireframe') {
    return { ...base, type: 'inputWireframe', data: { tipoObjeto: 'inputWireframe', grupoId, texto: (o.conteudo.texto as string) ?? '' } }
  }
  if (o.tipo === 'avatar') {
    return { ...base, type: 'avatar', data: { tipoObjeto: 'avatar', grupoId } }
  }
  if (o.tipo === 'pilha') {
    return {
      ...base, type: 'pilha', width: o.largura ?? 260, height: o.altura ?? 360,
      zIndex: typeof o.zIndex === 'number' ? o.zIndex : -1,
      data: { tipoObjeto: 'pilha', grupoId, texto: (o.conteudo.texto as string) ?? '' },
    }
  }
  if (o.tipo === 'tarefa') {
    return {
      ...base, type: 'tarefa',
      data: { tipoObjeto: 'tarefa', grupoId, texto: (o.conteudo.texto as string) ?? '', concluida: !!o.conteudo.concluida },
    }
  }
  if (o.tipo === 'comentario') {
    return {
      ...base, type: 'comentario',
      data: {
        tipoObjeto: 'comentario', grupoId,
        mensagens: (o.conteudo.mensagens as MensagemComentario[]) ?? [],
        resolvido: !!o.conteudo.resolvido,
      },
    }
  }
  return {
    ...base, type: 'noMapa',
    data: { tipoObjeto: 'noMapa', grupoId, texto: (o.conteudo.texto as string) ?? '', ehCentral: !!o.conteudo.ehCentral, cor: corHerdada },
  }
}

function nodeParaObjeto(n: NoFlow): BoardObjeto {
  const grupoId = (n.data as Record<string, unknown>).grupoId as string | undefined
  const comuns = {
    ...(n.draggable === false ? { travado: true } : {}),
    ...(typeof n.zIndex === 'number' ? { zIndex: n.zIndex } : {}),
  }
  const comGrupo = (conteudo: Record<string, unknown>) => (grupoId ? { ...conteudo, grupoId } : conteudo)

  if (n.data.tipoObjeto === 'forma') {
    return {
      id: n.id, tipo: 'forma', x: n.position.x, y: n.position.y, ...comuns,
      estilo: { cor: n.data.cor }, conteudo: comGrupo({ forma: n.data.forma, texto: n.data.texto }),
    }
  }
  if (n.data.tipoObjeto === 'sticky') {
    return {
      id: n.id, tipo: 'sticky', x: n.position.x, y: n.position.y, ...comuns,
      estilo: { cor: n.data.cor }, conteudo: comGrupo({ texto: n.data.texto }),
    }
  }
  if (n.data.tipoObjeto === 'texto') {
    return { id: n.id, tipo: 'texto', x: n.position.x, y: n.position.y, ...comuns, conteudo: comGrupo({ texto: n.data.texto }) }
  }
  if (n.data.tipoObjeto === 'icone') {
    return {
      id: n.id, tipo: 'icone', x: n.position.x, y: n.position.y, ...comuns,
      estilo: { cor: n.data.cor }, conteudo: comGrupo({ icone: n.data.icone }),
    }
  }
  if (n.data.tipoObjeto === 'secao') {
    return {
      id: n.id, tipo: 'secao', x: n.position.x, y: n.position.y, ...comuns,
      largura: n.width ?? 420, altura: n.height ?? 280,
      estilo: { cor: n.data.cor }, conteudo: comGrupo({ texto: n.data.texto }),
    }
  }
  if (n.data.tipoObjeto === 'tabela') {
    return { id: n.id, tipo: 'tabela', x: n.position.x, y: n.position.y, ...comuns, conteudo: comGrupo({ linhas: n.data.linhas }) }
  }
  if (n.data.tipoObjeto === 'desenho') {
    return {
      id: n.id, tipo: 'desenho', x: n.position.x, y: n.position.y, ...comuns,
      estilo: { cor: n.data.cor, espessura: n.data.espessura, opacidade: n.data.opacidade },
      conteudo: comGrupo({ pontos: n.data.pontos }),
    }
  }
  if (n.data.tipoObjeto === 'frame') {
    return {
      id: n.id, tipo: 'frame', x: n.position.x, y: n.position.y, ...comuns,
      largura: n.width ?? 320, altura: n.height ?? 480, conteudo: comGrupo({ texto: n.data.texto }),
    }
  }
  if (n.data.tipoObjeto === 'botao') {
    return { id: n.id, tipo: 'botao', x: n.position.x, y: n.position.y, ...comuns, conteudo: comGrupo({ texto: n.data.texto }) }
  }
  if (n.data.tipoObjeto === 'inputWireframe') {
    return { id: n.id, tipo: 'inputWireframe', x: n.position.x, y: n.position.y, ...comuns, conteudo: comGrupo({ texto: n.data.texto }) }
  }
  if (n.data.tipoObjeto === 'avatar') {
    return { id: n.id, tipo: 'avatar', x: n.position.x, y: n.position.y, ...comuns, conteudo: comGrupo({}) }
  }
  if (n.data.tipoObjeto === 'pilha') {
    return {
      id: n.id, tipo: 'pilha', x: n.position.x, y: n.position.y, ...comuns,
      largura: n.width ?? 260, altura: n.height ?? 360, conteudo: comGrupo({ texto: n.data.texto }),
    }
  }
  if (n.data.tipoObjeto === 'tarefa') {
    return {
      id: n.id, tipo: 'tarefa', x: n.position.x, y: n.position.y, ...comuns,
      conteudo: comGrupo({ texto: n.data.texto, concluida: n.data.concluida }),
    }
  }
  if (n.data.tipoObjeto === 'comentario') {
    return {
      id: n.id, tipo: 'comentario', x: n.position.x, y: n.position.y, ...comuns,
      conteudo: comGrupo({ mensagens: n.data.mensagens, resolvido: n.data.resolvido }),
    }
  }
  return {
    id: n.id, tipo: 'noMapa', x: n.position.x, y: n.position.y, ...comuns,
    conteudo: comGrupo({ texto: n.data.texto, ehCentral: n.data.ehCentral }),
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
  const edges: Edge[] = conectores.map(c => {
    const cor = (c.estilo?.cor as string) ?? corPorObjeto.get(c.destinoId) ?? 'var(--pl-ink-2)'
    const tracejado = !!c.estilo?.tracejado
    const seta = !!c.estilo?.seta
    return {
      id: c.id, source: c.origemId, target: c.destinoId, type: 'flutuante',
      style: { stroke: cor, strokeWidth: 2.5, ...(tracejado ? { strokeDasharray: '6 4' } : {}) },
      ...(seta ? { markerEnd: { type: MarkerType.ArrowClosed, color: cor } } : {}),
      ...(c.label ? { label: c.label } : {}),
    }
  })
  return { nodes, edges }
}

function flowParaBoard(nodes: NoFlow[], edges: Edge[]): { objetos: BoardObjeto[]; conectores: BoardConector[] } {
  return {
    objetos: nodes.map(nodeParaObjeto),
    conectores: edges.map(e => {
      const estiloEdge = (e.style ?? {}) as Record<string, unknown>
      const cor = typeof estiloEdge.stroke === 'string' ? estiloEdge.stroke : undefined
      const tracejado = !!estiloEdge.strokeDasharray
      const seta = !!e.markerEnd
      const estilo = cor || tracejado || seta ? { ...(cor ? { cor } : {}), ...(tracejado ? { tracejado } : {}), ...(seta ? { seta } : {}) } : undefined
      return {
        id: e.id, origemId: e.source, destinoId: e.target,
        ...(estilo ? { estilo } : {}), ...(e.label ? { label: e.label as string } : {}),
      }
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
  onMudarEstiloConector: (id: string, patch: Partial<{ cor: string; tracejado: boolean; seta: boolean }>) => void
  onMudarLabelConector: (id: string, label: string) => void
  onExcluirConector: (id: string) => void
  onMudarLinhasTabela: (id: string, linhas: string[][]) => void
  onAlternarTarefa: (id: string) => void
  onAdicionarMensagemComentario: (id: string, texto: string) => void
  onAlternarResolvidoComentario: (id: string) => void
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

function TabelaNode({ id, data }: NodeProps<NoFlow>) {
  const acoes = useContext(AcoesMapaContext)!
  const d = data as DadosTabela
  const [ordenacao, setOrdenacao] = useState<{ coluna: number; direcao: 'asc' | 'desc' } | null>(null)
  const numColunas = d.linhas[0]?.length ?? 1

  function mudarCelula(li: number, ci: number, valor: string) {
    const novasLinhas = d.linhas.map((linha, i) => (i === li ? linha.map((c, j) => (j === ci ? valor : c)) : linha))
    acoes.onMudarLinhasTabela(id, novasLinhas)
  }
  function adicionarLinha() {
    acoes.onMudarLinhasTabela(id, [...d.linhas, Array(numColunas).fill('')])
  }
  function removerLinha() {
    if (d.linhas.length <= 1) return
    acoes.onMudarLinhasTabela(id, d.linhas.slice(0, -1))
  }
  function adicionarColuna() {
    acoes.onMudarLinhasTabela(id, d.linhas.map(linha => [...linha, '']))
  }
  function removerColuna() {
    if (numColunas <= 1) return
    acoes.onMudarLinhasTabela(id, d.linhas.map(linha => linha.slice(0, -1)))
  }
  // Ordena pelo conteúdo da coluna clicada no cabeçalho — sem fórmulas,
  // só reordena as linhas de baixo (a de cabeçalho, índice 0, fica de fora).
  function ordenarPorColuna(ci: number) {
    const direcao: 'asc' | 'desc' = ordenacao?.coluna === ci && ordenacao.direcao === 'asc' ? 'desc' : 'asc'
    const [cabecalho, ...resto] = d.linhas
    resto.sort((a, b) => {
      const cmp = (a[ci] ?? '').localeCompare(b[ci] ?? '', 'pt-BR', { numeric: true })
      return direcao === 'asc' ? cmp : -cmp
    })
    setOrdenacao({ coluna: ci, direcao })
    acoes.onMudarLinhasTabela(id, [cabecalho, ...resto])
  }

  return (
    <div className="pl-tabela-no">
      <NodeToolbar position={Position.Top} offset={10} className="pl-mapa-toolbar nodrag nopan">
        <button type="button" className="pl-mapa-toolbar-btn" title="Adicionar linha" onClick={adicionarLinha}>L+</button>
        <button type="button" className="pl-mapa-toolbar-btn" title="Remover linha" onClick={removerLinha}>L−</button>
        <button type="button" className="pl-mapa-toolbar-btn" title="Adicionar coluna" onClick={adicionarColuna}>C+</button>
        <button type="button" className="pl-mapa-toolbar-btn" title="Remover coluna" onClick={removerColuna}>C−</button>
        <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir tabela" onClick={() => acoes.onExcluir(id)}>×</button>
      </NodeToolbar>
      <div className="pl-tabela-alca" title="Arraste pra mover">Tabela</div>
      <div className="pl-tabela-grade nodrag nopan">
        {d.linhas.map((linha, li) => (
          <div key={li} className="pl-tabela-linha" style={{ gridTemplateColumns: `repeat(${numColunas}, minmax(90px, 1fr))` }}>
            {linha.map((celula, ci) => (
              <div key={ci} className={`pl-tabela-celula ${li === 0 ? 'pl-tabela-cabecalho' : ''}`}>
                {li === 0 && (
                  <button type="button" className="pl-tabela-ordenar" title="Ordenar" onClick={() => ordenarPorColuna(ci)}>
                    {ordenacao?.coluna === ci ? (ordenacao.direcao === 'asc' ? '↑' : '↓') : '↕'}
                  </button>
                )}
                <input className="pl-tabela-input" value={celula} onChange={e => mudarCelula(li, ci, e.target.value)} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function DesenhoNode({ id, data }: NodeProps<NoFlow>) {
  const acoes = useContext(AcoesMapaContext)!
  const d = data as DadosDesenho
  const largura = Math.max(...d.pontos.map(p => p.x), d.espessura * 2, 1)
  const altura = Math.max(...d.pontos.map(p => p.y), d.espessura * 2, 1)
  const caminho = d.pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  return (
    <div className="pl-desenho-no" style={{ width: largura, height: altura }}>
      <NodeToolbar position={Position.Top} offset={10} className="pl-mapa-toolbar nodrag nopan">
        <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir" onClick={() => acoes.onExcluir(id)}>×</button>
      </NodeToolbar>
      <svg className="pl-desenho-svg" width={largura} height={altura}>
        <path d={caminho} stroke={d.cor} strokeWidth={d.espessura} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={d.opacidade} />
      </svg>
    </div>
  )
}

function FrameNode({ id, data, selected }: NodeProps<NoFlow>) {
  const acoes = useContext(AcoesMapaContext)!
  const d = data as DadosFrame
  const [valor, setValor] = useState(d.texto)
  const [editando, setEditando] = useState(false)
  useEffect(() => { setValor(d.texto) }, [d.texto])

  function entrarEdicao() { setEditando(true) }
  function sairEdicao() { setEditando(false) }

  return (
    <div className="pl-frame-no">
      <NodeResizer minWidth={200} minHeight={280} isVisible={!!selected} lineClassName="pl-secao-resize-linha" handleClassName="pl-secao-resize-alca" />
      <NodeToolbar position={Position.Top} offset={10} className="pl-mapa-toolbar nodrag nopan">
        <button type="button" className="pl-mapa-toolbar-btn" title="Renomear" onClick={entrarEdicao}>✎</button>
        <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir" onClick={() => acoes.onExcluir(id)}>×</button>
      </NodeToolbar>
      <div className="pl-frame-barra">
        {editando ? (
          <input
            className="nodrag nopan pl-frame-input"
            autoFocus
            value={valor}
            placeholder="Tela"
            onChange={e => { setValor(e.target.value); acoes.onMudarTexto(id, e.target.value) }}
            onBlur={sairEdicao}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
          />
        ) : (
          <div className="pl-frame-titulo" onDoubleClick={entrarEdicao}>{valor || 'Tela'}</div>
        )}
      </div>
      <div className="pl-frame-area" />
    </div>
  )
}

function BotaoNode({ id, data }: NodeProps<NoFlow>) {
  const acoes = useContext(AcoesMapaContext)!
  const d = data as DadosBotao
  const [valor, setValor] = useState(d.texto)
  const [editando, setEditando] = useState(d.texto === '')
  useEffect(() => { setValor(d.texto) }, [d.texto])

  function entrarEdicao() { setEditando(true) }
  function sairEdicao() { setEditando(false) }

  return (
    <div className="pl-botao-no">
      <NodeToolbar position={Position.Top} offset={10} className="pl-mapa-toolbar nodrag nopan">
        <button type="button" className="pl-mapa-toolbar-btn" title="Editar texto" onClick={entrarEdicao}>✎</button>
        <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir" onClick={() => acoes.onExcluir(id)}>×</button>
      </NodeToolbar>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      {editando ? (
        <input
          className="nodrag nopan pl-botao-input"
          autoFocus
          value={valor}
          placeholder="Botão"
          onChange={e => { setValor(e.target.value); acoes.onMudarTexto(id, e.target.value) }}
          onBlur={sairEdicao}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
        />
      ) : (
        <div className="pl-botao-texto" onDoubleClick={entrarEdicao}>{valor || 'Botão'}</div>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

function InputWireframeNode({ id, data }: NodeProps<NoFlow>) {
  const acoes = useContext(AcoesMapaContext)!
  const d = data as DadosInputWireframe
  const [valor, setValor] = useState(d.texto)
  const [editando, setEditando] = useState(d.texto === '')
  useEffect(() => { setValor(d.texto) }, [d.texto])

  function entrarEdicao() { setEditando(true) }
  function sairEdicao() { setEditando(false) }

  return (
    <div className="pl-input-wireframe-no">
      <NodeToolbar position={Position.Top} offset={10} className="pl-mapa-toolbar nodrag nopan">
        <button type="button" className="pl-mapa-toolbar-btn" title="Editar placeholder" onClick={entrarEdicao}>✎</button>
        <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir" onClick={() => acoes.onExcluir(id)}>×</button>
      </NodeToolbar>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      {editando ? (
        <input
          className="nodrag nopan pl-input-wireframe-input"
          autoFocus
          value={valor}
          placeholder="Campo de texto"
          onChange={e => { setValor(e.target.value); acoes.onMudarTexto(id, e.target.value) }}
          onBlur={sairEdicao}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
        />
      ) : (
        <div className="pl-input-wireframe-texto" onDoubleClick={entrarEdicao}>{valor || 'Campo de texto'}</div>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

function AvatarNode({ id }: NodeProps<NoFlow>) {
  const acoes = useContext(AcoesMapaContext)!
  return (
    <div className="pl-avatar-no">
      <NodeToolbar position={Position.Top} offset={10} className="pl-mapa-toolbar nodrag nopan">
        <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir" onClick={() => acoes.onExcluir(id)}>×</button>
      </NodeToolbar>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
      </svg>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

function PilhaNode({ id, data, selected }: NodeProps<NoFlow>) {
  const acoes = useContext(AcoesMapaContext)!
  const d = data as DadosPilha
  const [valor, setValor] = useState(d.texto)
  const [editando, setEditando] = useState(false)
  useEffect(() => { setValor(d.texto) }, [d.texto])

  function entrarEdicao() { setEditando(true) }
  function sairEdicao() { setEditando(false) }

  return (
    <div className="pl-pilha-no">
      <NodeResizer minWidth={200} minHeight={200} isVisible={!!selected} lineClassName="pl-secao-resize-linha" handleClassName="pl-secao-resize-alca" />
      <NodeToolbar position={Position.Top} offset={10} className="pl-mapa-toolbar nodrag nopan">
        <button type="button" className="pl-mapa-toolbar-btn" title="Renomear" onClick={entrarEdicao}>✎</button>
        <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir" onClick={() => acoes.onExcluir(id)}>×</button>
      </NodeToolbar>
      {editando ? (
        <input
          className="nodrag nopan pl-pilha-input"
          autoFocus
          value={valor}
          placeholder="A fazer"
          onChange={e => { setValor(e.target.value); acoes.onMudarTexto(id, e.target.value) }}
          onBlur={sairEdicao}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
        />
      ) : (
        <div className="pl-pilha-titulo" onDoubleClick={entrarEdicao}>{valor || 'A fazer'}</div>
      )}
    </div>
  )
}

function TarefaNode({ id, data }: NodeProps<NoFlow>) {
  const acoes = useContext(AcoesMapaContext)!
  const d = data as DadosTarefa
  const [valor, setValor] = useState(d.texto)
  const [editando, setEditando] = useState(d.texto === '')
  useEffect(() => { setValor(d.texto) }, [d.texto])

  function entrarEdicao() { setEditando(true) }
  function sairEdicao() { setEditando(false) }

  return (
    <div className={`pl-tarefa-no ${d.concluida ? 'pl-tarefa-concluida' : ''}`}>
      <NodeToolbar position={Position.Top} offset={10} className="pl-mapa-toolbar nodrag nopan">
        <button type="button" className="pl-mapa-toolbar-btn" title="Editar texto" onClick={entrarEdicao}>✎</button>
        <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir" onClick={() => acoes.onExcluir(id)}>×</button>
      </NodeToolbar>
      <label className="pl-tarefa-check nodrag nopan">
        <input type="checkbox" checked={d.concluida} onChange={() => acoes.onAlternarTarefa(id)} />
      </label>
      {editando ? (
        <textarea
          className="nodrag nopan pl-tarefa-textarea"
          autoFocus
          value={valor}
          placeholder="Tarefa..."
          onChange={e => { setValor(e.target.value); acoes.onMudarTexto(id, e.target.value) }}
          onBlur={sairEdicao}
          onKeyDown={e => { if (e.key === 'Escape') e.currentTarget.blur() }}
        />
      ) : (
        <div className="pl-tarefa-texto" onDoubleClick={entrarEdicao}>{valor || 'Tarefa...'}</div>
      )}
    </div>
  )
}

function ComentarioNode({ id, data, selected }: NodeProps<NoFlow>) {
  const acoes = useContext(AcoesMapaContext)!
  const d = data as DadosComentario
  const [rascunho, setRascunho] = useState('')

  function enviar() {
    const texto = rascunho.trim()
    if (!texto) return
    acoes.onAdicionarMensagemComentario(id, texto)
    setRascunho('')
  }

  return (
    <div className={`pl-comentario-pino ${d.resolvido ? 'pl-comentario-resolvido' : ''}`}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <IconeComentario />
      {d.mensagens.length > 0 && <span className="pl-comentario-contador">{d.mensagens.length}</span>}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      {selected && (
        <NodeToolbar position={Position.Right} offset={12} className="pl-comentario-thread nodrag nopan" isVisible>
          <div className="pl-comentario-thread-topo">
            <button
              type="button" className={`pl-mapa-toolbar-btn ${d.resolvido ? 'ativo' : ''}`}
              title={d.resolvido ? 'Reabrir' : 'Marcar como resolvido'} onClick={() => acoes.onAlternarResolvidoComentario(id)}
            >
              <IconeResolver />
            </button>
            <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir comentário" onClick={() => acoes.onExcluir(id)}>×</button>
          </div>
          <div className="pl-comentario-thread-lista">
            {d.mensagens.length === 0 && <div className="pl-comentario-vazio">Sem mensagens ainda.</div>}
            {d.mensagens.map(m => (
              <div key={m.id} className="pl-comentario-mensagem">{m.texto}</div>
            ))}
          </div>
          <div className="pl-comentario-thread-input">
            <input
              value={rascunho}
              placeholder="Escrever uma nota..."
              onChange={e => setRascunho(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') enviar() }}
            />
            <button type="button" className="pl-mapa-toolbar-btn" title="Enviar" onClick={enviar}>↵</button>
          </div>
        </NodeToolbar>
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

// Cores disponíveis no seletor rápido do conector (paleta separada e mais
// enxuta que PALETA_RAMOS/PALETA_STICKY — só as cores mais úteis pra linha).
const PALETA_CONECTOR = ['#8d9de0', '#e0687a', '#57c785', '#e0a83e', '#a679e0', '#8b93a6']

function EdgeFlutuante({ id, source, target, style, markerEnd, selected, label }: EdgeProps) {
  const acoes = useContext(AcoesMapaContext)!
  const noOrigem = useInternalNode(source)
  const noAlvo = useInternalNode(target)
  if (!noOrigem || !noAlvo) return null

  const pontoOrigem = interseccaoComNo(noOrigem, noAlvo)
  const pontoAlvo = interseccaoComNo(noAlvo, noOrigem)
  const [caminho, labelX, labelY] = getBezierPath({
    sourceX: pontoOrigem.x, sourceY: pontoOrigem.y, targetX: pontoAlvo.x, targetY: pontoAlvo.y,
  })

  const tracejadoAtivo = !!(style as Record<string, unknown> | undefined)?.strokeDasharray
  const setaAtiva = !!markerEnd

  return (
    <>
      <BaseEdge id={id} path={caminho} style={style} markerEnd={markerEnd} />
      {(!!label || selected) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pl-conector-overlay"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {!!label && <div className="pl-conector-label">{label as string}</div>}
            {selected && (
              <div className="pl-conector-toolbar">
                <input
                  className="pl-conector-label-input"
                  value={(label as string) ?? ''}
                  placeholder="Label"
                  onChange={e => acoes.onMudarLabelConector(id, e.target.value)}
                />
                {PALETA_CONECTOR.map(cor => (
                  <button
                    key={cor} type="button" className="pl-conector-cor-swatch" style={{ background: cor }}
                    title="Cor" onClick={() => acoes.onMudarEstiloConector(id, { cor })}
                  />
                ))}
                <button
                  type="button" className={`pl-mapa-toolbar-btn ${tracejadoAtivo ? 'ativo' : ''}`} title="Tracejado"
                  onClick={() => acoes.onMudarEstiloConector(id, { tracejado: !tracejadoAtivo })}
                >┄</button>
                <button
                  type="button" className={`pl-mapa-toolbar-btn ${setaAtiva ? 'ativo' : ''}`} title="Ponta de seta"
                  onClick={() => acoes.onMudarEstiloConector(id, { seta: !setaAtiva })}
                >→</button>
                <button type="button" className="pl-mapa-toolbar-btn pl-mapa-toolbar-btn-danger" title="Excluir conector" onClick={() => acoes.onExcluirConector(id)}>×</button>
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const nodeTypes = {
  noMapa: NoMapaNode, forma: FormaNode, sticky: StickyNode, texto: TextoNode, icone: IconeNode, secao: SecaoNode, tabela: TabelaNode,
  desenho: DesenhoNode, frame: FrameNode, botao: BotaoNode, inputWireframe: InputWireframeNode, avatar: AvatarNode, pilha: PilhaNode, tarefa: TarefaNode,
  comentario: ComentarioNode,
} as unknown as NodeTypes
const edgeTypes = { flutuante: EdgeFlutuante } as unknown as EdgeTypes

function Canvas({ dadosIniciais, onChange, tema }: {
  dadosIniciais: { objetos: BoardObjeto[]; conectores: BoardConector[] }
  onChange: (dados: { objetos: BoardObjeto[]; conectores: BoardConector[] }) => void
  tema?: TemaBoard | null
}) {
  const temaAtual = TEMAS_BOARD.find(t => t.id === tema) ?? TEMAS_BOARD[0]
  const { fitView, screenToFlowPosition } = useReactFlow()
  const [grafo, setGrafo] = useState<{ nodes: NoFlow[]; edges: Edge[] }>(
    () => boardParaFlow(dadosIniciais.objetos, dadosIniciais.conectores),
  )
  // Modo "mão" (pan): desliga o arraste de nó, então segurar e arrastar em
  // qualquer ponto do canvas move a tela em vez de mover o nó — réplica do
  // par cursor/mão da barra da referência.
  const [modoMao, setModoMao] = useState(false)
  const [formasAbertas, setFormasAbertas] = useState(false)
  const [iconesAbertos, setIconesAbertos] = useState(false)
  // Modo (Diagrama/Wireframe/Tarefas) é só um filtro de quais botões de
  // criação aparecem na toolbar — nunca esconde objetos já existentes no
  // board, que continuam visíveis e editáveis em qualquer modo (6.10/6.11).
  const [modo, setModo] = useState<'diagrama' | 'wireframe' | 'tarefas'>('diagrama')
  // Desenho livre (6.9): null = ferramenta de seleção normal; 'traco'/
  // 'marcaTexto' = próximo drag no canvas captura um traço em vez de
  // mover/selecionar nós. `tracoAoVivo` guarda os pontos em coordenadas de
  // TELA (relativas ao container) só pra desenhar a prévia — a conversão
  // pra coordenadas do board (screenToFlowPosition) só acontece uma vez,
  // ao soltar o mouse, quando o traço vira um objeto de verdade.
  const [modoDesenho, setModoDesenho] = useState<null | 'traco' | 'marcaTexto'>(null)
  const [tracoAoVivo, setTracoAoVivo] = useState<{ x: number; y: number }[] | null>(null)
  const desenhandoRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // Modo apresentação (6.14 do mapeamento): reaproveita os Frames (telas)
  // do modo Wireframe como slides — dá pra fazer diagrama/wireframe/tarefas
  // num board só e apresentar as partes que fazem sentido como "tela",
  // sem precisar de um conceito de slide separado dos objetos do board.
  // Ordem dos slides é da esquerda pra direita (posição x) — simples e
  // previsível, sem precisar de um campo de "ordem" dedicado no objeto.
  const [modoApresentacao, setModoApresentacao] = useState(false)
  const [slideAtual, setSlideAtual] = useState(0)
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
      // Objeto com grupoId: replica o mesmo delta de posição pros outros
      // membros do grupo — arrastar qualquer um move o grupo inteiro junto,
      // não só ele. Sem isso "Agrupar" seria só um rótulo sem efeito real.
      const porId = new Map(atual.nodes.map(n => [n.id, n]))
      const extras: NodeChange<NoFlow>[] = []
      changes.forEach(c => {
        if (c.type !== 'position' || !c.position) return
        const no = porId.get(c.id)
        const grupoId = (no?.data as Record<string, unknown> | undefined)?.grupoId as string | undefined
        if (!grupoId || !no) return
        const dx = c.position.x - no.position.x
        const dy = c.position.y - no.position.y
        if (dx === 0 && dy === 0) return
        atual.nodes.forEach(n => {
          if (n.id === c.id || (n.data as Record<string, unknown>).grupoId !== grupoId) return
          extras.push({ id: n.id, type: 'position', position: { x: n.position.x + dx, y: n.position.y + dy }, dragging: c.dragging })
        })
      })
      const novo = { ...atual, nodes: applyNodeChanges([...changes, ...extras], atual.nodes) }
      grafoRef.current = novo
      return novo
    })
  }, [])

  // Sem isso, clicar num conector pra selecioná-lo (e abrir a barrinha de
  // estilo) não teria efeito nenhum — o React Flow só atualiza `selected`
  // via onEdgesChange, igual onNodesChange faz pra nó.
  const onEdgesChangeFlow = useCallback((changes: EdgeChange<Edge>[]) => {
    setGrafo(atual => {
      const novo = { ...atual, edges: applyEdgeChanges(changes, atual.edges) }
      grafoRef.current = novo
      return novo
    })
  }, [])

  function finalizarArraste() {
    if (antesDoArrasteRef.current) registrarHistorico(antesDoArrasteRef.current, true)
    antesDoArrasteRef.current = null
    onChange(flowParaBoard(grafoRef.current.nodes, grafoRef.current.edges))
  }

  // Nunca chama `onChange` (que sobe até o setState da PaginaMapaMental) de
  // dentro do updater funcional do setGrafo — o React trata isso como
  // "setState de um componente durante o render de outro" e avisa/rejeita.
  // Por isso lê o estado atual via ref e computa o próximo valor antes,
  // fora do updater, e só então chama setGrafo (valor pronto) + onChange
  // como duas instruções comuns do handler.
  //
  // Desfazer/refazer (6.14/atalhos): pilha de estados ANTERIORES, empilhada
  // antes de cada commit. Mudanças em rajada (digitar, segurar seta) dentro
  // de uma janela de coalescência viram um único passo de desfazer — senão
  // cada tecla digitada seria seu próprio Ctrl+Z, inutilizável na prática.
  const historicoRef = useRef<{ nodes: NoFlow[]; edges: Edge[] }[]>([])
  const futuroRef = useRef<{ nodes: NoFlow[]; edges: Edge[] }[]>([])
  const ultimoPushHistoricoRef = useRef(0)
  const LIMITE_HISTORICO = 100
  const JANELA_COALESCENCIA_MS = 800

  function registrarHistorico(estadoAnterior: { nodes: NoFlow[]; edges: Edge[] }, forcar = false) {
    const agora = Date.now()
    if (!forcar && agora - ultimoPushHistoricoRef.current < JANELA_COALESCENCIA_MS) return
    historicoRef.current.push(estadoAnterior)
    if (historicoRef.current.length > LIMITE_HISTORICO) historicoRef.current.shift()
    futuroRef.current = []
    ultimoPushHistoricoRef.current = agora
  }

  function commit(novoGrafo: { nodes: NoFlow[]; edges: Edge[] }) {
    registrarHistorico(grafoRef.current)
    grafoRef.current = novoGrafo
    setGrafo(novoGrafo)
    onChange(flowParaBoard(novoGrafo.nodes, novoGrafo.edges))
  }

  function desfazer() {
    const anterior = historicoRef.current.pop()
    if (!anterior) return
    futuroRef.current.push(grafoRef.current)
    grafoRef.current = anterior
    setGrafo(anterior)
    onChange(flowParaBoard(anterior.nodes, anterior.edges))
  }

  function refazer() {
    const proximo = futuroRef.current.pop()
    if (!proximo) return
    historicoRef.current.push(grafoRef.current)
    grafoRef.current = proximo
    setGrafo(proximo)
    onChange(flowParaBoard(proximo.nodes, proximo.edges))
  }

  // Snapshot tirado no INÍCIO do arraste (não dá pra usar grafoRef no fim,
  // já chega com a posição final aplicada) — arrastar um nó também precisa
  // virar um passo de desfazer, mesmo não passando por commit().
  const antesDoArrasteRef = useRef<{ nodes: NoFlow[]; edges: Edge[] } | null>(null)
  function iniciarArraste() {
    antesDoArrasteRef.current = grafoRef.current
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

  const onAdicionarTabela = useCallback(() => {
    const atual = grafoRef.current
    const base = atual.nodes.find(n => n.id === noSelecionadoId) ?? atual.nodes[0]
    const novoId = gerarIdNo()
    const novoNo: NoFlow = {
      id: novoId, type: 'tabela',
      position: posicaoEmCascata(base, atual.nodes.length),
      data: { tipoObjeto: 'tabela', linhas: [['Coluna 1', 'Coluna 2', 'Coluna 3'], ['', '', ''], ['', '', '']] },
    }
    commit({ nodes: [...atual.nodes, novoNo], edges: atual.edges })
  }, [noSelecionadoId])

  const onMudarLinhasTabela = useCallback((id: string, linhas: string[][]) => {
    const atual = grafoRef.current
    const nodes = atual.nodes.map(n => (n.id === id && n.data.tipoObjeto === 'tabela' ? { ...n, data: { ...n.data, linhas } } : n))
    commit({ ...atual, nodes })
  }, [])

  const onAdicionarFrame = useCallback(() => {
    const atual = grafoRef.current
    const base = atual.nodes.find(n => n.id === noSelecionadoId) ?? atual.nodes[0]
    const passo = atual.nodes.length % 6
    const novoId = gerarIdNo()
    const novoNo: NoFlow = {
      id: novoId, type: 'frame',
      position: { x: (base?.position.x ?? 0) - 460 - passo * 18, y: (base?.position.y ?? 0) - 140 + passo * 20 },
      width: 320, height: 480, zIndex: -1,
      data: { tipoObjeto: 'frame', texto: 'Tela' },
    }
    commit({ nodes: [...atual.nodes, novoNo], edges: atual.edges })
  }, [noSelecionadoId])

  const onAdicionarBotao = useCallback(() => {
    const atual = grafoRef.current
    const base = atual.nodes.find(n => n.id === noSelecionadoId) ?? atual.nodes[0]
    const novoId = gerarIdNo()
    const novoNo: NoFlow = {
      id: novoId, type: 'botao',
      position: posicaoEmCascata(base, atual.nodes.length),
      data: { tipoObjeto: 'botao', texto: 'Botão' },
    }
    commit({ nodes: [...atual.nodes, novoNo], edges: atual.edges })
  }, [noSelecionadoId])

  const onAdicionarInputWireframe = useCallback(() => {
    const atual = grafoRef.current
    const base = atual.nodes.find(n => n.id === noSelecionadoId) ?? atual.nodes[0]
    const novoId = gerarIdNo()
    const novoNo: NoFlow = {
      id: novoId, type: 'inputWireframe',
      position: posicaoEmCascata(base, atual.nodes.length),
      data: { tipoObjeto: 'inputWireframe', texto: '' },
    }
    commit({ nodes: [...atual.nodes, novoNo], edges: atual.edges })
  }, [noSelecionadoId])

  const onAdicionarAvatar = useCallback(() => {
    const atual = grafoRef.current
    const base = atual.nodes.find(n => n.id === noSelecionadoId) ?? atual.nodes[0]
    const novoId = gerarIdNo()
    const novoNo: NoFlow = {
      id: novoId, type: 'avatar',
      position: posicaoEmCascata(base, atual.nodes.length),
      data: { tipoObjeto: 'avatar' },
    }
    commit({ nodes: [...atual.nodes, novoNo], edges: atual.edges })
  }, [noSelecionadoId])

  const onAdicionarPilha = useCallback(() => {
    const atual = grafoRef.current
    const base = atual.nodes.find(n => n.id === noSelecionadoId) ?? atual.nodes[0]
    const passo = atual.nodes.length % 6
    const novoId = gerarIdNo()
    const novoNo: NoFlow = {
      id: novoId, type: 'pilha',
      position: { x: (base?.position.x ?? 0) - 460 - passo * 18, y: (base?.position.y ?? 0) - 140 + passo * 20 },
      width: 260, height: 360, zIndex: -1,
      data: { tipoObjeto: 'pilha', texto: 'A fazer' },
    }
    commit({ nodes: [...atual.nodes, novoNo], edges: atual.edges })
  }, [noSelecionadoId])

  const onAdicionarTarefa = useCallback(() => {
    const atual = grafoRef.current
    const base = atual.nodes.find(n => n.id === noSelecionadoId) ?? atual.nodes[0]
    const novoId = gerarIdNo()
    const novoNo: NoFlow = {
      id: novoId, type: 'tarefa',
      position: posicaoEmCascata(base, atual.nodes.length),
      data: { tipoObjeto: 'tarefa', texto: '', concluida: false },
    }
    commit({ nodes: [...atual.nodes, novoNo], edges: atual.edges })
  }, [noSelecionadoId])

  const onAlternarTarefa = useCallback((id: string) => {
    const atual = grafoRef.current
    const nodes = atual.nodes.map(n => (n.id === id && n.data.tipoObjeto === 'tarefa' ? { ...n, data: { ...n.data, concluida: !n.data.concluida } } : n))
    commit({ ...atual, nodes })
  }, [])

  const onAdicionarComentario = useCallback(() => {
    const atual = grafoRef.current
    const base = atual.nodes.find(n => n.id === noSelecionadoId) ?? atual.nodes[0]
    const novoId = gerarIdNo()
    const novoNo: NoFlow = {
      id: novoId, type: 'comentario',
      position: posicaoEmCascata(base, atual.nodes.length),
      data: { tipoObjeto: 'comentario', mensagens: [], resolvido: false },
    }
    commit({ nodes: [...atual.nodes, novoNo], edges: atual.edges })
  }, [noSelecionadoId])

  const onAdicionarMensagemComentario = useCallback((id: string, texto: string) => {
    const atual = grafoRef.current
    const nodes = atual.nodes.map(n => {
      if (n.id !== id || n.data.tipoObjeto !== 'comentario') return n
      const mensagem: MensagemComentario = { id: gerarIdNo(), texto, criadoEm: new Date().toISOString() }
      return { ...n, data: { ...n.data, mensagens: [...n.data.mensagens, mensagem] } }
    })
    commit({ ...atual, nodes })
  }, [])

  const onAlternarResolvidoComentario = useCallback((id: string) => {
    const atual = grafoRef.current
    const nodes = atual.nodes.map(n => (n.id === id && n.data.tipoObjeto === 'comentario' ? { ...n, data: { ...n.data, resolvido: !n.data.resolvido } } : n))
    commit({ ...atual, nodes })
  }, [])

  // Captura de desenho livre: o overlay abaixo só recebe eventos de mouse
  // quando `modoDesenho` está ativo (senão pointer-events: none, deixando o
  // React Flow tratar pan/drag normalmente). Pontos ficam em coordenadas de
  // tela durante o gesto (prévia simples, sem se importar com pan/zoom);
  // só na hora de soltar o mouse é que viram coordenadas do board.
  function pontoRelativo(e: React.MouseEvent): { x: number; y: number } {
    const rect = containerRef.current?.getBoundingClientRect()
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }
  }
  function iniciarDesenho(e: React.MouseEvent) {
    if (!modoDesenho) return
    desenhandoRef.current = true
    setTracoAoVivo([pontoRelativo(e)])
  }
  function moverDesenho(e: React.MouseEvent) {
    if (!desenhandoRef.current) return
    setTracoAoVivo(atual => [...(atual ?? []), pontoRelativo(e)])
  }
  function finalizarDesenho() {
    if (!desenhandoRef.current) return
    desenhandoRef.current = false
    if (tracoAoVivo && tracoAoVivo.length > 1 && modoDesenho) {
      const rect = containerRef.current?.getBoundingClientRect()
      const pontosFlow = tracoAoVivo.map(p => screenToFlowPosition({ x: p.x + (rect?.left ?? 0), y: p.y + (rect?.top ?? 0) }))
      const espessura = modoDesenho === 'marcaTexto' ? 14 : 3
      const cor = modoDesenho === 'marcaTexto' ? '#f5d76e' : 'var(--pl-ink-1)'
      const opacidade = modoDesenho === 'marcaTexto' ? 0.45 : 1
      const minX = Math.min(...pontosFlow.map(p => p.x)) - espessura
      const minY = Math.min(...pontosFlow.map(p => p.y)) - espessura
      const pontos = pontosFlow.map(p => ({ x: p.x - minX, y: p.y - minY }))
      const novoId = gerarIdNo()
      const novoNo: NoFlow = {
        id: novoId, type: 'desenho',
        position: { x: minX, y: minY },
        data: { tipoObjeto: 'desenho', pontos, cor, espessura, opacidade },
      }
      const atual = grafoRef.current
      commit({ nodes: [...atual.nodes, novoNo], edges: atual.edges })
    }
    setTracoAoVivo(null)
  }

  // Conectar dois objetos livremente arrastando de um Handle a outro (6.3
  // do mapeamento) — cor neutra padrão, sem tracejado/seta; o usuário ajusta
  // depois selecionando o conector (barrinha de estilo do EdgeFlutuante).
  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return
    const atual = grafoRef.current
    const novaAresta: Edge = { id: `c${gerarIdNo()}`, source: params.source, target: params.target, type: 'flutuante', style: { stroke: 'var(--pl-ink-2)', strokeWidth: 2.5 } }
    commit({ ...atual, edges: [...atual.edges, novaAresta] })
  }, [])

  const onMudarEstiloConector = useCallback((id: string, patch: Partial<{ cor: string; tracejado: boolean; seta: boolean }>) => {
    const atual = grafoRef.current
    const edges = atual.edges.map(e => {
      if (e.id !== id) return e
      const estiloAtual = (e.style ?? {}) as Record<string, unknown>
      const cor = patch.cor ?? (typeof estiloAtual.stroke === 'string' ? estiloAtual.stroke : 'var(--pl-ink-2)')
      const tracejado = patch.tracejado ?? !!estiloAtual.strokeDasharray
      const seta = patch.seta ?? !!e.markerEnd
      return {
        ...e,
        style: { stroke: cor, strokeWidth: 2.5, ...(tracejado ? { strokeDasharray: '6 4' } : {}) },
        markerEnd: seta ? { type: MarkerType.ArrowClosed, color: cor } : undefined,
      }
    })
    commit({ ...atual, edges })
  }, [])

  const onMudarLabelConector = useCallback((id: string, label: string) => {
    const atual = grafoRef.current
    const edges = atual.edges.map(e => (e.id === id ? { ...e, label } : e))
    commit({ ...atual, edges })
  }, [])

  const onExcluirConector = useCallback((id: string) => {
    const atual = grafoRef.current
    commit({ ...atual, edges: atual.edges.filter(e => e.id !== id) })
  }, [])

  // Largura/altura reais medidas pelo React Flow depois do primeiro render;
  // 150x60 é só o fallback antes disso (mesmo padrão do interseccaoComNo).
  function medidas(n: NoFlow) {
    return { w: n.measured?.width ?? 150, h: n.measured?.height ?? 60 }
  }

  const onAlinhar = useCallback((modo: 'esquerda' | 'centroH' | 'direita' | 'topo' | 'meio' | 'base') => {
    const atual = grafoRef.current
    const selecionados = atual.nodes.filter(n => n.selected)
    if (selecionados.length < 2) return
    const caixas = selecionados.map(n => ({ n, ...medidas(n) }))
    let alvo: number
    if (modo === 'esquerda') alvo = Math.min(...caixas.map(c => c.n.position.x))
    else if (modo === 'direita') alvo = Math.max(...caixas.map(c => c.n.position.x + c.w))
    else if (modo === 'centroH') alvo = (Math.min(...caixas.map(c => c.n.position.x)) + Math.max(...caixas.map(c => c.n.position.x + c.w))) / 2
    else if (modo === 'topo') alvo = Math.min(...caixas.map(c => c.n.position.y))
    else if (modo === 'base') alvo = Math.max(...caixas.map(c => c.n.position.y + c.h))
    else alvo = (Math.min(...caixas.map(c => c.n.position.y)) + Math.max(...caixas.map(c => c.n.position.y + c.h))) / 2

    const idsSel = new Set(selecionados.map(n => n.id))
    const nodes = atual.nodes.map(n => {
      if (!idsSel.has(n.id)) return n
      const { w, h } = medidas(n)
      if (modo === 'esquerda') return { ...n, position: { ...n.position, x: alvo } }
      if (modo === 'direita') return { ...n, position: { ...n.position, x: alvo - w } }
      if (modo === 'centroH') return { ...n, position: { ...n.position, x: alvo - w / 2 } }
      if (modo === 'topo') return { ...n, position: { ...n.position, y: alvo } }
      if (modo === 'base') return { ...n, position: { ...n.position, y: alvo - h } }
      return { ...n, position: { ...n.position, y: alvo - h / 2 } }
    })
    commit({ ...atual, nodes })
  }, [])

  const onDistribuir = useCallback((eixo: 'horizontal' | 'vertical') => {
    const atual = grafoRef.current
    const selecionados = atual.nodes.filter(n => n.selected)
    if (selecionados.length < 3) return
    const comMedidas = selecionados.map(n => ({ n, ...medidas(n) }))
    const eixoX = eixo === 'horizontal'
    comMedidas.sort((a, b) => (eixoX ? a.n.position.x - b.n.position.x : a.n.position.y - b.n.position.y))
    const primeiro = comMedidas[0]
    const ultimo = comMedidas[comMedidas.length - 1]
    const fimPrimeiro = eixoX ? primeiro.n.position.x + primeiro.w : primeiro.n.position.y + primeiro.h
    const inicioUltimo = eixoX ? ultimo.n.position.x : ultimo.n.position.y
    const somaMeio = comMedidas.slice(1, -1).reduce((s, c) => s + (eixoX ? c.w : c.h), 0)
    const gap = (inicioUltimo - fimPrimeiro - somaMeio) / (comMedidas.length - 1)
    let cursor = fimPrimeiro + gap
    const novasPos = new Map<string, number>()
    comMedidas.slice(1, -1).forEach(c => { novasPos.set(c.n.id, cursor); cursor += (eixoX ? c.w : c.h) + gap })
    const nodes = atual.nodes.map(n => {
      if (!novasPos.has(n.id)) return n
      const valor = novasPos.get(n.id)!
      return { ...n, position: eixoX ? { ...n.position, x: valor } : { ...n.position, y: valor } }
    })
    commit({ ...atual, nodes })
  }, [])

  const onAgrupar = useCallback(() => {
    const atual = grafoRef.current
    const selecionados = atual.nodes.filter(n => n.selected)
    if (selecionados.length < 2) return
    const grupoId = gerarIdNo()
    const idsSel = new Set(selecionados.map(n => n.id))
    const nodes = atual.nodes.map(n => (idsSel.has(n.id) ? { ...n, data: { ...n.data, grupoId } } : n))
    commit({ ...atual, nodes })
  }, [])

  const onDesagrupar = useCallback(() => {
    const atual = grafoRef.current
    const selecionados = atual.nodes.filter(n => n.selected)
    const idsSel = new Set(selecionados.map(n => n.id))
    const nodes = atual.nodes.map(n => {
      if (!idsSel.has(n.id)) return n
      const { grupoId: _grupoId, ...resto } = n.data as Record<string, unknown>
      return { ...n, data: resto as DadosObjeto }
    })
    commit({ ...atual, nodes })
  }, [])

  const onAlternarTravado = useCallback(() => {
    const atual = grafoRef.current
    const selecionados = atual.nodes.filter(n => n.selected)
    if (selecionados.length === 0) return
    // Se algum dos selecionados ainda está destravado, trava todos; só
    // destrava todos quando a seleção inteira já estava travada — evita um
    // clique só destravar metade da seleção sem o usuário perceber.
    const travarTudo = selecionados.some(n => n.draggable !== false)
    const idsSel = new Set(selecionados.map(n => n.id))
    const nodes = atual.nodes.map(n => (idsSel.has(n.id) ? { ...n, draggable: !travarTudo } : n))
    commit({ ...atual, nodes })
  }, [])

  const onCamada = useCallback((direcao: 'frente' | 'tras') => {
    const atual = grafoRef.current
    const selecionados = atual.nodes.filter(n => n.selected)
    if (selecionados.length === 0) return
    const zIndices = atual.nodes.map(n => n.zIndex ?? 0)
    const alvo = direcao === 'frente' ? Math.max(...zIndices, 0) + 1 : Math.min(...zIndices, 0) - 1
    const idsSel = new Set(selecionados.map(n => n.id))
    const nodes = atual.nodes.map(n => (idsSel.has(n.id) ? { ...n, zIndex: alvo } : n))
    commit({ ...atual, nodes })
  }, [])

  // --- Atalhos de teclado (6.15 do mapeamento) ---
  const onDuplicarSelecionados = useCallback(() => {
    const atual = grafoRef.current
    const selecionados = atual.nodes.filter(n => n.selected)
    if (selecionados.length === 0) return
    const idMap = new Map<string, string>()
    const duplicados = selecionados.map(n => {
      const novoId = gerarIdNo()
      idMap.set(n.id, novoId)
      return { ...n, id: novoId, position: { x: n.position.x + 24, y: n.position.y + 24 }, selected: true, data: { ...n.data } }
    })
    const originaisDeselecionados = atual.nodes.map(n => (n.selected ? { ...n, selected: false } : n))
    // Só duplica o conector se as duas pontas também foram duplicadas —
    // conector com uma ponta fora da seleção continua ligado ao original.
    const edgesDuplicadas = atual.edges
      .filter(e => idMap.has(e.source) && idMap.has(e.target))
      .map(e => ({ ...e, id: `c${gerarIdNo()}`, source: idMap.get(e.source)!, target: idMap.get(e.target)! }))
    commit({ nodes: [...originaisDeselecionados, ...duplicados], edges: [...atual.edges, ...edgesDuplicadas] })
  }, [])

  const onExcluirSelecionados = useCallback(() => {
    const atual = grafoRef.current
    // Nunca via Delete o nó central — só pelo botão dedicado da toolbar
    // (que já trava isso), pra uma seleção-múltipla acidental não apagar
    // a raiz do mapa mental.
    const selecionados = atual.nodes.filter(n => n.selected && n.id !== centralId)
    if (selecionados.length === 0) return
    const idsRemover = new Set<string>()
    selecionados.forEach(n => idsDaSubarvore(atual.edges, n.id).forEach(id => idsRemover.add(id)))
    const nodes = atual.nodes.filter(n => !idsRemover.has(n.id))
    const edges = atual.edges.filter(e => !idsRemover.has(e.source) && !idsRemover.has(e.target))
    commit({ nodes, edges })
  }, [centralId])

  const onNudgeSelecionados = useCallback((dx: number, dy: number) => {
    const atual = grafoRef.current
    const selecionados = atual.nodes.filter(n => n.selected)
    if (selecionados.length === 0) return
    const idsSel = new Set(selecionados.map(n => n.id))
    const nodes = atual.nodes.map(n => (idsSel.has(n.id) ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n))
    commit({ ...atual, nodes })
  }, [])

  const onSelecionarTudo = useCallback(() => {
    setGrafo(atual => {
      const novo = { ...atual, nodes: atual.nodes.map(n => ({ ...n, selected: true })) }
      grafoRef.current = novo
      return novo
    })
  }, [])

  const onDeselecionarTudo = useCallback(() => {
    setGrafo(atual => {
      if (!atual.nodes.some(n => n.selected) && !atual.edges.some(e => e.selected)) return atual
      const novo = { nodes: atual.nodes.map(n => (n.selected ? { ...n, selected: false } : n)), edges: atual.edges.map(e => (e.selected ? { ...e, selected: false } : e)) }
      grafoRef.current = novo
      return novo
    })
  }, [])

  // --- Exportação (6.15 do mapeamento) — JSON (board bruto, reimportável
  // no futuro) e PNG (screenshot do canvas, sem a toolbar/controles: o
  // `filter` exclui qualquer Panel do React Flow do que é capturado). ---
  function onExportarJson() {
    const dados = flowParaBoard(grafoRef.current.nodes, grafoRef.current.edges)
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'board.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function onExportarPng() {
    if (!containerRef.current) return
    fitView({ padding: 0.15, duration: 0 })
    await new Promise(r => setTimeout(r, 100))
    // backgroundColor (não --pl-bg) porque um tema de board não-padrão pinta
    // o fundo direto, sem passar por essa variável (ver [data-tema] no CSS).
    const corFundo = getComputedStyle(containerRef.current).backgroundColor || '#0b0d14'
    try {
      const dataUrl = await toPng(containerRef.current, {
        backgroundColor: corFundo,
        pixelRatio: 2,
        filter: no => !(no instanceof HTMLElement && no.classList?.contains('react-flow__panel')),
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = 'board.png'
      a.click()
    } catch {
      alert('Não foi possível exportar a imagem. Tente novamente.')
    }
  }

  const frames = grafo.nodes.filter(n => n.type === 'frame').sort((a, b) => a.position.x - b.position.x)

  function iniciarApresentacao() {
    if (frames.length === 0) { alert('Crie ao menos um Frame (botão do modo Wireframe) pra ter o que apresentar.'); return }
    setSlideAtual(0)
    setModoApresentacao(true)
  }
  function sairApresentacao() {
    setModoApresentacao(false)
    fitView({ padding: 0.3, duration: 300 })
  }
  function irParaSlide(indice: number) {
    setSlideAtual(atual => Math.max(0, Math.min(frames.length - 1, indice)))
  }

  useEffect(() => {
    if (!modoApresentacao) return
    const frame = frames[slideAtual]
    if (frame) fitView({ nodes: [{ id: frame.id }], padding: 0.05, duration: 400 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoApresentacao, slideAtual])

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement
      const editando = alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable
      if (editando) {
        if (e.key === 'Escape') alvo.blur()
        return
      }
      if (modoApresentacao) {
        if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); irParaSlide(slideAtual + 1) }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); irParaSlide(slideAtual - 1) }
        else if (e.key === 'Escape') { sairApresentacao() }
        return
      }
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); desfazer(); return }
      if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); refazer(); return }
      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); onSelecionarTudo(); return }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); onDuplicarSelecionados(); return }
      if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); if (e.shiftKey) onDesagrupar(); else onAgrupar(); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { onExcluirSelecionados(); return }
      if (e.key === 'Escape') { onDeselecionarTudo(); return }
      if (e.key.startsWith('Arrow')) {
        const passo = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -passo : e.key === 'ArrowRight' ? passo : 0
        const dy = e.key === 'ArrowUp' ? -passo : e.key === 'ArrowDown' ? passo : 0
        if (dx || dy) { e.preventDefault(); onNudgeSelecionados(dx, dy) }
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  })

  const totalSelecionados = grafo.nodes.filter(n => n.selected).length
  const algumTravado = grafo.nodes.some(n => n.selected && n.draggable === false)
  const algumAgrupado = grafo.nodes.some(n => n.selected && !!(n.data as Record<string, unknown>).grupoId)

  return (
    <AcoesMapaContext.Provider value={{
      onMudarTexto, onAdicionarFilho, onExcluir, onMudarEstiloConector, onMudarLabelConector, onExcluirConector, onMudarLinhasTabela, onAlternarTarefa,
      onAdicionarMensagemComentario, onAlternarResolvidoComentario,
    }}>
      <div className="pl-mapa-canvas" ref={containerRef} data-tema={temaAtual.id}>
        <ReactFlow
          nodes={grafo.nodes}
          edges={grafo.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChangeFlow}
          onEdgesChange={onEdgesChangeFlow}
          onNodeDragStart={iniciarArraste}
          onNodeDragStop={finalizarArraste}
          onConnect={onConnect}
          nodesDraggable={!modoMao && !modoApresentacao}
          elementsSelectable={!modoApresentacao}
          // Padrão da lib é só 'Meta' (Cmd) — sem isso, Ctrl+clique (o normal
          // em Windows/Linux) não adiciona à seleção, só troca o nó
          // selecionado. Aceita os dois, Ctrl e Cmd, conforme a plataforma.
          multiSelectionKeyCode={['Control', 'Meta']}
          fitView
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          {!modoApresentacao && <Background gap={22} size={1} color="var(--pl-border-strong)" variant={temaAtual.variante} />}
          {!modoApresentacao && <Controls showInteractive={false} position="bottom-right" orientation="horizontal" />}
          {modoApresentacao ? (
            <Panel position="bottom-center" className="pl-mapa-toolbar-apresentacao">
              <button type="button" className="pl-mapa-tv-btn" title="Slide anterior" disabled={slideAtual === 0} onClick={() => irParaSlide(slideAtual - 1)}>
                <IconeSetaEsquerda />
              </button>
              <span className="pl-apresentacao-contador">{slideAtual + 1} / {frames.length}</span>
              <button type="button" className="pl-mapa-tv-btn" title="Próximo slide" disabled={slideAtual === frames.length - 1} onClick={() => irParaSlide(slideAtual + 1)}>
                <IconeSetaDireita />
              </button>
              <div className="pl-mapa-tv-divisor-h" />
              <button type="button" className="pl-mapa-tv-btn" title="Sair da apresentação (Esc)" onClick={sairApresentacao}>×</button>
            </Panel>
          ) : (
          <Panel position="top-left" className="pl-mapa-toolbar-vertical">
            <div className="pl-mapa-tv-modos">
              <button type="button" className={`pl-mapa-tv-btn ${modo === 'diagrama' ? 'ativo' : ''}`} title="Modo Diagrama" onClick={() => setModo('diagrama')}>
                <IconeModoDiagrama />
              </button>
              <button type="button" className={`pl-mapa-tv-btn ${modo === 'wireframe' ? 'ativo' : ''}`} title="Modo Wireframe" onClick={() => setModo('wireframe')}>
                <IconeModoWireframe />
              </button>
              <button type="button" className={`pl-mapa-tv-btn ${modo === 'tarefas' ? 'ativo' : ''}`} title="Modo Tarefas" onClick={() => setModo('tarefas')}>
                <IconeModoTarefas />
              </button>
            </div>
            <div className="pl-mapa-tv-divisor" />
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
            <button type="button" className="pl-mapa-tv-btn" title="Tabela" onClick={onAdicionarTabela}>
              <IconeTabela />
            </button>
            {modo === 'wireframe' && (
              <>
                <div className="pl-mapa-tv-divisor" />
                <button type="button" className="pl-mapa-tv-btn" title="Frame (tela)" onClick={onAdicionarFrame}><IconeFrame /></button>
                <button type="button" className="pl-mapa-tv-btn" title="Botão" onClick={onAdicionarBotao}><IconeBotaoWireframe /></button>
                <button type="button" className="pl-mapa-tv-btn" title="Campo de texto" onClick={onAdicionarInputWireframe}><IconeInputWireframe /></button>
                <button type="button" className="pl-mapa-tv-btn" title="Avatar" onClick={onAdicionarAvatar}><IconeAvatarWireframe /></button>
              </>
            )}
            {modo === 'tarefas' && (
              <>
                <div className="pl-mapa-tv-divisor" />
                <button type="button" className="pl-mapa-tv-btn" title="Pilha (coluna)" onClick={onAdicionarPilha}><IconePilha /></button>
                <button type="button" className="pl-mapa-tv-btn" title="Cartão de tarefa" onClick={onAdicionarTarefa}><IconeTarefaCard /></button>
              </>
            )}
            <div className="pl-mapa-tv-divisor" />
            <button
              type="button" className={`pl-mapa-tv-btn ${modoDesenho === 'traco' ? 'ativo' : ''}`} title="Desenho livre"
              onClick={() => setModoDesenho(m => (m === 'traco' ? null : 'traco'))}
            >
              <IconeMarcador />
            </button>
            <button
              type="button" className={`pl-mapa-tv-btn ${modoDesenho === 'marcaTexto' ? 'ativo' : ''}`} title="Marca-texto"
              onClick={() => setModoDesenho(m => (m === 'marcaTexto' ? null : 'marcaTexto'))}
            >
              <IconeMarcaTexto />
            </button>
            <button type="button" className="pl-mapa-tv-btn" title="Comentário" onClick={onAdicionarComentario}>
              <IconeComentario />
            </button>
            <div className="pl-mapa-tv-divisor" />
            <button type="button" className="pl-mapa-tv-btn" title="Desfazer (Ctrl+Z)" onClick={desfazer}>
              <IconeDesfazer />
            </button>
            <button type="button" className="pl-mapa-tv-btn" title="Refazer (Ctrl+Shift+Z)" onClick={refazer}>
              <IconeRefazer />
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
            <button type="button" className="pl-mapa-tv-btn" title="Exportar como PNG" onClick={onExportarPng}>
              <IconeExportar />
            </button>
            <button type="button" className="pl-mapa-tv-btn" title="Exportar como JSON" onClick={onExportarJson}>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, fontWeight: 700 }}>{'{ }'}</span>
            </button>
            <div className="pl-mapa-tv-divisor" />
            <button type="button" className="pl-mapa-tv-btn" title="Apresentar" onClick={iniciarApresentacao}>
              <IconeApresentar />
            </button>
          </Panel>
          )}
          {!modoApresentacao && totalSelecionados >= 1 && (
            <Panel position="top-center" className="pl-mapa-toolbar-selecao">
              <button type="button" className={`pl-mapa-tv-btn ${algumTravado ? 'ativo' : ''}`} title={algumTravado ? 'Destravar' : 'Travar'} onClick={onAlternarTravado}>
                <IconeCadeadoSelecao />
              </button>
              <button type="button" className="pl-mapa-tv-btn" title="Trazer pra frente" onClick={() => onCamada('frente')}>
                <IconeTrazerFrente />
              </button>
              <button type="button" className="pl-mapa-tv-btn" title="Enviar pra trás" onClick={() => onCamada('tras')}>
                <IconeEnviarTras />
              </button>
              {totalSelecionados >= 2 && (
                <>
                  <div className="pl-mapa-tv-divisor-h" />
                  <button type="button" className="pl-mapa-tv-btn" title="Alinhar à esquerda" onClick={() => onAlinhar('esquerda')}><IconeAlinharEsq /></button>
                  <button type="button" className="pl-mapa-tv-btn" title="Centralizar horizontalmente" onClick={() => onAlinhar('centroH')}><IconeAlinharCentroH /></button>
                  <button type="button" className="pl-mapa-tv-btn" title="Alinhar à direita" onClick={() => onAlinhar('direita')}><IconeAlinharDir /></button>
                  <button type="button" className="pl-mapa-tv-btn" title="Alinhar ao topo" onClick={() => onAlinhar('topo')}><IconeAlinharTopo /></button>
                  <button type="button" className="pl-mapa-tv-btn" title="Centralizar verticalmente" onClick={() => onAlinhar('meio')}><IconeAlinharMeio /></button>
                  <button type="button" className="pl-mapa-tv-btn" title="Alinhar à base" onClick={() => onAlinhar('base')}><IconeAlinharBase /></button>
                  <div className="pl-mapa-tv-divisor-h" />
                  {algumAgrupado ? (
                    <button type="button" className="pl-mapa-tv-btn" title="Desagrupar" onClick={onDesagrupar}><IconeDesagrupar /></button>
                  ) : (
                    <button type="button" className="pl-mapa-tv-btn" title="Agrupar" onClick={onAgrupar}><IconeAgrupar /></button>
                  )}
                </>
              )}
              {totalSelecionados >= 3 && (
                <>
                  <button type="button" className="pl-mapa-tv-btn" title="Distribuir horizontalmente" onClick={() => onDistribuir('horizontal')}><IconeDistribuirH /></button>
                  <button type="button" className="pl-mapa-tv-btn" title="Distribuir verticalmente" onClick={() => onDistribuir('vertical')}><IconeDistribuirV /></button>
                </>
              )}
            </Panel>
          )}
          {modoDesenho && (
            // Panel (não uma <div> solta fora do <ReactFlow>) de propósito:
            // o wrapper .react-flow tem position+z-index próprios (via
            // estilo interno da lib), formando um stacking context isolado
            // — uma div irmã por fora nunca consegue se intercalar entre o
            // canvas e a toolbar vertical (outro Panel) por z-index, fica
            // sempre inteiramente acima ou abaixo do bloco inteiro. Como
            // Panel, o overlay entra no mesmo stacking context da toolbar,
            // e aí sim dá pra ficar abaixo dela (z-index menor) sem deixar
            // de cobrir o canvas pra capturar o gesto de desenho.
            <Panel
              position="top-left"
              className="pl-desenho-overlay"
              style={{ inset: 0, margin: 0, width: '100%', height: '100%', zIndex: 15 }}
              onMouseDown={iniciarDesenho}
              onMouseMove={moverDesenho}
              onMouseUp={finalizarDesenho}
              onMouseLeave={finalizarDesenho}
            >
              {tracoAoVivo && tracoAoVivo.length > 1 && (
                <svg className="pl-desenho-overlay-svg">
                  <path
                    d={tracoAoVivo.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')}
                    stroke={modoDesenho === 'marcaTexto' ? '#f5d76e' : 'var(--pl-ink-1)'}
                    strokeWidth={modoDesenho === 'marcaTexto' ? 14 : 3}
                    strokeLinecap="round" strokeLinejoin="round" fill="none"
                    opacity={modoDesenho === 'marcaTexto' ? 0.45 : 1}
                  />
                </svg>
              )}
            </Panel>
          )}
        </ReactFlow>
      </div>
    </AcoesMapaContext.Provider>
  )
}

export default function MapaMentalCanvas(props: {
  dadosIniciais: { objetos: BoardObjeto[]; conectores: BoardConector[] }
  onChange: (dados: { objetos: BoardObjeto[]; conectores: BoardConector[] }) => void
  tema?: TemaBoard | null
}) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}
