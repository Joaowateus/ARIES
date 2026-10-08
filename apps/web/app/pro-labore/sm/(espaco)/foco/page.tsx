'use client'

// Tela 09 · Modo foco (seção 11.2, protótipo Foco.html): tela cheia, uma
// tarefa por vez, na ordem que o servidor monta. Enter executa, A adia, Esc
// sai. Cada ação acontece de verdade (responder, virar lead, conferir o post,
// avisar, salvar o gancho) e conta no ritual do dia.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { proLaboreApi, type SmFoco, type SmFocoConclusao, type SmTarefaFoco } from '@/lib/proLaboreApi'
import { Botao, Chip, EstadoVazio, Kbd, Rotulo, useToast } from '../../_ui'
import { useEspacoSM } from '../EspacoSM'

const PAGAMENTOS = [['FINANCIAMENTO', 'Financiamento'], ['A_VISTA', 'À vista'], ['CONSORCIO', 'Consórcio']] as const
const RESOLVIDA: Record<string, string> = { 'da manhã': 'Manhã resolvida', 'da tarde': 'Tarde resolvida', 'da noite': 'Ritual feito' }

export default function FocoPage() {
  const router = useRouter()
  const toast = useToast()
  const { eu } = useEspacoSM()
  const [fila, setFila] = useState<SmFoco | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [indice, setIndice] = useState(0)
  const [feitas, setFeitas] = useState(0)
  const [fim, setFim] = useState<SmFocoConclusao | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const carregar = useCallback(() => {
    proLaboreApi.sm.foco.fila(true).then(f => {
      setFila(f); setIndice(0); setFim(null); setErro(null)
      // Fila vazia: o dia já está em ordem; a rodada fecha na hora.
      if (!f.tarefas.length) proLaboreApi.sm.foco.concluir().then(setFim).catch(() => undefined)
    }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível montar a fila'))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  const tarefa = fila?.tarefas[indice] ?? null
  const total = fila?.tarefas.length ?? 0

  const avancar = useCallback(() => {
    if (!fila) return
    if (indice + 1 < fila.tarefas.length) { setIndice(indice + 1); return }
    proLaboreApi.sm.foco.concluir().then(setFim).catch(e => toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível fechar o ritual', tom: 'bad' }))
  }, [fila, indice, toast])

  const executar = useCallback(async (d: { texto?: string; virarLead?: boolean; lead?: SmTarefaFoco['lead']; capaTexto?: boolean }) => {
    if (!tarefa || ocupado) return
    setOcupado(true)
    try {
      const r = await proLaboreApi.sm.foco.executar(tarefa.id, d)
      if (r.leadCriado) toast({ mensagem: r.leadCriado.consultor ? `Lead enviado ao CRM e entregue a ${r.leadCriado.consultor}.` : 'Lead enviado ao CRM.' })
      setFeitas(n => n + 1)
      avancar()
    } catch (e) {
      toast({ mensagem: e instanceof Error ? e.message : 'Não foi possível fazer agora', tom: 'bad' })
    } finally { setOcupado(false) }
  }, [tarefa, ocupado, avancar, toast])

  const adiar = useCallback(() => {
    if (!tarefa || ocupado) return
    proLaboreApi.sm.foco.adiar(tarefa.id).catch(() => undefined)
    avancar()
  }, [tarefa, ocupado, avancar])

  // Esc sai de qualquer ponto; A adia fora dos campos de texto.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const emCampo = (e.target as HTMLElement).closest('input, textarea, select')
      if (e.key === 'Escape') { router.push('/pro-labore/sm'); return }
      if (!emCampo && (e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey && !fim) { e.preventDefault(); adiar() }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [router, adiar, fim])

  return (
    <div className="sm-foco">
      <header className="sm-foco-topo">
        <span className="sm-mono">{fila?.titulo ?? 'Modo foco'}</span>
        <div className="sm-foco-barras" role="progressbar" aria-label="Progresso do ritual" aria-valuemin={0} aria-valuemax={total} aria-valuenow={fim ? total : indice}>
          {Array.from({ length: Math.max(1, total) }, (_, i) => <span key={i} className={fim || i < indice ? 'feita' : i === indice ? 'atual' : ''} />)}
        </div>
        <span className="sm-foco-conta">{fim ? `${total} de ${total}` : total ? `${indice + 1} de ${total}` : '0 de 0'}</span>
        <Link href="/pro-labore/sm" className="sm-btn">Sair <Kbd>Esc</Kbd></Link>
      </header>
      <main className="sm-foco-meio">
        {erro && <EstadoVazio titulo="Não foi possível montar a fila" acao={<Botao onClick={carregar}>Tentar de novo</Botao>}>{erro}</EstadoVazio>}
        {!erro && !fila && <p className="sm-legenda" role="status">Montando a fila…</p>}
        {fim && fila && <Conclusao fim={fim} vazia={total === 0 || feitas === 0 && fim.tarefas === 0} aoRever={carregar} />}
        {!fim && tarefa && <Tarefa key={tarefa.id} t={tarefa} ia={eu.ia.ligada} ocupado={ocupado} somenteLeitura={fila!.somenteLeitura} aoExecutar={executar} aoAdiar={adiar} />}
      </main>
      <footer className="sm-foco-pe">Uma coisa por vez. O sistema ordena por urgência: cliente esperando, depois o que vai ao ar hoje, depois produção.</footer>
    </div>
  )
}

function Tarefa({ t, ia, ocupado, somenteLeitura, aoExecutar, aoAdiar }: {
  t: SmTarefaFoco; ia: boolean; ocupado: boolean; somenteLeitura: boolean
  aoExecutar: (d: { texto?: string; virarLead?: boolean; lead?: SmTarefaFoco['lead']; capaTexto?: boolean }) => void
  aoAdiar: () => void
}) {
  const router = useRouter()
  const [texto, setTexto] = useState(t.caixa.texto ?? '')
  const [daIA, setDaIA] = useState(false)
  const editado = useRef(false)
  const [virarLead, setVirarLead] = useState(false)
  const [lead, setLead] = useState(t.lead ?? null)
  const capa = t.caixa.itens?.find(i => i.chave === 'capaTexto')
  const [capaOk, setCapaOk] = useState(!!capa?.ok)
  const botao = useRef<HTMLButtonElement>(null)

  // Resposta do cliente: com a IA ligada, troca a sugestão do template pela dela (se ninguém editou).
  useEffect(() => {
    if (t.tipo !== 'CLIENTE' || !ia || !t.caixa.editavel) return
    proLaboreApi.sm.atendimento.sugestao(t.ref).then(r => { if (!editado.current && r.ia) { setTexto(r.texto); setDaIA(true) } }).catch(() => undefined)
  }, [t, ia])
  useEffect(() => { botao.current?.focus() }, [])

  function primario() {
    if (!t.acao) { if (t.link) router.push(t.link.href); return }
    aoExecutar({ texto: t.caixa.editavel ? texto : undefined, virarLead: virarLead && !!lead, lead: virarLead ? lead ?? undefined : undefined, capaTexto: capa ? capaOk : undefined })
  }
  // Enter executa (no campo de texto, Ctrl+Enter).
  function tecla(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    const emCampo = (e.target as HTMLElement).closest('input, textarea, select')
    if (emCampo && !(e.ctrlKey || e.metaKey)) return
    if ((e.target as HTMLElement).closest('a, button') && !emCampo) return
    e.preventDefault(); primario()
  }

  return (
    <article className="sm-foco-tarefa" onKeyDown={tecla} aria-label={t.titulo}>
      <div className="sm-foco-tag">
        <Chip tom={t.tom}>{t.tag}</Chip>
        <span className="sm-legenda">~{t.minutos} min</span>
      </div>
      <h1 className="sm-ttl sm-foco-titulo">{t.titulo}</h1>
      <p className="sm-foco-porque">{t.porque}</p>
      <div className="sm-foco-caixa">
        <Rotulo>{t.caixa.rotulo}{daIA ? ' · sugerida pela IA' : ''}</Rotulo>
        {t.caixa.itens
          ? (
            <ul className="sm-foco-check">
              {t.caixa.itens.map((i, k) => (
                <li key={k} className={i.ok ? 'ok' : i.ok === false ? 'falta' : ''}>
                  {i.manual
                    ? <label><input type="checkbox" checked={capaOk} disabled={somenteLeitura} onChange={e => setCapaOk(e.target.checked)} /> {i.texto}</label>
                    : <><span aria-hidden="true">{i.ok ? '✓' : i.ok === false ? '•' : '–'}</span> {i.texto}{i.detalhe ? <span className="sm-legenda"> · {i.detalhe}</span> : null}</>}
                </li>
              ))}
            </ul>
          )
          : t.caixa.editavel
            ? <><label className="sm-sr" htmlFor="foco-texto">{t.caixa.rotulo}</label><textarea id="foco-texto" className="sm-input" rows={4} value={texto} maxLength={1000} readOnly={somenteLeitura} onChange={e => { editado.current = true; setTexto(e.target.value); setDaIA(false) }} /></>
            : <p className="sm-foco-texto">{t.caixa.texto ?? '—'}</p>}
      </div>
      {t.lead && lead && !somenteLeitura && (
        <div className="sm-foco-lead">
          <label className="sm-foco-lead-liga"><input type="checkbox" checked={virarLead} onChange={e => setVirarLead(e.target.checked)} /> Também enviar ao CRM como lead</label>
          {virarLead && (
            <div className="sm-grade-2">
              <label className="sm-campo">Nome<input className="sm-input" value={lead.nome} onChange={e => setLead({ ...lead, nome: e.target.value })} maxLength={120} /></label>
              <label className="sm-campo">Moto de interesse<input className="sm-input" value={lead.moto ?? ''} onChange={e => setLead({ ...lead, moto: e.target.value || null })} maxLength={120} /></label>
              <label className="sm-campo">Forma de pagamento
                <select className="sm-input" value={lead.pagamento} onChange={e => setLead({ ...lead, pagamento: e.target.value as typeof lead.pagamento })}>
                  {PAGAMENTOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>
      )}
      <div className="sm-foco-acoes">
        <button ref={botao} type="button" className="sm-btn pri" disabled={ocupado || (somenteLeitura && !!t.acao)} onClick={primario}>
          {ocupado ? 'Fazendo…' : t.acao ? t.acao.rotulo : t.link?.rotulo ?? 'Próxima'} <Kbd>Enter</Kbd>
        </button>
        <button type="button" className="sm-btn" disabled={ocupado} onClick={aoAdiar}>Adiar para depois <Kbd>A</Kbd></button>
        {t.acao && t.link && <Link href={t.link.href} className="sm-link-botao sm-foco-link">{t.link.rotulo}</Link>}
      </div>
    </article>
  )
}

function Conclusao({ fim, vazia, aoRever }: { fim: SmFocoConclusao; vazia: boolean; aoRever: () => void }) {
  return (
    <section className="sm-foco-fim" aria-label="Ritual concluído">
      <div className="sm-foco-fim-icone" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
      </div>
      <h1 className="sm-ttl sm-foco-titulo">{vazia ? 'Tudo em dia por aqui.' : `${RESOLVIDA[fim.periodo] ?? 'Ritual feito'} em ${fim.minutos} ${fim.minutos === 1 ? 'minuto' : 'minutos'}.`}</h1>
      <p className="sm-foco-porque">{vazia ? 'Nenhum cliente esperando, nada atrasado e nenhum post para conferir agora. ' : fim.periodo === 'da noite' ? 'Agora é descansar. ' : 'O resto do dia é seu para criar. '}{fim.proximo}</p>
      <div className="sm-foco-numeros">
        <div><span className="sm-ttl">{fim.tarefas}</span><span className="sm-legenda">{fim.tarefas === 1 ? 'tarefa concluída' : 'tarefas concluídas'} hoje</span></div>
        <div><span className="sm-ttl">{fim.leads}</span><span className="sm-legenda">{fim.leads === 1 ? 'lead enviado' : 'leads enviados'} ao CRM</span></div>
        <div><span className="sm-ttl">{fim.sequencia} {fim.sequencia === 1 ? 'dia' : 'dias'}</span><span className="sm-legenda">seguidos com ritual feito</span></div>
      </div>
      <div className="sm-foco-acoes">
        <Link href="/pro-labore/sm" className="sm-btn pri">Voltar ao Hoje</Link>
        <button type="button" className="sm-btn" onClick={aoRever}>Rever o ritual</button>
      </div>
    </section>
  )
}
