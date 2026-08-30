'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { proLaboreApi } from '@/lib/proLaboreApi'

export default function ProLaboreLoginPage() {
  const { login } = useProLaboreAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    proLaboreApi.auth.status()
      .then(({ existeUsuario }) => {
        if (!existeUsuario) router.replace('/pro-labore/setup')
      })
      .finally(() => setVerificando(false))
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      await login(email, senha)
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  if (verificando) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="pl-brand-mark" style={{ margin: '0 auto 14px', width: 52, height: 52, borderRadius: 15 }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 26, height: 26 }}><path d="M3 17L9 11L13 15L21 6" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /><path d="M15 6H21V12" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h1 style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 22, margin: 0 }}>Pró-Labore</h1>
          <p style={{ color: 'var(--pl-ink-muted)', fontSize: 13, marginTop: 4 }}>Liquidez da sua operação, no seu bolso</p>
        </div>

        <form onSubmit={handleSubmit} className="pl-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="pl-card-title">Entrar</div>
          <div className="pl-field">
            <label>Email</label>
            <input type="email" className="pl-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
          </div>
          <div className="pl-field">
            <label>Senha</label>
            <input type="password" className="pl-input" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" required />
          </div>
          {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
          <button type="submit" className="pl-btn pl-btn-primary" disabled={loading} style={{ width: '100%' }}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  )
}
