'use client'

import { Fragment, useEffect, useState, useCallback } from 'react'
import { proLaboreApi, Vendedor, ParametroLiquidez } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'

export default function ProLaboreVendedoresPage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel !== 'VENDEDOR'
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [parametro, setParametro] = useState<ParametroLiquidez | null>(null)
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [concedendoId, setConcedendoId] = useState<string | null>(null)
  const [acessoEmail, setAcessoEmail] = useState('')
  const [acessoSenha, setAcessoSenha] = useState('')
  const [acessoErro, setAcessoErro] = useState('')
  const [acessoSalvando, setAcessoSalvando] = useState(false)

  const [editandoTetoId, setEditandoTetoId] = useState<string | null>(null)
  const [tetoValor, setTetoValor] = useState('')
  const [tetoErro, setTetoErro] = useState('')
  const [tetoSalvando, setTetoSalvando] = useState(false)

  const carregar = useCallback(() => {
    if (!isDono) { setLoading(false); return }
    Promise.all([proLaboreApi.vendedores.listar(), proLaboreApi.parametros.get()])
      .then(([v, p]) => { setVendedores(v); setParametro(p) })
      .finally(() => setLoading(false))
  }, [isDono])

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

  function abrirConcessao(v: Vendedor) {
    setConcedendoId(v.id)
    setAcessoEmail(v.email ?? '')
    setAcessoSenha('')
    setAcessoErro('')
  }

  function fecharConcessao() {
    setConcedendoId(null)
    setAcessoEmail('')
    setAcessoSenha('')
    setAcessoErro('')
  }

  async function salvarAcesso(id: string) {
    setAcessoErro('')
    setAcessoSalvando(true)
    try {
      await proLaboreApi.vendedores.concederAcesso(id, { email: acessoEmail, senha: acessoSenha })
      fecharConcessao()
      carregar()
    } catch (err: unknown) {
      setAcessoErro(err instanceof Error ? err.message : 'Erro ao conceder acesso')
    } finally {
      setAcessoSalvando(false)
    }
  }

  async function revogarAcesso(id: string) {
    if (!confirm('Revogar o acesso deste vendedor? Ele não conseguirá mais fazer login.')) return
    await proLaboreApi.vendedores.revogarAcesso(id)
    carregar()
  }

  function abrirEdicaoTeto(v: Vendedor) {
    setEditandoTetoId(v.id)
    setTetoValor(v.tetoComissaoPorVenda != null ? String(v.tetoComissaoPorVenda) : '')
    setTetoErro('')
  }

  function fecharEdicaoTeto() {
    setEditandoTetoId(null)
    setTetoValor('')
    setTetoErro('')
  }

  async function salvarTeto(id: string) {
    setTetoErro('')
    setTetoSalvando(true)
    try {
      const numero = tetoValor.trim() === '' ? null : Number(tetoValor)
      if (numero !== null && (!Number.isFinite(numero) || numero <= 0)) {
        setTetoErro('Informe um valor positivo, ou deixe em branco pra usar o padrão da conta')
        return
      }
      await proLaboreApi.vendedores.editar(id, { tetoComissaoPorVenda: numero })
      fecharEdicaoTeto()
      carregar()
    } catch (err: unknown) {
      setTetoErro(err instanceof Error ? err.message : 'Erro ao salvar comissão')
    } finally {
      setTetoSalvando(false)
    }
  }

  if (!isDono) {
    return (
      <div className="pl-empty pl-card">
        <div className="pl-emoji">🔒</div>
        <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Área restrita ao dono da operação</h3>
        <p style={{ marginTop: 6 }}>Fale com o responsável se precisar de alguma alteração no time.</p>
      </div>
    )
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
                <th>Comissão por venda</th>
                <th>Acesso individual</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vendedores.map(v => (
                <Fragment key={v.id}>
                  <tr>
                    <td>{v.nome}</td>
                    <td>
                      <span className={`pl-delta ${v.ativo ? 'up' : 'down'}`} style={{ display: 'inline-flex' }}>{v.ativo ? 'Ativo' : 'Inativo'}</span>
                    </td>
                    <td>
                      {v.tetoComissaoPorVenda != null
                        ? <span className="pl-mono">{formatMoeda(v.tetoComissaoPorVenda)}</span>
                        : <span style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Padrão da conta{parametro ? ` (${formatMoeda(parametro.tetoComissaoPadrao)})` : ''}</span>}
                    </td>
                    <td>
                      {v.email
                        ? <span className="pl-delta up" style={{ display: 'inline-flex' }} title={v.email}>Com login</span>
                        : <span style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Sem login</span>}
                    </td>
                    <td className="pl-right" style={{ whiteSpace: 'nowrap' }}>
                      <span className="pl-link-action" onClick={() => (editandoTetoId === v.id ? fecharEdicaoTeto() : abrirEdicaoTeto(v))} style={{ marginRight: 14 }}>
                        Editar comissão
                      </span>
                      <span className="pl-link-action" onClick={() => (concedendoId === v.id ? fecharConcessao() : abrirConcessao(v))} style={{ marginRight: 14 }}>
                        {v.email ? 'Trocar acesso' : 'Dar acesso'}
                      </span>
                      {v.email && <span className="pl-link-action" onClick={() => revogarAcesso(v.id)} style={{ marginRight: 14 }}>Revogar acesso</span>}
                      <span className="pl-link-action" onClick={() => alternarAtivo(v)} style={{ marginRight: 14 }}>{v.ativo ? 'Desativar' : 'Ativar'}</span>
                      <span className="pl-link-action pl-danger" onClick={() => remover(v.id)}>Remover</span>
                    </td>
                  </tr>
                  {editandoTetoId === v.id && (
                    <tr>
                      <td colSpan={5}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', padding: '10px 0' }}>
                          <div className="pl-field" style={{ minWidth: 220 }}>
                            <label>Comissão (teto por venda, R$)</label>
                            <input type="number" step="0.01" min="0" className="pl-input" value={tetoValor} onChange={e => setTetoValor(e.target.value)} placeholder={parametro ? String(parametro.tetoComissaoPadrao) : '900'} />
                            <span className="pl-hint">Deixe em branco pra usar o padrão da conta{parametro ? ` (${formatMoeda(parametro.tetoComissaoPadrao)})` : ''}</span>
                          </div>
                          <button type="button" className="pl-btn pl-btn-primary" disabled={tetoSalvando} onClick={() => salvarTeto(v.id)}>
                            {tetoSalvando ? 'Salvando...' : 'Salvar comissão'}
                          </button>
                          <button type="button" className="pl-btn pl-btn-ghost" onClick={fecharEdicaoTeto}>Cancelar</button>
                        </div>
                        {tetoErro && <div className="pl-alert pl-alert-error" style={{ marginBottom: 12 }}>{tetoErro}</div>}
                      </td>
                    </tr>
                  )}
                  {concedendoId === v.id && (
                    <tr>
                      <td colSpan={5}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', padding: '10px 0' }}>
                          <div className="pl-field" style={{ minWidth: 220 }}>
                            <label>Email de acesso</label>
                            <input type="email" className="pl-input" value={acessoEmail} onChange={e => setAcessoEmail(e.target.value)} placeholder="vendedor@email.com" required />
                          </div>
                          <div className="pl-field" style={{ minWidth: 180 }}>
                            <label>Senha</label>
                            <input type="password" className="pl-input" value={acessoSenha} onChange={e => setAcessoSenha(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} />
                          </div>
                          <button type="button" className="pl-btn pl-btn-primary" disabled={acessoSalvando} onClick={() => salvarAcesso(v.id)}>
                            {acessoSalvando ? 'Salvando...' : 'Salvar acesso'}
                          </button>
                          <button type="button" className="pl-btn pl-btn-ghost" onClick={fecharConcessao}>Cancelar</button>
                        </div>
                        {acessoErro && <div className="pl-alert pl-alert-error" style={{ marginBottom: 12 }}>{acessoErro}</div>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
