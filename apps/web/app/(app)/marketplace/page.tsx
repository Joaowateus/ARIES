'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, ContaAnuncio, ResumoMarketplace } from '@/lib/api'

export default function MarketplacePage() {
  const [contas, setContas] = useState<ContaAnuncio[]>([])
  const [resumo, setResumo] = useState<ResumoMarketplace | null>(null)
  const [loading, setLoading] = useState(true)
  const [novaConta, setNovaConta] = useState('')
  const [registro, setRegistro] = useState({ contaId: '', quantidade: '1', produto: '' })
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => {
    Promise.all([api.marketplace.contas(), api.marketplace.resumo()])
      .then(([c, r]) => { setContas(c); setResumo(r); if (c.length && !registro.contaId) setRegistro(f => ({ ...f, contaId: c[0].id })) })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function criarConta(e: React.FormEvent) {
    e.preventDefault()
    if (!novaConta.trim()) return
    await api.marketplace.criarConta({ nome: novaConta })
    setNovaConta('')
    carregar()
  }

  async function registrarAnuncio(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!registro.contaId) { setErro('Cadastre uma conta primeiro'); return }
    try {
      await api.marketplace.registrarProducao({ contaId: registro.contaId, quantidade: Number(registro.quantidade) || 1, produto: registro.produto || undefined })
      setRegistro(f => ({ ...f, produto: '' }))
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar')
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando...</div>

  const pct = Math.round((resumo?.percentual ?? 0) * 100)

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Marketplace / Anúncios</h1>
        <p className="text-sm text-gray-500 mt-0.5">Meta semanal — 200 anúncios por conta cadastrada</p>
      </div>

      {/* Resumo semanal */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">Semana</span>
          <span className="text-sm font-medium text-gray-900">{resumo?.produzido ?? 0} / {resumo?.meta ?? 0}</span>
        </div>
        <div className="bg-gray-100 rounded-full h-3 mb-1">
          <div className={`h-3 rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : 'bg-orange-400'}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="text-xs text-gray-400">{pct}% da meta · restam {resumo?.restante ?? 0}</div>

        {(resumo?.porConta.length ?? 0) > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            {resumo?.porConta.map(c => (
              <div key={c.contaId} className="border border-gray-100 rounded-lg p-3">
                <div className="text-xs font-medium text-gray-700 truncate">{c.nome}</div>
                <div className="text-sm font-semibold text-gray-900">{c.produzido} / {c.meta}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contas */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 text-sm mb-3">Minhas Contas</h2>
        {contas.length === 0 && <p className="text-sm text-gray-400 mb-3">Nenhuma conta cadastrada ainda.</p>}
        <div className="flex flex-wrap gap-2 mb-3">
          {contas.map(c => <span key={c.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{c.nome}</span>)}
        </div>
        <form onSubmit={criarConta} className="flex gap-2">
          <input value={novaConta} onChange={e => setNovaConta(e.target.value)} placeholder="Ex: Conta 01"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">Adicionar</button>
        </form>
      </div>

      {/* Registrar anúncio */}
      <form onSubmit={registrarAnuncio} className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-900 text-sm">Registrar anúncio</h2>
        <div className="grid grid-cols-3 gap-3">
          <select value={registro.contaId} onChange={e => setRegistro(f => ({ ...f, contaId: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <input value={registro.produto} onChange={e => setRegistro(f => ({ ...f, produto: e.target.value }))} placeholder="Produto (opcional)"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" min="1" value={registro.quantidade} onChange={e => setRegistro(f => ({ ...f, quantidade: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        {erro && <div className="text-xs text-red-600">{erro}</div>}
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Registrar</button>
      </form>
    </div>
  )
}
