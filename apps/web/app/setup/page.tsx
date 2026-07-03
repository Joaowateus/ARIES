'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, setToken, setUser } from '@/lib/api'
import Link from 'next/link'

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    empresa: { nome: '', cnpj: '', segmento: 'motos' },
    admin: { nome: '', email: '', senha: '' },
  })

  function update(section: 'empresa' | 'admin', field: string, value: string) {
    setForm(f => ({ ...f, [section]: { ...f[section], [field]: value } }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step === 1) { setStep(2); return }

    setErro('')
    setLoading(true)
    try {
      const { token, usuario } = await api.empresa.setup(form) as { token: string; usuario: { id: string; nome: string; email: string; papel: string; empresaId: string } }
      setToken(token)
      setUser(usuario)
      router.push('/dashboard')
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao configurar empresa')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4">
            <span className="text-white font-bold text-xl">A</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ARIES</h1>
          <p className="text-gray-500 mt-1 text-sm">Configuração inicial</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* Steps */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
            <div className={`flex-1 h-0.5 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
          </div>

          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {step === 1 ? 'Dados da empresa' : 'Criar conta de administrador'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome da empresa *</label>
                  <input
                    type="text"
                    value={form.empresa.nome}
                    onChange={e => update('empresa', 'nome', e.target.value)}
                    placeholder="Aries Negócios"
                    required
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ (opcional)</label>
                  <input
                    type="text"
                    value={form.empresa.cnpj}
                    onChange={e => update('empresa', 'cnpj', e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seu nome *</label>
                  <input
                    type="text"
                    value={form.admin.nome}
                    onChange={e => update('admin', 'nome', e.target.value)}
                    placeholder="Nome Sobrenome"
                    required
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={form.admin.email}
                    onChange={e => update('admin', 'email', e.target.value)}
                    placeholder="admin@empresa.com"
                    required
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
                  <input
                    type="password"
                    value={form.admin.senha}
                    onChange={e => update('admin', 'senha', e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
                {erro}
              </div>
            )}

            <div className="flex gap-3">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  Voltar
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {step === 1 ? 'Próximo' : loading ? 'Criando...' : 'Criar empresa'}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Já tem uma conta?{' '}
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
