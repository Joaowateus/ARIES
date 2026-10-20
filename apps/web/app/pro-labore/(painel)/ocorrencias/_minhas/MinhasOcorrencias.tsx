'use client'

// Minhas ocorrências: a pessoa da equipe vê os próprios registros (só
// leitura) junto com os dados dela: o que aconteceu, o que foi combinado,
// o prazo, a medida, as assinaturas e o histórico de cada um.
import './minhas.css'
import { useEffect, useMemo, useState } from 'react'
import {
  proLaboreApi, type MinhasOcorrencias as Dados, type Ocorrencia,
  TIPO_OCORRENCIA_LABEL, GRAVIDADE_OCORRENCIA_LABEL, STATUS_OCORRENCIA_LABEL, MEDIDA_DISCIPLINAR_LABEL,
  type GravidadeOcorrencia, type StatusOcorrencia,
} from '@/lib/proLaboreApi'
import { gerarDocumentoOcorrenciaPdf } from '@/lib/ocorrenciaDocumento'
import { PageHeader } from '../../../PageHeader'

export const STATUS_BADGE_CLASS: Record<StatusOcorrencia, string> = {
  ABERTA: 'atencao',
  EM_PRAZO: 'atencao',
  EM_VERIFICACAO: 'atencao',
  RESOLVIDA: 'bom',
  REINCIDENTE: 'critico',
  ESCALONADA: 'critico',
  ENCERRADA: 'neutro',
}

export const GRAVIDADE_BADGE_CLASS: Record<GravidadeOcorrencia, string> = {
  LEVE: 'leve',
  MODERADA: 'moderada',
  GRAVE: 'grave',
  GRAVISSIMA: 'gravissima',
}

const EM_ABERTO: StatusOcorrencia[] = ['ABERTA', 'EM_PRAZO', 'EM_VERIFICACAO', 'REINCIDENTE', 'ESCALONADA']
const PAPEL: Record<string, string> = { VENDEDOR: 'Vendedor', SUPERVISOR: 'Supervisor', SOCIAL_MEDIA: 'Social Media' }
const FILTROS = [
  { chave: 'TODAS', rotulo: 'Todas' },
  { chave: 'ABERTO', rotulo: 'Em aberto' },
  { chave: 'RESOLVIDAS', rotulo: 'Resolvidas' },
  { chave: 'POSITIVAS', rotulo: 'Feedbacks positivos' },
] as const
type Filtro = typeof FILTROS[number]['chave']

const data = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—')
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

function situacaoPrazo(o: Ocorrencia, hoje: number): { texto: string; vencido: boolean } | null {
  if (!o.prazoCorrecao || !EM_ABERTO.includes(o.status)) return null
  const dias = Math.round((Date.parse(o.prazoCorrecao.slice(0, 10)) - hoje) / 864e5)
  if (dias < 0) return { texto: `Prazo venceu há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`, vencido: true }
  if (dias === 0) return { texto: 'Prazo termina hoje', vencido: false }
  return { texto: `Faltam ${dias} ${dias === 1 ? 'dia' : 'dias'} para o prazo`, vencido: false }
}

function CartaoOcorrencia({ o, pessoa, hoje }: { o: Ocorrencia; pessoa: Dados['pessoa']; hoje: number }) {
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [gerando, setGerando] = useState(false)
  const prazo = situacaoPrazo(o, hoje)
  const anexos = (o.anexosCsv ?? '').split(',').map(a => a.trim()).filter(Boolean)
  const positivo = o.tipo === 'FEEDBACK_POSITIVO'

  async function baixar() {
    setGerando(true)
    try { await gerarDocumentoOcorrenciaPdf(o, pessoa.nome, PAPEL[pessoa.papel] ?? pessoa.papel, pessoa.documento) } finally { setGerando(false) }
  }

  return (
    <article className={`mo-card ${positivo ? 'positivo' : ''}`} data-ocorrencia={o.protocolo}>
      <div className="mo-card-cab">
        <div>
          <div className="mo-protocolo">{o.protocolo} · {data(o.dataOcorrencia)}</div>
          <h3 className="mo-titulo">{TIPO_OCORRENCIA_LABEL[o.tipo]}{o.motivo ? ` — ${o.motivo}` : ''}</h3>
        </div>
        <div className="mo-selos">
          {!positivo && <span className={`pl-gravidade-badge ${GRAVIDADE_BADGE_CLASS[o.gravidade]}`}>{GRAVIDADE_OCORRENCIA_LABEL[o.gravidade]}</span>}
          <span className={`pl-status-badge ${STATUS_BADGE_CLASS[o.status]}`}>{STATUS_OCORRENCIA_LABEL[o.status]}</span>
        </div>
      </div>

      <p className="mo-descricao">{o.descricao}</p>

      {(o.planoDeCorrecao || o.prazoCorrecao) && (
        <div className={`mo-plano ${prazo?.vencido ? 'vencido' : ''}`}>
          <div className="mo-rotulo">{positivo ? 'Próximos passos' : 'O que foi combinado'}</div>
          {o.planoDeCorrecao && <p>{o.planoDeCorrecao}</p>}
          {o.prazoCorrecao && <div className="mo-prazo">Prazo: <b>{data(o.prazoCorrecao)}</b>{prazo && <span> · {prazo.texto}</span>}</div>}
        </div>
      )}

      <div className="mo-dados">
        <div><span>Registrado por</span><b>{o.registradoPor}</b></div>
        <div><span>Registrado em</span><b>{data(o.dataRegistro)}</b></div>
        {!positivo && <div><span>Medida aplicada</span><b>{MEDIDA_DISCIPLINAR_LABEL[o.medidaAplicada]}</b></div>}
        <div><span>Sua assinatura</span><b>{o.assinaturaVendedorOk ? `Assinado${o.assinaturaVendedorData ? ` em ${data(o.assinaturaVendedorData)}` : ''}` : 'Pendente'}</b></div>
        <div><span>Assinatura do gestor</span><b>{o.assinaturaGestorOk ? `Assinado${o.assinaturaGestorData ? ` em ${data(o.assinaturaGestorData)}` : ''}` : 'Pendente'}</b></div>
        {o.ocorrenciaAnterior && <div><span>Reincidência de</span><b>{o.ocorrenciaAnterior.protocolo}</b></div>}
      </div>

      {anexos.length > 0 && (
        <div className="mo-anexos">
          <span className="mo-rotulo">Evidências</span>
          {anexos.map(a => /^https?:\/\//i.test(a) ? <a key={a} className="pl-link-action" href={a} target="_blank" rel="noreferrer">{a.replace(/^https?:\/\//i, '').slice(0, 48)}</a> : <span key={a}>{a}</span>)}
        </div>
      )}

      <div className="mo-botoes">
        <button type="button" className="pl-btn pl-btn-ghost mo-btn" onClick={() => setHistoricoAberto(a => !a)} aria-expanded={historicoAberto}>
          {historicoAberto ? 'Esconder histórico' : `Ver histórico (${o.historico.length})`}
        </button>
        <button type="button" className="pl-btn pl-btn-ghost mo-btn" onClick={baixar} disabled={gerando}>{gerando ? 'Gerando…' : 'Baixar documento (PDF)'}</button>
      </div>

      {historicoAberto && (
        <div className="pl-timeline mo-historico">
          {o.historico.map(h => (
            <div key={h.id} className="pl-timeline-item">
              <div className="pl-timeline-date">{dataHora(h.criadoEm)}</div>
              <div className="pl-timeline-autor">{h.autor}</div>
              <div className="pl-timeline-acao">{h.acao}</div>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

export function MinhasOcorrencias({ comoAba = false }: { comoAba?: boolean }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('TODAS')
  const [hoje] = useState(() => Date.parse(new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)))

  useEffect(() => { proLaboreApi.ocorrencias.minhas().then(setDados).catch(e => setErro((e as Error).message)) }, [])

  const lista = useMemo(() => (dados?.ocorrencias ?? []).filter(o => {
    if (filtro === 'ABERTO') return EM_ABERTO.includes(o.status)
    if (filtro === 'RESOLVIDAS') return o.status === 'RESOLVIDA' || o.status === 'ENCERRADA'
    if (filtro === 'POSITIVAS') return o.tipo === 'FEEDBACK_POSITIVO'
    return true
  }), [dados, filtro])

  const cabecalho = !comoAba && (
    <PageHeader eyebrow="Equipe" title="Minhas ocorrências" subtitle="Seus registros de feedback e disciplina: o que aconteceu, o que foi combinado e os prazos" />
  )

  if (erro) return <div>{cabecalho}<div className="pl-alert pl-alert-error">{erro}</div></div>
  if (!dados) return <div>{cabecalho}<div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando…</div></div>
  const { pessoa, resumo } = dados

  return (
    <div className="mo">
      {cabecalho}

      <section className="mo-pessoa pl-card" aria-label="Seus dados">
        <div className="mo-avatar" aria-hidden="true">{pessoa.nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()}</div>
        <div className="mo-pessoa-info">
          <div className="mo-nome">{pessoa.nome}</div>
          <div className="mo-dados">
            <div><span>Cargo</span><b>{PAPEL[pessoa.papel] ?? pessoa.papel}</b></div>
            <div><span>E-mail</span><b>{pessoa.email ?? '—'}</b></div>
            <div><span>CPF / CNPJ</span><b>{pessoa.documento ?? '—'}</b></div>
            <div><span>Na equipe desde</span><b>{data(pessoa.criadoEm)}</b></div>
            <div><span>Situação</span><b>{pessoa.ativo ? 'Ativo' : 'Inativo'}</b></div>
          </div>
        </div>
      </section>

      <div className="mo-kpis">
        <div className="mo-kpi"><span>Ocorrências</span><b>{resumo.total}</b></div>
        <div className="mo-kpi"><span>Em aberto</span><b>{resumo.emAberto}</b>{resumo.prazoMaisProximo && <small>{Date.parse(resumo.prazoMaisProximo.slice(0, 10)) < hoje ? 'prazo vencido desde' : 'próximo prazo'} {data(resumo.prazoMaisProximo)}</small>}</div>
        <div className="mo-kpi"><span>Resolvidas</span><b>{resumo.resolvidas}</b></div>
        <div className="mo-kpi"><span>Feedbacks positivos</span><b>{resumo.positivas}</b></div>
      </div>

      {resumo.total > 0 && (
        <div className="mo-filtros" role="group" aria-label="Filtrar ocorrências">
          {FILTROS.map(f => <button key={f.chave} type="button" className={`pl-chip ${filtro === f.chave ? 'active' : ''}`} aria-pressed={filtro === f.chave} onClick={() => setFiltro(f.chave)}>{f.rotulo}</button>)}
        </div>
      )}

      {resumo.total === 0 ? (
        <div className="pl-empty pl-card">
          <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Nenhuma ocorrência registrada</h3>
          <p style={{ marginTop: 6 }}>Quando o gestor registrar um feedback ou uma ocorrência sua, ela aparece aqui com tudo o que foi combinado.</p>
        </div>
      ) : lista.length === 0 ? (
        <p className="mo-vazio">Nada neste filtro.</p>
      ) : (
        <div className="mo-lista">
          {lista.map(o => <CartaoOcorrencia key={o.id} o={o} pessoa={pessoa} hoje={hoje} />)}
        </div>
      )}
    </div>
  )
}
