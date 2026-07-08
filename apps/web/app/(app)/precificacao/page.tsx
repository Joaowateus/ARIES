'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import {
  api,
  ParametrosPrecificacao,
  PrecificacaoMoto,
  KpisPrecificacao,
  RankingVendedor,
  HistoricoPrecificacao,
} from '@/lib/api'

const PAPEIS_GESTAO = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL']

const SAUDE_COR: Record<string, string> = {
  'Estoque Premium': 'bg-blue-100 text-blue-700',
  'Estoque Saudável': 'bg-green-100 text-green-700',
  'Estoque Atenção': 'bg-yellow-100 text-yellow-700',
  'Estoque Crítico': 'bg-red-100 text-red-700',
}

function brl(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  return (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'
}

type Tab = 'motor' | 'ranking' | 'parametros'

export default function PrecificacaoPage() {
  const { user } = useAuth()
  const podeGerir = !!user && PAPEIS_GESTAO.includes(user.papel)

  const [tab, setTab] = useState<Tab>('motor')
  const [motos, setMotos] = useState<PrecificacaoMoto[]>([])
  const [kpis, setKpis] = useState<KpisPrecificacao | null>(null)
  const [ranking, setRanking] = useState<RankingVendedor[]>([])
  const [parametros, setParametros] = useState<ParametrosPrecificacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [motoSelecionada, setMotoSelecionada] = useState<PrecificacaoMoto | null>(null)

  const carregar = useCallback(() => {
    Promise.all([
      api.precificacao.listar(),
      api.precificacao.kpis(),
      api.precificacao.rankingVendedores(),
      api.precificacao.parametros(),
    ]).then(([m, k, r, p]) => {
      setMotos(m)
      setKpis(k)
      setRanking(r)
      setParametros(p)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando motor de precificação...</div>

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Precificação</h1>
        <p className="text-sm text-gray-500 mt-1">
          Motor de precificação, saúde de estoque, ranking comercial e governança —
          ver <span className="font-mono text-xs">ENGENHARIA-PRECIFICACAO-MOTOS-MM.md</span>
        </p>
      </div>

      {kpis && <KpiTiles kpis={kpis} />}

      <div className="flex gap-2 mb-4 mt-6 border-b border-gray-200">
        {([
          ['motor', 'Motor de Preços'],
          ['ranking', 'Ranking de Vendedores'],
          ['parametros', 'Parâmetros'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'motor' && (
        <MotorDePrecos motos={motos} podeGerir={podeGerir} onSelecionar={setMotoSelecionada} />
      )}
      {tab === 'ranking' && <RankingTable ranking={ranking} />}
      {tab === 'parametros' && parametros && (
        <Parametros parametros={parametros} podeGerir={podeGerir} onSalvo={carregar} />
      )}

      {motoSelecionada && (
        <MotoModal
          moto={motoSelecionada}
          podeGerir={podeGerir}
          onFechar={() => setMotoSelecionada(null)}
          onAtualizado={() => { carregar(); setMotoSelecionada(null) }}
        />
      )}
    </div>
  )
}

function KpiTiles({ kpis }: { kpis: KpisPrecificacao }) {
  const tiles = [
    { label: 'Lucro Médio / Moto Vendida', value: brl(kpis.lucroMedioPorMotoVendida), tone: 'text-green-700' },
    { label: 'Margem Líquida Média Realizada', value: pct(kpis.margemLiquidaMediaRealizada), tone: 'text-green-700' },
    { label: 'Capital Investido em Estoque', value: brl(kpis.capitalInvestidoTotal), tone: 'text-gray-900' },
    { label: 'Capital Parado (Atenção + Crítico)', value: brl(kpis.capitalParado), tone: 'text-red-700' },
    { label: 'Tempo Médio em Estoque', value: `${Math.round(kpis.tempoMedioEstoqueVendidas)} dias`, tone: 'text-gray-900' },
    { label: 'Vendas Abaixo do LP', value: String(kpis.vendasAbaixoDoLP), tone: kpis.vendasAbaixoDoLP > 0 ? 'text-red-700' : 'text-gray-900' },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {tiles.map(t => (
        <div key={t.label} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">{t.label}</div>
          <div className={`text-lg font-bold ${t.tone}`}>{t.value}</div>
        </div>
      ))}
    </div>
  )
}

function MotorDePrecos({ motos, podeGerir, onSelecionar }: {
  motos: PrecificacaoMoto[]
  podeGerir: boolean
  onSelecionar: (m: PrecificacaoMoto) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Moto</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Fase / Saúde</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Custo Base</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Estratégico</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Comercial</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Negociação</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">LP</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {motos.map(m => (
            <tr key={m.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{m.nome}</div>
                <div className="text-xs text-gray-400">{m.situacao}</div>
              </td>
              {m.dadosIncompletos ? (
                <td colSpan={5} className="px-4 py-3 text-xs text-amber-700 bg-amber-50">{m.mensagem}</td>
              ) : (
                <>
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-500">{m.fase}</div>
                    <span className={`inline-flex mt-1 px-2 py-0.5 rounded text-xs font-medium ${SAUDE_COR[m.classificacaoSaude ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                      {m.classificacaoSaude}
                    </span>
                    {m.revisaoGerencialObrigatoria && (
                      <div className="text-xs text-red-600 font-medium mt-1">⚠ Revisão gerencial obrigatória</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{brl(m.custoBase)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{brl(m.precoEstrategico)}</td>
                  <td className="px-4 py-3 text-right font-medium text-blue-700">{brl(m.precoComercial)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{brl(m.precoNegociacao)}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-medium">{brl(m.lp)}</td>
                </>
              )}
              <td className="px-4 py-3 text-right">
                <button onClick={() => onSelecionar(m)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800">
                  {podeGerir ? 'Gerir' : 'Ver'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RankingTable({ ranking }: { ranking: RankingVendedor[] }) {
  if (ranking.length === 0) {
    return <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-400">Nenhuma venda registrada ainda.</div>
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Vendedor</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Vendas</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Ticket Médio</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Desconto Médio</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Margem Realizada</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Lucro Entregue</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">% Preço Cheio+</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Rank Financeiro</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Rank Comercial</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ranking.map(r => (
            <tr key={r.vendedorId} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{r.nome}</td>
              <td className="px-4 py-3 text-right">{r.qtdeVendas}</td>
              <td className="px-4 py-3 text-right">{brl(r.ticketMedio)}</td>
              <td className="px-4 py-3 text-right">{pct(r.descontoMedio)}</td>
              <td className="px-4 py-3 text-right text-green-700 font-medium">{pct(r.margemLiquidaMediaRealizada)}</td>
              <td className="px-4 py-3 text-right font-medium">{brl(r.lucroTotalEntregue)}</td>
              <td className="px-4 py-3 text-right">{pct(r.pctVendasPrecoCheioOuAcima)}</td>
              <td className="px-4 py-3 text-right">
                <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs">{r.rankingFinanceiro}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-gray-100 text-gray-700 font-bold text-xs">{r.rankingComercial}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const CAMPOS_PARAMETROS: { key: keyof ParametrosPrecificacao; label: string; tipo: 'pct' | 'int' | 'moeda' }[] = [
  { key: 'margemEstrategica', label: 'Margem Estratégica', tipo: 'pct' },
  { key: 'margemComercial', label: 'Margem Comercial', tipo: 'pct' },
  { key: 'margemNegociacao', label: 'Margem de Negociação', tipo: 'pct' },
  { key: 'margemLP', label: 'Margem do LP (piso)', tipo: 'pct' },
  { key: 'impostosPct', label: 'Impostos Efetivos', tipo: 'pct' },
  { key: 'comissaoPadraoPct', label: 'Comissão Padrão', tipo: 'pct' },
  { key: 'marketingProvisionadoPct', label: 'Marketing Provisionado', tipo: 'pct' },
  { key: 'reservaFinanceiraPct', label: 'Reserva Financeira', tipo: 'pct' },
  { key: 'taxaFinanceiraMensal', label: 'Taxa Financeira Mensal', tipo: 'pct' },
  { key: 'taxaOportunidadeMensal', label: 'Taxa de Oportunidade Mensal', tipo: 'pct' },
  { key: 'diasEstoqueMeta', label: 'Dias de Estoque Meta', tipo: 'int' },
  { key: 'custoOperacionalRateio', label: 'Custo Operacional Rateado / Unidade', tipo: 'moeda' },
  { key: 'fase1MaxDias', label: 'Fim da Fase 1 (dias)', tipo: 'int' },
  { key: 'fase2MaxDias', label: 'Fim da Fase 2 (dias)', tipo: 'int' },
  { key: 'fase3MaxDias', label: 'Fim da Fase 3 (dias)', tipo: 'int' },
  { key: 'saudePremiumMaxDias', label: 'Estoque Premium até (dias)', tipo: 'int' },
  { key: 'saudeSaudavelMaxDias', label: 'Estoque Saudável até (dias)', tipo: 'int' },
  { key: 'saudeAtencaoMaxDias', label: 'Estoque Atenção até (dias)', tipo: 'int' },
]

function Parametros({ parametros, podeGerir, onSalvo }: {
  parametros: ParametrosPrecificacao
  podeGerir: boolean
  onSalvo: () => void
}) {
  const [form, setForm] = useState(parametros)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)

  function set(key: keyof ParametrosPrecificacao, raw: string, tipo: 'pct' | 'int' | 'moeda') {
    const n = Number(raw)
    setForm(f => ({ ...f, [key]: tipo === 'pct' ? n / 100 : n }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setOk(false); setSalvando(true)
    try {
      await api.precificacao.atualizarParametros(form)
      setOk(true)
      onSalvo()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} className="bg-white rounded-xl border border-gray-200 p-6 max-w-3xl">
      <p className="text-xs text-gray-500 mb-4">
        Fonte única de verdade da precificação (Pilar 9 — Governança). Alterações afetam
        imediatamente o cálculo de todas as motos em estoque.
        {!podeGerir && ' Apenas Administrador, Diretor Comercial ou Gerente Comercial podem editar.'}
      </p>
      <div className="grid grid-cols-2 gap-4">
        {CAMPOS_PARAMETROS.map(c => (
          <div key={c.key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{c.label}</label>
            <div className="relative">
              <input
                type="number"
                step={c.tipo === 'pct' ? '0.1' : '1'}
                disabled={!podeGerir}
                value={c.tipo === 'pct' ? Math.round(Number(form[c.key]) * 1000) / 10 : Number(form[c.key])}
                onChange={e => set(c.key, e.target.value, c.tipo)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <span className="absolute right-3 top-2 text-xs text-gray-400">
                {c.tipo === 'pct' ? '%' : c.tipo === 'moeda' ? 'R$' : 'dias'}
              </span>
            </div>
          </div>
        ))}
      </div>
      {erro && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mt-4">{erro}</div>}
      {ok && <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700 mt-4">Parâmetros atualizados.</div>}
      {podeGerir && (
        <button type="submit" disabled={salvando}
          className="mt-5 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {salvando ? 'Salvando...' : 'Salvar Parâmetros'}
        </button>
      )}
    </form>
  )
}

function MotoModal({ moto, podeGerir, onFechar, onAtualizado }: {
  moto: PrecificacaoMoto
  podeGerir: boolean
  onFechar: () => void
  onAtualizado: () => void
}) {
  const [aba, setAba] = useState<'custos' | 'historico' | 'override'>('custos')
  const [custos, setCustos] = useState({
    dataCompra: moto.dataCompra?.slice(0, 10) ?? '',
    valorCompra: '',
    custoRevisao: '', custoEstetica: '', custoDocumentacao: '',
    custoFrete: '', custoCombustivel: '', custoAcessorios: '', custoOutros: '',
    marketingInvestido: '',
  })
  const [historico, setHistorico] = useState<HistoricoPrecificacao[]>([])
  const [override, setOverride] = useState({ precoNovo: '', motivo: '', aprovadorId: '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.precificacao.historico(moto.id).then(setHistorico)
  }, [moto.id])

  async function salvarCustos(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setSalvando(true)
    try {
      const data: Record<string, number | string> = {}
      for (const [k, v] of Object.entries(custos)) {
        if (v === '') continue
        data[k] = k === 'dataCompra' ? v : Number(v)
      }
      await api.precificacao.atualizarCustos(moto.id, data)
      onAtualizado()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function registrarOverride(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setSalvando(true)
    try {
      await api.precificacao.registrarAlteracao({
        unidadeId: moto.id,
        precoNovo: Number(override.precoNovo),
        motivo: override.motivo,
        aprovadorId: override.aprovadorId || undefined,
      })
      onAtualizado()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar alteração')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onFechar}>
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">{moto.nome}</h2>
            <div className="text-xs text-gray-400">
              {moto.dadosIncompletos ? 'Dados de compra pendentes' : `LP: ${brl(moto.lp)} · Comercial: ${brl(moto.precoComercial)}`}
            </div>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        <div className="flex gap-1 px-5 pt-3 border-b border-gray-100">
          {(['custos', 'historico', 'override'] as const).map(a => (
            <button key={a} onClick={() => setAba(a)}
              className={`px-3 py-2 text-xs font-medium rounded-t-lg ${aba === a ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}>
              {a === 'custos' ? 'Custos de Compra' : a === 'historico' ? 'Histórico (Governança)' : 'Registrar Alteração'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {erro && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-4">{erro}</div>}

          {aba === 'custos' && (
            <form onSubmit={salvarCustos} className="space-y-3">
              <p className="text-xs text-gray-500">Pilar 1 e 8 — dados necessários para o motor de precificação calcular o Custo Base.</p>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Data de Compra" tipo="date" value={custos.dataCompra} onChange={v => setCustos(c => ({ ...c, dataCompra: v }))} disabled={!podeGerir} />
                <Campo label="Valor de Compra (R$)" value={custos.valorCompra} onChange={v => setCustos(c => ({ ...c, valorCompra: v }))} disabled={!podeGerir} />
                <Campo label="Revisão (R$)" value={custos.custoRevisao} onChange={v => setCustos(c => ({ ...c, custoRevisao: v }))} disabled={!podeGerir} />
                <Campo label="Estética (R$)" value={custos.custoEstetica} onChange={v => setCustos(c => ({ ...c, custoEstetica: v }))} disabled={!podeGerir} />
                <Campo label="Documentação (R$)" value={custos.custoDocumentacao} onChange={v => setCustos(c => ({ ...c, custoDocumentacao: v }))} disabled={!podeGerir} />
                <Campo label="Frete (R$)" value={custos.custoFrete} onChange={v => setCustos(c => ({ ...c, custoFrete: v }))} disabled={!podeGerir} />
                <Campo label="Combustível (R$)" value={custos.custoCombustivel} onChange={v => setCustos(c => ({ ...c, custoCombustivel: v }))} disabled={!podeGerir} />
                <Campo label="Acessórios (R$)" value={custos.custoAcessorios} onChange={v => setCustos(c => ({ ...c, custoAcessorios: v }))} disabled={!podeGerir} />
                <Campo label="Outros (R$)" value={custos.custoOutros} onChange={v => setCustos(c => ({ ...c, custoOutros: v }))} disabled={!podeGerir} />
                <Campo label="Marketing Investido (R$)" value={custos.marketingInvestido} onChange={v => setCustos(c => ({ ...c, marketingInvestido: v }))} disabled={!podeGerir} />
              </div>
              {podeGerir && (
                <button type="submit" disabled={salvando}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar Custos'}
                </button>
              )}
            </form>
          )}

          {aba === 'historico' && (
            historico.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma alteração registrada para esta moto.</p>
            ) : (
              <div className="space-y-2">
                {historico.map(h => (
                  <div key={h.id} className="border border-gray-100 rounded-lg p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{brl(h.precoAnterior)} → {brl(h.precoNovo)}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${h.nivelAprovacao === 'N3' ? 'bg-red-100 text-red-700' : h.nivelAprovacao === 'N2' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {h.nivelAprovacao}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{h.motivo}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(h.criadoEm).toLocaleString('pt-BR')} · Solicitante: {h.solicitante?.nome ?? '—'}
                      {h.aprovador && ` · Aprovador: ${h.aprovador.nome}`}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {aba === 'override' && (
            <form onSubmit={registrarOverride} className="space-y-3">
              <p className="text-xs text-gray-500">
                Pilar 9 — toda alteração fora do fluxo automático fica registrada. Preços abaixo
                do LP exigem um aprovador (nível N3).
              </p>
              <Campo label="Novo Preço (R$)" value={override.precoNovo} onChange={v => setOverride(o => ({ ...o, precoNovo: v }))} />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Motivo</label>
                <textarea value={override.motivo} onChange={e => setOverride(o => ({ ...o, motivo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>
              <Campo label="ID do Aprovador (se N2/N3)" value={override.aprovadorId} onChange={v => setOverride(o => ({ ...o, aprovadorId: v }))} />
              <button type="submit" disabled={salvando}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {salvando ? 'Registrando...' : 'Registrar Alteração'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function Campo({ label, value, onChange, tipo = 'number', disabled }: {
  label: string; value: string; onChange: (v: string) => void; tipo?: string; disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={tipo} value={value} disabled={disabled} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400" />
    </div>
  )
}
