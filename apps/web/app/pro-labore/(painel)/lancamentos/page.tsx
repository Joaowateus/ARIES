'use client'

import { useEffect, useState, useCallback } from 'react'
import { proLaboreApi, FaturamentoSemanal } from '@/lib/proLaboreApi'
import { formatMoeda, formatPct } from '@/lib/format'

export default function ProLaboreLancamentosPage() {
  const [faturamentos, setFaturamentos] = useState<FaturamentoSemanal[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [form, setForm] = useState({ data: '', valorBruto: '', observacao: '' })

  const carregar = useCallback(() => {
    proLaboreApi.faturamentos.listar().then(setFaturamentos).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const valorBruto = Number(form.valorBruto)
      if (editandoId) {
        await proLaboreApi.faturamentos.editar(editandoId, { valorBruto, observacao: form.observacao || undefined })
      } else {
        await proLaboreApi.faturamentos.criar({ data: form.data, valorBruto, observacao: form.observacao || undefined })
      }
      setForm({ data: '', valorBruto: '', observacao: '' })
      setEditandoId(null)
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar lançamento')
    } finally {
      setSalvando(false)
    }
  }

  function editar(f: FaturamentoSemanal) {
    setEditandoId(f.id)
    setForm({ data: f.referenciaSemana.slice(0, 10), valorBruto: String(f.valorBruto), observacao: f.observacao ?? '' })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm({ data: '', valorBruto: '', observacao: '' })
  }

  async function remover(id: string) {
    if (!confirm('Remover este lançamento?')) return
    await proLaboreApi.faturamentos.remover(id)
    if (editandoId === id) cancelarEdicao()
    carregar()
  }

  function formatSemana(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Lançamentos Semanais</h1>
        <p className="text-sm text-gray-500 mt-0.5">Registre o faturamento bruto da sua operação a cada semana</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">{editandoId ? 'Editar lançamento' : 'Novo lançamento'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data (qualquer dia da semana)</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Faturamento bruto (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.valorBruto}
              onChange={e => setForm(f => ({ ...f, valorBruto: e.target.value }))}
              placeholder="0,00"
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação (opcional)</label>
            <input
              type="text"
              value={form.observacao}
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              placeholder="Ex: semana de promoção"
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
            {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Lançar faturamento'}
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
      ) : faturamentos.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📆</div>
          <h3 className="font-medium text-gray-900">Nenhum lançamento ainda</h3>
          <p className="text-sm text-gray-500 mt-1">Registre o faturamento da semana acima para começar a acompanhar sua liquidez</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Semana</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Bruto</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Pró-labore líquido</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Liquidez</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Observação</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {faturamentos.map(f => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{formatSemana(f.referenciaSemana)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatMoeda(f.valorBruto)}</td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatMoeda(f.valorLiquido)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatPct(f.valorBruto > 0 ? f.valorLiquido / f.valorBruto : 0)}</td>
                  <td className="px-4 py-3 text-gray-500">{f.observacao || '—'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => editar(f)} className="text-xs text-blue-600 hover:underline mr-3">Editar</button>
                    <button onClick={() => remover(f.id)} className="text-xs text-red-600 hover:underline">Remover</button>
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
