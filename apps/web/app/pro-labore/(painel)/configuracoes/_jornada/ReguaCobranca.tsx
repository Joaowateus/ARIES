'use client'

// Régua de cobrança das Atividades (PDF 02, 4.4): lembrete antes do
// vencimento, alerta no vencimento, novo alerta e escalonamento, por tipo de
// origem. Os alertas param quando a execução é registrada. Na semana em
// paralelo a régua só registra o que mandaria (não envia). Só o dono muda.
import { useEffect, useState } from 'react'
import { proLaboreApi, type ConfigReguaCobranca, type ReguaCobrancaResp } from '@/lib/proLaboreApi'

const ORIGEM: Record<string, string> = { OPORTUNIDADE: 'Oportunidade', ROTINA: 'Rotina da Agenda', RECOMENDACAO: 'Recomendação', REUNIAO: 'Reunião', OCORRENCIA: 'Ocorrência', PAUTA: 'Pauta (Social Media)' }
const PARA: Record<ConfigReguaCobranca['escalonarPara'], string> = { SUPERVISOR: 'Supervisor comercial', GESTOR: 'Gestor (Social Media)', DONO: 'Dono' }
const CAMPOS: Array<{ k: 'lembreteMinAntes' | 'segundoAlertaMin' | 'escalonamentoMin'; rotulo: string }> = [
  { k: 'lembreteMinAntes', rotulo: 'Lembrete (min antes)' },
  { k: 'segundoAlertaMin', rotulo: 'Novo alerta (min depois)' },
  { k: 'escalonamentoMin', rotulo: 'Escalonar (min de atraso)' },
]

export function ReguaCobranca({ podeEditar }: { podeEditar: boolean }) {
  const [r, setR] = useState<ReguaCobrancaResp | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { proLaboreApi.jornada.regua().then(setR).catch(() => setR(null)) }, [])
  if (!r) return null
  async function salvar(origem: string, d: ConfigReguaCobranca) {
    setMsg(null)
    try { setR(await proLaboreApi.jornada.salvarRegua(origem, d)); setMsg('Salvo.') } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível salvar') }
  }
  return (
    <section className="pl-card" id="regua-cobranca" style={{ marginBottom: 20 }} data-regua-cobranca>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Régua de cobrança · atividades</div>
        <div className="pl-card-sub">
          Lembrete antes do vencimento, alerta no vencimento, novo alerta e escalonamento. Para quando a atividade é feita.
          {r.modo === 'REGISTRO' && <> <strong>Semana em paralelo: a régua só registra o que mandaria, sem enviar.</strong></>}
        </div>
      </div></div>
      <div style={{ overflowX: 'auto' }}>
        <table className="pl-table"><thead><tr><th>Origem</th>{CAMPOS.map(c => <th key={c.k}>{c.rotulo}</th>)}<th>Escalonar para</th></tr></thead>
          <tbody>{Object.entries(r.origens).map(([o, c]) => (
            <tr key={o} data-regua={o}>
              <td>{ORIGEM[o] ?? o}</td>
              {CAMPOS.map(f => (
                <td key={f.k}>
                  <input className="pl-input" style={{ width: 80 }} type="number" min={0} disabled={!podeEditar} defaultValue={c[f.k]} data-campo={f.k}
                    onBlur={ev => { const n = Number(ev.target.value); if (Number.isFinite(n) && n !== c[f.k]) void salvar(o, { ...c, [f.k]: n }) }} />
                </td>
              ))}
              <td>
                <select className="pl-input" disabled={!podeEditar} value={c.escalonarPara} onChange={ev => void salvar(o, { ...c, escalonarPara: ev.target.value as ConfigReguaCobranca['escalonarPara'] })}>
                  {Object.entries(PARA).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select>
              </td>
            </tr>
          ))}</tbody></table>
      </div>
      <p className="pl-hint">Sem supervisor (ou gestor), o escalonamento vai para o dono. O tempo do lembrete (30 min) é o padrão provisório: o PDF não define.</p>
      {msg && <p className="pl-hint" role="status">{msg}</p>}
    </section>
  )
}
