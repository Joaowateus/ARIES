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

export default function FunilVendasPage() {
  const { user } = useAuth()
  const [dados, setDados] = useState<ConversaoFunil | null>(null)
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState<string | null>(null)
  const [valorEdicao, setValorEdicao] = useState('')

  const podeGerenciar = PAPEIS_GESTAO.includes(user?.papel ?? '')

  const carregar = useCallback(() => {
    api.funil.conversao().then(setDados).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function salvarMeta(etapa: string) {
    const valor = Number(valorEdicao) / 100
    if (!Number.isFinite(valor) || valor < 0 || valor > 1) return
    await api.funil.atualizarMeta(etapa, valor)
    setEditando(null)
    carregar()
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Funil de Vendas</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Conversão por fase, a partir do total de leads que entraram no funil — direto do CRM
        </p>
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

          {/* Metas por etapa */}
          <div className="grid gap-1 mt-2" style={{ gridTemplateColumns: `repeat(${dados.etapas.length}, 1fr)` }}>
            {dados.etapas.map(e => (
              <div key={e.estagio} className="text-center">
                {editando === e.estagio ? (
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number" autoFocus value={valorEdicao} onChange={ev => setValorEdicao(ev.target.value)}
                      className="w-12 px-1 py-0.5 border border-gray-300 rounded text-xs text-center"
                    />
                    <button onClick={() => salvarMeta(e.estagio)} className="text-xs text-blue-600 font-medium">OK</button>
                  </div>
                ) : (
                  <button
                    disabled={!podeGerenciar}
                    onClick={() => { setEditando(e.estagio); setValorEdicao(String(Math.round(e.meta * 100))) }}
                    className="text-[11px] text-gray-400 disabled:cursor-default hover:text-blue-600"
                  >
                    Meta: {pct(e.meta)}{e.tipoMeta === 'MAXIMO_PERDA' ? ' (máx.)' : ' (mín.)'}{podeGerenciar && ' ✎'}
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
