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
  const [selecionando, setSelecionando] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [apagando, setApagando] = useState(false)

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

  function alternarSelecao(id: string) {
    setSelecionados(atual => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function cancelarSelecao() {
    setSelecionando(false)
    setSelecionados(new Set())
  }

  async function apagarSelecionados() {
    if (selecionados.size === 0) return
    const confirmado = window.confirm(
      `Apagar ${selecionados.size} card${selecionados.size > 1 ? 's' : ''} selecionado${selecionados.size > 1 ? 's' : ''}? ` +
      'Isso também apaga contrato, contas a receber e histórico ligados a eles. Não tem como desfazer.'
    )
    if (!confirmado) return
    setApagando(true)
    try {
      await api.oportunidades.apagarLote([...selecionados])
      cancelarSelecao()
      carregar()
    } finally {
      setApagando(false)
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
        <div className="flex items-center gap-2">
          {selecionando ? (
            <>
              <span className="text-sm text-gray-500">{selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}</span>
              <button
                onClick={apagarSelecionados}
                disabled={selecionados.size === 0 || apagando}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {apagando ? 'Apagando...' : 'Apagar selecionados'}
              </button>
              <button
                onClick={cancelarSelecao}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setSelecionando(true)}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Selecionar
              </button>
              <Link
                href="/oportunidades/nova"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                + Novo Lead
              </Link>
            </>
          )}
        </div>
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
                  const selecionado = selecionados.has(op.id)
                  return (
                  <div
                    key={op.id}
                    onClick={() => selecionando ? alternarSelecao(op.id) : router.push(`/oportunidades/${op.id}`)}
                    className={`relative bg-white rounded-lg border p-3 shadow-sm cursor-pointer hover:shadow ${
                      selecionado ? 'border-red-400 ring-2 ring-red-200' : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {selecionando && (
                      <input
                        type="checkbox"
                        checked={selecionado}
                        onChange={() => alternarSelecao(op.id)}
                        onClick={e => e.stopPropagation()}
                        className="absolute top-2 right-2 w-4 h-4 accent-red-600 cursor-pointer"
                      />
                    )}
                    <div className="font-medium text-sm text-gray-900 truncate pr-5">{op.nomeCliente}</div>
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
