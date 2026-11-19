'use client'

// Quadro do CRM na jornada de 10 etapas (PDF 01, seção 7): colunas em três
// fases, tempo do lead na etapa, levantamento e perda pelo motivo da etapa.
// Ajuste 2 (CRM livre): o vendedor move o card para onde quiser; o sistema
// mostra o que falta e deixa "avançar mesmo assim", guardando a pendência.
// Cada card traz a temperatura (frio, morno, quente) e o próximo passo.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { proLaboreApi, type Lead, type EtapaJornada, type ErroApi, type PerfilCliente, type PremissasJornada, type Temperatura } from '@/lib/proLaboreApi'
import { ETAPAS_JORNADA, FASES, NOME_ETAPA, NOME_MOTIVO, NOME_DESTINO } from '@/lib/etapasJornada'
import { FollowRoboModal, SeloRobo } from './FollowRobo'
import { situacaoFollow, linkWhatsapp } from '../../_follow/follow'
import { estourou, tempoNaEtapa } from './tempo'
import { AvisoNarrativo } from '../_topo/TopoFunil'

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
/** "R$ 3,9 mi", "R$ 345 mil" (cabeçalho da coluna). */
const moedaAbrev = (v: number) => (v >= 1_000_000 ? `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : v >= 1000 ? `R$ ${Math.round(v / 1000).toLocaleString('pt-BR')} mil` : `R$ ${Math.round(v)}`)
const POR_PAGINA = 50
/** A pergunta que libera a passagem para a próxima etapa (conferida com os critérios da API, lib/jornadaRegras.ts). */
const PERGUNTA_ETAPA: Record<EtapaJornada, string> = {
  LEAD: 'A loja já respondeu o cliente?',
  ABORDADO: 'O cliente respondeu e a coleta começou?',
  LEVANTAMENTO: 'Já sabemos moto, pagamento, CNH e entrada, e a simulação foi enviada?',
  MQL: 'Algum banco aprovou o crédito?',
  SQL: 'O lead já foi passado ao vendedor?',
  NEGOCIACAO: 'A proposta foi registrada?',
  PROPOSTA: 'A visita foi marcada?',
  AGENDAMENTO: 'O cliente chegou à loja?',
  VISITA: 'A venda foi registrada?',
  VENDA: 'Venda concluída',
}
/** O que fazer para passar à próxima etapa (o critério da API em uma frase; Modo guiado e painel). */
export const O_QUE_FAZER: Record<EtapaJornada, string> = {
  LEAD: 'uma pessoa da loja precisa responder o cliente',
  ABORDADO: 'o cliente precisa responder e a coleta começar',
  LEVANTAMENTO: 'completar o levantamento e enviar a simulação',
  MQL: 'um banco precisa aprovar o crédito',
  SQL: 'passar o lead ao vendedor',
  NEGOCIACAO: 'registrar a proposta (preço, entrada e parcela)',
  PROPOSTA: 'marcar a visita à loja, com data e hora',
  AGENDAMENTO: 'registrar o check-in quando o cliente chegar',
  VISITA: 'registrar a venda',
  VENDA: 'venda concluída',
}
export const NOME_PERFIL: Record<PerfilCliente, string> = { INDECISO: 'Indeciso', DETALHISTA: 'Detalhista', APRESSADO: 'Apressado', NERVOSO: 'Nervoso' }
const soDigitos = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '')
/** Nome vazio, só pontos ou igual ao telefone vira "Sem nome". */
export function nomeLimpo(l: Pick<Lead, 'nomeCliente' | 'telefone'>): string | null {
  const n = (l.nomeCliente ?? '').trim()
  if (!n || /^[.\s·…-]*$/.test(n)) return null
  const d = soDigitos(n)
  if (d.length >= 8 && d.length >= n.replace(/\s/g, '').length - 3 && soDigitos(l.telefone).endsWith(d.slice(-8))) return null
  return n
}
/** Moto muito longa ou terminando em "?" (o robô gravou a pergunta do cliente) não é uma moto. */
export const motoValida = (m: string | null | undefined) => !!m && m.trim().length > 0 && m.trim().length <= 40 && !m.trim().endsWith('?')
function IcoPend() { return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 8v5M12 16.5v.5" /><circle cx="12" cy="12" r="9" /></svg> }
function IcoRobo() { return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><rect x="5" y="8" width="14" height="11" rx="3" /><path d="M12 4v4M9.5 13h.01M14.5 13h.01" /></svg> }
function IcoLev() { return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><rect x="6" y="4" width="12" height="16" rx="2" /><path d="M9 9h6M9 13h4" /></svg> }

export type FaseFunil = 'TUDO' | 'PRE_VENDA' | 'VENDA' | 'FECHAMENTO'
interface Props {
  leads: Lead[]
  vejaEquipe: boolean
  onAbrir: (id: string) => void
  onAtualizar: () => void
  onRegistrarVenda: (lead: Lead) => void
  // Barra de ferramentas da tela (19/11): fase, temperatura, pendência e o modo Selecionar moram na página.
  fase: FaseFunil
  filtroTemp: Temperatura | ''
  soPendencia: boolean
  selecionando: boolean
  onSelecionando: (v: boolean) => void
  premissas: PremissasJornada | null
  densidade: 'compacto' | 'detalhado'
  onFollow: (lead: Lead) => void
  onNovoNaEtapa: (etapa: EtapaJornada) => void
  /** Modo guiado: pergunta da coluna, "o que fazer" no card e o guia que não some sozinho. */
  guiado: boolean
}

type Aviso = { lead: Lead; destino: EtapaJornada; faltando: string[]; podeForcar: boolean } | null
/** Orientação depois de mover (não bloqueia): o que fazer na etapa nova. */
type Guia = { lead: Lead; destino: EtapaJornada; itens: string[] } | null

export const NOME_TEMP: Record<Temperatura, string> = { QUENTE: 'Quente', MORNO: 'Morno', FRIO: 'Frio' }
const ORDEM_TEMP: Record<Temperatura, number> = { QUENTE: 0, MORNO: 1, FRIO: 2 }
export const calorDe = (l: Lead): Temperatura => l.calor?.valor ?? 'MORNO'
export const pendencias = (l: Lead) => l.pendenciasEtapa ?? []
const followAtrasado = (l: Lead) => (l.follows ?? []).some(f => new Date(f.agendadoPara).getTime() < Date.now())

type Passo = { texto: string; acao: 'abrir' | 'levantamento' | 'mover' | 'venda' }
/** A sugestão do que fazer agora com o lead (uma linha no card). */
function proximoPasso(l: Lead): Passo | null {
  const e = (l.etapa ?? 'LEAD') as EtapaJornada, p = pendencias(l)
  if (p.length) return { texto: `Resolver: ${p[0].replace(/^Complete o levantamento: /, '')}`, acao: /levantamento/i.test(p[0]) ? 'levantamento' : 'abrir' }
  if (followAtrasado(l)) return { texto: 'Follow atrasado: falar hoje', acao: 'abrir' }
  switch (e) {
    case 'LEAD': return { texto: 'Responder o cliente', acao: 'abrir' }
    case 'ABORDADO': return { texto: 'Fazer o levantamento', acao: 'levantamento' }
    case 'LEVANTAMENTO': return !l.levantamentoCompleto ? { texto: 'Completar o levantamento', acao: 'levantamento' } : l.formaPagamento === 'A_VISTA' ? { texto: 'Passar para a negociação', acao: 'mover' } : { texto: 'Enviar a simulação', acao: 'abrir' }
    case 'MQL': return { texto: 'Enviar a ficha de crédito', acao: 'abrir' }
    case 'SQL': return { texto: 'Abrir a negociação', acao: 'abrir' }
    case 'NEGOCIACAO': return { texto: 'Registrar a proposta', acao: 'abrir' }
    case 'PROPOSTA': return { texto: 'Marcar a visita', acao: 'abrir' }
    case 'AGENDAMENTO': return { texto: 'Check-in quando o cliente chegar', acao: 'abrir' }
    case 'VISITA': return { texto: 'Registrar a venda', acao: 'venda' }
    default: return null
  }
}

/** Fase inicial pela etapa do endereço (?etapa=, vindo do Painel). */
export function faseDaUrl(): FaseFunil {
  const e = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('etapa')
  return FASES.find(x => (x.etapas as string[]).includes(e ?? ''))?.id ?? 'TUDO'
}

export function QuadroJornada({ leads, vejaEquipe, onAbrir, onAtualizar, onRegistrarVenda, fase, filtroTemp, soPendencia, selecionando, onSelecionando, premissas, densidade, onFollow, onNovoNaEtapa, guiado }: Props) {
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<EtapaJornada | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [levantamento, setLevantamento] = useState<Lead | null>(null)
  const [perda, setPerda] = useState<{ lead: Lead; motivos: string[] } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tempAberta, setTempAberta] = useState<string | null>(null)
  const [guia, setGuia] = useState<Guia>(null)
  // Ajuste 3: modo Selecionar (aplicar o follow pelo robô a vários clientes) e o modal do follow.
  const setSelecionando = (v: boolean | ((x: boolean) => boolean)) => onSelecionando(typeof v === 'function' ? v(selecionando) : v)
  const [marcados, setMarcados] = useState<string[]>([])
  const [followPara, setFollowPara] = useState<Array<{ id: string; nome: string }> | null>(null)
  const alternarMarcado = (id: string) => setMarcados(m => (m.includes(id) ? m.filter(x => x !== id) : [...m, id]))
  // A orientação some sozinha depois de 15 s (o selo de pendência fica no card); no Modo guiado, fica.
  useEffect(() => { if (!guia || guiado) return; const t = setTimeout(() => setGuia(null), 15_000); return () => clearTimeout(t) }, [guia, guiado])
  // Cabeçalho da coluna: menu "⋯", ordem e quantos cartões mostrar (50 por vez).
  const [menuCol, setMenuCol] = useState<EtapaJornada | null>(null)
  const [ordem, setOrdem] = useState<Partial<Record<EtapaJornada, 'CALOR' | 'TEMPO' | 'VALOR'>>>({})
  const [limites, setLimites] = useState<Partial<Record<EtapaJornada, number>>>({})
  // Cartão: menu "⋯" e, no toque, o primeiro toque mostra as ações (o segundo abre o painel).
  const [menuCard, setMenuCard] = useState<string | null>(null)
  // O menu do cartão fica na tela (position: fixed): não é cortado pela rolagem da coluna nem fica sob o cabeçalho dela.
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [tocado, setTocado] = useState<string | null>(null)
  const toque = useRef(false)
  useEffect(() => {
    if (!menuCol && !menuCard) return
    const fechar = (ev: PointerEvent) => { if (!(ev.target as HTMLElement).closest('.qj-menu-wrap')) { setMenuCol(null); setMenuCard(null) } }
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { setMenuCol(null); setMenuCard(null) } }
    document.addEventListener('pointerdown', fechar); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', fechar); document.removeEventListener('keydown', esc) }
  }, [menuCol, menuCard])
  // O quadro ocupa o resto da altura da tela: só as colunas rolam na vertical.
  const rolaRef = useRef<HTMLDivElement>(null)
  const [alturaQuadro, setAlturaQuadro] = useState<string | null>(null)
  const medir = useCallback(() => {
    const el = rolaRef.current
    if (!el || window.innerWidth < 761) { setAlturaQuadro(null); return }
    const topo = el.getBoundingClientRect().top + window.scrollY
    setAlturaQuadro(`max(480px, calc(100dvh - ${Math.round(topo + 24)}px))`)
  }, [])
  useLayoutEffect(() => {
    medir()
    window.addEventListener('resize', medir)
    const ro = typeof ResizeObserver !== 'undefined' && rolaRef.current?.parentElement?.parentElement ? new ResizeObserver(medir) : null
    if (ro && rolaRef.current?.closest('[data-crm]')) ro.observe(rolaRef.current.closest('[data-crm]') as Element)
    return () => { window.removeEventListener('resize', medir); ro?.disconnect() }
  }, [medir])
  const [conversao, setConversao] = useState<Record<string, { chegaram: number; conversao: number | null }>>({})
  // Ajuste 1: o Painel do dono abre o CRM filtrado numa etapa (?etapa=): mostra a fase dela e leva até a coluna.
  const [destaque] = useState<EtapaJornada | null>(() => {
    const e = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('etapa') as EtapaJornada | null
    return e && ETAPAS_JORNADA.includes(e) ? e : null
  })
  useEffect(() => {
    if (!destaque) return
    const t = setTimeout(() => document.querySelector(`[data-coluna="${destaque}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }), 300)
    return () => clearTimeout(t)
  }, [destaque])
  useEffect(() => {
    proLaboreApi.jornada.conversao().then(c => setConversao(Object.fromEntries(c.etapas.map(x => [x.etapa, x])))).catch(() => setConversao({}))
  }, [leads.length])

  const visiveis = FASES.filter(f => fase === 'TUDO' || f.id === fase)
  const naTela = leads.filter(l => (!filtroTemp || calorDe(l) === filtroTemp) && (!soPendencia || pendencias(l).length > 0))
  // Dentro da coluna: quentes primeiro; no empate, quem tem mais pontos.
  const porEtapa = (e: EtapaJornada) => naTela.filter(l => (l.etapa ?? 'LEAD') === e).sort((a, b) => {
    if (ordem[e] === 'TEMPO') return new Date(a.entrouNaEtapaEm ?? a.criadoEm).getTime() - new Date(b.entrouNaEtapaEm ?? b.criadoEm).getTime()
    if (ordem[e] === 'VALOR') return (b.valorNegociacao || 0) - (a.valorNegociacao || 0)
    return ORDEM_TEMP[calorDe(a)] - ORDEM_TEMP[calorDe(b)] || (b.calor?.pontos ?? 0) - (a.calor?.pontos ?? 0)
  })
  async function definirTemp(lead: Lead, t: Temperatura | null) {
    setTempAberta(null); setErro(null)
    try { await proLaboreApi.jornada.temperatura(lead.id, t); onAtualizar() } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível mudar a temperatura') }
  }
  function seguir(l: Lead, p: Passo) {
    if (p.acao === 'levantamento') setLevantamento(l)
    else if (p.acao === 'venda') onRegistrarVenda(l)
    else if (p.acao === 'mover') { const d = proxima(l); if (d) void mover(l, d) }
    else onAbrir(l.id)
  }

  async function mover(lead: Lead, destino: EtapaJornada, contatoFora?: boolean, forcar?: boolean) {
    if (destino === lead.etapa) return
    if (destino === 'VENDA') { onRegistrarVenda(lead); return }
    setOcupado(true); setErro(null)
    try {
      // CRM livre: o card sempre anda; o que falta vira orientação (e o selo de pendência no card).
      const c = await proLaboreApi.jornada.mover(lead.id, destino, contatoFora, forcar ?? true)
      setAviso(null); onAtualizar()
      const itens = (c.pendencias ?? []).filter(p => !/^Pulou /.test(p))
      setGuia(itens.length ? { lead, destino, itens } : null)
    } catch (e) {
      const d = (e as ErroApi).dados as { faltando?: string[]; podeForcar?: boolean } | undefined
      if ((e as ErroApi).status === 422 && d?.faltando?.length) setAviso({ lead, destino, faltando: d.faltando, podeForcar: !!d.podeForcar })
      else setErro(e instanceof Error ? e.message : 'Não foi possível mover')
    } finally { setOcupado(false) }
  }
  const proxima = (l: Lead): EtapaJornada | null => {
    const i = ETAPAS_JORNADA.indexOf((l.etapa ?? 'LEAD') as EtapaJornada)
    if (l.etapa === 'LEVANTAMENTO' && l.formaPagamento === 'A_VISTA') return 'NEGOCIACAO'
    return i >= 0 && i + 1 < ETAPAS_JORNADA.length ? ETAPAS_JORNADA[i + 1] : null
  }
  async function abrirPerda(lead: Lead) {
    try { const c = await proLaboreApi.jornada.checklist(lead.id); setPerda({ lead, motivos: c.motivos }) } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível abrir') }
  }

  // --- Cartões --------------------------------------------------------
  const avatar = (l: Lead) => vejaEquipe && l.vendedor?.nome
    ? <span className="pl-avatar qj-avatar" title={l.vendedor.nome} aria-label={`Vendedor: ${l.vendedor.nome}`} data-vendedor-card>{l.vendedor.nome.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()}</span>
    : null
  const temperatura = (l: Lead, temp: Temperatura, simples: boolean) => (
    <span className="qj-temp-wrap" onClick={ev => ev.stopPropagation()}>
      <button type="button" className={`qj-temp ${simples ? 'qj-temp-ponto' : ''} qj-${temp.toLowerCase()}`} onClick={() => setTempAberta(t => (t === l.id ? null : l.id))} title={`${NOME_TEMP[temp]}: ${l.calor?.motivo ?? ''}. Clique para ajustar.`} aria-label={`Temperatura ${NOME_TEMP[temp]}`} aria-expanded={tempAberta === l.id} data-temperatura={temp}><i aria-hidden />{NOME_TEMP[temp]}{l.calor?.manual ? '*' : ''}</button>
      {tempAberta === l.id && (
        <span className="qj-temp-menu" role="menu" data-menu-temperatura>
          {(['QUENTE', 'MORNO', 'FRIO'] as const).map(t => <button key={t} type="button" role="menuitem" onClick={() => void definirTemp(l, t)} data-definir-temp={t}>{NOME_TEMP[t]}</button>)}
          <button type="button" role="menuitem" onClick={() => void definirTemp(l, null)} data-definir-temp="AUTO">Automática</button>
        </span>
      )}
    </span>
  )
  const nomeDoCartao = (l: Lead) => {
    const n = nomeLimpo(l)
    return n ? <span className="pl-kanban-card-name pl-kc-nome">{n}</span> : <span className="pl-kanban-card-name pl-kc-nome qj-sem-nome" title={l.nomeCliente}>Sem nome {l.telefone && <small>{l.telefone}</small>}</span>
  }
  const motoDoCartao = (l: Lead) => (motoValida(l.modeloInteresse)
    ? <span className="pl-kc-moto" title={l.modeloInteresse ?? ''}>{l.modeloInteresse}</span>
    : <span className="pl-kc-moto qj-sem-moto" title={l.modeloInteresse ?? 'Sem moto de interesse'}>Moto não informada</span>)
  const tempoDoCartao = (l: Lead, curto: boolean) => {
    const limite = estourou(l, premissas)
    return <span className={`pl-kanban-card-time ${limite?.parado ? 'stale' : ''}`} title={limite ? `Tempo nesta etapa · máx. ${limite.max} (Metas e premissas)` : 'Tempo nesta etapa'} data-tempo-etapa={limite?.parado ? 'parado' : 'ok'}>{tempoNaEtapa(l)}{!curto && limite ? ` / ${limite.max}` : ''}</span>
  }
  /** Faixa de exceção no topo do cartão: vermelha (follow atrasado ou tempo estourado), âmbar (follow de hoje). */
  const excecao = (l: Lead, sit: ReturnType<typeof situacaoFollow> | null) => (sit?.tipo === 'ATRASADO' || estourou(l, premissas)?.parado ? 'critico' : sit?.tipo === 'HOJE' ? 'hoje' : null)
  function abrirCartao(l: Lead) {
    if (selecionando) { alternarMarcado(l.id); return }
    // Toque: o primeiro mostra as ações; o segundo abre o painel.
    if (toque.current && tocado !== l.id) { setTocado(l.id); return }
    setTocado(null); onAbrir(l.id)
  }
  const menuDoCartao = (l: Lead, e: EtapaJornada) => {
    const wa = l.conversa?.id ? `/pro-labore/whatsapp?conversa=${l.conversa.id}` : null
    const waExterno = !wa ? linkWhatsapp(l.telefone) : null
    return (
      <span className="qj-menu-wrap">
        <button type="button" className="pl-btn pl-btn-ghost qj-card-mais" aria-label={`Mais ações de ${l.nomeCliente}`} aria-expanded={menuCard === l.id}
          onClick={ev => { const r = ev.currentTarget.getBoundingClientRect(); const alto = 190; setMenuPos({ top: r.bottom + alto + 8 > window.innerHeight ? Math.max(8, r.top - alto - 4) : r.bottom + 4, left: Math.max(8, Math.min(window.innerWidth - 228, r.right - 220)) }); setMenuCard(m => (m === l.id ? null : l.id)) }} data-menu-card>⋯</button>
        {menuCard === l.id && (
          <span className="qj-menu qj-menu-card" role="menu" style={menuPos ? { position: 'fixed', top: menuPos.top, left: menuPos.left, right: 'auto', bottom: 'auto', width: 220 } : undefined}>
            {['ABORDADO', 'LEVANTAMENTO'].includes(e) && <button type="button" role="menuitem" onClick={() => { setMenuCard(null); setLevantamento(l) }} data-levantamento>Levantamento</button>}
            {e !== 'VENDA' && <button type="button" role="menuitem" onClick={() => { setMenuCard(null); void abrirPerda(l) }} data-perda>Perdido</button>}
            {wa && <Link role="menuitem" href={wa} data-abrir-conversa>Abrir conversa no WhatsApp</Link>}
            {waExterno && <a role="menuitem" href={waExterno} target="_blank" rel="noopener noreferrer" data-abrir-conversa>Abrir conversa no WhatsApp</a>}
            <button type="button" role="menuitem" onClick={() => { setMenuCard(null); onFollow(l) }} data-agendar-follow>Agendar follow</button>
          </span>
        )}
      </span>
    )
  }
  const acoesDoCartao = (l: Lead, e: EtapaJornada, prox: EtapaJornada | null) => (
    <div className="qj-acoes" onClick={ev => ev.stopPropagation()}>
      {prox && <button type="button" className="pl-btn pl-btn-primary qj-avancar" disabled={ocupado} onClick={() => void mover(l, prox)} data-avancar title={prox === 'VENDA' ? 'Registrar venda' : `Avançar para ${NOME_ETAPA[prox]}`}>{prox === 'VENDA' ? 'Registrar venda' : `Avançar → ${NOME_ETAPA[prox]}`}</button>}
      {menuDoCartao(l, e)}
    </div>
  )
  const somenteLeitura = (l: Lead) => (
    <div key={l.id} className="pl-kanban-card pl-kc" data-card={l.id} data-somente-leitura title="Você passou este lead ao vendedor: aqui aparece só a etapa e o resultado">
      <span className="pl-kanban-card-name pl-kc-nome">{nomeLimpo(l) ?? 'Sem nome'}</span>
      <div className="pl-hint">Passado a {l.vendedor?.nome ?? 'vendedor'} · {l.resultado === 'VENDIDO' ? 'vendido' : l.resultado === 'PERDIDO' ? 'perdido' : 'em andamento'}</div>
    </div>
  )
  const propsDoCartao = (l: Lead, extra: string, sit: ReturnType<typeof situacaoFollow> | null) => {
    const temp = calorDe(l), exc = excecao(l, sit)
    return {
      className: `pl-kanban-card pl-kc qj-card qj-${temp.toLowerCase()} ${extra} ${tocado === l.id ? 'tocado' : ''}`, draggable: true, tabIndex: 0,
      'data-card': l.id, 'data-calor': temp, 'data-excecao': exc ?? undefined, 'aria-label': `${nomeLimpo(l) ?? 'Sem nome'}, ${NOME_TEMP[temp]}`,
      onDragStart: () => setArrastando(l.id), onDragEnd: () => setArrastando(null),
      onPointerDown: (ev: React.PointerEvent) => { toque.current = ev.pointerType === 'touch' },
      onClick: () => abrirCartao(l),
      onKeyDown: (ev: React.KeyboardEvent) => { if (ev.key === 'Enter' && ev.target === ev.currentTarget) onAbrir(l.id) },
    }
  }
  const marcar = (l: Lead) => selecionando && (
    <label className="qj-marcar" onClick={ev => ev.stopPropagation()}>
      <input type="checkbox" checked={marcados.includes(l.id)} onChange={() => alternarMarcado(l.id)} aria-label={`Selecionar ${l.nomeCliente}`} data-marcar={l.id} />
    </label>
  )

  /** Cartão compacto (padrão): nome e temperatura · moto e valor · próximo passo, tempo, ícones e vendedor. */
  function cartaoCompacto(l: Lead, e: EtapaJornada) {
    if (l.somenteLeitura) return somenteLeitura(l)
    const temp = calorDe(l), pend = pendencias(l), passo = proximoPasso(l), prox = proxima(l)
    const sit = l.follows?.[0] ? situacaoFollow(l.follows[0]) : null
    const robo = l.preVenda?.robo?.codigo === 'PRONTO'
    const levIncompleto = (e === 'LEVANTAMENTO' || e === 'ABORDADO') && !l.levantamentoCompleto
    return (
      <div key={l.id} {...propsDoCartao(l, 'qj-compacto', sit)}>
        {marcar(l)}
        <div className="qj-l1">{nomeDoCartao(l)}{temperatura(l, temp, true)}</div>
        <div className="qj-l2">{motoDoCartao(l)}<span className="pl-kc-valor pl-mono">{l.valorNegociacao > 0 ? moeda(l.valorNegociacao) : '—'}</span></div>
        <div className="qj-l3">
          {passo
            ? <button type="button" className={`qj-passo-txt ${sit && sit.tipo !== 'FUTURO' ? `qj-passo-${sit.tipo.toLowerCase()}` : ''}`} onClick={ev => { ev.stopPropagation(); seguir(l, passo) }} title={[pend.length ? pend.join(' · ') : 'Sugestão do ARIES para este lead', sit && sit.tipo !== 'FUTURO' ? sit.texto : ''].filter(Boolean).join(' · ')} data-proximo-passo>{passo.texto}</button>
            : <span className="qj-passo-txt pl-kc-sem-passo">Sem próximo passo</span>}
          <span className="qj-l3-dir">
            {tempoDoCartao(l, true)}
            {pend.length > 0 && <span className="qj-ico qj-ico-pend" title={pend.join(' · ')} data-pendencia><IcoPend />{pend.length}</span>}
            {robo && <span className="qj-ico qj-ico-robo" title={l.preVenda?.robo?.texto ?? 'Robô pronto para simular'} data-robo="PRONTO"><IcoRobo /></span>}
            {levIncompleto && <span className="qj-ico" title="Levantamento incompleto"><IcoLev /></span>}
            {avatar(l)}
          </span>
        </div>
        {guiado && e !== 'VENDA' && <div className="qj-l4" data-o-que-fazer-card>O que fazer: {pend[0] ?? O_QUE_FAZER[e]}</div>}
        {acoesDoCartao(l, e, prox)}
      </div>
    )
  }

  /** Cartão detalhado: o cartão completo de antes, com os selos de pagamento e de levantamento. */
  function cartaoDetalhado(l: Lead, e: EtapaJornada) {
    if (l.somenteLeitura) return somenteLeitura(l)
    const temp = calorDe(l), pend = pendencias(l), passo = proximoPasso(l), prox = proxima(l)
    const sit = l.follows?.[0] ? situacaoFollow(l.follows[0]) : null
    return (
      <div key={l.id} {...propsDoCartao(l, 'qj-detalhado', sit)}>
        {marcar(l)}
        <div className="qj-card-topo">{nomeDoCartao(l)}{temperatura(l, temp, false)}</div>
        <div className="pl-kc-linha qj-linha">{motoDoCartao(l)}{l.valorNegociacao > 0 && <span className="pl-kc-valor pl-mono">{moeda(l.valorNegociacao)}</span>}</div>
        <div className="qj-nivel3">
          <div className="qj-nivel3-passo">
            {!passo && <span className="pl-kc-sem-passo">Sem próximo passo</span>}
            {passo && <button type="button" className={`qj-passo-txt ${sit && sit.tipo !== 'FUTURO' ? `qj-passo-${sit.tipo.toLowerCase()}` : ''}`} onClick={ev => { ev.stopPropagation(); seguir(l, passo) }} title={pend.length ? pend.join(' · ') : 'Sugestão do ARIES para este lead'} data-proximo-passo>{passo.texto}{sit && sit.tipo !== 'FUTURO' && <em> · {sit.texto}</em>}</button>}
          </div>
          {avatar(l)}
        </div>
        <div className="qj-selos">
          <SeloRobo lead={l} />
          {l.perfilCliente && <span className="pl-chip qj-perfil" data-perfil-card>{NOME_PERFIL[l.perfilCliente]}</span>}
          {pend.length > 0 && <span className="pl-chip qj-pendente" title={pend.join(' · ')} data-pendencia>{pend.length === 1 ? '1 pendência' : `${pend.length} pendências`}</span>}
          {l.revisarEtapa && <span className="pl-chip" title="Fechado sem venda confirmada na migração: posicione na etapa certa">revisar etapa</span>}
          {l.formaPagamento === 'A_VISTA' && <span className="pl-chip">à vista</span>}
          {l.formaPagamento === 'FINANCIADO' && <span className="pl-chip">financiado</span>}
          {(e === 'LEVANTAMENTO' || e === 'ABORDADO') && !l.levantamentoCompleto && <span className="pl-chip">levantamento incompleto</span>}
          {tempoDoCartao(l, false)}
        </div>
        {guiado && e !== 'VENDA' && <div className="qj-l4" data-o-que-fazer-card>O que fazer: {pend[0] ?? O_QUE_FAZER[e]}</div>}
        {acoesDoCartao(l, e, prox)}
      </div>
    )
  }

  return (
    <div data-quadro-jornada>
      {erro && <div className="pl-alert" role="alert">{erro}</div>}
      <div className="qj-rola" ref={rolaRef} style={alturaQuadro ? { height: alturaQuadro } : undefined} data-quadro-rola>
        <div className="qj-trilho">
          {visiveis.map(f => (
            <section key={f.id} data-fase-bloco={f.id} className="qj-fase">
              {fase === 'TUDO' && <div className="qj-fase-faixa" data-fase-faixa>{f.nome}</div>}
              <div className="qj-colunas">
                {f.etapas.map(e => {
                  const i = ETAPAS_JORNADA.indexOf(e), cards = porEtapa(e)
                  const soma = cards.reduce((t, l) => t + (l.valorNegociacao || 0), 0)
                  const comPend = cards.filter(l => pendencias(l).length > 0).length
                  const mostrar = limites[e] ?? POR_PAGINA
                  return (
                    <div
                      key={e} data-coluna={e}
                      className={`pl-kanban-col qj-col ${sobre === e ? 'drop-active' : ''}`}
                      style={destaque === e ? { boxShadow: '0 0 0 2px var(--pl-border-strong)' } : undefined}
                      onDragOver={ev => { ev.preventDefault(); setSobre(e) }}
                      onDragLeave={() => setSobre(s => (s === e ? null : s))}
                      onDrop={ev => { ev.preventDefault(); setSobre(null); const l = leads.find(x => x.id === arrastando); if (l) void mover(l, e) }}
                    >
                      <div className="qj-col-cab">
                        <div className="qj-col-l1">
                          <span className="qj-col-nome">{i + 1}. {NOME_ETAPA[e]}</span>
                          <span className="qj-col-n pl-mono" aria-label={`${cards.length} leads`}>{cards.length}</span>
                          {e !== 'VENDA' && <button type="button" className="qj-col-btn" onClick={() => onNovoNaEtapa(e)} aria-label={`Novo lead em ${NOME_ETAPA[e]}`} title={`Novo lead já em ${NOME_ETAPA[e]}`} data-novo-na-etapa={e}>+</button>}
                          <span className="qj-menu-wrap">
                            <button type="button" className="qj-col-btn" aria-label={`Opções de ${NOME_ETAPA[e]}`} aria-expanded={menuCol === e} onClick={() => setMenuCol(m => (m === e ? null : e))} data-menu-coluna={e}>⋯</button>
                            {menuCol === e && (
                              <span className="qj-menu" role="menu" onKeyDown={ev => { if (ev.key === 'Escape') setMenuCol(null) }}>
                                <button type="button" role="menuitem" onClick={() => { setSelecionando(true); setMarcados(cards.filter(l => !l.somenteLeitura).map(l => l.id)); setMenuCol(null) }} data-selecionar-coluna>Selecionar os desta coluna</button>
                                <button type="button" role="menuitemcheckbox" aria-checked={ordem[e] === 'TEMPO'} onClick={() => { setOrdem(o => ({ ...o, [e]: o[e] === 'TEMPO' ? 'CALOR' : 'TEMPO' })); setMenuCol(null) }} data-ordenar="TEMPO">{ordem[e] === 'TEMPO' ? '✓ ' : ''}Ordenar por tempo</button>
                                <button type="button" role="menuitemcheckbox" aria-checked={ordem[e] === 'VALOR'} onClick={() => { setOrdem(o => ({ ...o, [e]: o[e] === 'VALOR' ? 'CALOR' : 'VALOR' })); setMenuCol(null) }} data-ordenar="VALOR">{ordem[e] === 'VALOR' ? '✓ ' : ''}Ordenar por valor</button>
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="qj-col-l2">
                          <span className="pl-mono" title={`Soma do valor da negociação: ${moeda(soma)}`}>{soma > 0 ? moedaAbrev(soma) : 'R$ 0'}</span>
                          {e !== 'VENDA' && conversao[e]?.conversao != null && <span title={`Dos ${conversao[e].chegaram} leads que chegaram a esta etapa nos últimos 30 dias, quantos passaram à seguinte${e === 'MQL' || e === 'SQL' ? ' (sem os à vista)' : e === 'AGENDAMENTO' || e === 'VISITA' ? ' (sem as vendas sem visita)' : ''}`} data-conversao={e}>{conversao[e].conversao}% avançam</span>}
                          {comPend > 0 && <span className="qj-col-pend" title={`${comPend} ${comPend === 1 ? 'avançou' : 'avançaram'} faltando algum critério`} data-col-pendencias><IcoPend />{comPend}</span>}
                        </div>
                        {guiado && <div className="qj-col-l3" data-pergunta-coluna>{PERGUNTA_ETAPA[e]}</div>}
                      </div>
                      <div className="pl-kanban-cards qj-cards">
                        {cards.length === 0 && <div className="pl-kanban-empty">Nenhum lead nesta etapa</div>}
                        {cards.slice(0, mostrar).map(l => (densidade === 'detalhado' ? cartaoDetalhado(l, e) : cartaoCompacto(l, e)))}
                        {cards.length > mostrar && <button type="button" className="pl-btn pl-btn-ghost qj-mais" onClick={() => setLimites(m => ({ ...m, [e]: mostrar + POR_PAGINA }))} data-mostrar-mais={e}>Mostrar mais {Math.min(POR_PAGINA, cards.length - mostrar)}</button>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {aviso && (() => {
        const contato = aviso.faltando.some(f => /Confirme que você respondeu/.test(f))
        const lev = aviso.faltando.some(f => /levantamento|coleta/i.test(f))
        const n = aviso.faltando.length
        // Uma decisão principal (o que resolve) e, no máximo, uma secundária (avançar mesmo assim).
        const principal = contato
          ? <button type="button" className="pl-btn pl-btn-primary" disabled={ocupado} onClick={() => void mover(aviso.lead, aviso.destino, true)} data-confirmar-contato>Confirmo que respondi o cliente</button>
          : lev
            ? <button type="button" className="pl-btn pl-btn-primary" onClick={() => { setLevantamento(aviso.lead); setAviso(null) }}>Preencher o levantamento</button>
            : aviso.podeForcar ? <button type="button" className="pl-btn pl-btn-primary" onClick={() => { onAbrir(aviso.lead.id); setAviso(null) }} data-resolver-agora>Resolver agora</button> : null
        return (
          <div className="pl-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="qj-aviso-titulo" data-aviso-criterio onClick={() => setAviso(null)} onKeyDown={e => { if (e.key === 'Escape') setAviso(null) }}>
            <div className="pl-modal-panel pl-card qj-aviso" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
              <button type="button" className="pl-pn-fechar qj-aviso-x" onClick={() => setAviso(null)} aria-label="Fechar" autoFocus>✕</button>
              <h3 id="qj-aviso-titulo" style={{ marginTop: 0 }}>{aviso.podeForcar ? `Antes de ir para ${NOME_ETAPA[aviso.destino]}: ${n === 1 ? 'falta 1 critério' : `faltam ${n} critérios`}` : `Não dá para mover para ${NOME_ETAPA[aviso.destino]}`}</h3>
              <p className="pl-hint" style={{ margin: '0 0 6px' }}>{nomeLimpo(aviso.lead) ?? 'O lead'}{aviso.lead.valorNegociacao > 0 ? ` · ${moeda(aviso.lead.valorNegociacao)} em negociação` : ''} · {aviso.podeForcar ? 'o ideal é resolver isto primeiro:' : 'motivo:'}</p>
              <ul className="qj-faltas">{aviso.faltando.map(f => <li key={f}>{f}</li>)}</ul>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {principal}
                {aviso.podeForcar
                  ? <button type="button" className="pl-btn" disabled={ocupado} onClick={() => void mover(aviso.lead, aviso.destino, undefined, true)} data-avancar-mesmo-assim title="Move o card e deixa a pendência marcada no lead e no histórico">Avançar mesmo assim</button>
                  : !principal && <button type="button" className="pl-btn" onClick={() => setAviso(null)}>Entendi</button>}
              </div>
              {aviso.podeForcar && <p className="pl-hint" style={{ marginBottom: 0 }}>Se avançar mesmo assim, o card fica com o selo de pendência até você resolver.</p>}
            </div>
          </div>
        )
      })()}
      {selecionando && !followPara && (
        <div className="qj-selecao" role="toolbar" aria-label="Clientes selecionados" data-barra-selecao>
          <b>{marcados.length}</b> {marcados.length === 1 ? 'cliente selecionado' : 'clientes selecionados'}
          <button type="button" className="pl-btn pl-btn-primary" disabled={!marcados.length} onClick={() => setFollowPara(leads.filter(l => marcados.includes(l.id)).map(l => ({ id: l.id, nome: l.nomeCliente })))} data-follow-selecionados>Follow pelo robô</button>
          <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setMarcados(naTela.filter(l => !l.somenteLeitura).map(l => l.id))}>Marcar os da tela</button>
          <button type="button" className="pl-btn pl-btn-ghost" onClick={() => { setSelecionando(false); setMarcados([]) }}>Cancelar</button>
        </div>
      )}
      {followPara && <FollowRoboModal leads={followPara} fechar={() => setFollowPara(null)} aoAplicar={() => { setMarcados([]); setSelecionando(false); onAtualizar() }} />}
      {guia && (
        <div className="qj-guia" data-guia-etapa>
          <AvisoNarrativo key={`${guia.lead.id}-${guia.destino}`} dados="guia"
            tensao={<>{nomeLimpo(guia.lead) ?? 'O lead'} foi para {NOME_ETAPA[guia.destino]}: {guia.itens.length === 1 ? '1 coisa a fazer' : `${guia.itens.length} coisas a fazer`} nesta etapa</>}
            emJogo={<>{guia.itens.join(' · ')}{guia.lead.valorNegociacao > 0 ? ` · ${moeda(guia.lead.valorNegociacao)} em negociação` : ''}</>}
            principal={guia.itens.some(f => /levantamento|coleta/i.test(f))
              ? { rotulo: 'Preencher o levantamento', onClick: () => setLevantamento(guia.lead), feito: 'Feito: levantamento aberto', dados: 'levantamento' }
              : { rotulo: 'Fazer agora', onClick: () => onAbrir(guia.lead.id), feito: 'Feito: lead aberto no painel', dados: 'resolver' }}
            secundario={{ rotulo: 'Depois', onClick: () => setGuia(null), dados: 'ok' }}
            aoTerminar={() => setGuia(null)}
          />
        </div>
      )}
      {levantamento && <ModalLevantamento lead={levantamento} onFechar={() => setLevantamento(null)} onSalvo={() => { setLevantamento(null); onAtualizar() }} />}
      {perda && <ModalPerda lead={perda.lead} motivos={perda.motivos} onFechar={() => setPerda(null)} onSalvo={() => { setPerda(null); onAtualizar() }} />}
    </div>
  )
}

export function ModalLevantamento({ lead, onFechar, onSalvo }: { lead: Lead; onFechar: () => void; onSalvo: () => void }) {
  const [modelo, setModelo] = useState(lead.modeloInteresse ?? '')
  const [pagamento, setPagamento] = useState(lead.formaPagamento ?? '')
  const [cnh, setCnh] = useState(lead.situacaoCnh ?? '')
  const [entrada, setEntrada] = useState(lead.temEntrada === true ? 'SIM' : lead.temEntrada === false ? 'NAO' : '')
  const [falta, setFalta] = useState<string[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(null)
    try {
      const c = await proLaboreApi.jornada.levantamento(lead.id, {
        modeloInteresse: modelo.trim() || null, formaPagamento: (pagamento || null) as 'A_VISTA' | 'FINANCIADO' | null,
        situacaoCnh: (cnh || null) as 'TEM' | 'EM_PROCESSO' | 'NAO_TEM' | null, temEntrada: entrada === '' ? null : entrada === 'SIM',
      })
      if (c.levantamentoFalta.length) setFalta(c.levantamentoFalta); else onSalvo()
    } catch (er) { setErro(er instanceof Error ? er.message : 'Não foi possível salvar') }
  }
  return (
    <div className="pl-modal-backdrop" role="dialog" aria-modal="true" data-modal-levantamento onClick={onFechar}>
      <form className="pl-modal-panel pl-card" onClick={e => e.stopPropagation()} onSubmit={salvar} style={{ maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>Levantamento · {lead.nomeCliente}</h3>
        <div className="pl-field"><label htmlFor="lv-modelo">Modelo de interesse</label><input id="lv-modelo" className="pl-input" value={modelo} onChange={e => setModelo(e.target.value)} /></div>
        <div className="pl-field"><label htmlFor="lv-pag">Forma de pagamento</label>
          <select id="lv-pag" className="pl-input" value={pagamento} onChange={e => setPagamento(e.target.value)}><option value="">Ainda não sabe</option><option value="FINANCIADO">Financiado</option><option value="A_VISTA">À vista</option></select></div>
        <div className="pl-field"><label htmlFor="lv-cnh">CNH</label>
          <select id="lv-cnh" className="pl-input" value={cnh} onChange={e => setCnh(e.target.value)}><option value="">Não informado</option><option value="TEM">Tem CNH</option><option value="EM_PROCESSO">Tirando</option><option value="NAO_TEM">Não tem</option></select></div>
        <div className="pl-field"><label htmlFor="lv-ent">Tem entrada?</label>
          <select id="lv-ent" className="pl-input" value={entrada} onChange={e => setEntrada(e.target.value)}><option value="">Não informado</option><option value="SIM">Sim</option><option value="NAO">Não</option></select></div>
        {falta && <p className="pl-hint" data-levantamento-falta>Salvo. Ainda falta: {falta.join(', ')}.</p>}
        {erro && <div className="pl-alert" role="alert">{erro}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="pl-btn pl-btn-primary">Salvar</button>
          <button type="button" className="pl-btn pl-btn-ghost" onClick={falta ? onSalvo : onFechar}>{falta ? 'Fechar' : 'Cancelar'}</button>
        </div>
      </form>
    </div>
  )
}

function ModalPerda({ lead, motivos, onFechar, onSalvo }: { lead: Lead; motivos: string[]; onFechar: () => void; onSalvo: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [nota, setNota] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!motivo) { setErro('Escolha o motivo'); return }
    try { await proLaboreApi.jornada.perda(lead.id, motivo, nota.trim() || undefined); onSalvo() } catch (er) { setErro(er instanceof Error ? er.message : 'Não foi possível registrar') }
  }
  return (
    <div className="pl-modal-backdrop" role="dialog" aria-modal="true" data-modal-perda onClick={onFechar}>
      <form className="pl-modal-panel pl-card" onClick={e => e.stopPropagation()} onSubmit={salvar} style={{ maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>Perdido · {lead.nomeCliente}</h3>
        <p className="pl-hint">Escolha o motivo. O destino (Reativação ou encerramento) o sistema aplica sozinho.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {motivos.map(m => (
            <label key={m} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="radio" name="motivo" value={m} checked={motivo === m} onChange={() => setMotivo(m)} />
              {NOME_MOTIVO[m] ?? m}{m === 'PEDIU_NAO_CONTATO' && <span className="pl-hint"> · bloqueia o cliente</span>}
            </label>
          ))}
        </div>
        <div className="pl-field" style={{ marginTop: 10 }}><label htmlFor="pd-nota">Observação (opcional)</label><textarea id="pd-nota" className="pl-input" value={nota} onChange={e => setNota(e.target.value)} rows={2} /></div>
        {erro && <div className="pl-alert" role="alert">{erro}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="pl-btn pl-btn-primary" data-confirmar-perda>Registrar perda</button>
          <button type="button" className="pl-btn pl-btn-ghost" onClick={onFechar}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

export { NOME_DESTINO }
