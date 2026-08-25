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
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Carregando...</div>
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 mb-4">
            <span className="text-white font-bold text-xl">₽</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pró-Labore</h1>
          <p className="text-gray-500 mt-1 text-sm">Configuração inicial da sua conta</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Criar sua conta</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seu nome *</label>
              <input
                type="text"
                value={form.nome}
                onChange={e => update('nome', e.target.value)}
                placeholder="Nome Sobrenome"
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="voce@email.com"
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
              <input
                type="password"
                value={form.senha}
                onChange={e => update('senha', e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Criando...' : 'Criar minha conta'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Já tem uma conta?{' '}
          <Link href="/pro-labore/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
