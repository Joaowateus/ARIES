'use client'

// Grade do calendário (mês ou semana, começando na segunda). Posts das
// pautas podem ser arrastados entre dias (Pointer Events); o horário é
// mantido e as regras são recalculadas ao soltar.
import { useEffect, useRef, useState } from 'react'
import type { SmDiaCalendario, SmItemCalendario, SmPilar } from '@/lib/proLaboreApi'
import { Chip, FORMATO_ROTULO, PILAR_ROTULO } from '../../_ui'

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

interface Arrasto { item: SmItemCalendario; x: number; y: number; alvo: string | null }

function Post({ it, arrastando, aoAbrir, aoIniciar }: {
  it: SmItemCalendario
  arrastando?: boolean
  aoAbrir?: () => void
  aoIniciar?: (e: React.PointerEvent<HTMLButtonElement>) => void
}) {
  const planejado = it.tipo === 'PAUTA' && it.status !== 'PUBLICADO'
  const rotulo = `${it.hora} · ${FORMATO_ROTULO[it.formato]}: ${it.titulo}. ${it.pilar ? PILAR_ROTULO[it.pilar] : 'Publicado no Instagram'}${planejado ? ', planejado' : ', publicado'}.${it.teste ? ` Teste A/B, grupo ${it.teste.grupo} (${it.teste.rotulo}).` : ''}`
  return (
    <button
      type="button"
      className={`sm-post${it.pilar ? ` p-${it.pilar}` : ''}${planejado ? ' planejado' : ''}${it.arrastavel ? ' arrastavel' : ''}${arrastando ? ' arrastando' : ''}`}
      aria-label={rotulo}
      title={rotulo}
      onClick={aoAbrir}
      onPointerDown={aoIniciar}
    >
      <b>{it.hora} · {FORMATO_ROTULO[it.formato]}</b>
      <span>{it.titulo}</span>
      {it.teste && <i className="sm-post-teste">Teste {it.teste.grupo}</i>}
    </button>
  )
}

export function Grade({ semanas, modo, filtro, datas, aoAbrir, aoSlot, aoSoltar }: {
  semanas: SmDiaCalendario[][]
  /** Datas comerciais por dia (AAAA-MM-DD): Fase 6, planejamento do mês. */
  datas?: Record<string, { nome: string; dica: string }[]>
  modo: 'mes' | 'semana'
  filtro: Set<SmPilar>
  aoAbrir: (it: SmItemCalendario) => void
  aoSlot: (dia: SmDiaCalendario) => void
  aoSoltar: (it: SmItemCalendario, dia: string) => void
}) {
  const [arrasto, setArrasto] = useState<Arrasto | null>(null)
  const ref = useRef<Arrasto | null>(null)
  const inicio = useRef<{ item: SmItemCalendario; x: number; y: number } | null>(null)
  const acabou = useRef(false)
  const soltar = useRef(aoSoltar)
  useEffect(() => { soltar.current = aoSoltar })

  useEffect(() => {
    function mover(e: PointerEvent) {
      const ini = inicio.current
      if (!ini) return
      if (!ref.current && Math.hypot(e.clientX - ini.x, e.clientY - ini.y) < 6) return
      const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-dia]')?.dataset.dia ?? null
      ref.current = { item: ini.item, x: e.clientX, y: e.clientY, alvo }
      setArrasto(ref.current)
    }
    function fim() {
      const a = ref.current
      inicio.current = null
      ref.current = null
      if (!a) return
      setArrasto(null)
      acabou.current = true
      setTimeout(() => { acabou.current = false }, 0)
      if (a.alvo && a.alvo !== a.item.instante.slice(0, 10)) soltar.current(a.item, a.alvo)
    }
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') { inicio.current = null; ref.current = null; setArrasto(null) } }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', fim)
    window.addEventListener('pointercancel', fim)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', fim)
      window.removeEventListener('pointercancel', fim)
      window.removeEventListener('keydown', esc)
    }
  }, [])

  const visivel = (it: SmItemCalendario) => !it.pilar || filtro.has(it.pilar)

  return (
    <div className="sm-cal-rola">
      <div className={`sm-cal-grade${modo === 'semana' ? ' semana' : ''}`} role="grid" aria-label="Calendário editorial">
        <div className="sm-cal-linha" role="row">{DIAS.map(d => <span key={d} className="sm-mono" role="columnheader">{d}</span>)}</div>
        {semanas.map(semana => (
          <div key={semana[0].data} className="sm-cal-linha" role="row">
            {semana.map(d => {
              const itens = d.itens.filter(visivel)
              const classes = ['sm-dia', !d.doMes && 'fora', d.semPost && 'vazio', d.hoje && 'hoje', d.rajada && 'rajada', arrasto?.alvo === d.data && 'alvo'].filter(Boolean).join(' ')
              const num = Number(d.data.slice(8, 10))
              return (
                <div key={d.data} className={classes} data-dia={d.data} role="gridcell" aria-label={`${num}/${d.data.slice(5, 7)}${d.hoje ? ', hoje' : ''}${datas?.[d.data]?.length ? `, ${datas[d.data].map(x => x.nome).join(', ')}` : ''}${d.rajada ? ', rajada' : ''}${d.semPost ? ', sem post' : ''}`}>
                  <div className="sm-dia-cab">
                    <span className="sm-dia-num">{num}</span>
                    {d.hoje && <span className="sm-chip hoje">Hoje</span>}
                    {d.rajada && !d.hoje && <Chip tom="bad">Rajada</Chip>}
                  </div>
                  {d.hoje && d.rajada && <Chip tom="bad">Rajada</Chip>}
                  {datas?.[d.data]?.map(dc => <span key={dc.nome} className="sm-data-comercial" title={`${dc.nome}: ${dc.dica}`}>{dc.nome}</span>)}
                  {d.semPost && <span className="sm-sem-post">sem post</span>}
                  {d.slotLivre && <button type="button" className="sm-slot" aria-label={`Criar pauta para ${num}/${d.data.slice(5, 7)}`} onClick={() => aoSlot(d)}>+ slot livre</button>}
                  {itens.map(it => (
                    <Post
                      key={`${it.tipo}-${it.id}`}
                      it={it}
                      arrastando={arrasto?.item.id === it.id}
                      aoAbrir={() => { if (!acabou.current) aoAbrir(it) }}
                      aoIniciar={it.arrastavel ? e => { if (e.button === 0) inicio.current = { item: it, x: e.clientX, y: e.clientY } } : undefined}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      {arrasto && (
        <div className="sm-fantasma" style={{ left: arrasto.x + 8, top: arrasto.y + 8, width: 150 }} aria-hidden="true">
          <Post it={arrasto.item} />
        </div>
      )}
    </div>
  )
}
