'use client'

// Toast com desfazer (seção 2.4). Toda ação executável do espaço do Social
// Media mostra o resultado aqui, com "Desfazer" por 5 segundos quando a
// ação tem volta.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { IcFechar } from './icones'

export interface OpcoesToast {
  mensagem: string
  tom?: 'normal' | 'bad'
  /** Se vier, aparece o botão "Desfazer" enquanto o toast estiver na tela. */
  desfazer?: () => void | Promise<void>
  duracaoMs?: number
}

interface ToastAtivo extends OpcoesToast { id: number; duracaoMs: number }

const ToastCtx = createContext<((o: OpcoesToast) => void) | null>(null)

export const DURACAO_DESFAZER_MS = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastAtivo[]>([])
  const proximo = useRef(1)

  const fechar = useCallback((id: number) => setToasts(l => l.filter(t => t.id !== id)), [])
  const mostrar = useCallback((o: OpcoesToast) => {
    const id = proximo.current++
    // No máximo 3 na tela: o mais antigo sai primeiro.
    setToasts(l => [...l.slice(-2), { ...o, id, duracaoMs: o.duracaoMs ?? DURACAO_DESFAZER_MS }])
  }, [])

  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div className="sm-toasts" aria-live="polite" aria-relevant="additions">
        {toasts.map(t => <ItemToast key={t.id} toast={t} aoFechar={() => fechar(t.id)} />)}
      </div>
    </ToastCtx.Provider>
  )
}

function ItemToast({ toast, aoFechar }: { toast: ToastAtivo; aoFechar: () => void }) {
  const [pausado, setPausado] = useState(false)
  const [desfazendo, setDesfazendo] = useState(false)
  const restante = useRef(toast.duracaoMs)
  const inicio = useRef(0)

  useEffect(() => {
    if (pausado) return
    inicio.current = Date.now()
    const t = setTimeout(aoFechar, restante.current)
    return () => { clearTimeout(t); restante.current -= Date.now() - inicio.current }
  }, [pausado, aoFechar])

  async function desfazer() {
    if (!toast.desfazer || desfazendo) return
    setDesfazendo(true)
    try { await toast.desfazer() } finally { aoFechar() }
  }

  return (
    <div
      className={`sm-toast ${toast.tom === 'bad' ? 'bad' : ''}`}
      role={toast.tom === 'bad' ? 'alert' : 'status'}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <div className="sm-toast-msg">
        {toast.mensagem}
        {toast.desfazer && (
          <div
            className="sm-toast-tempo"
            aria-hidden="true"
            style={{ animationDuration: `${toast.duracaoMs}ms`, animationPlayState: pausado ? 'paused' : 'running', marginTop: 6 }}
          />
        )}
      </div>
      {toast.desfazer && (
        <button type="button" className="sm-btn" onClick={desfazer} disabled={desfazendo}>
          {desfazendo ? 'Desfazendo…' : 'Desfazer'}
        </button>
      )}
      <button type="button" className="sm-btn fantasma icone" style={{ width: 36, minHeight: 36 }} aria-label="Fechar aviso" onClick={aoFechar}>
        <IcFechar tamanho={16} />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast fora do ToastProvider (envolva com <SmApp>)')
  return ctx
}
