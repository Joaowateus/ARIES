'use client'

// Onde e por que o funil perde no mês: cada lead perdido conta na etapa em
// que estava quando saiu, com o motivo registrado. Negociação e Proposta
// vêm primeiro: é onde o cliente já conversou sobre comprar.
import type { MesPainel } from '@/lib/proLaboreApi'
import { MOTIVO_PERDA } from '../_follow/follow'

const ETAPA: Record<string, string> = { LEAD: 'Leads', ABORDADO: 'Abordados', NEGOCIACAO: 'Negociação', PROPOSTA: 'Proposta', DESCONHECIDA: 'Etapa não registrada' }
const ORDEM = ['NEGOCIACAO', 'PROPOSTA', 'ABORDADO', 'LEAD', 'DESCONHECIDA']

export function PerdasDoMes({ perdas, rotuloMes }: { perdas: NonNullable<MesPainel['perdas']>; rotuloMes: string }) {
  const total = perdas.reduce((s, p) => s + p.n, 0)
  const porEtapa = ORDEM.map(etapa => {
    const itens = perdas.filter(p => p.etapa === etapa).sort((a, b) => b.n - a.n)
    return { etapa, itens, n: itens.reduce((s, p) => s + p.n, 0) }
  }).filter(e => e.n > 0)
  const decisao = porEtapa.filter(e => e.etapa === 'NEGOCIACAO' || e.etapa === 'PROPOSTA').reduce((s, e) => s + e.n, 0)
  return (
    <div className="pl-card" style={{ marginTop: 16 }} data-perdas-mes>
      <div className="pl-card-head">
        <div>
          <div className="pl-card-title">Onde e por que perdemos · {rotuloMes}</div>
          <div className="pl-card-sub">{total ? `${total} ${total === 1 ? 'lead perdido' : 'leads perdidos'}${decisao ? `, ${decisao} já em Negociação ou Proposta` : ''}. Cada um conta na etapa em que estava quando saiu.` : 'Nenhum lead marcado como perdido neste mês.'}</div>
        </div>
      </div>
      {porEtapa.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {porEtapa.map(e => (
            <div key={e.etapa} data-perdas-etapa={e.etapa}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><b>{ETAPA[e.etapa] ?? e.etapa}</b><span className="pl-hint">{e.n}</span></div>
              {e.itens.map(p => (
                <div key={p.motivo} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 8 }}><span>{MOTIVO_PERDA[p.motivo as keyof typeof MOTIVO_PERDA] ?? p.motivo}</span><span className="pl-mono">{p.n}</span></div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--pl-border)', overflow: 'hidden' }} aria-hidden="true"><span style={{ display: 'block', height: '100%', width: `${Math.round((p.n / e.n) * 100)}%`, background: 'var(--pl-ink-2, var(--pl-ink-1))', borderRadius: 3 }} /></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
