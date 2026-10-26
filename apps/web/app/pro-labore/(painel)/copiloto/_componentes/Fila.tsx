'use client'

// Fila ao vivo de "próxima melhor ação": quem atender primeiro e o próximo
// passo, pelos sinais que o sistema já tem (WhatsApp esperando, follow,
// crédito aprovado, pediu visita/simulação, nota da conversa, tempo parado).
// O plano do dia fica congelado de manhã; a fila acompanha o dia.
import { useEffect, useState } from 'react'
import { proLaboreApi, type CpFila, type CpGrupoFila, type CpItemFila } from '@/lib/proLaboreApi'
import type { AbaCopiloto } from '../page'
import { ESTAGIO } from './rotulos'

const GRUPOS: Array<{ valor: CpGrupoFila | ''; rotulo: string }> = [
  { valor: '', rotulo: 'Tudo' },
  { valor: 'WHATSAPP', rotulo: 'WhatsApp' },
  { valor: 'FOLLOW', rotulo: 'Follows' },
  { valor: 'COMPRA', rotulo: 'Sinais de compra' },
  { valor: 'CARTEIRA', rotulo: 'Carteira' },
]
const urgencia = (p: number) => (p >= 85 ? { classe: 'agora', rotulo: 'Agora' } : p >= 65 ? { classe: 'hoje', rotulo: 'Hoje' } : { classe: 'depois', rotulo: 'Quando der' })

// "Já fiz": some da fila por 4 horas neste navegador; volta antes se aparecer
// um motivo novo para o mesmo lead (a chave leva o motivo).
const CHAVE_OCULTOS = 'cp_fila_feitos'
const chaveDo = (i: CpItemFila) => `${i.chave}|${i.motivo.tipo}`
function lerOcultos(): Record<string, number> {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_OCULTOS) ?? '{}') as Record<string, number>
    const agora = Date.now()
    return Object.fromEntries(Object.entries(salvo).filter(([, ate]) => ate > agora))
  } catch { return {} }
}

export function Fila({ pessoa, irPara }: { pessoa?: string; irPara: (a: AbaCopiloto, conversaId?: string) => void }) {
  const [fila, setFila] = useState<CpFila | null>(null)
  const [erro, setErro] = useState('')
  const [grupo, setGrupo] = useState<CpGrupoFila | ''>('')
  const [todos, setTodos] = useState(false)
  const [ocultos, setOcultos] = useState<Record<string, number>>(() => (typeof window === 'undefined' ? {} : lerOcultos()))

  useEffect(() => {
    let cancelado = false
    const carregar = () => proLaboreApi.copiloto.fila(pessoa)
      .then(f => { if (!cancelado) { setFila(f); setErro('') } })
      .catch(e => { if (!cancelado) setErro((e as Error).message) })
    carregar()
    const t = setInterval(() => { if (!document.hidden) carregar() }, 60_000)
    return () => { cancelado = true; clearInterval(t) }
  }, [pessoa])

  function jaFiz(i: CpItemFila) {
    const novos = { ...lerOcultos(), [chaveDo(i)]: Date.now() + 4 * 3600e3 }
    setOcultos(novos)
    try { localStorage.setItem(CHAVE_OCULTOS, JSON.stringify(novos)) } catch { /* sem armazenamento */ }
  }

  if (erro && !fila) return <section className="cp-card"><div className="pl-alert pl-alert-error">{erro}</div></section>
  if (!fila) return <section className="cp-card cp-fila"><p className="cp-legenda">Montando a fila…</p></section>

  const visiveis = fila.itens.filter(i => !ocultos[chaveDo(i)])
  const doGrupo = grupo ? visiveis.filter(i => i.grupo === grupo) : visiveis
  const lista = todos ? doGrupo : doGrupo.slice(0, 6)
  const feitosAgora = fila.itens.length - visiveis.length

  return (
    <section className="cp-card cp-fila" aria-label="Quem atender agora" data-fila>
      <div className="cp-card-cab">
        <div>
          <h2>Quem atender agora</h2>
          <p className="cp-sub">Ao vivo, na ordem do que está mais perto da venda ou em risco: WhatsApp esperando, follows, sinais de compra e leads parados. Atualiza sozinha a cada minuto.</p>
        </div>
        {fila.urgentes > 0 && <span className="cp-selo erro" data-fila-urgentes>{fila.urgentes} para agora</span>}
      </div>

      <div className="cp-fila-filtros" role="group" aria-label="Filtrar a fila">
        {GRUPOS.map(g => {
          const n = g.valor ? fila.porGrupo[g.valor] : fila.total
          if (g.valor && !n) return null
          return (
            <button key={g.valor || 'tudo'} type="button" className={`pl-chip ${grupo === g.valor ? 'active' : ''}`} aria-pressed={grupo === g.valor} onClick={() => { setGrupo(g.valor); setTodos(false) }}>
              {g.rotulo} · {n}
            </button>
          )
        })}
      </div>

      {lista.length === 0 ? (
        <p className="cp-legenda" style={{ marginTop: 12 }}>{fila.total === 0 ? 'Nada pedindo ação agora. Bom momento para prospectar ou estudar.' : 'Nada pendente neste filtro.'}</p>
      ) : (
        <ol className="cp-fila-lista">
          {lista.map(i => {
            const u = urgencia(i.prioridade)
            const linkConversa = i.conversaId ? `/pro-labore/assistente?aba=whatsapp&conversa=${i.conversaId}` : null
            return (
              <li key={i.chave} className={`cp-fila-item ${u.classe}`} data-fila-item={i.motivo.tipo}>
                <span className={`cp-fila-urg ${u.classe}`} title={`Prioridade ${i.prioridade} de 100`}>{u.rotulo}</span>
                <div className="cp-fila-corpo">
                  <div className="cp-fila-quem">
                    <b>{i.nome}</b>
                    <span>{[i.estagio ? ESTAGIO[i.estagio] ?? i.estagio : 'Fora do CRM', i.modelo, i.vendedor].filter(Boolean).join(' · ')}</span>
                    {i.pontuacao != null && <span className="cp-fila-nota" title="Nota do assistente pela conversa do WhatsApp">nota {i.pontuacao}</span>}
                  </div>
                  <div className="cp-fila-motivo">{i.motivo.texto}</div>
                  <div className="cp-fila-passo">{i.passo}</div>
                  {i.sinais.length > 0 && <div className="cp-fila-sinais">{i.sinais.map(s => <span key={s}>{s}</span>)}</div>}
                </div>
                <div className="cp-fila-botoes">
                  {i.grupo === 'WHATSAPP' && i.conversaId && <button type="button" className="pl-btn pl-btn-primary" onClick={() => irPara('conversas', i.conversaId!)}>Responder</button>}
                  {i.leadId && <a className="pl-btn pl-btn-ghost" href={`/pro-labore/leads?lead=${i.leadId}`}>Abrir lead</a>}
                  {i.grupo !== 'WHATSAPP' && linkConversa && <a className="cp-link" href={linkConversa}>Ver a conversa</a>}
                  <button type="button" className="cp-link mudo" onClick={() => jaFiz(i)} title="Some da fila por 4 horas neste navegador">Já fiz</button>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <div className="cp-fila-rodape">
        {!todos && doGrupo.length > lista.length && <button type="button" className="cp-link" onClick={() => setTodos(true)}>Ver mais {doGrupo.length - lista.length}</button>}
        {fila.total > fila.itens.length && <span className="cp-legenda">Mostrando as {fila.itens.length} mais urgentes de {fila.total}.</span>}
        {feitosAgora > 0 && <button type="button" className="cp-link mudo" onClick={() => { setOcultos({}); try { localStorage.removeItem(CHAVE_OCULTOS) } catch { /* sem armazenamento */ } }}>Mostrar {feitosAgora} marcado{feitosAgora > 1 ? 's' : ''} como feito</button>}
      </div>
    </section>
  )
}
