'use client'

import { useEffect, useState, useCallback } from 'react'
import { proLaboreApi, Vendedor } from '@/lib/proLaboreApi'

export default function ProLaboreVendedoresPage() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => {
    proLaboreApi.vendedores.listar().then(setVendedores).finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await proLaboreApi.vendedores.criar(nome)
      setNome('')
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar vendedor')
    } finally {
      setSalvando(false)
    }
  }

  async function alternarAtivo(v: Vendedor) {
    await proLaboreApi.vendedores.editar(v.id, { ativo: !v.ativo })
    carregar()
  }

  async function remover(id: string) {
    if (!confirm('Remover este vendedor? As vendas já lançadas continuam registradas, mas sem vendedor atribuído.')) return
    await proLaboreApi.vendedores.remover(id)
    carregar()
  }

  return (
    <div>
      <div className="pl-section-head" style={{ marginTop: 0 }}>
        <div>
          <div className="pl-eyebrow">Times</div>
          <h2 className="pl-section-title">Vendedores</h2>
          <div className="pl-section-note" style={{ marginTop: 4 }}>Quem faz parte da produção da sua operação — usado no ranking do dashboard</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="pl-card" style={{ marginBottom: 20 }}>
        <div className="pl-card-title" style={{ marginBottom: 14 }}>Novo vendedor</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="pl-field" style={{ flex: 1, minWidth: 220 }}>
            <label>Nome</label>
            <input className="pl-input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Rafael Souza" required minLength={2} />
          </div>
          <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Adicionar'}</button>
        </div>
        {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }}>{erro}</div>}
      </form>

      {loading ? (
        <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>
      ) : vendedores.length === 0 ? (
        <div className="pl-empty pl-card">
          <div className="pl-emoji">🧑‍💼</div>
          Nenhum vendedor cadastrado ainda.
        </div>
      ) : (
        <div className="pl-table-wrap">
          <table className="pl-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vendedores.map(v => (
                <tr key={v.id}>
                  <td>{v.nome}</td>
                  <td>
                    <span className={`pl-delta ${v.ativo ? 'up' : 'down'}`} style={{ display: 'inline-flex' }}>{v.ativo ? 'Ativo' : 'Inativo'}</span>
                  </td>
                  <td className="pl-right" style={{ whiteSpace: 'nowrap' }}>
                    <span className="pl-link-action" onClick={() => alternarAtivo(v)} style={{ marginRight: 14 }}>{v.ativo ? 'Desativar' : 'Ativar'}</span>
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
