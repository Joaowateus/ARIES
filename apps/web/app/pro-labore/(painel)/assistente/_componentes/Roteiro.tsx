'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { proLaboreApi, type AssistenteComercial, type ConfigRoteiroAssistente, type ContatoIgnoradoAssistente, type EstadoRoteiroAssistente, type PerguntaRoteiroAssistente, type SimulacaoAssistente } from '@/lib/proLaboreApi'
import { CAMPOS_LEAD, RESULTADO, fmtTelefone, tempoRelativo } from './util'

const MAX_PERGUNTAS = 10

function Interruptor({ ligado, onChange, titulo, descricao }: { ligado: boolean; onChange: (v: boolean) => void; titulo: string; descricao: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} className={`pl-as-switch linha ${ligado ? 'on' : ''}`} onClick={() => onChange(!ligado)}>
      <span className="pl-as-switch-trilho" aria-hidden="true"><span /></span>
      <span><b>{titulo}</b><small>{descricao}</small></span>
    </button>
  )
}

function Campo({ rotulo, dica, children }: { rotulo: string; dica?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="pl-field pl-as-campo">
      <span>{rotulo}</span>
      {children}
      {dica && <small className="pl-hint">{dica}</small>}
    </label>
  )
}

const linhas = (v: string) => v.split('\n').map(s => s.trim()).filter(Boolean)

export function Roteiro({ vendedorId, salva, padrao, nomeVendedor, onSalvo }: {
  vendedorId?: string
  salva: ConfigRoteiroAssistente
  padrao: ConfigRoteiroAssistente
  nomeVendedor: string
  onSalvo: (a: AssistenteComercial) => void
}) {
  const [rascunho, setRascunho] = useState<ConfigRoteiroAssistente>(salva)
  const [base, setBase] = useState<ConfigRoteiroAssistente>(salva)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  // Opções e frases ficam como texto livre enquanto edita (senão a linha
  // em branco some no meio da digitação).
  const [textoOpcoes, setTextoOpcoes] = useState<Record<string, string>>(() => Object.fromEntries(salva.perguntas.map(p => [p.id, (p.opcoes ?? []).join('\n')])))
  const [textoGatilhos, setTextoGatilhos] = useState(salva.gatilhos.join('\n'))

  const alterado = JSON.stringify(rascunho) !== JSON.stringify(base)
  const mudar = <K extends keyof ConfigRoteiroAssistente>(k: K, v: ConfigRoteiroAssistente[K]) => { setRascunho(r => ({ ...r, [k]: v })); setOk(false) }
  const mudarPergunta = (i: number, parcial: Partial<PerguntaRoteiroAssistente>) => mudar('perguntas', rascunho.perguntas.map((p, j) => (j === i ? { ...p, ...parcial } : p)))
  const mover = (i: number, d: -1 | 1) => {
    const ps = [...rascunho.perguntas]
    const [p] = ps.splice(i, 1)
    ps.splice(i + d, 0, p)
    mudar('perguntas', ps)
  }
  const adicionar = () => {
    const id = `p${Date.now().toString(36)}`
    mudar('perguntas', [...rascunho.perguntas, { id, rotulo: '', texto: '', campo: 'outro' }])
  }

  function carregar(c: ConfigRoteiroAssistente) {
    setRascunho(c)
    setTextoOpcoes(Object.fromEntries(c.perguntas.map(p => [p.id, (p.opcoes ?? []).join('\n')])))
    setTextoGatilhos(c.gatilhos.join('\n'))
  }

  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      const a = await proLaboreApi.assistente.salvar({ vendedorId, configuracao: rascunho })
      setBase(a.configuracao)
      carregar(a.configuracao)
      setOk(true)
      onSalvo(a)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="pl-as-roteiro">
      <div className="pl-as-roteiro-editor">
        <section className="pl-card">
          <div className="pl-card-title">Apresentação</div>
          <div className="pl-card-sub" style={{ marginBottom: 14 }}>A primeira mensagem vai junto com a primeira pergunta, num balão só.</div>
          <Campo rotulo="Nome da empresa (opcional)" dica="Entra no lugar de “{ da empresa}” — fica “assistente virtual de Ana da MM Negócios”.">
            <input className="pl-input" value={rascunho.nomeEmpresa} maxLength={80} onChange={e => mudar('nomeEmpresa', e.target.value)} placeholder="Ex.: MM Negócios Veículos" />
          </Campo>
          <Campo rotulo="Boas-vindas" dica={<>Use <code>{'{nome}'}</code> (primeiro nome do contato — some se ele não tiver nome no perfil), <code>{'{vendedor}'}</code> e <code>{'{ da empresa}'}</code>. Deixar claro que é um assistente evita constrangimento.</>}>
            <textarea className="pl-input pl-textarea" rows={3} value={rascunho.mensagemBoasVindas} onChange={e => mudar('mensagemBoasVindas', e.target.value)} />
          </Campo>
        </section>

        <section className="pl-card">
          <div className="pl-as-card-head">
            <div>
              <div className="pl-card-title">Perguntas de qualificação</div>
              <div className="pl-card-sub">Uma por vez, na ordem. Roteiro curto (3–5 perguntas) é o que mais leva o lead até o fim.</div>
            </div>
            <span className="pl-as-contador">{rascunho.perguntas.length}/{MAX_PERGUNTAS}</span>
          </div>
          <div className="pl-as-perguntas">
            {rascunho.perguntas.map((p, i) => (
              <div key={p.id} className="pl-as-pergunta">
                <div className="pl-as-pergunta-topo">
                  <span className="pl-sv-num">{String(i + 1).padStart(2, '0')}</span>
                  <input className="pl-input" aria-label={`Nome curto da pergunta ${i + 1}`} placeholder="Nome curto (ex.: Forma de pagamento)" value={p.rotulo} maxLength={60} onChange={e => mudarPergunta(i, { rotulo: e.target.value })} />
                  <div className="pl-as-pergunta-botoes">
                    <button type="button" className="pl-btn pl-btn-ghost" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir pergunta">↑</button>
                    <button type="button" className="pl-btn pl-btn-ghost" disabled={i === rascunho.perguntas.length - 1} onClick={() => mover(i, 1)} aria-label="Descer pergunta">↓</button>
                    <button type="button" className="pl-btn pl-btn-ghost pl-as-perigo" onClick={() => mudar('perguntas', rascunho.perguntas.filter((_, j) => j !== i))} aria-label="Remover pergunta">✕</button>
                  </div>
                </div>
                <textarea className="pl-input pl-textarea" rows={2} placeholder="Texto que o lead recebe" value={p.texto} onChange={e => mudarPergunta(i, { texto: e.target.value })} aria-label={`Texto da pergunta ${i + 1}`} />
                <div className="pl-as-pergunta-extra">
                  <Campo rotulo="Onde a resposta vai no CRM">
                    <select className="pl-input" value={p.campo} onChange={e => mudarPergunta(i, { campo: e.target.value as PerguntaRoteiroAssistente['campo'] })}>
                      {CAMPOS_LEAD.map(c => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
                    </select>
                  </Campo>
                  <Campo rotulo="Opções de resposta (opcional, uma por linha)" dica="O lead pode responder com o número da opção.">
                    <textarea
                      className="pl-input pl-textarea"
                      rows={2}
                      value={textoOpcoes[p.id] ?? ''}
                      onChange={e => {
                        setTextoOpcoes(t => ({ ...t, [p.id]: e.target.value }))
                        const ops = linhas(e.target.value).slice(0, 9)
                        mudarPergunta(i, { opcoes: ops.length ? ops : undefined })
                      }}
                    />
                  </Campo>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="pl-btn pl-btn-ghost" style={{ marginTop: 12 }} disabled={rascunho.perguntas.length >= MAX_PERGUNTAS} onClick={adicionar}>+ Adicionar pergunta</button>
        </section>

        <section className="pl-card">
          <div className="pl-card-title">Mensagens de encerramento</div>
          <div className="pl-card-sub" style={{ marginBottom: 14 }}>Todas aceitam <code>{'{nome}'}</code> e <code>{'{vendedor}'}</code>.</div>
          <Campo rotulo="Quando o lead responde todas as perguntas">
            <textarea className="pl-input pl-textarea" rows={2} value={rascunho.mensagemEncerramento} onChange={e => mudar('mensagemEncerramento', e.target.value)} />
          </Campo>
          <Campo rotulo="Quando o lead pede pra falar com uma pessoa" dica="Reconhece “atendente”, “falar com o vendedor”, “me liga”… A conversa passa na hora pro vendedor.">
            <textarea className="pl-input pl-textarea" rows={2} value={rascunho.mensagemAtendente} onChange={e => mudar('mensagemAtendente', e.target.value)} />
          </Campo>
          <Campo rotulo="Quando o lead pede pra parar" dica="Reconhece “parar”, “sair”, “não tenho interesse”… O assistente não escreve mais pra esse número.">
            <textarea className="pl-input pl-textarea" rows={2} value={rascunho.mensagemDespedida} onChange={e => mudar('mensagemDespedida', e.target.value)} />
          </Campo>
        </section>

        <section className="pl-card">
          <div className="pl-card-title">Quem o assistente atende</div>
          <div className="pl-card-sub" style={{ marginBottom: 14 }}>
            Ele nunca responde grupos, contatos com quem {nomeVendedor} já conversa, nem conversas que {nomeVendedor} assumiu.
          </div>
          <div className="pl-as-regras">
            <Interruptor
              ligado={rascunho.responderContatosNovos}
              onChange={v => mudar('responderContatosNovos', v)}
              titulo="Responder também contatos novos sem sinal de campanha"
              descricao="Quem chama pela primeira vez sem vir de anúncio nem usar uma frase abaixo (ex.: achou o número no Instagram). Desligado = só anúncio e frases."
            />
            <Interruptor ligado={rascunho.criarLeadNoCrm} onChange={v => mudar('criarLeadNoCrm', v)} titulo="Criar o lead no CRM ao fim do roteiro" descricao="Com as respostas nas observações. Se já existir lead aberto com o mesmo telefone, liga a conversa a ele." />
            <Interruptor ligado={rascunho.avisarVendedor} onChange={v => mudar('avisarVendedor', v)} titulo="Avisar o vendedor no WhatsApp" descricao="Manda o resumo no chat “Você” do próprio vendedor quando um lead fica pronto." />
          </div>
          <Campo rotulo="Frases de campanha (uma por linha)" dica="Se a primeira mensagem contém uma delas, o assistente atende mesmo que o contato não seja novo. Use o texto pronto dos seus anúncios e links.">
            <textarea
              className="pl-input pl-textarea"
              rows={4}
              value={textoGatilhos}
              onChange={e => { setTextoGatilhos(e.target.value); mudar('gatilhos', linhas(e.target.value)) }}
            />
          </Campo>
          <Campo rotulo={`Pausa de “digitando…” antes de cada resposta: ${rascunho.atrasoSegundos}s`} dica="Resposta instantânea parece robô e aumenta o risco de bloqueio. 2–4s é o equilíbrio.">
            <input type="range" min={0} max={10} step={1} value={rascunho.atrasoSegundos} onChange={e => mudar('atrasoSegundos', Number(e.target.value))} />
          </Campo>
          <ContatosIgnorados vendedorId={vendedorId} />
        </section>

        <div className={`pl-as-salvar ${alterado ? 'visivel' : ''}`}>
          {erro ? <div className="pl-alert pl-alert-error" style={{ margin: 0, flex: 1 }}>{erro}</div> : <span>{alterado ? 'Alterações não salvas — o simulador já usa a versão da tela.' : ok ? 'Roteiro salvo ✓' : 'Roteiro salvo'}</span>}
          <button type="button" className="pl-btn pl-btn-ghost" onClick={() => carregar(padrao)}>Restaurar padrão</button>
          <button type="button" className="pl-btn pl-btn-ghost" disabled={!alterado} onClick={() => { carregar(base); setErro('') }}>Descartar</button>
          <button type="button" className="pl-btn pl-btn-primary" disabled={!alterado || salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar roteiro'}</button>
        </div>
      </div>

      <Simulador vendedorId={vendedorId} configuracao={rascunho} nomeVendedor={nomeVendedor} />
    </div>
  )
}

function ContatosIgnorados({ vendedorId }: { vendedorId?: string }) {
  const [aberto, setAberto] = useState(false)
  const [itens, setItens] = useState<ContatoIgnoradoAssistente[] | null>(null)
  useEffect(() => {
    if (!aberto) return
    let cancelado = false
    proLaboreApi.assistente.ignorados(vendedorId).then(r => { if (!cancelado) setItens(r) }).catch(() => { if (!cancelado) setItens([]) })
    return () => { cancelado = true }
  }, [aberto, vendedorId])
  async function remover(id: string) {
    await proLaboreApi.assistente.removerIgnorado(id)
    setItens(l => l?.filter(i => i.id !== id) ?? null)
  }
  return (
    <details className="pl-as-ignorados" onToggle={e => setAberto((e.target as HTMLDetailsElement).open)}>
      <summary>Números que o assistente nunca responde</summary>
      <div className="pl-hint" style={{ fontSize: 12, margin: '8px 0' }}>
        Entram aqui sozinhos quando {`o vendedor`} manda mensagem pra alguém que não é lead (conversa pessoal — só o número é guardado) ou quando alguém é marcado como “não é lead”.
      </div>
      {!itens ? <div className="pl-hint">Carregando…</div> : itens.length === 0 ? <div className="pl-hint">Nenhum número na lista.</div> : (
        <ul className="pl-as-ignorados-lista">
          {itens.map(i => (
            <li key={i.id}>
              <span className="pl-mono">{fmtTelefone(i.numero)}</span>
              <small>{i.motivo === 'CONVERSA_PESSOAL' ? 'conversa pessoal' : 'marcado como não é lead'} · {tempoRelativo(i.criadoEm)}</small>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={() => remover(i.id)}>Liberar</button>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}

interface MsgSimulada { de: 'contato' | 'assistente'; texto: string }

function Simulador({ vendedorId, configuracao, nomeVendedor }: { vendedorId?: string; configuracao: ConfigRoteiroAssistente; nomeVendedor: string }) {
  const [mensagens, setMensagens] = useState<MsgSimulada[]>([])
  const [estado, setEstado] = useState<EstadoRoteiroAssistente | null>(null)
  const [final, setFinal] = useState<SimulacaoAssistente | null>(null)
  const [gatilho, setGatilho] = useState<string | null | undefined>(undefined)
  const [texto, setTexto] = useState('')
  const [nome, setNome] = useState('Ana Paula')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = fimRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [mensagens.length])

  function recomecar() {
    setMensagens([]); setEstado(null); setFinal(null); setGatilho(undefined); setErro('')
  }

  async function enviar() {
    const t = texto.trim()
    if (!t || final) return
    setEnviando(true)
    setErro('')
    setMensagens(m => [...m, { de: 'contato', texto: t }])
    setTexto('')
    try {
      const r = await proLaboreApi.assistente.simular({ vendedorId, configuracao, estado, texto: t, nomeContato: nome })
      if (estado === null) setGatilho(r.gatilho)
      setMensagens(m => [...m, ...r.mensagens.map(x => ({ de: 'assistente' as const, texto: x }))])
      setEstado(r.estado)
      if (r.desfecho) setFinal(r)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <aside className="pl-card pl-as-simulador">
      <div className="pl-as-card-head">
        <div>
          <div className="pl-card-title">Testar roteiro</div>
          <div className="pl-card-sub">Converse como se fosse um lead. Nada é enviado nem salvo.</div>
        </div>
        <button type="button" className="pl-btn pl-btn-ghost" onClick={recomecar} disabled={mensagens.length === 0}>Recomeçar</button>
      </div>
      <label className="pl-as-sim-nome">
        <span>Nome no perfil do lead</span>
        <input className="pl-input" value={nome} onChange={e => setNome(e.target.value)} disabled={mensagens.length > 0} />
      </label>
      <div className="pl-as-sim-tela" ref={fimRef}>
        {mensagens.length === 0 && (
          <div className="pl-as-sim-vazio">
            Mande a primeira mensagem como um lead mandaria — por exemplo <button type="button" className="pl-as-sugestao" onClick={() => setTexto('Oi, vi o anúncio. Ainda tem disponível?')}>“Oi, vi o anúncio. Ainda tem disponível?”</button>
          </div>
        )}
        {mensagens.map((m, i) => (
          <Fragment key={i}>
            <div className={`pl-as-bolha-linha ${m.de === 'assistente' ? 'direita' : ''}`}>
              <div className={`pl-as-bolha ${m.de}`}>
                <div className="pl-as-bolha-texto">{m.texto}</div>
              </div>
            </div>
            {i === 0 && gatilho !== undefined && (
              <div className="pl-as-sim-nota">
                {gatilho ? <>Frase de campanha reconhecida: “{gatilho}” — no WhatsApp real o assistente atenderia mesmo contato antigo.</> : 'Sem frase de campanha: no WhatsApp real ele só atende se vier de anúncio ou for um contato novo.'}
              </div>
            )}
          </Fragment>
        ))}
        {enviando && <div className="pl-as-bolha-linha direita"><div className="pl-as-bolha assistente pl-as-digitando" aria-label="digitando"><span /><span /><span /></div></div>}
      </div>
      {final && (
        <div className="pl-as-sim-final">
          <b>{final.desfecho ? RESULTADO[final.desfecho] : ''}</b>
          {final.desfecho !== 'DESISTIU'
            ? <span>No WhatsApp real: {configuracao.criarLeadNoCrm ? 'lead criado no CRM' : 'lead não vai pro CRM (desligado)'}{configuracao.avisarVendedor ? ` e ${nomeVendedor} avisado com este resumo:` : '.'}</span>
            : <span>Conversa encerrada, sem lead no CRM.</span>}
          {final.resumo.length > 0 && (
            <dl className="pl-as-dl">
              {final.resumo.map(l => <Fragment key={l.rotulo}><dt>{l.rotulo}</dt><dd>{l.valor}</dd></Fragment>)}
            </dl>
          )}
        </div>
      )}
      {erro && <div className="pl-alert pl-alert-error">{erro}</div>}
      <form className="pl-as-composer" onSubmit={e => { e.preventDefault(); enviar() }}>
        <input className="pl-input" placeholder={final ? 'Roteiro concluído — clique em Recomeçar' : 'Mensagem do lead…'} value={texto} disabled={!!final || enviando} onChange={e => setTexto(e.target.value)} aria-label="Mensagem do lead no simulador" />
        <button type="submit" className="pl-btn pl-btn-primary" disabled={!texto.trim() || !!final || enviando}>Enviar</button>
      </form>
    </aside>
  )
}
