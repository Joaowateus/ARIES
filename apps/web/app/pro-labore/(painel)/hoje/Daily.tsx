'use client'

// Ajuste 1 · Daily: a reunião de 30 minutos da manhã. Oito blocos na ordem e no
// tempo configurados; cada um com cronômetro e "pular". Números de ontem pela
// comparação padrão, até 3 Recomendações da área, atividades críticas e os
// botões "Decidido" (vira ATV com origem reunião) e "Tratado". No fim, a ata
// é gerada e salva em Reuniões. Modo equipe: só totais e o que foi decidido.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { dailyApi, type BlocoDaily, type BlocoPauta, type ModoDaily, type NumeroDaily, type PautaDaily } from '@/lib/proLaboreApi'
import { StatusChip, TelaVazia, fmtValor } from '../_padrao/Padrao'

const amanha = () => { const d = new Date(Date.now() + 86_400_000); return d.toISOString().slice(0, 10) }
const mmss = (s: number) => `${s < 0 ? '−' : ''}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, '0')}`

export function Daily({ papel }: { papel: string }) {
  const [modo, setModo] = useState<ModoDaily>('GESTAO')
  const [pauta, setPauta] = useState<PautaDaily | null>(null)
  const [reuniao, setReuniao] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [segundos, setSegundos] = useState(0)
  const [feitos, setFeitos] = useState<Record<string, 'FEITO' | 'PULADO'>>({})
  const [ata, setAta] = useState<{ texto: string; titulo: string } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let vivo = true
    dailyApi.pauta(modo).then(p => { if (vivo) { setPauta(p); setCarregando(false) } }).catch(e => { if (vivo) { setMsg(e instanceof Error ? e.message : 'Não foi possível montar a pauta'); setCarregando(false) } })
    return () => { vivo = false }
  }, [modo])
  function trocarModo(m: ModoDaily) { if (m !== modo) { setCarregando(true); setModo(m) } }
  useEffect(() => {
    if (!reuniao) return
    tick.current = setInterval(() => setSegundos(s => s + 1), 1000)
    return () => { if (tick.current) clearInterval(tick.current) }
  }, [reuniao, idx])

  async function recarregar() { if (reuniao) setPauta(await dailyApi.pauta(modo, reuniao)) }
  async function comecar() {
    setMsg(null)
    try { const r = await dailyApi.iniciar(modo); setReuniao(r.id); setIdx(0); setSegundos(0); setFeitos({}); setAta(null) } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível começar') }
  }
  async function avancar(pular: boolean) {
    if (!pauta || !reuniao) return
    const b = pauta.blocos[idx]
    await dailyApi.bloco(reuniao, { bloco: b.chave, segundos, pulado: pular }).catch(() => undefined)
    setFeitos(f => ({ ...f, [b.chave]: pular ? 'PULADO' : 'FEITO' }))
    setSegundos(0)
    if (idx < pauta.blocos.length - 1) setIdx(idx + 1)
    else await encerrar()
  }
  async function encerrar() {
    if (!reuniao) return
    try { const r = await dailyApi.encerrar(reuniao); setAta({ texto: r.texto, titulo: r.titulo }); setReuniao(null); if (tick.current) clearInterval(tick.current) } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível encerrar') }
  }

  if (ata) return (
    <section className="pl-card" data-ata-daily>
      <div className="pl-card-title">{ata.titulo}: ata gerada</div>
      <p className="pl-hint">Salva em Reuniões{modo === 'EQUIPE' ? ' (só o que foi decidido)' : ''}. As decisões viraram atividades com origem &quot;reunião&quot; e seguem a régua.</p>
      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, background: 'var(--pl-surface-2)', padding: 12, borderRadius: 8 }}>{ata.texto}</pre>
      <div style={{ display: 'flex', gap: 8 }}><Link className="pl-btn pl-btn-primary" href="/pro-labore/reunioes">Abrir em Reuniões</Link><button type="button" className="pl-btn" onClick={() => setAta(null)}>Voltar ao Daily</button></div>
    </section>
  )
  if (!pauta) return <p className="pl-hint">{msg ?? (carregando ? 'Montando a pauta do Daily…' : '')}</p>
  const b = pauta.blocos[idx]
  const limite = (b?.minutos ?? 0) * 60
  return (
    <div data-daily={modo}>
      <header className="ar-cabecalho" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="ar-titulo" style={{ margin: 0 }}>Daily</h1>
          <p className="pl-hint" style={{ margin: '4px 0 0' }}>O que discutir e decidir na reunião da manhã? · {pauta.totalMinutos} min em {pauta.blocos.length} blocos · {papel === 'DONO' ? 'Dono' : 'Supervisor'}</p>
        </div>
      </header>
      {!reuniao && (
        <section className="pl-card" style={{ marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }} data-daily-inicio>
          <div className="pl-sv-tabs" role="tablist" aria-label="Modo do Daily">
            <button type="button" role="tab" aria-selected={modo === 'GESTAO'} className={modo === 'GESTAO' ? 'ativo' : ''} onClick={() => trocarModo('GESTAO')} data-modo="GESTAO">Modo gestão</button>
            <button type="button" role="tab" aria-selected={modo === 'EQUIPE'} className={modo === 'EQUIPE' ? 'ativo' : ''} onClick={() => trocarModo('EQUIPE')} data-modo="EQUIPE">Modo equipe (projetar)</button>
          </div>
          <span className="pl-hint" style={{ flex: 1, minWidth: 220 }}>{modo === 'GESTAO' ? 'Todos os números, por pessoa e totais; todas as Recomendações; atividades por pessoa.' : 'Só totais da equipe e de cada área; só Recomendações de equipe e de etapa; só o que for decidido.'}</span>
          <button type="button" className="pl-btn pl-btn-primary" onClick={() => void comecar()} disabled={carregando} data-comecar-daily>Começar o Daily</button>
        </section>
      )}
      {msg && <p className="pl-hint" role="alert">{msg}</p>}
      <ol className="pl-sv-tabs" style={{ listStyle: 'none', margin: '0 0 12px', display: 'flex' }} aria-label="Blocos" data-blocos-daily>
        {pauta.blocos.map((x, i) => (
          <li key={x.chave}><button type="button" className={i === idx ? 'ativo' : ''} onClick={() => { setIdx(i); setSegundos(0) }} aria-current={i === idx ? 'step' : undefined} data-bloco-tab={x.chave}>
            {feitos[x.chave] === 'FEITO' ? '✓ ' : feitos[x.chave] === 'PULADO' ? '↷ ' : `${i + 1}. `}{x.nome} · {x.minutos}′
          </button></li>
        ))}
      </ol>
      {b && (
        <section className="pl-card" data-bloco={b.chave}>
          <div className="pl-card-head" style={{ alignItems: 'center' }}>
            <div>
              <div className="pl-card-title">{idx + 1}. {b.nome}</div>
              {b.semPessoa && <div className="pl-card-sub">{b.semPessoa}</div>}
            </div>
            {reuniao && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: segundos > limite ? 'var(--pl-critical)' : 'var(--pl-ink-1)' }} data-cronometro aria-live="off">{mmss(limite - segundos)}</span>
                <button type="button" className="pl-btn" onClick={() => void avancar(true)} data-pular-bloco>Pular</button>
                <button type="button" className="pl-btn pl-btn-primary" onClick={() => void avancar(false)} data-proximo-bloco>{idx < pauta.blocos.length - 1 ? 'Próximo bloco' : 'Encerrar e gerar a ata'}</button>
              </div>
            )}
          </div>
          <Numeros numeros={b.numeros} />
          <Recs bloco={b} reuniao={reuniao} modo={modo} aoMudar={recarregar} equipe={pauta.equipe} />
          {modo === 'GESTAO' && <Atividades bloco={b} reuniao={reuniao} aoMudar={recarregar} equipe={pauta.equipe} />}
          <Decididas bloco={b} />
          {reuniao && <Decidir key={b.chave} bloco={b} reuniao={reuniao} equipe={pauta.equipe} aoMudar={recarregar} />}
          {!reuniao && <p className="pl-hint" style={{ marginBottom: 0 }}>Comece o Daily para usar o cronômetro, decidir e tratar.</p>}
        </section>
      )}
      {reuniao && <p style={{ marginTop: 10 }}><button type="button" className="pl-btn" onClick={() => void encerrar()} data-encerrar-daily>Encerrar agora e gerar a ata</button></p>}
    </div>
  )
}

function Numeros({ numeros }: { numeros: NumeroDaily[] }) {
  if (!numeros.length) return <p className="pl-hint">Sem números deste bloco para você.</p>
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, margin: '6px 0 14px' }}>
      {numeros.map(n => (
        <div key={n.rotulo} className="ar-numero" style={{ border: '1px solid var(--pl-border)', borderRadius: 10, padding: 10 }} data-numero-daily={n.chave} title={`${n.ficha.definicao}. ${n.ficha.formula}`}>
          <div className="pl-hint" style={{ fontSize: 12 }}>{n.rotulo}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <b style={{ fontSize: 20 }}>{n.naoDefinido ? '—' : fmtValor(n.valor, n.unidade)}</b>
            {n.junto && <span className="pl-hint">{n.junto.valor ?? 0} {n.junto.nome.toLowerCase()}</span>}
            <StatusChip status={n.status ?? undefined} />
          </div>
          <div className="pl-hint" style={{ fontSize: 12 }}>
            {n.alvo?.valor != null ? `${n.alvo.rotulo}: ${fmtValor(n.alvo.valor, n.unidade)}` : ''}
            {n.variacao != null ? `${n.alvo?.valor != null ? ' · ' : ''}${n.variacao > 0 ? '+' : ''}${n.variacao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% contra o mesmo intervalo anterior` : ''}
          </div>
          {n.porPessoa && <div style={{ marginTop: 6, fontSize: 12 }} data-por-pessoa>{n.porPessoa.map(p => <span key={p.id} style={{ marginRight: 10 }}>{p.nome}: <b>{fmtValor(p.valor, n.unidade)}</b></span>)}</div>}
        </div>
      ))}
    </div>
  )
}

function Recs({ bloco, reuniao, modo, aoMudar, equipe }: { bloco: BlocoPauta; reuniao: string | null; modo: ModoDaily; aoMudar: () => Promise<void>; equipe: Array<{ id: string; nome: string }> }) {
  const [tratados, setTratados] = useState<Set<string>>(new Set())
  if (!bloco.recs.length) return <p className="pl-hint">Nenhuma Recomendação aberta {modo === 'EQUIPE' ? 'de equipe ou de etapa ' : ''}neste bloco.</p>
  async function tratar(id: string, texto: string, individual: boolean) {
    if (!reuniao) return
    await dailyApi.tratar(reuniao, { bloco: bloco.chave, tipo: 'REC', ref: id, texto, individual }); setTratados(s => new Set(s).add(id)); await aoMudar()
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="ar-fila-grupo">Recomendações da área</div>
      <ul className="ar-fila">{bloco.recs.map(r => (
        <li key={r.id} className="ar-fila-item" data-rec-daily={r.id}>
          <div style={{ flex: 1 }}>
            <div className="ar-fila-titulo"><Link href={`/pro-labore/recomendacoes?rec=${r.id}`}>{r.codigo ? `${r.codigo} · ` : ''}{r.titulo}</Link></div>
            <div className="ar-fila-det">{r.acao}{r.impacto ? ` · ${r.impacto}` : ''}{r.individual ? ' · orientação individual' : ''}</div>
          </div>
          {reuniao && (tratados.has(r.id) ? <span className="pl-hint">Tratado</span> : <>
            <button type="button" className="pl-btn" onClick={() => void tratar(r.id, r.titulo, r.individual)} data-tratar>Tratado</button>
            <DecidirRapido bloco={bloco} reuniao={reuniao} texto={r.acao} equipe={equipe} aoMudar={aoMudar} />
          </>)}
        </li>
      ))}</ul>
    </div>
  )
}

function Atividades({ bloco, reuniao, aoMudar, equipe }: { bloco: BlocoPauta; reuniao: string | null; aoMudar: () => Promise<void>; equipe: Array<{ id: string; nome: string }> }) {
  const [tratados, setTratados] = useState<Set<string>>(new Set())
  if (!bloco.atividades.length) return <p className="pl-hint">Nenhuma atividade atrasada ou vencendo hoje neste bloco.</p>
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="ar-fila-grupo">Atividades críticas · {bloco.atividades.length}</div>
      <ul className="ar-fila">{bloco.atividades.map(a => (
        <li key={a.id} className="ar-fila-item" data-atv-daily={a.id}>
          <div style={{ flex: 1 }}>
            <div className="ar-fila-titulo">{a.codigo ? `${a.codigo} · ` : ''}{a.oQue}{a.cliente ? ` (${a.cliente})` : ''}</div>
            <div className="ar-fila-det">{a.responsavel} · {a.atrasada ? 'atrasada desde' : 'vence'} {new Date(a.prazo).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          {reuniao && (tratados.has(a.id) ? <span className="pl-hint">Tratado</span> : <>
            <button type="button" className="pl-btn" onClick={() => void dailyApi.tratar(reuniao, { bloco: bloco.chave, tipo: 'ATV', ref: a.id, texto: `${a.oQue} (${a.responsavel})` }).then(() => setTratados(s => new Set(s).add(a.id)))}>Tratado</button>
            <DecidirRapido bloco={bloco} reuniao={reuniao} texto={a.oQue} equipe={equipe} aoMudar={aoMudar} />
          </>)}
        </li>
      ))}</ul>
    </div>
  )
}

function Decididas({ bloco }: { bloco: BlocoPauta }) {
  if (!bloco.decididas.length) return null
  return (
    <div style={{ marginBottom: 12 }} data-decididas>
      <div className="ar-fila-grupo">Decidido nesta reunião</div>
      <ul className="ar-fila">{bloco.decididas.map(d => <li key={d.id} className="ar-fila-item"><div style={{ flex: 1 }}><div className="ar-fila-titulo">{d.codigo ? `${d.codigo} · ` : ''}{d.oQue}</div><div className="ar-fila-det">{d.responsavel} · até {new Date(d.prazo).toLocaleDateString('pt-BR')}</div></div></li>)}</ul>
    </div>
  )
}

function DecidirRapido(props: { bloco: BlocoPauta; reuniao: string; texto: string; equipe: Array<{ id: string; nome: string }>; aoMudar: () => Promise<void> }) {
  const [aberto, setAberto] = useState(false)
  if (!aberto) return <button type="button" className="pl-btn pl-btn-primary" onClick={() => setAberto(true)} data-decidido>Decidido</button>
  return <Decidir {...props} inicial={props.texto} aoFechar={() => setAberto(false)} />
}

function Decidir({ bloco, reuniao, equipe, aoMudar, inicial = '', aoFechar }: { bloco: BlocoPauta; reuniao: string; equipe: Array<{ id: string; nome: string }>; aoMudar: () => Promise<void>; inicial?: string; aoFechar?: () => void }) {
  const [texto, setTexto] = useState(inicial)
  const [resp, setResp] = useState<string>(bloco.responsavelSugerido ?? '')
  const [prazo, setPrazo] = useState(amanha())
  const [msg, setMsg] = useState<string | null>(null)
  async function salvar() {
    setMsg(null)
    try {
      const r = await dailyApi.decidir(reuniao, { bloco: bloco.chave as BlocoDaily, texto, responsavelId: resp || null, prazo: new Date(`${prazo}T21:00:00.000Z`).toISOString() })
      setMsg(`Atividade ${r.atividade.codigo ?? ''} criada para ${r.responsavel}.`); setTexto(''); await aoMudar(); aoFechar?.()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') }
  }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8, width: '100%' }} data-form-decidido>
      <input className="pl-input" style={{ flex: 2, minWidth: 200 }} value={texto} onChange={e => setTexto(e.target.value)} placeholder="O que foi decidido" aria-label="O que foi decidido" />
      <select className="pl-input" style={{ flex: 1, minWidth: 140 }} value={resp} onChange={e => setResp(e.target.value)} aria-label="Responsável">
        <option value="">Dono</option>
        {equipe.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
      </select>
      <input className="pl-input" type="date" style={{ width: 150 }} value={prazo} onChange={e => setPrazo(e.target.value)} aria-label="Prazo" />
      <button type="button" className="pl-btn pl-btn-primary" onClick={() => void salvar()} data-salvar-decidido>Decidido</button>
      {aoFechar && <button type="button" className="pl-btn" onClick={aoFechar}>Cancelar</button>}
      {msg && <span className="pl-hint" role="status">{msg}</span>}
    </div>
  )
}

export function DailyVazio() { return <TelaVazia titulo="Sem blocos ligados">Ligue os blocos do Daily em Configurações.</TelaVazia> }
