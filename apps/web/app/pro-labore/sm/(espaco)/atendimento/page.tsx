'use client'

// Tela 04 · Atendimento (seção 7 · Atendimento.html): direct e comentários
// num lugar só, cada conversa com o post de origem, respostas rápidas,
// janela de 24 h, automações e "Transformar em lead" com rodízio.
import { useCallback, useEffect, useRef, useState } from 'react'
import { proLaboreApi, urlArquivoApi, type SmAtendimento, type SmConversaDetalhe } from '@/lib/proLaboreApi'
import { Banner, Botao, Card, CardEsqueleto, Chip, EstadoVazio, Modal, Rotulo, esperaDesde, useToast } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'

type Filtro = 'TODOS' | 'DIRECT' | 'COMENTARIOS'

export default function AtendimentoPage() {
  const { pode } = useEspacoSM()
  if (!pode('atendimento')) return <div className="sm-card"><EstadoVazio titulo="Sem acesso ao Atendimento">O gestor pode liberar em Equipe → Acessos e permissões.</EstadoVazio></div>
  return <Atendimento />
}

function Atendimento() {
  const toast = useToast()
  const { recarregar: recarregarMenu } = useEspacoSM()
  const [dados, setDados] = useState<SmAtendimento | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('TODOS')
  const [selId, setSelId] = useState<string | null>(null)
  const [conversa, setConversa] = useState<SmConversaDetalhe | null>(null)
  const [config, setConfig] = useState(false)

  const carregarLista = useCallback(() => {
    proLaboreApi.sm.atendimento.lista().then(d => {
      setDados(d); setErro(null)
      setSelId(id => id && d.conversas.some(c => c.id === id) ? id : d.conversas[0]?.id ?? null)
    }).catch(e => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
  }, [])
  const carregarConversa = useCallback((id: string) => {
    proLaboreApi.sm.atendimento.conversa(id).then(setConversa).catch(() => setConversa(null))
  }, [])

  useEffect(() => {
    carregarLista()
    // Mensagens chegam pelo webhook: a lista se atualiza sozinha.
    const t = setInterval(carregarLista, 20_000)
    return () => clearInterval(t)
  }, [carregarLista])
  useEffect(() => {
    if (!selId) return
    carregarConversa(selId)
    const t = setInterval(() => carregarConversa(selId), 15_000)
    return () => clearInterval(t)
  }, [selId, carregarConversa])

  function aposMudanca() {
    carregarLista()
    if (selId) carregarConversa(selId)
    recarregarMenu()
  }

  if (erro && !dados) return <div className="sm-card"><EstadoVazio titulo="Não foi possível abrir o Atendimento" acao={<Botao onClick={carregarLista}>Tentar de novo</Botao>}>{erro}</EstadoVazio></div>
  if (!dados) return <CardEsqueleto linhas={6} />

  const visiveis = dados.conversas.filter(c => filtro === 'TODOS' || (filtro === 'COMENTARIOS' ? c.canal === 'COMENTARIO' : c.canal !== 'COMENTARIO'))
  const selecionada = conversa && conversa.id === selId ? conversa : null

  return (
    <>
      <header className="sm-pagina-cab">
        <div>
          <Rotulo>Trabalho · Atendimento</Rotulo>
          <h1 className="sm-ttl sm-h1">Direct e comentários</h1>
          <p>Cada conversa já chega com o post de origem. Interesse real vira lead no CRM com um clique.</p>
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div className="sm-ttl" style={{ fontSize: 20 }}>{dados.cabecalho.tempoMedioMin != null ? `${dados.cabecalho.tempoMedioMin} min` : '—'}</div>
            <div className="sm-legenda">tempo de resposta na semana (meta ≤ {dados.metaRespostaMin} min)</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="sm-ttl" style={{ fontSize: 20 }}>{dados.cabecalho.viraramLeadSemana}</div>
            <div className="sm-legenda">viraram lead na semana</div>
          </div>
          {dados.souGestor && <Botao onClick={() => setConfig(true)}>Respostas e automações</Botao>}
        </div>
      </header>

      <div className="sm-atend">
        <section aria-label="Conversas" className="sm-card sm-atend-lista">
          <div className="sm-filtros" role="group" aria-label="Filtrar conversas">
            {([['TODOS', 'Todos', dados.contadores.todos], ['DIRECT', 'Direct', dados.contadores.direct], ['COMENTARIOS', 'Comentários', dados.contadores.comentarios]] as const).map(([v, r, n]) => (
              <button key={v} type="button" className="sm-chip" aria-pressed={filtro === v} onClick={() => setFiltro(v)}>{r} {n}</button>
            ))}
          </div>
          <div className="sm-atend-lista-itens">
            {visiveis.length === 0
              ? <EstadoVazio titulo="Nenhuma conversa">As mensagens do direct e os comentários chegam aqui assim que o Instagram avisa.</EstadoVazio>
              : visiveis.map(c => (
                <button key={c.id} type="button" className="sm-conv" aria-current={c.id === selId} onClick={() => setSelId(c.id)}
                  aria-label={`${c.nome}, ${c.canalNome}${c.aguardandoDesde ? `, esperando ${esperaDesde(c.aguardandoDesde)}` : ''}`}>
                  <span className="sm-conv-topo">
                    <b>{c.nome}</b>
                    <span className={`sm-conv-idade${c.atrasada ? ' atrasada' : ''}`}>{c.aguardandoDesde ? esperaDesde(c.aguardandoDesde).replace('há ', '') : c.status === 'LEAD' ? 'lead' : 'respondida'}</span>
                  </span>
                  <span className="sm-conv-previa">{c.ultimaDirecao === 'OUT' ? 'Você: ' : ''}{c.previa}</span>
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Chip>{c.canalNome}</Chip>
                    {c.moto && <Chip tom="info">{c.moto}</Chip>}
                    {c.status === 'LEAD' && <Chip tom="ok">Lead</Chip>}
                  </span>
                </button>
              ))}
          </div>
        </section>

        {selecionada
          ? <Conversa key={selecionada.id} c={selecionada} dados={dados} aoMudar={aposMudanca} />
          : <section className="sm-card sm-conversa" aria-label="Conversa"><EstadoVazio titulo={selId ? 'Carregando…' : 'Escolha uma conversa'}>A conversa abre aqui.</EstadoVazio></section>}

        <aside aria-label="Virar lead" className="sm-atend-lado">
          {selecionada && dados.podeCriarLead && <VirarLead key={selecionada.id} c={selecionada} aoCriar={r => { toast({ mensagem: r.consultor ? `Lead enviado ao CRM e entregue a ${r.consultor}.` : 'Lead enviado ao CRM (sem consultor ativo com login para o rodízio).' }); aposMudanca() }} />}
          <Card titulo="Automações">
            {dados.automacoes.map(a => (
              <div key={a.tipo} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span>{a.tipo === 'PALAVRA_CHAVE' ? `Comente ${a.palavra} → ficha da moto no direct` : 'Resposta fora do horário'}</span>
                  <Chip tom={a.ativa ? 'ok' : 'neutro'}>{a.ativa ? 'Ativa' : 'Desligada'}</Chip>
                </div>
                <span className="sm-legenda">
                  {a.tipo === 'PALAVRA_CHAVE'
                    ? `${a.disparosSemana} ${a.disparosSemana === 1 ? 'disparo' : 'disparos'} na semana · ${a.leadsSemana ?? 0} ${a.leadsSemana === 1 ? 'virou lead' : 'viraram lead'}`
                    : `Atendimento ${dados.expediente} · ${a.disparosSemana} ${a.disparosSemana === 1 ? 'aviso' : 'avisos'} na semana`}
                </span>
              </div>
            ))}
            <span className="sm-legenda">Automação não conta no tempo de resposta: só a primeira resposta de uma pessoa.</span>
          </Card>
        </aside>
      </div>
      {config && <ConfigAtendimento dados={dados} aoFechar={() => setConfig(false)} aoSalvar={() => { setConfig(false); carregarLista(); toast({ mensagem: 'Atendimento atualizado.' }) }} />}
    </>
  )
}

function Conversa({ c, dados, aoMudar }: { c: SmConversaDetalhe; dados: SmAtendimento; aoMudar: () => void }) {
  const toast = useToast()
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const lista = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { lista.current?.scrollTo({ top: lista.current.scrollHeight }) }, [c.mensagens.length])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    setEnviando(true)
    try {
      await proLaboreApi.sm.atendimento.responder(c.id, texto.trim())
      setTexto('')
      aoMudar()
    } catch (err) {
      toast({ mensagem: err instanceof Error ? err.message : 'Não foi possível enviar', tom: 'bad' })
    } finally { setEnviando(false) }
  }

  const fechaEm = c.janela.horasRestantes
  const podeResponder = dados.podeResponder && c.janela.aberta && c.status !== 'ARQUIVADA'
  return (
    <section aria-label="Conversa" className="sm-card sm-conversa">
      <div className="sm-conversa-cab">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="sm-ttl" style={{ fontSize: 17 }}>{c.nome}</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Chip>{c.canalNome}</Chip>
            {dados.podeResponder && c.status !== 'LEAD' && (
              <Botao variante="fantasma" onClick={async () => {
                await proLaboreApi.sm.atendimento.arquivar(c.id)
                toast({ mensagem: 'Conversa arquivada.', desfazer: async () => { await proLaboreApi.sm.atendimento.arquivar(c.id, false); aoMudar() } })
                aoMudar()
              }}>Arquivar</Botao>
            )}
          </span>
        </div>
        <div className="sm-origem">
          <div className="sm-origem-mini">{c.post.miniatura && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urlArquivoApi(c.post.miniatura)} alt="" />
          )}</div>
          <div>
            {c.post.titulo === 'Perfil (sem post)' ? <>Veio pelo <b>perfil (sem post)</b></> : <>Veio do post <b>{c.post.titulo ?? 'sem identificação'}</b></>}
            {c.post.codigo && <><br />Código {c.post.codigo}</>}
            {c.post.permalink && <> · <a href={c.post.permalink} target="_blank" rel="noreferrer">ver post</a></>}
          </div>
        </div>
      </div>
      <div className="sm-mensagens" ref={lista} aria-live="polite">
        {c.mensagens.map(m => (
          <div key={m.id} className={`sm-bolha ${m.direcao === 'IN' ? 'in' : m.autor === 'AUTOMACAO' ? 'auto' : 'out'}`}>
            {m.texto}
            <small>{new Date(m.enviadaEm).toLocaleString('pt-BR', { timeZone: 'America/Belem', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{m.autor === 'AUTOMACAO' ? ` · automação (${m.automacao === 'FORA_HORARIO' ? 'fora do horário' : 'palavra-chave'})` : ''}</small>
          </div>
        ))}
      </div>
      <div className="sm-conversa-pe">
        {!c.janela.aberta && <Banner tom="warn" titulo="Janela de 24 h fechada">A Meta só deixa responder no direct até 24 h depois da última mensagem do cliente. Quando ele escrever de novo, a janela reabre.</Banner>}
        {c.janela.aberta && fechaEm != null && fechaEm < 4 && <span className="sm-legenda" style={{ color: 'var(--sm-warn-fg)' }}>A janela de 24 h fecha em {fechaEm < 1 ? `${Math.max(1, Math.round(fechaEm * 60))} min` : `${fechaEm.toFixed(0)} h`}. Responda antes.</span>}
        {podeResponder && (
          <>
            <div className="sm-rapidas" role="group" aria-label="Respostas rápidas">
              {dados.respostasRapidas.map(r => (
                <button key={r.id} type="button" className="sm-chip" title={r.texto} onClick={() => { setTexto(r.texto); campo.current?.focus() }}>{r.titulo}</button>
              ))}
            </div>
            <form onSubmit={enviar} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <label className="sm-sr" htmlFor="resposta">Responder</label>
              <textarea id="resposta" ref={campo} className="sm-input" rows={2} style={{ minHeight: 44 }} value={texto} placeholder={c.canal === 'COMENTARIO' ? 'Responder no comentário…' : 'Escreva uma resposta…'}
                onChange={e => setTexto(e.target.value)} maxLength={1000}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit() } }} />
              <Botao type="submit" variante="pri" disabled={enviando || !texto.trim()}>{enviando ? 'Enviando…' : 'Enviar'}</Botao>
            </form>
          </>
        )}
      </div>
    </section>
  )
}

function VirarLead({ c, aoCriar }: { c: SmConversaDetalhe; aoCriar: (r: { leadId: string; consultor: string | null }) => void }) {
  const [nome, setNome] = useState(c.nome.startsWith('@') ? '' : c.nome)
  const [whatsapp, setWhatsapp] = useState('')
  const [moto, setMoto] = useState(c.moto ?? '')
  const [pagamento, setPagamento] = useState<'FINANCIAMENTO' | 'A_VISTA' | 'CONSORCIO'>('FINANCIAMENTO')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (c.leadId) {
    return <Card titulo="Transformar em lead"><Banner tom="ok" titulo="Já está no CRM">Esta conversa virou lead. O consultor acompanha pelo CRM.</Banner></Card>
  }
  return (
    <Card titulo="Transformar em lead">
      <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={async e => {
        e.preventDefault(); setEnviando(true); setErro(null)
        try { aoCriar(await proLaboreApi.sm.atendimento.criarLead(c.id, { nome, whatsapp: whatsapp || null, moto: moto || null, pagamento })) } catch (err) { setErro(err instanceof Error ? err.message : 'Não foi possível criar'); setEnviando(false) }
      }}>
        <label className="sm-campo">Nome<input className="sm-input" value={nome} onChange={e => setNome(e.target.value)} required minLength={2} maxLength={120} placeholder={c.usuario ? `@${c.usuario}` : undefined} /></label>
        <label className="sm-campo">WhatsApp<input className="sm-input" type="tel" inputMode="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(91) 9 0000-0000" /></label>
        <label className="sm-campo">Moto de interesse<input className="sm-input" value={moto} onChange={e => setMoto(e.target.value)} maxLength={120} /></label>
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <legend className="sm-legenda" style={{ marginBottom: 6 }}>Forma de pagamento</legend>
          <div className="sm-radios">
            {([['FINANCIAMENTO', 'Financiamento'], ['A_VISTA', 'À vista'], ['CONSORCIO', 'Consórcio']] as const).map(([v, r]) => (
              <label key={v}><input type="radio" name="pagamento" checked={pagamento === v} onChange={() => setPagamento(v)} /> {r}</label>
            ))}
          </div>
        </fieldset>
        <div className="sm-info-bloco">
          Origem automática: Instagram orgânico{c.post.codigo ? ` · ${c.post.codigo}` : ''}<br />
          Consultor: rodízio automático do CRM{c.proximoConsultor ? ` (próximo: ${c.proximoConsultor})` : ' (nenhum consultor ativo com login)'}
        </div>
        {erro && <p className="sm-erro" role="alert">{erro}</p>}
        <Botao type="submit" variante="pri" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar ao CRM'}</Botao>
      </form>
    </Card>
  )
}

function ConfigAtendimento({ dados, aoFechar, aoSalvar }: { dados: SmAtendimento; aoFechar: () => void; aoSalvar: () => void }) {
  const [rapidas, setRapidas] = useState(dados.respostasRapidas.map(r => ({ titulo: r.titulo, texto: r.texto })))
  const quero = dados.automacoes.find(a => a.tipo === 'PALAVRA_CHAVE')!
  const fora = dados.automacoes.find(a => a.tipo === 'FORA_HORARIO')!
  const [palavra, setPalavra] = useState(quero.palavra ?? 'QUERO')
  const [respQuero, setRespQuero] = useState(quero.resposta)
  const [ativaQuero, setAtivaQuero] = useState(quero.ativa)
  const [respFora, setRespFora] = useState(fora.resposta)
  const [ativaFora, setAtivaFora] = useState(fora.ativa)
  const [erro, setErro] = useState<string | null>(null)
  return (
    <Modal titulo="Respostas e automações" aoFechar={aoFechar}>
      <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={async e => {
        e.preventDefault(); setErro(null)
        try {
          await proLaboreApi.sm.atendimento.salvarRespostasRapidas(rapidas.filter(r => r.titulo.trim() && r.texto.trim()))
          await proLaboreApi.sm.atendimento.salvarAutomacao('PALAVRA_CHAVE', { palavra, resposta: respQuero, ativa: ativaQuero })
          await proLaboreApi.sm.atendimento.salvarAutomacao('FORA_HORARIO', { resposta: respFora, ativa: ativaFora })
          aoSalvar()
        } catch (err) { setErro(err instanceof Error ? err.message : 'Não foi possível salvar') }
      }}>
        <Rotulo>Respostas rápidas</Rotulo>
        {rapidas.map((r, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid var(--sm-divider)', paddingBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <label className="sm-campo" style={{ flex: 1 }}>Título<input className="sm-input" value={r.titulo} maxLength={40} onChange={e => setRapidas(l => l.map((x, j) => j === i ? { ...x, titulo: e.target.value } : x))} /></label>
              <Botao variante="fantasma" onClick={() => setRapidas(l => l.filter((_, j) => j !== i))}>Remover</Botao>
            </div>
            <label className="sm-campo">Texto<textarea className="sm-input" value={r.texto} maxLength={1000} onChange={e => setRapidas(l => l.map((x, j) => j === i ? { ...x, texto: e.target.value } : x))} /></label>
          </div>
        ))}
        {rapidas.length < 12 && <Botao variante="fantasma" onClick={() => setRapidas(l => [...l, { titulo: '', texto: '' }])}>Adicionar resposta</Botao>}
        <Rotulo>Comente a palavra → ficha no direct</Rotulo>
        <label className="sm-check"><input type="checkbox" checked={ativaQuero} onChange={e => setAtivaQuero(e.target.checked)} /> Ativa</label>
        <label className="sm-campo">Palavra-chave<input className="sm-input" value={palavra} onChange={e => setPalavra(e.target.value.toUpperCase())} maxLength={30} /></label>
        <label className="sm-campo">Mensagem (use {'{nome}'} e {'{moto}'})<textarea className="sm-input" value={respQuero} onChange={e => setRespQuero(e.target.value)} maxLength={1000} /></label>
        <Rotulo>Fora do horário</Rotulo>
        <label className="sm-check"><input type="checkbox" checked={ativaFora} onChange={e => setAtivaFora(e.target.checked)} /> Ativa</label>
        <label className="sm-campo">Mensagem (use {'{expediente}'}: {dados.expediente})<textarea className="sm-input" value={respFora} onChange={e => setRespFora(e.target.value)} maxLength={1000} /></label>
        {erro && <p className="sm-erro" role="alert">{erro}</p>}
        <div className="sm-linha-acoes" style={{ justifyContent: 'flex-end' }}>
          <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante="pri">Salvar</Botao>
        </div>
      </form>
    </Modal>
  )
}
