'use client'

// Modo guiado do Funil (19/11), por pessoa: guardado nas preferências do
// servidor (PreferenciaProLabore, dados.modoGuiado; vale em qualquer aparelho).
// Sem escolha feita, o padrão é pelo papel: ligado para SDR e vendedor,
// desligado para dono e supervisor. Se o servidor não responder, fica no navegador.
import { useCallback, useEffect, useState } from 'react'
import { proLaboreApi } from '@/lib/proLaboreApi'

export const guiadoPadrao = (papel: string | undefined) => papel === 'SDR' || papel === 'VENDEDOR'
const EVENTO = 'pl-modo-guiado'
const local = (): boolean | null => { try { const v = localStorage.getItem('pl_modo_guiado'); return v == null ? null : v === '1' } catch { return null } }

export function useModoGuiado(papel: string | undefined): [boolean, (v: boolean) => void] {
  const [ligado, setLigado] = useState(() => guiadoPadrao(papel))
  useEffect(() => {
    let vivo = true
    proLaboreApi.preferencias.obter()
      .then(p => { if (vivo) setLigado(typeof p.modoGuiado === 'boolean' ? p.modoGuiado : local() ?? guiadoPadrao(papel)) })
      .catch(() => { if (vivo) setLigado(local() ?? guiadoPadrao(papel)) })
    const ouvir = (e: Event) => setLigado((e as CustomEvent<boolean>).detail)
    window.addEventListener(EVENTO, ouvir)
    return () => { vivo = false; window.removeEventListener(EVENTO, ouvir) }
  }, [papel])
  const mudar = useCallback((v: boolean) => {
    setLigado(v)
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: v }))
    try { localStorage.setItem('pl_modo_guiado', v ? '1' : '0') } catch { /* sem armazenamento */ }
    void proLaboreApi.preferencias.salvar({ modoGuiado: v }).catch(() => undefined)
  }, [])
  return [ligado, mudar]
}
