'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, Oportunidade, MetaFunilEtapa } from '@/lib/api'
import Link from 'next/link'
import { COLUNAS_KANBAN, ESTAGIO_VENDA_FECHADA } from '@/lib/funil'

const COLUNAS = COLUNAS_KANBAN

export default function CrmPage() {
  const router = useRouter()
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [metasSla, setMetasSla] = useState<MetaFunilEtapa[]>([])
  const [loading, setLoading] = useState(true)
  const [movendo, setMovendo] = useState<string | null>(null)

  const carregar = useCallback(() => {
    api.oportunidades.listar().then(setOportunidades).finally(() => setLoading(false))
    api.funil.metas().then(setMetasSla)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function mover(id: string, estagio: string) {
    setMovendo(id)
    try {
      await api.oportunidades.moverEstagio(id, estagio)
      carregar()
    } finally {
      setMovendo(null)
    }
  }

  const por = (estagio: string) => oportunidades.filter(o => o.estagio === estagio)

  if (loading) return <div className="p-8 text-gray-400 text-sm">Carregando CRM...</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">CRM</h1>
          <p className="text-sm text-gray-500 mt-0.5">{oportunidades.length} cliente{oportunidades.length !== 1 ? 's' : ''} na jornada de compra</p>
        </div>
        <Link
          href="/oportunidades/nova"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Novo Lead
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUNAS.map(col => {
          const itens = por(col.id)
          return (
            <div key={col.id} className={`shrink-0 w-56 rounded-xl border ${col.cor} flex flex-col`}>
              <div className="px-3 py-2.5 border-b border-inherit">
                <div className="text-xs font-semibold text-gray-700">{col.label}</div>
                <div className="text-xs text-gray-400">{itens.length} cliente{itens.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="flex-1 p-2 space-y-2 min-h-32">
                {itens.map(op => {
                  const atrasado = op.proximaAcaoEm && new Date(op.proximaAcaoEm) < new Date()
                  const sla = metasSla.find(m => m.etapa === col.id)?.tempoMaximoDias
                  const estourouSla = sla != null && op.diasNaEtapaAtual != null && op.diasNaEtapaAtual > sla
                  return (
                  <div
                    key={op.id}
                    onClick={() => router.push(`/oportunidades/${op.id}`)}
                    className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow"
                  >
                    <div className="font-medium text-sm text-gray-900 truncate">{op.nomeCliente}</div>
                    {op.unidade && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{op.unidade.nome}</div>
                    )}
                    {op.valor && (
                      <div className="text-xs font-medium text-green-700 mt-1">
                        {op.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    )}
                    {op.responsavel && (
                      <div className="text-xs text-gray-400 mt-1 truncate">👤 {op.responsavel.nome}</div>
                    )}
                    {op.diasNaEtapaAtual != null && (
                      <div className={`text-xs mt-1 ${estourouSla ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                        {estourouSla ? '🔥 ' : '⏱ '}{Math.round(op.diasNaEtapaAtual)}d nesta etapa{sla != null && estourouSla ? ` (limite: ${sla}d)` : ''}
                      </div>
                    )}
                    {op.proximaAcaoEm && (
                      <div className={`text-xs mt-1 ${atrasado ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                        {atrasado ? '⚠ ' : '🕒 '}{new Date(op.proximaAcaoEm).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                    {/* Ações rápidas de movimento */}
                    {col.id !== ESTAGIO_VENDA_FECHADA && col.id !== 'PERDIDO' && (
                      <div className="mt-2 flex gap-1" onClick={e => e.stopPropagation()}>
                        <select
                          disabled={movendo === op.id}
                          defaultValue=""
                          onChange={e => { if (e.target.value) mover(op.id, e.target.value) }}
                          className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1 text-gray-600 bg-gray-50 cursor-pointer"
                        >
                          <option value="" disabled>Mover para...</option>
                          {COLUNAS.filter(c => c.id !== col.id).map(c => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
