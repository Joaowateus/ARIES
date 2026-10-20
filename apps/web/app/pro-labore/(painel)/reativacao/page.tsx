'use client'

// Reativação: os clientes marcados como perdidos saem do funil e ficam aqui,
// com todas as informações, para serem aquecidos e retomados depois. O lead
// continua PERDIDO para as contas do funil; reativar devolve ele à etapa
// escolhida e conta como reativação.
import '../_follow/follow.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, temAcesso, type EstagioLead, type LeadPerdido, type MotivoPerda, type Reativacao, type Temperatura, type Vendedor } from '@/lib/proLaboreApi'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { formatMoeda } from '@/lib/format'
import { PageHeader } from '../../PageHeader'
import { FollowModal } from '../_follow/FollowModal'
import { MOTIVO_PERDA, TEMPERATURA, dataHoraBR, linkWhatsapp, situacaoFollow } from '../_follow/follow'

const ETAPA: Record<string, string> = { LEAD: 'Leads', ABORDADO: 'Abordados', NEGOCIACAO: 'Negociação', PROPOSTA: 'Proposta', FECHADO: 'Fechamento', PERDIDO: 'Perdido' }
const ETAPAS_VOLTA: EstagioLead[] = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA']
const TIPO_LEAD: Record<string, string> = { TRAFEGO: 'Tráfego Pago', ORGANICO: 'Orgânico' }
const DIA = 864e5
const diasDesde = (iso: string, agora: number) => Math.max(0, Math.floor((agora - Date.parse(iso)) / DIA))

function Cartao({ l, podeEditar, vejaEquipe, agora, onFollow, onMudou }: { l: LeadPerdido; podeEditar: boolean; vejaEquipe: boolean; agora: number; onFollow: () => void; onMudou: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [voltarPara, setVoltarPara] = useState<EstagioLead>(l.estagioAntesDaPerda && ETAPAS_VOLTA.includes(l.estagioAntesDaPerda) ? l.estagioAntesDaPerda : 'ABORDADO')
  const [nota, setNota] = useState(l.notaPerda ?? '')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const sit = l.proximoFollow ? situacaoFollow(l.proximoFollow) : null
  const whats = linkWhatsapp(l.telefone)
  const dias = diasDesde(l.perdidoEm, agora)

  async function rodar(fn: () => Promise<unknown>) {
    setOcupado(true); setErro('')
    try { await fn(); onMudou() } catch (e) { setErro((e as Error).message) } finally { setOcupado(false) }
  }
  const editar = (data: { motivoPerda?: MotivoPerda; notaPerda?: string | null; temperatura?: Temperatura | null }) => rodar(() => proLaboreApi.reativacao.editar(l.id, data))
  const reativar = () => rodar(() => proLaboreApi.leads.mudarEstagio(l.id, voltarPara))

  return (
    <article className="rv-card" data-lead={l.id}>
      <div className="rv-card-cab">
        <div style={{ minWidth: 0 }}>
          <div className="rv-nome">{l.nomeCliente}</div>
          <div className="rv-meta">
            {l.modeloInteresse ? `${l.modeloInteresse} · ` : ''}{formatMoeda(l.valorNegociacao)}{vejaEquipe && l.vendedor ? ` · ${l.vendedor.nome}` : ''}
          </div>
        </div>
        <span className={`rv-temp ${(l.temperatura ?? 'sem').toLowerCase()}`}>{l.temperatura ? TEMPERATURA[l.temperatura].rotulo : 'Sem temperatura'}</span>
      </div>
      <div className="rv-motivo"><b>{MOTIVO_PERDA[l.motivoPerda ?? 'SEM_MOTIVO']}</b> · {dias === 0 ? 'perdido hoje' : `perdido há ${dias} ${dias === 1 ? 'dia' : 'dias'}`}{l.estagioAntesDaPerda ? ` · estava em ${ETAPA[l.estagioAntesDaPerda]}` : ''}</div>
      {l.notaPerda && !aberto && <p className="rv-nota">{l.notaPerda}</p>}
      <div className="rv-linha">
        {sit ? (
          <button type="button" className={`fw-selo ${sit.tipo.toLowerCase()}`} onClick={onFollow} style={{ marginTop: 0 }}>{sit.texto}</button>
        ) : <span className="pl-hint" style={{ fontSize: 12 }}>Sem follow agendado</span>}
        <span className="pl-hint" style={{ fontSize: 12 }}>{l.contatosFeitos} contato{l.contatosFeitos === 1 ? '' : 's'} feito{l.contatosFeitos === 1 ? '' : 's'}{l.reativacoes ? ` · já reativado ${l.reativacoes}×` : ''}</span>
      </div>
      <div className="rv-botoes">
        {podeEditar && <button type="button" className="pl-btn pl-btn-ghost rv-btn" onClick={onFollow}>{l.proximoFollow ? 'Ver follow' : 'Agendar follow'}</button>}
        {whats && <a className="pl-btn pl-btn-ghost rv-btn" href={whats} target="_blank" rel="noreferrer">WhatsApp</a>}
        <button type="button" className="pl-btn pl-btn-ghost rv-btn" onClick={() => setAberto(a => !a)} aria-expanded={aberto}>{aberto ? 'Fechar' : 'Ver tudo e reativar'}</button>
      </div>

      {aberto && (
        <div className="rv-detalhe">
          <div className="rv-dados">
            <div><span>Telefone</span><b>{l.telefone || '—'}</b></div>
            <div><span>E-mail</span><b>{l.email || '—'}</b></div>
            <div><span>CPF</span><b>{l.cpf || '—'}</b></div>
            <div><span>Endereço</span><b>{l.endereco || '—'}</b></div>
            <div><span>Canal</span><b>{l.tipoLead ? TIPO_LEAD[l.tipoLead] : '—'}{l.postCode ? ` · ${l.postCode}` : ''}</b></div>
            <div><span>Negociação</span><b>{l.tipoNegociacao ?? '—'}</b></div>
            <div><span>Entrou em</span><b>{dataHoraBR(l.criadoEm)}</b></div>
            <div><span>Perdido em</span><b>{dataHoraBR(l.perdidoEm)}</b></div>
          </div>
          {l.observacao && <p className="rv-nota"><b>Observação:</b> {l.observacao}</p>}
          <div className="rv-trilha">
            <span>Caminho no funil:</span> {[l.historico[0]?.estagioAnterior ?? 'LEAD', ...l.historico.map(h => h.estagioNovo)].map(e => ETAPA[e]).join(' → ')}
          </div>
          {podeEditar && (
            <>
              <div className="rv-edicao">
                <div className="pl-field">
                  <label htmlFor={`rv-m-${l.id}`}>Motivo</label>
                  <select id={`rv-m-${l.id}`} className="pl-select" value={l.motivoPerda ?? ''} disabled={ocupado} onChange={e => e.target.value && editar({ motivoPerda: e.target.value as MotivoPerda })}>
                    {!l.motivoPerda && <option value="">Sem motivo registrado</option>}
                    {(Object.keys(MOTIVO_PERDA) as Array<MotivoPerda | 'SEM_MOTIVO'>).filter(k => k !== 'SEM_MOTIVO').map(k => <option key={k} value={k}>{MOTIVO_PERDA[k]}</option>)}
                  </select>
                </div>
                <div className="pl-field">
                  <label>Temperatura</label>
                  <div className="fw-rapidos">
                    {(['QUENTE', 'MORNO', 'FRIO'] as Temperatura[]).map(t => <button key={t} type="button" disabled={ocupado} className={`pl-chip fw-temp ${t.toLowerCase()} ${l.temperatura === t ? 'active' : ''}`} aria-pressed={l.temperatura === t} onClick={() => editar({ temperatura: t })}>{TEMPERATURA[t].rotulo}</button>)}
                  </div>
                </div>
              </div>
              <div className="pl-field">
                <label htmlFor={`rv-n-${l.id}`}>Anotações do aquecimento</label>
                <textarea id={`rv-n-${l.id}`} className="pl-input" rows={2} maxLength={2000} value={nota} onChange={e => setNota(e.target.value)} onBlur={() => nota !== (l.notaPerda ?? '') && editar({ notaPerda: nota.trim() || null })} placeholder="O que o cliente disse, o que mandar, quando retomar" />
              </div>
              <div className="rv-reativar">
                <span className="pl-hint">Reativar e voltar para</span>
                <select className="pl-select-chip active" value={voltarPara} onChange={e => setVoltarPara(e.target.value as EstagioLead)} aria-label="Etapa para onde o cliente volta">
                  {ETAPAS_VOLTA.map(e => <option key={e} value={e}>{ETAPA[e]}</option>)}
                </select>
                <button type="button" className="pl-btn pl-btn-primary rv-btn" disabled={ocupado} onClick={reativar}>Reativar no funil</button>
              </div>
            </>
          )}
          {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
        </div>
      )}
    </article>
  )
}

export default function ReativacaoPage() {
  const { usuario } = useProLaboreAuth()
  const vejaEquipe = usuario?.papel === 'DONO' || usuario?.papel === 'SUPERVISOR'
  const podeEditar = usuario?.papel === 'DONO' || usuario?.acessos?.crm === 'EDITAR'
  const [dados, setDados] = useState<Reativacao | null>(null)
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [motivo, setMotivo] = useState<MotivoPerda | 'SEM_MOTIVO' | ''>('')
  const [temperatura, setTemperatura] = useState<Temperatura | ''>('')
  const [vendedorId, setVendedorId] = useState('')
  const [ordem, setOrdem] = useState<'recentes' | 'quentes' | 'follow'>('recentes')
  const [followDe, setFollowDe] = useState<LeadPerdido | null>(null)
  const [agora] = useState(() => Date.now())

  const carregar = useCallback(() => {
    proLaboreApi.reativacao.listar(vendedorId || undefined).then(setDados).catch(e => setErro((e as Error).message))
  }, [vendedorId])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { if (vejaEquipe) proLaboreApi.vendedores.listar().then(v => setVendedores(v.filter(x => x.ativo))).catch(() => undefined) }, [vejaEquipe])

  const lista = useMemo(() => {
    if (!dados) return []
    const q = busca.trim().toLowerCase()
    const peso: Record<string, number> = { QUENTE: 0, MORNO: 1, FRIO: 2 }
    return dados.leads
      .filter(l => !motivo || (l.motivoPerda ?? 'SEM_MOTIVO') === motivo)
      .filter(l => !temperatura || l.temperatura === temperatura)
      .filter(l => !q || [l.nomeCliente, l.telefone, l.email, l.modeloInteresse, l.notaPerda].some(x => (x ?? '').toLowerCase().includes(q)))
      .sort((a, b) => ordem === 'quentes' ? (peso[a.temperatura ?? ''] ?? 3) - (peso[b.temperatura ?? ''] ?? 3)
        : ordem === 'follow' ? (a.proximoFollow?.agendadoPara ?? '9999').localeCompare(b.proximoFollow?.agendadoPara ?? '9999')
        : b.perdidoEm.localeCompare(a.perdidoEm))
  }, [dados, busca, motivo, temperatura, ordem])

  if (usuario && !temAcesso(usuario, 'crm')) return <div className="pl-empty pl-card"><div className="pl-emoji">🔒</div>Seu acesso não inclui o CRM. Peça ao gestor para liberar.</div>
  const r = dados?.resumo
  const n = (t: Temperatura) => r?.porTemperatura.find(x => x.temperatura === t)?.n ?? 0

  return (
    <div className="rv">
      <PageHeader
        eyebrow="Operação"
        title="Reativação"
        subtitle="Clientes que ainda não estavam prontos para comprar: saíram do funil com todas as informações para você aquecer, fazer follow e trazer de volta na hora certa"
        actions={<Link href="/pro-labore/leads" className="pl-btn pl-btn-ghost">Voltar ao CRM</Link>}
      />
      {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
      {!dados ? <div className="pl-hint">Carregando…</div> : (
        <>
          <div className="rv-kpis">
            <div className="rv-kpi"><span>Na reativação</span><b>{r!.total}</b></div>
            <div className="rv-kpi"><span>Quentes</span><b>{n('QUENTE')}</b><small>mornos {n('MORNO')} · frios {n('FRIO')}</small></div>
            <div className="rv-kpi"><span>Com follow agendado</span><b>{r!.followsPendentes}</b></div>
            <div className="rv-kpi"><span>Reativados em 30 dias</span><b>{r!.reativados30d}</b><small>voltaram para o funil</small></div>
          </div>
          {r!.porMotivo.length > 0 && (
            <div className="rv-motivos" role="group" aria-label="Filtrar por motivo">
              <button type="button" className={`pl-chip ${motivo === '' ? 'active' : ''}`} aria-pressed={motivo === ''} onClick={() => setMotivo('')}>Todos os motivos</button>
              {r!.porMotivo.map(m => <button key={m.motivo} type="button" className={`pl-chip ${motivo === m.motivo ? 'active' : ''}`} aria-pressed={motivo === m.motivo} onClick={() => setMotivo(x => (x === m.motivo ? '' : m.motivo))}>{MOTIVO_PERDA[m.motivo]} ({m.n})</button>)}
            </div>
          )}
          <div className="rv-filtros">
            <input className="pl-input" style={{ flex: '1 1 220px', minWidth: 0 }} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, telefone, modelo, anotação…" aria-label="Buscar" />
            <select className="pl-select-chip" value={temperatura} onChange={e => setTemperatura(e.target.value as Temperatura | '')} aria-label="Temperatura">
              <option value="">Toda temperatura</option>
              {(['QUENTE', 'MORNO', 'FRIO'] as Temperatura[]).map(t => <option key={t} value={t}>{TEMPERATURA[t].rotulo}</option>)}
            </select>
            {vejaEquipe && vendedores.length > 0 && (
              <select className="pl-select-chip" value={vendedorId} onChange={e => setVendedorId(e.target.value)} aria-label="Vendedor">
                <option value="">Todos os vendedores</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            )}
            <select className="pl-select-chip" value={ordem} onChange={e => setOrdem(e.target.value as typeof ordem)} aria-label="Ordem">
              <option value="recentes">Perdidos mais recentes</option>
              <option value="quentes">Mais quentes primeiro</option>
              <option value="follow">Próximo follow primeiro</option>
            </select>
          </div>
          {lista.length === 0 ? (
            <div className="pl-empty pl-card">
              <div className="pl-emoji">🌱</div>
              {dados.leads.length === 0 ? 'Nenhum cliente na reativação. Ao marcar um lead como perdido no CRM, ele vem para cá.' : 'Nenhum cliente com esses filtros.'}
            </div>
          ) : (
            <div className="rv-grade">
              {lista.map(l => <Cartao key={l.id} l={l} podeEditar={podeEditar} vejaEquipe={vejaEquipe} agora={agora} onFollow={() => setFollowDe(l)} onMudou={carregar} />)}
            </div>
          )}
        </>
      )}
      {followDe && <FollowModal lead={followDe} pendente={followDe.proximoFollow} onFechar={() => setFollowDe(null)} onMudou={carregar} />}
    </div>
  )
}
