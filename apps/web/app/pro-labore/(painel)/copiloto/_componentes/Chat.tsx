'use client'

import { useEffect, useRef, useState } from 'react'
import { proLaboreApi, type CpMensagem } from '@/lib/proLaboreApi'

const SUGESTOES = [
  'Por onde começo hoje?',
  'Como respondo um cliente que achou caro?',
  'Me ajuda a escrever um follow-up para quem pediu para pensar',
  'O que eu mais preciso melhorar nos meus números?',
  'Lembre que meu objetivo é fechar mais vendas por indicação',
]

export function Chat({ nome, somenteLeitura }: { nome: string; somenteLeitura: boolean }) {
  const [msgs, setMsgs] = useState<CpMensagem[] | null>(null)
  const [iaLigada, setIaLigada] = useState(true)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')
  const fim = useRef<HTMLDivElement>(null)
  const seq = useRef(0)

  useEffect(() => {
    let cancelado = false
    proLaboreApi.copiloto.chat().then(r => { if (!cancelado) { setMsgs(r.mensagens); setIaLigada(r.iaLigada) } }).catch(e => { if (!cancelado) setAviso((e as Error).message) })
    return () => { cancelado = true }
  }, [])
  useEffect(() => { fim.current?.scrollIntoView({ block: 'nearest' }) }, [msgs])

  async function enviar(t: string) {
    const conteudo = t.trim()
    if (!conteudo || enviando) return
    setEnviando(true); setAviso(''); setTexto('')
    seq.current += 1
    const temporaria: CpMensagem = { id: `tmp-${seq.current}`, autor: 'USUARIO', texto: conteudo, origem: null, criadoEm: '' }
    setMsgs(m => [...(m ?? []), temporaria])
    try {
      const r = await proLaboreApi.copiloto.enviarChat(conteudo)
      setMsgs(m => [...(m ?? []), r.mensagem])
      if (r.lembrados.length) setAviso(`Guardado na memória: ${r.lembrados.join(' · ')}`)
    } catch (e) { setAviso((e as Error).message); setTexto(conteudo) } finally { setEnviando(false) }
  }

  return (
    <section className="cp-card cp-chat" aria-label="Conversa com o copiloto">
      <div>
        <h2>Converse com o seu copiloto</h2>
        <p className="cp-sub">Pergunte sobre os seus números, peça uma mensagem para um cliente, uma técnica ou um plano. {iaLigada ? 'Ele responde com base na sua produção e no que já aprendeu com você.' : 'A conversa livre usa a IA, que não está ligada; mesmo assim, "lembre que ..." funciona.'}</p>
      </div>
      <div className="cp-chat-thread" aria-live="polite">
        {msgs == null ? <p className="pl-hint">Carregando…</p> : msgs.length === 0 ? <p className="cp-legenda">Oi, {nome}! Comece por uma das sugestões abaixo ou escreva o que precisar.</p>
          : msgs.map(m => <div key={m.id} className={`cp-chat-msg ${m.autor === 'USUARIO' ? 'usuario' : 'copiloto'}`}>{m.texto}</div>)}
        {enviando && <span className="cp-escrevendo">O copiloto está pensando…</span>}
        <div ref={fim} />
      </div>
      {aviso && <div className="pl-alert pl-alert-success" role="status">{aviso}</div>}
      {!somenteLeitura && (
        <>
          <div className="cp-sugestoes-chat">{SUGESTOES.map(s => <button key={s} type="button" className="pl-chip" onClick={() => enviar(s)} disabled={enviando}>{s}</button>)}</div>
          <form className="cp-chat-form" onSubmit={e => { e.preventDefault(); enviar(texto) }}>
            <textarea className="pl-input" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escreva para o copiloto…" maxLength={1500} aria-label="Mensagem para o copiloto"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(texto) } }} />
            <button type="submit" className="pl-btn pl-btn-primary" disabled={enviando || !texto.trim()}>Enviar</button>
          </form>
        </>
      )}
    </section>
  )
}
