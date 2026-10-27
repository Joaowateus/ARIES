'use client'

// Agenda › Meu dia: uma linha do tempo só com tudo o que a pessoa tem para
// fazer no dia — as rotinas da Agenda, os follows do CRM, as tarefas que ela
// mesma anotou e, hoje, quem está pedindo atenção agora (fila do Copiloto).
// Mesma ideia do "Today" do Todoist/Sunsama e da visão de atividades do
// Pipedrive: o dia em ordem de horário, com a semana logo acima.
import './meudia.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { proLaboreApi, type AgendaItem, type AgendaTarefa, type CpItemFila, type FollowComLead, type LigacaoComLead } from '@/lib/proLaboreApi'
import { BotaoLigar, RegistrarLigacao, rotuloPasso } from '../../_ligacoes/Ligacoes'

export interface RotinaDoDia { item: AgendaItem; feito: boolean; categoria: string }

const H = 3600e3
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const ETAPA: Record<string, string> = { LEAD: 'Lead', ABORDADO: 'Abordado', NEGOCIACAO: 'Negociação', PROPOSTA: 'Proposta', FECHADO: 'Fechado', PERDIDO: 'Perdido' }
const CANAL: Record<string, string> = { WHATSAPP: 'WhatsApp', LIGACAO: 'Ligação', VISITA: 'Visita', EMAIL: 'E-mail', OUTRO: 'Contato' }

/** Dia de Brasília (YYYY-MM-DD) de um instante. */
export const diaBR = (t: number | Date = Date.now()) => new Date((typeof t === 'number' ? t : t.getTime()) - 3 * H).toISOString().slice(0, 10)
const horaBR = (iso: string) => new Date(new Date(iso).getTime() - 3 * H).toISOString().slice(11, 16)
const somaDias = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const inicioDaSemana = (iso: string) => somaDias(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7))
const rotuloDia = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

/** "14:30 ligar para o banco", "9h ligar", "14h30 ligar" → horário + texto. */
export function lerTarefaRapida(texto: string): { titulo: string; horario: string | null } {
  const m = texto.trim().match(/^(\d{1,2})(?::(\d{2})|h(\d{2})?)\s+(.+)$/i)
  if (m) {
    const h = Number(m[1]), min = Number(m[2] ?? m[3] ?? 0)
    if (h <= 23 && min <= 59) return { titulo: m[4].trim(), horario: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` }
  }
  return { titulo: texto.trim(), horario: null }
}

type Entrada =
  | { chave: string; tipo: 'ROTINA'; horario: string | null; feito: boolean; rotina: RotinaDoDia }
  | { chave: string; tipo: 'FOLLOW'; horario: string | null; feito: false; follow: FollowComLead; atrasado: boolean }
  | { chave: string; tipo: 'LIGACAO'; horario: string | null; feito: false; ligacao: LigacaoComLead; atrasado: boolean }
  | { chave: string; tipo: 'TAREFA'; horario: string | null; feito: boolean; tarefa: AgendaTarefa; atrasada: boolean }

export function MeuDia({ dia, onDia, rotinasDoDia, onAlternarRotina, vejaEquipe }: {
  dia: string
  onDia: (dia: string) => void
  rotinasDoDia: (dia: string) => RotinaDoDia[]
  onAlternarRotina: (item: AgendaItem, dia: string) => Promise<void>
  vejaEquipe: boolean
}) {
  const hoje = diaBR()
  const semana = inicioDaSemana(dia)
  const diasDaSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => somaDias(semana, i)), [semana])
  const [tarefas, setTarefas] = useState<AgendaTarefa[]>([])
  const [follows, setFollows] = useState<FollowComLead[] | null>(null)
  const [fila, setFila] = useState<CpItemFila[] | null>(null)
  // Ligações pendentes (cadências e agendadas no lead): Ligar e Registrar direto daqui.
  const [ligacoes, setLigacoes] = useState<LigacaoComLead[] | null>(null)
  const [registrando, setRegistrando] = useState<LigacaoComLead | null>(null)
  const [novo, setNovo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregarTarefas = useCallback(() => {
    proLaboreApi.agenda.tarefas.listar(semana, somaDias(semana, 6), true).then(setTarefas).catch(e => setErro((e as Error).message))
  }, [semana])
  useEffect(() => { carregarTarefas() }, [carregarTarefas])
  // Follows e a fila do Copiloto dependem do acesso ao CRM e ao Copiloto: sem acesso, a seção some.
  useEffect(() => {
    let cancelado = false
    const carregar = () => {
      proLaboreApi.follows.pendentes().then(f => { if (!cancelado) setFollows(f) }).catch(() => { if (!cancelado) setFollows(null) })
      proLaboreApi.copiloto.fila().then(f => { if (!cancelado) setFila(f.itens) }).catch(() => { if (!cancelado) setFila(null) })
      proLaboreApi.ligacoes.pendentes().then(l => { if (!cancelado) setLigacoes(l) }).catch(() => { if (!cancelado) setLigacoes(null) })
    }
    carregar()
    const t = setInterval(() => { if (!document.hidden) carregar() }, 120_000)
    return () => { cancelado = true; clearInterval(t) }
  }, [])

  const followsDoDia = (d: string) => (follows ?? []).filter(f => diaBR(new Date(f.agendadoPara)) === d)
  const tarefasDoDia = (d: string) => tarefas.filter(t => t.dia.slice(0, 10) === d)
  const ligacoesDoDia = (d: string) => (ligacoes ?? []).filter(l => diaBR(new Date(l.agendadaPara)) === d)

  const entradas: Entrada[] = [
    ...rotinasDoDia(dia).map(r => ({ chave: `r:${r.item.id}`, tipo: 'ROTINA' as const, horario: r.item.horario ?? null, feito: r.feito, rotina: r })),
    ...followsDoDia(dia).map(f => ({ chave: `f:${f.id}`, tipo: 'FOLLOW' as const, horario: horaBR(f.agendadoPara), feito: false as const, follow: f, atrasado: false })),
    ...ligacoesDoDia(dia).map(l => ({ chave: `l:${l.id}`, tipo: 'LIGACAO' as const, horario: horaBR(l.agendadaPara), feito: false as const, ligacao: l, atrasado: false })),
    ...tarefasDoDia(dia).map(t => ({ chave: `t:${t.id}`, tipo: 'TAREFA' as const, horario: t.horario, feito: !!t.feitaEm, tarefa: t, atrasada: false })),
  ].sort((a, b) => (a.horario ?? '99:99').localeCompare(b.horario ?? '99:99'))
  const atrasados: Entrada[] = dia !== hoje ? [] : [
    ...(follows ?? []).filter(f => diaBR(new Date(f.agendadoPara)) < hoje).map(f => ({ chave: `f:${f.id}`, tipo: 'FOLLOW' as const, horario: null, feito: false as const, follow: f, atrasado: true })),
    ...(ligacoes ?? []).filter(l => diaBR(new Date(l.agendadaPara)) < hoje).map(l => ({ chave: `l:${l.id}`, tipo: 'LIGACAO' as const, horario: null, feito: false as const, ligacao: l, atrasado: true })),
    ...tarefas.filter(t => t.dia.slice(0, 10) < hoje && !t.feitaEm).map(t => ({ chave: `t:${t.id}`, tipo: 'TAREFA' as const, horario: t.horario, feito: false, tarefa: t, atrasada: true })),
  ]
  const comHorario = entradas.filter(e => e.horario)
  const semHorario = entradas.filter(e => !e.horario)
  const marcaveis = entradas.filter(e => e.tipo !== 'FOLLOW' && e.tipo !== 'LIGACAO')
  const feitos = marcaveis.filter(e => e.feito).length
  const agora = dia === hoje ? (fila ?? []).filter(i => i.prioridade >= 65).slice(0, 5) : []

  function resumoDoDia(d: string) {
    const r = rotinasDoDia(d), t = tarefasDoDia(d), f = followsDoDia(d), l = ligacoesDoDia(d)
    const total = r.length + t.length + f.length + l.length
    const feitosDia = r.filter(x => x.feito).length + t.filter(x => x.feitaEm).length
    const status = total === 0 ? null : feitosDia === total ? 'completo' : feitosDia > 0 ? 'parcial' : 'pendente'
    return { total, status }
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    const { titulo, horario } = lerTarefaRapida(novo)
    if (!titulo) return
    setSalvando(true); setErro('')
    try {
      const criada = await proLaboreApi.agenda.tarefas.criar({ titulo, dia, horario })
      setTarefas(ts => [...ts, criada]); setNovo('')
    } catch (err) { setErro((err as Error).message) } finally { setSalvando(false) }
  }
  async function alternarTarefa(t: AgendaTarefa) {
    try { const nova = await proLaboreApi.agenda.tarefas.editar(t.id, { feita: !t.feitaEm }); setTarefas(ts => ts.map(x => (x.id === t.id ? nova : x))) } catch (err) { setErro((err as Error).message) }
  }
  async function moverParaHoje(t: AgendaTarefa) {
    try { const nova = await proLaboreApi.agenda.tarefas.editar(t.id, { dia: hoje }); setTarefas(ts => ts.map(x => (x.id === t.id ? nova : x))) } catch (err) { setErro((err as Error).message) }
  }
  async function removerTarefa(t: AgendaTarefa) {
    try { await proLaboreApi.agenda.tarefas.remover(t.id); setTarefas(ts => ts.filter(x => x.id !== t.id)) } catch (err) { setErro((err as Error).message) }
  }
  async function followFeito(f: FollowComLead) {
    try { await proLaboreApi.follows.encerrar(f.id, { status: 'FEITO' }); setFollows(fs => (fs ?? []).filter(x => x.id !== f.id)) } catch (err) { setErro((err as Error).message) }
  }

  function linha(e: Entrada) {
    if (e.tipo === 'ROTINA') {
      const { item } = e.rotina
      return (
        <li key={e.chave} className={`md-item rotina ${e.feito ? 'feito' : ''}`} data-md={e.chave}>
          <span className="md-hora">{e.horario ?? '—'}</span>
          <button type="button" className={`md-check ${e.feito ? 'on' : ''}`} onClick={() => onAlternarRotina(item, dia)} aria-pressed={e.feito} aria-label={e.feito ? `Desmarcar: ${item.titulo}` : `Marcar como feito: ${item.titulo}`}>✓</button>
          <div className="md-corpo">
            <div className="md-titulo">{item.titulo}</div>
            <div className="md-meta"><span className="md-tag rotina">{e.rotina.categoria}</span>{item.exigeLocalizacao && <span title="Pede o selo de localização no check-in">📍 com localização</span>}{item.descricao && <span>{item.descricao}</span>}</div>
          </div>
        </li>
      )
    }
    if (e.tipo === 'LIGACAO') {
      const l = e.ligacao
      return (
        <li key={e.chave} className={`md-item follow ${e.atrasado ? 'atrasado' : ''}`} data-md={e.chave}>
          <span className="md-hora">{e.atrasado ? new Date(`${diaBR(new Date(l.agendadaPara))}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) : e.horario}</span>
          <span className="md-icone" aria-hidden="true">☎</span>
          <div className="md-corpo">
            <div className="md-titulo">Ligar: {l.lead.nomeCliente}</div>
            <div className="md-meta">
              <span className="md-tag follow">{rotuloPasso(l)}</span>
              <span>{[ETAPA[l.lead.estagio] ?? l.lead.estagio, l.lead.modeloInteresse, vejaEquipe ? l.lead.vendedor?.nome : null].filter(Boolean).join(' · ')}</span>
              {l.instrucao && <span className="md-nota">“{l.instrucao}”</span>}
            </div>
          </div>
          <div className="md-acoes">
            <BotaoLigar ligacao={l} telefone={l.lead.telefone} onDiscou={x => setLigacoes(ls => (ls ?? []).map(y => (y.id === x.id ? { ...y, ...x } : y)))} />
            <button type="button" className="md-link" onClick={() => setRegistrando(l)}>Registrar</button>
          </div>
        </li>
      )
    }
    if (e.tipo === 'FOLLOW') {
      const f = e.follow
      return (
        <li key={e.chave} className={`md-item follow ${e.atrasado ? 'atrasado' : ''}`} data-md={e.chave}>
          <span className="md-hora">{e.atrasado ? new Date(`${diaBR(new Date(f.agendadoPara))}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) : e.horario}</span>
          <span className="md-icone" aria-hidden="true">↻</span>
          <div className="md-corpo">
            <div className="md-titulo">{f.tipo === 'CREDITO' ? 'Nova análise de crédito' : 'Follow'}: {f.lead.nomeCliente}</div>
            <div className="md-meta">
              <span className="md-tag follow">{f.tipo === 'CREDITO' ? 'Crédito' : f.canal ? CANAL[f.canal] ?? f.canal : 'Follow'}</span>
              <span>{[ETAPA[f.lead.estagio] ?? f.lead.estagio, f.lead.modeloInteresse, vejaEquipe ? f.lead.vendedor?.nome : null].filter(Boolean).join(' · ')}</span>
              {f.tipo === 'CREDITO' ? <span className="md-nota">Chamar o cliente e, com a autorização dele, refazer a pré-análise</span> : f.nota && <span className="md-nota">“{f.nota}”</span>}
            </div>
          </div>
          <div className="md-acoes">
            <a className="pl-btn pl-btn-ghost" href={f.tipo === 'CREDITO' ? `/pro-labore/leads?lead=${f.lead.id}&follow=${f.id}` : `/pro-labore/leads?lead=${f.lead.id}`} data-abrir-follow>{f.tipo === 'CREDITO' ? 'Abrir' : 'Abrir lead'}</a>
            {f.tipo !== 'CREDITO' && <button type="button" className="md-link" onClick={() => followFeito(f)}>Feito</button>}
          </div>
        </li>
      )
    }
    const t = e.tarefa
    return (
      <li key={e.chave} className={`md-item tarefa ${e.feito ? 'feito' : ''} ${e.atrasada ? 'atrasado' : ''}`} data-md={e.chave}>
        <span className="md-hora">{e.atrasada ? new Date(`${t.dia.slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) : e.horario ?? '—'}</span>
        <button type="button" className={`md-check ${e.feito ? 'on' : ''}`} onClick={() => alternarTarefa(t)} aria-pressed={e.feito} aria-label={e.feito ? `Desmarcar: ${t.titulo}` : `Marcar como feito: ${t.titulo}`}>✓</button>
        <div className="md-corpo">
          <div className="md-titulo">{t.titulo}</div>
          <div className="md-meta"><span className="md-tag tarefa">Minha tarefa</span>{t.leadId && <a className="md-link" href={`/pro-labore/leads?lead=${t.leadId}`}>Abrir lead</a>}</div>
        </div>
        <div className="md-acoes">
          {e.atrasada && <button type="button" className="md-link" onClick={() => moverParaHoje(t)}>Passar para hoje</button>}
          <button type="button" className="md-link mudo" onClick={() => removerTarefa(t)} aria-label={`Apagar: ${t.titulo}`}>Apagar</button>
        </div>
      </li>
    )
  }

  return (
    <div className="md" data-meu-dia>
      <div className="md-semana-cab">
        <button type="button" className="pl-icon-btn" onClick={() => onDia(somaDias(dia, -7))} aria-label="Semana anterior">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="md-semana" role="tablist" aria-label="Dias da semana">
          {diasDaSemana.map(d => {
            const r = resumoDoDia(d)
            const n = new Date(`${d}T00:00:00Z`)
            return (
              <button key={d} type="button" role="tab" aria-selected={d === dia} className={`md-dia ${d === dia ? 'sel' : ''} ${d === hoje ? 'hoje' : ''}`} onClick={() => onDia(d)} data-md-dia={d}>
                <span>{DIAS[n.getUTCDay()]}</span>
                <b>{n.getUTCDate()}</b>
                <small>{r.total ? r.total : ''}{r.status && <i className={`pl-agenda-day-dot ${r.status}`} />}</small>
              </button>
            )
          })}
        </div>
        <button type="button" className="pl-icon-btn" onClick={() => onDia(somaDias(dia, 7))} aria-label="Próxima semana">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
        {dia !== hoje && <button type="button" className="pl-chip" onClick={() => onDia(hoje)}>Hoje</button>}
      </div>

      <div className="md-grade">
        <section className="pl-card md-principal" aria-label={`Meu dia: ${rotuloDia(dia)}`}>
          <div className="md-dia-cab">
            <div>
              <h2>{dia === hoje ? 'Hoje' : dia === somaDias(hoje, 1) ? 'Amanhã' : dia === somaDias(hoje, -1) ? 'Ontem' : DIAS[new Date(`${dia}T00:00:00Z`).getUTCDay()]}<span>{rotuloDia(dia)}</span></h2>
            </div>
            {marcaveis.length > 0 && (
              <div className="md-progresso" title="Rotinas e tarefas feitas no dia">
                <span>{feitos} de {marcaveis.length} feitos</span>
                <div className="pl-bar-track"><div className="pl-bar-fill" style={{ width: `${(feitos / marcaveis.length) * 100}%`, background: 'var(--pl-good)' }} /></div>
              </div>
            )}
          </div>

          <form className="md-novo" onSubmit={adicionar}>
            <input className="pl-input" value={novo} onChange={e => setNovo(e.target.value)} maxLength={200} placeholder={`Adicionar ${dia === hoje ? 'a hoje' : 'a este dia'}… ex.: 14:30 ligar para o banco`} aria-label="Nova tarefa" data-md-novo />
            <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando || !novo.trim()}>Adicionar</button>
          </form>
          {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 10 }}>{erro}</div>}

          {atrasados.length > 0 && (
            <div className="md-bloco atrasados" data-md-atrasados>
              <h3>Atrasados <span>{atrasados.length}</span></h3>
              <ol className="md-lista">{atrasados.map(linha)}</ol>
            </div>
          )}
          {entradas.length === 0 && atrasados.length === 0 ? (
            <p className="md-vazio">{dia < hoje ? 'Nada registrado neste dia.' : 'Dia livre por enquanto. Anote acima o que você quer fazer.'}</p>
          ) : (
            <>
              {comHorario.length > 0 && <div className="md-bloco"><h3>Na agenda</h3><ol className="md-lista">{comHorario.map(linha)}</ol></div>}
              {semHorario.length > 0 && <div className="md-bloco"><h3>Sem horário</h3><ol className="md-lista">{semHorario.map(linha)}</ol></div>}
            </>
          )}
        </section>

        {dia === hoje && fila && (
          <aside className="pl-card md-agora" aria-label="Pedindo atenção agora" data-md-agora>
            <h3>Pedindo atenção agora</h3>
            <p className="pl-hint">Do Copiloto: WhatsApp esperando, crédito aprovado, follows e sinais de compra.</p>
            {agora.length === 0 ? <p className="md-vazio">Ninguém esperando por você agora.</p> : (
              <ol className="md-agora-lista">
                {agora.map(i => (
                  <li key={i.chave}>
                    <span className={`md-urg ${i.prioridade >= 85 ? 'agora' : 'hoje'}`}>{i.prioridade >= 85 ? 'Agora' : 'Hoje'}</span>
                    <div>
                      <b>{i.nome}</b>
                      <p>{i.motivo.texto}</p>
                      {i.leadId && <a className="md-link" href={`/pro-labore/leads?lead=${i.leadId}`}>Abrir lead</a>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <a className="md-link" href="/pro-labore/copiloto">Ver tudo no Copiloto →</a>
          </aside>
        )}
      </div>
      {registrando && (
        <RegistrarLigacao
          ligacao={registrando} nomeCliente={registrando.lead.nomeCliente} onFechar={() => setRegistrando(null)}
          onRegistrou={r => { setRegistrando(null); setLigacoes(ls => [...(ls ?? []).filter(x => x.id !== r.feita.id), ...(r.proxima ? [{ ...r.proxima, lead: registrando.lead }] : [])]) }}
        />
      )}
    </div>
  )
}
