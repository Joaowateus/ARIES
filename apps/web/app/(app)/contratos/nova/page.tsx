'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api, Oportunidade } from '@/lib/api'
import Link from 'next/link'
import { Suspense } from 'react'

function NovoContratoForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const oportunidadeIdParam = searchParams.get('oportunidade')

  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    oportunidadeId: oportunidadeIdParam ?? '',
    nomeCliente: '',
    cpfCliente: '',
    telefoneCliente: '',
    valorTotal: '',
    entrada: '0',
    parcelas: '1',
    observacoes: '',
  })

  useEffect(() => {
    api.oportunidades.listar({ estagio: 'NEGOCIACAO' }).then(ops => {
      setOportunidades(ops)
      if (oportunidadeIdParam) {
        const op = ops.find(o => o.id === oportunidadeIdParam)
        if (op) {
          setForm(f => ({
            ...f,
            nomeCliente: op.nomeCliente,
            telefoneCliente: op.telefone ?? '',
            valorTotal: op.valor?.toString() ?? '',
          }))
        }
      }
    })
  }, [oportunidadeIdParam])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function onSelectOportunidade(id: string) {
    const op = oportunidades.find(o => o.id === id)
    set('oportunidadeId', id)
    if (op) {
      set('nomeCliente', op.nomeCliente)
      set('telefoneCliente', op.telefone ?? '')
      set('valorTotal', op.valor?.toString() ?? '')
    }
  }

  const valorTotal = Number(form.valorTotal) || 0
  const entrada = Number(form.entrada) || 0
  const parcelas = Number(form.parcelas) || 1
  const valorFinanciado = valorTotal - entrada
  const valorParcela = parcelas > 0 ? valorFinanciado / parcelas : valorFinanciado

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const contrato = await api.contratos.criar({
        oportunidadeId: form.oportunidadeId,
        nomeCliente: form.nomeCliente,
        cpfCliente: form.cpfCliente || undefined,
        telefoneCliente: form.telefoneCliente || undefined,
        valorTotal,
        entrada,
        parcelas,
        observacoes: form.observacoes || undefined,
      })
      router.push(`/contratos`)
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao fechar venda')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/contratos" className="text-sm text-gray-500 hover:text-gray-700">← Contratos</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Fechar Venda</h1>
        <p className="text-sm text-gray-500">Gere o contrato e registre o financeiro automaticamente</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Oportunidade */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-medium text-gray-900 mb-3">Oportunidade</h2>
          <select
            value={form.oportunidadeId}
            onChange={e => onSelectOportunidade(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Selecionar oportunidade...</option>
            {oportunidades.map(o => (
              <option key={o.id} value={o.id}>
                {o.nomeCliente} {o.unidade ? `— ${o.unidade.nome}` : ''} {o.valor ? `(R$ ${o.valor.toLocaleString('pt-BR')})` : ''}
              </option>
            ))}
          </select>
          {oportunidades.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">Nenhuma oportunidade em Negociação. Mova um lead para a etapa de Negociação primeiro.</p>
          )}
        </div>

        {/* Dados do cliente */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-medium text-gray-900 mb-3">Dados do Cliente</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
              <input type="text" value={form.nomeCliente} onChange={e => set('nomeCliente', e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                <input type="text" value={form.cpfCliente} onChange={e => set('cpfCliente', e.target.value)} placeholder="000.000.000-00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input type="tel" value={form.telefoneCliente} onChange={e => set('telefoneCliente', e.target.value)} placeholder="(85) 99999-0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Financeiro */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-medium text-gray-900 mb-3">Condições Financeiras</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor Total (R$) *</label>
              <input type="number" value={form.valorTotal} onChange={e => set('valorTotal', e.target.value)} required min="0" step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entrada (R$)</label>
              <input type="number" value={form.entrada} onChange={e => set('entrada', e.target.value)} min="0" step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
              <select value={form.parcelas} onChange={e => set('parcelas', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {[1,2,3,6,9,12,18,24,36,48,60].map(n => <option key={n} value={n}>{n}x</option>)}
              </select>
            </div>
          </div>

          {/* Resumo */}
          {valorTotal > 0 && (
            <div className="bg-blue-50 rounded-lg p-4 text-sm">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-blue-600 font-medium">Valor financiado</div>
                  <div className="font-bold text-blue-900">{valorFinanciado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-600 font-medium">Parcelas de</div>
                  <div className="font-bold text-blue-900">{valorParcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-600 font-medium">Total</div>
                  <div className="font-bold text-blue-900">{valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
          <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2}
            placeholder="Condições especiais, informações adicionais..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {erro && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{erro}</div>}

        <div className="flex gap-3">
          <Link href="/contratos" className="flex-1 text-center border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancelar
          </Link>
          <button type="submit" disabled={loading || !form.oportunidadeId}
            className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
            {loading ? 'Fechando venda...' : '✅ Fechar Venda'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function NovoContratoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Carregando...</div>}>
      <NovoContratoForm />
    </Suspense>
  )
}
