'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'

const ESTAGIO_LABEL: Record<string, string> = {
  NOVO_LEAD: 'Novo Lead',
  CONTATO: 'Contato',
  VISITA_AGENDADA: 'Visita Agendada',
  PROPOSTA: 'Proposta',
  NEGOCIACAO: 'Negociação',
  GANHO: 'Ganho',
  PERDIDO: 'Perdido',
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<Awaited<ReturnType<typeof api.dashboard.get>> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.dashboard.get().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{saudacao}, {user?.nome?.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Aqui está o resumo da operação de hoje</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Oportunidades Ativas" value={data?.totais.oportunidadesAtivas ?? 0} color="blue" />
        <KpiCard label="Vendas Fechadas" value={data?.totais.vendasFechadas ?? 0} color="green" />
        <KpiCard label="Taxa de Conversão" value={`${data?.totais.taxaConversao ?? 0}%`} color="purple" />
        <KpiCard label="Receita Fechada" value={formatMoeda(data?.totais.receitaFechada ?? 0)} color="emerald" />
        <KpiCard label="Vendedores Ativos" value={data?.totais.vendedoresAtivos ?? 0} color="orange" />
        <KpiCard label="Motos Cadastradas" value={data?.totais.produtosCadastrados ?? 0} color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funil */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Funil de Vendas</h2>
          <div className="space-y-2">
            {Object.entries(data?.funil ?? {}).map(([estagio, qtd]) => (
              <div key={estagio} className="flex items-center gap-3">
                <div className="text-xs text-gray-500 w-32 truncate">{ESTAGIO_LABEL[estagio] ?? estagio}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${estagio === 'GANHO' ? 'bg-green-500' : estagio === 'PERDIDO' ? 'bg-red-400' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, (qtd / Math.max(1, data?.funil.NOVO_LEAD ?? 1)) * 100)}%` }}
                  />
                </div>
                <div className="text-xs font-medium text-gray-700 w-6 text-right">{qtd}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recentes */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Atividade Recente</h2>
          {(data?.recentes ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma oportunidade ainda.</p>
          ) : (
            <div className="space-y-3">
              {(data?.recentes ?? []).map(op => (
                <div key={op.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{op.nomeCliente}</div>
                    <div className="text-xs text-gray-400">{ESTAGIO_LABEL[op.estagio] ?? op.estagio}</div>
                  </div>
                  {op.valor && (
                    <div className="text-sm font-medium text-green-700">{formatMoeda(op.valor)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    purple: 'bg-purple-50 text-purple-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    orange: 'bg-orange-50 text-orange-700',
    slate: 'bg-slate-50 text-slate-700',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${colors[color]} mb-3`}>
        <span className="font-bold text-lg">{typeof value === 'string' ? value[0] : value}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function formatMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
