'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, MeuPainel, MetaComProgresso } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatMoeda, formatPct } from '@/lib/format'
import StatCard from '@/components/ui/StatCard'
import ProgressBar from '@/components/ui/ProgressBar'

export default function MeuPainelPage() {
  const { user } = useAuth()
  const [dados, setDados] = useState<MeuPainel | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.meuPainel.get().then(setDados).finally(() => setLoading(false))
  }, [])

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{saudacao}, {user?.nome?.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Seu painel individual — o que precisa da sua atenção hoje</p>
      </div>

      {/* Metas */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Minhas Metas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetaBar label="Meta do Dia" meta={dados?.metas.dia} />
          <MetaBar label="Meta da Semana" meta={dados?.metas.semana} />
          <MetaBar label="Meta do Mês" meta={dados?.metas.mes[0]} />
        </div>
        {!dados?.metas.dia && !dados?.metas.semana && dados?.metas.mes.length === 0 && (
          <p className="text-sm text-gray-400 mt-2">
            Nenhuma meta ativa para você. <Link href="/metas" className="text-blue-600 hover:underline">Veja as metas da operação</Link>.
          </p>
        )}
      </div>

      {/* Cards de atenção */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Leads Ativos" value={dados?.leadsPendentes ?? 0} href="/oportunidades" color="blue" />
        <StatCard label="Follow-ups Pendentes" value={dados?.followUpsPendentes ?? 0} href="/oportunidades" color="red" destaque={(dados?.followUpsPendentes ?? 0) > 0} />
        <StatCard label="Tarefas Pendentes" value={dados?.tarefasPendentes ?? 0} href="/tarefas" color="orange" />
        <StatCard label="Vendas no Mês" value={dados?.vendas ?? 0} color="green" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Faturamento Gerado (mês)" value={formatMoeda(dados?.faturamentoGerado ?? 0)} color="emerald" />
        <StatCard label="Anúncios (semana)" value={dados?.anunciosProduzidosSemana ?? 0} href="/marketplace" color="purple" />
        <StatCard label="Conteúdos (semana)" value={dados?.conteudosProduzidosSemana ?? 0} href="/social-media" color="slate" />
      </div>

      <div className="flex gap-3">
        <Link href="/oportunidades" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          Ver meus leads
        </Link>
        <Link href="/insights" className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
          Ver meus insights
        </Link>
      </div>
    </div>
  )
}

function MetaBar({ label, meta }: { label: string; meta?: MetaComProgresso | null }) {
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
