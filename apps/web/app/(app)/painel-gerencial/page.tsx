'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, EquipeResumo, ScorePessoa, ScoreConfig } from '@/lib/api'
import { useAuth } from '@/lib/auth'

function formatMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const DIMENSOES = [
  { key: 'comercial', label: 'Comercial' },
  { key: 'produtividade', label: 'Produtividade' },
  { key: 'processos', label: 'Processos' },
  { key: 'crm', label: 'CRM' },
  { key: 'conteudo', label: 'Conteúdo' },
  { key: 'treinamentos', label: 'Treinamentos' },
] as const

export default function PainelGerencialPage() {
  const { user } = useAuth()
  const [equipe, setEquipe] = useState<EquipeResumo[]>([])
  const [score, setScore] = useState<ScorePessoa[]>([])
  const [config, setConfig] = useState<ScoreConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [showConfig, setShowConfig] = useState(false)

  const ehAdmin = user?.papel === 'ADMINISTRADOR'

  const carregar = useCallback(() => {
    Promise.all([api.gestao.equipe(), api.gestao.score(), api.gestao.scoreConfig()])
      .then(([e, s, c]) => { setEquipe(e); setScore(s); setConfig(c) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function salvarConfig(e: React.FormEvent) {
    e.preventDefault()
    if (!config) return
    await api.gestao.atualizarScoreConfig(config)
    setShowConfig(false)
    carregar()
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Painel Gerencial</h1>
        <p className="text-sm text-gray-500 mt-0.5">Sua equipe — visão consolidada, não individual isolada</p>
      </div>

      {/* Rollup da equipe */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Colaborador</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Vendas (mês)</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Faturamento</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Leads Ativos</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Tarefas Pend.</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Rotina Hoje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {equipe.map(e => (
              <tr key={e.usuario.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{e.usuario.nome}</td>
                <td className="px-4 py-3 text-right text-gray-700">{e.vendasNoMes}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatMoeda(e.faturamentoNoMes)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{e.leadsAtivos}</td>
                <td className="px-4 py-3 text-right text-gray-700">{e.tarefasPendentes}</td>
                <td className="px-4 py-3 text-right text-gray-700">{e.rotinaCumpridaHoje != null ? `${Math.round(e.rotinaCumpridaHoje * 100)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Score / Ranking */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 text-sm">Score de Performance</h2>
        {ehAdmin && (
          <button onClick={() => setShowConfig(s => !s)} className="text-xs text-blue-600 hover:underline">
            {showConfig ? 'Fechar' : 'Configurar pesos'}
          </button>
        )}
      </div>

      {showConfig && config && (
        <form onSubmit={salvarConfig} className="bg-white rounded-xl border border-gray-200 p-5 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            ['pesoComercial', 'Comercial'], ['pesoProdutividade', 'Produtividade'], ['pesoProcessos', 'Processos'],
            ['pesoCrm', 'CRM'], ['pesoConteudo', 'Conteúdo'], ['pesoTreinamentos', 'Treinamentos'], ['pesoRotinas', 'Rotinas'],
          ] as [keyof ScoreConfig, string][]).map(([key, label]) => (
            <div key={key}>
              <label className="text-xs text-gray-500">{label} (%)</label>
              <input type="number" min="0" max="100" value={Math.round(config[key] * 100)}
                onChange={e => setConfig(c => c && ({ ...c, [key]: Number(e.target.value) / 100 }))}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
            </div>
          ))}
          <button type="submit" className="col-span-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Salvar pesos</button>
        </form>
      )}

      <p className="text-xs text-gray-400 mb-3">Nunca é só volume de vendas — combina comercial, produtividade, processos, CRM, conteúdo e treinamentos com pesos configuráveis.</p>

      <div className="space-y-2">
        {score.map((s, i) => (
          <div key={s.usuario.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5">#{i + 1}</span>
                <span className="font-medium text-gray-900">{s.usuario.nome}</span>
              </div>
              <span className="text-lg font-bold text-gray-900">{Math.round(s.score * 100)}</span>
            </div>
            <div className="flex gap-3 flex-wrap">
              {DIMENSOES.map(d => (
                <span key={d.key} className="text-xs text-gray-500">
                  {d.label}: <span className="font-medium text-gray-700">{Math.round(s.dimensoes[d.key] * 100)}%</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
