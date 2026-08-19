'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, Processo } from '@/lib/api'
import { useAuth } from '@/lib/auth'

export default function ProcessosPage() {
  const { user } = useAuth()
  const [processos, setProcessos] = useState<Processo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ nome: '', departamento: '', objetivo: '', fluxoTexto: '', ferramentasTexto: '' })

  const podeGerenciar = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL'].includes(user?.papel ?? '')

  const carregar = useCallback(() => {
    api.processos.listar().then(setProcessos).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await api.processos.criar({
        nome: form.nome,
        departamento: form.departamento || undefined,
        objetivo: form.objetivo || undefined,
        fluxo: form.fluxoTexto.split('\n').map(s => s.trim()).filter(Boolean),
        ferramentas: form.ferramentasTexto.split('\n').map(s => s.trim()).filter(Boolean),
      })
      setForm({ nome: '', departamento: '', objetivo: '', fluxoTexto: '', ferramentasTexto: '' })
      setShowForm(false)
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Processos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Desenho operacional por departamento — objetivo, fluxo, ferramentas e vínculo com protocolos</p>
        </div>
        {podeGerenciar && (
          <button onClick={() => setShowForm(s => !s)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            {showForm ? 'Cancelar' : '+ Novo Processo'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={salvar} className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required placeholder="Nome do processo"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input value={form.departamento} onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))} placeholder="Departamento"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <textarea value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} placeholder="Objetivo" rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <div>
            <label className="text-xs text-gray-500">Fluxo (um passo por linha)</label>
            <textarea value={form.fluxoTexto} onChange={e => setForm(f => ({ ...f, fluxoTexto: e.target.value }))} rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Ferramentas (uma por linha)</label>
            <textarea value={form.ferramentasTexto} onChange={e => setForm(f => ({ ...f, ferramentasTexto: e.target.value }))} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          {erro && <div className="text-xs text-red-600">{erro}</div>}
          <button type="submit" disabled={salvando} className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {salvando ? 'Salvando...' : 'Criar Processo'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-gray-400">Carregando...</div>
      ) : processos.length === 0 ? (
        <div className="text-center py-16"><div className="text-4xl mb-3">🗺️</div><h3 className="font-medium text-gray-900">Nenhum processo cadastrado</h3></div>
      ) : (
        <div className="space-y-3">
          {processos.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="font-medium text-gray-900">{p.nome}</div>
              {p.departamento && <div className="text-xs text-gray-400 mt-0.5">{p.departamento}</div>}
              {p.objetivo && <p className="text-sm text-gray-600 mt-2">{p.objetivo}</p>}
              {p.fluxo && p.fluxo.length > 0 && (
                <ol className="text-sm text-gray-600 mt-3 space-y-1 list-decimal list-inside">
                  {p.fluxo.map((f, i) => <li key={i}>{f}</li>)}
                </ol>
              )}
              {p.protocolo && (
                <div className="text-xs text-gray-400 mt-3">Protocolo vinculado: {p.protocolo.nome}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
