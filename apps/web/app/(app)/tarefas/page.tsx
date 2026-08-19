'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, Tarefa, Usuario } from '@/lib/api'
import { useAuth } from '@/lib/auth'

const PRIORIDADE_COR: Record<string, string> = {
  BAIXA: 'bg-gray-100 text-gray-600',
  NORMAL: 'bg-blue-100 text-blue-700',
  ALTA: 'bg-orange-100 text-orange-700',
  URGENTE: 'bg-red-100 text-red-700',
}

const STATUS_OPCOES = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'ATRASADA', 'CANCELADA']

export default function TarefasPage() {
  const { user } = useAuth()
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState({ titulo: '', descricao: '', responsavelId: '', prazo: '', prioridade: 'NORMAL' })

  const carregar = useCallback(() => {
    api.tarefas.listar().then(setTarefas).finally(() => setLoading(false))
    api.usuarios.listar().then(setUsuarios)
  }, [])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { if (user) setForm(f => ({ ...f, responsavelId: user.id })) }, [user])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await api.tarefas.criar({ ...form, prazo: form.prazo ? new Date(form.prazo).toISOString() : undefined })
      setForm({ titulo: '', descricao: '', responsavelId: user?.id ?? '', prazo: '', prioridade: 'NORMAL' })
      setShowForm(false)
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function mudarStatus(id: string, status: string) {
    await api.tarefas.atualizarStatus(id, status)
    carregar()
  }

  const pendentes = tarefas.filter(t => t.status !== 'CONCLUIDA' && t.status !== 'CANCELADA')
  const concluidas = tarefas.filter(t => t.status === 'CONCLUIDA' || t.status === 'CANCELADA')

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tarefas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? 'Cancelar' : '+ Nova Tarefa'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={salvar} className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-3">
          <input value={form.titulo} onChange={e => set('titulo', e.target.value)} required placeholder="O que precisa ser feito?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Detalhes (opcional)" rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <div className="grid grid-cols-3 gap-3">
            <select value={form.responsavelId} onChange={e => set('responsavelId', e.target.value)} required
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}{u.id === user?.id ? ' (eu)' : ''}</option>)}
            </select>
            <input type="date" value={form.prazo} onChange={e => set('prazo', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <select value={form.prioridade} onChange={e => set('prioridade', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              {['BAIXA', 'NORMAL', 'ALTA', 'URGENTE'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {erro && <div className="text-xs text-red-600">{erro}</div>}
          <button type="submit" disabled={salvando} className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {salvando ? 'Salvando...' : 'Criar Tarefa'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-gray-400">Carregando...</div>
      ) : tarefas.length === 0 ? (
        <div className="text-center py-16"><div className="text-4xl mb-3">✅</div><h3 className="font-medium text-gray-900">Nenhuma tarefa por aqui</h3></div>
      ) : (
        <div className="space-y-2">
          {[...pendentes, ...concluidas].map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={t.status === 'CONCLUIDA'}
                  onChange={() => mudarStatus(t.id, t.status === 'CONCLUIDA' ? 'PENDENTE' : 'CONCLUIDA')}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <div>
                  <div className={`text-sm font-medium ${t.status === 'CONCLUIDA' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{t.titulo}</div>
                  <div className="text-xs text-gray-400">
                    {t.responsavel?.nome} {t.prazo && `· prazo ${new Date(t.prazo).toLocaleDateString('pt-BR')}`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${PRIORIDADE_COR[t.prioridade]}`}>{t.prioridade}</span>
                <select value={t.status} onChange={e => mudarStatus(t.id, e.target.value)} className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white">
                  {STATUS_OPCOES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
