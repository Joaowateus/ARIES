'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, ResumoProLabore } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'

export default function ProLaboreDashboardPage() {
  const [resumo, setResumo] = useState<ResumoProLabore | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    proLaboreApi.resumo.get().then(setResumo).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-sm text-gray-400">Carregando...</div>

  function formatData(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Liquidez da Operação</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quanto de cada venda realmente vira pró-labore no seu bolso</p>
        </div>
        <Link href="/pro-labore/vendas" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
          Registrar venda
        </Link>
      </div>

      {/* Última venda */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Última Venda</h2>
        {resumo?.ultimaVenda ? (
          <div className="grid grid-cols-3 gap-6 mt-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Data</div>
              <div className="text-lg font-semibold text-gray-900">{formatData(resumo.ultimaVenda.data)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Valor da venda</div>
              <div className="text-2xl font-bold text-gray-900">{formatMoeda(resumo.ultimaVenda.valorVenda)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Pró-labore sacado</div>
              <div className="text-2xl font-bold text-emerald-600">{formatMoeda(resumo.ultimaVenda.valorProLabore)}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 mt-2">
            Nenhuma venda registrada ainda.{' '}
            <Link href="/pro-labore/vendas" className="text-emerald-600 hover:underline">Registrar agora</Link>
          </div>
        )}
      </div>

      {/* KPIs do mês */}
      {resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-1">Vendas no mês</div>
            <div className="text-xl font-bold text-gray-900">{resumo.mes.quantidadeVendas}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-1">Faturamento no mês</div>
            <div className="text-xl font-bold text-gray-900">{formatMoeda(resumo.mes.valorVendas)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-1">Pró-labore no mês</div>
            <div className="text-xl font-bold text-emerald-600">{formatMoeda(resumo.mes.proLaboreSacado)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-1">Ficou no caixa</div>
            <div className="text-xl font-bold text-gray-900">{formatMoeda(resumo.mes.retidoCaixa)}</div>
          </div>
        </div>
      )}

      {/* Ano */}
      {resumo && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex gap-8">
          <div>
            <div className="text-xs text-gray-500 mb-1">Vendas no ano</div>
            <div className="text-lg font-semibold text-gray-900">{resumo.ano.quantidadeVendas}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Faturamento no ano</div>
            <div className="text-lg font-semibold text-gray-900">{formatMoeda(resumo.ano.valorVendas)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Pró-labore acumulado no ano</div>
            <div className="text-lg font-semibold text-emerald-600">{formatMoeda(resumo.ano.proLaboreSacado)}</div>
          </div>
        </div>
      )}

      {/* Série mensal */}
      {resumo && resumo.serieMensal.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Evolução Mensal</h2>
          <p className="text-xs text-gray-400 mb-4">Faturamento (cinza) x Pró-labore sacado (verde)</p>
          <GraficoMensal dados={resumo.serieMensal} />
        </div>
      )}

      {/* Últimas vendas */}
      {resumo && resumo.ultimasVendas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Últimas Vendas</h2>
            <Link href="/pro-labore/vendas" className="text-xs text-emerald-600 hover:underline">Ver todas</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Data</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Venda</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Pró-labore</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resumo.ultimasVendas.map(v => (
                <tr key={v.id}>
                  <td className="px-4 py-2.5 text-gray-700">{formatData(v.data)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-900">{formatMoeda(v.valorVenda)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-emerald-600">{formatMoeda(v.valorProLabore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function GraficoMensal({ dados }: { dados: ResumoProLabore['serieMensal'] }) {
  const max = Math.max(...dados.map(d => d.valorVendas), 1)

  return (
    <div className="flex items-end gap-3 h-48">
      {dados.map(d => {
        const alturaVendas = Math.max((d.valorVendas / max) * 100, d.valorVendas > 0 ? 2 : 0)
        const alturaProLabore = Math.max((d.proLaboreSacado / max) * 100, d.proLaboreSacado > 0 ? 2 : 0)
        return (
          <div key={d.mes} className="flex-1 flex flex-col items-center justify-end h-full">
            <div
              className="w-full flex items-end justify-center gap-0.5 h-full"
              title={`${d.label}: ${d.quantidadeVendas} venda${d.quantidadeVendas !== 1 ? 's' : ''} — ${formatMoeda(d.valorVendas)} · Pró-labore: ${formatMoeda(d.proLaboreSacado)}`}
            >
              <div className="w-1/2 bg-gray-200 rounded-t" style={{ height: `${alturaVendas}%` }} />
              <div className="w-1/2 bg-emerald-500 rounded-t" style={{ height: `${alturaProLabore}%` }} />
            </div>
            <div className="text-[11px] text-gray-400 mt-1">{d.label}</div>
          </div>
        )
      })}
    </div>
  )
}
