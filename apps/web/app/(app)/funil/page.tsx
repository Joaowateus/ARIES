'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, ConversaoFunil, EtapaConversao, Usuario } from '@/lib/api'
import { useAuth } from '@/lib/auth'

const PAPEIS_GESTAO = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL', 'SUPERVISOR', 'COORDENADOR']

const STATUS_COR: Record<string, string> = { verde: '#22c55e', amarelo: '#f59e0b', vermelho: '#ef4444' }
const STATUS_TEXTO: Record<string, string> = { verde: 'text-green-600', amarelo: 'text-amber-600', vermelho: 'text-red-600' }

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

type CampoEdicao = 'meta' | 'sla'

const PRESETS = [
  { id: 'tudo', label: 'Tudo' },
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mês' },
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

export default function FunilVendasPage() {
  const { user } = useAuth()
  const [dados, setDados] = useState<ConversaoFunil | null>(null)
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<{ etapa: string; campo: CampoEdicao } | null>(null)
  const [valorEdicao, setValorEdicao] = useState('')
  const [atualizando, setAtualizando] = useState(false)
  const [limpando, setLimpando] = useState(false)
  const [periodo, setPeriodo] = useState<{ inicio?: string; fim?: string }>({})
  const [presetAtivo, setPresetAtivo] = useState<string>('tudo')
  const [customInicio, setCustomInicio] = useState('')
  const [customFim, setCustomFim] = useState('')
  const [tipoLead, setTipoLead] = useState<string>('')
  const [vendedorId, setVendedorId] = useState<string>('')
  const [vendedores, setVendedores] = useState<Usuario[]>([])

  const podeFiltrarVendedor = PAPEIS_GESTAO.includes(user?.papel ?? '')

  const carregar = useCallback(() => {
    return api.funil.conversao({ ...periodo, tipoLead: tipoLead || undefined, vendedorId: vendedorId || undefined }).then(setDados).finally(() => setLoading(false))
  }, [periodo, tipoLead, vendedorId])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (podeFiltrarVendedor) api.usuarios.listar().then(setVendedores)
  }, [podeFiltrarVendedor])

  async function atualizarManualmente() {
    setAtualizando(true)
    try {
      await carregar()
    } finally {
      setAtualizando(false)
    }
  }

  async function limparHistorico() {
    const digitado = window.prompt(
      'Isso apaga TODO o seu histórico — todo lead, contrato (mesmo já fechado), atividade e o total de leads registrados. Não tem como desfazer.\n\n' +
      'Digite APAGAR para confirmar:'
    )
    if (digitado?.trim().toUpperCase() !== 'APAGAR') return
    setLimpando(true)
    try {
      const resultado = await api.oportunidades.limparHistorico()
      window.alert(
        `Histórico limpo: ${resultado.oportunidadesApagadas} oportunidade(s), ${resultado.contratosApagados} contrato(s) e ${resultado.leadsApagados} lead(s) registrado(s) apagados.`
      )
      await carregar()
    } finally {
      setLimpando(false)
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

  function iniciarEdicao(etapa: string, campo: CampoEdicao, valorAtual: number | null) {
    setEditando({ etapa, campo })
    setValorEdicao(campo === 'meta' ? String(Math.round((valorAtual ?? 0) * 100)) : String(valorAtual ?? ''))
  }

  async function salvarEdicao() {
    if (!editando) return
    if (editando.campo === 'meta') {
      const valor = Number(valorEdicao) / 100
      if (!Number.isFinite(valor) || valor < 0 || valor > 1) return
      await api.funil.atualizarMeta(editando.etapa, { metaPct: valor })
    } else {
      const dias = valorEdicao.trim() === '' ? null : Number(valorEdicao)
      if (dias !== null && (!Number.isFinite(dias) || dias <= 0)) return
      await api.funil.atualizarMeta(editando.etapa, { tempoMaximoDias: dias })
    }
    setEditando(null)
    carregar()
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Funil de Vendas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Conversão por fase, a partir do total de leads que entraram no funil — direto do CRM
          </p>
        </div>
        <button
          onClick={atualizarManualmente}
          disabled={atualizando}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors shrink-0"
        >
          {atualizando ? 'Atualizando...' : '🔄 Atualizar'}
        </button>
      </div>

      {/* Período de análise */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
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

      {/* Origem do lead — pago (tráfego) vs orgânico */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-gray-400 mr-1">Origem:</span>
        {[
          { id: '', label: 'Todos' },
          { id: 'TRAFEGO', label: 'Tráfego pago' },
          { id: 'ORGANICO', label: 'Orgânico' },
        ].map(op => (
          <button
            key={op.id || 'todos'}
            onClick={() => setTipoLead(op.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tipoLead === op.id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {op.label}
          </button>
        ))}
      </div>

      {/* Vendedor — só pra quem tem visão de equipe/empresa */}
      {podeFiltrarVendedor && (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs text-gray-400 mr-1">Vendedor:</span>
          <select
            value={vendedorId}
            onChange={e => setVendedorId(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700"
          >
            <option value="">Todos</option>
            {vendedores.map(v => (
              <option key={v.id} value={v.id}>{v.nome}</option>
            ))}
          </select>
        </div>
      )}

      {dados && dados.totalLeads < 5 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700 mb-6">
          Ainda há poucos leads no histórico ({dados.totalLeads}) para uma leitura de conversão confiável. Os números vão ganhar precisão conforme o funil for usado.
        </div>
      )}

      {dados && dados.etapas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {/* Colunas com números */}
          <div className="grid" style={{ gridTemplateColumns: `repeat(${dados.etapas.length}, 1fr)` }}>
            {dados.etapas.map(e => (
              <div key={e.estagio} className="text-center px-1">
                <div className="text-2xl font-bold text-gray-900">{e.quantidade}</div>
                <div className="text-xs text-gray-500 truncate" title={e.label}>{e.label}</div>
                <div className={`text-sm font-semibold ${STATUS_TEXTO[e.status]}`}>{pct(e.conversaoReal)}</div>
              </div>
            ))}
          </div>

          {/* Gráfico de funil */}
          <FunnelChart etapas={dados.etapas} />

          {/* Metas, tempo médio e SLA por etapa */}
          <div className="grid gap-1 mt-2" style={{ gridTemplateColumns: `repeat(${dados.etapas.length}, 1fr)` }}>
            {dados.etapas.map(e => (
              <div key={e.estagio} className="text-center space-y-0.5">
                {editando?.etapa === e.estagio && editando.campo === 'meta' ? (
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number" autoFocus value={valorEdicao} onChange={ev => setValorEdicao(ev.target.value)}
                      onKeyDown={ev => ev.key === 'Enter' && salvarEdicao()}
                      className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs text-center"
                    />
                    <button onClick={salvarEdicao} className="text-xs text-blue-600 font-medium">OK</button>
                  </div>
                ) : (
                  <button
                    onClick={() => iniciarEdicao(e.estagio, 'meta', e.meta)}
                    className="text-[11px] text-gray-400 hover:text-blue-600 block w-full"
                  >
                    Meta: {pct(e.meta)}{e.tipoMeta === 'MAXIMO_PERDA' ? ' (máx.)' : ' (mín.)'} ✎
                  </button>
                )}

                {e.tempoMedioDias != null && (
                  <div className="text-[11px] text-gray-400">
                    ⏱ média: {Math.round(e.tempoMedioDias * 10) / 10}d
                  </div>
                )}

                {editando?.etapa === e.estagio && editando.campo === 'sla' ? (
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number" autoFocus value={valorEdicao} onChange={ev => setValorEdicao(ev.target.value)}
                      onKeyDown={ev => ev.key === 'Enter' && salvarEdicao()}
                      placeholder="dias" className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs text-center"
                    />
                    <button onClick={salvarEdicao} className="text-xs text-blue-600 font-medium">OK</button>
                  </div>
                ) : (
                  <button
                    onClick={() => iniciarEdicao(e.estagio, 'sla', e.tempoMaximoDias ?? null)}
                    className="text-[11px] text-gray-400 hover:text-blue-600 block w-full"
                  >
                    Prazo: {e.tempoMaximoDias != null ? `${e.tempoMaximoDias}d` : '—'} ✎
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zona de risco — reset total, separado do resto pra não confundir com
          o "Atualizar" nem virar clique acidental. */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between gap-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <div>
            <div className="text-sm font-medium text-red-800">Limpar histórico</div>
            <p className="text-xs text-red-600 mt-0.5">
              Última instância, pra reorganizar tudo do zero: apaga só o seu próprio CRM e Funil (leads, contratos, mesmo os fechados). Não afeta o de outros vendedores.
            </p>
          </div>
          <button
            onClick={limparHistorico}
            disabled={limpando}
            className="bg-white border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-colors shrink-0"
          >
            {limpando ? 'Limpando...' : 'Limpar histórico'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Funil visual em CSS puro: um trapézio por segmento (clip-path), conectando
 * a altura de uma etapa à próxima — sem depender de biblioteca de gráficos. */
function FunnelChart({ etapas }: { etapas: EtapaConversao[] }) {
  const max = Math.max(1, ...etapas.map(e => e.quantidade))
  const ALTURA_MIN = 0.08
  // Um lead pode pular etapa (o CRM permite mover pra qualquer coluna), então
  // "quantos alcançaram cada etapa" nem sempre decresce estritamente. Um funil
  // só faz sentido visualmente se ele nunca alarga de novo — por isso a altura
  // usa o mínimo acumulado (nunca passa da etapa anterior). Os números e %
  // exibidos continuam os reais, sem nenhum ajuste; só a silhueta é suavizada.
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
        const corDestino = STATUS_COR[etapas[i + 1].status]
        return (
          <div
            key={e.estagio}
            className="flex-1 h-full"
            style={{
              clipPath: `polygon(0% ${50 - h1 / 2}%, 100% ${50 - h2 / 2}%, 100% ${50 + h2 / 2}%, 0% ${50 + h1 / 2}%)`,
              background: `linear-gradient(to right, ${STATUS_COR[e.status]}, ${corDestino})`,
            }}
          />
        )
      })}
    </div>
  )
}
