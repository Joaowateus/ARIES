'use client'

// Assistente da aba (seção 16, protótipo Assistente.html): componente único,
// parametrizado pela aba. Avatar "A", rótulo, a frase do momento, Recolher /
// Abrir (estado salvo por pessoa e por aba), as 3 sugestões do motor de
// insights e a linha "Pergunte:". Ação executada: o cartão fica verde com
// "Feito · desfazer em 5s". Com a IA ligada (seção 16.3), a frase vem
// redigida por ela (mesmos números) e a conversa aceita perguntas livres.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { proLaboreApi, type SmAbaAssistente, type SmAssistente, type SmRespostaAssistente, type SmTipoInsight } from '@/lib/proLaboreApi'
import { Chip, type Tom } from './componentes'
import { useToast } from './Toast'

const TOM: Record<SmTipoInsight, Tom> = { URGENTE: 'bad', ATENCAO: 'warn', OPORTUNIDADE: 'info', PONTO_FORTE: 'ok', APRENDIZADO: 'learn', OBSERVACAO: 'neutro' }
const CONFIANCA = { alta: 'Confiança alta', media: 'Confiança média', baixa: 'Confiança baixa', hipotese: 'Hipótese' } as const
const DESFAZER_MS = 5000

function textoConfianca(c: SmAssistente['sugestoes'][number]): string {
  return c.confianca === 'hipotese'
    ? `Hipótese · confiança baixa${c.amostraTexto ? ` (${c.amostraTexto})` : ''}`
    : `${CONFIANCA[c.confianca]}${c.amostraTexto ? ` · ${c.amostraTexto}` : ''}`
}

export function AssistenteAba({ aba, aoMudar }: { aba: SmAbaAssistente; aoMudar?: () => void }) {
  const toast = useToast()
  const router = useRouter()
  const [dados, setDados] = useState<SmAssistente | null>(null)
  const [fraseIA, setFraseIA] = useState<string | null>(null)
  const [recolhido, setRecolhido] = useState(false)
  const [pergunta, setPergunta] = useState<{ texto: string; id: string } | null>(null)
  const [feitos, setFeitos] = useState<Record<string, { acaoId?: string; mensagem: string }>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
  const timers = useRef<number[]>([])

  const carregar = useCallback(() => {
    proLaboreApi.sm.assistente.ver(aba)
      .then(d => {
        setDados(d); setRecolhido(d.recolhido); setFraseIA(d.fraseIA)
        // Frase da IA ainda não redigida para estes números: pede sem travar a tela.
        if (d.ia && !d.fraseIA) proLaboreApi.sm.assistente.frase(aba).then(f => { if (f.frase) setFraseIA(f.frase) }).catch(() => undefined)
      })
      .catch(() => setDados(null))
  }, [aba])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)) }, [])

  if (!dados) return null

  function alternar() {
    const novo = !recolhido
    setRecolhido(novo)
    proLaboreApi.sm.assistente.recolher(aba, novo).catch(() => undefined)
  }

  async function agir(chave: string) {
    setOcupado(chave)
    try {
      const r = await proLaboreApi.sm.assistente.executar(aba, chave)
      if (r.href) { router.push(r.href); return }
      setFeitos(f => ({ ...f, [chave]: { acaoId: r.desfazivel ? r.acaoId : undefined, mensagem: r.mensagem } }))
      aoMudar?.()
      // Passado o tempo de desfazer, a sugestão sai e entra a próxima.
      timers.current.push(window.setTimeout(() => { setFeitos(f => { const n = { ...f }; delete n[chave]; return n }); carregar() }, DESFAZER_MS))
    } catch (e) {
      toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível fazer agora', tom: 'bad' })
      carregar()
    } finally { setOcupado(null) }
  }

  async function desfazer(chave: string) {
    const f = feitos[chave]
    if (!f?.acaoId) return
    try {
      await proLaboreApi.sm.assistente.desfazer(f.acaoId)
      setFeitos(x => { const n = { ...x }; delete n[chave]; return n })
      toast({ mensagem: 'Desfeito.' })
      aoMudar?.()
      carregar()
    } catch (e) { toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível desfazer', tom: 'bad' }) }
  }

  const aberto = !recolhido
  return (
    <section className={`sm-assist${aberto ? '' : ' recolhido'}`} aria-label="Assistente">
      <div className="sm-assist-cab">
        <div className="sm-assist-avatar" aria-hidden="true">A</div>
        <div className="sm-assist-texto">
          <span className="sm-mono">{dados.rotulo}</span>
          <span className="sm-assist-frase">{fraseIA ?? dados.frase}</span>
        </div>
        <button type="button" className="sm-assist-alternar" aria-expanded={aberto} onClick={alternar}>{aberto ? 'Recolher' : 'Abrir'}</button>
      </div>
      {aberto && (
        dados.sugestoes.length === 0
          ? <p className="sm-legenda" style={{ margin: 0 }}>Nada pendente por aqui. As sugestões aparecem quando os dados pedirem.</p>
          : (
            <div className="sm-assist-grade">
              {dados.sugestoes.map(s => {
                const feito = feitos[s.chave]
                return (
                  <div key={s.chave} className={`sm-assist-card${feito ? ' feito' : ''}`}>
                    <Chip tom={TOM[s.tipo]}>{s.rotulo}</Chip>
                    <span className="sm-assist-card-texto">{feito ? feito.mensagem : s.texto}</span>
                    {!feito && <span className="sm-assist-conf">{textoConfianca(s)}</span>}
                    {feito
                      ? (
                        <span className="sm-assist-feito" role="status">
                          Feito{feito.acaoId ? ' · desfazer em 5s' : ''}
                          {feito.acaoId && <button type="button" className="sm-link-botao" onClick={() => desfazer(s.chave)}>Desfazer</button>}
                        </span>
                      )
                      : s.acao && !dados.somenteLeitura && (
                        <button type="button" className="sm-assist-acao" disabled={ocupado === s.chave} onClick={() => agir(s.chave)}>
                          {ocupado === s.chave ? 'Fazendo…' : s.acao.rotulo}
                        </button>
                      )}
                  </div>
                )
              })}
            </div>
          )
      )}
      {aberto && dados.perguntas.length > 0 && (
        <div className="sm-assist-perguntas" role="group" aria-label="Perguntas sugeridas">
          <span className="sm-assist-pergunte">Pergunte:</span>
          {dados.perguntas.map(q => (
            <button key={q.id} type="button" className="sm-assist-pergunta" aria-pressed={pergunta?.id === q.id} onClick={() => setPergunta({ texto: q.texto, id: q.id })}>{q.texto}</button>
          ))}
        </div>
      )}
      {aberto && pergunta && <ConversaAssistente key={pergunta.id} aba={aba} inicial={pergunta} livre={dados.ia} aoFechar={() => setPergunta(null)} />}
    </section>
  )
}

type Turno = { pergunta: string; resposta: SmRespostaAssistente | null; erro?: string }

/** Conversa com o assistente (seção 16.3): abre já com a pergunta clicada. */
function ConversaAssistente({ aba, inicial, livre, aoFechar }: { aba: SmAbaAssistente; inicial: { texto: string; id: string }; livre: boolean; aoFechar: () => void }) {
  const router = useRouter()
  // A conversa já abre com a pergunta clicada, esperando a resposta.
  const [turnos, setTurnos] = useState<Turno[]>(() => [{ pergunta: inicial.texto, resposta: null }])
  const [texto, setTexto] = useState('')
  const enviado = useRef(false)
  const caixa = useRef<HTMLDivElement>(null)

  /** Pede a resposta; o turno pendente já está na tela. */
  const responder = useCallback((p: string, id: string | null, anteriores: Turno[]) => {
    const historico = anteriores.filter(t => t.resposta).map(t => ({ pergunta: t.pergunta, resposta: t.resposta!.resposta }))
    proLaboreApi.sm.assistente.perguntar(aba, { pergunta: p, perguntaId: id, historico })
      .then(r => setTurnos([...anteriores, { pergunta: p, resposta: r }]))
      .catch(e => setTurnos([...anteriores, { pergunta: p, resposta: null, erro: e instanceof Error ? e.message : 'Não foi possível responder agora' }]))
  }, [aba])

  useEffect(() => {
    if (enviado.current) return
    enviado.current = true
    responder(inicial.texto, inicial.id, [])
    caixa.current?.focus()
  }, [inicial, responder])

  function perguntar(p: string) {
    const anteriores = turnos
    setTurnos([...anteriores, { pergunta: p, resposta: null }])
    responder(p, null, anteriores)
  }

  const esperando = turnos.some(t => !t.resposta && !t.erro)
  return (
    <div className="sm-assist-conversa" ref={caixa} tabIndex={-1} aria-label="Conversa com o assistente">
      <div className="sm-assist-conversa-cab">
        <span className="sm-mono">Conversa com o assistente</span>
        <button type="button" className="sm-link-botao" onClick={aoFechar}>Fechar</button>
      </div>
      <div role="log" aria-live="polite" className="sm-assist-turnos">
        {turnos.map((t, i) => (
          <div key={i} className="sm-assist-turno">
            <p className="sm-assist-q">{t.pergunta}</p>
            {t.erro
              ? <p className="sm-assist-r erro">{t.erro}</p>
              : !t.resposta
                ? <p className="sm-assist-r carregando">Pensando…</p>
                : (
                  <div className="sm-assist-r">
                    <p>{t.resposta.resposta}</p>
                    {t.resposta.acao && <button type="button" className="sm-assist-acao" onClick={() => router.push(t.resposta!.acao!.href)}>{t.resposta.acao.rotulo}</button>}
                    <span className="sm-assist-fonte">{t.resposta.ia ? 'Escrito pela IA com os números do sistema.' : 'Resposta montada com os números do sistema.'}</span>
                  </div>
                )}
          </div>
        ))}
      </div>
      {livre
        ? (
          <form className="sm-assist-form" onSubmit={e => { e.preventDefault(); const p = texto.trim(); if (p.length < 2 || esperando) return; setTexto(''); perguntar(p) }}>
            <label className="sm-sr" htmlFor={`pergunta-${aba}`}>Pergunte outra coisa</label>
            <input id={`pergunta-${aba}`} className="sm-input" value={texto} maxLength={400} placeholder="Pergunte outra coisa sobre esta aba…" onChange={e => setTexto(e.target.value)} />
            <button type="submit" className="sm-assist-acao" disabled={esperando || texto.trim().length < 2}>Perguntar</button>
          </form>
        )
        : <span className="sm-assist-fonte">Perguntas livres chegam quando a IA estiver ligada.</span>}
    </div>
  )
}
