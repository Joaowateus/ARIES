'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { proLaboreApi, ProLaboreUsuario, getUsuario, setUsuario, setToken, clearToken } from './proLaboreApi'

interface ProLaboreAuthCtx {
  usuario: ProLaboreUsuario | null
  loading: boolean
  login: (email: string, senha: string) => Promise<void>
  logout: () => void
}

const ProLaboreAuthContext = createContext<ProLaboreAuthCtx | null>(null)

export function ProLaboreAuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuarioState] = useState<ProLaboreUsuario | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const cached = getUsuario()
    if (cached) {
      setUsuarioState(cached)
      proLaboreApi.auth.me().then(u => {
        setUsuarioState(u)
        setUsuario(u)
      }).catch(() => {
        clearToken()
        setUsuarioState(null)
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function login(email: string, senha: string) {
    const { token, usuario: u } = await proLaboreApi.auth.login(email, senha)
    setToken(token)
    setUsuario(u)
    setUsuarioState(u)
    router.push('/pro-labore')
  }

  function logout() {
    clearToken()
    setUsuarioState(null)
    router.push('/pro-labore/login')
  }

  return (
    <ProLaboreAuthContext.Provider value={{ usuario, loading, login, logout }}>
      {children}
    </ProLaboreAuthContext.Provider>
  )
}

export function useProLaboreAuth() {
  const ctx = useContext(ProLaboreAuthContext)
  if (!ctx) throw new Error('useProLaboreAuth fora do ProLaboreAuthProvider')
  return ctx
}
