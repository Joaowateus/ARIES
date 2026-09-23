'use client'

// Canvas de mapa mental: um nó central com filhos ramificando em árvore
// horizontal (layout automático, sem posicionamento livre). Cada nó é uma
// caixa com texto editável inline; "+" adiciona um filho, "×" exclui o nó
// (e sua subárvore), e a alcinha à esquerda arrasta pra reordenar entre
// irmãos — sem re-parentar (mesma limitação deliberada dos blocos de nota).
import { useRef, useState } from 'react'
import { NoMapa } from '@/lib/proLaboreApi'

function gerarIdNo(): string {
  return `n${Date.now()}${Math.random().toString(36).slice(2, 8)}`
}

export function criarNoMapa(texto = ''): NoMapa {
  return { id: gerarIdNo(), texto, filhos: [] }
}

function inserirFilho(no: NoMapa, paiId: string): NoMapa {
  if (no.id === paiId) return { ...no, filhos: [...no.filhos, criarNoMapa()] }
  return { ...no, filhos: no.filhos.map(f => inserirFilho(f, paiId)) }
}

function atualizarTextoNo(no: NoMapa, id: string, texto: string): NoMapa {
  if (no.id === id) return { ...no, texto }
  return { ...no, filhos: no.filhos.map(f => atualizarTextoNo(f, id, texto)) }
}

function removerNo(no: NoMapa, id: string): NoMapa {
  return { ...no, filhos: no.filhos.filter(f => f.id !== id).map(f => removerNo(f, id)) }
}

function moverIrmao(no: NoMapa, paiId: string, deIndice: number, paraIndice: number): NoMapa {
  if (no.id === paiId) {
    const filhos = [...no.filhos]
    const [movido] = filhos.splice(deIndice, 1)
    filhos.splice(paraIndice, 0, movido)
    return { ...no, filhos }
  }
  return { ...no, filhos: no.filhos.map(f => moverIrmao(f, paiId, deIndice, paraIndice)) }
}

function NoMapaCaixa({
  no, nivel, paiId, indice, arrasto, onMudarTexto, onAdicionarFilho, onExcluir, onIniciarArrasto, onSoltarEm,
}: {
  no: NoMapa
  nivel: number
  paiId: string | null
  indice: number
  arrasto: { paiId: string; indice: number } | null
  onMudarTexto: (id: string, texto: string) => void
  onAdicionarFilho: (id: string) => void
  onExcluir: (id: string) => void
  onIniciarArrasto: (paiId: string, indice: number) => void
  onSoltarEm: (paiId: string, indice: number) => void
}) {
  const [sobre, setSobre] = useState(false)
  const podeReceberSolta = arrasto !== null && paiId !== null && arrasto.paiId === paiId

  return (
    <div className="pl-mapa-no-linha">
      <div
        className={`pl-mapa-no-caixa ${sobre && podeReceberSolta ? 'pl-mapa-no-sobre' : ''}`}
        onDragOver={e => { if (podeReceberSolta) { e.preventDefault(); setSobre(true) } }}
        onDragLeave={() => setSobre(false)}
        onDrop={e => { e.preventDefault(); setSobre(false); if (paiId) onSoltarEm(paiId, indice) }}
      >
        {nivel > 0 && (
          <span
            className="pl-mapa-no-handle"
            draggable
            onDragStart={() => paiId && onIniciarArrasto(paiId, indice)}
            title="Arrastar pra reordenar entre irmãos"
          >
            ⠿
          </span>
        )}
        <input
          className="pl-mapa-no-input"
          value={no.texto}
          placeholder={nivel === 0 ? 'Ideia central' : 'Nova ideia'}
          onChange={e => onMudarTexto(no.id, e.target.value)}
        />
        <div className="pl-mapa-no-acoes">
          <button type="button" className="pl-mapa-no-acao-btn" title="Adicionar ideia filha" onClick={() => onAdicionarFilho(no.id)}>+</button>
          {nivel > 0 && <button type="button" className="pl-mapa-no-acao-btn" title="Excluir" onClick={() => onExcluir(no.id)}>×</button>}
        </div>
      </div>

      {no.filhos.length > 0 && (
        <div className="pl-mapa-no-filhos">
          {no.filhos.map((filho, i) => (
            <NoMapaCaixa
              key={filho.id} no={filho} nivel={nivel + 1} paiId={no.id} indice={i} arrasto={arrasto}
              onMudarTexto={onMudarTexto} onAdicionarFilho={onAdicionarFilho} onExcluir={onExcluir}
              onIniciarArrasto={onIniciarArrasto} onSoltarEm={onSoltarEm}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function MapaMentalCanvas({ raizInicial, onChange }: { raizInicial: NoMapa; onChange: (raiz: NoMapa) => void }) {
  const [raiz, setRaiz] = useState<NoMapa>(raizInicial)
  const arrastoRef = useRef<{ paiId: string; indice: number } | null>(null)
  const [, forcarRender] = useState(0)

  function commit(novaRaiz: NoMapa) {
    setRaiz(novaRaiz)
    onChange(novaRaiz)
  }

  function iniciarArrasto(paiId: string, indice: number) {
    arrastoRef.current = { paiId, indice }
    forcarRender(n => n + 1)
  }

  function soltarEm(paiId: string, indiceDestino: number) {
    const arrasto = arrastoRef.current
    arrastoRef.current = null
    forcarRender(n => n + 1)
    if (!arrasto || arrasto.paiId !== paiId || arrasto.indice === indiceDestino) return
    commit(moverIrmao(raiz, paiId, arrasto.indice, indiceDestino))
  }

  return (
    <div className="pl-mapa-canvas">
      <NoMapaCaixa
        no={raiz} nivel={0} paiId={null} indice={0} arrasto={arrastoRef.current}
        onMudarTexto={(id, texto) => commit(atualizarTextoNo(raiz, id, texto))}
        onAdicionarFilho={id => commit(inserirFilho(raiz, id))}
        onExcluir={id => commit(removerNo(raiz, id))}
        onIniciarArrasto={iniciarArrasto}
        onSoltarEm={soltarEm}
      />
    </div>
  )
}
