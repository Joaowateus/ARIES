'use client'

// PDF 06 · seção 4: o Daily apresenta e decide. A pauta vem de duas fontes (a
// automática e o que foi levado do Hoje); o primeiro bloco são as pendências do
// Daily anterior. "Começar o Daily" abre a apresentação em tela cheia, um bloco
// por tela, com o cronômetro do bloco e o tempo total; dá para transmitir pela
// apresentação ao vivo de Reuniões (o espectador vê sempre o modo equipe). Cada
// item termina em Decidido (uma atividade por responsável), Tratado ou Adiar.
// Ao encerrar: a ata vai para Reuniões, cada responsável recebe as tarefas no
// WhatsApp e quem conduz vê o resumo final.
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { dailyApi, type BlocoDaily, type BlocoPauta, type ModoDaily, type PautaDaily, type PrioridadeDaily, type ResumoFinalDaily } from '@/lib/proLaboreApi'
import { TelaVazia } from '../_padrao/Padrao'
import { ItensSlide, NumerosSlide, type ItemSlide } from './SlideDaily'

const hojeIso = () => new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)
const amanha = () => new Date(Date.now() - 3 * 3_600_000 + 86_400_000).toISOString().slice(0, 10)
const mmss = (s: number) => `${s < 0 ? '−' : ''}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, '0')}`
const min = (s: number) => `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`

export function Daily({ papel }: { papel: string }) {
  const [modo, setModo] = useState<ModoDaily>('GESTAO')
  const [pauta, setPauta] = useState<PautaDaily | null>(null)
  const [reuniao, setReuniao] = useState<string | null>(null)
  const [apresentacao, setApresentacao] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [seg, setSeg] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [feitos, setFeitos] = useState<Record<string, 'FEITO' | 'PULADO'>>({})
  const [fim, setFim] = useState<{ texto: string; titulo: string; resumo: ResumoFinalDaily } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [participantes, setParticipantes] = useState<Set<string> | null>(null)
  const [transmitir, setTransmitir] = useState(false)
  const [decidindo, setDecidindo] = useState<ItemSlide | 'NOVA' | null>(null)
  const equipeRef = useRef<PautaDaily | null>(null)

  useEffect(() => {
    let vivo = true
    dailyApi.pauta(modo).then(p => { if (vivo) { setPauta(p); setCarregando(false); setParticipantes(s => s ?? new Set(p.equipe.map(x => x.id))) } }).catch(e => { if (vivo) { setMsg(e instanceof Error ? e.message : 'Não foi possível montar a pauta'); setCarregando(false) } })
    return () => { vivo = false }
  }, [modo])
  function trocarModo(m: ModoDaily) { if (m !== modo) { setCarregando(true); setModo(m) } }

  const bloco = pauta?.blocos[idx]
  // Cronômetro do bloco e tempo total da reunião.
  useEffect(() => {
    if (!reuniao || !bloco) return
    const t = setInterval(() => { setSeg(s => ({ ...s, [bloco.chave]: (s[bloco.chave] ?? 0) + 1 })); setTotal(x => x + 1) }, 1000)
    return () => clearInterval(t)
  }, [reuniao, bloco])

  // Transmissão: o slide do bloco atual no modo equipe (pauta equipe), a cada mudança e a cada 15 s (sinal de vida).
  const enviarPalco = useCallback(async () => {
    if (!reuniao || !apresentacao || !pauta) return
    const eq = equipeRef.current
    const b = pauta.blocos[idx]
    const be = eq?.blocos.find(x => x.chave === b?.chave) ?? null
    await dailyApi.palco(reuniao, { tipo: 'DAILY', indice: idx, total: pauta.blocos.length, nomes: pauta.blocos.map(x => x.nome), bloco: be, minutos: b?.minutos ?? 0, segundosBloco: seg[b?.chave ?? ''] ?? 0, segundosTotal: total, totalMinutos: pauta.totalMinutos, em: new Date().toISOString() }).catch(() => undefined)
  }, [reuniao, apresentacao, pauta, idx, seg, total])
  const enviarRef = useRef(enviarPalco)
  useEffect(() => { enviarRef.current = enviarPalco })
  useEffect(() => { void enviarRef.current() }, [idx, apresentacao, pauta])
  useEffect(() => {
    if (!apresentacao) return
    const t = setInterval(() => void enviarRef.current(), 15_000)
    return () => clearInterval(t)
  }, [apresentacao])

  async function recarregar() {
    if (!reuniao) return
    const [p, eq] = await Promise.all([dailyApi.pauta(modo, reuniao), apresentacao ? dailyApi.pauta('EQUIPE', reuniao) : Promise.resolve(null)])
    setPauta(p); if (eq) equipeRef.current = eq
  }
  async function comecar() {
    setMsg(null)
    // Tela cheia no clique (o navegador só deixa com o gesto da pessoa); a apresentação também ocupa a janela toda.
    document.documentElement.requestFullscreen?.().catch(() => undefined)
    try {
      const r = await dailyApi.iniciar(modo, { participantes: participantes ? [...participantes] : undefined, transmitir })
      setReuniao(r.id); setApresentacao(r.apresentacaoId); setIdx(0); setSeg({}); setTotal(0); setFeitos({}); setFim(null)
      const [p, eq] = await Promise.all([dailyApi.pauta(modo, r.id), r.apresentacaoId ? dailyApi.pauta('EQUIPE', r.id) : Promise.resolve(null)])
      setPauta(p); equipeRef.current = eq
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível começar') }
  }
  async function irPara(novo: number, pular = false) {
    if (!pauta || !reuniao || !bloco) return
    await dailyApi.bloco(reuniao, { bloco: bloco.chave, segundos: seg[bloco.chave] ?? 0, pulado: pular }).catch(() => undefined)
    setFeitos(f => ({ ...f, [bloco.chave]: pular ? 'PULADO' : 'FEITO' }))
    if (novo >= 0 && novo < pauta.blocos.length) setIdx(novo)
  }
  async function encerrar() {
    if (!reuniao || !bloco) return
    await dailyApi.bloco(reuniao, { bloco: bloco.chave, segundos: seg[bloco.chave] ?? 0, pulado: false }).catch(() => undefined)
    try {
      const r = await dailyApi.encerrar(reuniao)
      setFim({ texto: r.texto, titulo: r.titulo, resumo: r.resumo }); setReuniao(null); setApresentacao(null)
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível encerrar') }
  }
  // Setas do teclado: anterior e próximo bloco.
  useEffect(() => {
    if (!reuniao) return
    const f = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return
      if (e.key === 'ArrowRight') void irPara(idx + 1)
      if (e.key === 'ArrowLeft') void irPara(idx - 1)
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  })

  const acoes = reuniao && bloco ? {
    decidir: (item: ItemSlide) => setDecidindo(item),
    tratar: async (item: ItemSlide) => { await dailyApi.tratar(reuniao, { bloco: bloco.chave, tipo: item.tipo, ref: item.ref, texto: item.texto, individual: item.individual }); await recarregar() },
    adiar: async (item: ItemSlide, motivo: string) => { await dailyApi.adiar(reuniao, { bloco: bloco.chave, tipo: item.tipo, ref: item.ref, texto: item.texto, motivo }); await recarregar() },
  } : undefined

  if (fim) return <ResumoFinal fim={fim} aoVoltar={() => { setFim(null); setCarregando(true); dailyApi.pauta(modo).then(setPauta).finally(() => setCarregando(false)) }} />
  if (!pauta) return <p className="pl-hint">{msg ?? (carregando ? 'Montando a pauta do Daily…' : '')}</p>
  if (!pauta.blocos.length) return <DailyVazio />

  // --- Modo apresentação (tela cheia, um bloco por tela) ---
  if (reuniao && bloco) {
    const limite = bloco.minutos * 60
    const s = seg[bloco.chave] ?? 0
    return (
      <div role="dialog" aria-modal="true" aria-label="Daily em apresentação" data-apresentacao data-daily={modo}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--pl-bg, var(--pl-surface))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--pl-border)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="pl-hint" style={{ fontSize: 12 }}>Daily · {modo === 'EQUIPE' ? 'modo equipe' : 'modo gestão'} · bloco {idx + 1} de {pauta.blocos.length}</div>
            <h1 style={{ margin: 0, fontSize: 26 }} data-bloco-titulo>{bloco.nome}</h1>
            {bloco.semPessoa && <div className="pl-hint">{bloco.semPessoa}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="pl-hint" style={{ fontSize: 11 }}>Bloco ({bloco.minutos} min)</div>
            <b style={{ fontSize: 28, fontVariantNumeric: 'tabular-nums', color: s > limite ? 'var(--pl-critical)' : 'var(--pl-ink-1)' }} data-cronometro>{mmss(limite - s)}</b>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="pl-hint" style={{ fontSize: 11 }}>Reunião ({pauta.totalMinutos} min)</div>
            <b style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums', color: total > pauta.totalMinutos * 60 ? 'var(--pl-critical)' : 'var(--pl-ink-1)' }} data-tempo-total>{mmss(total)}</b>
          </div>
        </header>
        {apresentacao && (
          <div className="pl-hint" style={{ padding: '6px 20px', fontSize: 12, borderBottom: '1px solid var(--pl-border)' }} data-link-transmissao>
            Ao vivo para a equipe (modo equipe): <a href={`/pro-labore/daily-ao-vivo/${apresentacao}`} target="_blank" rel="noreferrer">{typeof window !== 'undefined' ? window.location.origin : ''}/pro-labore/daily-ao-vivo/{apresentacao}</a>
          </div>
        )}
        <main style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }} data-bloco={bloco.chave}>
          <NumerosSlide numeros={bloco.numeros} grande />
          <ItensSlide bloco={bloco} acoes={acoes} modoEquipe={modo === 'EQUIPE'} />
          <p style={{ marginTop: 16 }}><button type="button" className="pl-btn" onClick={() => setDecidindo('NOVA')} data-nova-decisao>+ Registrar outra decisão neste bloco</button></p>
          {msg && <p className="pl-hint" role="alert">{msg}</p>}
        </main>
        <footer style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 20px', borderTop: '1px solid var(--pl-border)', flexWrap: 'wrap' }}>
          <button type="button" className="pl-btn" onClick={() => void irPara(idx - 1)} disabled={idx === 0} data-anterior aria-label="Bloco anterior">← Anterior</button>
          <ol style={{ display: 'flex', gap: 4, listStyle: 'none', margin: 0, padding: 0, flex: 1, flexWrap: 'wrap' }} aria-label="Blocos" data-blocos-daily>
            {pauta.blocos.map((x, i) => (
              <li key={x.chave}><button type="button" className="pl-btn" style={{ padding: '2px 8px', fontSize: 12, fontWeight: i === idx ? 700 : 400 }} aria-current={i === idx ? 'step' : undefined} onClick={() => void irPara(i)} data-bloco-tab={x.chave}>
                {feitos[x.chave] === 'FEITO' ? '✓ ' : feitos[x.chave] === 'PULADO' ? '↷ ' : `${i + 1}. `}{x.nome}
              </button></li>
            ))}
          </ol>
          <button type="button" className="pl-btn" onClick={() => void irPara(idx + 1, true)} disabled={idx === pauta.blocos.length - 1} data-pular-bloco>Pular</button>
          {idx < pauta.blocos.length - 1
            ? <button type="button" className="pl-btn pl-btn-primary" onClick={() => void irPara(idx + 1)} data-proximo-bloco aria-label="Próximo bloco">Próximo →</button>
            : <button type="button" className="pl-btn pl-btn-primary" onClick={() => void encerrar()} data-proximo-bloco>Encerrar e gerar a ata</button>}
          <button type="button" className="pl-btn" onClick={() => void encerrar()} data-encerrar-daily>Encerrar agora</button>
        </footer>
        {decidindo && <Decidir bloco={bloco} reuniao={reuniao} equipe={pauta.equipe} item={decidindo === 'NOVA' ? null : decidindo} aoFechar={() => setDecidindo(null)} aoSalvar={async () => { setDecidindo(null); await recarregar() }} />}
      </div>
    )
  }

  // --- Antes de começar: modo, participantes, transmissão e a prévia da pauta ---
  return (
    <div data-daily={modo}>
      <header className="ar-cabecalho" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="ar-titulo" style={{ margin: 0 }}>Daily</h1>
          <p className="pl-hint" style={{ margin: '4px 0 0' }}>O que apresentar e decidir com os responsáveis? · {pauta.totalMinutos} min em {pauta.blocos.length} blocos · {papel === 'DONO' ? 'Dono' : 'Supervisor'}</p>
        </div>
      </header>
      <section className="pl-card" style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }} data-daily-inicio>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="pl-sv-tabs" role="tablist" aria-label="Modo do Daily">
            <button type="button" role="tab" aria-selected={modo === 'GESTAO'} className={modo === 'GESTAO' ? 'ativo' : ''} onClick={() => trocarModo('GESTAO')} data-modo="GESTAO">Modo gestão</button>
            <button type="button" role="tab" aria-selected={modo === 'EQUIPE'} className={modo === 'EQUIPE' ? 'ativo' : ''} onClick={() => trocarModo('EQUIPE')} data-modo="EQUIPE">Modo equipe (projetar)</button>
          </div>
          <span className="pl-hint" style={{ flex: 1, minWidth: 220 }}>{modo === 'GESTAO' ? 'Todos os números, por pessoa e totais; todas as Recomendações; atividades por pessoa.' : 'Só totais da equipe e de cada área; só Recomendações de equipe e de etapa; só o que for decidido.'}</span>
        </div>
        <details data-participantes>
          <summary style={{ cursor: 'pointer' }}>Participantes ({participantes?.size ?? 0})</summary>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            {pauta.equipe.map(p => (
              <label key={p.id} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={participantes?.has(p.id) ?? true} onChange={e => setParticipantes(s => { const n = new Set(s ?? []); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n })} />{p.nome}
              </label>
            ))}
          </div>
        </details>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={transmitir} onChange={e => setTransmitir(e.target.checked)} data-transmitir />
          Transmitir para a equipe pela apresentação ao vivo de Reuniões (quem assiste vê sempre o modo equipe)
        </label>
        <div><button type="button" className="pl-btn pl-btn-primary" onClick={() => void comecar()} disabled={carregando} data-comecar-daily>Começar o Daily</button></div>
      </section>
      {msg && <p className="pl-hint" role="alert">{msg}</p>}
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }} data-blocos-daily>
        {pauta.blocos.map((x, i) => <PreviaBloco key={x.chave} b={x} i={i} modo={modo} />)}
      </ol>
    </div>
  )
}

function PreviaBloco({ b, i, modo }: { b: BlocoPauta; i: number; modo: ModoDaily }) {
  const [aberto, setAberto] = useState(i === 0)
  const enviados = b.enviados?.length ?? 0
  return (
    <li className="pl-card" data-bloco={b.chave}>
      <button type="button" onClick={() => setAberto(a => !a)} aria-expanded={aberto} style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 8, width: '100%', alignItems: 'center' }} data-bloco-tab={b.chave}>
        <b style={{ flex: 1 }}>{i + 1}. {b.nome} · {b.minutos}′</b>
        {enviados > 0 && <span className="pl-hint" style={{ fontSize: 12 }} data-qtd-enviados>{enviados} {enviados === 1 ? 'item levado do Hoje' : 'itens levados do Hoje'}</span>}
        <span aria-hidden>{aberto ? '▾' : '▸'}</span>
      </button>
      {aberto && <div style={{ marginTop: 10 }}><NumerosSlide numeros={b.numeros} /><ItensSlide bloco={b} modoEquipe={modo === 'EQUIPE'} /></div>}
    </li>
  )
}

function Decidir({ bloco, reuniao, equipe, item, aoFechar, aoSalvar }: { bloco: BlocoPauta; reuniao: string; equipe: Array<{ id: string; nome: string }>; item: ItemSlide | null; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const [texto, setTexto] = useState(item?.texto ?? '')
  const [resp, setResp] = useState<Set<string>>(new Set(bloco.responsavelSugerido ? [bloco.responsavelSugerido] : []))
  const [prazo, setPrazo] = useState(amanha())
  const [prioridade, setPrioridade] = useState<PrioridadeDaily>('MEDIA')
  const [msg, setMsg] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  async function salvar() {
    setMsg(null)
    if (texto.trim().length < 3) { setMsg('Escreva o que fazer.'); return }
    if (!resp.size) { setMsg('Escolha quem vai fazer (uma ou mais pessoas).'); return }
    if (!prazo) { setMsg('Escolha o prazo.'); return }
    setSalvando(true)
    try {
      await dailyApi.decidir(reuniao, { bloco: bloco.chave as BlocoDaily, texto: texto.trim(), responsaveis: [...resp], prazo, prioridade, itemTipo: item?.tipo, itemRef: item?.ref ?? null })
      await aoSalvar()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível'); setSalvando(false) }
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Registrar a decisão" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center', zIndex: 1001, padding: 16 }} data-form-decidido>
      <div className="pl-card" style={{ width: 'min(560px, 100%)', maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="pl-card-title">Decidido · {bloco.nome}</div>
        <label style={{ fontSize: 13 }}>O que fazer
          <textarea className="pl-input" style={{ width: '100%', minHeight: 60 }} value={texto} onChange={e => setTexto(e.target.value)} aria-label="O que fazer" data-decisao-texto />
        </label>
        <fieldset style={{ border: '1px solid var(--pl-border)', borderRadius: 8, padding: 8 }} data-responsaveis>
          <legend style={{ fontSize: 13 }}>Responsáveis (obrigatório; uma atividade para cada pessoa)</legend>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {equipe.map(p => (
              <label key={p.id} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={resp.has(p.id)} onChange={e => setResp(s => { const n = new Set(s); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n })} data-responsavel={p.id} />{p.nome}
              </label>
            ))}
          </div>
        </fieldset>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13 }}>Prazo (vence no fim do expediente)
            <input className="pl-input" type="date" min={hojeIso()} value={prazo} onChange={e => setPrazo(e.target.value)} aria-label="Prazo" style={{ display: 'block' }} data-decisao-prazo />
          </label>
          <label style={{ fontSize: 13 }}>Prioridade
            <select className="pl-input" value={prioridade} onChange={e => setPrioridade(e.target.value as PrioridadeDaily)} aria-label="Prioridade" style={{ display: 'block' }} data-decisao-prioridade>
              <option value="ALTA">Alta</option><option value="MEDIA">Média</option><option value="BAIXA">Baixa</option>
            </select>
          </label>
        </div>
        {msg && <p className="pl-hint" role="alert" style={{ margin: 0 }}>{msg}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="pl-btn" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="pl-btn pl-btn-primary" onClick={() => void salvar()} disabled={salvando} data-salvar-decidido>{salvando ? 'Salvando…' : `Criar ${resp.size > 1 ? `${resp.size} atividades` : 'a atividade'}`}</button>
        </div>
      </div>
    </div>
  )
}

function ResumoFinal({ fim, aoVoltar }: { fim: { texto: string; titulo: string; resumo: ResumoFinalDaily }; aoVoltar: () => void }) {
  const r = fim.resumo
  return (
    <section className="pl-card" data-ata-daily data-resumo-final>
      <div className="pl-card-title">{fim.titulo}: reunião encerrada</div>
      <p style={{ fontSize: 15 }}><b>{r.decisoes}</b> {r.decisoes === 1 ? 'decisão' : 'decisões'} ({r.atividades} {r.atividades === 1 ? 'atividade' : 'atividades'}) · {r.tratados} tratados · {r.adiados} adiados · {min(r.segundos)}</p>
      {r.porPessoa.length > 0 && (
        <div style={{ marginBottom: 10 }} data-resumo-pessoas>
          <div className="ar-fila-grupo">Para quem</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{r.porPessoa.map(p => <li key={p.nome}>{p.nome}: {p.tarefas} {p.tarefas === 1 ? 'tarefa' : 'tarefas'} · {p.whatsapp ? 'enviadas no WhatsApp' : 'sem WhatsApp ligado: vê em Atividades'}</li>)}</ul>
        </div>
      )}
      <div style={{ marginBottom: 10 }} data-resumo-blocos>
        <div className="ar-fila-grupo">Tempo por bloco</div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>{r.blocos.map(b => <li key={b.chave}>{b.nome}: {b.pulado ? 'pulado' : min(b.segundos)}</li>)}</ul>
      </div>
      <details><summary style={{ cursor: 'pointer' }}>Ver a ata</summary>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, background: 'var(--pl-surface-2)', padding: 12, borderRadius: 8 }}>{fim.texto}</pre>
      </details>
      <p className="pl-hint">A ata está salva em Reuniões. As decisões viraram atividades com origem &quot;reunião&quot;, uma por responsável, e seguem a régua.</p>
      <div style={{ display: 'flex', gap: 8 }}><Link className="pl-btn pl-btn-primary" href="/pro-labore/reunioes">Abrir em Reuniões</Link><button type="button" className="pl-btn" onClick={aoVoltar}>Voltar ao Daily</button></div>
    </section>
  )
}

export function DailyVazio() { return <TelaVazia titulo="Sem blocos ligados">Ligue os blocos do Daily em Configurações.</TelaVazia> }
