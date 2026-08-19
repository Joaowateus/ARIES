'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, AuditoriaGenerica, ResumoAuditoriaArea, PlanoAcaoGenerico } from '@/lib/api'

const ENTIDADES = [
  { value: 'CRM', label: 'CRM' },
  { value: 'ROTINA', label: 'Rotina' },
  { value: 'ANUNCIO', label: 'Anúncios' },
  { value: 'CONTEUDO', label: 'Conteúdo' },
  { value: 'TREINAMENTO', label: 'Treinamento' },
  { value: 'PROCESSO', label: 'Processo' },
]

function pct(v: number) { return `${Math.round(v * 100)}%` }

export default function AuditoriasPage() {
  const [resumo, setResumo] = useState<ResumoAuditoriaArea[]>([])
  const [auditorias, setAuditorias] = useState<AuditoriaGenerica[]>([])
  const [planos, setPlanos] = useState<PlanoAcaoGenerico[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ entidadeTipo: 'CRM', entidadeId: '', conforme: 'true', observacoes: '' })

  const carregar = useCallback(() => {
    Promise.all([api.auditorias.resumo(), api.auditorias.listar(), api.auditorias.planosAcao()])
      .then(([r, a, p]) => { setResumo(r); setAuditorias(a); setPlanos(p) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    await api.auditorias.criar({ ...form, conforme: form.conforme === 'true' })
    setForm(f => ({ ...f, entidadeId: '', observacoes: '' }))
    setShowForm(false)
    carregar()
  }

  async function mudarStatusPlano(id: string, status: string) {
    await api.auditorias.atualizarStatusPlano(id, status)
    carregar()
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Auditorias</h1>
          <p className="text-sm text-gray-500 mt-0.5">Conformidade por área (últimos 90 dias)</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? 'Cancelar' : '+ Nova Auditoria'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {resumo.length === 0 ? (
          <p className="text-sm text-gray-400 col-span-3">Nenhuma auditoria registrada nos últimos 90 dias.</p>
        ) : resumo.map(r => (
          <div key={r.entidadeTipo} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500">{ENTIDADES.find(e => e.value === r.entidadeTipo)?.label ?? r.entidadeTipo}</div>
            <div className={`text-2xl font-bold ${r.percentualConformidade >= 0.9 ? 'text-green-600' : r.percentualConformidade >= 0.75 ? 'text-amber-600' : 'text-red-600'}`}>
              {pct(r.percentualConformidade)}
            </div>
            <div className="text-xs text-gray-400">{r.total} auditoria{r.total !== 1 ? 's' : ''}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={salvar} className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <select value={form.entidadeTipo} onChange={e => setForm(f => ({ ...f, entidadeTipo: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              {ENTIDADES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
            <input value={form.entidadeId} onChange={e => setForm(f => ({ ...f, entidadeId: e.target.value }))} required placeholder="ID do item auditado"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <select value={form.conforme} onChange={e => setForm(f => ({ ...f, conforme: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="true">Conforme</option>
              <option value="false">Não conforme</option>
            </select>
          </div>
          <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Observações" rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">Registrar</button>
        </form>
      )}

      <h2 className="font-semibold text-gray-900 text-sm mb-3">Últimas auditorias</h2>
      {auditorias.length === 0 ? (
        <p className="text-sm text-gray-400 mb-8">Nenhuma auditoria registrada.</p>
      ) : (
        <div className="space-y-2 mb-8">
          {auditorias.slice(0, 20).map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-900">{ENTIDADES.find(e => e.value === a.entidadeTipo)?.label} — {a.entidadeId}</div>
                <div className="text-xs text-gray-400">{a.responsavel?.nome} · {new Date(a.data).toLocaleDateString('pt-BR')}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.conforme ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {a.conforme ? 'Conforme' : 'Não conforme'}
              </span>
            </div>
          ))}
        </div>
      )}

      <h2 className="font-semibold text-gray-900 text-sm mb-3">Planos de Ação</h2>
      {planos.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum plano de ação aberto.</p>
      ) : (
        <div className="space-y-2">
          {planos.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-900">{p.problema}</div>
                <div className="text-xs text-gray-400">{p.responsavel?.nome ?? 'Sem responsável'} {p.prazo && `· prazo ${new Date(p.prazo).toLocaleDateString('pt-BR')}`}</div>
              </div>
              <select value={p.status} onChange={e => mudarStatusPlano(p.id, e.target.value)} className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white">
                {['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'ATRASADO'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
