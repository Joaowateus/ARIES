'use client'

// PDF 04 · Padrão de tela do PDF 00 (mesmos componentes em todo o sistema):
// cabeçalho da ficha, "Agora" com até três números do dicionário (tocar abre a
// ficha da métrica), área de trabalho, Lente do ARIES à direita e detalhes
// recolhidos. A Lente nunca executa nada sozinha: leva à ação.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { recApi, telasApi, type Lente as LenteDados, type LeituraMetrica, type NumeroHoje, type StatusNumero } from '@/lib/proLaboreApi'
import type { AbaAries } from '@/lib/abasAries'
import { FichaMetricaModal, useMetricas } from '../_metricas/Metricas'
import { ForcaChip } from '../recomendacoes/DetalheRec'

// --- Contexto das telas novas (versão, aba aberta e o registro de uso) ---
export interface TelasCtx { versao: 'NOVA' | 'ATUAL'; usoId: string | null; registrarAcao: (acao: string) => void }
export const TelasContext = createContext<TelasCtx>({ versao: 'ATUAL', usoId: null, registrarAcao: () => {} })
export const useTelas = () => useContext(TelasContext)

// --- Formatação (os valores chegam prontos do dicionário; aqui só o jeito de escrever) ---
export function fmtValor(v: number | null | undefined, unidade: string): string {
  if (v == null) return '—'
  const n = (x: number, c = 1) => x.toLocaleString('pt-BR', { maximumFractionDigits: c })
  if (unidade === 'BRL') return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  if (unidade === 'PCT') return `${n(v)}%`
  if (unidade === 'MIN') return v < 60 ? `${n(v, 0)} min` : `${n(v / 60)} h`
  if (unidade === 'DIAS') return `${n(v)} d`
  if (unidade === 'X') return `${n(v, 2)}x`
  return n(v)
}
const NOME_STATUS = { BOM: 'Bom', ATENCAO: 'Atenção', CRITICO: 'Crítico' } as const
export function StatusChip({ status }: { status: StatusNumero | undefined }) {
  if (!status) return null
  return <span className={`ar-status ar-status-${status.toLowerCase()}`} data-status={status}>{NOME_STATUS[status]}</span>
}

// --- Cabeçalho da ficha ---
export function Cabecalho({ aba, acao }: { aba: Pick<AbaAries, 'nome' | 'pergunta' | 'paraQuem' | 'acaoPrincipal' | 'acaoHref'>; acao?: React.ReactNode }) {
  return (
    <header className="ar-cabecalho" data-cabecalho-ficha>
      <div>
        <div className="pl-eyebrow">ARIES</div>
        <h1>{aba.nome}</h1>
        <p className="ar-pergunta" data-pergunta>{aba.pergunta}</p>
        <div className="ar-para-quem">Para: {aba.paraQuem} · Ação principal: {aba.acaoPrincipal}</div>
      </div>
      {acao ?? (aba.acaoHref ? <Link className="pl-btn pl-btn-primary ar-acao-principal" href={aba.acaoHref} data-acao-principal>{aba.acaoPrincipal}</Link> : null)}
    </header>
  )
}

// --- Um número do "Agora" ---
export function CartaoNumero({ chave, nome, valor, unidade, status, sub, aviso }: { chave: string; nome: string; valor: number | null; unidade: string; status?: StatusNumero; sub?: string; aviso?: string | null }) {
  const [ficha, setFicha] = useState(false)
  return (
    <>
      <button type="button" className="ar-numero" onClick={() => setFicha(true)} data-numero={chave} title="Tocar para ver o que é, como é calculado e o que é bom ou ruim">
        <div className="ar-num-nome"><span>{nome}</span><StatusChip status={status} /></div>
        <div className="ar-num-valor">{aviso ? '—' : fmtValor(valor, unidade)}</div>
        <div className="ar-num-sub">{aviso ?? sub ?? ''}</div>
      </button>
      {ficha && <FichaMetricaModal chave={chave} onFechar={() => setFicha(false)} />}
    </>
  )
}

const subDaLeitura = (l: LeituraMetrica) => l.anterior?.valor != null ? `antes: ${fmtValor(l.anterior.valor, l.unidade)}${l.projecao != null ? ` · projeção ${fmtValor(l.projecao, l.unidade)}` : ''}` : l.projecao != null ? `projeção ${fmtValor(l.projecao, l.unidade)}` : ''

export function subDoNumero(n: NumeroHoje): string {
  const partes: string[] = []
  if (n.alvo?.valor != null) partes.push(`${n.alvo.rotulo}: ${fmtValor(n.alvo.valor, n.unidade === 'QTD' ? 'QTD' : n.unidade)}`)
  else if (n.alvo) partes.push(`${n.alvo.rotulo}: não definida`)
  const d = n.detalhe as { maiorEsperaMin?: number; alemDoNormal?: number; motivo?: string } | null
  if (d?.maiorEsperaMin) partes.push(`maior espera ${fmtValor(d.maiorEsperaMin, 'MIN')}`)
  if (d?.alemDoNormal) partes.push(`${d.alemDoNormal} além do normal`)
  if (d?.motivo && n.valor == null) partes.push(d.motivo)
  if (!partes.length && n.anterior?.valor != null) partes.push(`antes: ${fmtValor(n.anterior.valor, n.unidade)}`)
  if (n.tipoPeriodo === 'AGORA') partes.push('agora')
  return partes.join(' · ')
}

/** Agora: até três números do dicionário (nunca mais que três). */
export function Agora({ chaves }: { chaves: string[] }) {
  const lista = chaves.slice(0, 3)
  const [periodo] = useState(() => { const h = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); return { inicio: `${h.slice(0, 8)}01`, fim: h } })
  const leituras = useMetricas(lista, lista.length ? periodo : null)
  const visiveis = lista.filter(c => leituras[c])
  const [esperou, setEsperou] = useState(false)
  useEffect(() => { const t = setTimeout(() => setEsperou(true), 45_000); return () => clearTimeout(t) }, [])
  // Enquanto o dicionário calcula, o lugar dos números fica reservado (a tela não pula).
  if (!visiveis.length) return lista.length && !esperou ? <section className="ar-agora" aria-label="Agora" aria-busy="true">{lista.map(c => <div key={c} className="ar-numero" style={{ minHeight: 78, opacity: .5 }}><div className="ar-num-nome">Calculando…</div></div>)}</section> : null
  return (
    <section className="ar-agora" aria-label="Agora" data-agora>
      {visiveis.map(c => { const l = leituras[c]; return <CartaoNumero key={c} chave={c} nome={l.nome} valor={l.valor} unidade={l.unidade} status={l.faixa} sub={subDaLeitura(l)} /> })}
    </section>
  )
}

export function AgoraHoje({ numeros }: { numeros: NumeroHoje[] }) {
  return (
    <section className="ar-agora" aria-label="Agora" data-agora>
      {numeros.slice(0, 3).map(n => <CartaoNumero key={n.chave} chave={n.chave} nome={n.nome} valor={n.valor} unidade={n.unidade} status={n.status} sub={subDoNumero(n)} aviso={n.naoDefinido ? 'Ainda sem fonte no sistema' : null} />)}
    </section>
  )
}

// --- Lente do ARIES ---
export function Lente({ aba, dados, aoMudar }: { aba: string; dados?: LenteDados | null; aoMudar?: () => void }) {
  const { registrarAcao } = useTelas()
  const [carregada, setL] = useState<LenteDados | null>(null)
  const l = dados !== undefined ? dados : carregada
  const [descartando, setDescartando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const carregar = useCallback(() => { telasApi.lente(aba).then(setL).catch(() => setL(null)) }, [aba])
  useEffect(() => { if (dados === undefined) carregar() }, [dados, carregar])
  const recarregar = () => { if (aoMudar) aoMudar(); else carregar() }
  async function aceitar(id: string) {
    setMsg(null)
    try { await recApi.aceitar(id); registrarAcao('lente:aceitar'); setMsg('Aceita: as atividades foram criadas.'); recarregar() } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') }
  }
  async function descartar(id: string) {
    if (motivo.trim().length < 3) { setMsg('Escreva o motivo do descarte.'); return }
    try { await recApi.descartar(id, motivo.trim()); registrarAcao('lente:descartar'); setDescartando(null); setMotivo(''); setMsg('Descartada com motivo.'); recarregar() } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível') }
  }
  return (
    <aside className="ar-lente" aria-label="Lente do ARIES" data-lente={aba}>
      <div className="ar-lente-titulo"><span className="ar-marca" aria-hidden />Lente do ARIES</div>
      {!l && <p className="pl-hint" style={{ margin: 0 }}>Carregando…</p>}
      {l && l.vazio && (
        <div className="ar-lente-vazio" data-lente-vazia>
          <p style={{ margin: '0 0 8px' }}>{l.mensagem ?? 'Nada fora do normal nesta aba'}</p>
          {l.principal && <CartaoNumero chave={l.principal.chave} nome={l.principal.nome} valor={l.principal.valor} unidade={l.principal.unidade} status={l.principal.faixa} sub={l.principal.faixa === 'BOM' || !l.principal.faixa ? 'dentro do esperado' : subDaLeitura(l.principal)} />}
        </div>
      )}
      {l && !l.vazio && l.itens.slice(0, 3 + (aba === 'hoje' ? 3 : 0)).map((it, i) => (
        <div className="ar-lente-item" key={it.id ?? `${it.tipo}-${i}`} data-lente-item={it.tipo}>
          <p className="ar-lente-achado">{it.achado}</p>
          <p className="ar-lente-evid">{it.forca && <ForcaChip forca={it.forca} />} {preencherValores(it.evidencia, it.valores)}</p>
          <div className="ar-lente-botoes">
            {it.acao?.href && <Link className="pl-btn pl-btn-primary" style={{ padding: '3px 10px' }} href={it.acao.href} onClick={() => registrarAcao('lente:acao')}>{it.acao.rotulo}</Link>}
            {it.tipo === 'REC' && it.podeAceitar && it.id && <button type="button" className="pl-btn" style={{ padding: '3px 10px' }} onClick={() => void aceitar(it.id!)} data-lente-aceitar>Aceitar</button>}
            {it.tipo === 'REC' && it.podeDescartar && it.id && descartando !== it.id && <button type="button" className="pl-btn" style={{ padding: '3px 10px' }} onClick={() => { setDescartando(it.id); setMotivo('') }} data-lente-descartar>Descartar com motivo</button>}
          </div>
          {descartando === it.id && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input className="pl-input" placeholder="Motivo do descarte" value={motivo} onChange={e => setMotivo(e.target.value)} aria-label="Motivo do descarte" />
              <button type="button" className="pl-btn" onClick={() => void descartar(it.id!)}>Descartar</button>
            </div>
          )}
        </div>
      ))}
      {msg && <p className="pl-hint" role="status" style={{ margin: '6px 0 0' }}>{msg}</p>}
      <p className="pl-hint" style={{ margin: '10px 0 0', fontSize: '.72rem' }}>O ARIES só recomenda: nada é executado sem uma pessoa.</p>
    </aside>
  )
}
// Evidência com números do dicionário: "[[chave]]" vira o valor formatado.
function preencherValores(texto: string, valores?: Record<string, number | null>) {
  if (!valores) return texto.replace(/\[\[[a-z_]+\]\]/g, 'o valor')
  return texto.replace('[[comissoes_a_pagar]]', fmtValor(valores.comissoesAgora ?? null, 'BRL')).replace('[[saidas_financeiro]]', fmtValor(valores.saidas ?? null, 'BRL'))
}

// --- Detalhes recolhidos e tela vazia que ensina ---
export function Detalhes({ titulo = 'Detalhes', children }: { titulo?: string; children: React.ReactNode }) {
  return <details className="ar-detalhes" data-detalhes><summary>{titulo}</summary><div className="ar-detalhes-corpo">{children}</div></details>
}
export function TelaVazia({ titulo, children, passo }: { titulo: string; children?: React.ReactNode; passo?: React.ReactNode }) {
  return <div className="ar-vazio" data-tela-vazia><h3>{titulo}</h3>{children && <p style={{ margin: '0 0 10px' }}>{children}</p>}{passo}</div>
}

/** Moldura de uma aba existente na versão nova: cabeçalho da ficha, Agora, trabalho e Lente à direita. */
export function TelaPadrao({ aba, children }: { aba: AbaAries; children: React.ReactNode }) {
  return (
    <div data-tela-padrao={aba.chave}>
      <Cabecalho aba={aba} />
      <div className="ar-tela">
        <div className="ar-trabalho">
          <Agora chaves={aba.numeros} />
          {children}
        </div>
        <Lente aba={aba.lente} />
      </div>
    </div>
  )
}
