'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, Contrato } from '@/lib/api'
import Link from 'next/link'

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(() => {
    api.contratos.listar().then(setContratos).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const totalReceita = contratos.reduce((s, c) => s + c.valorTotal, 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contratos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {contratos.length} contrato{contratos.length !== 1 ? 's' : ''}
            {totalReceita > 0 && ` · ${totalReceita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em vendas`}
          </p>
        </div>
        <Link href="/contratos/nova"
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
          ✅ Fechar Venda
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Carregando...</div>
      ) : contratos.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📄</div>
          <h3 className="font-medium text-gray-900 mb-1">Nenhuma venda fechada ainda</h3>
          <p className="text-sm text-gray-500 mb-4">Quando uma venda for fechada, o contrato aparecerá aqui</p>
          <Link href="/contratos/nova" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
            Fechar Primeira Venda
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Moto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Vendedor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Parcelas</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor Total</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contratos.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{c.nomeCliente}</div>
                    {c.telefoneCliente && <div className="text-xs text-gray-400">{c.telefoneCliente}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.unidade?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.vendedor?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.entrada > 0 && (
                      <div className="text-xs text-gray-500">Entrada: {c.entrada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                    )}
                    <div>{c.parcelas}x de {((c.valorTotal - c.entrada) / c.parcelas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {c.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      c.status === 'ATIVO' ? 'bg-green-100 text-green-700' :
                      c.status === 'CANCELADO' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {c.status === 'ATIVO' ? 'Ativo' : c.status === 'CANCELADO' ? 'Cancelado' : 'Encerrado'}
                    </span>
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
