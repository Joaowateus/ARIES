'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { proLaboreApi } from '@/lib/proLaboreApi'
import { AriesBrandMark } from '../AriesBrandMark'

export default function ProLaboreRecuperarPage() {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ codigo: '', nome: '', email: '', senha: '' })

  function update(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso('')
    setLoading(true)
    try {
      const { email } = await proLaboreApi.auth.recuperar({
        codigo: form.codigo,
        email: form.email,
        senha: form.senha,
        ...(form.nome.trim() ? { nome: form.nome.trim() } : {}),
      })
      setSucesso(`Conta atualizada. Novo email de acesso: ${email}. Redirecionando para o login...`)
      setTimeout(() => router.push('/pro-labore/login'), 2500)
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao recuperar acesso')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ margin: '0 auto 14px', display: 'flex', justifyContent: 'center' }}>
            <AriesBrandMark size={52} />
          </div>
          <h1 style={{ fontFamily: 'Sora', fontWeight: 700, fontSize: 22, margin: 0 }}>Pró-Labore</h1>
          <p style={{ color: 'var(--pl-ink-muted)', fontSize: 13, marginTop: 4 }}>Recuperar acesso à sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="pl-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="pl-card-title">Definir novo email e senha</div>
            <p className="pl-hint" style={{ marginTop: 6 }}>
              Seus dados (vendas, vendedores, etc.) não são apagados — só o login é redefinido. Precisa do código de recuperação configurado no servidor.
            </p>
          </div>
          <div className="pl-field">
            <label>Código de recuperação</label>
            <input type="password" className="pl-input" value={form.codigo} onChange={e => update('codigo', e.target.value)} placeholder="Definido em PRO_LABORE_RECOVERY_SECRET" required />
          </div>
          <div className="pl-field">
            <label>Seu nome (opcional)</label>
            <input type="text" className="pl-input" value={form.nome} onChange={e => update('nome', e.target.value)} placeholder="Deixe em branco pra manter o atual" />
          </div>
          <div className="pl-field">
            <label>Novo email</label>
            <input type="email" className="pl-input" value={form.email} onChange={e => update('email', e.target.value)} placeholder="voce@email.com" required />
          </div>
          <div className="pl-field">
            <label>Nova senha</label>
            <input type="password" className="pl-input" value={form.senha} onChange={e => update('senha', e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
          </div>
          {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
          {sucesso && <div className="pl-alert pl-alert-success">{sucesso}</div>}
          <button type="submit" className="pl-btn pl-btn-primary" disabled={loading} style={{ width: '100%' }}>{loading ? 'Atualizando...' : 'Redefinir acesso'}</button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--pl-ink-muted)', marginTop: 20 }}>
          <Link href="/pro-labore/login" style={{ color: 'var(--pl-accent)', fontWeight: 600 }}>Voltar para o login</Link>
        </p>
      </div>
    </div>
  )
}
