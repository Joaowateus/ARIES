'use client'

// ARIES — kit visual do sistema (nasceu no redesign do Disparo, 26/11/2026; vale para todas as abas).
// Confirmação e aviso próprios (no lugar das janelas do navegador), interruptor, seletor segmentado,
// horário em 24 h, menu de ações e datas relativas. Só aparência: nenhuma regra de negócio mora aqui.
// O provedor (AriesUi) fica no layout do painel: qualquer tela usa useConfirmar/usePerguntar/useAvisar.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

// ---------- Confirmação (modal) e aviso (toast) ----------

export interface PedidoConfirmacao {
  titulo: string
  texto?: ReactNode
  /** Rótulo do botão que confirma (ex.: "Excluir"). */
  acao: string
  /** Ação destrutiva: botão vermelho. */
  perigo?: boolean
  /** Pede um texto (ex.: motivo da devolução): o resultado vem em useConfirmar().texto. */
  campo?: { rotulo: string; minimo?: number }
}
type Aviso = { id: number; texto: string; tom: 'ok' | 'erro' | 'info' }
const UiCtx = createContext<{ confirmar: (p: PedidoConfirmacao) => Promise<boolean>; perguntar: (p: PedidoConfirmacao & { campo: NonNullable<PedidoConfirmacao['campo']> }) => Promise<string | null>; avisar: (texto: string, tom?: Aviso['tom']) => void } | null>(null)

/** Confirmação na própria tela: devolve true se a pessoa confirmou. */
export function useConfirmar() {
  const c = useContext(UiCtx)
  return c?.confirmar ?? (async (p: PedidoConfirmacao) => window.confirm(`${p.titulo}${typeof p.texto === 'string' ? `\n\n${p.texto}` : ''}`))
}
/** Pergunta com um campo de texto (ex.: motivo): devolve o texto ou null se a pessoa voltou. */
export function usePerguntar() {
  const c = useContext(UiCtx)
  return c?.perguntar ?? (async (p: PedidoConfirmacao) => window.prompt(p.titulo))
}
/** Aviso curto no canto da tela (some sozinho em 4 s). */
export function useAvisar() {
  return useContext(UiCtx)?.avisar ?? (() => undefined)
}

export function AriesUi({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<(PedidoConfirmacao & { resolver: (v: boolean, texto?: string) => void }) | null>(null)
  const [texto, setTexto] = useState('')
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const seq = useRef(0)
  const confirmar = useCallback((p: PedidoConfirmacao) => new Promise<boolean>(resolver => { setTexto(''); setPedido({ ...p, resolver: v => resolver(v) }) }), [])
  const perguntar = useCallback((p: PedidoConfirmacao & { campo: NonNullable<PedidoConfirmacao['campo']> }) => new Promise<string | null>(resolver => { setTexto(''); setPedido({ ...p, resolver: (v, t) => resolver(v ? (t ?? '') : null) }) }), [])
  const avisar = useCallback((texto: string, tom: Aviso['tom'] = 'ok') => {
    const id = ++seq.current
    setAvisos(a => [...a.slice(-2), { id, texto, tom }])
    setTimeout(() => setAvisos(a => a.filter(x => x.id !== id)), 4000)
  }, [])
  const fechar = (v: boolean) => { pedido?.resolver(v, texto.trim()); setPedido(null) }
  const faltaTexto = !!pedido?.campo && texto.trim().length < (pedido.campo.minimo ?? 1)
  const botao = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!pedido) return
    if (!pedido.campo) botao.current?.focus()
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { pedido.resolver(false); setPedido(null) } }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [pedido])
  const valor = useMemo(() => ({ confirmar, perguntar, avisar }), [confirmar, perguntar, avisar])
  return (
    <UiCtx.Provider value={valor}>
      {children}
      {pedido && (
        <div className="dp-modal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(false) }}>
          <div className="dp-modal" role="alertdialog" aria-modal="true" aria-labelledby="dp-modal-titulo" data-confirmacao>
            <h3 id="dp-modal-titulo">{pedido.titulo}</h3>
            {pedido.texto && <div className="dp-modal-texto">{pedido.texto}</div>}
            {pedido.campo && <label className="dp-modal-campo"><span>{pedido.campo.rotulo}</span><textarea className="pl-input" rows={3} autoFocus value={texto} onChange={e => setTexto(e.target.value)} /></label>}
            <div className="dp-modal-acoes">
              <button type="button" className="pl-btn pl-btn-ghost" onClick={() => fechar(false)}>Voltar</button>
              <button ref={botao} type="button" className={`pl-btn ${pedido.perigo ? 'pl-btn-perigo-cheio' : 'pl-btn-primary'}`} disabled={faltaTexto} onClick={() => fechar(true)} data-confirmar>{pedido.acao}</button>
            </div>
          </div>
        </div>
      )}
      <div className="dp-toasts" aria-live="polite">
        {avisos.map(a => <div key={a.id} className={`dp-toast ${a.tom}`} role="status"><i aria-hidden="true" />{a.texto}</div>)}
      </div>
    </UiCtx.Provider>
  )
}

// ---------- Controles ----------

/** Interruptor (liga/desliga) no lugar da caixa de seleção do navegador. */
export function Interruptor({ ligado, mudar, rotulo, detalhe, desabilitado, id }: { ligado: boolean; mudar: (v: boolean) => void; rotulo: ReactNode; detalhe?: ReactNode; desabilitado?: boolean; id?: string }) {
  return (
    <label className={`dp-interruptor ${desabilitado ? 'off' : ''}`} data-interruptor={id}>
      <button type="button" role="switch" aria-checked={ligado} disabled={desabilitado} className={`dp-sw ${ligado ? 'on' : ''}`} onClick={() => mudar(!ligado)}><span /></button>
      <span><b>{rotulo}</b>{detalhe && <small>{detalhe}</small>}</span>
    </label>
  )
}

/** Escolha de uma opção entre poucas (período, canal, finalidade). */
export function Segmentado<T extends string | number>({ valor, opcoes, mudar, rotulo, pequeno }: { valor: T; opcoes: Array<{ valor: T; rotulo: ReactNode; titulo?: string }>; mudar: (v: T) => void; rotulo?: string; pequeno?: boolean }) {
  return (
    <div className={`dp-seg ${pequeno ? 'p' : ''}`} role="radiogroup" aria-label={rotulo}>
      {opcoes.map(o => <button key={String(o.valor)} type="button" role="radio" aria-checked={valor === o.valor} className={valor === o.valor ? 'on' : ''} title={o.titulo} onClick={() => mudar(o.valor)}>{o.rotulo}</button>)}
    </div>
  )
}

/** Horário em 24 h (HH:MM), igual em qualquer navegador. */
export function Hora({ valor, mudar, rotulo, id }: { valor: string; mudar: (v: string) => void; rotulo: string; id?: string }) {
  const [texto, setTexto] = useState(valor)
  const [antes, setAntes] = useState(valor)
  if (valor !== antes) { setAntes(valor); setTexto(valor) }
  const confirmar = (t: string) => {
    const d = t.replace(/\D/g, '').slice(0, 4)
    const h = Math.min(23, Number(d.slice(0, d.length > 2 ? d.length - 2 : d.length) || 0))
    const m = d.length > 2 ? Math.min(59, Number(d.slice(-2))) : 0
    const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    setTexto(v)
    if (v !== valor) mudar(v)
  }
  return <input id={id} className="pl-input dp-hora" inputMode="numeric" aria-label={rotulo} value={texto} maxLength={5} placeholder="00:00" onChange={e => setTexto(e.target.value)} onBlur={e => confirmar(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') confirmar((e.target as HTMLInputElement).value) }} />
}

// ---------- Menu de ações (⋯) ----------

export interface ItemMenu { rotulo: string; aoClicar: () => void; perigo?: boolean; desabilitado?: boolean }
/** Ações menos usadas (e as destrutivas) num menu, para a ação principal ficar à vista. */
export function MenuAcoes({ itens, rotulo = 'Mais ações' }: { itens: Array<ItemMenu | false | null | undefined>; rotulo?: string }) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false) }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', fora); window.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', fora); window.removeEventListener('keydown', tecla) }
  }, [aberto])
  const lista = itens.filter(Boolean) as ItemMenu[]
  if (!lista.length) return null
  return (
    <div className="dp-menu" ref={caixa}>
      <button type="button" className="pl-btn" aria-haspopup="menu" aria-expanded={aberto} aria-label={rotulo} title={rotulo} onClick={() => setAberto(a => !a)} data-menu-acoes>⋯</button>
      {aberto && (
        <div className="dp-menu-lista" role="menu">
          {lista.map(i => <button key={i.rotulo} type="button" role="menuitem" className={i.perigo ? 'perigo' : ''} disabled={i.desabilitado} onClick={() => { setAberto(false); i.aoClicar() }}>{i.rotulo}</button>)}
        </div>
      )}
    </div>
  )
}

// ---------- Datas ----------

const FUSO = 'America/Sao_Paulo'
const diaDe = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: FUSO })
const horaDe = (d: Date) => d.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' })
/** "agora", "há 5 min", "hoje 14:02", "ontem 19:39", "25/11 19:39", "25/11/25". */
export function quandoTexto(iso: string | null | undefined, agora = new Date()): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const s = (agora.getTime() - d.getTime()) / 1000
  if (s >= 0 && s < 45) return 'agora'
  if (s >= 0 && s < 3600) return `há ${Math.max(1, Math.round(s / 60))} min`
  if (diaDe(d) === diaDe(agora)) return `hoje ${horaDe(d)}`
  const ontem = new Date(agora.getTime() - 86_400_000)
  if (diaDe(d) === diaDe(ontem)) return `ontem ${horaDe(d)}`
  const amanha = new Date(agora.getTime() + 86_400_000)
  if (diaDe(d) === diaDe(amanha)) return `amanhã ${horaDe(d)}`
  if (Math.abs(s) < 300 * 86_400) return `${d.toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' })} ${horaDe(d)}`
  return d.toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: '2-digit' })
}
/** Data relativa com a data completa ao passar o mouse. */
export function Quando({ iso, prefixo }: { iso: string | null | undefined; prefixo?: string }) {
  if (!iso) return <span>—</span>
  return <time dateTime={iso} title={new Date(iso).toLocaleString('pt-BR', { timeZone: FUSO })} className="dp-quando">{prefixo ? `${prefixo} ` : ''}{quandoTexto(iso)}</time>
}

/** Nome antigo (Disparo). */
export const DisparoUi = AriesUi
