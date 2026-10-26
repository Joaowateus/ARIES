'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { proLaboreApi, type CpConteudo, type CpConversa, type CpConversaItem, type CpSugestao } from '@/lib/proLaboreApi'
import { ESTAGIO, espera } from './rotulos'

const REMETENTE: Record<string, string> = { CONTATO: 'Cliente', VENDEDOR: 'Vendedor', ASSISTENTE: 'Assistente automático' }

export function Conversas({ pessoa, inicial, somenteLeitura }: { pessoa?: string; inicial: string | null; somenteLeitura: boolean }) {
  const [lista, setLista] = useState<{ conectado: boolean; itens: CpConversaItem[] } | null>(null)
  const [selecionada, setSelecionada] = useState<string | null>(inicial)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let cancelado = false
    const carregar = () => proLaboreApi.copiloto.conversas(pessoa).then(l => { if (!cancelado) setLista(l) }).catch(e => { if (!cancelado) setErro((e as Error).message) })
    carregar()
    const id = setInterval(() => { if (!document.hidden) carregar() }, 30_000)
    return () => { cancelado = true; clearInterval(id) }
  }, [pessoa])

  if (erro) return <div className="pl-alert pl-alert-error">{erro}</div>
  if (!lista) return <div className="pl-hint">Carregando as conversas…</div>
  if (!lista.itens.length) {
    return (
      <div className="cp-card pl-empty">
        <div className="pl-emoji">💬</div>
        <h3>{lista.conectado ? 'Nenhuma conversa de lead pedindo atenção' : 'O WhatsApp ainda não está ligado ao sistema'}</h3>
        <p className="cp-sub">{lista.conectado
          ? 'Quando um lead chamar e o assistente passar a conversa para você, ela aparece aqui com a sugestão de resposta.'
          : 'O copiloto lê as conversas de lead que passam pelo Assistente Comercial. Conversas pessoais nunca são lidas.'}</p>
        {!lista.conectado && <p style={{ marginTop: 10 }}><Link className="pl-btn pl-btn-ghost" href="/pro-labore/assistente">Conectar o WhatsApp no Assistente Comercial</Link></p>}
      </div>
    )
  }
  const atual = selecionada && lista.itens.some(i => i.id === selecionada) ? selecionada : lista.itens[0].id
  return (
    <div className="cp-conv">
      <div className="cp-conv-lista" role="list" aria-label="Conversas de lead">
        {lista.itens.map(c => (
          <button key={c.id} type="button" role="listitem" className={`cp-conv-item ${c.id === atual ? 'ativa' : ''}`} onClick={() => setSelecionada(c.id)}>
            <b>{c.nome}{c.vendedor ? ` · ${c.vendedor}` : ''}</b>
            {c.ultima && <p>{REMETENTE[c.ultima.remetente] ?? c.ultima.remetente}: {c.ultima.texto}</p>}
            <span className="cp-legenda">
              {c.esperando ? <span className="cp-selo erro">Esperando há {espera(c.esperaMin)}</span> : <span className="cp-selo">Em dia</span>}
              {c.estagio && <span>{ESTAGIO[c.estagio] ?? c.estagio}</span>}
              {c.modelo && <span>· {c.modelo}</span>}
            </span>
          </button>
        ))}
      </div>
      <Detalhe key={atual} id={atual} pessoa={pessoa} somenteLeitura={somenteLeitura} />
    </div>
  )
}

function Detalhe({ id, pessoa, somenteLeitura }: { id: string; pessoa?: string; somenteLeitura: boolean }) {
  const [conv, setConv] = useState<CpConversa | null>(null)
  const [sugestao, setSugestao] = useState<CpSugestao | null>(null)
  const [conteudos, setConteudos] = useState<CpConteudo[]>([])
  const [textos, setTextos] = useState<string[]>([])
  const [gerando, setGerando] = useState(false)
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    let cancelado = false
    proLaboreApi.copiloto.conversa(id, pessoa).then(c => {
      if (cancelado) return
      setConv(c); setConteudos(c.conteudos)
      // Sugestão de hoje para esta conversa, se já houver.
      if (c.sugestao && Date.now() - new Date(c.sugestao.criadoEm).getTime() < 6 * 3600e3) { setSugestao(c.sugestao); setTextos(c.sugestao.conteudo.opcoes.map(o => o.texto)) }
    }).catch(e => { if (!cancelado) setAviso({ tom: 'erro', texto: (e as Error).message }) })
    return () => { cancelado = true }
  }, [id, pessoa])

  async function sugerir() {
    setGerando(true); setAviso(null)
    try {
      const s = await proLaboreApi.copiloto.sugerir(id, pessoa)
      setSugestao(s); setConteudos(s.conteudos); setTextos(s.conteudo.opcoes.map(o => o.texto))
    } catch (e) { setAviso({ tom: 'erro', texto: (e as Error).message }) } finally { setGerando(false) }
  }
  async function copiar(i: number) {
    await navigator.clipboard?.writeText(textos[i]).catch(() => undefined)
    if (sugestao) await proLaboreApi.copiloto.usarSugestao(sugestao.id, i, textos[i] !== sugestao.conteudo.opcoes[i].texto).catch(() => undefined)
    setAviso({ tom: 'ok', texto: 'Mensagem copiada. Cole no WhatsApp.' })
  }
  async function enviar(i: number) {
    if (!conv || !sugestao) return
    if (/\[[^\]]+\]/.test(textos[i])) { setAviso({ tom: 'erro', texto: 'Preencha o que está entre colchetes (como [valor]) antes de enviar.' }); return }
    try {
      await proLaboreApi.assistente.enviar(conv.id, textos[i])
      await proLaboreApi.copiloto.usarSugestao(sugestao.id, i, textos[i] !== sugestao.conteudo.opcoes[i].texto).catch(() => undefined)
      setAviso({ tom: 'ok', texto: 'Mensagem enviada pelo WhatsApp.' })
      const c = await proLaboreApi.copiloto.conversa(id, pessoa); setConv(c)
    } catch (e) { setAviso({ tom: 'erro', texto: (e as Error).message }) }
  }

  if (!conv) return aviso ? <div className="pl-alert pl-alert-error">{aviso.texto}</div> : <div className="pl-hint">Abrindo a conversa…</div>
  const s = sugestao?.conteudo
  return (
    <div className="cp-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="cp-card-cab" style={{ marginBottom: 0 }}>
        <div>
          <h2>{conv.nome}</h2>
          <p className="cp-sub">{conv.lead ? `${ESTAGIO[conv.lead.estagio] ?? conv.lead.estagio} no CRM` : 'Ainda sem lead no CRM'}{conv.lead?.modeloInteresse ? ` · interesse em ${conv.lead.modeloInteresse}` : ''} · atendimento de {conv.vendedor}</p>
        </div>
        {!somenteLeitura && <button type="button" className="pl-btn pl-btn-primary" onClick={sugerir} disabled={gerando}>{gerando ? 'Lendo a conversa…' : s ? 'Sugerir de novo' : 'Sugerir resposta'}</button>}
      </div>

      <div className="cp-thread" aria-label="Últimas mensagens">
        {conv.mensagens.map(m => (
          <div key={m.id} className={`cp-msg ${m.remetente === 'CONTATO' ? 'cliente' : 'loja'}`}>
            {m.texto}
            <small>{REMETENTE[m.remetente] ?? m.remetente} · {new Date(m.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>
          </div>
        ))}
      </div>

      {aviso && <div className={`pl-alert ${aviso.tom === 'ok' ? 'pl-alert-success' : 'pl-alert-error'}`} role="status">{aviso.texto}</div>}

      {s && sugestao && (
        <>
          <div>
            <div className="cp-hero-meta" style={{ marginTop: 0 }}>
              <span className={`cp-selo ${sugestao.origem === 'IA' ? 'ia' : ''}`}>{sugestao.origem === 'IA' ? 'Sugestão da IA' : 'Sugestão pelas regras'}</span>
              <span className="cp-selo">Etapa: {s.etapa}</span>
            </div>
            <p className="cp-sub" style={{ color: 'var(--pl-ink-1)' }}><b>Leitura:</b> {s.leitura}</p>
            <p className="cp-sub"><b>Técnica:</b> {s.tecnica}</p>
            {s.cuidado && <p className="cp-sub"><b>Cuidado:</b> {s.cuidado}</p>}
          </div>
          {s.opcoes.map((o, i) => (
            <div key={i} className="cp-opcao">
              <span className="cp-acao-tipo">Opção {i + 1} · {o.quando}{sugestao.usadaIndice === i ? ' · usada' : ''}</span>
              <textarea className="pl-input" value={textos[i] ?? ''} onChange={e => setTextos(t => t.map((x, k) => (k === i ? e.target.value : x)))} aria-label={`Texto da opção ${i + 1}`} readOnly={somenteLeitura} />
              <div className="cp-opcao-botoes">
                <button type="button" className="pl-btn pl-btn-ghost" onClick={() => copiar(i)}>Copiar</button>
                {!somenteLeitura && conv.conectado && <button type="button" className="pl-btn pl-btn-primary" onClick={() => enviar(i)}>Enviar pelo WhatsApp</button>}
                {/\[[^\]]+\]/.test(textos[i] ?? '') && <span className="cp-legenda">Troque o que está entre colchetes pela informação real.</span>}
              </div>
            </div>
          ))}
          {!somenteLeitura && (
            <div className="cp-feedback">
              <span className="cp-legenda">As sugestões ajudaram?</span>
              <button type="button" className={`pl-chip ${sugestao.util === true ? 'active' : ''}`} onClick={() => proLaboreApi.copiloto.avaliarSugestao(sugestao.id, true).then(setSugestao).catch(() => undefined)}>Sim</button>
              <button type="button" className={`pl-chip ${sugestao.util === false ? 'active' : ''}`} onClick={() => proLaboreApi.copiloto.avaliarSugestao(sugestao.id, false).then(setSugestao).catch(() => undefined)}>Não</button>
            </div>
          )}
        </>
      )}

      {conteudos.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 8 }}>Conteúdo da loja para mandar</h3>
          {s?.conteudoPorque && <p className="cp-sub" style={{ marginBottom: 8 }}>{s.conteudoPorque}</p>}
          <div className="cp-conteudos">
            {conteudos.map(c => (
              <a key={c.id} className={`cp-conteudo ${s?.conteudoId === c.id ? 'sugerido' : ''}`} href={c.link} target="_blank" rel="noreferrer" title="Abrir no Instagram">
                {c.miniatura ? <img src={c.miniatura} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="sem" />}
                <span>{s?.conteudoId === c.id && <b>Sugerido · </b>}{c.titulo}</span>
              </a>
            ))}
          </div>
          <p className="cp-legenda" style={{ marginTop: 6 }}>Abra e use o botão de compartilhar do Instagram, ou copie o link para a conversa.</p>
        </div>
      )}
    </div>
  )
}
