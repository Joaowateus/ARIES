'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, ContaReceber } from '@/lib/api'

type ContaComContrato = ContaReceber & {
  contrato: { id: string; nomeCliente: string; unidade?: { nome: string } }
}

const STATUS_COR: Record<string, string> = {
  PENDENTE: 'bg-blue-100 text-blue-700',
  PAGO: 'bg-green-100 text-green-700',
  ATRASADO: 'bg-red-100 text-red-700',
  CANCELADO: 'bg-gray-100 text-gray-500',
}

export default function FinanceiroPage() {
  const [contas, setContas] = useState<ContaComContrato[]>([])
  const [resumo, setResumo] = useState<{
    totalRecebido: number; totalPendente: number; totalAtrasado: number
    contasAtrasadas: number; receitaMes: number; previsaoMes: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [baixando, setBaixando] = useState<string | null>(null)

  const carregar = useCallback(() => {
    Promise.all([
      api.financeiro.contasReceber(filtro || undefined),
      api.financeiro.resumo(),
    ]).then(([c, r]) => {
      setContas(c)
      setResumo(r)
    }).finally(() => setLoading(false))
  }, [filtro])

  useEffect(() => { carregar() }, [carregar])

  async function baixar(id: string, valor: number) {
    setBaixando(id)
    try {
      await api.financeiro.baixar(id, valor)
      carregar()
    } finally {
      setBaixando(null)
    }
  }

  function formatMoeda(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function formatData(s: string) {
    return new Date(s).toLocaleDateString('pt-BR')
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Financeiro</h1>
        <p className="text-sm text-gray-500 mt-0.5">Contas a receber e baixas de pagamentos</p>
      </div>

      {/* KPIs */}
      {resumo && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-1">Recebido no mês</div>
            <div className="text-2xl font-bold text-green-700">{formatMoeda(resumo.receitaMes)}</div>
            <div className="text-xs text-gray-400 mt-0.5">Previsão: {formatMoeda(resumo.previsaoMes)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-1">Total a receber</div>
            <div className="text-2xl font-bold text-blue-700">{formatMoeda(resumo.totalPendente)}</div>
            <div className="text-xs text-gray-400 mt-0.5">Total recebido: {formatMoeda(resumo.totalRecebido)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-1">Em atraso</div>
            <div className={`text-2xl font-bold ${resumo.totalAtrasado > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {formatMoeda(resumo.totalAtrasado)}
            </div>
            {resumo.contasAtrasadas > 0 && (
              <div className="text-xs text-red-500 mt-0.5">{resumo.contasAtrasadas} parcela{resumo.contasAtrasadas > 1 ? 's' : ''} em atraso</div>
            )}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        {[
          { value: '', label: 'Todas' },
          { value: 'PENDENTE', label: 'Pendentes' },
          { value: 'ATRASADO', label: 'Atrasadas' },
          { value: 'PAGO', label: 'Pagas' },
        ].map(f => (
          <button key={f.value} onClick={() => setFiltro(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtro === f.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Carregando...</div>
      ) : contas.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">💰</div>
          <h3 className="font-medium text-gray-900">Nenhuma conta encontrada</h3>
          <p className="text-sm text-gray-500 mt-1">As contas a receber aparecem após fechar uma venda</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Parcela</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Vencimento</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contas.map(c => (
                <tr key={c.id} className={`hover:bg-gray-50 ${c.status === 'ATRASADO' ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{c.contrato.nomeCliente}</div>
                    {c.contrato.unidade && <div className="text-xs text-gray-400">{c.contrato.unidade.nome}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.descricao}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className={c.status === 'ATRASADO' ? 'text-red-600 font-medium' : ''}>
                      {formatData(c.vencimento)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatMoeda(c.valor)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COR[c.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {c.status === 'PENDENTE' ? 'Pendente' : c.status === 'PAGO' ? 'Pago' : c.status === 'ATRASADO' ? 'Atrasado' : c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {['PENDENTE', 'ATRASADO'].includes(c.status) && (
                      <button
                        disabled={baixando === c.id}
                        onClick={() => baixar(c.id, c.valor)}
                        className="text-xs bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 px-3 py-1 rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {baixando === c.id ? 'Registrando...' : 'Dar Baixa'}
                      </button>
                    )}
                    {c.status === 'PAGO' && c.pagoEm && (
                      <span className="text-xs text-gray-400">Pago em {formatData(c.pagoEm)}</span>
                    )}
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
