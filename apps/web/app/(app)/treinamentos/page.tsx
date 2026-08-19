'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, TreinamentoComProgresso, ProgressoEquipeTreinamento } from '@/lib/api'
import { useAuth } from '@/lib/auth'

const NIVEL_EQUIPE = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL', 'SUPERVISOR', 'COORDENADOR']

export default function TreinamentosPage() {
  const { user } = useAuth()
  const [itens, setItens] = useState<TreinamentoComProgresso[]>([])
  const [equipe, setEquipe] = useState<ProgressoEquipeTreinamento[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome: '', categoria: '', link: '', videoUrl: '' })

  const podeGerenciar = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL'].includes(user?.papel ?? '')
  const veEquipe = NIVEL_EQUIPE.includes(user?.papel ?? '')

  const carregar = useCallback(() => {
    api.treinamentos.progresso().then(setItens).finally(() => setLoading(false))
    if (veEquipe) api.treinamentos.progressoEquipe().then(setEquipe)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veEquipe])

  useEffect(() => { carregar() }, [carregar])

  async function marcar(treinamentoId: string, status: string) {
    await api.treinamentos.atualizarProgresso(treinamentoId, { status, percentual: status === 'CONCLUIDO' ? 100 : 50 })
    carregar()
  }

  async function criarTreinamento(e: React.FormEvent) {
    e.preventDefault()
    await api.treinamentos.criar({ ...form, link: form.link || undefined, videoUrl: form.videoUrl || undefined })
    setForm({ nome: '', categoria: '', link: '', videoUrl: '' })
    setShowForm(false)
    carregar()
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Treinamentos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Disponíveis para o seu papel</p>
        </div>
        {podeGerenciar && (
          <button onClick={() => setShowForm(s => !s)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            {showForm ? 'Cancelar' : '+ Novo Treinamento'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={criarTreinamento} className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required placeholder="Nome"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Categoria"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <input value={form.videoUrl} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} placeholder="Link do vídeo (opcional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} placeholder="Outro link / material (opcional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">Criar</button>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-gray-400">Carregando...</div>
      ) : itens.length === 0 ? (
        <div className="text-center py-16"><div className="text-4xl mb-3">🎓</div><h3 className="font-medium text-gray-900">Nenhum treinamento disponível ainda</h3></div>
      ) : (
        <div className="space-y-3 mb-8">
          {itens.map(({ treinamento, progresso }) => (
            <div key={treinamento.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{treinamento.nome}</div>
                  {treinamento.categoria && <div className="text-xs text-gray-400">{treinamento.categoria}</div>}
                  <div className="flex gap-3 mt-1">
                    {treinamento.videoUrl && <a href={treinamento.videoUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Vídeo</a>}
                    {treinamento.link && <a href={treinamento.link} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Material</a>}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${progresso.status === 'CONCLUIDO' ? 'bg-green-100 text-green-700' : progresso.status === 'INICIADO' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                    {progresso.status}
                  </span>
                  <div className="mt-2 flex gap-2">
                    {progresso.status !== 'CONCLUIDO' && (
                      <>
                        {progresso.status === 'DISPONIVEL' && (
                          <button onClick={() => marcar(treinamento.id, 'INICIADO')} className="text-xs text-blue-600 hover:underline">Iniciar</button>
                        )}
                        <button onClick={() => marcar(treinamento.id, 'CONCLUIDO')} className="text-xs text-green-600 hover:underline">Concluir</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {veEquipe && equipe && equipe.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 text-sm mb-3">Progresso da Equipe</h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {equipe.map(e => (
              <div key={e.usuario.id} className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-800">{e.usuario.nome}</span>
                <span className="text-sm font-medium text-gray-900">{Math.round(e.percentual * 100)}% concluído ({e.concluidos}/{e.total})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
