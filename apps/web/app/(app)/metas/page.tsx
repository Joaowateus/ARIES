'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, MetaComProgresso, Usuario } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatMoeda } from '@/lib/format'
import ProgressBar from '@/components/ui/ProgressBar'

const PERIODOS = [
  { value: 'DIARIA', label: 'Diária' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'MENSAL', label: 'Mensal' },
]

const TIPOS = [
  { value: 'QUANTIDADE', label: 'Quantidade de vendas' },
  { value: 'FATURAMENTO', label: 'Faturamento (R$)' },
]

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function MetasPage() {
  const { user } = useAuth()
  const [metas, setMetas] = useState<MetaComProgresso[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState({
    titulo: '', tipo: 'QUANTIDADE', valor: '', periodo: 'MENSAL',
    inicioEm: hojeISO(), fimEm: hojeISO(), usuarioId: '',
  })

  const podeGerenciar = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL'].includes(user?.papel ?? '')

  const carregar = useCallback(() => {
    api.metas.progresso('todas').then(setMetas).finally(() => setLoading(false))
    api.usuarios.listar().then(setUsuarios)
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
      await api.metas.criar({
        ...form,
        valor: Number(form.valor),
        inicioEm: new Date(form.inicioEm).toISOString(),
        fimEm: new Date(form.fimEm + 'T23:59:59').toISOString(),
        usuarioId: form.usuarioId || null,
      })
      setForm({ titulo: '', tipo: 'QUANTIDADE', valor: '', periodo: 'MENSAL', inicioEm: hojeISO(), fimEm: hojeISO(), usuarioId: '' })
      setShowForm(false)
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function encerrar(id: string) {
    await api.metas.encerrar(id)
    carregar()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Metas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Metas por período — da operação como um todo ou de um colaborador específico</p>
        </div>
        {podeGerenciar && (
          <button
            onClick={() => setShowForm(s => !s)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {showForm ? 'Cancelar' : '+ Nova Meta'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={salvar} className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Nova meta</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input type="text" value={form.titulo} onChange={e => set('titulo', e.target.value)} required
              placeholder="Ex: Meta de vendas do mês"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
              <input type="number" value={form.valor} onChange={e => set('valor', e.target.value)} required min="1" step="any"
                placeholder={form.tipo === 'FATURAMENTO' ? 'Ex: 400000' : 'Ex: 30'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
              <select value={form.periodo} onChange={e => set('periodo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Início *</label>
              <input type="date" value={form.inicioEm} onChange={e => set('inicioEm', e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fim *</label>
              <input type="date" value={form.fimEm} onChange={e => set('fimEm', e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Atribuir a</label>
            <select value={form.usuarioId} onChange={e => set('usuarioId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Toda a operação (meta da empresa)</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
          {erro && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{erro}</div>}
          <button type="submit" disabled={salvando}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {salvando ? 'Salvando...' : 'Criar Meta'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-gray-400">Carregando...</div>
      ) : metas.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🎯</div>
          <h3 className="font-medium text-gray-900">Nenhuma meta cadastrada</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metas.map(m => {
            const pct = Math.round(m.percentual * 100)
            return (
              <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-medium text-gray-900">{m.titulo}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {PERIODOS.find(p => p.value === m.periodo)?.label} · {new Date(m.inicioEm).toLocaleDateString('pt-BR')} a {new Date(m.fimEm).toLocaleDateString('pt-BR')}
                      {' · '}
                      {m.usuarioId ? (usuarios.find(u => u.id === m.usuarioId)?.nome ?? 'Colaborador') : 'Toda a operação'}
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${m.status === 'ATIVA' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {m.status === 'ATIVA' ? 'Ativa' : 'Encerrada'}
                  </span>
                </div>
                <div className="mb-1"><ProgressBar percentual={m.percentual} /></div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {m.tipo === 'FATURAMENTO' ? formatMoeda(m.realizado) : m.realizado} de {m.tipo === 'FATURAMENTO' ? formatMoeda(m.valor) : m.valor} ({pct}%)
                  </span>
                  {podeGerenciar && m.status === 'ATIVA' && (
                    <button onClick={() => encerrar(m.id)} className="text-xs text-gray-500 hover:text-red-600">
                      Encerrar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
