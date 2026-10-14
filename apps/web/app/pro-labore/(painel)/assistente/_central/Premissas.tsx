'use client'

// Premissas editáveis com histórico: metas, ticket, orçamento, metas de
// conversão, dias úteis, cenário personalizado e os critérios que decidem a
// severidade dos diagnósticos. Toda mudança fica registrada (quem, quando,
// antes e depois).
import { useEffect, useState } from 'react'
import { proLaboreApi, type IntelAuditoria, type IntelCentral, type IntelCriterios, type IntelPremissasEdicao } from '@/lib/proLaboreApi'
import { PASSAGENS, brl, dataHoraBR, num, pct } from './fmt'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const CAMPOS_CONV = ['metaLeadAbordado', 'metaAbordadoNegociacao', 'metaNegociacaoProposta', 'metaPropostaFechamento'] as const
const CRITERIOS: Array<{ chave: keyof IntelCriterios; rotulo: string; ajuda: string }> = [
  { chave: 'amostraMinima', rotulo: 'Amostra mínima (leads)', ajuda: 'Abaixo disso, a conversão não gera alerta forte.' },
  { chave: 'desvioAltoPP', rotulo: 'Desvio alto (p.p.)', ajuda: 'Conversão abaixo da meta por esta diferença vira alerta alto.' },
  { chave: 'desvioModeradoPP', rotulo: 'Desvio moderado (p.p.)', ajuda: 'A partir desta diferença, alerta moderado.' },
  { chave: 'atingimentoCriticoPct', rotulo: 'Atingimento crítico (%)', ajuda: 'Projeção abaixo deste % da meta vira crítico.' },
  { chave: 'ritmoInvestimentoAltoPct', rotulo: 'Ritmo de investimento alto (%)', ajuda: 'Gasto acima deste % do orçamento proporcional.' },
  { chave: 'cplToleranciaPct', rotulo: 'Tolerância do CPL (%)', ajuda: 'CPL acima do máximo por mais que isso gera alerta.' },
  { chave: 'impactoCriticoPctMeta', rotulo: 'Impacto crítico (% da meta)', ajuda: 'Perda estimada acima deste % da meta de vendas vira crítico.' },
]
const NOME_CAMPO: Record<string, string> = {
  metaFaturamentoMensal: 'Meta de faturamento', ticketMedio: 'Ticket médio', orcamentoMarketing: 'Orçamento de marketing', vendedoresPlanejados: 'Vendedores planejados',
  metaLeadAbordado: 'Meta Lead → Abordado', metaAbordadoNegociacao: 'Meta Abordado → Negociação', metaNegociacaoProposta: 'Meta Negociação → Proposta', metaPropostaFechamento: 'Meta Proposta → Fechamento',
  margemContribuicaoVenda: 'Margem de contribuição por venda', diasUteisSemana: 'Dias úteis da semana', cenarioPersonalizado: 'Cenário personalizado', criterios: 'Critérios de severidade',
}

type Form = {
  metaFaturamentoMensal: string; ticketMedio: string; orcamentoMarketing: string; vendedoresPlanejados: string; margemContribuicaoVenda: string
  conv: string[]; dias: number[]; personalizado: boolean; convP: string[]; ticketP: string; orcamentoP: string; criterios: Record<string, string>
}
const n = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))
const s = (v: number | null | undefined) => (v == null ? '' : String(Math.round(v * 1000) / 1000))
const curto = (v: unknown): string => {
  if (v == null) return '—'
  if (typeof v === 'number') return v <= 1 && v > 0 ? pct(v) : num(v, 2)
  if (typeof v === 'string') return v
  return JSON.stringify(v).slice(0, 80)
}

function inicial(d: IntelCentral): Form {
  const p = d.premissas
  return {
    metaFaturamentoMensal: s(p.metaFaturamentoMensal), ticketMedio: s(p.ticketMedio), orcamentoMarketing: s(p.orcamentoMarketing),
    vendedoresPlanejados: s(p.vendedores.planejados), margemContribuicaoVenda: s(p.margemContribuicaoVenda),
    conv: p.metasConversao.map(x => s(x * 100)), dias: p.diasUteisSemana,
    personalizado: !!p.personalizado?.conversoes, convP: (p.personalizado?.conversoes ?? p.metasConversao).map(x => s(x * 100)),
    ticketP: s(p.personalizado?.ticket), orcamentoP: s(p.personalizado?.orcamento),
    criterios: Object.fromEntries(Object.entries(p.criterios).map(([k, v]) => [k, s(v)])),
  }
}

function corpoDe(f: Form): Partial<IntelPremissasEdicao> {
  const corpo: Partial<IntelPremissasEdicao> = {
    metaFaturamentoMensal: n(f.metaFaturamentoMensal) ?? undefined, ticketMedio: n(f.ticketMedio) ?? undefined, orcamentoMarketing: n(f.orcamentoMarketing) ?? 0,
    vendedoresPlanejados: n(f.vendedoresPlanejados), margemContribuicaoVenda: n(f.margemContribuicaoVenda),
    diasUteisSemana: [...f.dias].sort().join(','),
    cenarioPersonalizado: f.personalizado ? { conversoes: f.convP.map(x => (n(x) ?? 0) / 100), ...(n(f.ticketP) ? { ticket: n(f.ticketP)! } : {}), ...(n(f.orcamentoP) != null ? { orcamento: n(f.orcamentoP)! } : {}) } : null,
    criterios: Object.fromEntries(Object.entries(f.criterios).map(([k, v]) => [k, n(v) ?? 0])) as Partial<IntelCriterios>,
  }
  CAMPOS_CONV.forEach((c, i) => { corpo[c] = (n(f.conv[i]) ?? 0) / 100 })
  return corpo
}

export function Premissas({ d, onSalvo }: { d: IntelCentral; onSalvo: () => void }) {
  const [f, setF] = useState<Form>(() => inicial(d))
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [historico, setHistorico] = useState<IntelAuditoria[] | null>(null)
  const [versao, setVersao] = useState(0)
  const pode = d.podeEditarPremissas
  useEffect(() => { proLaboreApi.intel.auditoria('PLANEJAMENTO').then(setHistorico).catch(() => setHistorico([])) }, [versao])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF(x => ({ ...x, [k]: v })); setMsg(null) }
  // Prévia com as mesmas fórmulas da Central (o servidor recalcula ao salvar).
  const fat = n(f.metaFaturamentoMensal), ticket = n(f.ticketMedio), orc = n(f.orcamentoMarketing)
  const metaV = fat && ticket ? Math.ceil(fat / ticket - 1e-9) : null
  const convs = f.conv.map(x => (n(x) ?? 0) / 100)
  const convTotal = convs.every(c => c > 0) ? convs.reduce((a, b) => a * b, 1) : null
  const leads = metaV != null && convTotal ? Math.ceil(metaV / convTotal - 1e-9) : null
  const cplMax = orc != null && leads ? orc / leads : null
  const teto = orc != null && metaV ? orc / metaV : null

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setMsg(null)
    try {
      if (!f.dias.length) throw new Error('Marque pelo menos um dia útil.')
      // Só vai o que mudou: o histórico registra cada premissa alterada.
      const novo = corpoDe(f), antigo = corpoDe(inicial(d))
      const corpo = Object.fromEntries(Object.entries(novo).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(antigo[k as keyof typeof antigo]))) as Partial<IntelPremissasEdicao>
      const r = await proLaboreApi.intel.salvarPremissas(corpo)
      setMsg({ ok: true, texto: r.mudancas ? `${r.mudancas} premissa${r.mudancas > 1 ? 's' : ''} atualizada${r.mudancas > 1 ? 's' : ''}. Metas, projeções e diagnósticos já usam os novos valores.` : 'Nada mudou.' })
      setVersao(v => v + 1); onSalvo()
    } catch (x) { setMsg({ ok: false, texto: (x as Error).message }) } finally { setSalvando(false) }
  }

  const campo = (k: 'metaFaturamentoMensal' | 'ticketMedio' | 'orcamentoMarketing' | 'vendedoresPlanejados' | 'margemContribuicaoVenda', rotulo: string, ajuda?: string) => (
    <div className="pl-field">
      <label htmlFor={`pr-${k}`}>{rotulo}</label>
      <input id={`pr-${k}`} className="pl-input" inputMode="decimal" value={f[k]} onChange={e => set(k, e.target.value)} disabled={!pode} />
      {ajuda && <small>{ajuda}</small>}
    </div>
  )

  return (
    <>
      <form className="ic-card" onSubmit={salvar}>
        <div className="ic-cab">
          <div><h2>Premissas do planejamento</h2><p className="ic-sub">{pode ? 'Tudo na Central sai daqui. Mudanças ficam no histórico abaixo.' : 'Somente leitura: quem edita as Configurações muda as premissas.'}{d.premissas.atualizadoPor ? ` Última alteração por ${d.premissas.atualizadoPor} em ${dataHoraBR(d.premissas.atualizadoEm)}.` : ''}</p></div>
        </div>
        <div className="ic-form">
          {campo('metaFaturamentoMensal', 'Meta de faturamento mensal (R$)')}
          {campo('ticketMedio', 'Ticket médio (R$)')}
          {campo('orcamentoMarketing', 'Orçamento de marketing do mês (R$)')}
          {campo('vendedoresPlanejados', 'Vendedores planejados', `${d.premissas.vendedores.cadastrados} ativos no sistema`)}
          {campo('margemContribuicaoVenda', 'Margem de contribuição por venda (R$)', 'Opcional. Sem ela, a Central não calcula margem nem lucro.')}
        </div>

        <h3 style={{ margin: '18px 0 10px' }}>Metas de conversão (%)</h3>
        <div className="ic-form">
          {PASSAGENS.map((ps, i) => (
            <div key={ps} className="pl-field"><label htmlFor={`pr-conv-${i}`}>{ps}</label>
              <input id={`pr-conv-${i}`} className="pl-input" inputMode="decimal" value={f.conv[i]} onChange={e => set('conv', f.conv.map((x, j) => (j === i ? e.target.value : x)))} disabled={!pode} /></div>
          ))}
        </div>

        <div className="ic-kpis" style={{ marginTop: 14 }}>
          <div className="ic-kpi"><span>Meta de vendas</span><b>{num(metaV)}</b><small>faturamento ÷ ticket, para cima</small></div>
          <div className="ic-kpi"><span>Conversão total</span><b>{pct(convTotal, 2)}</b><small>produto das 4 metas</small></div>
          <div className="ic-kpi"><span>Leads necessários</span><b>{num(leads)}</b><small>vendas ÷ conversão total, para cima</small></div>
          <div className="ic-kpi"><span>CPL máximo</span><b>{brl(cplMax)}</b><small>orçamento ÷ leads necessários</small></div>
          <div className="ic-kpi"><span>Teto de marketing por venda</span><b>{brl(teto)}</b><small>orçamento ÷ meta de vendas</small></div>
        </div>
        <p className="ic-legenda" style={{ marginTop: 6 }}>Prévia calculada na tela; ao salvar, o servidor recalcula com as mesmas fórmulas.</p>

        <h3 style={{ margin: '18px 0 10px' }}>Dias úteis da semana</h3>
        <div className="ic-filtros" role="group" aria-label="Dias úteis">
          {DIAS.map((nome, i) => (
            <button key={nome} type="button" className={`pl-chip ${f.dias.includes(i) ? 'active' : ''}`} aria-pressed={f.dias.includes(i)} disabled={!pode} onClick={() => set('dias', f.dias.includes(i) ? f.dias.filter(x => x !== i) : [...f.dias, i])}>{nome}</button>
          ))}
        </div>

        <h3 style={{ margin: '18px 0 10px' }}>Cenário personalizado</h3>
        <label className="ic-legenda" style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: pode ? 'pointer' : 'default' }}>
          <input type="checkbox" checked={f.personalizado} onChange={e => set('personalizado', e.target.checked)} disabled={!pode} /> Simular um quarto cenário com outras conversões, ticket ou orçamento
        </label>
        {f.personalizado && (
          <div className="ic-form" style={{ marginTop: 10 }}>
            {PASSAGENS.map((ps, i) => (
              <div key={ps} className="pl-field"><label htmlFor={`pr-cp-${i}`}>{ps} (%)</label>
                <input id={`pr-cp-${i}`} className="pl-input" inputMode="decimal" value={f.convP[i]} onChange={e => set('convP', f.convP.map((x, j) => (j === i ? e.target.value : x)))} disabled={!pode} /></div>
            ))}
            <div className="pl-field"><label htmlFor="pr-cp-ticket">Ticket (R$, opcional)</label><input id="pr-cp-ticket" className="pl-input" inputMode="decimal" value={f.ticketP} onChange={e => set('ticketP', e.target.value)} disabled={!pode} /></div>
            <div className="pl-field"><label htmlFor="pr-cp-orc">Orçamento (R$, opcional)</label><input id="pr-cp-orc" className="pl-input" inputMode="decimal" value={f.orcamentoP} onChange={e => set('orcamentoP', e.target.value)} disabled={!pode} /></div>
          </div>
        )}

        <h3 style={{ margin: '18px 0 10px' }}>Critérios da priorização</h3>
        <div className="ic-form">
          {CRITERIOS.map(c => (
            <div key={c.chave} className="pl-field"><label htmlFor={`pr-cr-${c.chave}`}>{c.rotulo}</label>
              <input id={`pr-cr-${c.chave}`} className="pl-input" inputMode="decimal" value={f.criterios[c.chave] ?? ''} onChange={e => set('criterios', { ...f.criterios, [c.chave]: e.target.value })} disabled={!pode} />
              <small>{c.ajuda}</small></div>
          ))}
        </div>

        {msg && <div className={`pl-alert ${msg.ok ? 'pl-alert-success' : 'pl-alert-error'}`} style={{ marginTop: 14 }}>{msg.texto}</div>}
        {pode && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button type="button" className="pl-btn pl-btn-ghost" onClick={() => { setF(inicial(d)); setMsg(null) }}>Desfazer</button>
          <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar premissas'}</button>
        </div>}
      </form>

      <section className="ic-card">
        <div className="ic-cab"><div><h2>Histórico das premissas</h2><p className="ic-sub">Quem mudou o quê, quando, e o valor de antes.</p></div></div>
        {!historico ? <div className="pl-hint">Carregando…</div> : historico.length === 0 ? <p className="ic-legenda">Nenhuma alteração ainda: valem os valores iniciais do planejamento.</p> : (
          <div className="ic-rola">
            <table className="ic-tabela" style={{ minWidth: 560 }}>
              <thead><tr><th>Quando</th><th>Quem</th><th>Premissa</th><th>Antes</th><th>Depois</th></tr></thead>
              <tbody>{historico.map(h => <tr key={h.id}><td>{dataHoraBR(h.em)}</td><td>{h.autorNome}</td><td>{NOME_CAMPO[h.campo ?? ''] ?? h.campo}</td><td className="fraco">{curto(h.antes)}</td><td>{curto(h.depois)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
