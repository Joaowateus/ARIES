'use client'

import { useEffect, useState } from 'react'
import { proLaboreApi, type CpMemoria, type CpPerfil, type CpTipoMemoria } from '@/lib/proLaboreApi'
import { NATUREZA, NIVEL, TIPO_MEMORIA } from './rotulos'

const TIPOS_NOVOS: CpTipoMemoria[] = ['OBJETIVO', 'PREFERENCIA', 'ESTILO', 'PONTO_FORTE', 'PONTO_FRACO']

export function Memoria({ somenteLeitura, equipe }: { somenteLeitura: boolean; equipe: boolean }) {
  const [itens, setItens] = useState<CpMemoria[] | null>(null)
  const [perfil, setPerfil] = useState<(CpPerfil & { whatsappDisponivel: boolean }) | null>(null)
  const [rascunho, setRascunho] = useState<{ nivel: CpPerfil['nivel']; minutos: number; objetivo: string; whats: boolean } | null>(null)
  const [novo, setNovo] = useState<{ tipo: CpTipoMemoria; texto: string }>({ tipo: 'PREFERENCIA', texto: '' })
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    let cancelado = false
    Promise.all([proLaboreApi.copiloto.memoria(), proLaboreApi.copiloto.perfil()])
      .then(([m, p]) => { if (cancelado) return; setItens(m); setPerfil(p); setRascunho({ nivel: p.nivel, minutos: p.minutosEstudoDia, objetivo: p.objetivo ?? '', whats: p.whatsappDiario }) })
      .catch(e => { if (!cancelado) setAviso({ tom: 'erro', texto: (e as Error).message }) })
    return () => { cancelado = true }
  }, [])

  async function salvarPerfil() {
    if (!rascunho) return
    try {
      const p = await proLaboreApi.copiloto.salvarPerfil({ nivel: rascunho.nivel, minutosEstudoDia: rascunho.minutos, objetivo: rascunho.objetivo.trim() || null, whatsappDiario: rascunho.whats })
      setPerfil(x => x && { ...x, ...p })
      setItens(await proLaboreApi.copiloto.memoria())
      setAviso({ tom: 'ok', texto: 'Ajustes salvos. Valem a partir da próxima análise.' })
    } catch (e) { setAviso({ tom: 'erro', texto: (e as Error).message }) }
  }
  async function adicionar() {
    try {
      const m = await proLaboreApi.copiloto.criarMemoria(novo.tipo, novo.texto.trim())
      setItens(x => [m, ...(x ?? [])]); setNovo(n => ({ ...n, texto: '' }))
    } catch (e) { setAviso({ tom: 'erro', texto: (e as Error).message }) }
  }
  async function alternar(m: CpMemoria) {
    try { const n = await proLaboreApi.copiloto.editarMemoria(m.id, { ativa: !m.ativa }); setItens(x => x?.map(i => (i.id === m.id ? n : i)) ?? null) } catch (e) { setAviso({ tom: 'erro', texto: (e as Error).message }) }
  }
  async function apagar(m: CpMemoria) {
    try { await proLaboreApi.copiloto.apagarMemoria(m.id); setItens(x => x?.filter(i => i.id !== m.id) ?? null) } catch (e) { setAviso({ tom: 'erro', texto: (e as Error).message }) }
  }

  if (!itens || !perfil || !rascunho) return aviso ? <div className="pl-alert pl-alert-error">{aviso.texto}</div> : <div className="pl-hint">Carregando…</div>
  return (
    <>
      <section className="cp-card" aria-label="Ajustes do copiloto">
        <div className="cp-card-cab"><div><h2>Ajustes</h2><p className="cp-sub">Calibram o tom, os estudos e o resumo diário.</p></div></div>
        <div className="cp-form-linha">
          <label>Seu nível em vendas
            <select className="pl-select" value={rascunho.nivel} onChange={e => setRascunho({ ...rascunho, nivel: e.target.value as CpPerfil['nivel'] })} disabled={somenteLeitura}>
              {Object.entries(NIVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Minutos de estudo por dia
            <input className="pl-input" type="number" min={5} max={120} step={5} value={rascunho.minutos} onChange={e => setRascunho({ ...rascunho, minutos: Number(e.target.value) })} disabled={somenteLeitura} style={{ width: 110 }} />
          </label>
        </div>
        <label className="cp-form-linha" style={{ marginTop: 10, flexDirection: 'column', alignItems: 'stretch', fontSize: 12.5, color: 'var(--pl-ink-2)' }}>Seu objetivo agora
          <textarea className="pl-input" value={rascunho.objetivo} onChange={e => setRascunho({ ...rascunho, objetivo: e.target.value })} maxLength={400} placeholder="Ex.: bater a meta do mês fechando mais propostas" disabled={somenteLeitura} />
        </label>
        {!equipe && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 13.5, color: 'var(--pl-ink-1)' }}>
            <input type="checkbox" checked={rascunho.whats} onChange={e => setRascunho({ ...rascunho, whats: e.target.checked })} disabled={somenteLeitura || (!perfil.whatsappDisponivel && !rascunho.whats)} />
            Receber o resumo do dia no meu WhatsApp
            {!perfil.whatsappDisponivel && <span className="cp-legenda">(precisa do WhatsApp conectado no Assistente Comercial)</span>}
          </label>
        )}
        {!somenteLeitura && <div style={{ marginTop: 12 }}><button type="button" className="pl-btn pl-btn-primary" onClick={salvarPerfil}>Salvar ajustes</button></div>}
        {aviso && <div className={`pl-alert ${aviso.tom === 'ok' ? 'pl-alert-success' : 'pl-alert-error'}`} style={{ marginTop: 10 }} role="status">{aviso.texto}</div>}
      </section>

      <section className="cp-card" aria-label="Memória do copiloto">
        <div className="cp-card-cab"><div><h2>O que o copiloto sabe de você</h2><p className="cp-sub">Fatos medidos nos seus resultados, o que você pediu e as leituras dele (hipóteses). Tudo aqui é usado nas análises; desligue ou apague o que não fizer sentido.</p></div></div>
        {!somenteLeitura && (
          <div className="cp-form-linha" style={{ marginBottom: 12 }}>
            <label>Tipo
              <select className="pl-select" value={novo.tipo} onChange={e => setNovo({ ...novo, tipo: e.target.value as CpTipoMemoria })}>
                {TIPOS_NOVOS.map(t => <option key={t} value={t}>{TIPO_MEMORIA[t]}</option>)}
              </select>
            </label>
            <label style={{ flex: 1, minWidth: 200 }}>O que lembrar
              <input className="pl-input" value={novo.texto} onChange={e => setNovo({ ...novo, texto: e.target.value })} maxLength={400} placeholder="Ex.: prefiro mensagens curtas e sem emoji" />
            </label>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={adicionar} disabled={novo.texto.trim().length < 3}>Adicionar</button>
          </div>
        )}
        {itens.length === 0 ? <p className="cp-legenda">Ainda vazio. O copiloto começa a anotar o que funciona com você a partir das ações feitas e do que você contar.</p> : (
          <ul className="cp-lista cp-memoria" style={{ gap: 0 }}>
            {itens.map(m => (
              <li key={m.id} className={m.ativa ? '' : 'inativa'} style={{ paddingLeft: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="cp-estudo-topo">
                    <span className="cp-selo">{TIPO_MEMORIA[m.tipo] ?? m.tipo}</span>
                    <span className={`cp-selo ${m.natureza === 'HIPOTESE' ? 'atencao' : m.natureza === 'FATO' ? 'ok' : ''}`}>{NATUREZA[m.natureza]}</span>
                    {!m.ativa && <span className="cp-selo">Desligada</span>}
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--pl-ink-1)' }}>{m.texto}</p>
                </div>
                {!somenteLeitura && (
                  <div className="cp-acao-botoes" style={{ flex: 'none' }}>
                    <button type="button" className="cp-link mudo" onClick={() => alternar(m)}>{m.ativa ? 'Desligar' : 'Ligar'}</button>
                    <button type="button" className="cp-link mudo" onClick={() => apagar(m)}>Apagar</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
