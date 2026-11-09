'use client'

// PDF 02 · 4.9 Auditoria imutável: quem mudou o quê, quando, valor anterior
// e novo. Dono vê tudo; supervisor vê a da equipe (matriz 4.7). Só leitura.
import { useEffect, useState } from 'react'
import { qualidadeApi, type EventoAuditoria } from '@/lib/proLaboreApi'

const ACAO = { CRIACAO: 'Criou', ALTERACAO: 'Alterou', EXCLUSAO: 'Apagou' } as const

export function TrilhaAuditoria() {
  const [tabelas, setTabelas] = useState<Array<{ chave: string; nome: string }>>([])
  const [itens, setItens] = useState<EventoAuditoria[] | null>(null)
  const [f, setF] = useState({ tabela: '', registroId: '', desde: '', ate: '' })
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    qualidadeApi.trilha(f).then(r => { setTabelas(r.tabelas); setItens(r.itens); setErro(null) }).catch(e => { setItens(null); setErro(e instanceof Error ? e.message : 'Indisponível') })
  }, [f])
  if (erro && !itens) return null
  return (
    <section className="pl-card" id="trilha-auditoria" style={{ marginBottom: 20 }} data-trilha-auditoria>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Auditoria</div>
        <div className="pl-card-sub">Cada mudança em cliente, oportunidade e atividade, com quem fez, quando, o valor anterior e o novo. Nada é apagado.</div>
      </div></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <select className="pl-input" style={{ width: 'auto' }} value={f.tabela} onChange={e => setF({ ...f, tabela: e.target.value })} aria-label="O quê" data-filtro-tabela>
          <option value="">Tudo</option>
          {tabelas.map(t => <option key={t.chave} value={t.chave}>{t.nome}</option>)}
        </select>
        <input className="pl-input" style={{ width: 'auto' }} type="date" value={f.desde} onChange={e => setF({ ...f, desde: e.target.value })} aria-label="Desde" />
        <input className="pl-input" style={{ width: 'auto' }} type="date" value={f.ate} onChange={e => setF({ ...f, ate: e.target.value })} aria-label="Até" />
        {f.registroId && <button type="button" className="pl-btn" onClick={() => setF({ ...f, registroId: '' })}>Ver todos os registros</button>}
      </div>
      {itens && itens.length === 0 && <p className="pl-hint">Nenhum evento no filtro.</p>}
      {itens && itens.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="pl-table"><thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead>
            <tbody>{itens.map(e => (
              <tr key={e.id} data-evento={e.acao}>
                <td className="pl-hint">{new Date(e.em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>{e.quem}</td>
                <td>{ACAO[e.acao]} {e.oQue.toLowerCase()} <button type="button" className="pl-link" onClick={() => setF({ ...f, registroId: e.registroId })} title="Ver só este registro">#{e.registroId.slice(-6)}</button></td>
                <td>{e.campo ?? '—'}</td>
                <td style={{ maxWidth: 220, overflowWrap: 'anywhere' }}>{e.acao === 'ALTERACAO' ? e.valorAnterior ?? '—' : '—'}</td>
                <td style={{ maxWidth: 220, overflowWrap: 'anywhere' }}>{e.acao === 'ALTERACAO' ? e.valorNovo ?? '—' : e.acao === 'CRIACAO' ? 'registro criado' : 'registro apagado'}</td>
              </tr>
            ))}</tbody></table>
        </div>
      )}
    </section>
  )
}
