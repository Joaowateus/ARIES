'use client'

// Quadro da Produção: 6 colunas com contador e arrastar entre colunas
// (Pointer Events, sem biblioteca — mesmo caminho do mapa mental). Pelo
// teclado: Alt + setas move o cartão de coluna; o briefing também tem
// "Mover para".
import { useEffect, useRef, useState } from 'react'
import type { SmColuna, SmPauta } from '@/lib/proLaboreApi'
import { Chip, COLUNA_ROTULO, COLUNAS, FORMATO_ROTULO, PILAR_CHIP, PILAR_ROTULO, quandoCurto } from '../../_ui'

interface Arrasto { id: string; x: number; y: number; dx: number; dy: number; largura: number; alvo: { coluna: SmColuna; indice: number } | null }

export function ordemEntre(lista: SmPauta[], indice: number): number {
  const antes = lista[indice - 1]?.ordem
  const depois = lista[indice]?.ordem
  if (antes != null && depois != null) return (antes + depois) / 2
  if (antes != null) return antes + 1000
  if (depois != null) return depois - 1000
  return Date.now()
}

function prazoDoCartao(p: SmPauta): { texto: string; atrasada: boolean } {
  if (p.atrasada && p.prazo) return { texto: `Atrasada · ${quandoCurto(p.prazo, false)}`, atrasada: true }
  if (p.agendadoPara) return { texto: quandoCurto(p.agendadoPara), atrasada: false }
  if (p.prazo) return { texto: quandoCurto(p.prazo, false), atrasada: false }
  return { texto: 'sem prazo', atrasada: false }
}

function Cartao({ p, selecionada, arrastando, aoSelecionar, aoIniciar, aoTeclaMover }: {
  p: SmPauta
  selecionada: boolean
  arrastando: boolean
  aoSelecionar: () => void
  aoIniciar?: (e: React.PointerEvent<HTMLButtonElement>) => void
  aoTeclaMover?: (direcao: -1 | 1) => void
}) {
  const prazo = prazoDoCartao(p)
  const tomadas = p.midias.filter(m => m.tipo === 'TOMADA').length
  return (
    <button
      type="button"
      className={`sm-kcard${arrastando ? ' arrastando' : ''}`}
      data-pauta={p.id}
      aria-current={selecionada}
      aria-label={`${p.titulo}. ${PILAR_ROTULO[p.pilar]}, ${FORMATO_ROTULO[p.formato]}, ${prazo.texto}.${aoTeclaMover ? ' Alt e setas movem de coluna.' : ''}`}
      onClick={aoSelecionar}
      onPointerDown={aoIniciar}
      onKeyDown={e => {
        if (!aoTeclaMover || !e.altKey) return
        if (e.key === 'ArrowRight') { e.preventDefault(); aoTeclaMover(1) }
        if (e.key === 'ArrowLeft') { e.preventDefault(); aoTeclaMover(-1) }
      }}
    >
      <Chip pilar={PILAR_CHIP[p.pilar]}>{PILAR_ROTULO[p.pilar]}</Chip>
      <span className="sm-kcard-titulo">{p.titulo}</span>
      {(p.trial || p.aprovacao === 'AJUSTE' || (p.status === 'APROVACAO' && p.aprovacao === 'PENDENTE') || p.publicacaoStatus === 'FALHA' || (tomadas > 0 && p.status === 'GRAVACAO')) && (
        <span className="sm-kcard-selos">
          {p.trial && <Chip tom="info">Trial</Chip>}
          {tomadas > 0 && p.status === 'GRAVACAO' && <Chip tom="ok">{tomadas} {tomadas === 1 ? 'tomada' : 'tomadas'}</Chip>}
          {p.aprovacao === 'AJUSTE' && <Chip tom="bad">Ajuste pedido</Chip>}
          {p.status === 'APROVACAO' && p.aprovacao === 'PENDENTE' && <Chip tom="warn">Aguardando aprovação</Chip>}
          {p.publicacaoStatus === 'FALHA' && <Chip tom="bad">Falhou ao publicar</Chip>}
        </span>
      )}
      <span className="sm-kcard-rodape"><span>{FORMATO_ROTULO[p.formato]}</span><span className={prazo.atrasada ? 'atrasada' : undefined}>{prazo.texto}</span></span>
    </button>
  )
}

export function Quadro({ pautas, selecionadaId, aoSelecionar, aoMover, podeEditar }: {
  pautas: SmPauta[]
  selecionadaId: string | null
  aoSelecionar: (id: string) => void
  aoMover: (id: string, coluna: SmColuna, ordem: number) => void
  podeEditar: boolean
}) {
  const [arrasto, setArrasto] = useState<Arrasto | null>(null)
  const inicio = useRef<{ id: string; x: number; y: number; el: HTMLElement } | null>(null)
  const arrastoRef = useRef<Arrasto | null>(null)
  const area = useRef<HTMLElement>(null)
  const acabouDeArrastar = useRef(false)
  const porColuna = Object.fromEntries(COLUNAS.map(c => [c, pautas.filter(p => p.status === c).sort((a, b) => a.ordem - b.ordem)])) as Record<SmColuna, SmPauta[]>
  const ref = useRef({ porColuna, aoMover })
  useEffect(() => { ref.current = { porColuna, aoMover } })

  useEffect(() => {
    function alvoEm(x: number, y: number, id: string): Arrasto['alvo'] {
      const col = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-coluna]')
      if (!col) return null
      const coluna = col.dataset.coluna as SmColuna
      const cards = [...col.querySelectorAll<HTMLElement>('[data-pauta]')].filter(c => c.dataset.pauta !== id)
      const indice = cards.filter(c => { const r = c.getBoundingClientRect(); return r.top + r.height / 2 < y }).length
      return { coluna, indice }
    }
    function mover(e: PointerEvent) {
      const ini = inicio.current
      if (!ini) return
      const atual = arrastoRef.current
      if (!atual && Math.hypot(e.clientX - ini.x, e.clientY - ini.y) < 6) return
      const r = ini.el.getBoundingClientRect()
      const base = atual ?? { id: ini.id, x: 0, y: 0, dx: ini.x - r.left, dy: ini.y - r.top, largura: r.width, alvo: null }
      // Perto da borda do quadro, ele rola sozinho (as 6 colunas não cabem em telas menores).
      const caixa = area.current?.getBoundingClientRect()
      if (area.current && caixa) {
        if (e.clientX > caixa.right - 60) area.current.scrollLeft += 24
        else if (e.clientX < caixa.left + 60) area.current.scrollLeft -= 24
      }
      const novo = { ...base, x: e.clientX, y: e.clientY, alvo: alvoEm(e.clientX, e.clientY, ini.id) }
      arrastoRef.current = novo
      setArrasto(novo)
    }
    function soltar() {
      const a = arrastoRef.current
      inicio.current = null
      arrastoRef.current = null
      if (!a) return
      setArrasto(null)
      acabouDeArrastar.current = true
      setTimeout(() => { acabouDeArrastar.current = false }, 0)
      if (a.alvo) {
        const lista = ref.current.porColuna[a.alvo.coluna].filter(p => p.id !== a.id)
        ref.current.aoMover(a.id, a.alvo.coluna, ordemEntre(lista, a.alvo.indice))
      }
    }
    function cancelar(e: KeyboardEvent) { if (e.key === 'Escape') { inicio.current = null; arrastoRef.current = null; setArrasto(null) } }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)
    window.addEventListener('keydown', cancelar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
      window.removeEventListener('keydown', cancelar)
    }
  }, [])

  const arrastada = arrasto ? pautas.find(p => p.id === arrasto.id) : null

  return (
    <section ref={area} aria-label="Quadro de produção" className="sm-quadro">
      <div className="sm-quadro-colunas">
        {COLUNAS.map((c, ci) => {
          const lista = porColuna[c]
          const alvoAqui = arrasto?.alvo?.coluna === c
          const visiveis = lista.filter(p => p.id !== arrasto?.id || !alvoAqui)
          return (
            <div key={c} className={`sm-coluna${alvoAqui ? ' alvo' : ''}`} data-coluna={c} aria-label={`${COLUNA_ROTULO[c]}: ${lista.length}`} role="group">
              <div className="sm-coluna-cab"><span className="sm-mono">{COLUNA_ROTULO[c]}</span><Chip>{lista.length}</Chip></div>
              {visiveis.map((p, i) => (
                <div key={p.id} style={{ display: 'contents' }}>
                  {alvoAqui && arrasto!.alvo!.indice === i && <div className="sm-marcador" aria-hidden="true" />}
                  <Cartao
                    p={p}
                    selecionada={p.id === selecionadaId}
                    arrastando={p.id === arrasto?.id}
                    aoSelecionar={() => { if (!acabouDeArrastar.current) aoSelecionar(p.id) }}
                    aoIniciar={podeEditar ? e => { if (e.button === 0) inicio.current = { id: p.id, x: e.clientX, y: e.clientY, el: e.currentTarget } } : undefined}
                    aoTeclaMover={podeEditar ? dir => {
                      const destino = COLUNAS[ci + dir]
                      if (destino) aoMover(p.id, destino, ordemEntre(porColuna[destino], porColuna[destino].length))
                    } : undefined}
                  />
                </div>
              ))}
              {alvoAqui && arrasto!.alvo!.indice >= visiveis.length && <div className="sm-marcador" aria-hidden="true" />}
              {lista.length === 0 && !alvoAqui && <div className="sm-coluna-vazia">Vazia</div>}
            </div>
          )
        })}
      </div>
      {arrasto && arrastada && (
        <div className="sm-fantasma" style={{ left: arrasto.x - arrasto.dx, top: arrasto.y - arrasto.dy, width: arrasto.largura }} aria-hidden="true">
          <Cartao p={arrastada} selecionada arrastando={false} aoSelecionar={() => {}} />
        </div>
      )}
    </section>
  )
}
