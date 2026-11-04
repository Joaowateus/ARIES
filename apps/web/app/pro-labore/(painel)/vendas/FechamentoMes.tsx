'use client'

// Fechamento do mês de vendas (só o dono): conferido, o mês fica travado —
// não aceita venda nova, edição nem exclusão até ser reaberto. Antes de
// fechar, mostra o que ainda merece conferência (vendas sem lead no CRM).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, type ConferenciaMensal, type FechamentoMesVendas } from '@/lib/proLaboreApi'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const nome = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`
const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function FechamentoMes({ podeAlterar, onMudou }: { podeAlterar: boolean; onMudou?: (fechados: Set<string>) => void }) {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [meses, setMeses] = useState<FechamentoMesVendas[] | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [conf, setConf] = useState<ConferenciaMensal | null>(null)
  useEffect(() => { if (podeAlterar) proLaboreApi.sistema.conferencia().then(setConf).catch(() => undefined) }, [podeAlterar])

  function aplicar(l: FechamentoMesVendas[]) { setMeses(l); onMudou?.(new Set(l.filter(m => m.fechado).map(m => m.mes))) }
  useEffect(() => { proLaboreApi.vendas.fechamentos(ano).then(aplicar).catch(() => setMeses([])) }, [ano]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!meses) return null
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const visiveis = meses.filter(m => m.mes <= mesAtual)
  const m = meses.find(x => x.mes === sel) ?? null
  const pontos = (conf?.meses.find(x => x.mes === sel)?.pontos ?? []).filter(p => p.gravidade !== 'baixa')

  async function alterar(acao: 'fechar' | 'reabrir') {
    if (!m) return
    const txt = acao === 'fechar'
      ? `${pontos.length ? `Atenção: a conferência ainda aponta ${pontos.length} ${pontos.length === 1 ? 'ponto' : 'pontos'} neste mês.\n\n` : ''}Fechar as vendas de ${nome(m.mes)} (${m.vendas} vendas, ${moeda(m.receita)})? Depois disso ninguém lança, edita ou apaga venda desse mês até você reabrir.`
      : `Reabrir ${nome(m.mes)}? As vendas desse mês voltam a poder ser lançadas, editadas e apagadas.`
    if (!window.confirm(txt)) return
    setOcupado(true); setErro('')
    try { aplicar(await proLaboreApi.vendas.alterarFechamento(m.mes, acao)) } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível') } finally { setOcupado(false) }
  }

  return (
    <div className="pl-card" style={{ marginBottom: 20 }} data-fechamento-mes>
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">Fechamento do mês</div>
          <div className="pl-card-sub">Depois de conferir, feche o mês: os números dele não mudam mais sem você reabrir.</div>
        </div>
        <select className="pl-select" value={ano} onChange={e => { setAno(Number(e.target.value)); setSel(null) }} aria-label="Ano" style={{ maxWidth: 110 }}>
          {[hoje.getFullYear() - 1, hoje.getFullYear()].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {visiveis.map(x => (
          <button key={x.mes} type="button" className={`pl-btn ${sel === x.mes ? 'pl-btn-primary' : 'pl-btn-ghost'}`} onClick={() => setSel(x.mes)} data-mes-fechamento={x.mes} aria-pressed={sel === x.mes}>
            {nome(x.mes)}{x.fechado ? ' · fechado' : ''}
          </button>
        ))}
      </div>
      {m && (
        <div style={{ marginTop: 12, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }} data-detalhe-fechamento>
          <span><b>{nome(m.mes)}</b>: {m.vendas} vendas · {moeda(m.receita)}{m.fechado && m.fechadoEm ? ` · fechado em ${new Date(m.fechadoEm).toLocaleDateString('pt-BR')}` : ''}</span>
          {!m.fechado && (pontos.length
            ? <div className="pl-alert" style={{ flexBasis: '100%', margin: 0 }} data-conferencia-fechamento><b>Antes de fechar, confira:</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{pontos.map((p, i) => <li key={i}>{p.texto}</li>)}</ul><Link href="/pro-labore/configuracoes#auditoria">Abrir a auditoria</Link></div>
            : <span className="pl-hint" data-conferencia-ok>Conferência: tudo bate neste mês.</span>)}
          {!m.fechado && m.semLead > 0 && <span className="pl-hint">{m.semLead} {m.semLead === 1 ? 'venda não está ligada' : 'vendas não estão ligadas'} a lead do CRM. <Link href="/pro-labore/configuracoes#auditoria">Conferir na auditoria</Link></span>}
          {podeAlterar && (m.fechado
            ? <button type="button" className="pl-btn pl-btn-ghost" disabled={ocupado} onClick={() => alterar('reabrir')} data-reabrir-mes>Reabrir mês</button>
            : <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => alterar('fechar')} data-fechar-mes>Fechar {nome(m.mes)}</button>)}
          {m.historico.length > 0 && <span className="pl-hint">Histórico: {m.historico.slice(-3).map(h => `${h.acao === 'FECHAR' ? 'fechado' : 'reaberto'} em ${new Date(h.em).toLocaleDateString('pt-BR')}${h.por ? ` por ${h.por}` : ''}`).join(' · ')}</span>}
        </div>
      )}
      {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 10 }}>{erro}</div>}
    </div>
  )
}
