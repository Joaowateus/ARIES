'use client'

// Editor de blocos estilo Notion: cada linha é um bloco independente
// (parágrafo, título, lista, checkbox, citação, código ou divisor).
// Enter cria um bloco novo, Backspace no início junta com o anterior,
// "/" abre um menu pra trocar o tipo do bloco atual, atalhos de markdown
// (# , - , [] , > , ---, ```) convertem o bloco enquanto digita, e a alcinha
// à esquerda arrasta pra reordenar. Sem formatação inline (negrito/itálico
// dentro do texto) — a unidade de formatação aqui é o bloco inteiro.
import { useLayoutEffect, useRef, useState } from 'react'
import { Bloco, TipoBloco } from '@/lib/proLaboreApi'

function gerarId(): string {
  return `b${Date.now()}${Math.random().toString(36).slice(2, 8)}`
}

function novoBloco(tipo: TipoBloco = 'paragrafo', texto = ''): Bloco {
  return { id: gerarId(), tipo, texto, marcado: tipo === 'checkbox' ? false : undefined }
}

const OPCOES_MENU: { tipo: TipoBloco; label: string; icone: string }[] = [
  { tipo: 'paragrafo', label: 'Texto', icone: '¶' },
  { tipo: 'titulo1', label: 'Título 1', icone: 'H1' },
  { tipo: 'titulo2', label: 'Título 2', icone: 'H2' },
  { tipo: 'titulo3', label: 'Título 3', icone: 'H3' },
  { tipo: 'lista', label: 'Lista', icone: '•' },
  { tipo: 'lista_numerada', label: 'Lista numerada', icone: '1.' },
  { tipo: 'checkbox', label: 'Checklist', icone: '☑' },
  { tipo: 'citacao', label: 'Citação', icone: '❝' },
  { tipo: 'codigo', label: 'Código', icone: '</>' },
  { tipo: 'divisor', label: 'Divisor', icone: '—' },
]

const PLACEHOLDER_POR_TIPO: Partial<Record<TipoBloco, string>> = {
  paragrafo: "Escreva algo, ou digite '/' pra ver os comandos...",
  titulo1: 'Título 1',
  titulo2: 'Título 2',
  titulo3: 'Título 3',
  lista: 'Lista',
  lista_numerada: 'Lista numerada',
  checkbox: 'Item',
  citacao: 'Citação',
  codigo: 'Código',
}

function detectarAtalho(valor: string): { tipo: TipoBloco; restante: string } | null {
  if (valor === '# ') return { tipo: 'titulo1', restante: '' }
  if (valor === '## ') return { tipo: 'titulo2', restante: '' }
  if (valor === '### ') return { tipo: 'titulo3', restante: '' }
  if (valor === '- ' || valor === '* ') return { tipo: 'lista', restante: '' }
  if (/^1\.\s$/.test(valor)) return { tipo: 'lista_numerada', restante: '' }
  if (valor === '[] ' || valor === '[ ] ') return { tipo: 'checkbox', restante: '' }
  if (valor === '> ') return { tipo: 'citacao', restante: '' }
  if (valor === '```') return { tipo: 'codigo', restante: '' }
  if (valor === '---') return { tipo: 'divisor', restante: '' }
  return null
}

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

export default function EditorBlocos({ blocosIniciais, onChange }: { blocosIniciais: Bloco[]; onChange: (blocos: Bloco[]) => void }) {
  const [blocos, setBlocos] = useState<Bloco[]>(blocosIniciais.length > 0 ? blocosIniciais : [novoBloco()])
  const [menuAbertoIndice, setMenuAbertoIndice] = useState<number | null>(null)
  const [arrastandoIndice, setArrastandoIndice] = useState<number | null>(null)
  const [sobreIndice, setSobreIndice] = useState<number | null>(null)
  const refs = useRef<(HTMLTextAreaElement | null)[]>([])
  const focoPendenteRef = useRef<{ indice: number; posicao: number } | null>(null)

  useLayoutEffect(() => {
    refs.current.forEach(autoResize)
    if (focoPendenteRef.current) {
      const { indice, posicao } = focoPendenteRef.current
      const el = refs.current[indice]
      if (el) { el.focus(); el.setSelectionRange(posicao, posicao) }
      focoPendenteRef.current = null
    }
  }, [blocos])

  function commit(novos: Bloco[]) {
    setBlocos(novos)
    onChange(novos)
  }

  function focarDepois(indice: number, posicao: number) {
    focoPendenteRef.current = { indice, posicao }
  }

  function numeroDaLista(indice: number): number {
    let n = 1
    for (let i = indice - 1; i >= 0 && blocos[i].tipo === 'lista_numerada'; i--) n++
    return n
  }

  function handleTexto(indice: number, valor: string) {
    const bloco = blocos[indice]
    const atalho = bloco.tipo === 'paragrafo' ? detectarAtalho(valor) : null
    if (atalho) {
      const novos = [...blocos]
      novos[indice] = { ...bloco, tipo: atalho.tipo, texto: atalho.restante, marcado: atalho.tipo === 'checkbox' ? false : undefined }
      if (atalho.tipo === 'divisor') {
        const paragrafo = novoBloco('paragrafo')
        novos.splice(indice + 1, 0, paragrafo)
        commit(novos)
        focarDepois(indice + 1, 0)
      } else {
        commit(novos)
        focarDepois(indice, 0)
      }
      return
    }
    const novos = [...blocos]
    novos[indice] = { ...bloco, texto: valor }
    commit(novos)
    if (valor === '/') setMenuAbertoIndice(indice)
    else if (menuAbertoIndice === indice) setMenuAbertoIndice(null)
  }

  function escolherTipoNoMenu(indice: number, tipo: TipoBloco) {
    const novos = [...blocos]
    novos[indice] = { ...novos[indice], tipo, texto: '', marcado: tipo === 'checkbox' ? false : undefined }
    setMenuAbertoIndice(null)
    if (tipo === 'divisor') {
      const paragrafo = novoBloco('paragrafo')
      novos.splice(indice + 1, 0, paragrafo)
      commit(novos)
      focarDepois(indice + 1, 0)
    } else {
      commit(novos)
      focarDepois(indice, 0)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, indice: number) {
    const bloco = blocos[indice]
    const textarea = e.currentTarget

    if (menuAbertoIndice === indice && e.key === 'Escape') {
      e.preventDefault()
      setMenuAbertoIndice(null)
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (menuAbertoIndice === indice) { escolherTipoNoMenu(indice, 'paragrafo'); return }
      const isItemDeLista = bloco.tipo === 'lista' || bloco.tipo === 'lista_numerada' || bloco.tipo === 'checkbox'
      if (isItemDeLista && bloco.texto === '') {
        const novos = [...blocos]
        novos[indice] = { ...bloco, tipo: 'paragrafo', marcado: undefined }
        commit(novos)
        return
      }
      const cursor = textarea.selectionStart
      const antes = bloco.texto.slice(0, cursor)
      const depois = bloco.texto.slice(cursor)
      const tipoNovo = isItemDeLista ? bloco.tipo : 'paragrafo'
      const novo = novoBloco(tipoNovo, depois)
      const novos = [...blocos]
      novos[indice] = { ...bloco, texto: antes }
      novos.splice(indice + 1, 0, novo)
      commit(novos)
      focarDepois(indice + 1, 0)
      return
    }

    if (e.key === 'Backspace' && textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
      if (indice === 0) return
      e.preventDefault()
      const anterior = blocos[indice - 1]
      if (anterior.tipo === 'divisor') {
        const novos = blocos.filter((_, i) => i !== indice - 1)
        commit(novos)
        focarDepois(indice - 1, 0)
        return
      }
      if (blocos.length === 1) return
      const posicaoFoco = anterior.texto.length
      const novos = [...blocos]
      novos[indice - 1] = { ...anterior, texto: anterior.texto + bloco.texto }
      novos.splice(indice, 1)
      commit(novos)
      focarDepois(indice - 1, posicaoFoco)
      return
    }

    if (e.key === 'ArrowUp' && textarea.selectionStart === 0 && indice > 0) {
      e.preventDefault()
      focarDepois(indice - 1, blocos[indice - 1].texto.length)
      return
    }
    if (e.key === 'ArrowDown' && textarea.selectionStart === bloco.texto.length && indice < blocos.length - 1) {
      e.preventDefault()
      focarDepois(indice + 1, 0)
      return
    }
  }

  function inserirDepois(indice: number) {
    const novos = [...blocos]
    novos.splice(indice + 1, 0, novoBloco())
    commit(novos)
    focarDepois(indice + 1, 0)
  }

  function excluirBloco(indice: number) {
    if (blocos.length === 1) return
    const novos = blocos.filter((_, i) => i !== indice)
    commit(novos)
    focarDepois(Math.max(0, indice - 1), 0)
  }

  function alternarMarcado(indice: number) {
    const novos = [...blocos]
    novos[indice] = { ...novos[indice], marcado: !novos[indice].marcado }
    commit(novos)
  }

  function soltar(indiceDestino: number) {
    if (arrastandoIndice === null || arrastandoIndice === indiceDestino) { setArrastandoIndice(null); setSobreIndice(null); return }
    const novos = [...blocos]
    const [movido] = novos.splice(arrastandoIndice, 1)
    const destino = arrastandoIndice < indiceDestino ? indiceDestino - 1 : indiceDestino
    novos.splice(destino + 1, 0, movido)
    commit(novos)
    setArrastandoIndice(null)
    setSobreIndice(null)
  }

  return (
    <div className="pl-editor-blocos">
      {blocos.map((bloco, indice) => (
        <div
          key={bloco.id}
          className={`pl-bloco-linha ${sobreIndice === indice ? 'pl-bloco-sobre' : ''}`}
          onDragOver={e => { e.preventDefault(); setSobreIndice(indice) }}
          onDragLeave={() => setSobreIndice(atual => (atual === indice ? null : atual))}
          onDrop={e => { e.preventDefault(); soltar(indice) }}
        >
          <span
            className="pl-bloco-handle"
            draggable
            onDragStart={() => setArrastandoIndice(indice)}
            onDragEnd={() => { setArrastandoIndice(null); setSobreIndice(null) }}
            title="Arrastar pra reordenar"
          >
            ⠿
          </span>

          <div className="pl-bloco-conteudo">
            {bloco.tipo === 'divisor' ? (
              <hr className="pl-bloco-divisor" />
            ) : (
              <div className={`pl-bloco-tipo-${bloco.tipo}`}>
                {bloco.tipo === 'lista' && <span className="pl-bloco-marcador">•</span>}
                {bloco.tipo === 'lista_numerada' && <span className="pl-bloco-marcador">{numeroDaLista(indice)}.</span>}
                {bloco.tipo === 'checkbox' && (
                  <input type="checkbox" className="pl-bloco-checkbox" checked={!!bloco.marcado} onChange={() => alternarMarcado(indice)} />
                )}
                <textarea
                  ref={el => { refs.current[indice] = el }}
                  className={`pl-bloco-texto ${bloco.marcado ? 'pl-bloco-marcado' : ''}`}
                  rows={1}
                  value={bloco.texto}
                  placeholder={PLACEHOLDER_POR_TIPO[bloco.tipo]}
                  onChange={e => handleTexto(indice, e.target.value)}
                  onKeyDown={e => handleKeyDown(e, indice)}
                  onFocus={e => autoResize(e.currentTarget)}
                />
              </div>
            )}

            {menuAbertoIndice === indice && (
              <div className="pl-bloco-menu">
                {OPCOES_MENU.map(op => (
                  <button key={op.tipo} type="button" className="pl-bloco-menu-item" onClick={() => escolherTipoNoMenu(indice, op.tipo)}>
                    <span className="pl-bloco-menu-icone">{op.icone}</span>
                    {op.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pl-bloco-acoes">
            <button type="button" className="pl-bloco-acao-btn" title="Adicionar bloco abaixo" onClick={() => inserirDepois(indice)}>+</button>
            {blocos.length > 1 && (
              <button type="button" className="pl-bloco-acao-btn" title="Excluir bloco" onClick={() => excluirBloco(indice)}>×</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
