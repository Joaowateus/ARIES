'use client'

// PDF 06 · seção 3: o Hoje como bússola do dia. Frase do dia (da biblioteca
// aprovada, com autor e fonte), o resumo do ARIES e um cartão por área:
// situação, o que está bom, onde olhar primeiro, oportunidade com impacto
// estimado, dica do ARIES e até 3 números de apoio. Cada ponto de atenção,
// oportunidade ou Recomendação tem "Levar ao Daily".
import { useState } from 'react'
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
    <figure className="pl-card" style={{ margin: '0 0 12px', padding: '12px 16px' }} data-frase-do-dia={frase.id}>
      <blockquote style={{ margin: 0, fontSize: 15, fontStyle: 'italic', color: 'var(--pl-ink-1)' }}>“{frase.texto}”</blockquote>
      <figcaption className="pl-hint" style={{ marginTop: 6, fontSize: 12 }}>— {frase.autor} · <span data-frase-fonte>{frase.fonte}</span></figcaption>
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

export function BussolaPorArea({ d, aoMudar }: { d: BussolaHoje; aoMudar: () => void }) {
  const [enviadosAgora, setEnviados] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<string | null>(null)
  const enviados = new Set([...enviadosAgora, ...d.enviados.map(e => `${e.refTipo}|${e.refId}`), ...d.enviados.map(e => `${e.refTipo}|${e.refId}|${e.texto}`)])
  async function aoEnviar(l: LevarDaily) {
    const r = await bussolaApi.levarAoDaily(l)
    setEnviados(s => new Set(s).add(`${l.refTipo}|${l.refId}|${l.texto}`).add(`${l.refTipo}|${l.refId}`))
    setMsg(r.jaEstava ? 'Esse ponto já estava na pauta do Daily.' : 'Enviado para a pauta do Daily, no bloco da área.')
    aoMudar()
  }
  const { cartoes, vendedores } = d.bussola
  return (
    <section aria-label="Bússola por área" style={{ marginBottom: 16 }} data-bussola>
      <div className="ar-fila-grupo" style={{ marginBottom: 8 }}>Bússola por área</div>
      {msg && <p className="pl-hint" role="status" data-msg-levar>{msg}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
        {cartoes.map(c => <Cartao key={c.area + c.nome} c={c} enviados={enviados} aoEnviar={aoEnviar} />)}
      </div>
      {vendedores && vendedores.length > 0 && (
        <details className="pl-card" style={{ marginTop: 12 }} data-bussola-vendedores>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Vendedores: um destaque e um ponto de atenção por pessoa</summary>
          <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 13 }}>
            {vendedores.map(v => <li key={v.id}><b>{v.nome}</b>: {v.destaque ?? 'sem venda no mês ainda'}{v.atencao ? ` · atenção: ${v.atencao}` : ''}</li>)}
          </ul>
        </details>
      )}
    </section>
  )
}
