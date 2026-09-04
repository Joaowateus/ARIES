'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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

  const [form, setForm] = useState({ nomeCliente: '', telefone: '', email: '', cpf: '', endereco: '', modeloInteresse: '', observacao: '', vendedorId: '', tipoLead: '' as TipoLead | '' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [convertendoId, setConvertendoId] = useState<string | null>(null)
  const [convertForm, setConvertForm] = useState({ data: hojeIso(), valorVenda: '', valorProLabore: '', valorComissao: '', observacao: '' })
  const [convertErro, setConvertErro] = useState('')
  const [convertSalvando, setConvertSalvando] = useState(false)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ nomeCliente: '', telefone: '', email: '', cpf: '', endereco: '', modeloInteresse: '', observacao: '', vendedorId: '', tipoLead: '' as TipoLead | '' })
  const [editErro, setEditErro] = useState('')
  const [editSalvando, setEditSalvando] = useState(false)

  // Arrastar os cards usa Pointer Events (não o Drag and Drop nativo do
  // HTML5) — o nativo não funciona em toque/celular e, mesmo no mouse,
  // vinha falhando de forma inconsistente pra algumas vendedoras (o card
  // não se movia e ficava na etapa antiga). dragRef guarda o estado "vivo"
  // da arrastada — os listeners do pointermove/pointerup ficam presos ao
  // fechamento (closure) de quando o pointerdown começou, então não dá pra
  // confiar em state do React ali dentro; só em refs, que são sempre atuais.
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<EstagioLead | null>(null)
  const dragRef = useRef<{ lead: Lead; startX: number; startY: number; dragging: boolean; colSobre: EstagioLead | null; abort: AbortController } | null>(null)
  const colRefs = useRef(new Map<EstagioLead, HTMLDivElement>())

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

  // Limpa os listeners de arrastar se a página desmontar no meio de um
  // gesto (ex: trocou de rota durante o drag) — lê a gaveta ATUAL (ref),
  // então funciona não importa em qual render o drag começou.
  useEffect(() => () => { dragRef.current?.abort.abort() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await proLaboreApi.leads.criar({
        nomeCliente: form.nomeCliente,
        telefone: form.telefone || undefined,
        email: form.email || undefined,
        cpf: form.cpf || undefined,
        endereco: form.endereco || undefined,
        modeloInteresse: form.modeloInteresse || undefined,
        observacao: form.observacao || undefined,
        vendedorId: form.vendedorId || undefined,
        tipoLead: form.tipoLead || undefined,
      })
      setForm({ nomeCliente: '', telefone: '', email: '', cpf: '', endereco: '', modeloInteresse: '', observacao: '', vendedorId: '', tipoLead: '' })
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

  function abrirEdicao(lead: Lead) {
    setEditandoId(lead.id)
    setEditForm({
      nomeCliente: lead.nomeCliente,
      telefone: lead.telefone ?? '',
      email: lead.email ?? '',
      cpf: lead.cpf ?? '',
      endereco: lead.endereco ?? '',
      modeloInteresse: lead.modeloInteresse ?? '',
      observacao: lead.observacao ?? '',
      vendedorId: lead.vendedorId ?? '',
      tipoLead: lead.tipoLead ?? '',
    })
    setEditErro('')
  }

  function fecharEdicao() {
    setEditandoId(null)
    setEditErro('')
  }

  async function salvarEdicao() {
    if (!editandoId) return
    setEditErro('')
    setEditSalvando(true)
    try {
      await proLaboreApi.leads.editar(editandoId, {
        nomeCliente: editForm.nomeCliente,
        telefone: editForm.telefone || undefined,
        email: editForm.email || undefined,
        cpf: editForm.cpf || undefined,
        endereco: editForm.endereco || undefined,
        modeloInteresse: editForm.modeloInteresse || undefined,
        observacao: editForm.observacao || undefined,
        ...(isDono ? { vendedorId: editForm.vendedorId || null } : {}),
        tipoLead: editForm.tipoLead || null,
      })
      fecharEdicao()
      carregar()
    } catch (err: unknown) {
      setEditErro(err instanceof Error ? err.message : 'Erro ao salvar lead')
    } finally {
      setEditSalvando(false)
    }
  }

  // Pró-labore é sempre do dono, sacado de qualquer venda — teto único da
  // conta. Comissão é o que se paga ao vendedor do lead, com teto próprio
  // (se definido) ou o padrão da conta. Conversão é exclusiva do dono.
  const tetoProLabore = parametro?.tetoProLaborePorVenda ?? 900
  function tetoComissao(vendedorId?: string | null): number {
    const vendedor = vendedorId ? vendedores.find(v => v.id === vendedorId) : undefined
    return vendedor?.tetoComissaoPorVenda ?? parametro?.tetoComissaoPadrao ?? 900
  }

  function abrirConversao(lead: Lead) {
    if (!isDono) return
    setConvertendoId(lead.id)
    setConvertForm({ data: hojeIso(), valorVenda: '', valorProLabore: String(tetoProLabore), valorComissao: lead.vendedorId ? String(tetoComissao(lead.vendedorId)) : '', observacao: '' })
    setConvertErro('')
  }

  function fecharConversao() {
    setConvertendoId(null)
    setConvertErro('')
  }

  function atualizarValorVendaConversao(valor: string) {
    const numero = Number(valor)
    const sugestao = Number.isFinite(numero) && numero > 0 ? Math.min(numero, tetoProLabore) : tetoProLabore
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
        valorComissao: leadConvertendo?.vendedorId && convertForm.valorComissao !== '' ? Number(convertForm.valorComissao) : undefined,
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

  function limparDrag() {
    dragRef.current?.abort.abort()
    dragRef.current = null
    setDraggingId(null)
    setDragOverCol(null)
  }

  function colunaNoPonto(x: number, y: number): EstagioLead | null {
    for (const [estagio, el] of colRefs.current) {
      // Fechamentos exige registrar a venda (valor, pró-labore, comissão) —
      // só o dono faz isso, então pro vendedor essa coluna não é um alvo
      // válido: sem isso o card "não movia" ao soltar ali, sem nenhuma
      // pista visual de por quê.
      if (estagio === 'FECHADO' && !isDono) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return estagio
    }
    return null
  }

  function onPointerMoveWin(e: PointerEvent) {
    const st = dragRef.current
    if (!st) return
    const dx = e.clientX - st.startX, dy = e.clientY - st.startY
    if (!st.dragging) {
      // limiar de ~6px antes de virar arrastada — evita que um simples
      // toque/clique (ex: nos botões do card) já dispare o drag
      if (Math.hypot(dx, dy) < 6) return
      st.dragging = true
      setDraggingId(st.lead.id)
    }
    e.preventDefault()
    const colSobre = colunaNoPonto(e.clientX, e.clientY)
    if (st.colSobre !== colSobre) {
      st.colSobre = colSobre
      setDragOverCol(colSobre)
    }
  }

  function onPointerUpWin() {
    const st = dragRef.current
    limparDrag()
    if (!st?.dragging || !st.colSobre || st.colSobre === st.lead.estagio) return
    if (st.colSobre === 'FECHADO') {
      if (isDono) abrirConversao(st.lead)
    } else {
      mudarEstagio(st.lead, st.colSobre)
    }
  }

  function onPointerCancelWin() {
    limparDrag()
  }

  function onPointerDownCard(e: React.PointerEvent<HTMLDivElement>, lead: Lead) {
    if (lead.vendaId) return
    if ((e.target as HTMLElement).closest('.pl-kanban-card-actions')) return
    const abort = new AbortController()
    dragRef.current = { lead, startX: e.clientX, startY: e.clientY, dragging: false, colSobre: null, abort }
    window.addEventListener('pointermove', onPointerMoveWin, { signal: abort.signal })
    window.addEventListener('pointerup', onPointerUpWin, { signal: abort.signal })
    window.addEventListener('pointercancel', onPointerCancelWin, { signal: abort.signal })
  }

  const leadsFiltrados = leads.filter(l => !filtroCanal || l.tipoLead === filtroCanal)
  const leadsAtivos = leadsFiltrados.filter(l => l.estagio !== 'PERDIDO')
  const leadsPerdidos = leadsFiltrados.filter(l => l.estagio === 'PERDIDO')

  const totalFiltrado = leadsFiltrados.length
  const fechadosFiltrado = leadsFiltrados.filter(l => l.vendaId).length
  const conversaoFiltrado = totalFiltrado > 0 ? (fechadosFiltrado / totalFiltrado) * 100 : 0

  const leadConvertendo = convertendoId ? leads.find(l => l.id === convertendoId) ?? null : null
  const tetoComissaoAtual = leadConvertendo?.vendedorId ? tetoComissao(leadConvertendo.vendedorId) : null
  const leadEditando = editandoId ? leads.find(l => l.id === editandoId) ?? null : null

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
            <label>E-mail (opcional)</label>
            <input type="email" className="pl-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="cliente@email.com" />
          </div>
          <div className="pl-field">
            <label>CPF (opcional)</label>
            <input className="pl-input" value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
          </div>
          <div className="pl-field">
            <label>Endereço (opcional)</label>
            <input className="pl-input" value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Ex: Rua, número, cidade" />
          </div>
          <div className="pl-field">
            <label>Modelo de interesse (opcional)</label>
            <input className="pl-input" value={form.modeloInteresse} onChange={e => setForm(f => ({ ...f, modeloInteresse: e.target.value }))} placeholder="Ex: CG 160" />
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
            <input className="pl-input" value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: preferências do cliente" />
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
                  ref={el => { if (el) colRefs.current.set(col.estagio, el); else colRefs.current.delete(col.estagio) }}
                  className={`pl-kanban-col ${dragOverCol === col.estagio ? 'drop-active' : ''}`}
                >
                  <div className="pl-kanban-col-head">
                    <div>
                      <div className="pl-kanban-col-title">{col.titulo}</div>
                      {col.estagio === 'FECHADO' && !isDono && (
                        <div className="pl-kanban-col-hint">Confirmação de venda é só do dono</div>
                      )}
                    </div>
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
                          style={movivel ? undefined : { cursor: 'default' }}
                          onPointerDown={movivel ? e => onPointerDownCard(e, lead) : undefined}
                        >
                          <div className="pl-kanban-card-name">{lead.nomeCliente}</div>
                          {(lead.telefone || (isDono && lead.vendedor)) && (
                            <div className="pl-kanban-card-meta">
                              {lead.telefone}{lead.telefone && isDono && lead.vendedor ? ' · ' : ''}{isDono && lead.vendedor ? lead.vendedor.nome : ''}
                            </div>
                          )}
                          {lead.modeloInteresse && <div className="pl-kanban-card-meta">Interesse: {lead.modeloInteresse}</div>}
                          {lead.observacao && <div className="pl-kanban-card-meta">{lead.observacao}</div>}
                          {lead.tipoLead && <span className={`pl-kanban-card-tag ${TIPO_CLASS[lead.tipoLead]}`}>{TIPO_LABEL[lead.tipoLead]}</span>}
                          {lead.vendaId ? (
                            <div className="pl-kanban-card-badge">✓ Convertido em venda</div>
                          ) : (
                            <div className="pl-kanban-card-actions">
                              {isDono && col.estagio !== 'FECHADO' && <span onClick={() => abrirConversao(lead)}>Converter</span>}
                              <span onClick={() => abrirEdicao(lead)}>Editar</span>
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
                <input type="number" step="0.01" min="0" max={tetoProLabore} className="pl-input" value={convertForm.valorProLabore} onChange={e => setConvertForm(f => ({ ...f, valorProLabore: e.target.value }))} placeholder="0,00" required />
                <span className="pl-hint">Máximo {formatMoeda(tetoProLabore)}</span>
              </div>
              {leadConvertendo.vendedorId && (
                <div className="pl-field">
                  <label>Comissão do vendedor (R$)</label>
                  <input type="number" step="0.01" min="0" max={tetoComissaoAtual ?? undefined} className="pl-input" value={convertForm.valorComissao} onChange={e => setConvertForm(f => ({ ...f, valorComissao: e.target.value }))} placeholder="0,00" />
                  <span className="pl-hint">Máximo {formatMoeda(tetoComissaoAtual ?? 0)}</span>
                </div>
              )}
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

      {leadEditando && (
        <div className="pl-modal-backdrop" onClick={fecharEdicao}>
          <div className="pl-card pl-modal-panel" onClick={e => e.stopPropagation()}>
            <div className="pl-card-title" style={{ marginBottom: 4 }}>Editar lead</div>
            <div className="pl-card-sub" style={{ marginBottom: 16 }}>{leadEditando.nomeCliente}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="pl-field">
                <label>Nome do cliente</label>
                <input className="pl-input" value={editForm.nomeCliente} onChange={e => setEditForm(f => ({ ...f, nomeCliente: e.target.value }))} required minLength={2} />
              </div>
              <div className="pl-field">
                <label>Telefone (opcional)</label>
                <input className="pl-input" value={editForm.telefone} onChange={e => setEditForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
              </div>
              <div className="pl-field">
                <label>E-mail (opcional)</label>
                <input type="email" className="pl-input" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="cliente@email.com" />
              </div>
              <div className="pl-field">
                <label>CPF (opcional)</label>
                <input className="pl-input" value={editForm.cpf} onChange={e => setEditForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
              </div>
              <div className="pl-field">
                <label>Endereço (opcional)</label>
                <input className="pl-input" value={editForm.endereco} onChange={e => setEditForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Ex: Rua, número, cidade" />
              </div>
              <div className="pl-field">
                <label>Modelo de interesse (opcional)</label>
                <input className="pl-input" value={editForm.modeloInteresse} onChange={e => setEditForm(f => ({ ...f, modeloInteresse: e.target.value }))} placeholder="Ex: CG 160" />
              </div>
              <div className="pl-field">
                <label>Canal (opcional)</label>
                <select className="pl-select" value={editForm.tipoLead} onChange={e => setEditForm(f => ({ ...f, tipoLead: e.target.value as TipoLead | '' }))}>
                  <option value="">— Não informado —</option>
                  {TIPOS_LEAD.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
                </select>
              </div>
              {isDono && (
                <div className="pl-field">
                  <label>Vendedor (opcional)</label>
                  <select className="pl-select" value={editForm.vendedorId} onChange={e => setEditForm(f => ({ ...f, vendedorId: e.target.value }))}>
                    <option value="">— Sem vendedor —</option>
                    {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                  </select>
                </div>
              )}
              <div className="pl-field">
                <label>Observação (opcional)</label>
                <input className="pl-input" value={editForm.observacao} onChange={e => setEditForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: preferências do cliente" />
              </div>
            </div>
            {editErro && <div className="pl-alert pl-alert-error" style={{ marginTop: 14 }}>{editErro}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="button" className="pl-btn pl-btn-primary" disabled={editSalvando} onClick={salvarEdicao}>
                {editSalvando ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={fecharEdicao}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
