'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, MeuPainel, MetaComProgresso } from '@/lib/api'
import { useAuth } from '@/lib/auth'

function formatMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

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
        <PainelCard label="Leads Ativos" value={dados?.leadsPendentes ?? 0} href="/oportunidades" color="blue" />
        <PainelCard label="Follow-ups Pendentes" value={dados?.followUpsPendentes ?? 0} href="/oportunidades" color="red" destaque={(dados?.followUpsPendentes ?? 0) > 0} />
        <PainelCard label="Tarefas Pendentes" value={dados?.tarefasPendentes ?? 0} href="/tarefas" color="orange" />
        <PainelCard label="Vendas no Mês" value={dados?.vendas ?? 0} color="green" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <PainelCard label="Faturamento Gerado (mês)" value={formatMoeda(dados?.faturamentoGerado ?? 0)} color="emerald" />
        <PainelCard label="Anúncios (semana)" value={dados?.anunciosProduzidosSemana ?? 0} href="/marketplace" color="purple" />
        <PainelCard label="Conteúdos (semana)" value={dados?.conteudosProduzidosSemana ?? 0} href="/social-media" color="slate" />
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
  const pct = Math.round(meta.percentual * 100)
  const cor = pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : 'bg-orange-400'
  return (
    <div>
      <div className="text-xs text-gray-400 mb-2">{label}</div>
      <div className="bg-gray-100 rounded-full h-3 mb-1">
        <div className={`h-3 rounded-full ${cor}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="text-sm font-semibold text-gray-900">{pct}%</div>
      <div className="text-xs text-gray-400">
        {meta.tipo === 'FATURAMENTO' ? formatMoeda(meta.realizado) : meta.realizado} de{' '}
        {meta.tipo === 'FATURAMENTO' ? formatMoeda(meta.valor) : meta.valor}
      </div>
    </div>
  )
}

function PainelCard({ label, value, href, color, destaque }: { label: string; value: number | string; href?: string; color: string; destaque?: boolean }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    purple: 'bg-purple-50 text-purple-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    orange: 'bg-orange-50 text-orange-700',
    slate: 'bg-slate-50 text-slate-700',
    red: 'bg-red-50 text-red-700',
  }
  const conteudo = (
    <div className={`bg-white rounded-xl border p-5 h-full ${destaque ? 'border-red-300' : 'border-gray-200'}`}>
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${colors[color]} mb-3`}>
        <span className="font-bold text-lg">{typeof value === 'string' ? value[0] : value}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
  return href ? <Link href={href}>{conteudo}</Link> : conteudo
}
