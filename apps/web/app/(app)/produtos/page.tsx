'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, Produto } from '@/lib/api'

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState({ nome: '', marca: '', modelo: '', ano: '', precoBase: '' })

  const carregar = useCallback(() => {
    api.produtos.listar().then(setProdutos).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await api.produtos.criar({
        nome: form.nome,
        categoria: 'MOTO',
        marca: form.marca || undefined,
        modelo: form.modelo || undefined,
        ano: form.ano ? Number(form.ano) : undefined,
        precoBase: form.precoBase ? Number(form.precoBase) : undefined,
      })
      setForm({ nome: '', marca: '', modelo: '', ano: '', precoBase: '' })
      setShowForm(false)
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function remover(id: string) {
    if (!confirm('Remover este produto?')) return
    await api.produtos.remover(id)
    carregar()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Motos / Produtos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{produtos.length} produto{produtos.length !== 1 ? 's' : ''} cadastrado{produtos.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Cancelar' : '+ Nova Moto'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={salvar} className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Cadastrar Moto</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome / Identificação *</label>
            <input
              type="text"
              value={form.nome}
              onChange={e => set('nome', e.target.value)}
              required
              placeholder="ex: Honda CG 160 Titan 2024"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <input type="text" value={form.marca} onChange={e => set('marca', e.target.value)} placeholder="Honda"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
              <input type="text" value={form.modelo} onChange={e => set('modelo', e.target.value)} placeholder="CG 160"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
              <input type="number" value={form.ano} onChange={e => set('ano', e.target.value)} placeholder="2024"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preço base (R$)</label>
            <input type="number" value={form.precoBase} onChange={e => set('precoBase', e.target.value)} placeholder="0,00"
              min="0" step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {erro && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{erro}</div>}
          <button type="submit" disabled={salvando}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {salvando ? 'Salvando...' : 'Salvar Moto'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-gray-400">Carregando...</div>
      ) : produtos.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🏍️</div>
          <h3 className="font-medium text-gray-900 mb-1">Nenhuma moto cadastrada</h3>
          <p className="text-sm text-gray-500">Cadastre as motos do seu estoque para vincular às oportunidades</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Marca / Modelo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ano</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Preço Base</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {produtos.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.nome}</td>
                  <td className="px-4 py-3 text-gray-600">{[p.marca, p.modelo].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.ano ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {p.precoBase ? p.precoBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remover(p.id)} className="text-xs text-red-500 hover:text-red-700">Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
