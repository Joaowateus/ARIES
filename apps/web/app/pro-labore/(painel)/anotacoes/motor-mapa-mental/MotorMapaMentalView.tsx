'use client'

// Componente React fino que hospeda o motor de mapa mental fiel: só monta o
// motor (classe sem React) num container e traduz callbacks de estado em
// re-render da barra de ferramentas — a barra em si é JSX comum (React "só
// na renderização e nos eventos", como pedido). Camada equivalente ao
// `<header class="bar">` + `<main id="stage">` da referência
// (referencia/motor-mapa-mental.html), só que a barra de cima vira JSX e o
// stage (svg/editor/ações/zoom) continua sendo criado e atualizado pelo
// próprio motor, do jeito que estava na referência.
import { useEffect, useRef, useState } from 'react'
import type { Layout } from './layoutMotor'
import { EstadoMotor, MotorMapaMental } from './motor'
import { NoArvore } from './dados'
import { THEMES } from './temas'

const LAYOUTS: { id: Layout; label: string }[] = [
  { id: 'mind', label: 'Mapa mental' },
  { id: 'org', label: 'Organograma' },
  { id: 'list', label: 'Lista' },
]

export interface MotorMapaMentalViewProps {
  treeInicial: NoArvore
  counterInicial: number
  layoutInicial: Layout
  temaInicial: string
  doisLadosInicial: boolean
  onMudancaArvore: (tree: NoArvore, counter: number, posicoes: Map<string, { x: number; y: number }>) => void
  onMudarLayout: (layout: Layout) => void
  onMudarTema: (tema: string) => void
  onMudarDoisLados: (doisLados: boolean) => void
}

export default function MotorMapaMentalView(props: MotorMapaMentalViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const motorRef = useRef<MotorMapaMental | null>(null)
  const propsRef = useRef(props)
  useEffect(() => { propsRef.current = props })
  const [estado, setEstado] = useState<EstadoMotor>({
    layout: props.layoutInicial, theme: props.temaInicial, balanced: props.doisLadosInicial,
    showBand: false, zoomPct: 100, canUndo: false, canRedo: false,
    selecionadoId: null, selecionadoTemFilhos: false, selecionadoColapsado: false, podeExcluirSelecionado: false,
  })

  useEffect(() => {
    if (!containerRef.current) return
    const motor = new MotorMapaMental({
      container: containerRef.current,
      treeInicial: propsRef.current.treeInicial,
      counterInicial: propsRef.current.counterInicial,
      layoutInicial: propsRef.current.layoutInicial,
      temaInicial: propsRef.current.temaInicial,
      balancedInicial: propsRef.current.doisLadosInicial,
      onMudancaArvore: (tree, counter, posicoes) => propsRef.current.onMudancaArvore(tree, counter, posicoes),
      onMudancaEstado: novoEstado => setEstado(novoEstado),
    })
    motorRef.current = motor
    return () => { motor.destroy(); motorRef.current = null }
  }, [])

  function mudarLayout(l: Layout) {
    motorRef.current?.setLayout(l)
    propsRef.current.onMudarLayout(l)
  }
  function mudarTema(t: string) {
    motorRef.current?.setTheme(t)
    propsRef.current.onMudarTema(t)
  }
  function mudarDoisLados() {
    const novo = !estado.balanced
    motorRef.current?.setBalanced(novo)
    propsRef.current.onMudarDoisLados(novo)
  }

  return (
    <div className="pl-motor-wrap">
      <div className="pl-motor-barra">
        <div className="pl-motor-seg" role="group" aria-label="Layout">
          {LAYOUTS.map(l => (
            <button key={l.id} type="button" aria-pressed={estado.layout === l.id} onClick={() => mudarLayout(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
        <button
          type="button" className="pl-motor-chip" aria-pressed={estado.balanced && estado.layout === 'mind'}
          disabled={estado.layout !== 'mind'} title="Distribui os galhos principais à direita e à esquerda"
          onClick={mudarDoisLados}
        >
          Dois lados
        </button>
        <span className="pl-motor-sep" />
        <div className="pl-motor-temas" role="group" aria-label="Tema">
          {Object.entries(THEMES).map(([key, t]) => (
            <button
              key={key} type="button" className="pl-motor-tema-sw" aria-pressed={estado.theme === key}
              onClick={() => mudarTema(key)}
            >
              <span className="pl-motor-tema-dots">
                {t.palette.slice(0, 3).map((c, i) => <i key={i} style={{ background: c }} />)}
              </span>
              {t.name}
            </button>
          ))}
        </div>
        <span className="pl-motor-grow" />
        <button
          type="button" className="pl-motor-chip" aria-pressed={estado.showBand}
          onClick={() => motorRef.current?.setShowBand(!estado.showBand)}
        >
          Faixa do galho
        </button>
        <button type="button" className="pl-motor-chip" onClick={() => motorRef.current?.carregarArvoreTeste()}>Árvore de teste</button>
        <button type="button" className="pl-motor-chip" onClick={() => motorRef.current?.carregarArvoreExemplo()}>Exemplo</button>
        <button type="button" className="pl-motor-icon" aria-label="Desfazer" title="Desfazer (Ctrl+Z)" disabled={!estado.canUndo} onClick={() => motorRef.current?.undo()}>
          <IconeDesfazer />
        </button>
        <button type="button" className="pl-motor-icon" aria-label="Refazer" title="Refazer (Ctrl+Shift+Z)" disabled={!estado.canRedo} onClick={() => motorRef.current?.redo()}>
          <IconeRefazer />
        </button>
      </div>
      <div ref={containerRef} className="pl-motor-stage" />
    </div>
  )
}

function IconeDesfazer() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  )
}
function IconeRefazer() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" />
    </svg>
  )
}
