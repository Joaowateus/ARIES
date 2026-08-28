'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, PainelProducaoEquipe } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import ProducaoDashboardCard from '@/components/meu-painel/ProducaoDashboard'

export default function PainelEquipePage() {
  const { user } = useAuth()
  const [dados, setDados] = useState<PainelProducaoEquipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [vendedorId, setVendedorId] = useState('')

  const carregar = useCallback(() => {
    api.gestao.producao(vendedorId || undefined).then(setDados).finally(() => setLoading(false))
  }, [vendedorId])

  useEffect(() => { carregar() }, [carregar])

  if (loading && !dados) return <div className="p-8 text-sm text-gray-400">Carregando...</div>
  if (!dados) return null

  const vendedorSelecionado = dados.vendedores.find(v => v.id === vendedorId)

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Painel da Equipe</h1>
        <p className="text-gray-500 text-sm mt-1">Produção comercial de {dados.escopoTodos ? 'toda a empresa' : 'sua equipe'} — filtre por vendedor pra ver individualmente</p>
      </div>

      <ProducaoDashboardCard
        user={user}
        dados={dados.producaoDashboard}
        titulo={vendedorSelecionado?.nome ?? 'Toda a equipe'}
        subtitulo={vendedorSelecionado ? 'Consultor de Vendas — ARIES' : `${dados.vendedores.length} colaborador${dados.vendedores.length !== 1 ? 'es' : ''} somados`}
        filtro={
          <select
            value={vendedorId}
            onChange={e => setVendedorId(e.target.value)}
            className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="" className="text-gray-900">Toda a equipe</option>
            {dados.vendedores.map(v => (
              <option key={v.id} value={v.id} className="text-gray-900">{v.nome}</option>
            ))}
          </select>
        }
      />
    </div>
  )
}
