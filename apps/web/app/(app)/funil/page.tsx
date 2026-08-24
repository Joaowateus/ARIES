'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, ConversaoFunil, EtapaConversao } from '@/lib/api'
import { useAuth } from '@/lib/auth'

const PAPEIS_GESTAO = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL']

const STATUS_COR: Record<string, string> = { verde: '#22c55e', amarelo: '#f59e0b', vermelho: '#ef4444' }
const STATUS_TEXTO: Record<string, string> = { verde: 'text-green-600', amarelo: 'text-amber-600', vermelho: 'text-red-600' }

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

type CampoEdicao = 'meta' | 'sla'

export default function FunilVendasPage() {
  const { user } = useAuth()
  const [dados, setDados] = useState<ConversaoFunil | null>(null)
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<{ etapa: string; campo: CampoEdicao } | null>(null)
  const [valorEdicao, setValorEdicao] = useState('')
  const [atualizando, setAtualizando] = useState(false)

  const podeGerenciar = PAPEIS_GESTAO.includes(user?.papel ?? '')

  const carregar = useCallback(() => {
    return api.funil.conversao().then(setDados).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function atualizarManualmente() {
    setAtualizando(true)
    try {
      await carregar()
    } finally {
      setAtualizando(false)
    }
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
                    disabled={!podeGerenciar}
                    onClick={() => iniciarEdicao(e.estagio, 'meta', e.meta)}
                    className="text-[11px] text-gray-400 disabled:cursor-default hover:text-blue-600 block w-full"
                  >
                    Meta: {pct(e.meta)}{e.tipoMeta === 'MAXIMO_PERDA' ? ' (máx.)' : ' (mín.)'}{podeGerenciar && ' ✎'}
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
                    disabled={!podeGerenciar}
                    onClick={() => iniciarEdicao(e.estagio, 'sla', e.tempoMaximoDias ?? null)}
                    className="text-[11px] text-gray-400 disabled:cursor-default hover:text-blue-600 block w-full"
                  >
                    Prazo: {e.tempoMaximoDias != null ? `${e.tempoMaximoDias}d` : '—'}{podeGerenciar && ' ✎'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
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
