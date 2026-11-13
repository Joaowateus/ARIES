'use client'

// Biblioteca de cadências do follow pelo robô (Ajuste 3): o dono edita as
// mensagens de cada passo; o vendedor escolhe a cadência no CRM.
import { useEffect, useState } from 'react'
import { proLaboreApi, type CadenciaRobo, type PassoCadenciaRobo } from '@/lib/proLaboreApi'

const MIDIAS: Array<[PassoCadenciaRobo['midia'], string]> = [['NENHUMA', 'Só texto'], ['FOTO_MOTO', 'Foto da moto'], ['VIDEO_MOTO', 'Vídeo da moto']]

export function CadenciasRobo({ editavel }: { editavel: boolean }) {
  const [lista, setLista] = useState<CadenciaRobo[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  useEffect(() => { proLaboreApi.jornada.cadencias().then(setLista).catch(e => setMsg(e instanceof Error ? e.message : 'Não foi possível carregar')) }, [])
  if (!lista) return msg ? <div className="pl-alert">{msg}</div> : null
  const mudar = (id: string, fn: (c: CadenciaRobo) => CadenciaRobo) => setLista(l => l!.map(c => (c.id === id ? fn(c) : c)))
  async function salvar() {
    setMsg(null)
    try { setLista(await proLaboreApi.jornada.salvarCadencias(lista!)); setMsg('Cadências salvas.') } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível salvar') }
  }
  function nova() {
    const id = `minha-${Date.now().toString(36)}`
    setLista(l => [...l!, { id, nome: 'Nova cadência', descricao: '', passos: [{ dias: 1, texto: 'Oi, {nome}! Tudo bem?', midia: 'NENHUMA' }] }]); setAberta(id)
  }
  return (
    <section className="pl-card" style={{ marginBottom: 16 }} data-cadencias-robo>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Cadências do follow pelo robô</div>
        <div className="pl-card-sub">O vendedor escolhe uma delas no CRM (no card ou selecionando vários clientes). Os dias contam a partir do início; o robô para quando o cliente responde.</div>
      </div></div>
      {lista.map(c => (
        <div key={c.id} className="cr-item" data-cadencia-item={c.id}>
          <button type="button" className="cr-cab" onClick={() => setAberta(a => (a === c.id ? null : c.id))} aria-expanded={aberta === c.id}>
            <b>{c.nome}</b><span className="pl-hint">{c.passos.length} passo{c.passos.length > 1 ? 's' : ''} · dias {c.passos.map(p => p.dias).join(', ')}</span>
          </button>
          {aberta === c.id && (
            <div className="cr-corpo">
              <label className="pl-field"><span>Nome</span><input className="pl-input" value={c.nome} disabled={!editavel} onChange={e => mudar(c.id, x => ({ ...x, nome: e.target.value }))} /></label>
              <label className="pl-field"><span>Quando usar</span><input className="pl-input" value={c.descricao} disabled={!editavel} onChange={e => mudar(c.id, x => ({ ...x, descricao: e.target.value }))} /></label>
              {c.passos.map((p, i) => (
                <div key={i} className="cr-passo">
                  <label><span className="pl-hint">Dia</span><input className="pl-input" type="number" min={0} max={90} value={p.dias} disabled={!editavel} onChange={e => mudar(c.id, x => ({ ...x, passos: x.passos.map((y, j) => (j === i ? { ...y, dias: Number(e.target.value) || 0 } : y)) }))} /></label>
                  <select className="pl-select" value={p.midia} disabled={!editavel} onChange={e => mudar(c.id, x => ({ ...x, passos: x.passos.map((y, j) => (j === i ? { ...y, midia: e.target.value as PassoCadenciaRobo['midia'] } : y)) }))}>{MIDIAS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
                  <textarea className="pl-input" rows={2} value={p.texto} disabled={!editavel} onChange={e => mudar(c.id, x => ({ ...x, passos: x.passos.map((y, j) => (j === i ? { ...y, texto: e.target.value } : y)) }))} />
                  {editavel && c.passos.length > 1 && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => mudar(c.id, x => ({ ...x, passos: x.passos.filter((_, j) => j !== i) }))}>Tirar</button>}
                </div>
              ))}
              {editavel && c.passos.length < 8 && <button type="button" className="pl-link-action" onClick={() => mudar(c.id, x => ({ ...x, passos: [...x.passos, { dias: (x.passos.at(-1)?.dias ?? 0) + 2, texto: '', midia: 'NENHUMA' }] }))}>+ passo</button>}
            </div>
          )}
        </div>
      ))}
      {editavel && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button type="button" className="pl-btn" onClick={nova}>Nova cadência</button>
          <button type="button" className="pl-btn pl-btn-primary" onClick={() => void salvar()} data-salvar-cadencias>Salvar cadências</button>
        </div>
      )}
      {msg && <p className="pl-hint" role="status">{msg}</p>}
    </section>
  )
}
