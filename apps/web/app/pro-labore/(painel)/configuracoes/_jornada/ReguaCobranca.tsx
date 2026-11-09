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
  const [motivo, setMotivo] = useState('')
  const [conf, setConf] = useState<Awaited<ReturnType<typeof proLaboreApi.jornada.conferenciaAtividades>> | null>(null)
  useEffect(() => {
    proLaboreApi.jornada.regua().then(setR).catch(() => setR(null))
    if (podeEditar) proLaboreApi.jornada.conferenciaAtividades().then(setConf).catch(() => setConf(null))
  }, [podeEditar])
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
          {r.modo === 'REGISTRO' ? <> <strong>Semana em paralelo: a régua só registra o que mandaria, sem enviar.</strong></> : <> <strong>Envio ligado: os avisos saem pelo WhatsApp (Aries ou chat &quot;Você&quot;), das 7h às 21h.</strong></>}
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
      {podeEditar && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0' }} data-modo-regua={r.modo}>
          <input className="pl-input" style={{ flex: '1 1 260px' }} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder={r.modo === 'REGISTRO' ? 'Por que ligar o envio (ex.: fim da semana em paralelo)' : 'Por que voltar só a registrar'} data-motivo-modo />
          <button type="button" className={`pl-btn ${r.modo === 'REGISTRO' ? 'pl-btn-primary' : ''}`} disabled={motivo.trim().length < 5}
            onClick={async () => { setMsg(null); try { setR(await proLaboreApi.jornada.modoRegua(r.modo === 'REGISTRO' ? 'ENVIO' : 'REGISTRO', motivo)); setMotivo(''); setMsg('Modo da régua alterado.') } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') } }}
            data-trocar-modo>{r.modo === 'REGISTRO' ? 'Ligar o envio' : 'Voltar a só registrar'}</button>
        </div>
      )}
      <p className="pl-hint">Ligações já têm o aviso na hora e 30 min depois: a régua não repete esses dois para elas. Sem supervisor (ou gestor), o escalonamento vai para o dono. O tempo do lembrete (30 min) é o padrão provisório: o PDF não define.</p>
      {conf && (
        <div style={{ marginTop: 14 }} data-conferencia-atv>
          <div className="pl-eyebrow">Conferência da migração das tarefas (antes × ATV)</div>
          <table className="pl-table"><thead><tr><th>Tipo</th><th>Hoje</th><th>Na ATV</th><th>Sem data</th><th>Sem autor</th><th>Apagadas depois</th><th>Situação</th></tr></thead>
            <tbody>{conf.map(l => (
              <tr key={l.tipo} data-conf={l.tipo}><td>{l.tipo}</td><td>{l.atual}</td><td>{l.atv}</td><td>{l.semData}</td><td>{l.semAutor}</td><td>{l.apagadasDepois}</td><td>{l.bate && !l.semData && !l.semAutor ? 'Confere' : 'Diferente'}</td></tr>
            ))}</tbody></table>
        </div>
      )}
      {msg && <p className="pl-hint" role="status">{msg}</p>}
    </section>
  )
}
