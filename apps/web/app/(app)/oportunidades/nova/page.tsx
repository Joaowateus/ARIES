'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, Produto, Usuario } from '@/lib/api'
import Link from 'next/link'

export default function NovaOportunidadePage() {
  const router = useRouter()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [vendedores, setVendedores] = useState<Usuario[]>([])
  const [campanhas, setCampanhas] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({
    nomeCliente: '',
    telefone: '',
    email: '',
    unidadeId: '',
    responsavelId: '',
    origem: 'MANUAL',
    tipoLead: '',
    campanhaTrafego: '',
    valor: '',
    observacoes: '',
  })

  useEffect(() => {
    Promise.all([api.produtos.listar(), api.usuarios.listar()]).then(([p, u]) => {
      setProdutos(p)
      setVendedores(u.filter(u => u.status === 'ATIVO'))
    })
    api.funilTrafego.campanhas().then(setCampanhas)
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      await api.oportunidades.criar({
        ...form,
        valor: form.valor ? Number(form.valor) : undefined,
        unidadeId: form.unidadeId || undefined,
        responsavelId: form.responsavelId || undefined,
        email: form.email || undefined,
        tipoLead: (form.tipoLead || undefined) as 'TRAFEGO' | 'ORGANICO' | undefined,
        campanhaTrafego: form.tipoLead === 'TRAFEGO' ? (form.campanhaTrafego.trim() || undefined) : undefined,
      })
      router.push('/funil')
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar oportunidade')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <Link href="/oportunidades" className="text-sm text-gray-500 hover:text-gray-700">← Voltar</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">Novo Lead</h1>
        <p className="text-sm text-gray-500">Cadastre uma nova oportunidade de venda</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome do cliente *</label>
          <input
            type="text"
            value={form.nomeCliente}
            onChange={e => set('nomeCliente', e.target.value)}
            required
            placeholder="Nome do cliente"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input
              type="tel"
              value={form.telefone}
              onChange={e => set('telefone', e.target.value)}
              placeholder="(00) 00000-0000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="cliente@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Moto de interesse</label>
          <select
            value={form.unidadeId}
            onChange={e => set('unidadeId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Selecionar moto...</option>
            {produtos.map(p => (
              <option key={p.id} value={p.id}>{p.nome}{p.marca ? ` — ${p.marca}` : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
          <select
            value={form.responsavelId}
            onChange={e => set('responsavelId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Minha responsabilidade</option>
            {vendedores.map(v => (
              <option key={v.id} value={v.id}>{v.nome}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
            <select
              value={form.origem}
              onChange={e => set('origem', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="MANUAL">Manual</option>
              <option value="INDICACAO">Indicação</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SITE">Site</option>
              <option value="LOJA">Loja física</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor estimado (R$)</label>
            <input
              type="number"
              value={form.valor}
              onChange={e => set('valor', e.target.value)}
              placeholder="0,00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de lead</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => set('tipoLead', form.tipoLead === 'TRAFEGO' ? '' : 'TRAFEGO')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                form.tipoLead === 'TRAFEGO'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Tráfego pago
            </button>
            <button
              type="button"
              onClick={() => set('tipoLead', form.tipoLead === 'ORGANICO' ? '' : 'ORGANICO')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                form.tipoLead === 'ORGANICO'
                  ? 'bg-green-600 border-green-600 text-white'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Orgânico
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Opcional — permite comparar a produção de leads pagos e orgânicos no Funil de Vendas.</p>

          {form.tipoLead === 'TRAFEGO' && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Campanha</label>
              <input
                type="text"
                list="campanhas-trafego"
                value={form.campanhaTrafego}
                onChange={e => set('campanhaTrafego', e.target.value)}
                placeholder="Ex: Promoção CG 160 — Setembro"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="campanhas-trafego">
                {campanhas.map(c => <option key={c} value={c} />)}
              </datalist>
              <p className="text-xs text-gray-400 mt-1">Qual campanha do gerenciador de anúncios gerou este lead — use o mesmo nome lançado no Funil de Tráfego Pago, pra medir o custo real por lead.</p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
          <textarea
            value={form.observacoes}
            onChange={e => set('observacoes', e.target.value)}
            placeholder="Informações adicionais sobre o lead..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{erro}</div>
        )}

        <div className="flex gap-3 pt-2">
          <Link
            href="/oportunidades"
            className="flex-1 text-center border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Salvando...' : 'Salvar Lead'}
          </button>
        </div>
      </form>
    </div>
  )
}
