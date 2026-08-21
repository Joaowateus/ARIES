'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, MeuPainel, MetaComProgresso, ProducaoMensal, MetasComerciais, ConversaoFunil } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatMoeda, formatPct } from '@/lib/format'
import StatCard from '@/components/ui/StatCard'
import ProgressBar from '@/components/ui/ProgressBar'

const STATUS_DOT: Record<string, string> = { verde: 'bg-green-500', amarelo: 'bg-amber-500', vermelho: 'bg-red-500' }

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

      {/* Produção mensal */}
      {dados && dados.producaoMensal.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Minha Produção Mensal</h2>
          <p className="text-xs text-gray-400 mb-4">Vendas fechadas por mês, no ano corrente — linha tracejada é a supermeta</p>
          <GraficoProducaoMensal dados={dados.producaoMensal} meta={dados.metasComerciais.supermetaVendasMes} />
        </div>
      )}

      {/* Supermeta e Anúncios Orgânicos */}
      {dados && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Supermeta de Vendas</h2>
            <p className="text-xs text-gray-400 mb-3">Meta mensal padrão da operação</p>
            <ProgressBar percentual={Math.min(1, dados.metasComerciais.vendasMes / dados.metasComerciais.supermetaVendasMes)} />
            <div className="text-sm text-gray-600 mt-2">
              {dados.metasComerciais.vendasMes} de {dados.metasComerciais.supermetaVendasMes} vendas
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Anúncios Orgânicos</h2>
            <p className="text-xs text-gray-400 mb-3">Meta mensal de 2.000, divididos em 1.000 por quinzena</p>
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Mês</span>
                <span>{dados.metasComerciais.anunciosMes} de {dados.metasComerciais.metaAnunciosMes}</span>
              </div>
              <ProgressBar percentual={Math.min(1, dados.metasComerciais.anunciosMes / dados.metasComerciais.metaAnunciosMes)} />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>{dados.metasComerciais.quinzenaAtual}ª quinzena</span>
                <span>{dados.metasComerciais.anunciosQuinzenaAtual} de {dados.metasComerciais.metaAnunciosQuinzena}</span>
              </div>
              <ProgressBar percentual={Math.min(1, dados.metasComerciais.anunciosQuinzenaAtual / dados.metasComerciais.metaAnunciosQuinzena)} />
            </div>
          </div>
        </div>
      )}

      {/* Saúde do Funil */}
      {dados && dados.funilProprio.etapas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Saúde do Meu Funil</h2>
            <Link href="/funil" className="text-xs text-blue-600 hover:underline">Ver funil completo</Link>
          </div>
          <SaudeFunilMini funil={dados.funilProprio} />
        </div>
      )}

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

function GraficoProducaoMensal({ dados, meta }: { dados: ProducaoMensal[]; meta: number }) {
  const max = Math.max(meta, ...dados.map(d => d.vendas), 1)
  const alturaMeta = (meta / max) * 100

  return (
    <div className="relative h-40">
      <div
        className="absolute left-0 right-0 border-t border-dashed border-red-400"
        style={{ bottom: `${alturaMeta}%` }}
      >
        <span className="absolute right-0 -top-4 text-[10px] text-red-500">Supermeta: {meta}</span>
      </div>
      <div className="flex items-end gap-2 h-full">
        {dados.map(d => {
          const altura = Math.max((d.vendas / max) * 100, d.vendas > 0 ? 3 : 0)
          const atingiuMeta = d.vendas >= meta
          return (
            <div key={d.mes} className="flex-1 flex flex-col items-center justify-end h-full">
              <div className="text-xs font-semibold text-gray-700 mb-1">{d.vendas}</div>
              <div
                title={`${d.label}: ${d.vendas} venda${d.vendas !== 1 ? 's' : ''} — ${formatMoeda(d.faturamento)}`}
                className={`w-full rounded-t transition-all ${atingiuMeta ? 'bg-green-500' : 'bg-blue-400'}`}
                style={{ height: `${altura}%` }}
              />
              <div className="text-[11px] text-gray-400 mt-1">{d.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SaudeFunilMini({ funil }: { funil: ConversaoFunil }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {funil.etapas.map(e => (
        <div key={e.estagio} className="flex-1 min-w-[90px] text-center">
          <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${STATUS_DOT[e.status]}`} />
          <div className="text-sm font-semibold text-gray-900">{e.quantidade}</div>
          <div className="text-[11px] text-gray-400 truncate" title={e.label}>{e.label}</div>
        </div>
      ))}
    </div>
  )
}
