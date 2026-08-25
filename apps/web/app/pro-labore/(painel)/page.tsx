'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, ResumoProLabore } from '@/lib/proLaboreApi'
import { formatMoeda, formatPct } from '@/lib/format'

export default function ProLaboreDashboardPage() {
  const [resumo, setResumo] = useState<ResumoProLabore | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    proLaboreApi.resumo.get().then(setResumo).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-sm text-gray-400">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Liquidez da Operação</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quanto do seu faturamento realmente vira pró-labore no seu bolso</p>
        </div>
        <Link href="/pro-labore/lancamentos" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
          Lançar faturamento da semana
        </Link>
      </div>

      {/* Semana atual */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Semana Atual</h2>
        {resumo?.semanaAtual ? (
          <div className="grid grid-cols-3 gap-6 mt-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Faturamento bruto</div>
              <div className="text-2xl font-bold text-gray-900">{formatMoeda(resumo.semanaAtual.valorBruto)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Pró-labore líquido</div>
              <div className="text-2xl font-bold text-emerald-600">{formatMoeda(resumo.semanaAtual.valorLiquido)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Liquidez</div>
              <div className="text-2xl font-bold text-gray-900">
                {resumo.semanaAtual.valorBruto > 0 ? formatPct(resumo.semanaAtual.valorLiquido / resumo.semanaAtual.valorBruto) : '—'}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 mt-2">
            Nenhum faturamento lançado ainda essa semana.{' '}
            <Link href="/pro-labore/lancamentos" className="text-emerald-600 hover:underline">Lançar agora</Link>
          </div>
        )}
      </div>

      {/* KPIs do mês */}
      {resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-1">Bruto no mês</div>
            <div className="text-xl font-bold text-gray-900">{formatMoeda(resumo.mes.bruto)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-1">Pró-labore no mês</div>
            <div className="text-xl font-bold text-emerald-600">{formatMoeda(resumo.mes.liquido)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-1">Retido (impostos, custos, reserva)</div>
            <div className="text-xl font-bold text-gray-900">{formatMoeda(resumo.mes.retido)}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs text-gray-500 mb-1">Liquidez média</div>
            <div className="text-xl font-bold text-gray-900">{formatPct(resumo.mes.percentualLiquidezMedio)}</div>
          </div>
        </div>
      )}

      {/* Ano */}
      {resumo && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex gap-8">
          <div>
            <div className="text-xs text-gray-500 mb-1">Faturamento bruto no ano</div>
            <div className="text-lg font-semibold text-gray-900">{formatMoeda(resumo.ano.bruto)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Pró-labore acumulado no ano</div>
            <div className="text-lg font-semibold text-emerald-600">{formatMoeda(resumo.ano.liquido)}</div>
          </div>
        </div>
      )}

      {/* Série semanal */}
      {resumo && resumo.serieSemanal.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Últimas Semanas</h2>
          <p className="text-xs text-gray-400 mb-4">Bruto (cinza) x Pró-labore líquido (verde)</p>
          <GraficoSemanal dados={resumo.serieSemanal} />
        </div>
      )}
    </div>
  )
}

function GraficoSemanal({ dados }: { dados: ResumoProLabore['serieSemanal'] }) {
  const max = Math.max(...dados.map(d => d.valorBruto), 1)

  return (
    <div className="flex items-end gap-3 h-48">
      {dados.map(d => {
        const alturaBruto = Math.max((d.valorBruto / max) * 100, 2)
        const alturaLiquido = Math.max((d.valorLiquido / max) * 100, 2)
        const label = new Date(d.referenciaSemana).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        return (
          <div key={d.referenciaSemana} className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="w-full flex items-end justify-center gap-0.5 h-full" title={`${label} — Bruto: ${formatMoeda(d.valorBruto)} · Líquido: ${formatMoeda(d.valorLiquido)}`}>
              <div className="w-1/2 bg-gray-200 rounded-t" style={{ height: `${alturaBruto}%` }} />
              <div className="w-1/2 bg-emerald-500 rounded-t" style={{ height: `${alturaLiquido}%` }} />
            </div>
            <div className="text-[10px] text-gray-400 mt-1">{label}</div>
          </div>
        )
      })}
    </div>
  )
}
