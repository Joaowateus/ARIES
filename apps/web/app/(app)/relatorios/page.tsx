'use client'

import { useState } from 'react'
import { api } from '@/lib/api'

const RELATORIOS = [
  { tipo: 'oportunidades' as const, label: 'Oportunidades / CRM', descricao: 'Todos os leads visíveis para você, com estágio e responsável' },
  { tipo: 'contratos' as const, label: 'Contratos / Vendas', descricao: 'Vendas fechadas, valor e vendedor' },
  { tipo: 'tarefas' as const, label: 'Tarefas', descricao: 'Tarefas, prioridade, status e prazo' },
]

export default function RelatoriosPage() {
  const [baixando, setBaixando] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  async function baixar(tipo: 'oportunidades' | 'contratos' | 'tarefas') {
    setErro('')
    setBaixando(tipo)
    try {
      await api.relatorios.baixarCsv(tipo)
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao gerar relatório')
    } finally {
      setBaixando(null)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-sm text-gray-500 mt-0.5">Exportação em CSV, escopada aos dados que você pode ver</p>
      </div>

      {erro && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-4">{erro}</div>}

      <div className="space-y-3">
        {RELATORIOS.map(r => (
          <div key={r.tipo} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">{r.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{r.descricao}</div>
            </div>
            <button
              onClick={() => baixar(r.tipo)}
              disabled={baixando === r.tipo}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {baixando === r.tipo ? 'Gerando...' : 'Baixar CSV'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
