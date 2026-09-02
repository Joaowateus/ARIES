'use client'

import { useEffect, useState, useCallback } from 'react'
import { proLaboreApi, FunilMensal, GastoAnuncioMensal } from '@/lib/proLaboreApi'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'

function mesAtualStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ProLaboreIndicadoresPage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel !== 'VENDEDOR'
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualStr())
  const [funis, setFunis] = useState<FunilMensal[]>([])
  const [gastos, setGastos] = useState<GastoAnuncioMensal[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  const [form, setForm] = useState({ leads: '0', abordados: '0', negociacao: '0', proposta: '0', gastoAnuncios: '0' })

  const ano = Number(mesSelecionado.slice(0, 4))

  const carregar = useCallback(() => {
    if (!isDono) { setLoading(false); return }
    setLoading(true)
    Promise.all([proLaboreApi.funil.listar(ano), proLaboreApi.gastosAnuncios.listar(ano)])
      .then(([f, g]) => { setFunis(f); setGastos(g) })
      .finally(() => setLoading(false))
  }, [ano, isDono])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    const funilDoMes = funis.find(f => f.mesReferencia.slice(0, 7) === mesSelecionado)
    const gastoDoMes = gastos.find(g => g.mesReferencia.slice(0, 7) === mesSelecionado)
    setForm({
      leads: String(funilDoMes?.leads ?? 0),
      abordados: String(funilDoMes?.abordados ?? 0),
      negociacao: String(funilDoMes?.negociacao ?? 0),
      proposta: String(funilDoMes?.proposta ?? 0),
      gastoAnuncios: String(gastoDoMes?.valor ?? 0),
    })
  }, [mesSelecionado, funis, gastos])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso(false)
    setSalvando(true)
    try {
      const mesReferencia = `${mesSelecionado}-01`
      await Promise.all([
        proLaboreApi.funil.salvar({
          mesReferencia,
          leads: Number(form.leads),
          abordados: Number(form.abordados),
          negociacao: Number(form.negociacao),
          proposta: Number(form.proposta),
        }),
        proLaboreApi.gastosAnuncios.salvar({ mesReferencia, valor: Number(form.gastoAnuncios) }),
      ])
      setSucesso(true)
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar indicadores')
    } finally {
      setSalvando(false)
    }
  }

  if (!isDono) {
    return (
      <div className="pl-empty pl-card">
        <div className="pl-emoji">🔒</div>
        <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Área restrita ao dono da operação</h3>
        <p style={{ marginTop: 6 }}>Indicadores de funil e anúncios são visão geral do negócio.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="pl-section-head" style={{ marginTop: 0 }}>
        <div>
          <div className="pl-eyebrow">Funil &amp; anúncios</div>
          <h2 className="pl-section-title">Indicadores mensais</h2>
          <div className="pl-section-note" style={{ marginTop: 4 }}>
            Cadastro manual — o Fechamento do funil e o ROAS são calculados automaticamente a partir das vendas
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="pl-card">
        <div className="pl-field" style={{ maxWidth: 220, marginBottom: 20 }}>
          <label>Mês de referência</label>
          <input type="month" className="pl-input" value={mesSelecionado} onChange={e => setMesSelecionado(e.target.value)} required />
        </div>

        <div className="pl-card-title" style={{ marginBottom: 4 }}>Funil de vendas</div>
        <div className="pl-card-sub" style={{ marginBottom: 14 }}>Contagem de cada etapa no mês selecionado</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 22 }}>
          <div className="pl-field">
            <label>Leads</label>
            <input type="number" min="0" className="pl-input" value={form.leads} onChange={e => setForm(f => ({ ...f, leads: e.target.value }))} required />
          </div>
          <div className="pl-field">
            <label>Abordados</label>
            <input type="number" min="0" className="pl-input" value={form.abordados} onChange={e => setForm(f => ({ ...f, abordados: e.target.value }))} required />
          </div>
          <div className="pl-field">
            <label>Negociação</label>
            <input type="number" min="0" className="pl-input" value={form.negociacao} onChange={e => setForm(f => ({ ...f, negociacao: e.target.value }))} required />
          </div>
          <div className="pl-field">
            <label>Proposta</label>
            <input type="number" min="0" className="pl-input" value={form.proposta} onChange={e => setForm(f => ({ ...f, proposta: e.target.value }))} required />
          </div>
        </div>

        <div className="pl-card-title" style={{ marginBottom: 4 }}>Investimento em anúncios</div>
        <div className="pl-card-sub" style={{ marginBottom: 14 }}>Base para o cálculo de ROAS e CAC no dashboard</div>
        <div className="pl-field" style={{ maxWidth: 220, marginBottom: 20 }}>
          <label>Gasto com anúncios (R$)</label>
          <input type="number" min="0" step="0.01" className="pl-input" value={form.gastoAnuncios} onChange={e => setForm(f => ({ ...f, gastoAnuncios: e.target.value }))} required />
        </div>

        {erro && <div className="pl-alert pl-alert-error" style={{ marginBottom: 14 }}>{erro}</div>}
        {sucesso && <div className="pl-alert pl-alert-success" style={{ marginBottom: 14 }}>Indicadores de {mesSelecionado} salvos.</div>}

        <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando || loading}>{salvando ? 'Salvando...' : 'Salvar indicadores do mês'}</button>
      </form>
    </div>
  )
}
