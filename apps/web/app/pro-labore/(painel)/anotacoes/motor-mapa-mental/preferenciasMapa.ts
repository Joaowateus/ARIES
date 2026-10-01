'use client'

// Preferências do mapa mental de quem está usando (guardadas no servidor):
// a formatação padrão das ideias novas e se tudo que a pessoa escolhe no
// painel de texto vira o padrão. Carrega uma vez por sessão de login.
import { useCallback, useEffect, useState } from 'react'
import { proLaboreApi, type PreferenciasProLabore } from '@/lib/proLaboreApi'

let cache: { token: string | null; prefs: Promise<PreferenciasProLabore> } | null = null
const tokenAtual = () => { try { return localStorage.getItem('pro_labore_token') } catch { return null } }

function carregar(): Promise<PreferenciasProLabore> {
  const token = tokenAtual()
  if (!cache || cache.token !== token) cache = { token, prefs: proLaboreApi.preferencias.obter().catch(() => ({})) }
  return cache.prefs
}

export function usePreferenciasMapa() {
  const [prefs, setPrefs] = useState<PreferenciasProLabore | null>(null)
  useEffect(() => {
    let vivo = true
    void carregar().then(p => { if (vivo) setPrefs(p) })
    return () => { vivo = false }
  }, [])
  const salvar = useCallback((patch: { [K in keyof PreferenciasProLabore]?: PreferenciasProLabore[K] | null }) => {
    const aplicar = (p: PreferenciasProLabore | null) => {
      const novo: Record<string, unknown> = { ...(p ?? {}) }
      for (const [k, v] of Object.entries(patch)) { if (v === null) delete novo[k]; else if (v !== undefined) novo[k] = v }
      return novo as PreferenciasProLabore
    }
    setPrefs(aplicar)
    const token = tokenAtual()
    const anterior = cache?.token === token ? cache.prefs : Promise.resolve({})
    cache = { token, prefs: anterior.then(aplicar) }
    void proLaboreApi.preferencias.salvar(patch).catch(() => {})
  }, [])
  return { prefs, salvar }
}
