'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { api, ProtocoloResumo } from '@/lib/api'

const PAPEIS_GESTAO = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL']

export default function ProtocolosPage() {
  const { user } = useAuth()
  const podeGerir = !!user && PAPEIS_GESTAO.includes(user.papel)
  const [protocolos, setProtocolos] = useState<ProtocoloResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [carregandoPadrao, setCarregandoPadrao] = useState(false)

  const carregar = useCallback(() => {
    api.protocolos.listar().then(lista => {
      setErro('')
      setProtocolos(lista)
    }).catch(err => {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar protocolos')
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function carregarPadrao() {
    setCarregandoPadrao(true)
    setErro('')
    try {
      await api.protocolos.carregarPadrao()
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar protocolos padrão')
    } finally {
      setCarregandoPadrao(false)
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando protocolos...</div>

  const porCategoria = protocolos.reduce<Record<string, ProtocoloResumo[]>>((acc, p) => {
    (acc[p.categoria] ??= []).push(p)
    return acc
  }, {})

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Protocolos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Biblioteca de processos operacionais — identidade, POP, SLA, KPIs, auditoria, risco e melhoria contínua.
          </p>
        </div>
        {podeGerir && (
          <Link href="/protocolos/novo"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            + Novo Protocolo
          </Link>
        )}
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-4">{erro}</div>
      )}

      {protocolos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
          <p className="mb-4">Nenhum protocolo cadastrado ainda.</p>
          {podeGerir && (
            <button onClick={carregarPadrao} disabled={carregandoPadrao}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {carregandoPadrao ? 'Carregando...' : 'Carregar os 5 Protocolos Padrão da MM Negócios'}
            </button>
          )}
        </div>
      ) : (
        Object.entries(porCategoria).map(([categoria, lista]) => (
          <div key={categoria} className="mb-8">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{categoria}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lista.map(p => (
                <Link key={p.id} href={`/protocolos/${p.id}`}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all block">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug">{p.nome}</h3>
                    <span className="text-xs text-gray-400 shrink-0 ml-2">v{p.versao}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {p.naoConformidadesAbertas > 0 ? (
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                        {p.naoConformidadesAbertas} não conformidade{p.naoConformidadesAbertas > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        Sem não conformidades
                      </span>
                    )}
                    {p.planosAcaoPendentes > 0 && (
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                        {p.planosAcaoPendentes} plano{p.planosAcaoPendentes > 1 ? 's' : ''} de ação
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-3">
                    {p.ultimaAuditoria
                      ? `Última auditoria: ${new Date(p.ultimaAuditoria.data).toLocaleDateString('pt-BR')} — ${p.ultimaAuditoria.conforme ? 'conforme' : 'não conforme'}`
                      : 'Nenhuma auditoria registrada'}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
