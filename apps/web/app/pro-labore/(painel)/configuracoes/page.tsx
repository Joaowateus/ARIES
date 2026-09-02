'use client'

import { useEffect, useState } from 'react'
import { proLaboreApi, ParametroLiquidez } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'

export default function ProLaboreConfiguracoesPage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel !== 'VENDEDOR'
  const [teto, setTeto] = useState('')
  const [metaAnual, setMetaAnual] = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    if (!isDono) { setLoading(false); return }
    proLaboreApi.parametros.get().then((p: ParametroLiquidez) => {
      setTeto(String(p.tetoProLaborePorVenda))
      setMetaAnual(String(p.metaFaturamentoAnual))
    }).finally(() => setLoading(false))
  }, [isDono])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSucesso(false)
    setSalvando(true)
    try {
      const atualizado = await proLaboreApi.parametros.atualizar({
        tetoProLaborePorVenda: Number(teto),
        metaFaturamentoAnual: Number(metaAnual),
      })
      setTeto(String(atualizado.tetoProLaborePorVenda))
      setMetaAnual(String(atualizado.metaFaturamentoAnual))
      setSucesso(true)
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>

  if (!isDono) {
    return (
      <div className="pl-empty pl-card">
        <div className="pl-emoji">🔒</div>
        <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Área restrita ao dono da operação</h3>
        <p style={{ marginTop: 6 }}>Teto de pró-labore e meta anual são definidos pelo responsável pela conta.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="pl-section-head" style={{ marginTop: 0 }}>
        <div>
          <div className="pl-eyebrow">Preferências</div>
          <h2 className="pl-section-title">Configurações</h2>
          <div className="pl-section-note" style={{ marginTop: 4 }}>Teto de pró-labore por venda e meta anual de faturamento</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="pl-card" style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="pl-field">
          <label>Teto de pró-labore por venda (R$)</label>
          <input type="number" step="0.01" min="0" className="pl-input" value={teto} onChange={e => setTeto(e.target.value)} required />
          <span className="pl-hint">Nenhuma venda pode ter pró-labore acima deste teto — hoje: {formatMoeda(Number(teto) || 0)}</span>
        </div>

        <div className="pl-field">
          <label>Meta de faturamento anual (R$)</label>
          <input type="number" step="0.01" min="0" className="pl-input" value={metaAnual} onChange={e => setMetaAnual(e.target.value)} required />
          <span className="pl-hint">Aparece no dashboard como referência do progresso do ano — hoje: {formatMoeda(Number(metaAnual) || 0)}</span>
        </div>

        {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
        {sucesso && <div className="pl-alert pl-alert-success">Configurações atualizadas.</div>}

        <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando} style={{ alignSelf: 'flex-start' }}>{salvando ? 'Salvando...' : 'Salvar'}</button>
      </form>
    </div>
  )
}
