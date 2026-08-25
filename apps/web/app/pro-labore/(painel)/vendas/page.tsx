'use client'

import { useEffect, useState, useCallback } from 'react'
import { proLaboreApi, Venda, ParametroLiquidez } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'

export default function ProLaboreVendasPage() {
  const [vendas, setVendas] = useState<Venda[]>([])
  const [parametro, setParametro] = useState<ParametroLiquidez | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [form, setForm] = useState({ data: '', valorVenda: '', valorProLabore: '', observacao: '' })

  const carregar = useCallback(() => {
    Promise.all([proLaboreApi.vendas.listar(), proLaboreApi.parametros.get()])
      .then(([v, p]) => { setVendas(v); setParametro(p) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function atualizarValorVenda(valor: string) {
    const numero = Number(valor)
    const teto = parametro?.tetoProLaborePorVenda ?? 900
    const sugestao = Number.isFinite(numero) && numero > 0 ? Math.min(numero, teto) : teto
    setForm(f => ({ ...f, valorVenda: valor, valorProLabore: editandoId ? f.valorProLabore : String(sugestao) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const valorVenda = Number(form.valorVenda)
      const valorProLabore = Number(form.valorProLabore)
      if (editandoId) {
        await proLaboreApi.vendas.editar(editandoId, { valorVenda, valorProLabore, observacao: form.observacao || undefined })
      } else {
        await proLaboreApi.vendas.criar({ data: form.data, valorVenda, valorProLabore, observacao: form.observacao || undefined })
      }
      setForm({ data: '', valorVenda: '', valorProLabore: '', observacao: '' })
      setEditandoId(null)
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar venda')
    } finally {
      setSalvando(false)
    }
  }

  function editar(v: Venda) {
    setEditandoId(v.id)
    setForm({
      data: v.data.slice(0, 10),
      valorVenda: String(v.valorVenda),
      valorProLabore: String(v.valorProLabore),
      observacao: v.observacao ?? '',
    })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm({ data: '', valorVenda: '', valorProLabore: '', observacao: '' })
  }

  async function remover(id: string) {
    if (!confirm('Remover esta venda?')) return
    await proLaboreApi.vendas.remover(id)
    if (editandoId === id) cancelarEdicao()
    carregar()
  }

  function formatData(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const teto = parametro?.tetoProLaborePorVenda ?? 900

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Vendas</h1>
        <p className="text-sm text-gray-500 mt-0.5">Registre cada venda e quanto de pró-labore você sacou dela (teto: {formatMoeda(teto)})</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">{editandoId ? 'Editar venda' : 'Nova venda'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data da venda</label>
            <input
              type="date"
              value={form.data}
              onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
              required
              disabled={!!editandoId}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor da venda (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.valorVenda}
              onChange={e => atualizarValorVenda(e.target.value)}
              placeholder="0,00"
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pró-labore sacado (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={teto}
              value={form.valorProLabore}
              onChange={e => setForm(f => ({ ...f, valorProLabore: e.target.value }))}
              placeholder="0,00"
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">Máximo {formatMoeda(teto)} por venda</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação (opcional)</label>
            <input
              type="text"
              value={form.observacao}
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              placeholder="Ex: cliente / modelo"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">{erro}</div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={salvando}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Registrar venda'}
          </button>
          {editandoId && (
            <button type="button" onClick={cancelarEdicao} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 border border-gray-300">
              Cancelar
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <div className="text-sm text-gray-400">Carregando...</div>
      ) : vendas.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🏍️</div>
          <h3 className="font-medium text-gray-900">Nenhuma venda ainda</h3>
          <p className="text-sm text-gray-500 mt-1">Registre a primeira venda acima para começar a acompanhar seu pró-labore</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Data</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor da venda</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Pró-labore sacado</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Ficou no caixa</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Observação</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vendas.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{formatData(v.data)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatMoeda(v.valorVenda)}</td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatMoeda(v.valorProLabore)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatMoeda(v.valorVenda - v.valorProLabore)}</td>
                  <td className="px-4 py-3 text-gray-500">{v.observacao || '—'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => editar(v)} className="text-xs text-blue-600 hover:underline mr-3">Editar</button>
                    <button onClick={() => remover(v.id)} className="text-xs text-red-600 hover:underline">Remover</button>
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
