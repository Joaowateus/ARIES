'use client'

import { useEffect, useState } from 'react'
import { proLaboreApi, ParametroLiquidez } from '@/lib/proLaboreApi'

export default function ProLaboreConfiguracoesPage() {
  const [parametro, setParametro] = useState<ParametroLiquidez | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    proLaboreApi.parametros.get().then(setParametro).finally(() => setLoading(false))
  }, [])

  function update(campo: keyof ParametroLiquidez, valorPct: string) {
    if (!parametro) return
    const numero = Number(valorPct)
    setParametro({ ...parametro, [campo]: Number.isFinite(numero) ? numero / 100 : 0 })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!parametro) return
    setErro('')
    setSucesso(false)
    setSalvando(true)
    try {
      const atualizado = await proLaboreApi.parametros.atualizar(parametro)
      setParametro(atualizado)
      setSucesso(true)
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  if (loading || !parametro) return <div className="text-sm text-gray-400">Carregando...</div>

  const somaRetido = parametro.percentualImpostos + parametro.percentualCustosOperacionais + parametro.percentualReservaCaixa
  const liquidezResultante = 1 - somaRetido

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Configurações de Liquidez</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Defina os percentuais retidos sobre o faturamento bruto. O que sobra é o seu pró-labore líquido.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <Campo
          label="Impostos"
          descricao="Percentual reservado para tributos sobre o faturamento"
          valor={parametro.percentualImpostos}
          onChange={v => update('percentualImpostos', v)}
        />
        <Campo
          label="Custos operacionais"
          descricao="Percentual reservado para os custos fixos e variáveis da operação"
          valor={parametro.percentualCustosOperacionais}
          onChange={v => update('percentualCustosOperacionais', v)}
        />
        <Campo
          label="Reserva de caixa da empresa"
          descricao="Percentual retido no caixa da empresa como reserva, antes do pró-labore"
          valor={parametro.percentualReservaCaixa}
          onChange={v => update('percentualReservaCaixa', v)}
        />

        <div className={`rounded-lg px-4 py-3 text-sm ${somaRetido > 1 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {somaRetido > 1
            ? 'A soma dos percentuais ultrapassa 100% — ajuste os valores.'
            : `Liquidez resultante: ${Math.round(liquidezResultante * 100)}% de cada faturamento vira pró-labore.`}
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">{erro}</div>
        )}
        {sucesso && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 text-sm text-emerald-700">
            Configurações salvas. Novos lançamentos usarão esses percentuais.
          </div>
        )}

        <button
          type="submit"
          disabled={salvando || somaRetido > 1}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </form>

      <p className="text-xs text-gray-400">
        Alterar os percentuais não muda o histórico já lançado — cada lançamento guarda os percentuais aplicados no momento do registro.
      </p>
    </div>
  )
}

function Campo({
  label, descricao, valor, onChange,
}: {
  label: string
  descricao: string
  valor: number
  onChange: (valorPct: string) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={Math.round(valor * 1000) / 10}
            onChange={e => onChange(e.target.value)}
            className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <span className="text-sm text-gray-500">%</span>
        </div>
      </div>
      <p className="text-xs text-gray-400">{descricao}</p>
    </div>
  )
}
