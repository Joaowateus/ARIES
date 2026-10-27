'use client'

// Pré-análise de crédito na conversa: a ficha que o cliente autorizou (o robô
// colhe CPF e data de nascimento depois da simulação, ou o vendedor registra)
// e a resposta de cada banco parceiro, lançada pelo vendedor no portal do
// banco. Aprovada, a condição vai para o cliente pelo WhatsApp do vendedor.
import { useEffect, useState } from 'react'
import { proLaboreApi, type AnaliseCreditoBanco, type CreditoConversa, type StatusAnaliseCredito } from '@/lib/proLaboreApi'
import { fmtReais, lerReais } from './util'

const STATUS: Record<StatusAnaliseCredito, string> = { A_ENVIAR: 'A enviar', EM_ANALISE: 'Em análise', APROVADA: 'Aprovada', RECUSADA: 'Recusada' }
const mascarar = (cpf: string) => `***.${cpf.slice(4, 7)}.${cpf.slice(8, 11)}-**`
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const diaHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às')
const PRAZOS = [15, 30, 45, 60]

// Na lateral da conversa: o andamento por banco e o botão que abre a ficha.
export function BlocoPreAnalise({ conversaId, versao, conectado, onMudou }: { conversaId: string; versao: string; conectado: boolean; onMudou: () => void }) {
  const [dados, setDados] = useState<{ chave: string; credito: CreditoConversa } | null>(null)
  const [aberto, setAberto] = useState(false)
  const chave = `${conversaId}|${versao}`

  useEffect(() => {
    let cancelado = false
    proLaboreApi.assistente.credito(conversaId).then(c => { if (!cancelado) setDados({ chave, credito: c }) }).catch(() => undefined)
    return () => { cancelado = true }
  }, [conversaId, chave])

  const credito = dados?.credito
  if (!credito || (!credito.ficha && !credito.bancos.length)) return null
  const atualizar = (c: CreditoConversa) => { setDados({ chave, credito: c }); onMudou() }
  return (
    <div className="pl-as-etiquetas-quadro" data-pre-analise-conversa>
      <div className="pl-as-subtitulo">Pré-análise de crédito</div>
      {!credito.ficha ? (
        <div className="pl-hint" style={{ fontSize: 12 }}>{credito.ativa ? 'O cliente ainda não passou a ficha.' : 'O robô não pede a ficha (aba Simulação).'}</div>
      ) : (
        <ul className="pl-si-status-bancos">
          {credito.analises.map(a => <li key={a.banco} className={a.status.toLowerCase()}><span>{a.banco}</span><b>{STATUS[a.status]}</b></li>)}
        </ul>
      )}
      {credito.novaAnalise && <div className="pl-hint" style={{ fontSize: 12, marginTop: 4 }} data-nova-analise-lateral>🔁 Nova análise em {diaHora(credito.novaAnalise.agendadoPara)}</div>}
      <button type="button" className="pl-vt-link" style={{ marginTop: 6 }} onClick={() => setAberto(true)} data-abrir-pre-analise>{credito.ficha ? 'Abrir ficha e respostas' : 'Registrar ficha'}</button>
      {aberto && <ModalPreAnalise conversaId={conversaId} credito={credito} conectado={conectado} onAtualizar={atualizar} onFechar={() => setAberto(false)} />}
    </div>
  )
}

function ModalPreAnalise({ conversaId, credito, conectado, onAtualizar, onFechar }: {
  conversaId: string
  credito: CreditoConversa
  conectado: boolean
  onAtualizar: (c: CreditoConversa) => void
  onFechar: () => void
}) {
  const [mostrarCpf, setMostrarCpf] = useState(false)
  const [copiada, setCopiada] = useState(false)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const ficha = credito.ficha

  async function rodar(fn: () => Promise<CreditoConversa>) {
    setOcupado(true)
    setErro('')
    try { onAtualizar(await fn()) } catch (e) { setErro((e as Error).message) } finally { setOcupado(false) }
  }

  async function copiar() {
    if (!ficha) return
    try { await navigator.clipboard.writeText(ficha.texto); setCopiada(true) } catch { setErro('Não deu para copiar: selecione o texto da ficha.') }
  }

  return (
    <div className="pl-modal-backdrop" onClick={() => !ocupado && onFechar()}>
      <div className="pl-card pl-modal-panel" style={{ maxWidth: 620 }} role="dialog" aria-label="Pré-análise de crédito" onClick={e => e.stopPropagation()}>
        <div className="pl-card-title" style={{ marginBottom: 4 }}>Pré-análise de crédito</div>
        <div className="pl-card-sub" style={{ marginBottom: 14 }}>Lance a ficha no portal de cada banco e registre aqui a resposta. Aprovada, a condição vai para o cliente pelo seu WhatsApp.</div>
        {!ficha ? <FormFicha ocupado={ocupado} onSalvar={d => rodar(() => proLaboreApi.assistente.salvarFicha(conversaId, d))} /> : (
          <>
            <div className="pl-si-ficha" data-ficha>
              <dl className="pl-as-dl">
                <dt>CPF</dt>
                <dd><span className="pl-mono" data-cpf>{mostrarCpf ? ficha.cpf : mascarar(ficha.cpf)}</span> <button type="button" className="pl-vt-link" onClick={() => setMostrarCpf(m => !m)} data-mostrar-cpf>{mostrarCpf ? 'esconder' : 'mostrar'}</button></dd>
                <dt>Nascimento</dt><dd>{ficha.nascimento ?? 'a confirmar com o cliente'}</dd>
                <dt>Autorização</dt>
                <dd>{ficha.origem === 'ROBO' ? `pelo WhatsApp${ficha.consentimento.resposta ? `: “${ficha.consentimento.resposta}”` : ''}` : ficha.consentimento.resposta ?? 'registrada pelo vendedor'}{ficha.consentimento.em ? ` · ${quando(ficha.consentimento.em)}` : ''}</dd>
              </dl>
              <div className="pl-si-ficha-acoes">
                <button type="button" className="pl-btn pl-btn-ghost" onClick={copiar} data-copiar-ficha>{copiada ? 'Ficha copiada ✓' : 'Copiar ficha'}</button>
                <button type="button" className="pl-btn pl-btn-ghost pl-as-perigo" disabled={ocupado} onClick={() => confirm('Apagar a ficha e as respostas dos bancos?') && rodar(() => proLaboreApi.assistente.apagarFicha(conversaId))} data-apagar-ficha>Apagar ficha</button>
              </div>
            </div>
            <div className="pl-as-subtitulo" style={{ marginTop: 14 }}>Resposta dos bancos</div>
            {credito.analises.length === 0 && <div className="pl-hint">Cadastre os bancos parceiros na aba Simulação.</div>}
            {credito.analises.map(a => (
              <LinhaBanco
                key={`${a.banco}|${a.status}|${a.entrada}|${a.prazo}|${a.parcela}|${a.taxa}|${a.observacao}|${a.enviadaAoClienteEm}`}
                analise={a} ocupado={ocupado} conectado={conectado}
                onSalvar={d => rodar(() => proLaboreApi.assistente.salvarAnalise(conversaId, a.banco, d))}
                onEnviar={() => rodar(() => proLaboreApi.assistente.enviarAprovacao(conversaId, a.banco))}
              />
            ))}
            {credito.semAprovacao && <NovaAnalise conversaId={conversaId} credito={credito} ocupado={ocupado} rodar={rodar} />}
          </>
        )}
        {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 12 }} data-erro-pre-analise>{erro}</div>}
        <div className="pl-vt-rodape"><button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar} disabled={ocupado}>Fechar</button></div>
      </div>
    </div>
  )
}

// Nenhum banco aprovou: a nova análise do vendedor (follow de crédito) e a
// nova consulta, que só sai com a autorização renovada do cliente.
function NovaAnalise({ conversaId, credito, ocupado, rodar }: { conversaId: string; credito: CreditoConversa; ocupado: boolean; rodar: (fn: () => Promise<CreditoConversa>) => void }) {
  const [remarcar, setRemarcar] = useState(false)
  const [autorizou, setAutorizou] = useState(false)
  const marcada = credito.novaAnalise
  return (
    <div className="pa-nova" data-nova-analise>
      <div className="pl-as-subtitulo">Nenhum banco aprovou</div>
      {!credito.temLead ? <p className="pl-hint">Crie o lead no CRM para marcar a nova análise.</p> : marcada && !remarcar ? (
        <div className="pa-nova-linha">
          <span>🔁 Nova análise marcada para <b data-nova-analise-data>{diaHora(marcada.agendadoPara)}</b>. Você recebe o aviso no WhatsApp no dia.</span>
          <span className="pa-nova-acoes">
            <button type="button" className="pl-vt-link" onClick={() => setRemarcar(true)} disabled={ocupado}>Remarcar</button>
            <button type="button" className="pl-vt-link" onClick={() => rodar(() => proLaboreApi.assistente.cancelarNovaAnalise(conversaId))} disabled={ocupado} data-cancelar-nova-analise>Cancelar</button>
          </span>
        </div>
      ) : (
        <div className="pa-nova-linha">
          <span>Marcar uma nova análise para ver se a restrição continua, daqui a:</span>
          <span className="pa-nova-acoes">
            {PRAZOS.map(d => <button key={d} type="button" className="pl-chip" disabled={ocupado} onClick={() => { setRemarcar(false); rodar(() => proLaboreApi.assistente.novaAnalise(conversaId, d)) }} data-marcar-nova-analise={d}>{d} dias</button>)}
          </span>
        </div>
      )}
      <div className="pa-nova-reabrir">
        <label className="pl-si-autorizou"><input type="checkbox" checked={autorizou} onChange={e => setAutorizou(e.target.checked)} data-autorizou-nova /> O cliente autorizou uma nova consulta agora</label>
        <button type="button" className="pl-btn pl-btn-ghost" disabled={ocupado || !autorizou} onClick={() => rodar(() => proLaboreApi.assistente.reabrirCredito(conversaId))} data-reabrir-pre-analise>Reabrir a pré-análise</button>
      </div>
    </div>
  )
}

function FormFicha({ ocupado, onSalvar }: { ocupado: boolean; onSalvar: (d: { cpf: string; nascimento: string | null; autorizado: true }) => void }) {
  const [cpf, setCpf] = useState('')
  const [nascimento, setNascimento] = useState('')
  const [autorizado, setAutorizado] = useState(false)
  return (
    <form onSubmit={e => { e.preventDefault(); if (autorizado) onSalvar({ cpf, nascimento: nascimento.trim() || null, autorizado: true }) }} data-form-ficha>
      <div className="pl-si-exemplo" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div className="pl-field"><label htmlFor="pa-cpf">CPF</label><input id="pa-cpf" className="pl-input" inputMode="numeric" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" /></div>
        <div className="pl-field"><label htmlFor="pa-nasc">Nascimento</label><input id="pa-nasc" className="pl-input" value={nascimento} onChange={e => setNascimento(e.target.value)} placeholder="dd/mm/aaaa" /></div>
      </div>
      <label className="pl-si-autorizou"><input type="checkbox" checked={autorizado} onChange={e => setAutorizado(e.target.checked)} data-autorizou /> O cliente autorizou a consulta de crédito nos bancos parceiros</label>
      <div className="pl-vt-rodape"><button type="submit" className="pl-btn pl-btn-primary" disabled={ocupado || !autorizado || cpf.replace(/\D/g, '').length !== 11} data-salvar-ficha>Salvar ficha</button></div>
    </form>
  )
}

// Use com key mudando a cada salvamento: os campos recomeçam do que está salvo.
function LinhaBanco({ analise, ocupado, conectado, onSalvar, onEnviar }: {
  analise: AnaliseCreditoBanco
  ocupado: boolean
  conectado: boolean
  onSalvar: (d: { status: StatusAnaliseCredito; entrada: number | null; prazo: number | null; parcela: number | null; taxa: number | null; observacao: string | null }) => void
  onEnviar: () => void
}) {
  const [status, setStatus] = useState(analise.status)
  const [c, setC] = useState({ entrada: fmtReais(analise.entrada), prazo: analise.prazo ? String(analise.prazo) : '', parcela: fmtReais(analise.parcela, 2), taxa: analise.taxa === null ? '' : String(analise.taxa).replace('.', ','), observacao: analise.observacao ?? '' })
  const mudou = status !== analise.status || c.entrada !== fmtReais(analise.entrada) || c.prazo !== (analise.prazo ? String(analise.prazo) : '') || c.parcela !== fmtReais(analise.parcela, 2) || c.taxa !== (analise.taxa === null ? '' : String(analise.taxa).replace('.', ',')) || c.observacao !== (analise.observacao ?? '')
  const salvar = () => onSalvar({
    status, entrada: lerReais(c.entrada), prazo: Number(c.prazo.replace(/\D/g, '')) || null, parcela: lerReais(c.parcela),
    taxa: c.taxa.trim() ? Number(c.taxa.replace(',', '.')) || null : null, observacao: c.observacao.trim() || null,
  })
  const campo = (k: keyof typeof c, rotulo: string, ph = '') => (
    <div className="pl-field"><label htmlFor={`pa-${analise.banco}-${k}`}>{rotulo}</label><input id={`pa-${analise.banco}-${k}`} className="pl-input" inputMode="decimal" value={c[k]} placeholder={ph} onChange={e => setC(x => ({ ...x, [k]: e.target.value }))} data-campo-analise={k} /></div>
  )
  return (
    <div className={`pl-si-analise ${analise.status.toLowerCase()}`} data-analise={analise.banco}>
      <div className="pl-si-analise-topo">
        <b>{analise.banco}</b>
        <select className="pl-input" value={status} onChange={e => setStatus(e.target.value as StatusAnaliseCredito)} aria-label={`Resposta do ${analise.banco}`}>
          {(Object.keys(STATUS) as StatusAnaliseCredito[]).map(s => <option key={s} value={s}>{STATUS[s]}</option>)}
        </select>
        {mudou && <button type="button" className="pl-btn pl-btn-primary" onClick={salvar} disabled={ocupado} data-salvar-analise>Salvar</button>}
      </div>
      {status === 'APROVADA' && (
        <div className="pl-si-analise-campos">
          {campo('entrada', 'Entrada (R$)')}
          {campo('prazo', 'Prazo (x)')}
          {campo('parcela', 'Parcela (R$)')}
          {campo('taxa', 'Taxa (% a.m.)', 'opcional')}
        </div>
      )}
      {status !== 'A_ENVIAR' && <input className="pl-input" style={{ marginTop: 6 }} value={c.observacao} maxLength={300} placeholder="Observação (ex.: pediu comprovante de renda)" onChange={e => setC(x => ({ ...x, observacao: e.target.value }))} aria-label={`Observação do ${analise.banco}`} />}
      {analise.status === 'APROVADA' && !mudou && (
        <div className="pl-si-analise-envio">
          {analise.enviadaAoClienteEm && <span className="pl-hint">Enviada ao cliente {quando(analise.enviadaAoClienteEm)}</span>}
          <button type="button" className="pl-btn pl-btn-ghost" onClick={onEnviar} disabled={ocupado || !conectado} title={conectado ? undefined : 'WhatsApp desconectado'} data-enviar-aprovacao>{analise.enviadaAoClienteEm ? 'Enviar de novo' : 'Enviar ao cliente'}</button>
        </div>
      )}
    </div>
  )
}
