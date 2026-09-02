'use client'

import { useEffect, useState, useCallback, DragEvent } from 'react'
import { proLaboreApi, Lead, EstagioLead, TipoLead, TIPOS_LEAD, Vendedor, ParametroLiquidez } from '@/lib/proLaboreApi'
import { formatMoeda } from '@/lib/format'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'

const COLUNAS: { estagio: EstagioLead; titulo: string }[] = [
  { estagio: 'LEAD', titulo: 'Leads' },
  { estagio: 'ABORDADO', titulo: 'Abordados' },
  { estagio: 'NEGOCIACAO', titulo: 'Negociação (MQL)' },
  { estagio: 'PROPOSTA', titulo: 'Propostas (SQL)' },
  { estagio: 'FECHADO', titulo: 'Fechamentos' },
]

const TIPO_LABEL: Record<TipoLead, string> = { TRAFEGO: 'Tráfego Pago', ORGANICO: 'Orgânico' }
const TIPO_CLASS: Record<TipoLead, string> = { TRAFEGO: 'trafego', ORGANICO: 'organico' }

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

  const [filtroCanal, setFiltroCanal] = useState<TipoLead | ''>('')
  const [mostrarPerdidos, setMostrarPerdidos] = useState(false)

  const [form, setForm] = useState({ nomeCliente: '', telefone: '', observacao: '', vendedorId: '', tipoLead: '' as TipoLead | '' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [convertendoId, setConvertendoId] = useState<string | null>(null)
  const [convertForm, setConvertForm] = useState({ data: hojeIso(), valorVenda: '', valorProLabore: '', observacao: '' })
  const [convertErro, setConvertErro] = useState('')
  const [convertSalvando, setConvertSalvando] = useState(false)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<EstagioLead | null>(null)

  const carregar = useCallback(() => {
    setLoading(true)
    Promise.all([
      proLaboreApi.leads.listar(),
      isDono ? proLaboreApi.vendedores.listar() : Promise.resolve<Vendedor[]>([]),
      proLaboreApi.parametros.get(),
    ])
      .then(([l, v, p]) => { setLeads(l); setVendedores(v); setParametro(p) })
      .finally(() => setLoading(false))
  }, [isDono])

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
        tipoLead: form.tipoLead || undefined,
      })
      setForm({ nomeCliente: '', telefone: '', observacao: '', vendedorId: '', tipoLead: '' })
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

  async function marcarPerdido(lead: Lead) {
    if (!confirm(`Marcar o lead de ${lead.nomeCliente} como perdido?`)) return
    await mudarEstagio(lead, 'PERDIDO')
  }

  async function reabrir(lead: Lead) {
    await mudarEstagio(lead, 'LEAD')
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

  async function converter() {
    if (!convertendoId) return
    setConvertErro('')
    setConvertSalvando(true)
    try {
      await proLaboreApi.leads.converter(convertendoId, {
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

  function onDragStartCard(e: DragEvent<HTMLDivElement>, lead: Lead) {
    e.dataTransfer.setData('text/plain', lead.id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(lead.id)
  }

  function onDragEndCard() {
    setDraggingId(null)
    setDragOverCol(null)
  }

  function onDragOverCol(e: DragEvent<HTMLDivElement>, estagio: EstagioLead) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverCol !== estagio) setDragOverCol(estagio)
  }

  function onDragLeaveCol(estagio: EstagioLead) {
    setDragOverCol(atual => (atual === estagio ? null : atual))
  }

  function onDropCol(e: DragEvent<HTMLDivElement>, estagio: EstagioLead) {
    e.preventDefault()
    setDragOverCol(null)
    const id = e.dataTransfer.getData('text/plain')
    setDraggingId(null)
    const lead = leads.find(l => l.id === id)
    if (!lead || lead.vendaId || lead.estagio === estagio) return
    if (estagio === 'FECHADO') {
      abrirConversao(lead)
    } else {
      mudarEstagio(lead, estagio)
    }
  }

  const leadsFiltrados = leads.filter(l => !filtroCanal || l.tipoLead === filtroCanal)
  const leadsAtivos = leadsFiltrados.filter(l => l.estagio !== 'PERDIDO')
  const leadsPerdidos = leadsFiltrados.filter(l => l.estagio === 'PERDIDO')

  const totalFiltrado = leadsFiltrados.length
  const fechadosFiltrado = leadsFiltrados.filter(l => l.vendaId).length
  const conversaoFiltrado = totalFiltrado > 0 ? (fechadosFiltrado / totalFiltrado) * 100 : 0

  const teto = parametro?.tetoProLaborePorVenda ?? 900
  const leadConvertendo = convertendoId ? leads.find(l => l.id === convertendoId) ?? null : null

  return (
    <div>
      <div className="pl-section-head" style={{ marginTop: 0 }}>
        <div>
          <div className="pl-eyebrow">CRM</div>
          <h2 className="pl-section-title">Funil de vendas</h2>
          <div className="pl-section-note" style={{ marginTop: 4 }}>
            {isDono ? 'Arraste os cards entre as etapas — a mesma jornada do dashboard' : 'Seus leads, do primeiro contato ao fechamento'}
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
          <div className="pl-field">
            <label>Canal (opcional)</label>
            <select className="pl-select" value={form.tipoLead} onChange={e => setForm(f => ({ ...f, tipoLead: e.target.value as TipoLead | '' }))}>
              <option value="">— Não informado —</option>
              {TIPOS_LEAD.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
            </select>
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

      <div className="pl-period-row" style={{ marginBottom: 12 }}>
        <button type="button" className={`pl-chip ${filtroCanal === '' ? 'active' : ''}`} onClick={() => setFiltroCanal('')}>Todos os canais</button>
        {TIPOS_LEAD.map(t => (
          <button key={t} type="button" className={`pl-chip ${filtroCanal === t ? 'active' : ''}`} onClick={() => setFiltroCanal(t)}>{TIPO_LABEL[t]}</button>
        ))}
      </div>

      <div className="pl-section-note" style={{ marginBottom: 16 }}>
        {totalFiltrado} lead{totalFiltrado !== 1 ? 's' : ''} · {fechadosFiltrado} fechamento{fechadosFiltrado !== 1 ? 's' : ''} · {conversaoFiltrado.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% de conversão
        {leadsPerdidos.length > 0 && (
          <> · <span className="pl-link-action" style={{ fontSize: 12.5 }} onClick={() => setMostrarPerdidos(m => !m)}>{mostrarPerdidos ? 'Ocultar' : 'Ver'} perdidos ({leadsPerdidos.length})</span></>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>
      ) : (
        <>
          <div className="pl-kanban">
            {COLUNAS.map(col => {
              const leadsDaColuna = leadsAtivos.filter(l => l.estagio === col.estagio)
              return (
                <div
                  key={col.estagio}
                  className={`pl-kanban-col ${dragOverCol === col.estagio ? 'drop-active' : ''}`}
                  onDragOver={e => onDragOverCol(e, col.estagio)}
                  onDragLeave={() => onDragLeaveCol(col.estagio)}
                  onDrop={e => onDropCol(e, col.estagio)}
                >
                  <div className="pl-kanban-col-head">
                    <div className="pl-kanban-col-title">{col.titulo}</div>
                    <div className="pl-kanban-col-count pl-mono">{leadsDaColuna.length}</div>
                  </div>
                  <div className="pl-kanban-cards">
                    {leadsDaColuna.length === 0 && <div className="pl-kanban-empty">Arraste um lead pra cá</div>}
                    {leadsDaColuna.map(lead => {
                      const movivel = !lead.vendaId
                      return (
                        <div
                          key={lead.id}
                          className={`pl-kanban-card ${draggingId === lead.id ? 'dragging' : ''}`}
                          draggable={movivel}
                          onDragStart={e => onDragStartCard(e, lead)}
                          onDragEnd={onDragEndCard}
                        >
                          <div className="pl-kanban-card-name">{lead.nomeCliente}</div>
                          {(lead.telefone || (isDono && lead.vendedor)) && (
                            <div className="pl-kanban-card-meta">
                              {lead.telefone}{lead.telefone && isDono && lead.vendedor ? ' · ' : ''}{isDono && lead.vendedor ? lead.vendedor.nome : ''}
                            </div>
                          )}
                          {lead.observacao && <div className="pl-kanban-card-meta">{lead.observacao}</div>}
                          {lead.tipoLead && <span className={`pl-kanban-card-tag ${TIPO_CLASS[lead.tipoLead]}`}>{TIPO_LABEL[lead.tipoLead]}</span>}
                          {lead.vendaId ? (
                            <div className="pl-kanban-card-badge">✓ Convertido em venda</div>
                          ) : (
                            <div className="pl-kanban-card-actions">
                              {col.estagio !== 'FECHADO' && <span onClick={() => abrirConversao(lead)}>Converter</span>}
                              <span onClick={() => marcarPerdido(lead)} className="pl-danger">Perdido</span>
                              <span onClick={() => remover(lead)} className="pl-danger">Remover</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {mostrarPerdidos && leadsPerdidos.length > 0 && (
            <div className="pl-table-wrap" style={{ marginTop: 20 }}>
              <table className="pl-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Canal</th>
                    {isDono && <th>Vendedor</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {leadsPerdidos.map(l => (
                    <tr key={l.id}>
                      <td>{l.nomeCliente}</td>
                      <td>{l.tipoLead ? TIPO_LABEL[l.tipoLead] : '—'}</td>
                      {isDono && <td>{l.vendedor?.nome ?? '—'}</td>}
                      <td className="pl-right">
                        <span className="pl-link-action" onClick={() => reabrir(l)} style={{ marginRight: 14 }}>Reabrir</span>
                        <span className="pl-link-action pl-danger" onClick={() => remover(l)}>Remover</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {leadConvertendo && (
        <div className="pl-modal-backdrop" onClick={fecharConversao}>
          <div className="pl-card pl-modal-panel" onClick={e => e.stopPropagation()}>
            <div className="pl-card-title" style={{ marginBottom: 4 }}>Converter em venda</div>
            <div className="pl-card-sub" style={{ marginBottom: 16 }}>{leadConvertendo.nomeCliente}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                <input className="pl-input" value={convertForm.observacao} onChange={e => setConvertForm(f => ({ ...f, observacao: e.target.value }))} placeholder={`Convertido do lead: ${leadConvertendo.nomeCliente}`} />
              </div>
            </div>
            {convertErro && <div className="pl-alert pl-alert-error" style={{ marginTop: 14 }}>{convertErro}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="button" className="pl-btn pl-btn-primary" disabled={convertSalvando} onClick={converter}>
                {convertSalvando ? 'Convertendo...' : 'Confirmar venda'}
              </button>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={fecharConversao}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
