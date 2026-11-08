'use client'

// PDF 02 · 4.8 Saúde dos dados: as correções pendentes, com filtro por
// responsável e por tipo de problema. Cada item diz o que corrigir e onde.
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { qualidadeApi, type CorrecaoPendente } from '@/lib/proLaboreApi'

type Dados = Awaited<ReturnType<typeof qualidadeApi.correcoes>>
const CLASSE: Record<string, string> = { INCOMPLETO: 'Incompleto', SUSPEITO: 'Suspeito' }

export function SaudeDados({ podeReavaliar }: { podeReavaliar: boolean }) {
  const [d, setD] = useState<Dados | null>(null)
  const [resp, setResp] = useState('')
  const [regra, setRegra] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const carregar = () => qualidadeApi.correcoes({ responsavelId: resp || undefined, regra: regra || undefined }).then(setD).catch(() => setD(null))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void carregar() }, [resp, regra])
  if (!d) return null
  const total = Object.values(d.porRegra).reduce((a, b) => a + b, 0)
  async function reavaliar() {
    setMsg(null)
    try { const r = await qualidadeApi.avaliar(); setMsg(`${r.qualidadeAbertas} nova(s), ${r.qualidadeResolvidas} resolvida(s).`); await carregar() } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível reavaliar') }
  }
  const onde = (c: CorrecaoPendente) => c.leadId ? <Link className="pl-link" href={`/pro-labore/leads?lead=${c.leadId}`}>{c.lead ?? 'Abrir lead'}</Link> : c.registroTabela === 'pro_labore_vendas' ? <Link className="pl-link" href="/pro-labore/vendas">Venda</Link> : '—'
  return (
    <section className="pl-card" id="saude-dados" style={{ marginBottom: 20 }} data-saude-dados>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Saúde dos dados</div>
        <div className="pl-card-sub">{total === 0 ? 'Nenhuma correção pendente.' : `${total} correção(ões) pendente(s). Dado suspeito não entra como evidência para recomendações.`}</div>
      </div>
        {podeReavaliar && <button type="button" className="pl-btn" onClick={() => void reavaliar()} data-reavaliar>Reavaliar agora</button>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {d.porResponsavel.length > 0 && (
          <select className="pl-input" style={{ width: 'auto' }} value={resp} onChange={e => setResp(e.target.value)} aria-label="Responsável" data-filtro-responsavel>
            <option value="">Todos os responsáveis</option>
            {d.porResponsavel.map(r => <option key={r.responsavelId ?? '-'} value={r.responsavelId ?? ''}>{r.nome} ({r.total})</option>)}
          </select>
        )}
        <select className="pl-input" style={{ width: 'auto' }} value={regra} onChange={e => setRegra(e.target.value)} aria-label="Tipo de problema" data-filtro-regra>
          <option value="">Todos os problemas</option>
          {Object.entries(d.regras).map(([k, r]) => <option key={k} value={k}>{r.nome}{d.porRegra[k] ? ` (${d.porRegra[k]})` : ''}</option>)}
        </select>
      </div>
      {d.itens.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="pl-table"><thead><tr><th>Problema</th><th>O que corrigir</th><th>Onde</th><th>Responsável</th><th>Desde</th></tr></thead>
            <tbody>{d.itens.map(c => (
              <tr key={c.id} data-correcao={c.regra}>
                <td>{c.problema} <span className={`pl-chip-faixa ${c.classificacao === 'SUSPEITO' ? 'pl-faixa-critico' : 'pl-faixa-atencao'}`}>{CLASSE[c.classificacao]}</span></td>
                <td>{c.oQueFalta}</td>
                <td>{onde(c)}</td>
                <td>{c.responsavel}</td>
                <td className="pl-hint">{new Date(c.criadaEm).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}</tbody></table>
        </div>
      )}
      {msg && <p className="pl-hint" role="status">{msg}</p>}
    </section>
  )
}
