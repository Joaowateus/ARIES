'use client'

// PDF 06 · seção 3: o Hoje como bússola do dia. Frase do dia (da biblioteca
// aprovada, com autor e fonte), o resumo do ARIES e um cartão por área:
// situação, o que está bom, onde olhar primeiro, oportunidade com impacto
// estimado, dica do ARIES e até 3 números de apoio. Cada ponto de atenção,
// oportunidade ou Recomendação tem "Levar ao Daily".
import { useEffect, useState } from 'react'
import { Minilinha, Variacao, type SerieDia } from './Graficos'
import Link from 'next/link'
import { bussolaApi, type BussolaHoje, type CartaoBussola, type LevarDaily, type PontoBussola } from '@/lib/proLaboreApi'

const COR: Record<CartaoBussola['cor'], { fundo: string; borda: string; rotulo: string }> = {
  VERDE: { fundo: 'var(--pl-good-bg, rgba(22,163,74,.08))', borda: 'var(--pl-good, #16a34a)', rotulo: 'Verde' },
  AMARELO: { fundo: 'var(--pl-warn-bg, rgba(202,138,4,.10))', borda: 'var(--pl-warn, #ca8a04)', rotulo: 'Amarelo' },
  VERMELHO: { fundo: 'var(--pl-critical-bg, rgba(220,38,38,.08))', borda: 'var(--pl-critical, #dc2626)', rotulo: 'Vermelho' },
  CINZA: { fundo: 'var(--pl-surface-2)', borda: 'var(--pl-border)', rotulo: 'Sem dados' },
}

export function FraseDoDia({ frase }: { frase: BussolaHoje['frase'] }) {
  if (!frase) return null
  return (
    <figure style={{ margin: '0 0 10px', padding: '6px 12px', borderLeft: '3px solid var(--pl-accent-6)', fontSize: 13 }} data-frase-do-dia={frase.id}>
      <blockquote style={{ margin: 0, display: 'inline', fontStyle: 'italic', color: 'var(--pl-ink-1)' }}>“{frase.texto}”</blockquote>
      <figcaption className="pl-hint" style={{ display: 'inline', marginLeft: 6, fontSize: 12 }}>— {frase.autor} · <span data-frase-fonte>{frase.fonte}</span></figcaption>
    </figure>
  )
}

export function ResumoAries({ d, aoAtualizar, atualizando }: { d: BussolaHoje; aoAtualizar: () => void; atualizando: boolean }) {
  return (
    <section className="pl-card" style={{ marginBottom: 12 }} aria-label="Resumo do ARIES" data-resumo-aries={d.origemTexto}>
      <div className="pl-card-head" style={{ alignItems: 'center' }}>
        <div className="pl-card-title"><span className="ar-marca" aria-hidden /> Resumo do ARIES</div>
        <button type="button" className="pl-btn" style={{ padding: '2px 10px', fontSize: 12 }} onClick={aoAtualizar} disabled={atualizando} data-atualizar-bussola>{atualizando ? 'Atualizando…' : 'Atualizar'}</button>
      </div>
      <p style={{ margin: '4px 0 0', lineHeight: 1.55 }} data-resumo-texto>{d.texto}</p>
      <p className="pl-hint" style={{ margin: '6px 0 0', fontSize: 11 }}>Números do dicionário de métricas · atualizado às {new Date(d.geradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
    </section>
  )
}

function BotaoLevar({ levar, enviados, aoEnviar }: { levar: LevarDaily; enviados: Set<string>; aoEnviar: (l: LevarDaily) => Promise<void> }) {
  const chave = `${levar.refTipo}|${levar.refId}|${levar.texto}`
  const [estado, setEstado] = useState<'livre' | 'enviando' | 'erro'>('livre')
  const ja = enviados.has(chave) || enviados.has(`${levar.refTipo}|${levar.refId}`)
  if (ja) return <span className="pl-hint" style={{ fontSize: 12, whiteSpace: 'nowrap' }} data-levado>✓ Na pauta do Daily</span>
  return (
    <button type="button" className="pl-btn" style={{ padding: '1px 8px', fontSize: 12, whiteSpace: 'nowrap' }} disabled={estado === 'enviando'} data-levar-daily={levar.area}
      onClick={async () => { setEstado('enviando'); try { await aoEnviar(levar); setEstado('livre') } catch { setEstado('erro') } }}>
      {estado === 'erro' ? 'Tentar de novo' : 'Levar ao Daily'}
    </button>
  )
}

function Linha({ p, tipo, enviados, aoEnviar }: { p: PontoBussola; tipo: 'bom' | 'atencao' | 'oportunidade'; enviados: Set<string>; aoEnviar: (l: LevarDaily) => Promise<void> }) {
  return (
    <li style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }} data-ponto={tipo}>
      <span style={{ flex: 1 }}>{p.texto}{p.hipotese ? <span className="pl-hint" style={{ fontSize: 11 }}> (estimativa)</span> : null}</span>
      {p.levar && tipo !== 'bom' && <BotaoLevar levar={p.levar} enviados={enviados} aoEnviar={aoEnviar} />}
    </li>
  )
}

function Cartao({ c, enviados, aoEnviar }: { c: CartaoBussola; enviados: Set<string>; aoEnviar: (l: LevarDaily) => Promise<void> }) {
  const cor = COR[c.cor]
  return (
    <article className="pl-card" style={{ borderLeft: `4px solid ${cor.borda}`, display: 'flex', flexDirection: 'column', gap: 8 }} data-cartao-area={c.area} data-cor={c.cor}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <div className="pl-card-title" style={{ margin: 0 }}>{c.nome}</div>
        <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: cor.fundo, border: `1px solid ${cor.borda}` }} data-situacao>{c.situacao}</span>
      </header>
      {c.metricas.length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }} data-metricas-apoio>
          {c.metricas.map(m => (
            <div key={m.chave} style={{ minWidth: 90 }} data-metrica={m.chave} title={m.comparacao ?? undefined}>
              <div className="pl-hint" style={{ fontSize: 11 }}>{m.nome}</div>
              <b style={{ fontSize: 15 }}>{m.texto}</b>
              {m.comparacao && m.valor != null && <div className="pl-hint" style={{ fontSize: 11 }}>{m.comparacao}</div>}
            </div>
          ))}
        </div>
      )}
      <Bloco titulo="O que está bom" vazio="Nenhum número desta área se destacou para cima hoje." data="bons">
        {c.bons.map((p, i) => <Linha key={i} p={p} tipo="bom" enviados={enviados} aoEnviar={aoEnviar} />)}
      </Bloco>
      <Bloco titulo="Onde olhar primeiro" vazio="Nada fora do normal nesta área." data="atencao">
        {c.atencao.map((p, i) => <Linha key={i} p={p} tipo="atencao" enviados={enviados} aoEnviar={aoEnviar} />)}
      </Bloco>
      <Bloco titulo="Oportunidade" vazio="Sem oportunidade com número para estimar hoje." data="oportunidade">
        {c.oportunidade ? [<Linha key="op" p={c.oportunidade} tipo="oportunidade" enviados={enviados} aoEnviar={aoEnviar} />] : []}
      </Bloco>
      {c.recs.length > 0 && (
        <Bloco titulo="Recomendações" vazio="" data="recs">
          {c.recs.map(r => (
            <li key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
              <Link style={{ flex: 1 }} href={`/pro-labore/recomendacoes?rec=${r.id}`}>{r.codigo ? `${r.codigo} · ` : ''}{r.titulo}</Link>
              <BotaoLevar levar={r.levar} enviados={enviados} aoEnviar={aoEnviar} />
            </li>
          ))}
        </Bloco>
      )}
      <p style={{ margin: 0, fontSize: 13, background: 'var(--pl-surface-2)', padding: '8px 10px', borderRadius: 8 }} data-dica><b>Dica do ARIES:</b> {c.dica}</p>
      <div style={{ marginTop: 'auto' }}><Link className="pl-btn" style={{ padding: '3px 10px', fontSize: 12 }} href={c.href} data-abrir-area>Abrir a área</Link></div>
    </article>
  )
}

function Bloco({ titulo, vazio, data, children }: { titulo: string; vazio: string; data: string; children: React.ReactNode[] }) {
  return (
    <div data-parte={data}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pl-ink-2)', marginBottom: 2 }}>{titulo}</div>
      {children.length ? <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>{children}</ul> : vazio ? <p className="pl-hint" style={{ margin: 0, fontSize: 12 }}>{vazio}</p> : null}
    </div>
  )
}

// Área → série dos últimos 30 dias para a minilinha do bloco.
const SERIE_DA_AREA: Record<string, string> = { RESULTADO: 'faturamento', PRE_VENDA: 'leads_novos', VENDEDORES: 'vendas', EQUIPE: 'atividades_feitas' }
const ICONE_AREA: Record<string, string> = { RESULTADO: '◎', PRE_VENDA: '☎', CREDITO: '⌂', VENDEDORES: '◆', TRAFEGO: '↗', SOCIAL: '✦', REATIVACAO: '↻', GESTAO: '▤', EQUIPE: '◉' }

/** Saúde das áreas: uma grade de blocos pequenos (farol, número principal, tendência, uma frase); o detalhe abre ao lado. */
export function BussolaPorArea({ d, aoMudar, series }: { d: BussolaHoje; aoMudar: () => void; series?: Record<string, SerieDia> }) {
  const [enviadosAgora, setEnviados] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<string | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const enviados = new Set([...enviadosAgora, ...d.enviados.map(e => `${e.refTipo}|${e.refId}`), ...d.enviados.map(e => `${e.refTipo}|${e.refId}|${e.texto}`)])
  async function aoEnviar(l: LevarDaily) {
    const r = await bussolaApi.levarAoDaily(l)
    setEnviados(s => new Set(s).add(`${l.refTipo}|${l.refId}|${l.texto}`).add(`${l.refTipo}|${l.refId}`))
    setMsg(r.jaEstava ? 'Esse ponto já estava na pauta do Daily.' : 'Enviado para a pauta do Daily, no bloco da área.')
    aoMudar()
  }
  useEffect(() => {
    if (!aberta) return
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberta(null) }
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  }, [aberta])
  const { cartoes, vendedores } = d.bussola
  const ordemCor = { VERMELHO: 0, AMARELO: 1, VERDE: 2, CINZA: 3 } as const
  const contagem = { VERMELHO: 0, AMARELO: 0, VERDE: 0, CINZA: 0 }
  for (const c of cartoes) contagem[c.cor]++
  const atual = cartoes.find(c => c.area + c.nome === aberta) ?? null
  return (
    <section aria-label="Saúde das áreas" className="pl-card" style={{ marginBottom: 16 }} data-bussola>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div className="pl-card-title" style={{ margin: 0 }}>Saúde das áreas</div>
        <div style={{ display: 'flex', gap: 10, fontSize: 12 }} data-contagem-areas>
          {contagem.VERMELHO > 0 && <span style={{ color: 'var(--pl-critical)' }}>● {contagem.VERMELHO} pede{contagem.VERMELHO > 1 ? 'm' : ''} ação</span>}
          {contagem.AMARELO > 0 && <span style={{ color: 'var(--pl-accent-4)' }}>● {contagem.AMARELO} em atenção</span>}
          {contagem.VERDE > 0 && <span style={{ color: 'var(--pl-good)' }}>● {contagem.VERDE} em dia</span>}
          {contagem.CINZA > 0 && <span className="pl-hint">● {contagem.CINZA} sem dados</span>}
        </div>
      </div>
      {msg && <p className="pl-hint" role="status" data-msg-levar>{msg}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
        {[...cartoes].sort((a, b) => ordemCor[a.cor] - ordemCor[b.cor]).map(c => {
          const m = c.metricas[0]
          const frase = c.atencao[0]?.texto ?? c.bons[0]?.texto ?? c.situacao
          const serie = series?.[SERIE_DA_AREA[c.area]]
          return (
            <button key={c.area + c.nome} type="button" onClick={() => setAberta(c.area + c.nome)} data-cartao-area={c.area} data-cor={c.cor}
              style={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', border: '1px solid var(--pl-border)', borderTop: `3px solid ${COR[c.cor].borda}`, borderRadius: 10, padding: '10px 12px', background: 'var(--pl-surface)', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 128 }}
              aria-label={`${c.nome}: ${c.situacao}. Abrir o detalhe`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}><span aria-hidden style={{ color: 'var(--pl-ink-muted)', marginRight: 4 }}>{ICONE_AREA[c.area] ?? '•'}</span>{c.nome}</span>
                <span aria-hidden title={COR[c.cor].rotulo} style={{ width: 9, height: 9, borderRadius: 99, background: COR[c.cor].borda, flex: 'none' }} />
              </div>
              {m && <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }} data-numero-area>{m.texto}</b>
                <Variacao v={m.variacao} melhor={m.melhor} />
              </div>}
              {m && <span className="pl-hint" style={{ fontSize: 11 }}>{m.nome}</span>}
              {serie && <Minilinha serie={serie} altura={22} cor={COR[c.cor].borda} />}
              <span style={{ fontSize: 12, color: 'var(--pl-ink-2)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} data-frase-area>{frase}</span>
            </button>
          )
        })}
      </div>
      {vendedores && vendedores.length > 0 && (
        <details style={{ marginTop: 12 }} data-bussola-vendedores>
          <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Vendedores: destaque e ponto de atenção de cada um</summary>
          <table className="pl-table" style={{ marginTop: 8, fontSize: 13 }}><thead><tr><th>Vendedor</th><th>Destaque</th><th>Atenção</th></tr></thead>
            <tbody>{vendedores.map(v => <tr key={v.id}><td><b>{v.nome}</b></td><td>{v.destaque ?? '—'}</td><td style={{ color: v.atencao ? 'var(--pl-critical)' : undefined }}>{v.atencao ?? '—'}</td></tr>)}</tbody></table>
        </details>
      )}
      {atual && (
        <div role="dialog" aria-modal="true" aria-label={`Detalhe: ${atual.nome}`} data-painel-area={atual.area}
          style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,.35)' }} onClick={e => { if (e.target === e.currentTarget) setAberta(null) }}>
          <div style={{ width: 'min(480px, 100%)', height: '100%', overflow: 'auto', background: 'var(--pl-bg, var(--pl-surface))', borderLeft: '1px solid var(--pl-border)', padding: 16, boxShadow: 'var(--pl-shadow-pop)' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="pl-btn" onClick={() => setAberta(null)} data-fechar-area aria-label="Fechar">Fechar ✕</button></div>
            {series?.[SERIE_DA_AREA[atual.area]] && <div className="pl-card" style={{ margin: '8px 0' }}><div className="pl-hint" style={{ fontSize: 12 }}>Últimos 30 dias</div><Minilinha serie={series[SERIE_DA_AREA[atual.area]]} altura={70} cor={COR[atual.cor].borda} /></div>}
            <Cartao c={atual} enviados={enviados} aoEnviar={aoEnviar} />
          </div>
        </div>
      )}
    </section>
  )
}

/** Resumo do ARIES em três linhas curtas: o que está bom, onde olhar e por onde começar. */
export function ResumoCurto({ d, aoAtualizar, atualizando }: { d: BussolaHoje & { fatos?: Array<{ tipo: string; area: string; valor: string; hipotese: boolean }> }; aoAtualizar: () => void; atualizando: boolean }) {
  const f = (t: string) => d.fatos?.find(x => x.tipo === t)
  const linhas = [
    { t: 'BOM', icone: '✔', cor: 'var(--pl-good)', rotulo: 'Está bom' },
    { t: 'ATENCAO', icone: '!', cor: 'var(--pl-critical)', rotulo: 'Olhar primeiro' },
    { t: 'COMECAR', icone: '→', cor: 'var(--pl-accent-6)', rotulo: 'Começar por' },
  ].map(x => ({ ...x, fato: f(x.t) })).filter(x => x.fato)
  const como = f('COMO_ESTAMOS')
  return (
    <section className="pl-card" aria-label="Resumo do ARIES" data-resumo-aries={d.origemTexto} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div className="pl-card-title" style={{ margin: 0 }}><span className="ar-marca" aria-hidden /> Resumo do ARIES</div>
        <button type="button" className="pl-btn" style={{ padding: '2px 10px', fontSize: 12 }} onClick={aoAtualizar} disabled={atualizando} data-atualizar-bussola>{atualizando ? 'Atualizando…' : 'Atualizar'}</button>
      </div>
      {como && <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }} data-como-estamos>{como.area.includes('meta') ? 'O mês está com ' : ''}{como.valor}</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }} data-resumo-linhas>
        {linhas.map(l => (
          <li key={l.t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }} data-linha={l.t}>
            <span aria-hidden style={{ flex: 'none', width: 22, height: 22, borderRadius: 99, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: l.cor, border: `1.5px solid ${l.cor}` }}>{l.icone}</span>
            <span style={{ fontSize: 13, lineHeight: 1.45 }}><span className="pl-hint" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{l.rotulo}{l.fato!.area !== 'fila' ? ` · ${l.fato!.area}` : ''}</span>{l.fato!.valor.charAt(0).toUpperCase() + l.fato!.valor.slice(1)}{l.fato!.hipotese ? ' (estimativa)' : ''}</span>
          </li>
        ))}
      </ul>
      <details style={{ fontSize: 12 }}><summary className="pl-hint" style={{ cursor: 'pointer' }}>Ler o resumo completo</summary><p style={{ margin: '6px 0 0', lineHeight: 1.5 }} data-resumo-texto>{d.texto}</p></details>
    </section>
  )
}
