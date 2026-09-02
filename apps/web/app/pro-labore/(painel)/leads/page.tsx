'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { proLaboreApi, Lead, EstagioLead, ESTAGIOS_LEAD, Vendedor, ParametroLiquidez } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'

const ESTAGIO_LABEL: Record<EstagioLead, string> = {
  LEAD: 'Lead',
  ABORDADO: 'Abordado',
  NEGOCIACAO: 'Negociação',
  PROPOSTA: 'Proposta',
  FECHADO: 'Fechado',
  PERDIDO: 'Perdido',
}

// Estágios que dá pra escolher direto no dropdown da esteira — Fechado só
// acontece pela conversão em venda, pra nunca destoar do que está em Vendas.
const ESTAGIOS_MOVIMENTAVEIS = ESTAGIOS_LEAD.filter(e => e !== 'FECHADO')

function hojeIso() {
  return new Date().toISOString().slice(0, 10)
}

export default function ProLaboreLeadsPage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel !== 'VENDEDOR'

  const [leads, setLeads] = useState<Lead[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [parametro, setParametro] = useState<ParametroLiquidez | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtroEstagio, setFiltroEstagio] = useState<EstagioLead | ''>('')

  const [form, setForm] = useState({ nomeCliente: '', telefone: '', observacao: '', vendedorId: '' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [convertendoId, setConvertendoId] = useState<string | null>(null)
  const [convertForm, setConvertForm] = useState({ data: hojeIso(), valorVenda: '', valorProLabore: '', observacao: '' })
  const [convertErro, setConvertErro] = useState('')
  const [convertSalvando, setConvertSalvando] = useState(false)

  const carregar = useCallback(() => {
    setLoading(true)
    Promise.all([
      proLaboreApi.leads.listar(filtroEstagio || undefined),
      isDono ? proLaboreApi.vendedores.listar() : Promise.resolve<Vendedor[]>([]),
      proLaboreApi.parametros.get(),
    ])
      .then(([l, v, p]) => { setLeads(l); setVendedores(v); setParametro(p) })
      .finally(() => setLoading(false))
  }, [filtroEstagio, isDono])

  useEffect(() => { carregar() }, [carregar])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await proLaboreApi.leads.criar({
        nomeCliente: form.nomeCliente,
        telefone: form.telefone || undefined,
        observacao: form.observacao || undefined,
        vendedorId: form.vendedorId || undefined,
      })
      setForm({ nomeCliente: '', telefone: '', observacao: '', vendedorId: '' })
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar lead')
    } finally {
      setSalvando(false)
    }
  }

  async function mudarEstagio(lead: Lead, estagio: EstagioLead) {
    if (estagio === lead.estagio) return
    await proLaboreApi.leads.mudarEstagio(lead.id, estagio)
    carregar()
  }

  async function remover(lead: Lead) {
    if (!confirm(`Remover o lead de ${lead.nomeCliente}?`)) return
    try {
      await proLaboreApi.leads.remover(lead.id)
      carregar()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao remover lead')
    }
  }

  function abrirConversao(lead: Lead) {
    setConvertendoId(lead.id)
    const teto = parametro?.tetoProLaborePorVenda ?? 900
    setConvertForm({ data: hojeIso(), valorVenda: '', valorProLabore: String(teto), observacao: '' })
    setConvertErro('')
  }

  function fecharConversao() {
    setConvertendoId(null)
    setConvertErro('')
  }

  function atualizarValorVendaConversao(valor: string) {
    const numero = Number(valor)
    const teto = parametro?.tetoProLaborePorVenda ?? 900
    const sugestao = Number.isFinite(numero) && numero > 0 ? Math.min(numero, teto) : teto
    setConvertForm(f => ({ ...f, valorVenda: valor, valorProLabore: String(sugestao) }))
  }

  async function converter(lead: Lead) {
    setConvertErro('')
    setConvertSalvando(true)
    try {
      await proLaboreApi.leads.converter(lead.id, {
        data: convertForm.data,
        valorVenda: Number(convertForm.valorVenda),
        valorProLabore: Number(convertForm.valorProLabore),
        observacao: convertForm.observacao || undefined,
      })
      fecharConversao()
      carregar()
    } catch (err: unknown) {
      setConvertErro(err instanceof Error ? err.message : 'Erro ao converter lead em venda')
    } finally {
      setConvertSalvando(false)
    }
  }

  const contagemPorEstagio = ESTAGIOS_LEAD.reduce((acc, e) => {
    acc[e] = leads.filter(l => l.estagio === e).length
    return acc
  }, {} as Record<EstagioLead, number>)

  const teto = parametro?.tetoProLaborePorVenda ?? 900

  return (
    <div>
      <div className="pl-section-head" style={{ marginTop: 0 }}>
        <div>
          <div className="pl-eyebrow">Funil de vendas</div>
          <h2 className="pl-section-title">Leads</h2>
          <div className="pl-section-note" style={{ marginTop: 4 }}>
            {isDono ? 'Esteira comercial da operação — do primeiro contato ao fechamento' : 'Seus leads, do primeiro contato ao fechamento'}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="pl-card" style={{ marginBottom: 20 }}>
        <div className="pl-card-title" style={{ marginBottom: 14 }}>Novo lead</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          <div className="pl-field">
            <label>Nome do cliente</label>
            <input className="pl-input" value={form.nomeCliente} onChange={e => setForm(f => ({ ...f, nomeCliente: e.target.value }))} placeholder="Ex: Carlos Mendes" required minLength={2} />
          </div>
          <div className="pl-field">
            <label>Telefone (opcional)</label>
            <input className="pl-input" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
          </div>
          {isDono && (
            <div className="pl-field">
              <label>Vendedor (opcional)</label>
              <select className="pl-select" value={form.vendedorId} onChange={e => setForm(f => ({ ...f, vendedorId: e.target.value }))}>
                <option value="">— Sem vendedor —</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            </div>
          )}
          <div className="pl-field">
            <label>Observação (opcional)</label>
            <input className="pl-input" value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: interesse em qual modelo" />
          </div>
        </div>
        {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 14 }}>{erro}</div>}
        <div style={{ marginTop: 16 }}>
          <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Adicionar lead'}</button>
        </div>
      </form>

      <div className="pl-period-row" style={{ marginBottom: 16 }}>
        <button type="button" className={`pl-chip ${filtroEstagio === '' ? 'active' : ''}`} onClick={() => setFiltroEstagio('')}>
          Todos ({leads.length})
        </button>
        {ESTAGIOS_LEAD.map(e => (
          <button key={e} type="button" className={`pl-chip ${filtroEstagio === e ? 'active' : ''}`} onClick={() => setFiltroEstagio(e)}>
            {ESTAGIO_LABEL[e]} ({contagemPorEstagio[e]})
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>
      ) : leads.length === 0 ? (
        <div className="pl-empty pl-card">
          <div className="pl-emoji">🧲</div>
          <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Nenhum lead por aqui</h3>
          <p style={{ marginTop: 6 }}>Adicione o primeiro lead acima para começar a preencher o funil.</p>
        </div>
      ) : (
        <div className="pl-table-wrap">
          <table className="pl-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Telefone</th>
                {isDono && <th>Vendedor</th>}
                <th>Estágio</th>
                <th>Observação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {leads.map(l => {
                const convertivel = !l.vendaId && l.estagio !== 'PERDIDO'
                return (
                  <Fragment key={l.id}>
                    <tr>
                      <td>{l.nomeCliente}</td>
                      <td>{l.telefone || '—'}</td>
                      {isDono && <td>{l.vendedor?.nome ?? '—'}</td>}
                      <td>
                        <select
                          className="pl-select"
                          value={l.estagio}
                          onChange={e => mudarEstagio(l, e.target.value as EstagioLead)}
                          disabled={!!l.vendaId}
                        >
                          {(l.vendaId ? ESTAGIOS_LEAD : ESTAGIOS_MOVIMENTAVEIS).map(e => (
                            <option key={e} value={e}>{ESTAGIO_LABEL[e]}</option>
                          ))}
                        </select>
                      </td>
                      <td>{l.observacao || '—'}</td>
                      <td className="pl-right" style={{ whiteSpace: 'nowrap' }}>
                        {convertivel && (
                          <span className="pl-link-action" onClick={() => (convertendoId === l.id ? fecharConversao() : abrirConversao(l))} style={{ marginRight: 14 }}>
                            Converter em venda
                          </span>
                        )}
                        {l.vendaId && <span style={{ color: 'var(--pl-ink-muted)', fontSize: 13, marginRight: 14 }}>Já convertido</span>}
                        {!l.vendaId && <span className="pl-link-action pl-danger" onClick={() => remover(l)}>Remover</span>}
                      </td>
                    </tr>
                    {convertendoId === l.id && (
                      <tr>
                        <td colSpan={isDono ? 6 : 5}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, padding: '10px 0' }}>
                            <div className="pl-field">
                              <label>Data da venda</label>
                              <input type="date" className="pl-input" value={convertForm.data} onChange={e => setConvertForm(f => ({ ...f, data: e.target.value }))} required />
                            </div>
                            <div className="pl-field">
                              <label>Valor da venda (R$)</label>
                              <input type="number" step="0.01" min="0" className="pl-input" value={convertForm.valorVenda} onChange={e => atualizarValorVendaConversao(e.target.value)} placeholder="0,00" required />
                            </div>
                            <div className="pl-field">
                              <label>Pró-labore sacado (R$)</label>
                              <input type="number" step="0.01" min="0" max={teto} className="pl-input" value={convertForm.valorProLabore} onChange={e => setConvertForm(f => ({ ...f, valorProLabore: e.target.value }))} placeholder="0,00" required />
                              <span className="pl-hint">Máximo {formatMoeda(teto)}</span>
                            </div>
                            <div className="pl-field">
                              <label>Observação (opcional)</label>
                              <input className="pl-input" value={convertForm.observacao} onChange={e => setConvertForm(f => ({ ...f, observacao: e.target.value }))} placeholder={`Convertido do lead: ${l.nomeCliente}`} />
                            </div>
                          </div>
                          {convertErro && <div className="pl-alert pl-alert-error" style={{ marginBottom: 12 }}>{convertErro}</div>}
                          <div style={{ display: 'flex', gap: 10, paddingBottom: 12 }}>
                            <button type="button" className="pl-btn pl-btn-primary" disabled={convertSalvando} onClick={() => converter(l)}>
                              {convertSalvando ? 'Convertendo...' : 'Confirmar venda'}
                            </button>
                            <button type="button" className="pl-btn pl-btn-ghost" onClick={fecharConversao}>Cancelar</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
