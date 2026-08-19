'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { DashboardExecutivo, MetaComProgresso } from '@/lib/api'
import { ESTAGIO_LABEL, ESTAGIO_VENDA_FECHADA } from '@/lib/funil'
import { formatMoeda, formatPct } from '@/lib/format'
import StatCard from '@/components/ui/StatCard'
import ProgressBar from '@/components/ui/ProgressBar'

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardExecutivo | null>(null)
  const [metas, setMetas] = useState<MetaComProgresso[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.dashboard.get(), api.metas.progresso()])
      .then(([d, m]) => { setData(d); setMetas(m) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  const metaDia = metas?.find(m => m.periodo === 'DIARIA')
  const metaSemana = metas?.find(m => m.periodo === 'SEMANAL')
  const metaMes = metas?.find(m => m.periodo === 'MENSAL' && m.tipo === 'QUANTIDADE')

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{saudacao}, {user?.nome?.split(' ')[0]} 👋</h1>
          <p className="text-gray-500 text-sm mt-1">Resumo executivo — {data?.periodo.label.toLowerCase()}</p>
        </div>
        <Link href="/metas" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Gerenciar metas →
        </Link>
      </div>

      {/* Resumo executivo */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Faturamento" value={formatMoeda(data?.resumo.faturamento ?? 0)} color="emerald" />
        <StatCard label="Vendas" value={data?.resumo.vendas ?? 0} color="blue" />
        <StatCard label="Conversão" value={formatPct(data?.resumo.conversao ?? 0)} color="purple" />
        <StatCard label="Ticket Médio" value={formatMoeda(data?.resumo.ticketMedio ?? 0)} color="orange" />
        <StatCard label="Lucro" value={formatMoeda(data?.resumo.lucro ?? 0)} color="slate" />
      </div>

      {/* Segunda linha */}
      <div className="grid grid-cols-3 gap-4">
        <MiniStat label="Leads no período" value={data?.segundaLinha.leads ?? 0} />
        <MiniStat label="Simulações (SQL) no período" value={data?.segundaLinha.simulacoes ?? 0} />
        <MiniStat label="Fechamentos no período" value={data?.segundaLinha.fechamentos ?? 0} />
      </div>
      <p className="text-xs text-gray-400 -mt-3">
        Comparecimento, entregas e transferências ainda não são etapas rastreadas no funil — dá pra adicionar quando fizer sentido expandir o Comercial.
      </p>

      {/* Metas */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Metas</h2>
        {!metaDia && !metaSemana && !metaMes ? (
          <p className="text-sm text-gray-400">
            Nenhuma meta ativa. <Link href="/metas" className="text-blue-600 hover:underline">Crie uma meta</Link> para acompanhar o progresso aqui.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetaBar label="Meta do Dia" meta={metaDia} />
            <MetaBar label="Meta da Semana" meta={metaSemana} />
            <MetaBar label="Meta do Mês" meta={metaMes} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funil */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Funil Comercial</h2>
          <div className="space-y-3">
            {(data?.funil ?? []).map(etapa => (
              <div key={etapa.estagio}>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500 w-28 shrink-0 truncate">{etapa.label}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${etapa.estagio === ESTAGIO_VENDA_FECHADA ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.round(etapa.conversaoDoTopo * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs font-medium text-gray-700 w-6 text-right shrink-0">{etapa.quantidade}</div>
                </div>
                <div className="text-xs text-gray-400 w-28 ml-[7.5rem] pl-3">
                  {formatPct(etapa.conversaoDoTopo)} do topo
                  {etapa.tempoMedioDias != null && ` · ${etapa.tempoMedioDias}d de tempo médio`}
                </div>
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

function MetaBar({ label, meta }: { label: string; meta?: MetaComProgresso }) {
  if (!meta) {
    return (
      <div>
        <div className="text-xs text-gray-400 mb-2">{label}</div>
        <div className="text-sm text-gray-300">Sem meta ativa</div>
      </div>
    )
  }
  return (
    <div>
      <div className="text-xs text-gray-400 mb-2">{label}</div>
      <div className="mb-1"><ProgressBar percentual={meta.percentual} /></div>
      <div className="text-sm font-semibold text-gray-900">{formatPct(meta.percentual)}</div>
      <div className="text-xs text-gray-400">
        {meta.tipo === 'FATURAMENTO' ? formatMoeda(meta.realizado) : meta.realizado} de{' '}
        {meta.tipo === 'FATURAMENTO' ? formatMoeda(meta.valor) : meta.valor}
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-lg font-semibold text-gray-900">{value}</span>
    </div>
  )
}
