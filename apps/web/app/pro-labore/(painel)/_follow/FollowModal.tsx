'use client'

// Botão Follow do card: agenda quando retomar o contato com o cliente, por
// onde e o que falar. Com um follow pendente, dá para mandar a mensagem pelo
// WhatsApp do vendedor (com as respostas prontas da aba Processo), marcar
// como feito (com o resultado) e já agendar o próximo, reagendar ou cancelar.
// A nova análise de crédito (depois da recusa) tem o roteiro dela: chamar o
// cliente e, com a autorização nova, reabrir a pré-análise.
import './follow.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { proLaboreApi, type CanalFollow, type FollowLead, type NovoFollow, type RespostaProcesso, type WhatsappDoFollow } from '@/lib/proLaboreApi'
import { CANAL_FOLLOW, dataHoraBR, diaBR, isoBR, linkWhatsapp, linkWhatsappComTexto, primeiroNome, situacaoFollow, somaDiasBR } from './follow'

const RAPIDOS: Array<{ rotulo: string; dias: number; hora: string }> = [
  { rotulo: 'Amanhã 9h', dias: 1, hora: '09:00' },
  { rotulo: 'Em 2 dias', dias: 2, hora: '10:00' },
  { rotulo: 'Em 3 dias', dias: 3, hora: '10:00' },
  { rotulo: 'Em 1 semana', dias: 7, hora: '10:00' },
  { rotulo: 'Em 15 dias', dias: 15, hora: '10:00' },
  { rotulo: 'Em 30 dias', dias: 30, hora: '10:00' },
]

function Agendador({ valor, onChange }: { valor: { dia: string; hora: string; canal: CanalFollow; nota: string }; onChange: (v: { dia: string; hora: string; canal: CanalFollow; nota: string }) => void }) {
  return (
    <div className="fw-agendar">
      <div className="fw-rapidos" role="group" aria-label="Atalhos de data">
        {RAPIDOS.map(r => {
          const dia = somaDiasBR(r.dias)
          const ativo = valor.dia === dia && valor.hora === r.hora
          return <button key={r.rotulo} type="button" className={`pl-chip ${ativo ? 'active' : ''}`} aria-pressed={ativo} onClick={() => onChange({ ...valor, dia, hora: r.hora })}>{r.rotulo}</button>
        })}
      </div>
      <div className="fw-linha">
        <div className="pl-field"><label htmlFor="fw-dia">Dia</label><input id="fw-dia" type="date" className="pl-input" value={valor.dia} min={diaBR(new Date())} onChange={e => onChange({ ...valor, dia: e.target.value })} required /></div>
        <div className="pl-field"><label htmlFor="fw-hora">Hora</label><input id="fw-hora" type="time" className="pl-input" value={valor.hora} onChange={e => onChange({ ...valor, hora: e.target.value })} required /></div>
      </div>
      <div className="pl-field">
        <label>Por onde</label>
        <div className="fw-rapidos" role="group" aria-label="Canal">
          {(Object.keys(CANAL_FOLLOW) as CanalFollow[]).map(c => <button key={c} type="button" className={`pl-chip ${valor.canal === c ? 'active' : ''}`} aria-pressed={valor.canal === c} onClick={() => onChange({ ...valor, canal: c })}>{CANAL_FOLLOW[c]}</button>)}
        </div>
      </div>
      <div className="pl-field"><label htmlFor="fw-nota">O que falar (opcional)</label><textarea id="fw-nota" className="pl-input" rows={2} maxLength={1000} value={valor.nota} onChange={e => onChange({ ...valor, nota: e.target.value })} placeholder="Ex.: mandar as fotos da moto e a simulação do financiamento" /></div>
    </div>
  )
}

const novoValor = () => ({ dia: somaDiasBR(1), hora: '09:00', canal: 'WHATSAPP' as CanalFollow, nota: '' })
const paraEnvio = (v: ReturnType<typeof novoValor>): NovoFollow => ({ agendadoPara: new Date(isoBR(v.dia, v.hora)).toISOString(), canal: v.canal, nota: v.nota.trim() || undefined })

/**
 * A mensagem do follow: sai pelo WhatsApp do vendedor quando o cliente tem
 * conversa no sistema; senão abre o WhatsApp com o texto pronto. As
 * respostas prontas vêm da aba Processo.
 */
function MensagemWhatsapp({ follow, lead, agendarPadrao, onFeito, onVoltar }: {
  follow: FollowLead
  lead: { nomeCliente: string; telefone?: string | null }
  agendarPadrao: boolean
  onFeito: () => void
  onVoltar: () => void
}) {
  const [info, setInfo] = useState<WhatsappDoFollow | null>(null)
  const [respostas, setRespostas] = useState<RespostaProcesso[]>([])
  const [texto, setTexto] = useState('')
  const [agendar, setAgendar] = useState(agendarPadrao)
  const [valor, setValor] = useState(novoValor)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let cancelado = false
    proLaboreApi.follows.whatsapp(follow.id).then(i => { if (!cancelado) { setInfo(i); setTexto(t => t || i.sugestao || follow.nota || '') } }).catch(e => { if (!cancelado) setErro((e as Error).message) })
    proLaboreApi.processo.ler().then(p => { if (!cancelado) setRespostas(p.conteudo.respostas.filter(r => r.texto.trim())) }).catch(() => undefined)
    return () => { cancelado = true }
  }, [follow.id, follow.nota])

  const nome = primeiroNome(lead.nomeCliente)
  const usar = (t: string) => setTexto(t.replace(/\{nome\}/g, nome).replace(/,\s*\{nome\}/g, ''))
  const linkFora = linkWhatsappComTexto(info?.telefone ?? lead.telefone, texto)

  async function enviar() {
    setSalvando(true); setErro('')
    try {
      await proLaboreApi.follows.enviarWhatsapp(follow.id, { texto: texto.trim(), proximo: agendar ? paraEnvio(valor) : undefined })
      onFeito()
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }
  async function marcarFeitoFora() {
    setSalvando(true); setErro('')
    try {
      await proLaboreApi.follows.encerrar(follow.id, { status: 'FEITO', resultado: `Mandou pelo WhatsApp (fora do sistema): "${texto.trim().slice(0, 140)}"`, proximo: agendar ? paraEnvio(valor) : undefined })
      onFeito()
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  return (
    <div className="fw-mensagem" data-mensagem-follow>
      {respostas.length > 0 && (
        <div className="fw-prontas">
          <div className="fw-rotulo">Respostas prontas (aba Processo)</div>
          <div className="fw-rapidos">{respostas.slice(0, 12).map(r => <button key={r.titulo} type="button" className="pl-chip" onClick={() => usar(r.texto)} title={r.texto} data-resposta-pronta>{r.titulo}</button>)}</div>
        </div>
      )}
      <div className="pl-field">
        <label htmlFor="fw-msg">Mensagem</label>
        <textarea id="fw-msg" className="pl-input" rows={4} maxLength={1500} value={texto} onChange={e => setTexto(e.target.value)} placeholder={info ? 'Escreva a mensagem para o cliente' : 'Carregando…'} data-texto-whatsapp />
      </div>
      <label className="fw-check"><input type="checkbox" checked={agendar} onChange={e => setAgendar(e.target.checked)} /> Agendar o próximo follow</label>
      {agendar && <Agendador valor={valor} onChange={setValor} />}
      {info && !info.conversaId && <p className="fw-legenda" data-motivo-whatsapp>{info.motivo}. Abra o WhatsApp com o texto pronto e depois marque como feito.</p>}
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      <div className="fw-botoes">
        <button type="button" className="pl-btn pl-btn-ghost" onClick={onVoltar}>Voltar</button>
        {info?.conversaId ? (
          <button type="button" className="pl-btn pl-btn-primary" disabled={salvando || texto.trim().length < 2} onClick={enviar} data-enviar-whatsapp>{salvando ? 'Enviando…' : 'Enviar pelo WhatsApp'}</button>
        ) : info && (
          <>
            {linkFora && <a className="pl-btn pl-btn-ghost" href={linkFora} target="_blank" rel="noreferrer" data-abrir-whatsapp>Abrir no WhatsApp</a>}
            <button type="button" className="pl-btn pl-btn-primary" disabled={salvando || texto.trim().length < 2} onClick={marcarFeitoFora}>Marquei como feito</button>
          </>
        )}
      </div>
    </div>
  )
}

/** Nova análise de crédito: chamar o cliente e, com a autorização nova, reabrir a pré-análise. */
function NovaAnalise({ follow, lead, onMudou, onFechar }: { follow: FollowLead; lead: { nomeCliente: string; telefone?: string | null }; onMudou: () => void; onFechar: () => void }) {
  const router = useRouter()
  const [etapa, setEtapa] = useState<'ver' | 'mensagem'>('ver')
  const [autorizou, setAutorizou] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const ctx = follow.contexto
  const [agora] = useState(() => Date.now())
  const dias = ctx?.recusadoEm ? Math.floor((agora - Date.parse(ctx.recusadoEm)) / 864e5) : null

  async function rodar(fn: () => Promise<unknown>, depois?: () => void) {
    setSalvando(true); setErro('')
    try { await fn(); onMudou(); (depois ?? onFechar)() } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }
  const reabrir = () => rodar(async () => {
    const r = await proLaboreApi.follows.reabrirCredito(follow.id)
    router.push(`/pro-labore/assistente?aba=whatsapp&conversa=${r.conversaId}&vendedor=${r.vendedorId}`)
  }, () => undefined)
  const remarcar = () => rodar(() => proLaboreApi.assistente.novaAnalise(ctx!.conversaId, 30))

  if (etapa === 'mensagem') return <MensagemWhatsapp follow={follow} lead={lead} agendarPadrao={false} onVoltar={() => setEtapa('ver')} onFeito={() => { onMudou(); onFechar() }} />
  return (
    <div className="fw-credito" data-follow-credito>
      <p className="fw-credito-resumo">
        Nenhum banco aprovou{ctx?.bancos?.length ? ` (${ctx.bancos.join(', ')})` : ''}{dias === null ? '' : dias < 1 ? ': recusa de hoje' : `: faz ${dias} ${dias === 1 ? 'dia' : 'dias'}`}. Veja se a restrição continua.
      </p>
      <ol className="fw-credito-passos">
        <li>
          <b>Chame o cliente</b> e pergunte se ele quer tentar de novo.
          <div className="fw-botoes" style={{ justifyContent: 'flex-start', marginTop: 6 }}>
            <button type="button" className="pl-btn pl-btn-primary" onClick={() => setEtapa('mensagem')} data-chamar-cliente>Mandar mensagem</button>
            {linkWhatsapp(lead.telefone) && <a className="pl-btn pl-btn-ghost" href={linkWhatsapp(lead.telefone)!} target="_blank" rel="noreferrer">Abrir o WhatsApp</a>}
          </div>
        </li>
        <li>
          <b>Com a autorização dele</b>, reabra a pré-análise: as recusas voltam para &ldquo;a enviar&rdquo; e você lança de novo nos bancos.
          <label className="fw-check" style={{ marginTop: 6 }}><input type="checkbox" checked={autorizou} onChange={e => setAutorizou(e.target.checked)} data-autorizou-follow /> O cliente autorizou uma nova consulta</label>
          <div className="fw-botoes" style={{ justifyContent: 'flex-start', marginTop: 6 }}>
            <button type="button" className="pl-btn pl-btn-ghost" disabled={salvando || !autorizou || !ctx?.conversaId} onClick={reabrir} data-reabrir-follow>Reabrir a pré-análise</button>
          </div>
        </li>
      </ol>
      {erro && <div className="pl-alert pl-alert-error" role="alert">{erro}</div>}
      <div className="fw-botoes">
        {ctx?.conversaId && <button type="button" className="pl-btn pl-btn-ghost" disabled={salvando} onClick={remarcar} data-remarcar-credito>Remarcar em 30 dias</button>}
        <button type="button" className="pl-btn pl-btn-ghost" disabled={salvando} onClick={() => rodar(() => proLaboreApi.follows.encerrar(follow.id, { status: 'CANCELADO', resultado: 'Nova análise cancelada' }))}>Cancelar</button>
      </div>
    </div>
  )
}

export function FollowModal({ lead, pendentes, inicial, onFechar, onMudou }: {
  lead: { id: string; nomeCliente: string; telefone?: string | null }
  // Os follows pendentes do lead, o mais próximo primeiro (o comum e a nova análise de crédito).
  pendentes: FollowLead[]
  inicial?: string | null
  onFechar: () => void
  onMudou: () => void
}) {
  const [atualId, setAtualId] = useState<string | null>(() => pendentes.find(f => f.id === inicial)?.id ?? pendentes[0]?.id ?? null)
  const pendente = pendentes.find(f => f.id === atualId) ?? null
  const temComum = pendentes.some(f => f.tipo !== 'CREDITO')
  const [modo, setModo] = useState<'ver' | 'agendar' | 'feito' | 'mensagem'>(pendente ? 'ver' : 'agendar')
  const [valor, setValor] = useState(novoValor)
  const [resultado, setResultado] = useState('')
  const [agendarProximo, setAgendarProximo] = useState(true)
  const [historico, setHistorico] = useState<FollowLead[] | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const whats = linkWhatsapp(lead.telefone)

  useEffect(() => { proLaboreApi.follows.doLead(lead.id).then(h => setHistorico(h.filter(f => f.status !== 'PENDENTE').slice(0, 5))).catch(() => setHistorico([])) }, [lead.id])
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar])

  async function rodar(fn: () => Promise<unknown>) {
    setSalvando(true); setErro('')
    try { await fn(); onMudou(); onFechar() } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }
  const agendar = () => rodar(() => proLaboreApi.follows.agendar(lead.id, paraEnvio(valor)))
  const concluir = () => rodar(() => proLaboreApi.follows.encerrar(pendente!.id, { status: 'FEITO', resultado: resultado.trim() || undefined, proximo: agendarProximo ? paraEnvio(valor) : undefined }))
  const cancelar = () => rodar(() => proLaboreApi.follows.encerrar(pendente!.id, { status: 'CANCELADO' }))
  const sit = pendente ? situacaoFollow(pendente) : null
  const credito = pendente?.tipo === 'CREDITO'
  const trocar = (id: string | null) => { setAtualId(id); setModo(id ? 'ver' : 'agendar'); setErro('') }

  return (
    <div className="pl-modal-backdrop" onClick={onFechar}>
      <div className="pl-card pl-modal-panel fw-janela" role="dialog" aria-modal="true" aria-labelledby="fw-titulo" onClick={e => e.stopPropagation()} data-follow-modal>
        <div className="fw-cab">
          <div>
            <div className="pl-eyebrow">{credito ? 'Nova análise de crédito' : 'Follow'}</div>
            <h2 id="fw-titulo">{lead.nomeCliente}</h2>
          </div>
          <button type="button" className="fw-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        {(pendentes.length > 1 || (pendentes.length === 1 && !temComum)) && (
          <div className="fw-rapidos" role="tablist" aria-label="Follows do lead">
            {pendentes.map(f => <button key={f.id} type="button" role="tab" aria-selected={f.id === atualId} className={`pl-chip ${f.id === atualId ? 'active' : ''}`} onClick={() => trocar(f.id)} data-aba-follow={f.tipo ?? 'CONTATO'}>{situacaoFollow(f).texto}</button>)}
            {!temComum && <button type="button" role="tab" aria-selected={atualId === null} className={`pl-chip ${atualId === null ? 'active' : ''}`} onClick={() => trocar(null)}>+ Follow</button>}
          </div>
        )}

        {pendente && sit && (
          <div className={`fw-pendente ${sit.tipo.toLowerCase()}`}>
            <b>{sit.texto}</b>
            {!credito && <span>{pendente.canal ? CANAL_FOLLOW[pendente.canal] : 'Sem canal'}{pendente.nota ? ` · ${pendente.nota}` : ''}</span>}
            {!credito && whats && <a className="pl-link-action" href={whats} target="_blank" rel="noreferrer">Abrir o WhatsApp do cliente</a>}
          </div>
        )}

        {pendente && credito && <NovaAnalise key={pendente.id} follow={pendente} lead={lead} onMudou={onMudou} onFechar={onFechar} />}

        {!credito && modo === 'ver' && pendente && (
          <div className="fw-botoes">
            <button type="button" className="pl-btn pl-btn-primary" onClick={() => setModo('mensagem')} data-mandar-mensagem>Mandar mensagem</button>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => { setModo('feito'); setValor(novoValor()) }}>Fiz o follow</button>
            <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setModo('agendar')}>Reagendar</button>
            <button type="button" className="pl-btn pl-btn-ghost" disabled={salvando} onClick={cancelar}>Cancelar follow</button>
          </div>
        )}

        {!credito && modo === 'mensagem' && pendente && <MensagemWhatsapp follow={pendente} lead={lead} agendarPadrao onVoltar={() => setModo('ver')} onFeito={() => { onMudou(); onFechar() }} />}

        {!credito && modo === 'feito' && (
          <>
            <div className="pl-field"><label htmlFor="fw-res">Como foi? (opcional)</label><textarea id="fw-res" className="pl-input" rows={2} maxLength={1000} value={resultado} onChange={e => setResultado(e.target.value)} placeholder="Ex.: respondeu, quer ver a moto no sábado" /></div>
            <label className="fw-check"><input type="checkbox" checked={agendarProximo} onChange={e => setAgendarProximo(e.target.checked)} /> Agendar o próximo follow</label>
            {agendarProximo && <Agendador valor={valor} onChange={setValor} />}
            <div className="fw-botoes">
              <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setModo('ver')}>Voltar</button>
              <button type="button" className="pl-btn pl-btn-primary" disabled={salvando} onClick={concluir}>{salvando ? 'Salvando…' : agendarProximo ? 'Salvar e agendar' : 'Salvar'}</button>
            </div>
          </>
        )}

        {!credito && modo === 'agendar' && (
          <>
            {pendente && <p className="fw-legenda">O follow de agora será trocado pelo novo.</p>}
            <Agendador valor={valor} onChange={setValor} />
            <div className="fw-botoes">
              {pendente && <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setModo('ver')}>Voltar</button>}
              <button type="button" className="pl-btn pl-btn-primary" disabled={salvando || !valor.dia || !valor.hora} onClick={agendar}>{salvando ? 'Agendando…' : 'Agendar follow'}</button>
            </div>
          </>
        )}

        {erro && <div className="pl-alert pl-alert-error">{erro}</div>}

        {historico && historico.length > 0 && (
          <div className="fw-historico">
            <div className="fw-rotulo">Últimos contatos</div>
            {historico.map(f => (
              <div key={f.id} className="fw-hist-item">
                <span className={`fw-status ${f.status === 'FEITO' ? 'feito' : ''}`}>{f.status === 'FEITO' ? 'Feito' : 'Cancelado'}</span>
                <div><b>{dataHoraBR(f.feitoEm ?? f.agendadoPara)}</b>{f.tipo === 'CREDITO' ? ' · Nova análise' : f.canal ? ` · ${CANAL_FOLLOW[f.canal]}` : ''}{f.resultado ? <div className="fw-legenda">{f.resultado}</div> : null}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
