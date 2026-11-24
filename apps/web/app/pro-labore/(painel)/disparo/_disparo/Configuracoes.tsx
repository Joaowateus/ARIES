'use client'

// Configurações do Disparo (o dono muda; os demais veem): ritmo e limites padrão, janela, regra de
// autorização para mensagens promocionais, aprovação, rodapé de saída, números conectados e o que o
// provedor de WhatsApp consegue (e não consegue) fazer.
import { useState } from 'react'
import { disparoApi, type ConfigLojaDisparo } from '@/lib/proLaboreApi'
import { DIAS, erroDe, useMeta } from './util'

export function Configuracoes({ aoSalvar }: { aoSalvar: () => void }) {
  const meta = useMeta()
  const [c, setC] = useState<ConfigLojaDisparo>(meta.config)
  const [msg, setMsg] = useState<string | null>(null)
  const e = c.envio
  const setE = (x: Partial<ConfigLojaDisparo['envio']>) => setC({ ...c, envio: { ...e, ...x } })
  const dono = meta.dono
  async function salvar() {
    try { setC(await disparoApi.config.salvar(c)); setMsg('Configurações salvas.'); aoSalvar() } catch (err) { setMsg(erroDe(err)) }
  }
  const cap = meta.capacidades
  return (
    <div data-disparo-config>
      <section className="pl-card">
        <div className="pl-card-title">Regras da loja</div>
        {!dono && <p className="pl-hint">Só o dono altera. Você está vendo os valores atuais.</p>}
        <fieldset disabled={!dono} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="pl-field-grid">
            <div className="pl-field"><label>Mensagens promocionais vão para</label>
              <label className="pl-hint"><input type="radio" checked={c.baseMarketing === 'EXPLICITA'} onChange={() => setC({ ...c, baseMarketing: 'EXPLICITA' })} /> Só quem autorizou (registro com base legal e evidência) — recomendado</label>
              <label className="pl-hint"><input type="radio" checked={c.baseMarketing === 'RELACAO'} onChange={() => setC({ ...c, baseMarketing: 'RELACAO' })} /> Também leads e clientes da loja que não pediram para sair (legítimo interesse; a decisão e o risco são da loja)</label>
              <span className="pl-hint">Ter escrito para a loja não é autorização para receber promoções.</span>
            </div>
            <div className="pl-field"><label>Aprovação</label><label className="pl-hint"><input type="checkbox" checked={c.exigirAprovacao} onChange={ev => setC({ ...c, exigirAprovacao: ev.target.checked })} /> Campanha de quem não é da gestão passa por aprovação do dono ou do supervisor</label></div>
            <div className="pl-field"><label htmlFor="cf-rod">Rodapé das promocionais</label><input id="cf-rod" className="pl-input" maxLength={200} value={c.rodapeSair} onChange={ev => setC({ ...c, rodapeSair: ev.target.value })} /></div>
            <div className="pl-field"><label htmlFor="cf-sair">Palavras que descadastram</label><input id="cf-sair" className="pl-input" value={c.palavrasSair.join(', ')} onChange={ev => setC({ ...c, palavrasSair: ev.target.value.split(',').map(x => x.trim()).filter(Boolean) })} /></div>
          </div>
          <div className="pl-card-title" style={{ marginTop: 16 }}>Padrão de envio das campanhas</div>
          <div className="pl-field-grid">
            <div className="pl-field"><label>Janela (horário de Brasília)</label>
              <div className="dp-linha"><input className="pl-input dp-curto" type="time" value={e.janela.inicio} onChange={ev => setE({ janela: { ...e.janela, inicio: ev.target.value } })} aria-label="Início" /><span className="pl-hint">até</span><input className="pl-input dp-curto" type="time" value={e.janela.fim} onChange={ev => setE({ janela: { ...e.janela, fim: ev.target.value } })} aria-label="Fim" /></div>
              <div className="cc-chips">{DIAS.map((d, i) => <button key={d} type="button" className={`pl-chip ${e.janela.dias.includes(i) ? 'active' : ''}`} onClick={() => setE({ janela: { ...e.janela, dias: e.janela.dias.includes(i) ? e.janela.dias.filter(x => x !== i) : [...e.janela.dias, i].sort() } })}>{d}</button>)}</div>
            </div>
            <div className="pl-field"><label>Ritmo por número</label>
              <div className="dp-linha"><span className="pl-hint">1 a cada</span><input className="pl-input dp-curto" type="number" min={8} value={e.intervaloSeg} onChange={ev => setE({ intervaloSeg: Number(ev.target.value) })} aria-label="Segundos" /><span className="pl-hint">s · até</span><input className="pl-input dp-curto" type="number" min={1} value={e.maxPorHora} onChange={ev => setE({ maxPorHora: Number(ev.target.value) })} aria-label="Por hora" /><span className="pl-hint">/h ·</span><input className="pl-input dp-curto" type="number" min={1} value={e.maxPorDia} onChange={ev => setE({ maxPorDia: Number(ev.target.value) })} aria-label="Por dia" /><span className="pl-hint">/dia</span></div>
            </div>
            <div className="pl-field"><label htmlFor="cf-tent">Tentativas por mensagem</label><input id="cf-tent" className="pl-input dp-curto" type="number" min={1} max={8} value={e.maxTentativas} onChange={ev => setE({ maxTentativas: Number(ev.target.value) })} /></div>
            <div className="pl-field"><label>Parar a sequência quando</label>
              <label className="pl-hint"><input type="checkbox" checked={e.pararAoResponder} onChange={ev => setE({ pararAoResponder: ev.target.checked })} /> responder</label>
              <label className="pl-hint"><input type="checkbox" checked={e.pararAoComprar} onChange={ev => setE({ pararAoComprar: ev.target.checked })} /> comprar</label>
              <label className="pl-hint"><input type="checkbox" checked={e.pararSeVendedorAssumir} onChange={ev => setE({ pararSeVendedorAssumir: ev.target.checked })} /> o vendedor assumir</label>
            </div>
          </div>
          {dono && <div className="dp-linha dp-rodape"><button type="button" className="pl-btn pl-btn-primary" onClick={() => void salvar()}>Salvar</button></div>}
        </fieldset>
        {msg && <p className="pl-hint" role="status">{msg}</p>}
      </section>
      <section className="pl-card" style={{ marginTop: 16 }}>
        <div className="pl-card-title">Números conectados</div>
        {!meta.remetentes.length ? <p className="pl-hint">Nenhum WhatsApp conectado. Conecte em Conversas › Conexão.</p> : (
          <ul className="ar-fila">{meta.remetentes.map(r => <li key={r.id} className="ar-fila-item"><div><div className="ar-fila-titulo">{r.vendedor} {r.numero ?? ''}</div><div className="pl-hint">{r.conectado ? 'conectado' : 'desconectado'}{r.ativo ? '' : ' · vendedor inativo'}</div></div></li>)}</ul>
        )}
      </section>
      <section className="pl-card" style={{ marginTop: 16 }}>
        <div className="pl-card-title">O que o WhatsApp conectado faz</div>
        <ul className="pl-hint" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Texto, imagem, áudio, vídeo e documento: {cap.texto && cap.imagem && cap.audio && cap.video && cap.documento ? 'sim' : 'em parte'} (até {Math.round(cap.maxMidiaBytes / 1024 / 1024)} MB por arquivo)</li>
          <li>Modelos aprovados (templates) e botões: {cap.templates ? 'sim' : 'não'}</li>
          <li>Eventos: aceita {cap.eventos.aceita ? 'sim' : 'não'} · entregue {cap.eventos.entregue ? 'sim' : 'não'} · lida {cap.eventos.lida ? 'sim' : 'não'} · resposta {cap.eventos.resposta ? 'sim' : 'não'}</li>
          {cap.observacoes.map(o => <li key={o}>{o}</li>)}
        </ul>
      </section>
    </div>
  )
}
