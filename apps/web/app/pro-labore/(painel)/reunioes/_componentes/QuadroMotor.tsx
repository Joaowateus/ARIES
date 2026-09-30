'use client'

// Hospeda o motor de mapa mental da aba Anotações (mesmo visual, mesmos
// atalhos) pra apresentação ao vivo — editável pra quem apresenta, só
// leitura pra quem assiste. A tela dona do quadro recebe a instância do
// motor por `onPronto` e fala com ela direto (aplicar mapa remoto, seguir
// a vista, ponteiro).
import { useEffect, useRef } from 'react'
import { MotorMapaMental, type EstadoMotor, type VistaMundo } from '../../anotacoes/motor-mapa-mental/motor'
import type { NoArvore } from '../../anotacoes/motor-mapa-mental/dados'
import type { Layout } from '../../anotacoes/motor-mapa-mental/layoutMotor'

export interface QuadroMotorProps {
  arvoreInicial: NoArvore
  layout: Layout
  tema: string
  doisLados: boolean
  somenteLeitura?: boolean
  onPronto: (motor: MotorMapaMental) => void
  onMudancaArvore?: (tree: NoArvore) => void
  onMudancaEstado?: (estado: EstadoMotor) => void
  onMudancaVista?: (vista: VistaMundo) => void
  onMudancaSelecao?: (id: string | null) => void
  onInteracaoVista?: () => void
  children?: React.ReactNode
}

export default function QuadroMotor(props: QuadroMotorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const propsRef = useRef(props)
  useEffect(() => { propsRef.current = props })

  useEffect(() => {
    if (!containerRef.current) return
    const p = propsRef.current
    const motor = new MotorMapaMental({
      container: containerRef.current,
      // Cópia: o motor muta a árvore no lugar.
      treeInicial: JSON.parse(JSON.stringify(p.arvoreInicial)),
      layoutInicial: p.layout,
      temaInicial: p.tema,
      balancedInicial: p.doisLados,
      somenteLeitura: p.somenteLeitura,
      onMudancaArvore: tree => propsRef.current.onMudancaArvore?.(tree),
      onMudancaEstado: e => propsRef.current.onMudancaEstado?.(e),
      onMudancaVista: v => propsRef.current.onMudancaVista?.(v),
      onMudancaSelecao: id => propsRef.current.onMudancaSelecao?.(id),
      onInteracaoVista: () => propsRef.current.onInteracaoVista?.(),
    })
    p.onPronto(motor)
    return () => motor.destroy()
  }, [])

  return (
    <div className="pl-ap-quadro">
      <div ref={containerRef} className="pl-motor-stage" />
      {props.children}
    </div>
  )
}

export type { VistaMundo }
