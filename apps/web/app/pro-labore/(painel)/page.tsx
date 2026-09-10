'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, PainelProLabore, MesPainel, VendedorRanking, ParametroLiquidez, Vendedor, Lead, TipoLead, PERIODOS_RECEITA, ReceitaPeriodo, ReceitaDetalhada, PontoReceita, MetaFunilProLabore, TipoMetaFunilPL, ETAPAS_FUNIL_PL } from '@/lib/proLaboreApi'
import { formatMoeda, formatMoedaCompacta, formatPct } from '@/lib/format'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'

// Mesma ordem/lógica do backend (estagioAtingiu em proLabore.ts) — usada só
// pra recalcular o funil no cliente quando um filtro de vendedor/canal está
// ativo (o /painel não tem esses filtros, então filtramos os Leads já
// carregados em vez de criar um endpoint novo pra isso).
const ORDEM_ESTAGIO_LEAD = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA', 'FECHADO'] as const
function estagioAtingiu(estagioAtual: string, alvo: (typeof ORDEM_ESTAGIO_LEAD)[number]): boolean {
  if (estagioAtual === 'PERDIDO') return false
  return ORDEM_ESTAGIO_LEAD.indexOf(estagioAtual as (typeof ORDEM_ESTAGIO_LEAD)[number]) >= ORDEM_ESTAGIO_LEAD.indexOf(alvo)
}

const AVATAR_CORES = ['var(--pl-accent)', 'var(--pl-accent-3)', 'var(--pl-accent-4)', 'var(--pl-accent-5)', 'var(--pl-accent-2)', 'var(--pl-accent-6)']

function initials(nome: string) {
  return nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

function delta(curr: number, prev: number | undefined, invert = false) {
  if (prev === undefined || prev === 0) return null
  const d = ((curr - prev) / prev) * 100
  const up = invert ? d <= 0 : d >= 0
  return { pct: Math.abs(d), up }
}

function DeltaChip({ curr, prev, invert }: { curr: number; prev: number | undefined; invert?: boolean }) {
  const d = delta(curr, prev, invert)
  if (!d) return null
  return (
    <span className={`pl-delta ${d.up ? 'up' : 'down'}`}>
      <svg viewBox="0 0 10 10" fill="none">
        {d.up
          ? <path d="M5 8.5V1.5M5 1.5L1.5 5M5 1.5L8.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          : <path d="M5 1.5V8.5M5 8.5L1.5 5M5 8.5L8.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      {d.pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
    </span>
  )
}

export default function ProLaboreDashboardPage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel === 'DONO'
  const isSupervisor = usuario?.papel === 'SUPERVISOR'
  // Supervisor vê o painel com o escopo da equipe inteira (igual ao dono),
  // menos as cifras pessoais do dono — pró-labore, comissões agregadas,
  // gasto com anúncios/ROAS. Essas continuam em `isDono` estrito.
  const vejaEquipe = isDono || isSupervisor
  const [parametro, setParametro] = useState<ParametroLiquidez | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(0)

  // Meta mensal própria, só relevante pra VENDEDOR (dono/supervisor veem a
  // meta anual no lugar) — usa a individual dele quando definida, senão o
  // padrão da conta.
  const metaMensalVendedor = usuario?.metaMensal ?? parametro?.metaMensalPadrao ?? 0

  // Dados pro filtro por vendedor/canal — os leads já vêm com vendedorId e
  // tipoLead, então o canal (que o /painel não conhece) é filtrado no
  // cliente em vez de exigir um endpoint novo só pra isso.
  const [leads, setLeads] = useState<Lead[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])

  // Filtro geral de vendedor (topo do painel) + um filtro isolado por card —
  // cada card pode "seguir o filtro geral" (null) ou ter o próprio vendedor
  // selecionado, independente dos outros cards e do filtro geral. É o que
  // deixa olhar um vendedor na Jornada de compra e outro (ou todos) no
  // resto do painel ao mesmo tempo.
  const [filtroVendedorId, setFiltroVendedorId] = useState('')
  const [filtroCanal, setFiltroCanal] = useState<'' | TipoLead>('')
  const [filtroReceitaId, setFiltroReceitaId] = useState<string | null>(null)
  const [filtroComissaoId, setFiltroComissaoId] = useState<string | null>(null)
  const [filtroLucroId, setFiltroLucroId] = useState<string | null>(null)
  const [filtroReceitaDetalhadaId, setFiltroReceitaDetalhadaId] = useState<string | null>(null)
  const [filtroFunilVendedorId, setFiltroFunilVendedorId] = useState<string | null>(null)

  const chaveReceita = filtroReceitaId ?? filtroVendedorId
  const chaveComissao = filtroComissaoId ?? filtroVendedorId
  const chaveLucro = filtroLucroId ?? filtroVendedorId
  const chaveReceitaDetalhada = filtroReceitaDetalhadaId ?? filtroVendedorId
  const chaveFunilVendedor = filtroFunilVendedorId ?? filtroVendedorId

  // Metas por etapa da jornada de compra (conversão/perda/custo) — mesmo
  // conceito das metas do Funil de Vendas do CRM principal.
  const [metasFunil, setMetasFunil] = useState<MetaFunilProLabore[]>([])

  useEffect(() => {
    Promise.all([proLaboreApi.parametros.get(), proLaboreApi.leads.listar(), proLaboreApi.funilMetas.listar()]).then(([param, ls, metas]) => {
      setParametro(param)
      setLeads(ls)
      setMetasFunil(metas)
    })
  }, [])

  // Cache de /painel por vendedorId ('' = todos). Cada card pode pedir uma
  // chave diferente da do filtro geral — só busca a chave que ainda não
  // está no cache; chaves repetidas (cards que seguem o filtro geral)
  // reaproveitam a mesma resposta, sem refetch.
  const [painelPorVendedor, setPainelPorVendedor] = useState<Record<string, PainelProLabore>>({})
  const chavesNecessarias = useMemo(
    () => Array.from(new Set([filtroVendedorId, chaveReceita, chaveComissao, chaveLucro, chaveFunilVendedor])),
    [filtroVendedorId, chaveReceita, chaveComissao, chaveLucro, chaveFunilVendedor],
  )
  const chavesNecessariasKey = chavesNecessarias.join('|')

  // Na primeira carga posiciona o seletor de mês no mais recente do filtro
  // geral; depois disso, trocar qualquer filtro (geral ou de algum card)
  // nunca mais mexe no mês que a pessoa já estava vendo.
  const primeiraCargaPainel = useRef(true)
  useEffect(() => {
    const faltando = chavesNecessarias.filter(c => !(c in painelPorVendedor))
    if (faltando.length === 0) return
    if (primeiraCargaPainel.current) setLoading(true)
    Promise.all(faltando.map(c => proLaboreApi.painel.get(undefined, c || undefined).then(p => [c, p] as const)))
      .then(pares => {
        setPainelPorVendedor(cache => {
          const novo = { ...cache }
          for (const [c, p] of pares) novo[c] = p
          return novo
        })
        if (primeiraCargaPainel.current) {
          const principal = pares.find(([c]) => c === filtroVendedorId)?.[1]
          if (principal) setSelectedIdx(Math.max(0, principal.meses.length - 1))
          primeiraCargaPainel.current = false
        }
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chavesNecessariasKey])

  useEffect(() => {
    if (vejaEquipe) proLaboreApi.vendedores.listar().then(setVendedores)
  }, [vejaEquipe])

  // Card "Receita e pró-labore detalhados" — período curto (hoje/7 dias)
  // ou personalizado (data início/fim escolhidas no calendário), separado
  // do /painel (que só tem granularidade mensal e cobre o ano inteiro).
  // periodoCustom !== null tem prioridade sobre o preset ativo.
  const [receitaPeriodo, setReceitaPeriodo] = useState<ReceitaPeriodo>('hoje')
  const [periodoCustom, setPeriodoCustom] = useState<{ inicio: string; fim: string } | null>(null)
  const [customInicio, setCustomInicio] = useState('')
  const [customFim, setCustomFim] = useState('')
  const [receitaDetalhada, setReceitaDetalhada] = useState<ReceitaDetalhada | null>(null)
  const [carregandoReceita, setCarregandoReceita] = useState(true)

  function selecionarPresetReceita(p: ReceitaPeriodo) {
    setReceitaPeriodo(p)
    setPeriodoCustom(null)
    setCustomInicio('')
    setCustomFim('')
  }

  function aplicarPeriodoCustom() {
    if (!customInicio || !customFim) return
    setPeriodoCustom({ inicio: customInicio, fim: customFim })
  }

  useEffect(() => {
    if (!isDono) return
    setCarregandoReceita(true)
    const promise = periodoCustom
      ? proLaboreApi.receitas.porPeriodoCustom(periodoCustom.inicio, periodoCustom.fim, chaveReceitaDetalhada || undefined)
      : proLaboreApi.receitas.porPeriodo(receitaPeriodo, chaveReceitaDetalhada || undefined)
    promise.then(setReceitaDetalhada).finally(() => setCarregandoReceita(false))
  }, [receitaPeriodo, periodoCustom, isDono, chaveReceitaDetalhada])

  const painel = painelPorVendedor[filtroVendedorId] ?? null
  const meses = painel?.meses ?? []
  const atual = meses[selectedIdx]
  const anterior = selectedIdx > 0 ? meses[selectedIdx - 1] : undefined

  // Cada card com filtro isolado lê da chave correspondente no cache (caindo
  // pro painel do filtro geral enquanto a chave isolada ainda não voltou).
  const painelReceita = painelPorVendedor[chaveReceita] ?? painel
  const mesesReceita = painelReceita?.meses ?? meses
  const atualReceita = mesesReceita[selectedIdx] ?? atual

  const painelComissao = painelPorVendedor[chaveComissao] ?? painel
  const mesesComissao = painelComissao?.meses ?? meses
  const atualComissao = mesesComissao[selectedIdx] ?? atual

  const painelLucro = painelPorVendedor[chaveLucro] ?? painel
  const mesesLucro = painelLucro?.meses ?? meses
  const atualLucro = mesesLucro[selectedIdx] ?? atual

  // Canal (tráfego/orgânico) não existe no /painel, só em Lead — com canal
  // ativo o funil é sempre recalculado no cliente a partir dos Leads já
  // carregados; sem canal, usa a resposta do /painel já buscada pra chave
  // de vendedor do funil (isolada do funil, ou seguindo o filtro geral).
  const filtroFunilAtivo = chaveFunilVendedor !== '' || filtroCanal !== ''
  const funilFiltrado = useMemo(() => {
    if (!atual || !filtroFunilAtivo) return null
    if (filtroCanal !== '') {
      const leadsDoMes = leads.filter(l => {
        const d = new Date(l.criadoEm)
        return d.getUTCFullYear() === atual.ano && d.getUTCMonth() === atual.mes
          && (!chaveFunilVendedor || l.vendedorId === chaveFunilVendedor)
          && (!filtroCanal || l.tipoLead === filtroCanal)
      })
      return {
        leads: leadsDoMes.length,
        abordados: leadsDoMes.filter(l => estagioAtingiu(l.estagio, 'ABORDADO')).length,
        negociacao: leadsDoMes.filter(l => estagioAtingiu(l.estagio, 'NEGOCIACAO')).length,
        proposta: leadsDoMes.filter(l => estagioAtingiu(l.estagio, 'PROPOSTA')).length,
        fechamento: leadsDoMes.filter(l => l.estagio === 'FECHADO').length,
      }
    }
    return painelPorVendedor[chaveFunilVendedor]?.meses[selectedIdx]?.funil ?? null
  }, [atual, filtroFunilAtivo, filtroCanal, leads, chaveFunilVendedor, painelPorVendedor, selectedIdx])

  if (loading) return <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>

  if (meses.length === 0 || !atual) {
    return (
      <div className="pl-empty pl-card">
        <div className="pl-emoji">📊</div>
        <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Nenhum dado ainda este ano</h3>
        <p style={{ marginTop: 6 }}>Registre sua primeira venda para o painel começar a se preencher.</p>
        <Link href="/pro-labore/vendas" className="pl-btn pl-btn-primary" style={{ marginTop: 14, display: 'inline-flex' }}>Registrar venda</Link>
      </div>
    )
  }

  const kpis = [
    { label: 'Receita do mês', value: formatMoeda(atual.receita), color: 'var(--pl-accent)', curr: atual.receita, prev: anterior?.receita },
    ...(isDono
      ? [{ label: 'Lucro (pró-labore)', value: formatMoeda(atual.proLaboreSacado), color: 'var(--pl-accent-3)', curr: atual.proLaboreSacado, prev: anterior?.proLaboreSacado }]
      : isSupervisor
        ? [] // não é dela nem da equipe como um todo — cada vendedor já vê a própria no Ranking
        : [{ label: 'Comissão do mês', value: formatMoeda(atual.comissaoPaga), color: 'var(--pl-accent-3)', curr: atual.comissaoPaga, prev: anterior?.comissaoPaga }]),
    { label: 'Ticket médio', value: formatMoeda(atual.ticketMedio), color: 'var(--pl-accent-4)', curr: atual.ticketMedio, prev: anterior?.ticketMedio },
    ...(isDono
      ? [
          { label: 'Comissões pagas', value: formatMoeda(atual.comissaoPaga), color: 'var(--pl-accent-4)', curr: atual.comissaoPaga, prev: anterior?.comissaoPaga },
          { label: 'Gasto com anúncios', value: formatMoeda(atual.gastoAnuncios), color: 'var(--pl-accent-2)', curr: atual.gastoAnuncios, prev: anterior?.gastoAnuncios, invert: true },
          { label: 'ROAS', value: <>{atual.roas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}<span className="pl-unit">×</span></>, color: 'var(--pl-accent-5)', curr: atual.roas, prev: anterior?.roas },
        ]
      : []),
    { label: 'Conversão lead→venda', value: formatPct(atual.conversaoLeadVenda / 100), color: 'var(--pl-accent-6)', curr: atual.conversaoLeadVenda, prev: anterior?.conversaoLeadVenda },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
        <div className="pl-period-row">
          {meses.map((m, i) => (
            <button key={m.mes} type="button" className={`pl-chip ${i === selectedIdx ? 'active' : ''}`} onClick={() => setSelectedIdx(i)}>
              {m.label} {m.ano}
            </button>
          ))}
        </div>
        {vejaEquipe && (
          <FiltroVendedorGlobal vendedores={vendedores} vendedorId={filtroVendedorId} onChange={setFiltroVendedorId} />
        )}
      </div>

      <div className="pl-kpi-grid" style={{ marginTop: 16 }}>
        {kpis.map(k => (
          <div key={k.label} className="pl-kpi" style={{ ['--k-color' as string]: k.color }}>
            <div className="pl-kpi-label">{k.label}</div>
            <div className="pl-kpi-value">{k.value}</div>
            <div className="pl-kpi-foot">
              <DeltaChip curr={k.curr} prev={k.prev} invert={k.invert} />
              {anterior && <span className="pl-kpi-vs">vs. {anterior.label}</span>}
            </div>
          </div>
        ))}
      </div>

      <AnoEMetas meses={meses} atual={atual} parametro={parametro} onParametroSalvo={setParametro} isDono={isDono} vejaEquipe={vejaEquipe} metaMensalVendedor={metaMensalVendedor} />

      <div className="pl-section-head">
        <div>
          <div className="pl-eyebrow">Balanço financeiro</div>
          <h2 className="pl-section-title">Receita, lucro e verba de anúncios</h2>
        </div>
        <div className="pl-section-note">{meses[0].label}–{meses[meses.length - 1].label} {atual.ano} · clique num ponto do gráfico para inspecionar o mês</div>
      </div>

      <div className={isSupervisor ? undefined : 'pl-grid-2'}>
        <div className="pl-card">
          <div className="pl-card-head">
            <div>
              <div className="pl-card-title">Receita mensal</div>
              <div className="pl-card-sub">Soma do valor das vendas fechadas por mês</div>
            </div>
            <div className="pl-legend">
              <div className="pl-legend-item"><span className="pl-legend-swatch" style={{ background: 'var(--pl-accent)' }} />Receita</div>
              {vejaEquipe && (
                <FiltroVendedorCard vendedores={vendedores} valor={filtroReceitaId} vendedorGeralId={filtroVendedorId} onChange={setFiltroReceitaId} />
              )}
            </div>
          </div>
          <RevenueChart meses={mesesReceita} selectedIdx={selectedIdx} onSelect={setSelectedIdx} />
          <div className="pl-month-detail">
            <div>Mês selecionado<strong>{atualReceita.label} {atualReceita.ano}</strong></div>
            <div>Receita<strong>{formatMoeda(atualReceita.receita)}</strong></div>
            {isDono && <div>Lucro<strong>{formatMoeda(atualReceita.proLaboreSacado)}</strong></div>}
            {!isDono && !isSupervisor && <div>Comissão<strong>{formatMoeda(atualReceita.comissaoPaga)}</strong></div>}
            <div>Vendas<strong>{atualReceita.quantidadeVendas}</strong></div>
            <div>Ticket médio<strong>{formatMoeda(atualReceita.ticketMedio)}</strong></div>
            {isDono && <div>Comissões<strong>{formatMoeda(atualReceita.comissaoPaga)}</strong></div>}
            {isDono && <div>Gasto anúncios<strong>{formatMoeda(atualReceita.gastoAnuncios)}</strong></div>}
          </div>
        </div>

        {!isSupervisor && (
          <div className="pl-card">
            <div className="pl-card-head">
              <div>
                <div className="pl-card-title">{isDono ? 'Comissões pagas mensal' : 'Comissão mensal'}</div>
                <div className="pl-card-sub">{isDono ? 'Somada por venda, até o teto de cada vendedor' : 'Paga por venda, até o teto da sua comissão'}</div>
              </div>
              {vejaEquipe && (
                <FiltroVendedorCard vendedores={vendedores} valor={filtroComissaoId} vendedorGeralId={filtroVendedorId} onChange={setFiltroComissaoId} />
              )}
            </div>
            <LucroChart meses={mesesComissao} selectedIdx={selectedIdx} valorFn={m => m.comissaoPaga} color="var(--pl-accent-4)" />
            <div className="pl-stat-strip">
              <div className="pl-s"><div className="pl-l">Comissão/venda média</div><div className="pl-v">{formatMoeda(atualComissao.quantidadeVendas > 0 ? atualComissao.comissaoPaga / atualComissao.quantidadeVendas : 0)}</div></div>
              <div className="pl-s"><div className="pl-l">Total no período</div><div className="pl-v">{formatMoeda(mesesComissao.reduce((s, m) => s + m.comissaoPaga, 0))}</div></div>
            </div>
          </div>
        )}
      </div>

      {isDono && (
        <>
          <div className="pl-section-head">
            <div>
              <div className="pl-eyebrow">Comissões</div>
              <h2 className="pl-section-title">Quanto você já pagou aos vendedores</h2>
            </div>
            <div className="pl-section-note">{meses[0].label}–{meses[meses.length - 1].label} {atual.ano}</div>
          </div>
          <div className="pl-grid-2">
            <div className="pl-card">
              <div className="pl-card-head">
                <div>
                  <div className="pl-card-title">Lucro (pró-labore) mensal</div>
                  <div className="pl-card-sub">Sacado por venda, até o teto configurado</div>
                </div>
                <FiltroVendedorCard vendedores={vendedores} valor={filtroLucroId} vendedorGeralId={filtroVendedorId} onChange={setFiltroLucroId} />
              </div>
              <LucroChart meses={mesesLucro} selectedIdx={selectedIdx} valorFn={m => m.proLaboreSacado} />
              <div className="pl-stat-strip">
                <div className="pl-s"><div className="pl-l">Lucro/venda médio</div><div className="pl-v">{formatMoeda(atualLucro.quantidadeVendas > 0 ? atualLucro.proLaboreSacado / atualLucro.quantidadeVendas : 0)}</div></div>
                <div className="pl-s"><div className="pl-l">Total no período</div><div className="pl-v">{formatMoeda(mesesLucro.reduce((s, m) => s + m.proLaboreSacado, 0))}</div></div>
              </div>
            </div>

            <div className="pl-card">
              <div className="pl-card-head">
                <div>
                  <div className="pl-card-title">Receita e pró-labore detalhados</div>
                  <div className="pl-card-sub">Comparativo de receita e pró-labore por período</div>
                </div>
                <div className="pl-legend">
                  <div className="pl-legend-item"><span className="pl-legend-swatch" style={{ background: 'var(--pl-accent)' }} />Receita</div>
                  <div className="pl-legend-item"><span className="pl-legend-swatch" style={{ background: 'var(--pl-accent-3)' }} />Pró-labore</div>
                  <FiltroVendedorCard vendedores={vendedores} valor={filtroReceitaDetalhadaId} vendedorGeralId={filtroVendedorId} onChange={setFiltroReceitaDetalhadaId} />
                </div>
              </div>
              <div className="pl-stat-strip" style={{ marginTop: 0 }}>
                <div className="pl-s"><div className="pl-l">Total de receita</div><div className="pl-v" style={{ fontSize: 18 }}>{formatMoeda(receitaDetalhada?.totalReceita ?? 0)}</div></div>
                <div className="pl-s"><div className="pl-l">Total de pró-labore</div><div className="pl-v" style={{ fontSize: 18 }}>{formatMoeda(receitaDetalhada?.totalProLabore ?? 0)}</div></div>
                <div className="pl-s"><div className="pl-l">Total de vendas</div><div className="pl-v" style={{ fontSize: 18 }}>{receitaDetalhada?.totalVendas ?? 0}</div></div>
              </div>
              <div className="pl-period-row" style={{ margin: '14px 0', alignItems: 'center' }}>
                {PERIODOS_RECEITA.map(p => (
                  <button key={p} type="button" className={`pl-chip ${!periodoCustom && receitaPeriodo === p ? 'active' : ''}`} onClick={() => selecionarPresetReceita(p)}>
                    {p === 'hoje' ? 'Hoje' : `${p} dias`}
                  </button>
                ))}
                <PeriodoCalendarioFiltro
                  inicio={customInicio}
                  fim={customFim}
                  onChangeInicio={setCustomInicio}
                  onChangeFim={setCustomFim}
                  onAplicar={aplicarPeriodoCustom}
                  ativo={periodoCustom !== null}
                  onLimpar={() => { setPeriodoCustom(null); setReceitaPeriodo('hoje') }}
                />
              </div>
              {carregandoReceita ? (
                <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13, padding: '30px 0' }}>Carregando...</div>
              ) : (
                <ReceitaPeriodoChart pontos={receitaDetalhada?.pontos ?? []} />
              )}
            </div>
          </div>
        </>
      )}

      <div className="pl-section-head">
        <div>
          <div className="pl-eyebrow">Funil comercial</div>
          <h2 className="pl-section-title">Jornada de compra do cliente</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="pl-section-note">{atual.label} {atual.ano}{filtroFunilAtivo && ' · filtrado'}</div>
          <FunilFiltro
            vendedores={vendedores}
            vendedorId={filtroFunilVendedorId}
            vendedorGeralId={filtroVendedorId}
            canal={filtroCanal}
            onChangeVendedor={setFiltroFunilVendedorId}
            onChangeCanal={setFiltroCanal}
          />
        </div>
      </div>
      <div className="pl-card">
        <FunilJourney
          funil={funilFiltrado ?? atual.funil}
          metas={metasFunil}
          custoPorLeadTopo={parametro?.custoPorLeadTopo ?? 0}
          isDono={isDono}
          onMetaSalva={m => setMetasFunil(atual => atual.map(x => (x.etapa === m.etapa ? m : x)))}
          onCustoLeadSalvo={custoPorLeadTopo => setParametro(p => (p ? { ...p, custoPorLeadTopo } : p))}
        />
      </div>

      {vejaEquipe && (
        <>
          <div className="pl-section-head">
            <div>
              <div className="pl-eyebrow">Times{isDono ? ' & investimento' : ''}</div>
              <h2 className="pl-section-title">{isDono ? 'Ranking de vendedores e retorno de anúncios' : 'Ranking de vendedores'}</h2>
            </div>
            {filtroVendedorId && <div className="pl-section-note">Sempre com a equipe inteira — não é afetado pelo filtro de vendedor</div>}
          </div>

          <div className={isDono ? 'pl-grid-2b' : undefined}>
            <div className="pl-card">
              <div className="pl-card-head">
                <div>
                  <div className="pl-card-title">Ranking de vendedores</div>
                  <div className="pl-card-sub">Por receita gerada · {atual.label} {atual.ano}</div>
                </div>
              </div>
              <SellerLeaderboard vendedores={atual.vendedores} />
            </div>

            {isDono && (
              <div className="pl-card">
                <div className="pl-card-head">
                  <div>
                    <div className="pl-card-title">ROAS mensal</div>
                    <div className="pl-card-sub">Receita ÷ gasto com anúncios (operação inteira)</div>
                  </div>
                </div>
                <RoasBars meses={meses} selectedIdx={selectedIdx} />
                <div className="pl-stat-strip">
                  <div className="pl-s"><div className="pl-l">Gasto em {atual.label}</div><div className="pl-v">{formatMoeda(atual.gastoAnuncios)}</div></div>
                  <div className="pl-s"><div className="pl-l">CAC (custo/venda)</div><div className="pl-v">{formatMoeda(atual.cac)}</div></div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ============ FATURAMENTO ANUAL x META (dono/supervisor) OU META MENSAL (vendedor) + FRASE MOTIVACIONAL ============ */
// Vendedor não vê a meta anual da operação — só dono e supervisor têm essa
// visão de conjunto. No lugar, o vendedor vê a própria meta mensal (a dele,
// se definida em Vendedores, senão o padrão da conta).
function AnoEMetas({ meses, atual, parametro, onParametroSalvo, isDono, vejaEquipe, metaMensalVendedor }: { meses: MesPainel[]; atual: MesPainel; parametro: ParametroLiquidez | null; onParametroSalvo: (p: ParametroLiquidez) => void; isDono: boolean; vejaEquipe: boolean; metaMensalVendedor: number }) {
  if (meses.length === 0) return null
  const ano = meses[0].ano
  const totalAnual = meses.reduce((s, m) => s + m.receita, 0)
  const metaAnual = parametro?.metaFaturamentoAnual ?? 5_000_000
  const pctMetaAnual = metaAnual > 0 ? Math.min(1, totalAnual / metaAnual) : 0
  const faltamAnual = Math.max(0, metaAnual - totalAnual)

  const pctMetaMensal = metaMensalVendedor > 0 ? Math.min(1, atual.receita / metaMensalVendedor) : 0
  const faltamMensal = Math.max(0, metaMensalVendedor - atual.receita)

  return (
    <div>
      <div className="pl-section-head">
        <div>
          <div className="pl-eyebrow">{vejaEquipe ? 'Visão anual' : 'Sua meta do mês'}</div>
          <h2 className="pl-section-title">{vejaEquipe ? `Faturamento acumulado x meta de ${ano}` : `Sua produção x meta de ${atual.label}`}</h2>
        </div>
      </div>

      <div className="pl-grid-2b">
        {vejaEquipe ? (
          <>
            <div className="pl-card">
              <div className="pl-card-head">
                <div>
                  <div className="pl-card-title">Faturamento anual (atual)</div>
                  <div className="pl-card-sub">Acumulado de {meses[0].label} a {meses[meses.length - 1].label} de {ano}</div>
                </div>
              </div>
              <div className="pl-kpi-value" style={{ fontSize: 32 }}>{formatMoeda(totalAnual)}</div>
            </div>

            <div className="pl-card">
              <div className="pl-card-head">
                <div>
                  <div className="pl-card-title">Meta anual</div>
                  <div className="pl-card-sub">Objetivo de faturamento para {ano}</div>
                </div>
              </div>
              <div className="pl-kpi-value" style={{ fontSize: 32 }}>{formatMoeda(metaAnual)}</div>
              <div className="pl-bar-track" style={{ marginTop: 14 }}>
                <div className="pl-bar-fill" style={{ width: `${pctMetaAnual * 100}%` }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--pl-ink-muted)', marginTop: 8 }}>
                {formatPct(pctMetaAnual)} da meta atingida{faltamAnual > 0 ? ` — faltam ${formatMoeda(faltamAnual)}` : ' — meta batida! 🎉'}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="pl-card">
              <div className="pl-card-head">
                <div>
                  <div className="pl-card-title">Sua produção do mês</div>
                  <div className="pl-card-sub">Receita das suas vendas em {atual.label} de {atual.ano}</div>
                </div>
              </div>
              <div className="pl-kpi-value" style={{ fontSize: 32 }}>{formatMoeda(atual.receita)}</div>
            </div>

            <div className="pl-card">
              <div className="pl-card-head">
                <div>
                  <div className="pl-card-title">Meta mensal</div>
                  <div className="pl-card-sub">Seu objetivo de faturamento em {atual.label}</div>
                </div>
              </div>
              <div className="pl-kpi-value" style={{ fontSize: 32 }}>{formatMoeda(metaMensalVendedor)}</div>
              <div className="pl-bar-track" style={{ marginTop: 14 }}>
                <div className="pl-bar-fill" style={{ width: `${pctMetaMensal * 100}%` }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--pl-ink-muted)', marginTop: 8 }}>
                {formatPct(pctMetaMensal)} da meta atingida{faltamMensal > 0 ? ` — faltam ${formatMoeda(faltamMensal)}` : ' — meta batida! 🎉'}
              </div>
            </div>
          </>
        )}
      </div>

      <FraseMotivacional parametro={parametro} onSaved={onParametroSalvo} isDono={isDono} />
    </div>
  )
}

function FraseMotivacional({ parametro, onSaved, isDono }: { parametro: ParametroLiquidez | null; onSaved: (p: ParametroLiquidez) => void; isDono: boolean }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(parametro?.fraseMotivacional ?? '')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { setTexto(parametro?.fraseMotivacional ?? '') }, [parametro?.fraseMotivacional])

  async function salvar() {
    setSalvando(true)
    try {
      const atualizado = await proLaboreApi.parametros.atualizar({ fraseMotivacional: texto })
      onSaved(atualizado)
      setEditando(false)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="pl-card" style={{ marginTop: 16 }}>
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">Frase motivacional</div>
          <div className="pl-card-sub">Sua lembrança pessoal, sempre visível no painel</div>
        </div>
        {isDono && !editando && (
          <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setEditando(true)}>
            {parametro?.fraseMotivacional ? 'Editar' : 'Adicionar'}
          </button>
        )}
      </div>
      {editando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea
            className="pl-input"
            rows={2}
            maxLength={280}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Ex: Cada venda é um passo mais perto da liberdade financeira."
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="pl-btn pl-btn-primary" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => { setTexto(parametro?.fraseMotivacional ?? ''); setEditando(false) }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <p style={{ fontFamily: 'Sora', fontSize: 17, fontWeight: 600, fontStyle: 'italic', color: 'var(--pl-ink-1)', margin: 0 }}>
          {parametro?.fraseMotivacional ? `"${parametro.fraseMotivacional}"` : 'Nenhuma frase cadastrada ainda.'}
        </p>
      )}
    </div>
  )
}

/* ============ GRÁFICO DE RECEITA (área, interativo) ============ */
function RevenueChart({ meses, selectedIdx, onSelect }: { meses: MesPainel[]; selectedIdx: number; onSelect: (i: number) => void }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const W = 720, H = 220, padL = 4, padR = 4, padT = 14, padB = 26
  const plotW = W - padL - padR, plotH = H - padT - padB
  const maxV = Math.max(...meses.map(m => m.receita), 1) * 1.12
  const stepX = meses.length > 1 ? plotW / (meses.length - 1) : 0
  const x = (i: number) => padL + i * stepX
  const y = (v: number) => padT + plotH - (v / maxV) * plotH

  const pts = meses.map((m, i) => [x(i), y(m.receita)] as const)
  const areaD = `M ${pts[0][0]} ${padT + plotH} ` + pts.map(p => `L ${p[0]} ${p[1]}`).join(' ') + ` L ${pts[pts.length - 1][0]} ${padT + plotH} Z`
  const lineD = `M ` + pts.map(p => `${p[0]} ${p[1]}`).join(' L ')
  const gridVals = [0, maxV * 0.25, maxV * 0.5, maxV * 0.75, maxV]
  const hover = hoverIdx !== null ? meses[hoverIdx] : null

  return (
    <div className="pl-chart-wrap">
      <svg className="pl-chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--pl-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--pl-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridVals.map((gv, i) => <line key={i} x1={padL} x2={W - padR} y1={y(gv)} y2={y(gv)} className="pl-grid-hline" />)}
        <path d={areaD} fill="url(#revGrad)" stroke="none" />
        <path d={lineD} fill="none" stroke="var(--pl-accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} className="pl-baseline-line" />
        {meses.map((m, i) => (
          <text key={m.mes} x={x(i)} y={H - 6} className="pl-axis-label" textAnchor={i === 0 ? 'start' : i === meses.length - 1 ? 'end' : 'middle'}>{m.label}</text>
        ))}
        {hoverIdx !== null && <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={padT} y2={padT + plotH} className="pl-hover-x" style={{ opacity: 1 }} />}
        {hoverIdx !== null && <circle cx={x(hoverIdx)} cy={y(meses[hoverIdx].receita)} r={4.5} fill="var(--pl-accent)" stroke="var(--pl-surface)" strokeWidth={2} className="pl-hover-dot" style={{ opacity: 1 }} />}
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={i === selectedIdx ? 4.5 : 3} fill={i === selectedIdx ? 'var(--pl-accent)' : 'var(--pl-surface)'} stroke="var(--pl-accent)" strokeWidth={2} />
        ))}
        {meses.map((m, i) => (
          <rect key={m.mes} x={x(i) - stepX / 2} y={padT} width={stepX || W} height={plotH + 14} className="pl-hit"
            onMouseEnter={() => setHoverIdx(i)} onMouseMove={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} onClick={() => onSelect(i)} />
        ))}
      </svg>
      {hover && (
        <div className="pl-tooltip" style={{ left: `${(x(hoverIdx!) / W) * 100}%`, top: `${(y(hover.receita) / H) * 100}%`, opacity: 1 }}>
          <b>{hover.label} {hover.ano}</b>
          Receita {formatMoeda(hover.receita)}<br />Vendas {hover.quantidadeVendas}
        </div>
      )}
    </div>
  )
}

/* ============ RECEITA/PRÓ-LABORE DETALHADOS (hoje / 7 a 365 dias) ============ */
// Receita e pró-labore no MESMO gráfico (não dois gráficos separados) — dá
// pra comparar as duas curvas de relance, e como pró-labore é sempre uma
// fração do valor de cada venda, a linha dele sempre fica "por dentro" da
// área de receita.
function ReceitaPeriodoChart({ pontos }: { pontos: PontoReceita[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const W = 480, H = 230, padL = 4, padR = 40, padT = 14, padB = 22
  const plotW = W - padL - padR, plotH = H - padT - padB
  // Receita e pró-labore usam escalas INDEPENDENTES (cada uma normalizada
  // ao próprio máximo) — se dividissem a mesma escala, pró-labore (sempre
  // uma fração pequena do valor da venda) ficaria achatado perto da base,
  // sem dar pra enxergar sua própria variação ao longo do período.
  const maxReceita = Math.max(...pontos.map(p => p.receita), 1) * 1.15
  const maxProLabore = Math.max(...pontos.map(p => p.proLabore), 1) * 1.15
  const stepX = pontos.length > 1 ? plotW / (pontos.length - 1) : 0
  const x = (i: number) => padL + i * stepX
  const yReceita = (v: number) => padT + plotH - (v / maxReceita) * plotH
  const yProLabore = (v: number) => padT + plotH - (v / maxProLabore) * plotH

  // Com até 30 pontos (30 dias), mostrar o rótulo de cada um empilharia
  // texto ilegível — mostra só uma amostra espaçada, sempre incluindo o
  // primeiro e o último. O último índice periódico é TROCADO (não somado)
  // pelo último ponto quando os dois ficam muito perto — senão os rótulos
  // coincidiam e o texto saía sobreposto no canto direito do gráfico.
  const indicesRotulo = useMemo(() => {
    const n = pontos.length
    if (n <= 10) return new Set(Array.from({ length: n }, (_, i) => i))
    const passo = Math.ceil(n / 8)
    const indices: number[] = []
    for (let i = 0; i < n; i += passo) indices.push(i)
    const ultimoPeriodico = indices[indices.length - 1]
    if (ultimoPeriodico !== n - 1) {
      if (n - 1 - ultimoPeriodico < passo / 2) indices[indices.length - 1] = n - 1
      else indices.push(n - 1)
    }
    return new Set(indices)
  }, [pontos.length])
  const mostrarRotulo = (i: number) => indicesRotulo.has(i)

  if (pontos.length === 0) {
    return <div className="pl-empty" style={{ padding: '30px 0' }}>Sem vendas nesse período.</div>
  }

  const ptsReceita = pontos.map((p, i) => [x(i), yReceita(p.receita)] as const)
  const ptsProLabore = pontos.map((p, i) => [x(i), yProLabore(p.proLabore)] as const)
  const areaD = `M ${ptsReceita[0][0]} ${padT + plotH} ` + ptsReceita.map(p => `L ${p[0]} ${p[1]}`).join(' ') + ` L ${ptsReceita[ptsReceita.length - 1][0]} ${padT + plotH} Z`
  const lineReceitaD = `M ` + ptsReceita.map(p => `${p[0]} ${p[1]}`).join(' L ')
  const lineProLaboreD = `M ` + ptsProLabore.map(p => `${p[0]} ${p[1]}`).join(' L ')
  const hover = hoverIdx !== null ? pontos[hoverIdx] : null

  return (
    <div className="pl-chart-wrap">
      <svg className="pl-chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="recPeriodoGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--pl-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--pl-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} className="pl-baseline-line" />
        <path d={areaD} fill="url(#recPeriodoGrad)" stroke="none" />
        <path d={lineReceitaD} fill="none" stroke="var(--pl-accent)" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={lineProLaboreD} fill="none" stroke="var(--pl-accent-3)" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
        {/* Escala do pró-labore (eixo à direita) — só o topo e a base, pra deixar claro que a linha verde usa uma escala própria, não a mesma da receita. */}
        <text x={W - padR + 6} y={padT + 4} className="pl-axis-label" style={{ fill: 'var(--pl-accent-3)' }} textAnchor="start">{formatMoedaCompacta(maxProLabore)}</text>
        <text x={W - padR + 6} y={padT + plotH} className="pl-axis-label" style={{ fill: 'var(--pl-accent-3)' }} textAnchor="start">R$0</text>
        {pontos.map((p, i) => mostrarRotulo(i) && (
          <text key={i} x={x(i)} y={H - 6} className="pl-axis-label" textAnchor={i === 0 ? 'start' : i === pontos.length - 1 ? 'end' : 'middle'}>{p.label}</text>
        ))}
        {hoverIdx !== null && <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={padT} y2={padT + plotH} className="pl-hover-x" style={{ opacity: 1 }} />}
        {hoverIdx !== null && <circle cx={x(hoverIdx)} cy={yReceita(pontos[hoverIdx].receita)} r={4.5} fill="var(--pl-accent)" stroke="var(--pl-surface)" strokeWidth={2} className="pl-hover-dot" style={{ opacity: 1 }} />}
        {hoverIdx !== null && <circle cx={x(hoverIdx)} cy={yProLabore(pontos[hoverIdx].proLabore)} r={4.5} fill="var(--pl-accent-3)" stroke="var(--pl-surface)" strokeWidth={2} className="pl-hover-dot" style={{ opacity: 1 }} />}
        {pontos.length <= 15 && pontos.map((p, i) => (
          <circle key={`r-${i}`} cx={x(i)} cy={yReceita(p.receita)} r={3} fill="var(--pl-surface)" stroke="var(--pl-accent)" strokeWidth={2} />
        ))}
        {pontos.length <= 15 && pontos.map((p, i) => (
          <circle key={`p-${i}`} cx={x(i)} cy={yProLabore(p.proLabore)} r={3} fill="var(--pl-surface)" stroke="var(--pl-accent-3)" strokeWidth={2} />
        ))}
        {pontos.map((p, i) => (
          <rect key={i} x={x(i) - stepX / 2} y={padT} width={stepX || W} height={plotH + 14} className="pl-hit"
            onMouseEnter={() => setHoverIdx(i)} onMouseMove={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} />
        ))}
      </svg>
      {hover && (
        <div className="pl-tooltip" style={{ left: `${(x(hoverIdx!) / W) * 100}%`, top: `${(yReceita(hover.receita) / H) * 100}%`, opacity: 1 }}>
          <b>{hover.label}</b>
          Receita {formatMoeda(hover.receita)}<br />Pró-labore {formatMoeda(hover.proLabore)}<br />Vendas {hover.vendas}
        </div>
      )}
    </div>
  )
}

/* ============ GRÁFICO DE LUCRO/COMISSÃO (barras) ============ */
function LucroChart({ meses, selectedIdx, valorFn, color = 'var(--pl-accent-3)' }: { meses: MesPainel[]; selectedIdx: number; valorFn?: (m: MesPainel) => number; color?: string }) {
  const getValor = valorFn ?? ((m: MesPainel) => m.proLaboreSacado)

  // A altura do card é fixa (190px, via .pl-chart-svg--bars), mas a largura
  // varia muito conforme onde o gráfico é usado (metade da tela vs. card
  // full-width). Com viewBox fixo e preserveAspectRatio="none", isso
  // esticava tudo — barras E o texto dos meses — de forma não-uniforme,
  // deixando as letras dos rótulos distorcidas em cards mais largos. Medindo
  // a largura real do container e usando ela no viewBox, 1 unidade SVG passa
  // a valer sempre 1px na tela, então nada precisa ser esticado.
  const wrapRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(320)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const largura = entries[0]?.contentRect.width
      if (largura) setW(largura)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const h = 190, padL = 4, padR = 4, padT = 10, padB = 24
  const plotW = w - padL - padR, plotH = h - padT - padB
  const maxV = Math.max(...meses.map(getValor), 1) * 1.15
  const slot = plotW / meses.length
  const bw = slot * 0.56

  return (
    <div className="pl-chart-wrap" ref={wrapRef}>
      <svg className="pl-chart-svg pl-chart-svg--bars" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {meses.map((m, i) => {
          const bh = (getValor(m) / maxV) * plotH
          const bx = padL + i * slot + (slot - bw) / 2
          const by = padT + plotH - bh
          const isSel = i === selectedIdx
          return (
            <g key={m.mes}>
              <rect x={bx} y={by} width={bw} height={bh} rx={4} fill={isSel ? color : `color-mix(in srgb, ${color} 38%, transparent)`} />
              <text x={bx + bw / 2} y={h - 8} className="pl-axis-label" textAnchor="middle">{m.label}</text>
            </g>
          )
        })}
        <line x1={padL} x2={w - padR} y1={padT + plotH} y2={padT + plotH} className="pl-baseline-line" />
      </svg>
    </div>
  )
}

/* ============ FILTRO UNIVERSAL DE VENDEDOR ============ */
// Único e no topo do painel — muda o vendedorId que alimenta o /painel
// inteiro (KPIs, gráficos, ranking) e a Jornada de compra, em vez de ficar
// restrito a um card só. Só existe pra quem já vê a equipe (dono/supervisor);
// um VENDEDOR autenticado só enxerga a própria produção de qualquer forma.
function FiltroVendedorGlobal({
  vendedores, vendedorId, onChange,
}: {
  vendedores: Vendedor[]
  vendedorId: string
  onChange: (id: string) => void
}) {
  const ativo = vendedorId !== ''
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="pl-hint">Vendedor</span>
      <select className={`pl-select-chip ${ativo ? 'active' : ''}`} value={vendedorId} onChange={e => onChange(e.target.value)}>
        <option value="">Todos</option>
        {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
      </select>
    </div>
  )
}

/* ============ FILTRO ISOLADO DE VENDEDOR (por card) ============ */
// Cada card com um destes pode "seguir o filtro geral" (valor null) ou
// isolar o próprio vendedor, independente do filtro do topo e dos outros
// cards — é o que deixa olhar um vendedor num gráfico e outro (ou todos) no
// resto do painel ao mesmo tempo.
function FiltroVendedorCard({
  vendedores, valor, vendedorGeralId, onChange, titulo = 'Filtrar vendedor (isolado deste card)',
}: {
  vendedores: Vendedor[]
  valor: string | null
  vendedorGeralId: string
  onChange: (v: string | null) => void
  titulo?: string
}) {
  const [aberto, setAberto] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const ativo = valor !== null
  const rotuloGeral = vendedorGeralId ? (vendedores.find(v => v.id === vendedorGeralId)?.nome ?? 'vendedor') : 'Todos'

  useEffect(() => {
    if (!aberto) return
    function onClickFora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [aberto])

  return (
    <div className="pl-filter-wrap" ref={wrapRef}>
      <button type="button" className={`pl-icon-btn ${ativo ? 'active' : ''}`} onClick={() => setAberto(a => !a)} title={titulo} aria-label={titulo}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M8 12h8M11 18h2" /></svg>
        {ativo && <span className="pl-icon-btn-dot" />}
      </button>

      {aberto && (
        <div className="pl-filter-pop">
          <div className="pl-field">
            <label>Vendedor (isolado)</label>
            <select className="pl-select" value={valor ?? '__geral__'} onChange={e => onChange(e.target.value === '__geral__' ? null : e.target.value)}>
              <option value="__geral__">Filtro geral ({rotuloGeral})</option>
              <option value="">Todos</option>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </div>
          {ativo && <span className="pl-filter-clear" onClick={() => onChange(null)}>Voltar ao filtro geral</span>}
        </div>
      )}
    </div>
  )
}

/* ============ FILTRO DO FUNIL (vendedor isolado + canal) ============ */
function FunilFiltro({
  vendedores, vendedorId, vendedorGeralId, canal, onChangeVendedor, onChangeCanal,
}: {
  vendedores: Vendedor[]
  vendedorId: string | null
  vendedorGeralId: string
  canal: '' | TipoLead
  onChangeVendedor: (v: string | null) => void
  onChangeCanal: (c: '' | TipoLead) => void
}) {
  const [aberto, setAberto] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const ativo = vendedorId !== null || canal !== ''
  const rotuloGeral = vendedorGeralId ? (vendedores.find(v => v.id === vendedorGeralId)?.nome ?? 'vendedor') : 'Todos'

  useEffect(() => {
    if (!aberto) return
    function onClickFora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [aberto])

  return (
    <div className="pl-filter-wrap" ref={wrapRef}>
      <button type="button" className={`pl-icon-btn ${ativo ? 'active' : ''}`} onClick={() => setAberto(a => !a)} title="Filtrar funil" aria-label="Filtrar funil">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M8 12h8M11 18h2" /></svg>
        {ativo && <span className="pl-icon-btn-dot" />}
      </button>

      {aberto && (
        <div className="pl-filter-pop">
          {vendedores.length > 0 && (
            <div className="pl-field">
              <label>Vendedor (isolado do funil)</label>
              <select className="pl-select" value={vendedorId ?? '__geral__'} onChange={e => onChangeVendedor(e.target.value === '__geral__' ? null : e.target.value)}>
                <option value="__geral__">Filtro geral ({rotuloGeral})</option>
                <option value="">Todos</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            </div>
          )}
          <div className="pl-field">
            <label>Canal</label>
            <select className="pl-select" value={canal} onChange={e => onChangeCanal(e.target.value as '' | TipoLead)}>
              <option value="">Todos</option>
              <option value="TRAFEGO">Tráfego pago</option>
              <option value="ORGANICO">Orgânico</option>
            </select>
          </div>
          {ativo && <span className="pl-filter-clear" onClick={() => { onChangeVendedor(null); onChangeCanal('') }}>Limpar filtros</span>}
        </div>
      )}
    </div>
  )
}

/* ============ PERÍODO PERSONALIZADO (calendário) ============ */
function PeriodoCalendarioFiltro({
  inicio, fim, onChangeInicio, onChangeFim, onAplicar, ativo, onLimpar,
}: {
  inicio: string
  fim: string
  onChangeInicio: (v: string) => void
  onChangeFim: (v: string) => void
  onAplicar: () => void
  ativo: boolean
  onLimpar: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    function onClickFora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [aberto])

  function aplicar() {
    onAplicar()
    setAberto(false)
  }

  return (
    <div className="pl-filter-wrap" ref={wrapRef}>
      <button type="button" className={`pl-chip ${ativo ? 'active' : ''}`} onClick={() => setAberto(a => !a)}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: -2 }}>
          <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        {ativo ? `${inicio.split('-').reverse().join('/')} – ${fim.split('-').reverse().join('/')}` : 'Personalizado'}
      </button>

      {aberto && (
        <div className="pl-filter-pop">
          <div className="pl-field">
            <label>Data início</label>
            <input type="date" className="pl-input" value={inicio} onChange={e => onChangeInicio(e.target.value)} />
          </div>
          <div className="pl-field">
            <label>Data fim</label>
            <input type="date" className="pl-input" value={fim} onChange={e => onChangeFim(e.target.value)} />
          </div>
          <button type="button" className="pl-btn pl-btn-primary" style={{ width: '100%' }} disabled={!inicio || !fim} onClick={aplicar}>
            Aplicar período
          </button>
          {ativo && <span className="pl-filter-clear" onClick={() => { onLimpar(); setAberto(false) }}>Limpar período</span>}
        </div>
      )}
    </div>
  )
}

/* ============ FUNIL COMERCIAL ============ */
function rotuloMetaPL(meta: MetaFunilProLabore | undefined): string {
  if (!meta) return 'Meta: —'
  if (meta.tipoMeta === 'MAXIMO_CUSTO') return `Meta: ${formatMoeda(meta.metaCusto ?? 0)} (máx.)`
  if (meta.tipoMeta === 'MAXIMO_PERDA') return `Meta: ${formatPct(meta.metaPct)} (máx.)`
  return `Meta: ${formatPct(meta.metaPct)} (mín.)`
}

// Funil visual em CSS puro (trapézio por segmento via clip-path), mesmo
// formato do Funil de Vendas do CRM principal — a silhueta usa a altura
// ACUMULADA mínima (nunca alarga de novo, mesmo se algum filtro deixar os
// totais momentaneamente fora de ordem), enquanto os números exibidos
// continuam os reais, sem nenhum ajuste.
// Funil em Sankey suave (curvas de Bézier, não trapézios de arestas retas) —
// uma única forma contínua com um degradê também contínuo passando pela cor
// de cada etapa, no lugar de segmentos colados um no outro. É essa
// continuidade (forma fluida + degradê sem costura) que dá o acabamento
// "sofisticado" — o degradê em si é o que deixa visível a evolução do
// funil ao longo da jornada, não só o afunilamento da silhueta.
function FunilTrapezio({ valores, cores }: { valores: number[]; cores: string[] }) {
  const n = valores.length
  const W = 1000
  const H = 190
  const max = Math.max(1, ...valores)
  const ALTURA_MIN = 0.16
  // Silhueta nunca alarga de novo (só relevante se um filtro deixar os
  // totais momentaneamente fora de ordem — a jornada em si já é sequencial).
  const valoresVisuais: number[] = []
  for (const v of valores) {
    const anterior = valoresVisuais[valoresVisuais.length - 1] ?? v
    valoresVisuais.push(Math.min(v, anterior))
  }
  const alturas = valoresVisuais.map(v => ALTURA_MIN + (1 - ALTURA_MIN) * Math.sqrt(v / max))

  const stepX = W / (n - 1)
  const xAt = (i: number) => i * stepX
  const halfHAt = (i: number) => (alturas[i] * H) / 2
  const midY = H / 2
  const gradientId = 'jornadaGrad'

  let caminho = `M 0 ${midY - halfHAt(0)}`
  for (let i = 0; i < n - 1; i++) {
    const x1 = xAt(i), x2 = xAt(i + 1), midX = (x1 + x2) / 2
    caminho += ` C ${midX} ${midY - halfHAt(i)}, ${midX} ${midY - halfHAt(i + 1)}, ${x2} ${midY - halfHAt(i + 1)}`
  }
  caminho += ` L ${xAt(n - 1)} ${midY + halfHAt(n - 1)}`
  for (let i = n - 1; i > 0; i--) {
    const x1 = xAt(i), x2 = xAt(i - 1), midX = (x1 + x2) / 2
    caminho += ` C ${midX} ${midY + halfHAt(i)}, ${midX} ${midY + halfHAt(i - 1)}, ${x2} ${midY + halfHAt(i - 1)}`
  }
  caminho += ' Z'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 170, display: 'block' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          {cores.map((cor, i) => <stop key={i} offset={`${(i / (n - 1)) * 100}%`} stopColor={cor} />)}
        </linearGradient>
      </defs>
      <path d={caminho} fill={`url(#${gradientId})`} />
    </svg>
  )
}

function FunilJourney({
  funil, metas, custoPorLeadTopo, isDono, onMetaSalva, onCustoLeadSalvo,
}: {
  funil: MesPainel['funil']
  metas: MetaFunilProLabore[]
  custoPorLeadTopo: number
  isDono: boolean
  onMetaSalva: (m: MetaFunilProLabore) => void
  onCustoLeadSalvo: (v: number) => void
}) {
  const stages = [
    { key: 'leads', etapa: 'LEAD' as const, name: 'Leads', value: funil.leads },
    { key: 'abordados', etapa: 'ABORDADO' as const, name: 'Abordados', value: funil.abordados },
    { key: 'negociacao', etapa: 'NEGOCIACAO' as const, name: 'Negociação', value: funil.negociacao },
    { key: 'proposta', etapa: 'PROPOSTA' as const, name: 'Proposta', value: funil.proposta },
    { key: 'fechamento', etapa: 'FECHADO' as const, name: 'Fechamento', value: funil.fechamento },
  ]
  const totalLeads = stages[0].value
  const metaPorEtapa = new Map(metas.map(m => [m.etapa, m]))

  // Métricas derivadas de cada etapa, calculadas uma vez só e reaproveitadas
  // pelas três seções visuais (números do topo, funil trapézio e o painel
  // de meta/perda/custo) — evita recalcular a mesma coisa três vezes.
  const dados = stages.map((stage, i) => {
    // Limitado a 100% — LEAD→ABORDADO→NEGOCIACAO→PROPOSTA→FECHADO é
    // sequencial de verdade aqui (estagioAtingiu exige ter passado pelas
    // etapas anteriores), mas o cap evita qualquer número impossível se o
    // filtro de vendedor/canal cortar a base de um jeito que desalinhe
    // momentaneamente os totais.
    const convFromPrev = i === 0 ? 1 : (stages[i - 1].value > 0 ? Math.min(1, stage.value / stages[i - 1].value) : (stage.value > 0 ? 1 : 0))
    const perdaQuantidade = i === 0 ? null : Math.max(0, stages[i - 1].value - stage.value)
    const perdaPct = i === 0 ? null : 1 - convFromPrev
    const conversaoTotal = totalLeads > 0 ? stage.value / totalLeads : 0
    const custoPorLead = custoPorLeadTopo > 0 && conversaoTotal > 0 ? custoPorLeadTopo / conversaoTotal : null
    const meta = metaPorEtapa.get(stage.etapa)

    let statusOk: boolean | null = null
    if (meta) {
      if (meta.tipoMeta === 'MAXIMO_PERDA') statusOk = perdaPct == null ? null : perdaPct <= meta.metaPct
      else if (meta.tipoMeta === 'MAXIMO_CUSTO') statusOk = meta.metaCusto == null || custoPorLead == null ? null : custoPorLead <= meta.metaCusto
      else statusOk = conversaoTotal >= meta.metaPct
    }
    const cor = statusOk === true ? 'var(--pl-good)' : statusOk === false ? 'var(--pl-critical)' : 'var(--pl-accent)'

    return { ...stage, i, convFromPrev, perdaQuantidade, perdaPct, conversaoTotal, custoPorLead, meta, statusOk, cor }
  })

  const [editandoEtapa, setEditandoEtapa] = useState<(typeof ETAPAS_FUNIL_PL)[number] | null>(null)
  const [tipoMetaEdicao, setTipoMetaEdicao] = useState<TipoMetaFunilPL>('MINIMO')
  const [valorEdicao, setValorEdicao] = useState('')
  const [salvandoMeta, setSalvandoMeta] = useState(false)

  const [editandoCustoLead, setEditandoCustoLead] = useState(false)
  const [custoLeadValor, setCustoLeadValor] = useState('')
  const [salvandoCustoLead, setSalvandoCustoLead] = useState(false)

  function iniciarEdicaoMeta(etapa: (typeof ETAPAS_FUNIL_PL)[number]) {
    const meta = metaPorEtapa.get(etapa)
    setEditandoEtapa(etapa)
    setTipoMetaEdicao(meta?.tipoMeta ?? 'MINIMO')
    setValorEdicao(meta?.tipoMeta === 'MAXIMO_CUSTO' ? String(meta.metaCusto ?? 0) : String(Math.round((meta?.metaPct ?? 0) * 100)))
  }

  async function salvarMeta() {
    if (!editandoEtapa) return
    setSalvandoMeta(true)
    try {
      let atualizado: MetaFunilProLabore
      if (tipoMetaEdicao === 'MAXIMO_CUSTO') {
        const valor = Number(valorEdicao)
        if (!Number.isFinite(valor) || valor < 0) return
        atualizado = await proLaboreApi.funilMetas.atualizar(editandoEtapa, { tipoMeta: tipoMetaEdicao, metaCusto: valor })
      } else {
        const valor = Number(valorEdicao) / 100
        if (!Number.isFinite(valor) || valor < 0 || valor > 1) return
        atualizado = await proLaboreApi.funilMetas.atualizar(editandoEtapa, { tipoMeta: tipoMetaEdicao, metaPct: valor })
      }
      onMetaSalva(atualizado)
      setEditandoEtapa(null)
    } finally {
      setSalvandoMeta(false)
    }
  }

  function iniciarEdicaoCustoLead() {
    setCustoLeadValor(String(custoPorLeadTopo))
    setEditandoCustoLead(true)
  }

  async function salvarCustoLead() {
    const valor = Number(custoLeadValor)
    if (!Number.isFinite(valor) || valor < 0) return
    setSalvandoCustoLead(true)
    try {
      const atualizado = await proLaboreApi.parametros.atualizar({ custoPorLeadTopo: valor })
      onCustoLeadSalvo(atualizado.custoPorLeadTopo)
      setEditandoCustoLead(false)
    } finally {
      setSalvandoCustoLead(false)
    }
  }

  return (
    <div>
      {isDono && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <span className="pl-hint">Custo por lead (topo da jornada):</span>
          {editandoCustoLead ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number" step="0.01" min="0" autoFocus
                className="pl-input" style={{ width: 100, padding: '4px 8px' }}
                value={custoLeadValor} onChange={e => setCustoLeadValor(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && salvarCustoLead()}
              />
              <button type="button" className="pl-btn pl-btn-primary" disabled={salvandoCustoLead} onClick={salvarCustoLead} style={{ padding: '4px 10px' }}>OK</button>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setEditandoCustoLead(false)} style={{ padding: '4px 10px' }}>Cancelar</button>
            </div>
          ) : (
            <span className="pl-link-action" onClick={iniciarEdicaoCustoLead} style={{ fontWeight: 600 }}>
              {formatMoeda(custoPorLeadTopo)} ✎
            </span>
          )}
        </div>
      )}

      {/* Bloco 1: nomes das etapas, com divisórias verticais — mesmo topo do
          gráfico de referência. */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${dados.length}, 1fr)` }}>
        {dados.map((d, i) => (
          <div key={d.key} style={{ textAlign: 'center', paddingBottom: 10, borderLeft: i > 0 ? '1px solid var(--pl-border)' : 'none' }}>
            <div className="pl-stage-name">{d.name}</div>
          </div>
        ))}
      </div>

      {/* Bloco 2: funil em Sankey suave, com a % de cada etapa sobreposta
          dentro da própria faixa colorida — mesmo formato do gráfico de
          referência. */}
      <div style={{ position: 'relative' }}>
        <FunilTrapezio valores={dados.map(d => d.value)} cores={dados.map(d => d.cor)} />
        <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${dados.length}, 1fr)`, alignItems: 'center' }}>
          {dados.map(d => (
            <div key={d.key} className="pl-mono" style={{ textAlign: 'center', fontWeight: 800, fontSize: 17, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.45)' }}>
              {formatPct(d.conversaoTotal)}
            </div>
          ))}
        </div>
      </div>

      {/* Bloco 3: valor bruto de cada etapa, logo abaixo do funil. */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${dados.length}, 1fr)`, marginTop: 10 }}>
        {dados.map(d => (
          <div key={d.key} className="pl-stage-value pl-mono" style={{ textAlign: 'center', fontSize: 20 }}>{d.value.toLocaleString('pt-BR')}</div>
        ))}
      </div>

      {/* Bloco 4: conversão da etapa anterior, perda, meta (editável) e
          custo por lead — por etapa. */}
      <div className="pl-journey-details" style={{ display: 'grid', gridTemplateColumns: `repeat(${dados.length}, 1fr)`, gap: 4, marginTop: 4 }}>
        {dados.map(d => (
          <div key={d.key} style={{ textAlign: 'center' }}>
            <div className="pl-stage-conv">
              {d.i === 0 ? 'topo do funil' : <>conv. anterior <b>{(d.convFromPrev * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</b></>}
            </div>

            {d.i > 0 && (
              <div className="pl-stage-conv">
                Perda <b>{d.perdaQuantidade} ({formatPct(d.perdaPct ?? 0)})</b>
              </div>
            )}

            {editandoEtapa === d.etapa ? (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                <select
                  className="pl-select" style={{ fontSize: 11, padding: '2px 4px' }}
                  value={tipoMetaEdicao} onChange={e => setTipoMetaEdicao(e.target.value as TipoMetaFunilPL)}
                >
                  <option value="MINIMO">Conversão mín.</option>
                  <option value="MAXIMO_PERDA">Perda máx.</option>
                  <option value="MAXIMO_CUSTO">Custo máx.</option>
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {tipoMetaEdicao === 'MAXIMO_CUSTO' && <span className="pl-hint">R$</span>}
                  <input
                    type="number" autoFocus className="pl-input" style={{ width: 56, padding: '2px 4px', fontSize: 11, textAlign: 'center' }}
                    value={valorEdicao} onChange={e => setValorEdicao(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && salvarMeta()}
                  />
                  {tipoMetaEdicao !== 'MAXIMO_CUSTO' && <span className="pl-hint">%</span>}
                  <button type="button" className="pl-link-action" disabled={salvandoMeta} onClick={salvarMeta}>OK</button>
                </div>
              </div>
            ) : (
              <div className="pl-stage-conv" style={{ marginTop: 6 }}>
                {isDono ? (
                  <span className="pl-link-action" onClick={() => iniciarEdicaoMeta(d.etapa)}>{rotuloMetaPL(d.meta)} ✎</span>
                ) : (
                  <span>{rotuloMetaPL(d.meta)}</span>
                )}
                {d.statusOk != null && <span className={`pl-delta ${d.statusOk ? 'up' : 'down'}`} style={{ marginLeft: 6 }}>{d.statusOk ? 'ok' : 'fora'}</span>}
              </div>
            )}

            {d.custoPorLead != null && (
              <div className="pl-stage-conv">
                Custo/lead <b>{formatMoeda(d.custoPorLead)}</b>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============ RANKING DE VENDEDORES ============ */
function SellerLeaderboard({ vendedores }: { vendedores: VendedorRanking[] }) {
  if (vendedores.length === 0) {
    return <div className="pl-empty"><div className="pl-emoji">🏍️</div>Nenhuma venda com vendedor atribuído neste mês.</div>
  }
  const maxRev = vendedores[0].receita

  return (
    <div>
      {vendedores.map((s, i) => {
        const wpct = maxRev > 0 ? (s.receita / maxRev) * 100 : 0
        return (
          <div key={s.id} className="pl-seller-row">
            <div className={`pl-rank ${i === 0 ? 'top' : ''}`}>{i + 1}</div>
            <div className="pl-seller-main">
              <div className="pl-seller-top">
                <div className="pl-seller-name">
                  <span className="pl-avatar" style={{ background: AVATAR_CORES[i % AVATAR_CORES.length] }}>{initials(s.nome)}</span>
                  {s.nome}
                </div>
                <div className="pl-seller-figs">{formatMoeda(s.receita)}</div>
              </div>
              <div className="pl-bar-track"><div className="pl-bar-fill" style={{ width: `${wpct}%` }} /></div>
            </div>
            <div className="pl-seller-meta">{s.quantidadeVendas} venda{s.quantidadeVendas !== 1 ? 's' : ''}<br />comissão {formatMoedaCompacta(s.comissaoPaga)}</div>
          </div>
        )
      })}
    </div>
  )
}

/* ============ ROAS (barras) ============ */
function RoasBars({ meses, selectedIdx }: { meses: MesPainel[]; selectedIdx: number }) {
  const maxV = Math.max(...meses.map(m => m.roas), 1) * 1.1
  return (
    <div className="pl-roas-bars">
      {meses.map((m, i) => {
        const hpct = (m.roas / maxV) * 100
        return (
          <div key={m.mes} className="pl-roas-col">
            <span className="pl-roas-val">{m.roas.toFixed(1)}×</span>
            <div className="pl-roas-bar" style={{ height: `${hpct}%`, opacity: i === selectedIdx ? 1 : 0.55 }} />
            <span className="pl-roas-lbl">{m.label}</span>
          </div>
        )
      })}
    </div>
  )
}
