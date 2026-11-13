'use client'

// PDF 06 · Configurações (só o dono): a biblioteca de frases do Hoje (autor e
// fonte sempre; só aparece aprovada e ligada; sugestões do ARIES entram
// desligadas para conferir) e o expediente da loja (prazos de detector e de
// decisão vencem no fim do expediente). Toda mudança de expediente fica no histórico.
import { useEffect, useState } from 'react'
import { bussolaApi, dailyApi, type Expediente, type FraseBiblioteca } from '@/lib/proLaboreApi'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const ORIGEM: Record<string, string> = { DONO: 'cadastrada por você', ARIES: 'sugerida pelo ARIES', INICIAL: 'conjunto inicial' }

export function BibliotecaFrases() {
  const [frases, setFrases] = useState<FraseBiblioteca[] | null>(null)
  const [temas, setTemas] = useState<string[]>([])
  const [nova, setNova] = useState({ texto: '', autor: '', fonte: '', temas: [] as string[] })
  const [msg, setMsg] = useState<string | null>(null)
  const [tema, setTema] = useState('vendas')
  const carregar = () => bussolaApi.frases().then(r => { setFrases(r.frases); setTemas(r.temas) }).catch(() => setFrases([]))
  useEffect(() => { void carregar() }, [])
  async function acao(f: () => Promise<unknown>, ok: string) { setMsg(null); try { await f(); setMsg(ok); await carregar() } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') } }
  if (!frases) return null
  const pendentes = frases.filter(f => !f.aprovadaEm).length
  return (
    <section className="pl-card" id="frases" style={{ marginBottom: 20 }} data-biblioteca-frases>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Hoje: biblioteca de frases do dia</div>
        <div className="pl-card-sub">O ARIES só mostra frases desta lista, aprovadas e ligadas por você, com autor e fonte; escolhe pelo momento do negócio e não repete a mesma frase em 30 dias. {pendentes ? `${pendentes} aguardando a sua conferência.` : ''}</div>
      </div></div>
      <table className="pl-table"><thead><tr><th>Frase</th><th>Autor e fonte</th><th>Temas</th><th>Situação</th><th /></tr></thead>
        <tbody>{frases.map(f => (
          <tr key={f.id} data-frase={f.id} data-ativa={f.ativa ? '1' : '0'}>
            <td style={{ maxWidth: 320 }}>“{f.texto}”</td>
            <td><b>{f.autor}</b><div className="pl-hint" style={{ fontSize: 12 }}>{f.fonte}</div></td>
            <td style={{ fontSize: 12 }}>{f.temas.join(', ')}</td>
            <td style={{ fontSize: 12 }}>{f.aprovadaEm ? (f.ativa ? 'Ligada' : 'Aprovada, desligada') : 'Aguardando conferência'}<div className="pl-hint">{ORIGEM[f.origem]}{f.ultimaVezUsada ? ` · usada em ${new Date(f.ultimaVezUsada).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : ''}</div></td>
            <td style={{ whiteSpace: 'nowrap' }}>
              {!f.aprovadaEm && <button type="button" className="pl-btn pl-btn-primary" style={{ padding: '2px 8px' }} onClick={() => void acao(() => bussolaApi.editarFrase(f.id, { aprovar: true, ativa: true }), 'Frase conferida, aprovada e ligada.')} data-aprovar-frase>Conferi: aprovar e ligar</button>}
              {f.aprovadaEm && <button type="button" className="pl-btn" style={{ padding: '2px 8px' }} onClick={() => void acao(() => bussolaApi.editarFrase(f.id, { ativa: !f.ativa }), f.ativa ? 'Frase desligada.' : 'Frase ligada.')} data-ligar-frase>{f.ativa ? 'Desligar' : 'Ligar'}</button>}
            </td>
          </tr>
        ))}</tbody></table>
      <div style={{ display: 'grid', gap: 6, marginTop: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }} data-nova-frase>
        <input className="pl-input" placeholder="Frase" value={nova.texto} onChange={e => setNova({ ...nova, texto: e.target.value })} aria-label="Frase" />
        <input className="pl-input" placeholder="Autor" value={nova.autor} onChange={e => setNova({ ...nova, autor: e.target.value })} aria-label="Autor" />
        <input className="pl-input" placeholder="Fonte (livro e ano, discurso, entrevista)" value={nova.fonte} onChange={e => setNova({ ...nova, fonte: e.target.value })} aria-label="Fonte" />
        <select className="pl-input" multiple value={nova.temas} onChange={e => setNova({ ...nova, temas: [...e.target.selectedOptions].map(o => o.value) })} aria-label="Temas" style={{ minHeight: 60 }}>{temas.map(t => <option key={t} value={t}>{t}</option>)}</select>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="pl-btn pl-btn-primary" onClick={() => void acao(async () => { await bussolaApi.criarFrase(nova); setNova({ texto: '', autor: '', fonte: '', temas: [] }) }, 'Frase cadastrada e ligada.')} data-salvar-frase>Cadastrar a frase</button>
        <span className="pl-hint">ou peça sugestões ao ARIES sobre</span>
        <select className="pl-input" value={tema} onChange={e => setTema(e.target.value)} aria-label="Tema da sugestão">{temas.map(t => <option key={t} value={t}>{t}</option>)}</select>
        <button type="button" className="pl-btn" onClick={() => void acao(async () => { const r = await bussolaApi.sugerirFrases(tema); setMsg(r.aviso) }, 'Sugestões do ARIES na lista, aguardando a sua conferência.')} data-sugerir-frases>Sugerir frases</button>
      </div>
      {msg && <p className="pl-hint" role="status">{msg}</p>}
    </section>
  )
}

export function ConfigExpediente() {
  const [e, setE] = useState<Expediente | null>(null)
  const [just, setJust] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { dailyApi.expediente().then(r => setE(r.expediente)).catch(() => setE(null)) }, [])
  if (!e) return null
  async function salvar() {
    if (just.trim().length < 5) { setMsg('Escreva o motivo (fica no histórico).'); return }
    try { await dailyApi.salvarExpediente({ ...e!, justificativa: just.trim() }); setMsg('Expediente salvo.'); setJust('') } catch (x) { setMsg(x instanceof Error ? x.message : 'Não foi possível salvar') }
  }
  return (
    <section className="pl-card" id="expediente" style={{ marginBottom: 20 }} data-config-expediente>
      <div className="pl-card-head"><div>
        <div className="pl-card-title">Expediente da loja</div>
        <div className="pl-card-sub">Atividades criadas pelos detectores e pelas decisões do Daily vencem no fim do expediente do dia escolhido, nunca de madrugada.</div>
      </div></div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: 13 }}>Início <input className="pl-input" type="time" value={e.inicio} onChange={x => setE({ ...e, inicio: x.target.value })} data-expediente-inicio /></label>
        <label style={{ fontSize: 13 }}>Fim <input className="pl-input" type="time" value={e.fim} onChange={x => setE({ ...e, fim: x.target.value })} data-expediente-fim /></label>
        {DIAS.map((d, i) => <label key={d} style={{ fontSize: 13 }}><input type="checkbox" checked={e.dias.includes(i)} onChange={x => setE({ ...e, dias: x.target.checked ? [...e.dias, i] : e.dias.filter(y => y !== i) })} /> {d}</label>)}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <input className="pl-input" style={{ flex: 1, minWidth: 220 }} placeholder="Motivo da mudança (obrigatório)" value={just} onChange={x => setJust(x.target.value)} aria-label="Motivo" />
        <button type="button" className="pl-btn pl-btn-primary" onClick={() => void salvar()} data-salvar-expediente>Salvar</button>
      </div>
      {msg && <p className="pl-hint" role="status">{msg}</p>}
    </section>
  )
}
