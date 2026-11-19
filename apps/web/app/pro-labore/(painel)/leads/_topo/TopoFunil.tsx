'use client'

// Topo do Funil (19/11): de 7 faixas para 3.
// 1. Cabeçalho numa linha (título, pergunta, "i", Mais do CRM e Novo lead).
// 2. Números numa linha (cada número aplica o filtro dele) + selo da Lente.
// 3. Barra de ferramentas (busca, fase, Filtros, chips ativos, Selecionar, densidade).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { telasApi, recApi, type Lente as LenteDados, type Temperatura, type TipoLead, type Vendedor } from '@/lib/proLaboreApi'
import { abaPorChave } from '@/lib/abasAries'
import { periodoHoje, periodoSemanaAtual } from '@/lib/proLaboreFunilFiltro'
import { FichaMetricaModal } from '../../_metricas/Metricas'
import { Lente, fmtValor, useTelas } from '../../_padrao/Padrao'
import { ROTULO_ETIQUETA } from '../../assistente/_componentes/jornada'
import type { FaseFunil } from '../_jornada/QuadroJornada'

// --- utilidades ---------------------------------------------------------
/** Fecha ao clicar fora e com Esc. */
function useFecharFora(aberto: boolean, fechar: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) fechar() }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }
    document.addEventListener('pointerdown', fora); document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', tecla) }
  }, [aberto, fechar])
  return ref
}

export const moedaCurta = (v: number): string => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (v >= 1000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: v >= 100_000 ? 0 : 1 })} mil`
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}

// --- 1. Cabeçalho -------------------------------------------------------
export function CabecalhoFunil({ avisosMais, onMais, onNovo, menu }: { avisosMais: number; onMais: () => void; onNovo: () => void; menu?: React.ReactNode }) {
  const aba = abaPorChave('crm')
  const [info, setInfo] = useState(false)
  const ref = useFecharFora(info, () => setInfo(false))
  return (
    <header className="fn-cab" data-cabecalho-funil>
      <div className="fn-cab-titulo">
        <h1>Funil</h1>
        <span className="fn-cab-pergunta" data-pergunta>{aba?.pergunta ?? 'Em que etapa está cada cliente?'}</span>
        <div className="fn-pop-wrap" ref={ref}>
          <button type="button" className="fn-info" aria-label="Sobre esta tela" aria-expanded={info} onClick={() => setInfo(v => !v)} data-info-funil>i</button>
          {info && aba && <div className="fn-pop" role="dialog" aria-label="Sobre esta tela">Para: {aba.paraQuem} · Ação principal: {aba.acaoPrincipal}</div>}
        </div>
      </div>
      <div className="fn-cab-acoes">
        {menu}
        <button type="button" className="pl-btn crm-mais" onClick={onMais} aria-haspopup="dialog" data-abrir-mais-crm title="Resumo em R$, custos por etapa, avisos, etiquetas e WhatsApp">
          Mais do CRM{avisosMais > 0 && <span className="crm-mais-n">{avisosMais}</span>}
        </button>
        <button type="button" className="pl-btn pl-btn-primary crm-novo" onClick={onNovo} data-novo-lead>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
          Novo lead
        </button>
      </div>
    </header>
  )
}

/** "⋯" do cabeçalho do Funil: o Modo guiado (também em Configurações). */
export function MenuFunil({ guiado, onGuiado }: { guiado: boolean; onGuiado: (v: boolean) => void }) {
  const [aberto, setAberto] = useState(false)
  const ref = useFecharFora(aberto, () => setAberto(false))
  return (
    <div className="fn-pop-wrap" ref={ref}>
      <button type="button" className="pl-btn fn-mais-cab" aria-label="Opções do Funil" aria-expanded={aberto} onClick={() => setAberto(v => !v)} data-menu-funil>⋯</button>
      {aberto && (
        <div className="fn-pop fn-pop-dir" role="menu">
          <label className="fn-alternar" data-alternar-guiado>
            <input type="checkbox" role="menuitemcheckbox" aria-checked={guiado} checked={guiado} onChange={e => onGuiado(e.target.checked)} />
            <span><b>Modo guiado</b><br /><small>Mostra a dica do quadro, a pergunta de cada coluna e o que fazer em cada card. O guia depois de mover não some sozinho.</small></span>
          </label>
        </div>
      )}
    </div>
  )
}

// --- 2. Números ---------------------------------------------------------
export interface NumerosFunil {
  noFunil: number
  oportunidade: number
  parados: number
  followsHoje: number
  followsAtrasados: number
  taxaAbordagem: number | null
  leadsNovos: number | null
}
export function FaixaNumeros({ n, ativos, onNoFunil, onOportunidade, onParados, onFollow, onLeadsNovos, lente, onLenteMudou }: {
  n: NumerosFunil
  ativos: { parados: boolean; follow: '' | 'HOJE' | 'ATRASADO'; leadsNovos: boolean }
  onNoFunil: () => void
  onOportunidade: () => void
  onParados: () => void
  onFollow: (f: 'HOJE' | 'ATRASADO') => void
  onLeadsNovos: () => void
  lente: LenteDados | null
  onLenteMudou: () => void
}) {
  const [ficha, setFicha] = useState<string | null>(null)
  const [lenteAberta, setLenteAberta] = useState(false)
  const ref = useFecharFora(lenteAberta, () => setLenteAberta(false))
  const itens = lente && !lente.vazio ? lente.itens : []
  return (
    <>
      <div className="fn-numeros" role="group" aria-label="Números do funil" data-faixa-resumo>
        <button type="button" className="fn-num" onClick={onNoFunil} title="Leads no funil com os filtros da tela. Clique para limpar os filtros." data-num="no-funil">
          <b className="pl-mono">{n.noFunil.toLocaleString('pt-BR')}</b><span>no funil</span>
        </button>
        <button type="button" className="fn-num" onClick={onOportunidade} title="Soma do valor da negociação dos leads abertos. Clique para ver o resumo em R$." data-num="oportunidade">
          <b className="pl-mono">{moedaCurta(n.oportunidade)}</b><span>oportunidade</span>
        </button>
        <button type="button" className={`fn-num ${ativos.parados ? 'ativo' : ''}`} aria-pressed={ativos.parados} onClick={onParados} title="Abertos há mais tempo que o máximo da etapa (Metas e premissas). Clique para ver só eles." data-num="parados">
          <b className="pl-mono">{n.parados}</b><span>{n.parados === 1 ? 'parado' : 'parados'}</span>
        </button>
        <span className="fn-num fn-num-duplo" title="Follows pendentes dos leads em andamento: de hoje (ainda no horário) e atrasados (data e hora já passaram)">
          <span className="fn-num-rot">Follows</span>
          <button type="button" className={ativos.follow === 'HOJE' ? 'ativo' : ''} aria-pressed={ativos.follow === 'HOJE'} onClick={() => onFollow('HOJE')} data-num="follows-hoje" title="Follows de hoje ainda no horário. Clique para filtrar.">
            <b className={`pl-mono ${n.followsHoje > 0 ? 'fn-hoje' : ''}`}>{n.followsHoje}</b> hoje
          </button>
          <span aria-hidden>/</span>
          <button type="button" className={ativos.follow === 'ATRASADO' ? 'ativo' : ''} aria-pressed={ativos.follow === 'ATRASADO'} onClick={() => onFollow('ATRASADO')} data-num="follows-atrasados" title="Follows com data e hora já passadas. Clique para filtrar.">
            <b className={`pl-mono ${n.followsAtrasados > 0 ? 'fn-atrasado' : ''}`}>{n.followsAtrasados}</b> {n.followsAtrasados === 1 ? 'atrasado' : 'atrasados'}
          </button>
        </span>
        <button type="button" className="fn-num" onClick={() => setFicha('taxa_abordagem')} title="Leads abordados ÷ leads novos no mês (dicionário de métricas). Clique para ver a ficha." data-num="taxa-abordagem">
          <b className="pl-mono">{fmtValor(n.taxaAbordagem, 'PCT')}</b><span>abordagem</span>
        </button>
        <button type="button" className={`fn-num ${ativos.leadsNovos ? 'ativo' : ''}`} aria-pressed={ativos.leadsNovos} onClick={onLeadsNovos} title="Leads que entraram neste mês (dicionário de métricas). Clique para ver só eles." data-num="leads-novos">
          <b className="pl-mono">{n.leadsNovos == null ? '—' : n.leadsNovos.toLocaleString('pt-BR')}</b><span>leads novos</span>
        </button>
        <div className="fn-pop-wrap fn-lente-wrap" ref={ref}>
          <button type="button" className="fn-lente-selo" onClick={() => setLenteAberta(v => !v)} aria-expanded={lenteAberta} data-lente-selo>
            <i className={itens.length ? 'tem' : 'ok'} aria-hidden />
            {!lente ? 'Lente do ARIES…' : itens.length ? `Lente do ARIES: ${itens.length} ${itens.length === 1 ? 'recomendação' : 'recomendações'}` : 'Lente do ARIES: nada fora do normal'}
          </button>
          {lenteAberta && <div className="fn-pop fn-pop-lente"><Lente aba="crm" dados={lente} aoMudar={onLenteMudou} /></div>}
        </div>
      </div>
      {itens[0] && <FaixaLente item={itens[0]} total={itens.length} onVerTodas={() => setLenteAberta(true)} onMudou={onLenteMudou} />}
      {ficha && <FichaMetricaModal chave={ficha} onFechar={() => setFicha(null)} />}
    </>
  )
}

/** Recomendação da Lente no formato do aviso com narrativa: tensão, o que está em jogo e uma decisão. */
function FaixaLente({ item, total, onVerTodas, onMudou }: { item: LenteDados['itens'][number]; total: number; onVerTodas: () => void; onMudou: () => void }) {
  const { registrarAcao } = useTelas()
  const [depois, setDepois] = useState(false)
  const [feito, setFeito] = useState<string | null>(null)
  useEffect(() => { if (!feito) return; const t = setTimeout(() => setFeito(null), 5000); return () => clearTimeout(t) }, [feito])
  if (feito) return <div className="fn-aviso fn-aviso-feito" role="status" data-aviso-feito>{feito}</div>
  if (depois) return null
  const evidencia = item.evidencia.replace(/\[\[[a-z_]+\]\]/g, 'o valor')
  return (
    <div className="fn-aviso" role="status" data-aviso-lente>
      <div className="fn-aviso-txt">
        <b>{item.achado}</b>
        <span>{evidencia}</span>
      </div>
      <div className="fn-aviso-botoes">
        {item.acao?.href
          ? <Link className="pl-btn pl-btn-primary" href={item.acao.href} onClick={() => { registrarAcao('lente:acao'); setFeito(`Feito: abrindo ${item.acao!.rotulo.toLowerCase()}`) }}>{item.acao.rotulo}</Link>
          : item.tipo === 'REC' && item.podeAceitar && item.id
            ? <button type="button" className="pl-btn pl-btn-primary" onClick={() => void recApi.aceitar(item.id!).then(() => { registrarAcao('lente:aceitar'); setFeito('Feito: recomendação aceita, as atividades foram criadas'); onMudou() }).catch(() => undefined)}>Aceitar</button>
            : <button type="button" className="pl-btn pl-btn-primary" onClick={onVerTodas}>Ver na Lente</button>}
        <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setDepois(true)}>Depois</button>
        {total > 1 && <button type="button" className="pl-link-action" onClick={onVerTodas}>Todas ({total})</button>}
      </div>
    </div>
  )
}

export function useLenteCrm() {
  const [lente, setLente] = useState<LenteDados | null>(null)
  const carregar = () => { telasApi.lente('crm').then(setLente).catch(() => setLente(null)) }
  useEffect(carregar, [])
  return [lente, carregar] as const
}

// --- 3. Barra de ferramentas --------------------------------------------
export interface Filtros {
  temp: Temperatura | ''
  pendencia: boolean
  decisao: boolean
  parados: boolean
  follow: '' | 'HOJE' | 'ATRASADO'
  vendedorId: string | null
  canal: TipoLead | ''
  etiqueta: string
  periodo: { inicio: string; fim: string } | null
}
export const FILTROS_VAZIOS: Filtros = { temp: '', pendencia: false, decisao: false, parados: false, follow: '', vendedorId: null, canal: '', etiqueta: '', periodo: null }
const NOME_TEMP: Record<Temperatura, string> = { QUENTE: 'Quentes', MORNO: 'Mornos', FRIO: 'Frios' }
const NOME_CANAL: Record<TipoLead, string> = { TRAFEGO: 'Tráfego pago', ORGANICO: 'Orgânico' }
const FASES_SEG: Array<[FaseFunil, string]> = [['TUDO', 'Tudo'], ['PRE_VENDA', 'Pré-venda'], ['VENDA', 'Venda'], ['FECHAMENTO', 'Fechamento']]
export const periodoMes = () => { const h = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); return { inicio: `${h.slice(0, 8)}01`, fim: h } }
const fmtDia = (d: string) => d.split('-').reverse().slice(0, 2).join('/')

/** Os filtros ligados, cada um com o nome e como desligar (chips da barra). */
export function chipsAtivos(f: Filtros, vendedores: Vendedor[]): Array<{ k: keyof Filtros; rotulo: string }> {
  const c: Array<{ k: keyof Filtros; rotulo: string }> = []
  if (f.temp) c.push({ k: 'temp', rotulo: NOME_TEMP[f.temp] })
  if (f.parados) c.push({ k: 'parados', rotulo: 'Só parados' })
  if (f.follow) c.push({ k: 'follow', rotulo: f.follow === 'HOJE' ? 'Follows de hoje' : 'Follows atrasados' })
  if (f.pendencia) c.push({ k: 'pendencia', rotulo: 'Com pendência' })
  if (f.decisao) c.push({ k: 'decisao', rotulo: 'Em decisão sem follow' })
  if (f.vendedorId) c.push({ k: 'vendedorId', rotulo: vendedores.find(v => v.id === f.vendedorId)?.nome ?? 'Vendedor' })
  if (f.canal) c.push({ k: 'canal', rotulo: NOME_CANAL[f.canal] })
  if (f.etiqueta) c.push({ k: 'etiqueta', rotulo: ROTULO_ETIQUETA[f.etiqueta as keyof typeof ROTULO_ETIQUETA] ?? f.etiqueta })
  if (f.periodo) c.push({ k: 'periodo', rotulo: f.periodo.inicio === f.periodo.fim ? fmtDia(f.periodo.inicio) : `${fmtDia(f.periodo.inicio)} a ${fmtDia(f.periodo.fim)}` })
  return c
}

export function BarraFerramentas({ busca, onBusca, fase, onFase, mostrarFase, filtros, mudar, limpar, contagens, vendedores, etiquetas, selecionando, onSelecionar, densidade }: {
  busca: string
  onBusca: (v: string) => void
  fase: FaseFunil
  onFase: (f: FaseFunil) => void
  mostrarFase: boolean
  filtros: Filtros
  mudar: <K extends keyof Filtros>(k: K, v: Filtros[K]) => void
  limpar: () => void
  contagens: { temp: Record<Temperatura, number>; pendencia: number; decisao: number; parados: number; followsHoje: number; followsAtrasados: number }
  vendedores: Vendedor[]
  etiquetas: Array<{ e: string; n: number }>
  selecionando: boolean
  onSelecionar: (() => void) | null
  densidade: React.ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const ref = useFecharFora(aberto, () => setAberto(false))
  const chips = chipsAtivos(filtros, vendedores)
  const [ini, setIni] = useState(filtros.periodo?.inicio ?? '')
  const [fim, setFim] = useState(filtros.periodo?.fim ?? '')
  const vazio = (k: keyof Filtros) => FILTROS_VAZIOS[k]
  return (
    <div className="fn-barra" data-barra-ferramentas>
      <label className="fn-busca">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <input className="pl-input" value={busca} onChange={e => onBusca(e.target.value)} placeholder="Buscar nome, telefone, moto…" aria-label="Buscar lead" data-busca-funil />
      </label>
      {mostrarFase && (
        <div className="fn-seg" role="group" aria-label="Fase da jornada">
          {FASES_SEG.map(([id, nome]) => <button key={id} type="button" className={fase === id ? 'ativo' : ''} aria-pressed={fase === id} onClick={() => onFase(id)} data-fase={id}>{nome}</button>)}
        </div>
      )}
      <div className="fn-pop-wrap" ref={ref}>
        <button type="button" className={`pl-btn fn-filtros-btn ${chips.length ? 'tem' : ''}`} aria-expanded={aberto} aria-haspopup="dialog" onClick={() => setAberto(v => !v)} data-abrir-filtros>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          Filtros{chips.length > 0 && <span className="fn-n">{chips.length}</span>}
        </button>
        {aberto && (
          <div className="fn-pop fn-filtros" role="dialog" aria-label="Filtros do funil" data-painel-filtros>
            <div className="fn-filtros-grupo">
              <div className="fn-filtros-rot">Temperatura</div>
              <div className="fn-filtros-chips">
                {(['QUENTE', 'MORNO', 'FRIO'] as const).map(t => (
                  <button key={t} type="button" className={`pl-chip qj-temp-chip qj-${t.toLowerCase()} ${filtros.temp === t ? 'active' : ''}`} aria-pressed={filtros.temp === t} onClick={() => mudar('temp', filtros.temp === t ? '' : t)} data-temp={t}><i aria-hidden />{NOME_TEMP[t]} · {contagens.temp[t]}</button>
                ))}
              </div>
            </div>
            <div className="fn-filtros-grupo">
              <div className="fn-filtros-rot">Atenção</div>
              <div className="fn-filtros-chips">
                <button type="button" className={`pl-chip ${filtros.parados ? 'active' : ''}`} aria-pressed={filtros.parados} onClick={() => mudar('parados', !filtros.parados)} data-filtro-parados title="Abertos há mais tempo que o máximo da etapa">Só parados · {contagens.parados}</button>
                <button type="button" className={`pl-chip ${filtros.pendencia ? 'active' : ''}`} aria-pressed={filtros.pendencia} onClick={() => mudar('pendencia', !filtros.pendencia)} data-filtro-pendencia title="Leads que avançaram de etapa faltando algum critério">Com pendência · {contagens.pendencia}</button>
                <button type="button" className={`pl-chip ${filtros.decisao ? 'active' : ''}`} aria-pressed={filtros.decisao} onClick={() => mudar('decisao', !filtros.decisao)} data-filtro-decisao title="Em Negociação ou Proposta há dias, sem follow agendado">Em decisão sem follow · {contagens.decisao}</button>
                <button type="button" className={`pl-chip ${filtros.follow === 'HOJE' ? 'active' : ''}`} aria-pressed={filtros.follow === 'HOJE'} onClick={() => mudar('follow', filtros.follow === 'HOJE' ? '' : 'HOJE')} data-filtro-follow="HOJE">Follows de hoje · {contagens.followsHoje}</button>
                <button type="button" className={`pl-chip ${filtros.follow === 'ATRASADO' ? 'active' : ''}`} aria-pressed={filtros.follow === 'ATRASADO'} onClick={() => mudar('follow', filtros.follow === 'ATRASADO' ? '' : 'ATRASADO')} data-filtro-follow="ATRASADO">Follows atrasados · {contagens.followsAtrasados}</button>
              </div>
            </div>
            <div className="fn-filtros-linha">
              {vendedores.length > 0 && (
                <label className="pl-field"><span>Vendedor</span>
                  <select className="pl-select" value={filtros.vendedorId ?? ''} onChange={e => mudar('vendedorId', e.target.value || null)} data-filtro-vendedor>
                    <option value="">Todos</option>
                    {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                  </select>
                </label>
              )}
              <label className="pl-field"><span>Origem</span>
                <select className="pl-select" value={filtros.canal} onChange={e => mudar('canal', e.target.value as TipoLead | '')} data-filtro-origem>
                  <option value="">Todas</option>
                  <option value="TRAFEGO">Tráfego pago</option>
                  <option value="ORGANICO">Orgânico</option>
                </select>
              </label>
              {etiquetas.length > 0 && (
                <label className="pl-field"><span>Etiqueta</span>
                  <select className="pl-select" value={filtros.etiqueta} onChange={e => mudar('etiqueta', e.target.value)} data-filtro-etiqueta>
                    <option value="">Todas</option>
                    {etiquetas.map(({ e, n }) => <option key={e} value={e}>{ROTULO_ETIQUETA[e as keyof typeof ROTULO_ETIQUETA] ?? e} · {n}</option>)}
                  </select>
                </label>
              )}
            </div>
            <div className="fn-filtros-grupo">
              <div className="fn-filtros-rot">Entrou no período</div>
              <div className="fn-filtros-chips">
                <button type="button" className="pl-chip" onClick={() => mudar('periodo', periodoHoje())}>Hoje</button>
                <button type="button" className="pl-chip" onClick={() => mudar('periodo', periodoSemanaAtual())}>Esta semana</button>
                <button type="button" className="pl-chip" onClick={() => mudar('periodo', periodoMes())}>Este mês</button>
                <input type="date" className="pl-input" value={ini} onChange={e => setIni(e.target.value)} aria-label="De" />
                <input type="date" className="pl-input" value={fim} onChange={e => setFim(e.target.value)} aria-label="Até" />
                <button type="button" className="pl-btn" disabled={!ini || !fim} onClick={() => mudar('periodo', { inicio: ini, fim })}>Aplicar</button>
              </div>
            </div>
            <div className="fn-filtros-fim">
              <button type="button" className="pl-link-action" onClick={limpar} disabled={!chips.length}>Limpar filtros</button>
              <button type="button" className="pl-btn pl-btn-primary" onClick={() => setAberto(false)}>Ver {chips.length ? 'resultado' : 'cards'}</button>
            </div>
          </div>
        )}
      </div>
      {chips.length > 0 && (
        <div className="fn-chips" data-filtros-ativos>
          {chips.map(c => (
            <span key={c.k} className="fn-chip">{c.rotulo}<button type="button" aria-label={`Tirar o filtro ${c.rotulo}`} onClick={() => mudar(c.k, vazio(c.k) as never)}>✕</button></span>
          ))}
          {chips.length > 1 && <button type="button" className="pl-link-action" onClick={limpar} data-limpar-filtros-mais>Limpar</button>}
        </div>
      )}
      <div className="fn-barra-dir">
        {onSelecionar && <button type="button" className={`pl-btn ${selecionando ? 'ativo' : ''}`} aria-pressed={selecionando} onClick={onSelecionar} data-modo-selecionar title="Marque vários clientes para ligar o follow pelo robô">{selecionando ? 'Sair da seleção' : 'Selecionar'}</button>}
        {densidade}
      </div>
    </div>
  )
}

/** A dica "Clique no card…" aparece uma vez por pessoa (ou sempre no Modo guiado). */
export function DicaFunil({ sempre }: { sempre: boolean }) {
  const [fechou, setFechou] = useState(false)
  // Lido do navegador sem efeito (no servidor, conta como vista: a dica só aparece no navegador).
  const jaVista = useSyncExternalStore(() => () => {}, () => { try { return localStorage.getItem('pl_crm_dica_vista') === '1' } catch { return false } }, () => true)
  const vista = fechou || jaVista
  if (vista && !sempre) return null
  return (
    <div className="fn-dica" role="note" data-dica-funil>
      Clique no card para ver tudo do lead · arraste ou use “Avançar” para mudar de etapa · em cada coluna, os quentes vêm primeiro.
      {!sempre && <button type="button" className="pl-link-action" onClick={() => { setFechou(true); try { localStorage.setItem('pl_crm_dica_vista', '1') } catch { /* sem armazenamento */ } }} data-dica-ok>Entendi</button>}
    </div>
  )
}

/**
 * Aviso com narrativa (19/11): tensão (o que está errado, com número), o que
 * está em jogo (R$ ou clientes) e uma decisão (um botão principal com verbo e,
 * no máximo, um secundário). Depois da ação, uma linha de confirmação por 5 s.
 */
export function AvisoNarrativo({ tensao, emJogo, principal, secundario, dados, aoTerminar }: {
  aoTerminar?: () => void
  tensao: React.ReactNode
  emJogo?: React.ReactNode
  principal: { rotulo: string; onClick: () => void; feito?: string; dados?: string }
  secundario?: { rotulo: string; onClick: () => void; feito?: string; dados?: string }
  dados?: string
}) {
  const [feito, setFeito] = useState<string | null>(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!feito) return; const t = setTimeout(() => { setFeito(null); aoTerminar?.() }, 5000); return () => clearTimeout(t) }, [feito])
  if (feito) return <div className="fn-aviso fn-aviso-feito" role="status" data-aviso-feito>{feito}</div>
  const agir = (b: { onClick: () => void; feito?: string }) => () => { b.onClick(); if (b.feito) setFeito(b.feito) }
  return (
    <div className="fn-aviso" role="status" data-aviso={dados}>
      <div className="fn-aviso-txt">
        <b>{tensao}</b>
        {emJogo && <span>{emJogo}</span>}
      </div>
      <div className="fn-aviso-botoes">
        <button type="button" className="pl-btn pl-btn-primary" onClick={agir(principal)} data-aviso-principal={principal.dados}>{principal.rotulo}</button>
        {secundario && <button type="button" className="pl-btn pl-btn-ghost" onClick={agir(secundario)} data-aviso-secundario={secundario.dados}>{secundario.rotulo}</button>}
      </div>
    </div>
  )
}

/** Confirmação curta na tela (5 s), para ações que fecham a janela de onde vieram. */
export function useConfirmacao(): [string | null, (t: string) => void] {
  const [texto, setTexto] = useState<string | null>(null)
  useEffect(() => { if (!texto) return; const t = setTimeout(() => setTexto(null), 5000); return () => clearTimeout(t) }, [texto])
  return [texto, setTexto]
}
