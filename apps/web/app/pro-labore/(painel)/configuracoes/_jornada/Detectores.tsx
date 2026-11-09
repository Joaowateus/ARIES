'use client'

// PDF 03 · Configurações: os 7 detectores com nível de autonomia e volume
// mínimo (edição só pelo dono, com justificativa) e a chave do roteamento
// (modo silencioso na primeira semana).
import { useEffect, useState } from 'react'
import { recApi, type DetectorCfg, type SugestaoAjuste } from '@/lib/proLaboreApi'

export function Detectores({ podeEditar }: { podeEditar: boolean }) {
  const [d, setD] = useState<{ modo: 'SILENCIOSO' | 'NORMAL'; detectores: DetectorCfg[] } | null>(null)
  const [motivo, setMotivo] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [sug, setSug] = useState<SugestaoAjuste[]>([])
  useEffect(() => {
    recApi.detectores().then(setD).catch(() => setD(null))
    recApi.sugestoes().then(setSug).catch(() => setSug([]))
  }, [])
  if (!d) return null
  async function salvar(chave: string, dados: { ativo?: boolean; volumeMinimo?: number; limite?: number }) {
    setMsg(null)
    if (motivo.trim().length < 5) { setMsg('Escreva por que está mudando antes de salvar.'); return }
    try { setD(await recApi.salvarDetector(chave, { ...dados, justificativa: motivo })); setMsg('Salvo.') } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') }
  }
  async function trocarModo() {
    setMsg(null)
    if (motivo.trim().length < 5) { setMsg('Escreva por que está mudando antes de salvar.'); return }
    try { const r = await recApi.roteamento(d!.modo === 'SILENCIOSO' ? 'NORMAL' : 'SILENCIOSO', motivo); setD({ ...d!, modo: r.modo }); setMsg(r.modo === 'NORMAL' ? `Roteamento ligado: ${r.afetadas} recomendação(ões) abertas foram para quem deve agir.` : 'Voltou ao modo silencioso.') } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') }
  }
  return (
    <section className="pl-card" id="detectores" style={{ marginBottom: 20 }} data-detectores>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Detectores e recomendações</div>
        <div className="pl-card-sub">Regras e estatística sobre o dicionário de métricas (sem IA). Todos no nível 1: só recomendam, nunca executam. Só disparam com o volume mínimo de casos.</div>
      </div></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }} data-roteamento={d.modo}>
        <b>{d.modo === 'SILENCIOSO' ? 'Modo silencioso: só o dono e o supervisor recebem' : 'Roteamento ligado: cada recomendação vai para quem deve agir'}</b>
        {podeEditar && <button type="button" className={`pl-btn ${d.modo === 'SILENCIOSO' ? 'pl-btn-primary' : ''}`} onClick={() => void trocarModo()} data-trocar-roteamento>{d.modo === 'SILENCIOSO' ? 'Ligar o roteamento para a equipe' : 'Voltar ao modo silencioso'}</button>}
      </div>
      {podeEditar && <input className="pl-input" style={{ marginBottom: 10 }} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Por que está mudando (obrigatório para salvar)" data-motivo-detector />}
      <div style={{ overflowX: 'auto' }}>
        <table className="pl-table"><thead><tr><th>Detector</th><th>Dispara quando</th><th>Para</th><th>Ativo</th><th>Volume mínimo</th><th>Variação</th><th>Nível</th></tr></thead>
          <tbody>{d.detectores.map(x => (
            <tr key={x.chave} data-detector={x.chave}>
              <td><b>{x.nome}</b><div className="pl-hint">{x.acao}</div></td>
              <td className="pl-hint">{x.dispara}</td>
              <td className="pl-hint">{x.roteamento}</td>
              <td><input type="checkbox" disabled={!podeEditar} checked={x.ativo} onChange={e => void salvar(x.chave, { ativo: e.target.checked })} aria-label={`Ativar ${x.nome}`} /></td>
              <td><input className="pl-input" style={{ width: 70 }} type="number" min={1} disabled={!podeEditar} defaultValue={x.volumeMinimo} onBlur={e => { const n = Number(e.target.value); if (n && n !== x.volumeMinimo) void salvar(x.chave, { volumeMinimo: n }) }} data-volume /></td>
              <td><input className="pl-input" style={{ width: 70 }} type="number" min={5} max={200} disabled={!podeEditar} defaultValue={Math.round(x.limite * 100)} onBlur={e => { const n = Number(e.target.value) / 100; if (n && n !== x.limite) void salvar(x.chave, { limite: n }) }} aria-label="Variação em %" /> %</td>
              <td>1 · recomendar</td>
            </tr>
          ))}</tbody></table>
      </div>
      <p className="pl-hint">Os níveis 2 (executar com autorização) e 3 (autonomia operacional) chegam quando houver execução; nesta onda nenhum detector executa nada.</p>
      <div style={{ marginTop: 12 }} data-sugestoes-ajuste>
        <div className="pl-eyebrow">Sugestões mensais de ajuste</div>
        {sug.length === 0 ? <p className="pl-hint" style={{ margin: 0 }}>No dia 1º de cada mês o ARIES compara os parâmetros com o que aconteceu e sugere ajustes aqui. Nada muda sem a sua aprovação.</p> : (
          <ul style={{ paddingLeft: 18, margin: 0 }}>{sug.map(s => (
            <li key={s.id} style={{ marginBottom: 6 }} data-sugestao={s.status}>
              <b>{s.parametro}</b> ({s.mes}): {JSON.stringify(s.valorAtual)} → {JSON.stringify(s.valorSugerido)}. {s.justificativa}
              {s.status === 'PENDENTE' && podeEditar ? (
                <span style={{ marginLeft: 6 }}>
                  <button type="button" className="pl-btn pl-btn-primary" style={{ padding: '1px 8px' }} onClick={async () => { const r = await recApi.decidirSugestao(s.id, true); setSug(x => x.map(y => (y.id === r.id ? r : y))) }}>Aprovar</button>{' '}
                  <button type="button" className="pl-btn" style={{ padding: '1px 8px' }} onClick={async () => { const r = await recApi.decidirSugestao(s.id, false); setSug(x => x.map(y => (y.id === r.id ? r : y))) }}>Recusar</button>
                </span>
              ) : <span className="pl-hint"> · {s.status === 'APROVADA' ? 'aprovada' : s.status === 'RECUSADA' ? 'recusada' : 'pendente'}</span>}
            </li>
          ))}</ul>
        )}
      </div>
      {msg && <p className="pl-hint" role="status">{msg}</p>}
    </section>
  )
}
