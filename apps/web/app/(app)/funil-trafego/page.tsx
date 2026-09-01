'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, ConversaoTrafego, EtapaConversaoTrafego, MetricaTrafegoPago, StatusIntegracaoAnuncio } from '@/lib/api'
import { useAuth } from '@/lib/auth'

const STATUS_COR = '#3b82f6'

// Mesmo conjunto de papéis exigido pelo backend (requirePapel(...PAPEIS_GESTAO)
// em routes/integracoesAnuncio.ts) — só esconde o botão de quem não pode
// clicar, a permissão de verdade continua sendo checada na API.
const PAPEIS_GESTAO_INTEGRACAO = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL']

const PRESETS = [
  { id: 'tudo', label: 'Tudo' },
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mês' },
] as const

const PLATAFORMAS = [
  { id: 'META', label: 'Meta Ads', disponivel: true },
  { id: 'GOOGLE', label: 'Google Ads', disponivel: false },
  { id: 'TIKTOK', label: 'TikTok Ads', disponivel: false },
] as const

function isoData(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function periodoDoPreset(id: string): { inicio?: string; fim?: string } {
  const hoje = new Date()
  if (id === 'hoje') return { inicio: isoData(hoje), fim: isoData(hoje) }
  if (id === 'semana') return { inicio: isoData(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - hoje.getDay())), fim: isoData(hoje) }
  if (id === 'mes') return { inicio: isoData(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fim: isoData(hoje) }
  return {}
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

function moeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const FORM_VAZIO = { data: isoData(new Date()), plataforma: 'META', campanha: '', impressoes: '', cliques: '', visitasLp: '', leadsCapturados: '', valorInvestido: '', observacoes: '' }

export default function FunilTrafegoPage() {
  const { user } = useAuth()
  const podeGerenciarIntegracao = PAPEIS_GESTAO_INTEGRACAO.includes(user?.papel ?? '')
  const [dados, setDados] = useState<ConversaoTrafego | null>(null)
  const [metricas, setMetricas] = useState<MetricaTrafegoPago[]>([])
  const [campanhas, setCampanhas] = useState<string[]>([])
  const [integracao, setIntegracao] = useState<StatusIntegracaoAnuncio | null>(null)
  const [conectando, setConectando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [avisoRedirect, setAvisoRedirect] = useState<'conectada' | 'erro' | null>(null)
  const [loading, setLoading] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [periodo, setPeriodo] = useState<{ inicio?: string; fim?: string }>({})
  const [presetAtivo, setPresetAtivo] = useState<string>('tudo')
  const [customInicio, setCustomInicio] = useState('')
  const [customFim, setCustomFim] = useState('')
  const [plataforma, setPlataforma] = useState<string>('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => {
    return Promise.all([
      api.funilTrafego.conversao({ ...periodo, plataforma: plataforma || undefined }),
      api.funilTrafego.metricas(),
      api.funilTrafego.campanhas(),
      api.integracoesAnuncio.status(),
    ]).then(([conversao, lista, nomesCampanha, statusIntegracao]) => {
      setDados(conversao)
      setMetricas(lista)
      setCampanhas(nomesCampanha)
      setIntegracao(statusIntegracao)
    }).finally(() => setLoading(false))
  }, [periodo, plataforma])

  useEffect(() => { carregar() }, [carregar])

  // O callback OAuth (routes/integracoesAnuncio.ts) redireciona de volta pra
  // cá com ?integracao=conectada|erro — lê direto da URL (sem useSearchParams,
  // pra não depender de API do Next que pode ter mudado nesta versão) e
  // limpa o parâmetro, senão o aviso reaparece a cada refresh da página.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const resultado = params.get('integracao')
    if (resultado === 'conectada' || resultado === 'erro') {
      setAvisoRedirect(resultado)
      params.delete('integracao')
      const query = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''))
    }
  }, [])

  async function conectarMetaAds() {
    setConectando(true)
    try {
      const { url } = await api.integracoesAnuncio.iniciarConexao()
      window.location.href = url
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível iniciar a conexão com o Meta Ads.')
      setConectando(false)
    }
  }

  async function desconectarMetaAds() {
    if (!window.confirm('Desconectar o Meta Ads? A sincronização automática para até reconectar.')) return
    await api.integracoesAnuncio.desconectar()
    await carregar()
  }

  async function sincronizarAgora() {
    setSincronizando(true)
    try {
      await api.integracoesAnuncio.sincronizar()
      await carregar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível sincronizar com o Meta Ads.')
    } finally {
      setSincronizando(false)
    }
  }

  async function atualizarManualmente() {
    setAtualizando(true)
    try {
      await carregar()
    } finally {
      setAtualizando(false)
    }
  }

  function selecionarPreset(id: string) {
    setPresetAtivo(id)
    setCustomInicio('')
    setCustomFim('')
    setPeriodo(periodoDoPreset(id))
  }

  function aplicarCustom() {
    if (!customInicio && !customFim) return
    setPresetAtivo('custom')
    setPeriodo({ inicio: customInicio || undefined, fim: customFim || undefined })
  }

  async function salvarLancamento(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await api.funilTrafego.registrarMetrica({
        data: form.data,
        plataforma: form.plataforma,
        campanha: form.campanha.trim() || undefined,
        impressoes: Number(form.impressoes) || 0,
        cliques: Number(form.cliques) || 0,
        visitasLp: Number(form.visitasLp) || 0,
        leadsCapturados: Number(form.leadsCapturados) || 0,
        valorInvestido: Number(form.valorInvestido) || 0,
        observacoes: form.observacoes || undefined,
      })
      setForm(FORM_VAZIO)
      setMostrarForm(false)
      await carregar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar o lançamento.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluirLancamento(id: string) {
    if (!window.confirm('Excluir este lançamento?')) return
    await api.funilTrafego.excluirMetrica(id)
    await carregar()
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Funil de Tráfego Pago</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Jornada do anúncio até virar Lead — Impressões, Cliques e Leads capturados pelo gerenciador de anúncios, comparados com quem de fato entrou no CRM
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setMostrarForm(v => !v)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Lançar dados do dia
          </button>
          <button
            onClick={atualizarManualmente}
            disabled={atualizando}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {atualizando ? 'Atualizando...' : '🔄 Atualizar'}
          </button>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4 flex items-center justify-between gap-2">
          <span>{erro}</span>
          <button onClick={() => setErro('')} className="text-red-500 hover:text-red-700 shrink-0">✕</button>
        </div>
      )}

      {avisoRedirect === 'conectada' && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 mb-4">
          ✅ Meta Ads conectado com sucesso. Clique em &quot;Sincronizar agora&quot; para puxar os números.
        </div>
      )}
      {avisoRedirect === 'erro' && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
          Não foi possível conectar ao Meta Ads. Tente novamente ou avise o administrador do sistema.
        </div>
      )}

      <IntegracaoMetaAdsCard
        integracao={integracao}
        podeGerenciar={podeGerenciarIntegracao}
        conectando={conectando}
        sincronizando={sincronizando}
        onConectar={conectarMetaAds}
        onDesconectar={desconectarMetaAds}
        onSincronizar={sincronizarAgora}
      />

      {/* Período de análise */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => selecionarPreset(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              presetAtivo === p.id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5 ml-1">
          <input
            type="date" value={customInicio} onChange={e => setCustomInicio(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
          />
          <span className="text-xs text-gray-400">até</span>
          <input
            type="date" value={customFim} onChange={e => setCustomFim(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
          />
          <button
            onClick={aplicarCustom}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              presetAtivo === 'custom' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Aplicar período
          </button>
        </div>
      </div>

      {/* Plataforma */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-xs text-gray-400 mr-1">Plataforma:</span>
        <button
          onClick={() => setPlataforma('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            plataforma === '' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Todas
        </button>
        {PLATAFORMAS.map(p => (
          <button
            key={p.id}
            onClick={() => p.disponivel && setPlataforma(p.id)}
            disabled={!p.disponivel}
            title={p.disponivel ? undefined : 'Em breve'}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              plataforma === p.id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            } ${!p.disponivel ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {p.label}{!p.disponivel ? ' (em breve)' : ''}
          </button>
        ))}
      </div>

      {mostrarForm && (
        <form onSubmit={salvarLancamento} className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Campo label="Data">
              <input type="date" required value={form.data} onChange={e => setForm({ ...form, data: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            </Campo>
            <Campo label="Plataforma">
              <select value={form.plataforma} onChange={e => setForm({ ...form, plataforma: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
                {PLATAFORMAS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Campo>
            <Campo label="Campanha">
              <input type="text" list="campanhas-trafego" value={form.campanha} onChange={e => setForm({ ...form, campanha: e.target.value })}
                placeholder="Ex: Promoção CG 160 — Setembro"
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
              <datalist id="campanhas-trafego">
                {campanhas.map(c => <option key={c} value={c} />)}
              </datalist>
            </Campo>
            <Campo label="Impressões">
              <input type="number" min={0} value={form.impressoes} onChange={e => setForm({ ...form, impressoes: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            </Campo>
            <Campo label="Cliques">
              <input type="number" min={0} value={form.cliques} onChange={e => setForm({ ...form, cliques: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            </Campo>
            <Campo label="Visitas à LP">
              <input type="number" min={0} value={form.visitasLp} onChange={e => setForm({ ...form, visitasLp: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            </Campo>
            <Campo label="Leads capturados">
              <input type="number" min={0} value={form.leadsCapturados} onChange={e => setForm({ ...form, leadsCapturados: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            </Campo>
            <Campo label="Valor investido (R$)">
              <input type="number" min={0} step="0.01" value={form.valorInvestido} onChange={e => setForm({ ...form, valorInvestido: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            </Campo>
            <Campo label="Observações">
              <input type="text" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            </Campo>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button type="submit" disabled={salvando}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {salvando ? 'Salvando...' : 'Salvar lançamento'}
            </button>
            <button type="button" onClick={() => setMostrarForm(false)}
              className="text-sm text-gray-500 hover:text-gray-700">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {dados && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${dados.etapas.length}, 1fr)` }}>
            {dados.etapas.map(e => (
              <div key={e.estagio} className="text-center px-1">
                <div className="text-2xl font-bold text-gray-900">{e.quantidade}</div>
                <div className="text-xs text-gray-500 truncate" title={e.label}>{e.label}</div>
                <div className="text-sm font-semibold text-blue-600">{pct(e.conversaoReal)}</div>
              </div>
            ))}
          </div>

          <FunnelChart etapas={dados.etapas} />

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-gray-100">
            <Metrica label="Investido" valor={moeda(dados.valorInvestido)} />
            <Metrica label="CTR" valor={pct(dados.ctr)} />
            <Metrica label="CPC" valor={moeda(dados.cpc)} />
            <Metrica label="CPL (plataforma)" valor={moeda(dados.cpl)} />
            <Metrica label="Custo por Lead no CRM" valor={moeda(dados.custoPorLeadCrm)} destaque />
          </div>

          <div className="mt-4 bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-600">
            <strong>{pct(dados.taxaLeadPlataformaParaCrm)}</strong> dos leads que a plataforma reportou como resultado realmente viraram Oportunidade no CRM.
            {dados.taxaLeadPlataformaParaCrm < 0.7 && dados.etapas.find(e => e.estagio === 'LEADS_CAPTURADOS')!.quantidade > 0 && (
              <span> Vale investigar a diferença — pode ser atraso no cadastro, lead descartado sem registrar, ou lead de baixa qualidade vindo da campanha.</span>
            )}
          </div>
        </div>
      )}

      {dados && dados.porCampanha.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Por campanha</h2>
          <p className="text-xs text-gray-500 mb-3">
            &quot;Leads no CRM&quot; só bate com uma campanha quando o nome lançado aqui é igual ao escolhido no cadastro do lead (campo Campanha, em Novo Lead).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-3 font-medium">Campanha</th>
                  <th className="py-2 pr-3 font-medium text-right">Investido</th>
                  <th className="py-2 pr-3 font-medium text-right">Leads (plataforma)</th>
                  <th className="py-2 pr-3 font-medium text-right">Leads no CRM</th>
                  <th className="py-2 pr-3 font-medium text-right">CPL</th>
                  <th className="py-2 pr-3 font-medium text-right">Custo/Lead no CRM</th>
                </tr>
              </thead>
              <tbody>
                {dados.porCampanha.map(c => (
                  <tr key={c.campanha || '—'} className="border-b border-gray-50">
                    <td className="py-2 pr-3">{c.campanha || 'Sem campanha definida'}</td>
                    <td className="py-2 pr-3 text-right">{moeda(c.valorInvestido)}</td>
                    <td className="py-2 pr-3 text-right">{c.leadsCapturados}</td>
                    <td className="py-2 pr-3 text-right">{c.leadsCrm}</td>
                    <td className="py-2 pr-3 text-right">{moeda(c.cpl)}</td>
                    <td className="py-2 pr-3 text-right font-medium">{moeda(c.custoPorLeadCrm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Lançamentos</h2>
        {metricas.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum lançamento ainda. Use &quot;+ Lançar dados do dia&quot; para começar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-3 font-medium">Data</th>
                  <th className="py-2 pr-3 font-medium">Plataforma</th>
                  <th className="py-2 pr-3 font-medium">Campanha</th>
                  <th className="py-2 pr-3 font-medium text-right">Impressões</th>
                  <th className="py-2 pr-3 font-medium text-right">Cliques</th>
                  <th className="py-2 pr-3 font-medium text-right">Visitas LP</th>
                  <th className="py-2 pr-3 font-medium text-right">Leads</th>
                  <th className="py-2 pr-3 font-medium text-right">Investido</th>
                  <th className="py-2 pr-3 font-medium">Quem lançou</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {metricas.map(m => (
                  <tr key={m.id} className="border-b border-gray-50">
                    <td className="py-2 pr-3">{new Date(m.data).toLocaleDateString('pt-BR')}</td>
                    <td className="py-2 pr-3">{PLATAFORMAS.find(p => p.id === m.plataforma)?.label ?? m.plataforma}</td>
                    <td className="py-2 pr-3 text-gray-600">{m.campanha || '—'}</td>
                    <td className="py-2 pr-3 text-right">{m.impressoes}</td>
                    <td className="py-2 pr-3 text-right">{m.cliques}</td>
                    <td className="py-2 pr-3 text-right">{m.visitasLp}</td>
                    <td className="py-2 pr-3 text-right">{m.leadsCapturados}</td>
                    <td className="py-2 pr-3 text-right">{moeda(m.valorInvestido)}</td>
                    <td className="py-2 pr-3 text-gray-500">{m.usuario?.nome ?? '—'}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => excluirLancamento(m.id)} className="text-xs text-red-500 hover:text-red-700">
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function IntegracaoMetaAdsCard({
  integracao,
  podeGerenciar,
  conectando,
  sincronizando,
  onConectar,
  onDesconectar,
  onSincronizar,
}: {
  integracao: StatusIntegracaoAnuncio | null
  podeGerenciar: boolean
  conectando: boolean
  sincronizando: boolean
  onConectar: () => void
  onDesconectar: () => void
  onSincronizar: () => void
}) {
  if (!integracao) return null

  if (!integracao.configurada) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-600 mb-6">
        Fase manual: os números abaixo vêm do que você lança a partir do gerenciador de anúncios (Meta Ads). A conexão automática ainda não foi configurada pelo administrador do sistema — a estrutura já é a definitiva, só falta ligar a extração automática.
      </div>
    )
  }

  if (integracao.status === 'CONECTADO') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6 flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-green-800">
          <strong>Meta Ads conectado</strong> — conta {integracao.contaAnuncioNome ?? '—'}
          {integracao.conectadoPor && <span className="text-green-700"> (por {integracao.conectadoPor.nome})</span>}
          <div className="text-xs text-green-700 mt-0.5">
            {integracao.ultimaSincronizacaoEm
              ? `Última sincronização: ${new Date(integracao.ultimaSincronizacaoEm).toLocaleString('pt-BR')}`
              : 'Ainda não sincronizado — clique em "Sincronizar agora".'}
          </div>
        </div>
        {podeGerenciar && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onSincronizar}
              disabled={sincronizando}
              className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {sincronizando ? 'Sincronizando...' : 'Sincronizar agora'}
            </button>
            <button onClick={onDesconectar} className="text-xs text-green-700 hover:text-green-900 underline">
              Desconectar
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 flex items-center justify-between flex-wrap gap-2">
      <div className="text-sm text-amber-800">
        Fase manual: os números abaixo vêm do que você lança a partir do gerenciador de anúncios.
        {integracao.status === 'ERRO' && integracao.ultimoErro && (
          <div className="text-xs text-red-700 mt-0.5">Última tentativa falhou: {integracao.ultimoErro}</div>
        )}
        {!podeGerenciar && <div className="text-xs text-amber-700 mt-0.5">Só Administrador, Diretor ou Gerente Comercial podem conectar.</div>}
      </div>
      {podeGerenciar && (
        <button
          onClick={onConectar}
          disabled={conectando}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
        >
          {conectando ? 'Conectando...' : 'Conectar Meta Ads'}
        </button>
      )}
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  )
}

function Metrica({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <div className={`text-lg font-bold ${destaque ? 'text-blue-600' : 'text-gray-900'}`}>{valor}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

/** Funil visual em CSS puro — mesmo padrão do Funil de Vendas (clip-path por
 * segmento), sem depender de biblioteca de gráficos. */
function FunnelChart({ etapas }: { etapas: EtapaConversaoTrafego[] }) {
  const max = Math.max(1, ...etapas.map(e => e.quantidade))
  const ALTURA_MIN = 0.08
  const quantidadesVisuais: number[] = []
  for (const e of etapas) {
    const anterior = quantidadesVisuais[quantidadesVisuais.length - 1] ?? e.quantidade
    quantidadesVisuais.push(Math.min(e.quantidade, anterior))
  }
  const alturas = quantidadesVisuais.map(q => ALTURA_MIN + (1 - ALTURA_MIN) * Math.sqrt(q / max))
  const n = etapas.length

  return (
    <div className="relative h-40 mt-3 flex">
      {etapas.slice(0, n - 1).map((e, i) => {
        const h1 = alturas[i] * 100
        const h2 = alturas[i + 1] * 100
        return (
          <div
            key={e.estagio}
            className="flex-1 h-full"
            style={{
              clipPath: `polygon(0% ${50 - h1 / 2}%, 100% ${50 - h2 / 2}%, 100% ${50 + h2 / 2}%, 0% ${50 + h1 / 2}%)`,
              background: `linear-gradient(to right, ${STATUS_COR}, ${STATUS_COR})`,
              opacity: 0.5 + 0.5 * (i / Math.max(1, n - 2)),
            }}
          />
        )
      })}
    </div>
  )
}
