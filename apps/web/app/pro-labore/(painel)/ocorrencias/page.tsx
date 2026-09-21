'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  proLaboreApi, Ocorrencia, ResumoOcorrencias, Vendedor, ParametroLiquidez,
  TIPOS_OCORRENCIA, TIPO_OCORRENCIA_LABEL, TipoOcorrencia,
  GRAVIDADES_OCORRENCIA, GRAVIDADE_OCORRENCIA_LABEL, GravidadeOcorrencia,
  STATUS_OCORRENCIA, STATUS_OCORRENCIA_LABEL, StatusOcorrencia,
  MEDIDAS_DISCIPLINARES, MEDIDA_DISCIPLINAR_LABEL, MedidaDisciplinar,
  SugestaoMedidaOcorrencia,
} from '@/lib/proLaboreApi'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { gerarDocumentoOcorrenciaPdf } from '@/lib/ocorrenciaDocumento'
import { PageHeader } from '../../PageHeader'

const STATUS_BADGE_CLASS: Record<StatusOcorrencia, string> = {
  ABERTA: 'atencao',
  EM_PRAZO: 'atencao',
  EM_VERIFICACAO: 'atencao',
  RESOLVIDA: 'bom',
  REINCIDENTE: 'critico',
  ESCALONADA: 'critico',
  ENCERRADA: 'neutro',
}

const GRAVIDADE_BADGE_CLASS: Record<GravidadeOcorrencia, string> = {
  LEVE: 'leve',
  MODERADA: 'moderada',
  GRAVE: 'grave',
  GRAVISSIMA: 'gravissima',
}

function toDateInputValue(iso?: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

function hojeInputValue(): string {
  return new Date().toISOString().slice(0, 10)
}

interface FormOcorrencia {
  vendedorId: string
  tipo: TipoOcorrencia
  motivo: string
  gravidade: GravidadeOcorrencia
  descricao: string
  dataOcorrencia: string
  registradoPor: string
  planoDeCorrecao: string
  prazoCorrecao: string
  ocorrenciaAnteriorId?: string
}

const FORM_VAZIO: FormOcorrencia = {
  vendedorId: '',
  tipo: 'DISCIPLINAR',
  motivo: '',
  gravidade: 'LEVE',
  descricao: '',
  dataOcorrencia: hojeInputValue(),
  registradoPor: '',
  planoDeCorrecao: '',
  prazoCorrecao: '',
  ocorrenciaAnteriorId: undefined,
}

export default function ProLaboreOcorrenciasPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>}>
      <OcorrenciasConteudo />
    </Suspense>
  )
}

function OcorrenciasConteudo() {
  const { usuario } = useProLaboreAuth()
  // Aba disponível pro dono e pro supervisor — vendedor comum não deve
  // enxergar ocorrências disciplinares/feedback da equipe.
  const podeAcessar = usuario?.papel === 'DONO' || usuario?.papel === 'SUPERVISOR'
  // Permite chegar aqui já filtrado por vendedor a partir do bloco "Histórico
  // de Ocorrências" no perfil dele, em Vendedores (?vendedorId=...).
  const searchParams = useSearchParams()
  const vendedorIdParam = searchParams.get('vendedorId')

  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [resumo, setResumo] = useState<ResumoOcorrencias | null>(null)
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [parametro, setParametro] = useState<ParametroLiquidez | null>(null)
  const [loading, setLoading] = useState(true)

  const [filtroVendedor, setFiltroVendedor] = useState(vendedorIdParam ?? '')
  const [filtroTipo, setFiltroTipo] = useState<TipoOcorrencia | ''>('')
  const [filtroGravidade, setFiltroGravidade] = useState<GravidadeOcorrencia | ''>('')
  const [filtroStatus, setFiltroStatus] = useState<StatusOcorrencia | ''>('')

  const [modalAberto, setModalAberto] = useState(false)
  const [form, setForm] = useState<FormOcorrencia>(FORM_VAZIO)
  const [sugestao, setSugestao] = useState<SugestaoMedidaOcorrencia | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [selecionadaId, setSelecionadaId] = useState<string | null>(null)
  const [selecionada, setSelecionada] = useState<Ocorrencia | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)

  const [editando, setEditando] = useState(false)
  const [formEdicao, setFormEdicao] = useState<FormOcorrencia>(FORM_VAZIO)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [erroEdicao, setErroEdicao] = useState('')

  const [desfechoAberto, setDesfechoAberto] = useState(false)
  const [desfechoResultado, setDesfechoResultado] = useState<'CORRIGIDO' | 'NAO_CORRIGIDO'>('CORRIGIDO')
  const [desfechoEncaminhamento, setDesfechoEncaminhamento] = useState<'REINCIDENTE' | 'ESCALONADA'>('REINCIDENTE')
  const [desfechoMedida, setDesfechoMedida] = useState<MedidaDisciplinar>('NENHUMA')
  const [desfechoObs, setDesfechoObs] = useState('')
  const [desfechoSalvando, setDesfechoSalvando] = useState(false)
  const [desfechoErro, setDesfechoErro] = useState('')
  const [sugestaoDesfecho, setSugestaoDesfecho] = useState<SugestaoMedidaOcorrencia | null>(null)

  const carregar = useCallback(() => {
    if (!podeAcessar) { setLoading(false); return }
    Promise.all([
      proLaboreApi.ocorrencias.listar({
        vendedorId: filtroVendedor || undefined,
        tipo: filtroTipo || undefined,
        gravidade: filtroGravidade || undefined,
        status: filtroStatus || undefined,
      }),
      proLaboreApi.ocorrencias.resumo(),
      proLaboreApi.vendedores.listar(),
      proLaboreApi.parametros.get(),
    ]).then(([o, r, v, p]) => { setOcorrencias(o); setResumo(r); setVendedores(v); setParametro(p) })
      .finally(() => setLoading(false))
  }, [podeAcessar, filtroVendedor, filtroTipo, filtroGravidade, filtroStatus])

  useEffect(() => { carregar() }, [carregar])

  const motivosSugeridos = useMemo(
    () => (parametro?.motivosOcorrenciaCsv ?? '').split(',').map(m => m.trim()).filter(Boolean),
    [parametro],
  )

  const vendedorNome = useCallback((id: string) => vendedores.find(v => v.id === id)?.nome ?? '—', [vendedores])

  function prazoVencido(o: Ocorrencia): boolean {
    return !!o.prazoCorrecao && (o.status === 'ABERTA' || o.status === 'EM_PRAZO') && new Date(o.prazoCorrecao) < new Date()
  }

  // --- Modal de criação ---

  function abrirModal(preenchimento?: Partial<FormOcorrencia>) {
    setForm({ ...FORM_VAZIO, registradoPor: usuario?.nome ?? '', dataOcorrencia: hojeInputValue(), ...preenchimento })
    setErro('')
    setSugestao(null)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setForm(FORM_VAZIO)
    setErro('')
    setSugestao(null)
  }

  useEffect(() => {
    if (!modalAberto || !form.vendedorId) { setSugestao(null); return }
    proLaboreApi.ocorrencias.sugestaoMedida(form.vendedorId, form.tipo).then(setSugestao).catch(() => setSugestao(null))
  }, [modalAberto, form.vendedorId, form.tipo])

  async function salvarNovaOcorrencia(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const criada = await proLaboreApi.ocorrencias.criar({
        vendedorId: form.vendedorId,
        tipo: form.tipo,
        motivo: form.motivo,
        gravidade: form.gravidade,
        descricao: form.descricao,
        dataOcorrencia: form.dataOcorrencia,
        registradoPor: form.registradoPor,
        planoDeCorrecao: form.planoDeCorrecao || undefined,
        prazoCorrecao: form.prazoCorrecao || undefined,
        ocorrenciaAnteriorId: form.ocorrenciaAnteriorId,
      })
      fecharModal()
      carregar()
      abrirDetalhe(criada.id)
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar ocorrência')
    } finally {
      setSalvando(false)
    }
  }

  // --- Detalhe / timeline ---

  const abrirDetalhe = useCallback((id: string) => {
    setSelecionadaId(id)
    setEditando(false)
    setDesfechoAberto(false)
    setCarregandoDetalhe(true)
    proLaboreApi.ocorrencias.obter(id).then(setSelecionada).finally(() => setCarregandoDetalhe(false))
  }, [])

  function fecharDetalhe() {
    setSelecionadaId(null)
    setSelecionada(null)
    setEditando(false)
    setDesfechoAberto(false)
  }

  function iniciarEdicao(o: Ocorrencia) {
    setFormEdicao({
      vendedorId: o.vendedorId,
      tipo: o.tipo,
      motivo: o.motivo,
      gravidade: o.gravidade,
      descricao: o.descricao,
      dataOcorrencia: toDateInputValue(o.dataOcorrencia),
      registradoPor: o.registradoPor,
      planoDeCorrecao: o.planoDeCorrecao ?? '',
      prazoCorrecao: toDateInputValue(o.prazoCorrecao),
      ocorrenciaAnteriorId: o.ocorrenciaAnteriorId ?? undefined,
    })
    setErroEdicao('')
    setEditando(true)
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault()
    if (!selecionada) return
    setErroEdicao('')
    setSalvandoEdicao(true)
    try {
      const atualizada = await proLaboreApi.ocorrencias.editar(selecionada.id, {
        tipo: formEdicao.tipo,
        motivo: formEdicao.motivo,
        gravidade: formEdicao.gravidade,
        descricao: formEdicao.descricao,
        dataOcorrencia: formEdicao.dataOcorrencia,
        planoDeCorrecao: formEdicao.planoDeCorrecao || null,
        prazoCorrecao: formEdicao.prazoCorrecao || null,
      })
      setSelecionada(atualizada)
      setEditando(false)
      carregar()
    } catch (err: unknown) {
      setErroEdicao(err instanceof Error ? err.message : 'Erro ao salvar alterações')
    } finally {
      setSalvandoEdicao(false)
    }
  }

  async function encerrar(o: Ocorrencia) {
    if (!confirm('Encerrar esta ocorrência? Ela some das pendências, mas continua registrada no histórico.')) return
    const atualizada = await proLaboreApi.ocorrencias.editar(o.id, { status: 'ENCERRADA' })
    setSelecionada(atualizada)
    carregar()
  }

  // --- Desfecho (verificação de prazo) ---

  function abrirDesfecho(o: Ocorrencia) {
    setDesfechoResultado('CORRIGIDO')
    setDesfechoEncaminhamento('REINCIDENTE')
    setDesfechoMedida('NENHUMA')
    setDesfechoObs('')
    setDesfechoErro('')
    setSugestaoDesfecho(null)
    setDesfechoAberto(true)
    proLaboreApi.ocorrencias.sugestaoMedida(o.vendedorId, o.tipo).then(setSugestaoDesfecho).catch(() => setSugestaoDesfecho(null))
  }

  async function salvarDesfecho(e: React.FormEvent) {
    e.preventDefault()
    if (!selecionada) return
    setDesfechoErro('')
    setDesfechoSalvando(true)
    try {
      const atualizada = await proLaboreApi.ocorrencias.registrarDesfecho(selecionada.id, {
        resultado: desfechoResultado,
        encaminhamento: desfechoResultado === 'NAO_CORRIGIDO' ? desfechoEncaminhamento : undefined,
        medidaAplicada: desfechoResultado === 'NAO_CORRIGIDO' ? desfechoMedida : undefined,
        observacao: desfechoObs || undefined,
      })
      setSelecionada(atualizada)
      setDesfechoAberto(false)
      carregar()
    } catch (err: unknown) {
      setDesfechoErro(err instanceof Error ? err.message : 'Erro ao registrar desfecho')
    } finally {
      setDesfechoSalvando(false)
    }
  }

  function abrirVinculada(o: Ocorrencia) {
    fecharDetalhe()
    abrirModal({ vendedorId: o.vendedorId, tipo: o.tipo, ocorrenciaAnteriorId: o.id })
  }

  // --- Documento (PDF) e assinaturas ---

  const [gerandoDocumento, setGerandoDocumento] = useState(false)

  async function gerarDocumento(o: Ocorrencia) {
    setGerandoDocumento(true)
    try {
      const vendedor = vendedores.find(v => v.id === o.vendedorId)
      await gerarDocumentoOcorrenciaPdf(o, o.vendedor?.nome ?? vendedor?.nome ?? vendedorNome(o.vendedorId), vendedor?.papel)
      const atualizada = await proLaboreApi.ocorrencias.marcarDocumentoGerado(o.id)
      setSelecionada(atualizada)
      carregar()
    } finally {
      setGerandoDocumento(false)
    }
  }

  async function alternarAssinatura(o: Ocorrencia, parte: 'VENDEDOR' | 'GESTOR', assinado: boolean) {
    const atualizada = await proLaboreApi.ocorrencias.registrarAssinatura(o.id, parte, assinado)
    setSelecionada(atualizada)
    carregar()
  }

  if (!podeAcessar) {
    return (
      <div className="pl-empty pl-card">
        <div className="pl-emoji">🔒</div>
        <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Área restrita a supervisores e ao dono da operação</h3>
        <p style={{ marginTop: 6 }}>Fale com o responsável se precisar registrar ou consultar ocorrências.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Equipe"
        title="Ocorrências"
        subtitle="Registro disciplinar e de feedback da equipe comercial — protocolo, prazos e histórico de correção"
        actions={<button type="button" className="pl-btn pl-btn-primary" onClick={() => abrirModal()}>Nova Ocorrência</button>}
      />

      {resumo && (
        <div className="pl-kpi-grid" style={{ marginBottom: 20 }}>
          <div className="pl-kpi">
            <div className="pl-kpi-label">Ocorrências abertas</div>
            <div className="pl-kpi-value">{resumo.abertas}</div>
          </div>
          <div className="pl-kpi">
            <div className="pl-kpi-label">Prazos vencendo esta semana</div>
            <div className="pl-kpi-value">{resumo.prazosVencendo}</div>
          </div>
          <div className="pl-kpi">
            <div className="pl-kpi-label">Reincidências ativas</div>
            <div className="pl-kpi-value">{resumo.reincidenciasAtivas}</div>
          </div>
          <div className="pl-kpi">
            <div className="pl-kpi-label">Resolvidas no mês</div>
            <div className="pl-kpi-value">{resumo.resolvidasNoMes}</div>
          </div>
        </div>
      )}

      <div className="pl-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="pl-field" style={{ minWidth: 180 }}>
            <label>Vendedor</label>
            <select className="pl-select" value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}>
              <option value="">Todos</option>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </div>
          <div className="pl-field" style={{ minWidth: 160 }}>
            <label>Tipo</label>
            <select className="pl-select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as TipoOcorrencia | '')}>
              <option value="">Todos</option>
              {TIPOS_OCORRENCIA.map(t => <option key={t} value={t}>{TIPO_OCORRENCIA_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="pl-field" style={{ minWidth: 140 }}>
            <label>Gravidade</label>
            <select className="pl-select" value={filtroGravidade} onChange={e => setFiltroGravidade(e.target.value as GravidadeOcorrencia | '')}>
              <option value="">Todas</option>
              {GRAVIDADES_OCORRENCIA.map(g => <option key={g} value={g}>{GRAVIDADE_OCORRENCIA_LABEL[g]}</option>)}
            </select>
          </div>
          <div className="pl-field" style={{ minWidth: 170 }}>
            <label>Status</label>
            <select className="pl-select" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as StatusOcorrencia | '')}>
              <option value="">Todos</option>
              {STATUS_OCORRENCIA.map(s => <option key={s} value={s}>{STATUS_OCORRENCIA_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>
      ) : ocorrencias.length === 0 ? (
        <div className="pl-empty pl-card">
          <div className="pl-emoji">📋</div>
          Nenhuma ocorrência registrada com esses filtros.
        </div>
      ) : (
        <div className="pl-table-wrap">
          <table className="pl-table">
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Vendedor</th>
                <th>Tipo</th>
                <th>Gravidade</th>
                <th>Data</th>
                <th>Prazo</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ocorrencias.map(o => (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => abrirDetalhe(o.id)}>
                  <td className="pl-mono">{o.protocolo}</td>
                  <td>{o.vendedor?.nome ?? vendedorNome(o.vendedorId)}</td>
                  <td>{TIPO_OCORRENCIA_LABEL[o.tipo]}</td>
                  <td><span className={`pl-gravidade-badge ${GRAVIDADE_BADGE_CLASS[o.gravidade]}`}>{GRAVIDADE_OCORRENCIA_LABEL[o.gravidade]}</span></td>
                  <td>{new Date(o.dataOcorrencia).toLocaleDateString('pt-BR')}</td>
                  <td>
                    {o.prazoCorrecao ? (
                      <span className={prazoVencido(o) ? 'pl-delta down' : undefined} style={prazoVencido(o) ? { display: 'inline-flex' } : undefined}>
                        {new Date(o.prazoCorrecao).toLocaleDateString('pt-BR')}{prazoVencido(o) ? ' (vencido)' : ''}
                      </span>
                    ) : <span style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>—</span>}
                  </td>
                  <td><span className={`pl-status-badge ${STATUS_BADGE_CLASS[o.status]}`}>{STATUS_OCORRENCIA_LABEL[o.status]}</span></td>
                  <td className="pl-right" onClick={e => e.stopPropagation()}>
                    <span className="pl-link-action" onClick={() => abrirDetalhe(o.id)}>Ver detalhes</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <div className="pl-modal-backdrop" onClick={fecharModal}>
          <form onSubmit={salvarNovaOcorrencia} className="pl-card pl-modal-panel" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="pl-card-title" style={{ marginBottom: 14 }}>Nova ocorrência</div>
            {form.ocorrenciaAnteriorId && <div className="pl-hint" style={{ marginBottom: 10 }}>Vinculada à ocorrência anterior (reincidência)</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="pl-field">
                  <label>Vendedor</label>
                  <select className="pl-select" value={form.vendedorId} onChange={e => setForm(f => ({ ...f, vendedorId: e.target.value }))} required>
                    <option value="" disabled>Selecione</option>
                    {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                  </select>
                </div>
                <div className="pl-field">
                  <label>Tipo</label>
                  <select className="pl-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoOcorrencia }))}>
                    {TIPOS_OCORRENCIA.map(t => <option key={t} value={t}>{TIPO_OCORRENCIA_LABEL[t]}</option>)}
                  </select>
                </div>
              </div>

              {sugestao?.aplicavel && (
                <div className="pl-hint">
                  {sugestao.ordinal}ª ocorrência dessa categoria para este vendedor — régua sugerida: <strong>{sugestao.descricaoSugerida}</strong> (a decisão final é sempre manual)
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="pl-field">
                  <label>Motivo</label>
                  <input className="pl-input" list="pl-motivos-ocorrencia" value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Ex: Atraso recorrente" required />
                  <datalist id="pl-motivos-ocorrencia">
                    {motivosSugeridos.map(m => <option key={m} value={m} />)}
                  </datalist>
                  <span className="pl-hint">Não achou o motivo? Digite um novo — ele fica salvo pra próxima vez</span>
                </div>
                <div className="pl-field">
                  <label>Gravidade</label>
                  <select className="pl-select" value={form.gravidade} onChange={e => setForm(f => ({ ...f, gravidade: e.target.value as GravidadeOcorrencia }))}>
                    {GRAVIDADES_OCORRENCIA.map(g => <option key={g} value={g}>{GRAVIDADE_OCORRENCIA_LABEL[g]}</option>)}
                  </select>
                </div>
              </div>

              <div className="pl-field">
                <label>Descrição dos fatos</label>
                <textarea className="pl-input" rows={3} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva objetivamente o ocorrido" required minLength={3} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="pl-field">
                  <label>Data da ocorrência</label>
                  <input type="date" className="pl-input" value={form.dataOcorrencia} onChange={e => setForm(f => ({ ...f, dataOcorrencia: e.target.value }))} required />
                </div>
                <div className="pl-field">
                  <label>Responsável pelo registro</label>
                  <input className="pl-input" value={form.registradoPor} onChange={e => setForm(f => ({ ...f, registradoPor: e.target.value }))} placeholder="Nome do gestor" required minLength={2} />
                </div>
              </div>

              <div className="pl-field">
                <label>Plano de correção (opcional)</label>
                <textarea className="pl-input" rows={2} value={form.planoDeCorrecao} onChange={e => setForm(f => ({ ...f, planoDeCorrecao: e.target.value }))} placeholder="O que se espera que o colaborador faça pra corrigir" />
              </div>

              <div className="pl-field" style={{ maxWidth: 220 }}>
                <label>Prazo de correção (opcional)</label>
                <input type="date" className="pl-input" value={form.prazoCorrecao} onChange={e => setForm(f => ({ ...f, prazoCorrecao: e.target.value }))} />
              </div>
            </div>

            {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 14 }}>{erro}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Registrar ocorrência'}</button>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={fecharModal}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {selecionadaId && (
        <div className="pl-modal-backdrop" onClick={fecharDetalhe}>
          <div className="pl-card pl-modal-panel" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            {carregandoDetalhe || !selecionada ? (
              <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>
            ) : editando ? (
              <form onSubmit={salvarEdicao}>
                <div className="pl-card-title" style={{ marginBottom: 14 }}>Editar ocorrência {selecionada.protocolo}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="pl-field">
                      <label>Tipo</label>
                      <select className="pl-select" value={formEdicao.tipo} onChange={e => setFormEdicao(f => ({ ...f, tipo: e.target.value as TipoOcorrencia }))}>
                        {TIPOS_OCORRENCIA.map(t => <option key={t} value={t}>{TIPO_OCORRENCIA_LABEL[t]}</option>)}
                      </select>
                    </div>
                    <div className="pl-field">
                      <label>Gravidade</label>
                      <select className="pl-select" value={formEdicao.gravidade} onChange={e => setFormEdicao(f => ({ ...f, gravidade: e.target.value as GravidadeOcorrencia }))}>
                        {GRAVIDADES_OCORRENCIA.map(g => <option key={g} value={g}>{GRAVIDADE_OCORRENCIA_LABEL[g]}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="pl-field">
                    <label>Motivo</label>
                    <input className="pl-input" list="pl-motivos-ocorrencia" value={formEdicao.motivo} onChange={e => setFormEdicao(f => ({ ...f, motivo: e.target.value }))} required />
                  </div>
                  <div className="pl-field">
                    <label>Descrição dos fatos</label>
                    <textarea className="pl-input" rows={3} value={formEdicao.descricao} onChange={e => setFormEdicao(f => ({ ...f, descricao: e.target.value }))} required minLength={3} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="pl-field">
                      <label>Data da ocorrência</label>
                      <input type="date" className="pl-input" value={formEdicao.dataOcorrencia} onChange={e => setFormEdicao(f => ({ ...f, dataOcorrencia: e.target.value }))} required />
                    </div>
                    <div className="pl-field">
                      <label>Prazo de correção</label>
                      <input type="date" className="pl-input" value={formEdicao.prazoCorrecao} onChange={e => setFormEdicao(f => ({ ...f, prazoCorrecao: e.target.value }))} />
                    </div>
                  </div>
                  <div className="pl-field">
                    <label>Plano de correção</label>
                    <textarea className="pl-input" rows={2} value={formEdicao.planoDeCorrecao} onChange={e => setFormEdicao(f => ({ ...f, planoDeCorrecao: e.target.value }))} />
                  </div>
                </div>
                {erroEdicao && <div className="pl-alert pl-alert-error" style={{ marginTop: 14 }}>{erroEdicao}</div>}
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button type="submit" className="pl-btn pl-btn-primary" disabled={salvandoEdicao}>{salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}</button>
                  <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setEditando(false)}>Cancelar</button>
                </div>
              </form>
            ) : desfechoAberto ? (
              <form onSubmit={salvarDesfecho}>
                <div className="pl-card-title" style={{ marginBottom: 14 }}>Registrar desfecho — {selecionada.protocolo}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="pl-field">
                    <label>O plano de correção foi cumprido?</label>
                    <select className="pl-select" value={desfechoResultado} onChange={e => setDesfechoResultado(e.target.value as 'CORRIGIDO' | 'NAO_CORRIGIDO')}>
                      <option value="CORRIGIDO">Sim, corrigido</option>
                      <option value="NAO_CORRIGIDO">Não corrigido</option>
                    </select>
                  </div>
                  {desfechoResultado === 'NAO_CORRIGIDO' && (
                    <>
                      <div className="pl-field">
                        <label>Encaminhamento</label>
                        <select className="pl-select" value={desfechoEncaminhamento} onChange={e => setDesfechoEncaminhamento(e.target.value as 'REINCIDENTE' | 'ESCALONADA')}>
                          <option value="REINCIDENTE">Reincidente</option>
                          <option value="ESCALONADA">Escalonada</option>
                        </select>
                      </div>
                      {sugestaoDesfecho?.aplicavel && (
                        <div className="pl-hint">
                          {sugestaoDesfecho.ordinal}ª ocorrência dessa categoria — régua sugerida: <strong>{sugestaoDesfecho.descricaoSugerida}</strong> (decisão final é sempre manual)
                        </div>
                      )}
                      <div className="pl-field">
                        <label>Medida aplicada</label>
                        <select className="pl-select" value={desfechoMedida} onChange={e => setDesfechoMedida(e.target.value as MedidaDisciplinar)}>
                          {MEDIDAS_DISCIPLINARES.map(m => <option key={m} value={m}>{MEDIDA_DISCIPLINAR_LABEL[m]}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                  <div className="pl-field">
                    <label>Observação (opcional)</label>
                    <textarea className="pl-input" rows={2} value={desfechoObs} onChange={e => setDesfechoObs(e.target.value)} />
                  </div>
                </div>
                {desfechoErro && <div className="pl-alert pl-alert-error" style={{ marginTop: 14 }}>{desfechoErro}</div>}
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button type="submit" className="pl-btn pl-btn-primary" disabled={desfechoSalvando}>{desfechoSalvando ? 'Salvando...' : 'Confirmar desfecho'}</button>
                  <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setDesfechoAberto(false)}>Cancelar</button>
                </div>
              </form>
            ) : (
              <>
                <div className="pl-card-head">
                  <div>
                    <div className="pl-eyebrow pl-mono">{selecionada.protocolo}</div>
                    <div className="pl-card-title">{selecionada.vendedor?.nome ?? vendedorNome(selecionada.vendedorId)}</div>
                    <div className="pl-card-sub">{TIPO_OCORRENCIA_LABEL[selecionada.tipo]} · {selecionada.motivo}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className={`pl-gravidade-badge ${GRAVIDADE_BADGE_CLASS[selecionada.gravidade]}`}>{GRAVIDADE_OCORRENCIA_LABEL[selecionada.gravidade]}</span>
                    <span className={`pl-status-badge ${STATUS_BADGE_CLASS[selecionada.status]}`}>{STATUS_OCORRENCIA_LABEL[selecionada.status]}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--pl-ink-2)' }}>
                  <div><strong>Descrição:</strong> {selecionada.descricao}</div>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <span><strong>Data da ocorrência:</strong> {new Date(selecionada.dataOcorrencia).toLocaleDateString('pt-BR')}</span>
                    <span><strong>Registrado por:</strong> {selecionada.registradoPor}</span>
                    <span><strong>Registrado em:</strong> {new Date(selecionada.dataRegistro).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {selecionada.planoDeCorrecao && <div><strong>Plano de correção:</strong> {selecionada.planoDeCorrecao}</div>}
                  {selecionada.prazoCorrecao && (
                    <div>
                      <strong>Prazo de correção:</strong> {new Date(selecionada.prazoCorrecao).toLocaleDateString('pt-BR')}
                      {prazoVencido(selecionada) && <span className="pl-delta down" style={{ display: 'inline-flex', marginLeft: 8 }}>Vencido</span>}
                    </div>
                  )}
                  {selecionada.medidaAplicada !== 'NENHUMA' && <div><strong>Medida aplicada:</strong> {MEDIDA_DISCIPLINAR_LABEL[selecionada.medidaAplicada]}</div>}
                  {selecionada.ocorrenciaAnterior && <div><strong>Vinculada à ocorrência anterior:</strong> <span className="pl-mono">{selecionada.ocorrenciaAnterior.protocolo}</span></div>}
                  {selecionada.reincidencias && selecionada.reincidencias.length > 0 && (
                    <div><strong>Reincidências geradas:</strong> {selecionada.reincidencias.map(r => r.protocolo).join(', ')}</div>
                  )}
                </div>

                <div className="pl-card" style={{ margin: '16px 0', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--pl-ink-2)' }}>
                      {selecionada.documentoGeradoEm
                        ? <>Documento gerado em {new Date(selecionada.documentoGeradoEm).toLocaleString('pt-BR')}</>
                        : <span style={{ color: 'var(--pl-ink-muted)' }}>Nenhum documento gerado ainda</span>}
                    </div>
                    <button type="button" className="pl-btn pl-btn-ghost" disabled={gerandoDocumento} onClick={() => gerarDocumento(selecionada)}>
                      {gerandoDocumento ? 'Gerando...' : selecionada.documentoGeradoEm ? 'Gerar novamente (PDF)' : 'Gerar documento (PDF)'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 10, fontSize: 12.5 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={selecionada.assinaturaVendedorOk} onChange={e => alternarAssinatura(selecionada, 'VENDEDOR', e.target.checked)} />
                      Colaborador assinou{selecionada.assinaturaVendedorData ? ` (${new Date(selecionada.assinaturaVendedorData).toLocaleDateString('pt-BR')})` : ''}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={selecionada.assinaturaGestorOk} onChange={e => alternarAssinatura(selecionada, 'GESTOR', e.target.checked)} />
                      Gestor assinou{selecionada.assinaturaGestorData ? ` (${new Date(selecionada.assinaturaGestorData).toLocaleDateString('pt-BR')})` : ''}
                    </label>
                  </div>
                  <div className="pl-hint" style={{ marginTop: 8 }}>A assinatura acontece no papel — aqui só se confirma que ela ocorreu, mantendo o sistema como registro oficial.</div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '16px 0' }}>
                  {selecionada.status !== 'ENCERRADA' && (
                    <button type="button" className="pl-btn pl-btn-ghost" onClick={() => iniciarEdicao(selecionada)}>Editar</button>
                  )}
                  {selecionada.status !== 'RESOLVIDA' && selecionada.status !== 'ENCERRADA' && (
                    <button type="button" className="pl-btn pl-btn-primary" onClick={() => abrirDesfecho(selecionada)}>Registrar desfecho</button>
                  )}
                  {(selecionada.status === 'REINCIDENTE' || selecionada.status === 'ESCALONADA') && (
                    <button type="button" className="pl-btn pl-btn-ghost" onClick={() => abrirVinculada(selecionada)}>Nova ocorrência vinculada</button>
                  )}
                  {selecionada.status !== 'ENCERRADA' && (
                    <button type="button" className="pl-btn pl-btn-ghost" onClick={() => encerrar(selecionada)}>Encerrar</button>
                  )}
                </div>

                <div className="pl-card-title" style={{ fontSize: 13, marginBottom: 8 }}>Histórico</div>
                <div className="pl-timeline">
                  {selecionada.historico.map(h => (
                    <div key={h.id} className="pl-timeline-item">
                      <div className="pl-timeline-date">{new Date(h.criadoEm).toLocaleString('pt-BR')}</div>
                      <div className="pl-timeline-autor">{h.autor}</div>
                      <div className="pl-timeline-acao">{h.acao}</div>
                      {h.statusAnterior && h.statusNovo && (
                        <div className="pl-timeline-transicao">
                          {STATUS_OCORRENCIA_LABEL[h.statusAnterior as StatusOcorrencia] ?? h.statusAnterior} → {STATUS_OCORRENCIA_LABEL[h.statusNovo as StatusOcorrencia] ?? h.statusNovo}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16 }}>
                  <button type="button" className="pl-btn pl-btn-ghost" onClick={fecharDetalhe}>Fechar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
