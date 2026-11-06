'use client'

// Aba Crédito do CRM (PDF 01, seção 7): os leads em MQL e SQL da pessoa, a
// ficha por banco (enviada, em análise, aprovada, recusada), a validade das
// aprovações com o aviso antes de vencer, e o placar dos bancos. CPF e
// nascimento completos só na ficha aberta pela conversa, com registro.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, type LeadCredito, type ResumoCredito } from '@/lib/proLaboreApi'
import { PageHeader } from '../../PageHeader'

const STATUS: Record<string, string> = { A_ENVIAR: 'a enviar', EM_ANALISE: 'em análise', APROVADA: 'aprovada', RECUSADA: 'recusada' }
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—')

export default function CreditoPage() {
  const [leads, setLeads] = useState<LeadCredito[] | null>(null)
  const [placar, setPlacar] = useState<ResumoCredito | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [validade, setValidade] = useState('')
  const [condicao, setCondicao] = useState('')

  const carregar = useCallback(() => {
    proLaboreApi.jornada.credito().then(setLeads).catch(e => setErro(e instanceof Error ? e.message : 'Erro'))
    proLaboreApi.assistente.resumoCredito(30).then(setPlacar).catch(() => setPlacar(null))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function mudar(id: string, data: Parameters<typeof proLaboreApi.jornada.analise>[1]) {
    setErro(null)
    try { await proLaboreApi.jornada.analise(id, data); setEditando(null); carregar() } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar') }
  }

  const vencendo = (leads ?? []).flatMap(l => l.analises.filter(a => a.status === 'APROVADA' && a.venceEmDias != null && a.venceEmDias <= 3).map(a => ({ l, a })))
  return (
    <div data-credito>
      <PageHeader eyebrow="CRM" title="Crédito" subtitle="Leads em MQL (simulação) e SQL (aprovado): fichas por banco, respostas e validade das aprovações" />
      {erro && <div className="pl-alert" role="alert">{erro}</div>}
      {vencendo.length > 0 && (
        <div className="pl-alert" role="status" data-aprovacao-vencendo style={{ marginBottom: 12 }}>
          Aprovação perto de vencer: {vencendo.map(({ l, a }) => `${l.nomeCliente} (${a.banco}, ${a.venceEmDias! < 0 ? 'vencida' : a.venceEmDias === 0 ? 'vence hoje' : `vence em ${a.venceEmDias} dia${a.venceEmDias === 1 ? '' : 's'}`})`).join(' · ')}
        </div>
      )}
      <section className="pl-card" style={{ marginBottom: 16 }}>
        <div className="pl-card-title">Leads no crédito ({leads?.length ?? 0})</div>
        {!leads ? <p className="pl-hint">Carregando…</p> : leads.length === 0 ? <p className="pl-hint">Nenhum lead em MQL ou SQL agora.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="pl-table"><thead><tr><th>Cliente</th><th>Etapa</th><th>Bancos</th></tr></thead>
              <tbody>{leads.map(l => (
                <tr key={l.id} data-lead-credito={l.id}>
                  <td><Link href={`/pro-labore/leads?lead=${l.id}`}>{l.nomeCliente}</Link>{l.modeloInteresse ? <div className="pl-hint">{l.modeloInteresse}</div> : null}{l.vendedor ? <div className="pl-hint">{l.vendedor.nome}</div> : null}</td>
                  <td>{l.etapa === 'MQL' ? 'MQL (Simulação)' : 'SQL (Aprovado)'}</td>
                  <td>
                    {!l.fichaId ? <span className="pl-hint">Sem ficha ainda (o cliente passa pela conversa do WhatsApp)</span> : l.analises.map(a => (
                      <div key={a.id} style={{ marginBottom: 6 }} data-analise={a.banco}>
                        <b>{a.banco}</b> · {STATUS[a.status] ?? a.status}{a.enviadaEm ? ` · enviada ${dia(a.enviadaEm)}` : ''}
                        {a.status === 'APROVADA' && <> · válida até {dia(a.validadeAte)}{a.condicaoAprovada ? ` · ${a.condicaoAprovada}` : ''}</>}
                        {' '}
                        {a.status === 'A_ENVIAR' && <button type="button" className="pl-link-action" onClick={() => void mudar(a.id, { enviada: true })} data-enviada>marcar enviada</button>}
                        {a.status === 'EM_ANALISE' && <>
                          <button type="button" className="pl-link-action" onClick={() => { setEditando(a.id); setValidade(''); setCondicao('') }} data-aprovou>aprovou</button>{' '}
                          <button type="button" className="pl-link-action" style={{ marginLeft: 8 }} onClick={() => void mudar(a.id, { status: 'RECUSADA' })} data-recusou>recusou</button>
                        </>}
                        {editando === a.id && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                            <label className="pl-hint">Válida até <input type="date" className="pl-input" value={validade} onChange={e => setValidade(e.target.value)} data-validade /></label>
                            <input className="pl-input" placeholder="Condição aprovada (entrada, parcela, prazo)" value={condicao} onChange={e => setCondicao(e.target.value)} />
                            <button type="button" className="pl-btn pl-btn-primary" onClick={() => void mudar(a.id, { status: 'APROVADA', validadeAte: validade ? `${validade}T23:59:00-03:00` : null, condicaoAprovada: condicao || null })} data-salvar-aprovacao>Salvar aprovação</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}</tbody></table>
          </div>
        )}
      </section>
      {placar && placar.bancos.length > 0 && (
        <section className="pl-card" data-placar-bancos>
          <div className="pl-card-title">Painel dos bancos · últimos {placar.dias} dias</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="pl-table"><thead><tr><th>Banco</th><th style={{ textAlign: 'right' }}>Fichas</th><th style={{ textAlign: 'right' }}>Em análise</th><th style={{ textAlign: 'right' }}>Aprovadas</th><th style={{ textAlign: 'right' }}>Recusadas</th><th style={{ textAlign: 'right' }}>Aprovação</th></tr></thead>
              <tbody>{placar.bancos.map(b => <tr key={b.banco}><td>{b.banco}</td><td style={{ textAlign: 'right' }}>{b.lancadas}</td><td style={{ textAlign: 'right' }}>{b.emAnalise}</td><td style={{ textAlign: 'right' }}>{b.aprovadas}</td><td style={{ textAlign: 'right' }}>{b.recusadas}</td><td style={{ textAlign: 'right' }}>{b.aprovacaoPct == null ? '—' : `${b.aprovacaoPct}%`}</td></tr>)}</tbody></table>
          </div>
        </section>
      )}
    </div>
  )
}
