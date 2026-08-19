'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { api, Usuario, getUser, setUser, setToken, clearToken } from './api'

interface AuthCtx {
  user: Usuario | null
  loading: boolean
  login: (email: string, senha: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const cached = getUser()
    if (cached) {
      setUsuario(cached)
      api.auth.me().then(u => {
        setUsuario(u)
        setUser(u)
      }).catch(() => {
        clearToken()
        setUsuario(null)
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function login(email: string, senha: string) {
    const { token, usuario } = await api.auth.login(email, senha)
    setToken(token)
    setUser(usuario)
    setUsuario(usuario)
    const papeisGestao = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL', 'SUPERVISOR', 'COORDENADOR']
    router.push(papeisGestao.includes(usuario.papel) ? '/dashboard' : '/meu-painel')
  }

  function logout() {
    clearToken()
    setUsuario(null)
    router.push('/login')
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}

export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function ProtectedComponent(props: P) {
    const { user, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!loading && !user) router.push('/login')
    }, [user, loading, router])

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Carregando...</div>
    if (!user) return null
    return <Component {...props} />
  }
}
