'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, Produto } from '@/lib/api'

const SITUACAO_COR: Record<string, string> = {
  DISPONIVEL: 'bg-green-100 text-green-700',
  RESERVADA: 'bg-yellow-100 text-yellow-700',
  VENDIDA: 'bg-gray-100 text-gray-500',
  INATIVO: 'bg-red-100 text-red-700',
}

const SITUACAO_LABEL: Record<string, string> = {
  DISPONIVEL: 'Disponível',
  RESERVADA: 'Reservada',
  VENDIDA: 'Vendida',
  INATIVO: 'Inativa',
}

export default function EstoquePage() {
  const [unidades, setUnidades] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState({
    nome: '', marca: '', modelo: '', ano: '', cor: '',
    chassi: '', placa: '', km: '0', precoBase: '',
  })

  const carregar = useCallback(() => {
    api.produtos.listar(filtro || undefined).then(setUnidades).finally(() => setLoading(false))
  }, [filtro])

  useEffect(() => { carregar() }, [carregar])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function nomeAuto() {
    const parts = [form.marca, form.modelo, form.ano, form.cor].filter(Boolean)
    if (parts.length > 0 && !form.nome) {
      setForm(f => ({ ...f, nome: parts.join(' ') }))
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await api.produtos.criar({
        nome: form.nome || [form.marca, form.modelo, form.ano, form.cor].filter(Boolean).join(' '),
        categoria: 'MOTO',
        marca: form.marca || undefined,
        modelo: form.modelo || undefined,
        ano: form.ano ? Number(form.ano) : undefined,
        cor: form.cor || undefined,
        chassi: form.chassi || undefined,
        placa: form.placa || undefined,
        km: form.km ? Number(form.km) : 0,
        precoBase: form.precoBase ? Number(form.precoBase) : undefined,
      })
      setForm({ nome: '', marca: '', modelo: '', ano: '', cor: '', chassi: '', placa: '', km: '0', precoBase: '' })
      setShowForm(false)
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const disponiveis = unidades.filter(u => u.situacao === 'DISPONIVEL').length
  const reservadas = unidades.filter(u => u.situacao === 'RESERVADA').length
  const vendidas = unidades.filter(u => u.situacao === 'VENDIDA').length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Estoque</h1>
          <div className="flex gap-4 mt-1 text-sm">
            <span className="text-green-700 font-medium">{disponiveis} disponíveis</span>
            <span className="text-yellow-600 font-medium">{reservadas} reservadas</span>
            <span className="text-gray-500">{vendidas} vendidas</span>
          </div>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          {showForm ? 'Cancelar' : '+ Entrada de Moto'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={salvar} className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Cadastrar Moto no Estoque</h2>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Marca</label>
              <input type="text" value={form.marca} onChange={e => set('marca', e.target.value)} onBlur={nomeAuto} placeholder="Honda"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Modelo</label>
              <input type="text" value={form.modelo} onChange={e => set('modelo', e.target.value)} onBlur={nomeAuto} placeholder="CG 160 Titan"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ano</label>
              <input type="number" value={form.ano} onChange={e => set('ano', e.target.value)} onBlur={nomeAuto} placeholder="2024"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cor</label>
              <input type="text" value={form.cor} onChange={e => set('cor', e.target.value)} onBlur={nomeAuto} placeholder="Vermelho"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome completo (gerado automaticamente ou edite)</label>
            <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)} required placeholder="Honda CG 160 Titan 2024 Vermelho"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Chassi</label>
              <input type="text" value={form.chassi} onChange={e => set('chassi', e.target.value)} placeholder="9BWHE21J..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Placa</label>
              <input type="text" value={form.placa} onChange={e => set('placa', e.target.value.toUpperCase())} placeholder="ABC-1D23"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">KM</label>
              <input type="number" value={form.km} onChange={e => set('km', e.target.value)} min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Preço (R$)</label>
              <input type="number" value={form.precoBase} onChange={e => set('precoBase', e.target.value)} min="0" step="0.01" placeholder="14490"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {erro && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-3">{erro}</div>}
          <button type="submit" disabled={salvando}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {salvando ? 'Salvando...' : 'Adicionar ao Estoque'}
          </button>
        </form>
      )}

      {/* Filtro */}
      <div className="flex gap-2 mb-4">
        {['', 'DISPONIVEL', 'RESERVADA', 'VENDIDA'].map(s => (
          <button key={s} onClick={() => setFiltro(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtro === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {s ? SITUACAO_LABEL[s] : 'Todas'}
          </button>
        ))}
      </div>

      {loading ? <div className="text-sm text-gray-400">Carregando...</div> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Moto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Chassi / Placa</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">KM</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Situação</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Preço</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {unidades.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{u.nome}</div>
                    {u.cor && <div className="text-xs text-gray-400">{u.cor}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                    <div>{u.chassi ?? '—'}</div>
                    <div>{u.placa ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.km?.toLocaleString('pt-BR') ?? 0} km</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${SITUACAO_COR[u.situacao]}`}>
                      {SITUACAO_LABEL[u.situacao]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {u.precoBase ? u.precoBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
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
