'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, Oportunidade } from '@/lib/api'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ESTAGIO_COR, ESTAGIO_LABEL } from '@/lib/funil'

export default function OportunidadesPage() {
  const router = useRouter()
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstagio, setFiltroEstagio] = useState('')

  const carregar = useCallback(() => {
    const params = filtroEstagio ? { estagio: filtroEstagio } : undefined
    api.oportunidades.listar(params).then(setOportunidades).finally(() => setLoading(false))
  }, [filtroEstagio])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Oportunidades</h1>
          <p className="text-sm text-gray-500 mt-0.5">{oportunidades.length} resultado{oportunidades.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/oportunidades/nova"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Novo Lead
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFiltroEstagio('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!filtroEstagio ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          Todos
        </button>
        {Object.entries(ESTAGIO_LABEL).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFiltroEstagio(id === filtroEstagio ? '' : id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtroEstagio === id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Carregando...</div>
      ) : oportunidades.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🎯</div>
          <h3 className="font-medium text-gray-900 mb-1">Nenhuma oportunidade ainda</h3>
          <p className="text-sm text-gray-500 mb-4">Cadastre o primeiro lead para começar</p>
          <Link href="/oportunidades/nova" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Cadastrar Lead
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estágio</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Produto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Responsável</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Próxima ação</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {oportunidades.map(op => {
                const atrasado = op.proximaAcaoEm && new Date(op.proximaAcaoEm) < new Date()
                return (
                <tr key={op.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/oportunidades/${op.id}`)}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{op.nomeCliente}</div>
                    {op.telefone && <div className="text-xs text-gray-400">{op.telefone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ESTAGIO_COR[op.estagio]}`}>
                      {ESTAGIO_LABEL[op.estagio]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{op.unidade?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{op.responsavel?.nome ?? '—'}</td>
                  <td className="px-4 py-3">
                    {op.proximaAcaoEm ? (
                      <span className={`text-xs ${atrasado ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {atrasado ? '⚠ ' : ''}{new Date(op.proximaAcaoEm).toLocaleDateString('pt-BR')}
                      </span>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {op.valor ? op.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
