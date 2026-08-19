'use client'

import { useEffect, useState } from 'react'
import { api, Insight } from '@/lib/api'

const SEVERIDADE_COR: Record<string, string> = {
  alto: 'bg-red-50 border-red-200 text-red-700',
  medio: 'bg-amber-50 border-amber-200 text-amber-700',
  baixo: 'bg-blue-50 border-blue-200 text-blue-700',
}

const SEVERIDADE_ICONE: Record<string, string> = { alto: '🔴', medio: '🟡', baixo: '🔵' }

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[] | null>(null)

  useEffect(() => {
    api.insights.listar().then(setInsights)
  }, [])

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Central de Insights</h1>
        <p className="text-sm text-gray-500 mt-0.5">Alertas calculados a partir dos dados reais da operação — sem inventar nada que não esteja no banco</p>
      </div>

      {insights === null ? (
        <div className="text-sm text-gray-400">Carregando...</div>
      ) : insights.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="font-medium text-gray-900">Nada fora do esperado no momento</h3>
          <p className="text-sm text-gray-500 mt-1">Quando algo pedir atenção — follow-up atrasado, conversão abaixo da meta, estoque parado — aparece aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((i, idx) => (
            <div key={idx} className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${SEVERIDADE_COR[i.severidade]}`}>
              <span>{SEVERIDADE_ICONE[i.severidade]}</span>
              <span className="text-sm">{i.mensagem}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
