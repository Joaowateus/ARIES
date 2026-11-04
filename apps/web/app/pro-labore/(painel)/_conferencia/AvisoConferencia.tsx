'use client'

// Conferência automática dos números (só o dono): no Dashboard, avisa os
// meses em que vendas, CRM e recibos não batem, com o atalho para corrigir.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, type ConferenciaMensal, type PontoConferencia } from '@/lib/proLaboreApi'

const CHAVE = 'pl_aviso_conferencia_dispensado'
const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const nome = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`
const LINK: Record<PontoConferencia['onde'], { href: string; rotulo: string }> = {
  auditoria: { href: '/pro-labore/configuracoes#auditoria', rotulo: 'Corrigir na auditoria' },
  vendas: { href: '/pro-labore/vendas', rotulo: 'Ver em Vendas' },
  crm: { href: '/pro-labore/leads', rotulo: 'Ver no CRM' },
}

export function AvisoConferencia() {
  const [dados, setDados] = useState<ConferenciaMensal | null>(null)
  const [dispensado, setDispensado] = useState(() => { try { return localStorage.getItem(CHAVE) === hoje() } catch { return false } })
  useEffect(() => { proLaboreApi.sistema.conferencia().then(setDados).catch(() => undefined) }, [])
  if (!dados || dispensado) return null
  const meses = dados.meses.filter(m => m.pontos.some(p => p.gravidade !== 'baixa'))
  if (!meses.length) return null
  const total = meses.reduce((s, m) => s + m.pontos.filter(p => p.gravidade !== 'baixa').length, 0)
  return (
    <div className="pl-sv-aviso atencao" role="status" style={{ marginBottom: 16, alignItems: 'flex-start' }} data-aviso-conferencia>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ color: 'var(--pl-ink-1)' }}>Conferência dos números: {total} {total === 1 ? 'ponto' : 'pontos'} para conferir em {meses.length} {meses.length === 1 ? 'mês' : 'meses'}</b>
        <div style={{ fontSize: 13, marginTop: 2 }}>Enquanto não forem corrigidos, receita, ticket e comissões desses meses podem estar errados.</div>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13 }}>
          {meses.slice(0, 4).map(m => (
            <li key={m.mes} data-conferencia-mes={m.mes}>
              <b>{nome(m.mes)}</b>{m.fechado ? ' (fechado)' : ''}: {m.pontos.filter(p => p.gravidade !== 'baixa').slice(0, 2).map((p, i) => (
                <span key={p.tipo + i}>{i > 0 ? '; ' : ''}{p.texto} · <Link href={LINK[p.onde].href} style={{ color: 'inherit', fontWeight: 600 }}>{LINK[p.onde].rotulo}</Link></span>
              ))}
            </li>
          ))}
          {meses.length > 4 && <li>e mais {meses.length - 4} {meses.length - 4 === 1 ? 'mês' : 'meses'} na <Link href="/pro-labore/configuracoes#auditoria" style={{ color: 'inherit', fontWeight: 600 }}>auditoria</Link></li>}
        </ul>
      </div>
      <button type="button" className="pl-btn pl-btn-ghost" style={{ padding: '5px 10px', fontSize: 12, flex: 'none' }} onClick={() => { try { localStorage.setItem(CHAVE, hoje()) } catch { /* sem armazenamento */ } setDispensado(true) }}>Lembrar amanhã</button>
    </div>
  )
}
