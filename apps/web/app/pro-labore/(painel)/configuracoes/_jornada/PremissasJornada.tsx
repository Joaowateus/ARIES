'use client'

// Metas e premissas da jornada (PDF 01, seção 4). Tempo máximo inicial pelo
// histórico (Lead, Abordado, Negociação, Proposta); as etapas sem histórico
// ficam sem limite até haver 30 dias de dados (aí aparece a sugestão para
// aprovar). Agendamento vai até a data marcada; SQL, pela validade da
// aprovação. Só o dono muda.
import { useEffect, useState } from 'react'
import { proLaboreApi, type EtapaJornada, type PremissasJornada as Premissas, type UnidadeTempo } from '@/lib/proLaboreApi'
import { ETAPAS_JORNADA, NOME_ETAPA } from '@/lib/etapasJornada'

const FONTE: Record<string, string> = { HISTORICO: 'pelo histórico', APROVADO: 'definido por você', SEM_LIMITE: 'sem limite', DATA_MARCADA: 'até a data marcada', VALIDADE: 'pela validade da aprovação' }
const UN: Record<UnidadeTempo, string> = { MINUTOS: 'minutos', HORAS: 'horas', DIAS: 'dias' }
const CRIT: Record<string, string> = { modelo: 'Modelo de interesse', pagamento: 'Forma de pagamento', cnh: 'Situação da CNH', entrada: 'Se tem entrada' }

export function PremissasJornada({ podeEditar }: { podeEditar: boolean }) {
  const [p, setP] = useState<Premissas | null>(null)
  const [tempos, setTempos] = useState<Partial<Record<EtapaJornada, string>>>({})
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { proLaboreApi.jornada.premissas().then(setP).catch(() => setP(null)) }, [])
  if (!p) return null
  async function salvar(d: Parameters<typeof proLaboreApi.jornada.salvarPremissas>[0]) {
    setMsg(null)
    try { setP(await proLaboreApi.jornada.salvarPremissas(d)); setTempos({}); setMsg('Salvo.') } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível salvar') }
  }
  const editaveis = ETAPAS_JORNADA.filter(e => !['AGENDAMENTO', 'VENDA'].includes(e))
  return (
    <section className="pl-card" id="premissas-jornada" style={{ marginBottom: 20 }} data-premissas-jornada>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Metas e premissas · jornada de compra</div>
        <div className="pl-card-sub">Passado o tempo máximo, o lead conta como parado na etapa (o card fica marcado). Os valores iniciais vêm do histórico da loja.</div>
      </div></div>
      <div style={{ overflowX: 'auto' }}>
        <table className="pl-table"><thead><tr><th>Etapa</th><th>Tempo máximo</th><th>Origem</th>{podeEditar && <th>Mudar para</th>}</tr></thead>
          <tbody>{ETAPAS_JORNADA.map((e, i) => {
            const t = p.temposMaximos[e]
            return (
              <tr key={e} data-tempo={e}>
                <td>{i + 1}. {NOME_ETAPA[e]}</td>
                <td>{t.valor != null ? `${t.valor} ${UN[t.unidade]}` : '—'}{t.sugerido != null && t.fonte !== 'APROVADO' ? <div className="pl-hint">sugestão pelo histórico: {t.sugerido} {UN[t.unidade]}</div> : null}</td>
                <td className="pl-hint">{FONTE[t.fonte]}</td>
                {podeEditar && <td>{editaveis.includes(e) && (
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    <input className="pl-input" style={{ width: 70 }} inputMode="numeric" value={tempos[e] ?? ''} placeholder={t.sugerido != null ? String(t.sugerido) : ''} onChange={ev => setTempos({ ...tempos, [e]: ev.target.value.replace(/\D/g, '') })} />
                    <span className="pl-hint" style={{ alignSelf: 'center' }}>{UN[t.unidade]}</span>
                  </span>
                )}</td>}
              </tr>
            )
          })}</tbody></table>
      </div>
      {podeEditar && Object.values(tempos).some(Boolean) && (
        <button type="button" className="pl-btn pl-btn-primary" style={{ marginTop: 8 }} data-salvar-tempos
          onClick={() => void salvar({ temposMaximos: Object.fromEntries(Object.entries(tempos).filter(([, v]) => v).map(([e, v]) => [e, { valor: Number(v), unidade: p.temposMaximos[e as EtapaJornada].unidade }])) })}>Aprovar tempos</button>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 16, marginTop: 16 }}>
        <div>
          <div className="pl-eyebrow">Critérios do Levantamento</div>
          {Object.entries(CRIT).map(([k, n]) => (
            <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" disabled={!podeEditar} checked={p.criteriosLevantamento.includes(k)}
                onChange={ev => void salvar({ criteriosLevantamento: ev.target.checked ? [...p.criteriosLevantamento, k] : p.criteriosLevantamento.filter(x => x !== k) })} data-criterio={k} /> {n}
            </label>
          ))}
        </div>
        <div>
          <div className="pl-eyebrow">Faltas até a perda</div>
          <input className="pl-input" style={{ width: 80 }} type="number" min={1} max={10} disabled={!podeEditar} defaultValue={p.faltasAtePerda} onBlur={ev => { const n = Number(ev.target.value); if (n && n !== p.faltasAtePerda) void salvar({ faltasAtePerda: n }) }} data-faltas />
        </div>
        <div>
          <div className="pl-eyebrow">Pós-venda (dias depois da confirmação)</div>
          {(['entrega', 'documentacao', 'primeiraRevisao'] as const).map(k => (
            <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ width: 120 }}>{k === 'entrega' ? 'Entrega' : k === 'documentacao' ? 'Documentação' : 'Primeira revisão'}</span>
              <input className="pl-input" style={{ width: 80 }} type="number" min={0} disabled={!podeEditar} defaultValue={p.posVendaPrazos[k]} onBlur={ev => { const n = Number(ev.target.value); if (n !== p.posVendaPrazos[k]) void salvar({ posVendaPrazos: { ...p.posVendaPrazos, [k]: n } }) }} data-pos={k} />
            </label>
          ))}
        </div>
      </div>
      {msg && <p className="pl-hint" role="status">{msg}</p>}
    </section>
  )
}
