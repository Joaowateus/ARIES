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

  if (loading) return <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>

  return (
    <div>
      <div className="pl-section-head" style={{ marginTop: 0 }}>
        <div>
          <div className="pl-eyebrow">Preferências</div>
          <h2 className="pl-section-title">Configurações</h2>
          <div className="pl-section-note" style={{ marginTop: 4 }}>Teto máximo de pró-labore separado por venda, independente do valor dela</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="pl-card" style={{ maxWidth: 480 }}>
        <div className="pl-field">
          <label>Teto de pró-labore por venda (R$)</label>
          <input type="number" step="0.01" min="0" className="pl-input" value={teto} onChange={e => setTeto(e.target.value)} required />
          <span className="pl-hint">Nenhuma venda pode ter pró-labore acima deste teto — hoje: {formatMoeda(Number(teto) || 0)}</span>
        </div>

        {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 14 }}>{erro}</div>}
        {sucesso && <div className="pl-alert pl-alert-success" style={{ marginTop: 14 }}>Teto atualizado. Vendas já registradas não são alteradas.</div>}

        <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando} style={{ marginTop: 16 }}>{salvando ? 'Salvando...' : 'Salvar'}</button>
      </form>
    </div>
  )
}
