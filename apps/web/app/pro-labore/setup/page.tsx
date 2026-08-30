'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { proLaboreApi, setToken, setUsuario } from '@/lib/proLaboreApi'

export default function ProLaboreSetupPage() {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificando, setVerificando] = useState(true)
  const [form, setForm] = useState({ nome: '', email: '', senha: '' })

  useEffect(() => {
    proLaboreApi.auth.status()
      .then(({ existeUsuario }) => {
        if (existeUsuario) router.replace('/pro-labore/login')
      })
      .finally(() => setVerificando(false))
  }, [router])

  function update(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const { token, usuario } = await proLaboreApi.auth.setup(form)
      setToken(token)
      setUsuario(usuario)
      router.push('/pro-labore')
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao configurar')
    } finally {
      setLoading(false)
    }
  }

  if (verificando) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="pl-brand-mark" style={{ margin: '0 auto 14px', width: 52, height: 52, borderRadius: 15 }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 26, height: 26 }}><path d="M3 17L9 11L13 15L21 6" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /><path d="M15 6H21V12" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h1 style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 22, margin: 0 }}>Pró-Labore</h1>
          <p style={{ color: 'var(--pl-ink-muted)', fontSize: 13, marginTop: 4 }}>Configuração inicial da sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="pl-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="pl-card-title">Criar sua conta</div>
          <div className="pl-field">
            <label>Seu nome</label>
            <input type="text" className="pl-input" value={form.nome} onChange={e => update('nome', e.target.value)} placeholder="Nome Sobrenome" required />
          </div>
          <div className="pl-field">
            <label>Email</label>
            <input type="email" className="pl-input" value={form.email} onChange={e => update('email', e.target.value)} placeholder="voce@email.com" required />
          </div>
          <div className="pl-field">
            <label>Senha</label>
            <input type="password" className="pl-input" value={form.senha} onChange={e => update('senha', e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
          </div>
          {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
          <button type="submit" className="pl-btn pl-btn-primary" disabled={loading} style={{ width: '100%' }}>{loading ? 'Criando...' : 'Criar minha conta'}</button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--pl-ink-muted)', marginTop: 20 }}>
          Já tem uma conta?{' '}
          <Link href="/pro-labore/login" style={{ color: 'var(--pl-accent)', fontWeight: 600 }}>Entrar</Link>
        </p>
      </div>
    </div>
  )
}
