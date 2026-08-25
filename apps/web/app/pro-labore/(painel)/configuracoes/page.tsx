'use client'

import { useEffect, useState } from 'react'
import { proLaboreApi, ParametroLiquidez } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'

export default function ProLaboreConfiguracoesPage() {
  const [teto, setTeto] = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    proLaboreApi.parametros.get().then((p: ParametroLiquidez) => setTeto(String(p.tetoProLaborePorVenda))).finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso(false)
    setSalvando(true)
    try {
      const tetoProLaborePorVenda = Number(teto)
      const atualizado = await proLaboreApi.parametros.atualizar({ tetoProLaborePorVenda })
      setTeto(String(atualizado.tetoProLaborePorVenda))
      setSucesso(true)
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return <div className="text-sm text-gray-400">Carregando...</div>

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Defina o teto máximo de pró-labore que você separa por venda, independente do valor dela.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teto de pró-labore por venda (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={teto}
            onChange={e => setTeto(e.target.value)}
            required
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">
            Nenhuma venda poderá ter um valor de pró-labore registrado acima deste teto — hoje: {formatMoeda(Number(teto) || 0)}
          </p>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">{erro}</div>
        )}
        {sucesso && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 text-sm text-emerald-700">
            Teto atualizado. Novas vendas usarão esse limite — vendas já registradas não são alteradas.
          </div>
        )}

        <button
          type="submit"
          disabled={salvando}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </div>
  )
}
