'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, ConteudoSocialMedia, ResumoSocialMedia } from '@/lib/api'

const TIPOS = ['STORY', 'REELS', 'POST', 'VIDEO', 'FOTO', 'OFERTA', 'EDUCATIVO', 'COMERCIAL']

export default function SocialMediaPage() {
  const [conteudos, setConteudos] = useState<ConteudoSocialMedia[]>([])
  const [resumo, setResumo] = useState<ResumoSocialMedia | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ tipo: 'POST', plataforma: 'Instagram', link: '', status: 'PUBLICADO' })

  const carregar = useCallback(() => {
    Promise.all([api.socialMedia.listar(), api.socialMedia.resumo()])
      .then(([c, r]) => { setConteudos(c); setResumo(r) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    await api.socialMedia.criar({ ...form, link: form.link || undefined })
    setForm(f => ({ ...f, link: '' }))
    setShowForm(false)
    carregar()
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Social Media</h1>
          <p className="text-sm text-gray-500 mt-0.5">Produção de conteúdo desta semana</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          {showForm ? 'Cancelar' : '+ Novo Conteúdo'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Produzidos" value={resumo?.produzido ?? 0} />
        <Stat label="Publicados" value={resumo?.publicado ?? 0} />
        <Stat label="Leads Gerados" value={resumo?.leadsGerados ?? 0} />
        <Stat label="Vendas Originadas" value={resumo?.vendasOriginadas ?? 0} />
      </div>

      {showForm && (
        <form onSubmit={salvar} className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={form.plataforma} onChange={e => setForm(f => ({ ...f, plataforma: e.target.value }))} placeholder="Plataforma"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} placeholder="Link (opcional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">Registrar</button>
        </form>
      )}

      {conteudos.length === 0 ? (
        <div className="text-center py-16"><div className="text-4xl mb-3">📱</div><h3 className="font-medium text-gray-900">Nenhum conteúdo registrado ainda</h3></div>
      ) : (
        <div className="space-y-2">
          {conteudos.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">{c.tipo} · {c.plataforma}</div>
                <div className="text-xs text-gray-400">{c.usuario?.nome} · {new Date(c.data).toLocaleDateString('pt-BR')}</div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}
