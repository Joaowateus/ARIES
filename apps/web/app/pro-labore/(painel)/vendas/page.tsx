'use client'

import { useEffect, useState, useCallback } from 'react'
import { proLaboreApi, Venda, ParametroLiquidez, Vendedor } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'

export default function ProLaboreVendasPage() {
  const [vendas, setVendas] = useState<Venda[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [parametro, setParametro] = useState<ParametroLiquidez | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [form, setForm] = useState({ data: '', valorVenda: '', valorProLabore: '', vendedorId: '', observacao: '' })

  const carregar = useCallback(() => {
    Promise.all([proLaboreApi.vendas.listar(), proLaboreApi.parametros.get(), proLaboreApi.vendedores.listar()])
      .then(([v, p, ven]) => { setVendas(v); setParametro(p); setVendedores(ven) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function atualizarValorVenda(valor: string) {
    const numero = Number(valor)
    const teto = parametro?.tetoProLaborePorVenda ?? 900
    const sugestao = Number.isFinite(numero) && numero > 0 ? Math.min(numero, teto) : teto
    setForm(f => ({ ...f, valorVenda: valor, valorProLabore: editandoId ? f.valorProLabore : String(sugestao) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const valorVenda = Number(form.valorVenda)
      const valorProLabore = Number(form.valorProLabore)
      const vendedorId = form.vendedorId || undefined
      if (editandoId) {
        await proLaboreApi.vendas.editar(editandoId, { valorVenda, valorProLabore, vendedorId: form.vendedorId || null, observacao: form.observacao || undefined })
      } else {
        await proLaboreApi.vendas.criar({ data: form.data, valorVenda, valorProLabore, vendedorId, observacao: form.observacao || undefined })
      }
      setForm({ data: '', valorVenda: '', valorProLabore: '', vendedorId: '', observacao: '' })
      setEditandoId(null)
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar venda')
    } finally {
      setSalvando(false)
    }
  }

  function editar(v: Venda) {
    setEditandoId(v.id)
    setForm({
      data: v.data.slice(0, 10),
      valorVenda: String(v.valorVenda),
      valorProLabore: String(v.valorProLabore),
      vendedorId: v.vendedorId ?? '',
      observacao: v.observacao ?? '',
    })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm({ data: '', valorVenda: '', valorProLabore: '', vendedorId: '', observacao: '' })
  }

  async function remover(id: string) {
    if (!confirm('Remover esta venda?')) return
    await proLaboreApi.vendas.remover(id)
    if (editandoId === id) cancelarEdicao()
    carregar()
  }

  function formatData(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const teto = parametro?.tetoProLaborePorVenda ?? 900

  return (
    <div>
      <div className="pl-section-head" style={{ marginTop: 0 }}>
        <div>
          <div className="pl-eyebrow">Vendas</div>
          <h2 className="pl-section-title">Registro de vendas</h2>
          <div className="pl-section-note" style={{ marginTop: 4 }}>Cada venda define quanto de pró-labore você sacou dela (teto: {formatMoeda(teto)})</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="pl-card" style={{ marginBottom: 20 }}>
        <div className="pl-card-title" style={{ marginBottom: 14 }}>{editandoId ? 'Editar venda' : 'Nova venda'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          <div className="pl-field">
            <label>Data da venda</label>
            <input type="date" className="pl-input" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required disabled={!!editandoId} />
          </div>
          <div className="pl-field">
            <label>Valor da venda (R$)</label>
            <input type="number" step="0.01" min="0" className="pl-input" value={form.valorVenda} onChange={e => atualizarValorVenda(e.target.value)} placeholder="0,00" required />
          </div>
          <div className="pl-field">
            <label>Pró-labore sacado (R$)</label>
            <input type="number" step="0.01" min="0" max={teto} className="pl-input" value={form.valorProLabore} onChange={e => setForm(f => ({ ...f, valorProLabore: e.target.value }))} placeholder="0,00" required />
            <span className="pl-hint">Máximo {formatMoeda(teto)}</span>
          </div>
          <div className="pl-field">
            <label>Vendedor (opcional)</label>
            <select className="pl-select" value={form.vendedorId} onChange={e => setForm(f => ({ ...f, vendedorId: e.target.value }))}>
              <option value="">— Sem vendedor —</option>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </div>
          <div className="pl-field">
            <label>Observação (opcional)</label>
            <input type="text" className="pl-input" value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: cliente / modelo" />
          </div>
        </div>

        {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 14 }}>{erro}</div>}

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Registrar venda'}</button>
          {editandoId && <button type="button" className="pl-btn pl-btn-ghost" onClick={cancelarEdicao}>Cancelar</button>}
        </div>
      </form>

      {loading ? (
        <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>
      ) : vendas.length === 0 ? (
        <div className="pl-empty pl-card">
          <div className="pl-emoji">🏍️</div>
          <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Nenhuma venda ainda</h3>
          <p style={{ marginTop: 6 }}>Registre a primeira venda acima para começar a acompanhar seu pró-labore</p>
        </div>
      ) : (
        <div className="pl-table-wrap">
          <table className="pl-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Vendedor</th>
                <th className="pl-right">Valor da venda</th>
                <th className="pl-right">Pró-labore sacado</th>
                <th className="pl-right">Ficou no caixa</th>
                <th>Observação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vendas.map(v => (
                <tr key={v.id}>
                  <td>{formatData(v.data)}</td>
                  <td>{v.vendedor?.nome ?? '—'}</td>
                  <td className="pl-right">{formatMoeda(v.valorVenda)}</td>
                  <td className="pl-right" style={{ color: 'var(--pl-accent-3)', fontWeight: 700 }}>{formatMoeda(v.valorProLabore)}</td>
                  <td className="pl-right">{formatMoeda(v.valorVenda - v.valorProLabore)}</td>
                  <td>{v.observacao || '—'}</td>
                  <td className="pl-right" style={{ whiteSpace: 'nowrap' }}>
                    <span className="pl-link-action" onClick={() => editar(v)} style={{ marginRight: 14 }}>Editar</span>
                    <span className="pl-link-action pl-danger" onClick={() => remover(v.id)}>Remover</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
