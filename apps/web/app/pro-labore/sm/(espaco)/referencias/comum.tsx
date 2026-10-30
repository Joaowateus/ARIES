'use client'

// Peças da aba Referências: o card do post (com miniatura), o modal para
// assistir e trabalhar a referência e as contas usadas nas abas.
import { useState } from 'react'
import type { SmFormatoPublico, SmPerfilReferencia, SmPostReferencia, SmReferenciaSalva, SmReferencias } from '@/lib/proLaboreApi'
import { Botao, Chip, haQuanto, useToast } from '../../_ui'

export const num = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('pt-BR'))
export const dec = (v: number | null | undefined, casas = 1) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: casas }))
export const sinal = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR')}`)
export const FORMATO: Record<SmFormatoPublico, string> = { REELS: 'Reels', VIDEO: 'Vídeo', CARROSSEL: 'Carrossel', FOTO: 'Foto' }
export const TIPO_PERFIL = { REFERENCIA: 'Referência', CONCORRENTE: 'Concorrente', EU: 'Você' } as const
export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
/** Endereço de incorporação do Instagram para o post/reel. */
export const embed = (permalink: string) => `${permalink.replace(/\?.*$/, '').replace(/\/$/, '')}/embed`
/** Hora e dia da semana em Belém (UTC−3). */
export const emBelem = (iso: string) => new Date(Date.parse(iso) - 3 * 3600e3)
export const hashtagsDe = (t: string | null) => [...new Set((t ?? '').toLowerCase().match(/#[\p{L}\p{N}_]+/gu) ?? [])]
/** A primeira linha que diz alguma coisa (o gancho do post). */
export const gancho = (t: string | null) => (t ?? '').split('\n').map(l => l.trim()).find(l => l.replace(/[#@\p{Extended_Pictographic}\s]/gu, '').length >= 3) ?? ''
export const quem = (p: { autor: string | null; fonte: string }) => (p.autor ? `@${p.autor}` : `#${p.fonte}`)

/** Tipo do perfil que publicou (para filtrar por concorrente, referência ou a própria conta). */
export function tipoDoPost(p: SmPostReferencia, perfis: SmPerfilReferencia[]) {
  if (p.origem === 'HASHTAG') return 'HASHTAG' as const
  return perfis.find(x => x.usuario === p.fonte)?.tipo ?? 'REFERENCIA'
}

type Postavel = Pick<SmPostReferencia, 'formato' | 'midiaUrl' | 'video'>
export function Miniatura({ p, grande }: { p: Postavel; grande?: boolean }) {
  const [falhou, setFalhou] = useState(false)
  const rotulo = p.formato ? FORMATO[p.formato] : 'Post'
  if (p.midiaUrl && !falhou) {
    return p.video ? (
      <video className="sm-ref-mini" src={p.midiaUrl} muted playsInline preload="metadata" loop={grande} autoPlay={grande} onError={() => setFalhou(true)}
        onMouseEnter={e => { e.currentTarget.play().catch(() => {}) }} onMouseLeave={e => { if (!grande) e.currentTarget.pause() }} aria-label={rotulo} />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="sm-ref-mini" src={p.midiaUrl} alt={rotulo} loading="lazy" onError={() => setFalhou(true)} />
    )
  }
  return <span className="sm-ref-mini vazio" aria-label={rotulo}><span aria-hidden="true">{p.video ? '▶' : p.formato === 'CARROSSEL' ? '❏' : '◻'}</span><small>{rotulo}</small></span>
}

export function CardPost({ p, posicao, podeEditar, aoAbrir, aoSalvar }: { p: SmPostReferencia; posicao?: number; podeEditar: boolean; aoAbrir: () => void; aoSalvar: () => void }) {
  return (
    <li className="sm-ref-card" data-video-ref={p.id} data-post-ref={p.mediaId}>
      <button type="button" className="sm-ref-capa" onClick={aoAbrir} data-assistir aria-label={`Abrir post de ${quem(p)}`}>
        <Miniatura p={p} />
        {posicao != null && <span className="sm-ref-pos">{posicao}</span>}
        <span className="sm-ref-capa-tags">
          {p.formato && <span className="sm-ref-selo">{FORMATO[p.formato]}</span>}
          {p.foraDaCurva && <span className="sm-ref-selo forte" title="Engajamento ÷ mediana dos posts da mesma fonte">{dec(p.indice)}× a média</span>}
        </span>
      </button>
      <div className="sm-ref-card-corpo">
        <div className="sm-ref-numeros">
          <b title="Curtidas + comentários">{num(p.engajamento)}</b><span>engajamento</span>
          {p.taxa != null && <Chip tom="info" titulo="Engajamento ÷ seguidores do perfil">{dec(p.taxa, 2)}%</Chip>}
        </div>
        <span className="sm-ref-sub">♥ {num(p.curtidas)} · 💬 {num(p.comentarios)}{p.indice != null && !p.foraDaCurva ? ` · ${dec(p.indice)}× a média` : ''}</span>
        <p>{gancho(p.legenda) || <i>sem legenda</i>}</p>
        <div className="sm-ref-meta">
          <span>{quem(p)}</span>
          {p.publicadoEm && <span>{haQuanto(p.publicadoEm)}</span>}
        </div>
        <div className="sm-ref-acoes">
          {podeEditar && (p.salvoId
            ? <span className="sm-ref-salvo" data-salvo>✓ Salvo</span>
            : <button type="button" className="sm-link-botao" onClick={aoSalvar} data-salvar>Salvar</button>)}
          <a className="sm-ref-link" href={p.permalink} target="_blank" rel="noreferrer">Instagram ↗</a>
        </div>
      </div>
    </li>
  )
}

/** O post aberto: o vídeo do Instagram e, ao lado, os números, a legenda e o que fazer com a referência. */
export function PainelPost({ p, salvo, dados, podeEditar, ocupado, aoSalvar, aoNota, aoPauta }: {
  p: SmPostReferencia | SmReferenciaSalva
  salvo: SmReferenciaSalva | null
  dados: SmReferencias
  podeEditar: boolean
  ocupado: boolean
  aoSalvar: (nota: string) => void
  aoNota: (nota: string) => void
  aoPauta: () => void
}) {
  const toast = useToast()
  const [nota, setNota] = useState(salvo?.nota ?? '')
  const tags = hashtagsDe(p.legenda)
  const moto = p.motoChave ? dados.motos.find(m => m.chave === p.motoChave)?.nome : null
  const indice = 'indice' in p ? p.indice : null
  const taxa = 'taxa' in p ? p.taxa : null
  return (
    <div className="sm-ref-post">
      <iframe className="sm-ref-embed" src={embed(p.permalink)} title="Post do Instagram" allow="encrypted-media; picture-in-picture" loading="lazy" data-embed />
      <div className="sm-ref-post-lado">
        <div className="sm-ref-post-nums">
          <div><b>{num(p.engajamento)}</b><span>engajamento</span></div>
          <div><b>{num(p.curtidas)}</b><span>curtidas</span></div>
          <div><b>{num(p.comentarios)}</b><span>comentários</span></div>
          {indice != null && <div><b>{dec(indice)}×</b><span>a média da fonte</span></div>}
          {taxa != null && <div><b>{dec(taxa, 2)}%</b><span>dos seguidores</span></div>}
        </div>
        <p className="sm-legenda">{[quem(p), p.formato ? FORMATO[p.formato] : null, p.publicadoEm ? `${new Date(p.publicadoEm).toLocaleDateString('pt-BR')} às ${emBelem(p.publicadoEm).toISOString().slice(11, 16)}` : null, moto ? `moto: ${moto}` : null].filter(Boolean).join(' · ')}</p>
        {gancho(p.legenda) && <div className="sm-ref-gancho"><span className="sm-mono">Gancho</span><b>{gancho(p.legenda)}</b></div>}
        <div className="sm-ref-legenda-toda">{p.legenda || <i>sem legenda</i>}</div>
        {tags.length > 0 && <div className="sm-ref-tags">{tags.slice(0, 12).map(t => <Chip key={t}>{t}</Chip>)}</div>}
        <div className="sm-ref-acoes">
          <Botao variante="fantasma" onClick={() => { navigator.clipboard?.writeText(p.legenda ?? '').then(() => toast({ mensagem: 'Legenda copiada.' }), () => {}) }} disabled={!p.legenda}>Copiar legenda</Botao>
          <a className="sm-ref-link" href={p.permalink} target="_blank" rel="noreferrer">Abrir no Instagram ↗</a>
        </div>
        {podeEditar && (
          <div className="sm-ref-trabalho">
            <label className="sm-mono" htmlFor="ref-nota">O que aproveitar desta referência</label>
            <textarea id="ref-nota" className="sm-input" value={nota} maxLength={1000} onChange={e => setNota(e.target.value)} placeholder="Ex.: abrir com a moto ligando, legenda curta com pergunta, CTA para o WhatsApp" data-nota-ref
              onBlur={() => { if (salvo && nota !== (salvo.nota ?? '')) aoNota(nota) }} />
            <div className="sm-ref-acoes">
              {!salvo && <Botao variante="sec" disabled={ocupado} onClick={() => aoSalvar(nota)} data-salvar-modal>Salvar referência</Botao>}
              {salvo?.pautaId
                ? <a className="sm-btn" href={`/pro-labore/sm/producao?pauta=${salvo.pautaId}`} data-abrir-pauta>Abrir a pauta</a>
                : <Botao variante="pri" disabled={ocupado} onClick={aoPauta} data-criar-pauta>Criar pauta na Produção</Botao>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Barra simples: rótulo, barra proporcional e o valor por extenso (sem depender da cor). */
export function Barras({ itens, rotulo, formatar }: { itens: Array<{ rotulo: string; valor: number; extra?: string; destaque?: boolean }>; rotulo: string; formatar: (v: number) => string }) {
  const max = Math.max(...itens.map(i => i.valor), 0)
  return (
    <ul className="sm-ref-barras" aria-label={rotulo}>
      {itens.map(i => (
        <li key={i.rotulo} className={i.destaque ? 'destaque' : undefined}>
          <span className="sm-ref-barra-rot">{i.rotulo}</span>
          <span className="sm-ref-barra-trilho"><span style={{ width: `${max > 0 ? Math.max(3, (i.valor / max) * 100) : 0}%` }} /></span>
          <span className="sm-ref-barra-val">{formatar(i.valor)}{i.extra ? <small> · {i.extra}</small> : null}</span>
        </li>
      ))}
    </ul>
  )
}
