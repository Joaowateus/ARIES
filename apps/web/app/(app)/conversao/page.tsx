'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, ConversaoFunil } from '@/lib/api'
import { useAuth } from '@/lib/auth'

const PAPEIS_GESTAO = ['ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL']

const STATUS_COR: Record<string, string> = {
  verde: 'bg-green-100 text-green-700 border-green-200',
  amarelo: 'bg-amber-100 text-amber-700 border-amber-200',
  vermelho: 'bg-red-100 text-red-700 border-red-200',
}

const STATUS_ICONE: Record<string, string> = { verde: '🟢', amarelo: '🟡', vermelho: '🔴' }

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

export default function ConversaoPage() {
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
        <h1 className="text-xl font-bold text-gray-900">Funil & Conversão</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {dados?.totalLeads ?? 0} leads no histórico — conversão real (quantos já passaram por cada etapa) vs. meta
        </p>
      </div>

      {dados && dados.totalLeads < 5 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700 mb-6">
          Ainda há poucos leads no histórico ({dados.totalLeads}) para uma leitura de conversão confiável. Os números vão ganhar precisão conforme o funil for usado.
        </div>
      )}

      <div className="space-y-3">
        {dados?.etapas.map(e => (
          <div key={e.estagio} className={`rounded-xl border p-4 flex items-center justify-between ${STATUS_COR[e.status]}`}>
            <div className="flex items-center gap-3">
              <span className="text-lg">{STATUS_ICONE[e.status]}</span>
              <div>
                <div className="font-medium text-gray-900">{e.label}</div>
                <div className="text-xs text-gray-500">{e.quantidade} lead{e.quantidade !== 1 ? 's' : ''} alcançaram esta etapa</div>
              </div>
            </div>
            <div className="flex items-center gap-6 text-right">
              <div>
                <div className="text-lg font-semibold text-gray-900">{pct(e.conversaoReal)}</div>
                <div className="text-xs text-gray-500">
                  {e.diferenca >= 0 ? '+' : ''}{pct(e.diferenca)} vs. meta
                </div>
              </div>
              <div className="w-24">
                {editando === e.estagio ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number" autoFocus value={valorEdicao} onChange={ev => setValorEdicao(ev.target.value)}
                      className="w-14 px-1.5 py-1 border border-gray-300 rounded text-xs"
                    />
                    <button onClick={() => salvarMeta(e.estagio)} className="text-xs text-blue-600 font-medium">OK</button>
                  </div>
                ) : (
                  <button
                    disabled={!podeGerenciar}
                    onClick={() => { setEditando(e.estagio); setValorEdicao(String(Math.round(e.meta * 100))) }}
                    className="text-xs text-gray-500 disabled:cursor-default hover:text-blue-600"
                  >
                    Meta: {pct(e.meta)} {e.tipoMeta === 'MAXIMO_PERDA' ? '(máx.)' : '(mín.)'}
                    {podeGerenciar && ' ✎'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
