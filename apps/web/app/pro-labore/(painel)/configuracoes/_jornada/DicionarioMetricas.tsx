'use client'

// PDF 02 · Configurações: dicionário de métricas (consulta e versões). Tocar
// na métrica abre a ficha; o dono pode mudar responsável, quem vê e faixas
// — cada mudança vira uma nova versão, com justificativa. A fórmula é a do PDF.
import { useEffect, useState } from 'react'
import { metricasApi, type FichaMetrica } from '@/lib/proLaboreApi'
import { FichaMetricaModal } from '../../_metricas/Metricas'

const PAPEIS = ['DONO', 'SUPERVISOR', 'SDR', 'VENDEDOR'] as const

export function DicionarioMetricas({ podeEditar }: { podeEditar: boolean }) {
  const [fichas, setFichas] = useState<FichaMetrica[] | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const [editando, setEditando] = useState<FichaMetrica | null>(null)
  const [resp, setResp] = useState('')
  const [quemVe, setQuemVe] = useState<string[]>([])
  const [justificativa, setJustificativa] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { metricasApi.fichas().then(setFichas).catch(() => setFichas(null)) }, [])
  if (!fichas) return null
  function editar(f: FichaMetrica) { setEditando(f); setResp(f.responsavel); setQuemVe(f.quemVe); setJustificativa(''); setMsg(null) }
  async function salvar() {
    if (!editando) return
    try {
      const r = await metricasApi.novaVersao(editando.chave, { responsavel: resp, quemVe, justificativa })
      setFichas(fs => fs?.map(f => (f.chave === r.ficha.chave ? r.ficha : f)) ?? null)
      setEditando(null); setMsg(`Versão ${r.ficha.versao} aprovada.`)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível salvar') }
  }
  const lote = (n: 1 | 2) => fichas.filter(f => f.lote === n)
  return (
    <section className="pl-card" id="dicionario-metricas" style={{ marginBottom: 20 }} data-dicionario-metricas>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Dicionário de métricas</div>
        <div className="pl-card-sub">Cada número do sistema vem de uma ficha única. Toque na métrica para ver fórmula, fonte, faixas e versões.</div>
      </div></div>
      {([1, 2] as const).map(n => (
        <div key={n} style={{ marginTop: 10 }}>
          <div className="pl-eyebrow">{n === 1 ? 'Primeiro lote — comerciais' : 'Segundo lote — jornada'}</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="pl-table"><thead><tr><th>Métrica</th><th>Fonte</th><th>Responsável</th><th>Versão</th>{podeEditar && <th />}</tr></thead>
              <tbody>{lote(n).map(f => (
                <tr key={f.chave} data-metrica={f.chave}>
                  <td><button type="button" className="pl-link" onClick={() => setAberta(f.chave)}>{f.nome}</button></td>
                  <td className="pl-hint">{f.fonte}</td>
                  <td>{f.responsavel}</td>
                  <td>v{f.versao}</td>
                  {podeEditar && <td><button type="button" className="pl-btn" onClick={() => editar(f)}>Mudar</button></td>}
                </tr>
              ))}</tbody></table>
          </div>
        </div>
      ))}
      {msg && <p className="pl-hint" role="status">{msg}</p>}
      {aberta && <FichaMetricaModal chave={aberta} onFechar={() => setAberta(null)} />}
      {editando && (
        <div className="pl-modal-backdrop" onClick={() => setEditando(null)}>
          <div className="pl-card pl-modal-panel" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()} data-editar-metrica={editando.chave}>
            <div className="pl-card-title" style={{ marginBottom: 10 }}>{editando.nome} · nova versão</div>
            <div className="pl-field"><label>Responsável</label><input className="pl-input" value={resp} onChange={e => setResp(e.target.value)} /></div>
            <div className="pl-field"><label>Quem vê</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{PAPEIS.map(p => (
                <label key={p} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input type="checkbox" disabled={p === 'DONO'} checked={quemVe.includes(p)} onChange={e => setQuemVe(e.target.checked ? [...quemVe, p] : quemVe.filter(x => x !== p))} />{p === 'DONO' ? 'Dono' : p === 'SUPERVISOR' ? 'Supervisor' : p === 'SDR' ? 'SDR' : 'Vendedor'}
                </label>
              ))}</div>
            </div>
            <div className="pl-field"><label>Por que mudou</label><textarea className="pl-input" rows={2} value={justificativa} onChange={e => setJustificativa(e.target.value)} data-justificativa /></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" className="pl-btn" onClick={() => setEditando(null)}>Cancelar</button>
              <button type="button" className="pl-btn pl-btn-primary" disabled={justificativa.trim().length < 5} onClick={() => void salvar()}>Aprovar nova versão</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
