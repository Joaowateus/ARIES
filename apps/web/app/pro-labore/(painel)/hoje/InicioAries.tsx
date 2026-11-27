'use client'

// Tela inicial do ARIES. Modelo "Identidade" aprovado em 27/11: vidro escuro sobre a paisagem em tons de
// cinza (#090909 / #666666 / #F5F5F5, Geist). No topo, uma pílula com a busca e o faturamento do mês; à
// esquerda, a saúde da loja em quatro medidores (faixas do dicionário de métricas); no centro, o que pede
// ação hoje, os destaques e as metas do mês e a fila do dia; à direita, o ARIES com os pontos para revisar
// (aceitar ou descartar recomendações) e a caixa "Pergunte"; embaixo, a barra de atalhos. Tarefas e notas
// abrem numa gaveta. Mesmos dados e ações da versão anterior; o fundo da loja (imagem própria) continua.
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { inicioApi, recApi, telasApi, type AtividadeLista, type InicioDados, type LeituraMetrica, type NotaInicio, type ResultadoBusca, type TarefaInicio } from '@/lib/proLaboreApi'
import { usePLTema } from '@/lib/proLaboreTheme'
import { Ico, MODULOS as MODULOS_PADRAO, NavModulosContext, ParaHojeContext } from '../_padrao/Navegacao'
import { useMetricas } from '../_metricas/Metricas'
import { useAvisar, usePerguntar } from '../_ui/ui'

// ---------- Módulos e atalhos (rotas existentes do ARIES) ----------
const ATALHOS: Record<string, { nome: string; href: string; icone: string }> = {
  'novo-lead': { nome: 'Novo lead', href: '/pro-labore/leads?novo=1', icone: 'lead' },
  'nova-moto': { nome: 'Nova moto', href: '/pro-labore/whatsapp?aba=estoque', icone: 'moto' },
  'nova-campanha': { nome: 'Nova campanha', href: '/pro-labore/trafego', icone: 'campanha' },
  crm: { nome: 'CRM', href: '/pro-labore/leads', icone: 'crm' },
  estoque: { nome: 'Estoque', href: '/pro-labore/aba/estoque-demanda', icone: 'estoque' },
  relatorios: { nome: 'Relatórios', href: '/pro-labore/assistente', icone: 'relatorios' },
  pergunte: { nome: 'Pergunte ao ARIES', href: '/pro-labore/pergunte', icone: 'inteligencia' },
  atividades: { nome: 'Atividades', href: '/pro-labore/atividades', icone: 'calendario' },
  conversas: { nome: 'Conversas', href: '/pro-labore/whatsapp', icone: 'conversa' },
  financeiro: { nome: 'Financeiro', href: '/pro-labore/financeiro', icone: 'dinheiro' },
  painel: { nome: 'Painel', href: '/pro-labore/hoje?sub=painel', icone: 'relatorios' },
}
const ATALHOS_PADRAO = ['novo-lead', 'nova-moto', 'nova-campanha', 'crm', 'estoque', 'relatorios']
const ICONE_MODULO: Record<string, string> = { CRM: 'crm', Comercial: 'comercial', Estoque: 'estoque', Relatórios: 'relatorios', Tráfego: 'trafego' }

// Ícones que não existem no menu (traço igual ao de Ico).
const TRACO: Record<string, string> = {
  alerta: 'M12 8v5M12 16.5v.5M10.3 3.8 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z',
  telefone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  tarefa: 'M4 4h16v16H4ZM8 12l3 3 5-6',
  conversa: 'M4 5h16v11H9l-5 4Z',
  diagonal: 'M7 17 17 7M8 7h9v9',
  enviar: 'M5 12h14M13 6l6 6-6 6',
  direita: 'm9 6 6 6-6 6',
}
const Traco = ({ n, t = 16 }: { n: keyof typeof TRACO; t?: number }) => <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={TRACO[n]} /></svg>

// ---------- Formatos ----------
const compacto = (v: number, unidade: string | null) => {
  if (unidade === 'BRL') return v >= 1_000_000 ? `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : v >= 1000 ? `R$ ${Math.round(v / 1000).toLocaleString('pt-BR')} mil` : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  if (unidade === 'PCT') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}
const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const haQuanto = (iso: string, agora: number) => {
  const m = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000))
  if (m < 1) return 'agora'
  if (m < 60) return `${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h`
  const d = Math.round(h / 24)
  return `${d} ${d === 1 ? 'dia' : 'dias'}`
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const iniciais = (s: string) => s.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '·'
const n = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('pt-BR'))
// Dia de hoje em São Paulo (AAAA-MM-DD).
const diaSP = (t: number) => new Date(t - 3 * 3600e3).toISOString().slice(0, 10)

// Faixa do dicionário de métricas → palavra e cor do medidor.
type Faixa = LeituraMetrica['faixa']
const ESTADO: Record<string, { palavra: string; tom: string }> = { BOM: { palavra: 'Bom', tom: 'ok' }, ATENCAO: { palavra: 'Atenção', tom: 'warn' }, CRITICO: { palavra: 'Crítico', tom: 'crit' } }
const estadoDe = (f: Faixa | undefined) => (f ? ESTADO[f] : null) ?? { palavra: 'Sem faixa', tom: '' }

type Gaveta = { aba: 'tarefas' | 'notas'; nova?: boolean } | null

export function InicioAries({ embutida = false }: { embutida?: boolean } = {}) {
  const MODULOS = useContext(NavModulosContext) ?? MODULOS_PADRAO
  const router = useRouter()
  const tema = usePLTema()
  const [d, setD] = useState<InicioDados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const carregar = useCallback(() => { inicioApi.carregar().then(x => { setD(x); setErro(null) }).catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar')) }, [])
  useEffect(() => { carregar() }, [carregar])

  // Relógio (atualiza a saudação e o período do mês sozinho).
  const [agora, setAgora] = useState<number | null>(null)
  useEffect(() => { setAgora(Date.now()); const t = setInterval(() => setAgora(Date.now()), 30_000); return () => clearInterval(t) }, [])
  const [nomeCompleto, setNomeCompleto] = useState('')
  useEffect(() => { try { setNomeCompleto(((JSON.parse(localStorage.getItem('pro_labore_usuario') ?? '{}') as { nome?: string }).nome ?? '').trim()) } catch { /* sem nome */ } }, [])
  const nome = nomeCompleto.split(/\s+/)[0] ?? ''
  const relogio = agora == null ? null : new Date(agora)
  const h = relogio ? Number(relogio.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false })) : 12
  const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  const hoje = agora == null ? null : diaSP(agora)
  const mesNome = relogio ? capital(relogio.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'long' })) : 'Mês'
  const periodo = useMemo(() => (hoje ? { inicio: `${hoje.slice(0, 8)}01`, fim: hoje } : null), [hoje])
  // As quatro leituras da saúde vêm com a tela (mesma régua da Lente); daqui só a meta em vendas (dicionário).
  const vpd = useMetricas(['vendas_por_dia_necessarias'], periodo)
  const m: Leituras = useMemo(() => ({ ...vpd, ...Object.fromEntries((d?.saude ?? []).map(l => [l.chave, l])) }), [vpd, d])

  const [configurando, setConfigurando] = useState(false)
  const [gaveta, setGaveta] = useState<Gaveta>(null)
  const fundo = d?.fundo ? inicioApi.urlImagem(d.fundo) : null
  const fat = d?.indicadores.find(i => i.chave === 'faturamento')

  return (
    <div className={`ia iy${embutida ? ' ia-embutida' : ''}`} data-inicio-aries>
      {fundo ? <><div className="ia-fundo" style={{ backgroundImage: `url(${fundo})` }} data-fundo-proprio /><div className="ia-veu iy-veu" aria-hidden /></> : <Paisagem />}

      {!embutida && <nav className="ia-trilho" aria-label="Módulos do ARIES" data-trilho>
        {MODULOS.map(mo => (
          <Link key={mo.chave} href={mo.href} className={`ia-trilho-item${mo.chave === 'inicio' ? ' ativo' : ''}`} title={mo.nome} aria-label={mo.nome} aria-current={mo.chave === 'inicio' ? 'page' : undefined} data-modulo-trilho={mo.chave}>
            <Ico n={mo.chave} />
          </Link>
        ))}
      </nav>}

      <div className="iy-palco">
        <header className="iy-topo iy-vd">
          <span className="iy-marca"><span className="iy-marca-a" aria-hidden>A</span><span>ARIES</span></span>
          <Busca aoAbrir={href => router.push(href)} />
          <span className="iy-esp" />
          {fat && !fat.semAcesso && fat.valor != null && (
            <Link href="/pro-labore/indicadores" className="iy-topo-num" title="Faturamento do mês (abre os indicadores)" data-topo-faturamento>
              <b>{reais(fat.valor)}</b><small>{d?.escopo === 'PROPRIO' ? 'você faturou' : 'faturado'} em {mesNome.toLowerCase()}</small>
            </Link>
          )}
          {nomeCompleto && <span className="iy-avatar" role="img" aria-label={nomeCompleto} title={nomeCompleto}>{iniciais(nomeCompleto)}</span>}
          {!embutida && tema && <button type="button" className="iy-rb" onClick={() => tema.setTema(tema.tema === 'dark' ? 'light' : 'dark')} title={tema.tema === 'dark' ? 'Usar o tema claro no sistema' : 'Usar o tema escuro no sistema'} aria-label="Trocar o tema"><Ico n={tema.tema === 'dark' ? 'sol' : 'lua'} /></button>}
          {d?.podeConfigurar && <button type="button" className="iy-rb" onClick={() => setConfigurando(true)} title="Configurar a tela inicial" aria-label="Configurar a tela inicial" data-configurar-inicio><Ico n="lapis" /></button>}
        </header>

        {erro && <div className="iy-erro" role="alert">Não deu para carregar a tela agora: {erro}</div>}

        <div className="iy-linha">
          <Saude m={m} faturamento={fat?.semAcesso ? null : fat?.valor ?? null} />

          <section className="iy-centro iy-vd" aria-label="Hoje e o mês">
            <Centro d={d} m={m} mesNome={mesNome} hoje={hoje} agora={agora ?? 0} aoAtualizar={carregar} abrirGaveta={setGaveta} />
          </section>

          <Assistente saud={saud} nome={nome} itens={d?.insights ?? null} aoMudar={carregar} />
        </div>

        <Dock ids={d ? (d.atalhos ?? ATALHOS_PADRAO) : []} podeConfigurar={!!d?.podeConfigurar} abrirGaveta={setGaveta} configurar={() => setConfigurando(true)} />
      </div>

      {gaveta && <Camada>
        <div className="iy-gaveta-fundo" onMouseDown={e => { if (e.target === e.currentTarget) setGaveta(null) }}>
          <aside className="iy-gaveta iy-vd" role="dialog" aria-modal="true" aria-label="Tarefas e notas da loja" data-gaveta={gaveta.aba}>
            <div className="iy-gaveta-topo">
              <div className="iy-abas" role="tablist" aria-label="Tarefas e notas">
                <button type="button" role="tab" aria-selected={gaveta.aba === 'tarefas'} className={`iy-pl${gaveta.aba === 'tarefas' ? ' on' : ''}`} onClick={() => setGaveta({ aba: 'tarefas' })}>Tarefas</button>
                <button type="button" role="tab" aria-selected={gaveta.aba === 'notas'} className={`iy-pl${gaveta.aba === 'notas' ? ' on' : ''}`} onClick={() => setGaveta({ aba: 'notas' })}>Notas</button>
              </div>
              <button type="button" className="iy-rb" onClick={() => setGaveta(null)} aria-label="Fechar">✕</button>
            </div>
            <EscFecha aoFechar={() => setGaveta(null)} />
            {gaveta.aba === 'tarefas'
              ? <Tarefas lista={d?.tarefas ?? null} aoMudar={carregar} comecarNova={!!gaveta.nova} />
              : <Notas lista={d?.notas ?? null} aoMudar={carregar} />}
          </aside>
        </div>
      </Camada>}

      {configurando && d && <Camada><ConfigurarInicio d={d} aoFechar={() => setConfigurando(false)} aoSalvar={carregar} /></Camada>}
    </div>
  )
}

// Gaveta e janela abrem por cima de tudo (inclusive da barra do topo do sistema), com as cores do Início.
function Camada({ children }: { children: ReactNode }) {
  return createPortal(<div className="ia iy iy-camada">{children}</div>, document.body)
}

function EscFecha({ aoFechar }: { aoFechar: () => void }) {
  const ref = useRef(aoFechar)
  useEffect(() => { ref.current = aoFechar }, [aoFechar])
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') ref.current() }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f) }, [])
  return null
}

// ---------- Fundo padrão: céu escuro, lua e montanhas em cinza ----------
function Paisagem() {
  return (
    <div className="ia-fundo iy-paisagem" aria-hidden>
      <span className="iy-lua" />
      <svg viewBox="0 0 1440 420" preserveAspectRatio="none">
        <path d="M0 250 L130 185 L230 225 L350 140 L470 215 L590 165 L720 235 L840 150 L960 205 L1080 135 L1200 195 L1320 160 L1440 210 L1440 420 L0 420 Z" className="iy-serra-1" />
        <path d="M0 315 L160 255 L270 295 L410 235 L530 295 L670 250 L790 305 L910 258 L1050 300 L1190 245 L1330 295 L1440 265 L1440 420 L0 420 Z" className="iy-serra-2" />
        <path d="M0 375 L210 335 L390 368 L570 332 L770 372 L970 336 L1170 368 L1350 340 L1440 356 L1440 420 L0 420 Z" className="iy-serra-3" />
      </svg>
    </div>
  )
}

// ---------- Busca global ----------
function Busca({ aoAbrir }: { aoAbrir: (href: string) => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<ResultadoBusca[] | null>(null)
  const [i, setI] = useState(0)
  const [aberta, setAberta] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); ref.current?.focus() } }
    window.addEventListener('keydown', f, true); return () => window.removeEventListener('keydown', f, true)
  }, [])
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return }
    const t = setTimeout(() => { inicioApi.buscar(q.trim()).then(r => { setRes(r); setI(0) }).catch(() => setRes([])) }, 250)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div className="ia-busca iy-busca" data-busca-global>
      <Ico n="busca" />
      <input ref={ref} value={q} onChange={e => { setQ(e.target.value); setAberta(true) }} onFocus={() => setAberta(true)} onBlur={() => setTimeout(() => setAberta(false), 150)}
        onKeyDown={e => { if (!res?.length) return; if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(res.length - 1, x + 1)) } else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(0, x - 1)) } else if (e.key === 'Enter') aoAbrir(res[i].href) }}
        placeholder="Buscar clientes, leads, motos, vendas…" aria-label="Busca global: clientes, leads, motos, vendas e campanhas" role="combobox" aria-expanded={aberta && !!res} aria-controls="ia-busca-lista" />
      <kbd>Ctrl K</kbd>
      {aberta && res && (
        <ul className="ia-busca-lista" id="ia-busca-lista" role="listbox" data-resultados>
          {res.length === 0 && <li className="ia-busca-vazio">Nada encontrado para “{q.trim()}”.</li>}
          {res.map((r, k) => (
            <li key={r.id} role="option" aria-selected={k === i}>
              <button type="button" className={k === i ? 'ativo' : ''} onMouseDown={e => { e.preventDefault(); aoAbrir(r.href) }} data-resultado={r.origem}>
                <span className="ia-busca-origem">{r.origem}</span>
                <span className="ia-busca-titulo">{r.titulo}</span>
                {r.detalhe && <span className="ia-busca-det">{r.detalhe}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- Saúde da loja: quatro medidores com as faixas do dicionário ----------
type Leituras = Record<string, Pick<LeituraMetrica, 'valor' | 'faixa'> & { padrao?: number | null; detalhe?: unknown }>
type Meta = { meta?: number; metaVendas?: number; vendas?: number | null; diasRestantes?: number; motivo?: string }
const metaDe = (m: Leituras) => (m.vendas_por_dia_necessarias?.detalhe ?? {}) as Meta
function Saude({ m, faturamento }: { m: Leituras; faturamento: number | null }) {
  const p = useContext(ParaHojeContext)
  const meta = metaDe(m)
  const vendas = m.vendas?.valor ?? null
  const conv = m.conversao_lead_venda
  const atrasadas = m.atividades_atrasadas?.valor ?? (p ? p.followsAtrasados + p.ligacoesAtrasadas : null)
  const emDia = p ? p.followsHoje + p.ligacoesHoje : null
  const totalDia = emDia != null && atrasadas != null ? emDia + atrasadas : null
  const pctFat = faturamento != null && meta.meta ? faturamento / meta.meta : null
  const itens: Array<{ chave: string; nome: string; faixa: Faixa | undefined; valor: string; pct: number | null; href: string }> = [
    // Faixa da previsão de fechamento (só gestão vê); sem ela, o medidor mostra o quanto já foi da meta, sem cor.
    { chave: 'meta', nome: 'Meta de faturamento', faixa: m.previsao_fechamento?.faixa, valor: pctFat == null ? (faturamento == null ? '—' : 'sem meta') : `${Math.round(pctFat * 100)}% da meta`, pct: pctFat, href: '/pro-labore/indicadores' },
    { chave: 'vendas', nome: 'Ritmo de vendas', faixa: m.vendas?.faixa, valor: vendas == null ? '—' : meta.metaVendas ? `${n(vendas)} de ${n(Math.ceil(meta.metaVendas))}` : `${n(vendas)} vendas`, pct: vendas != null && meta.metaVendas ? vendas / meta.metaVendas : null, href: '/pro-labore/vendas' },
    { chave: 'conversao', nome: 'Conversão comercial', faixa: conv?.faixa, valor: conv?.valor == null ? '—' : compacto(conv.valor, 'PCT'), pct: conv?.valor != null && conv.padrao ? conv.valor / conv.padrao : null, href: '/pro-labore/indicadores' },
    { chave: 'atendimento', nome: 'Atendimento em dia', faixa: m.atividades_atrasadas?.faixa, valor: atrasadas == null ? '—' : atrasadas ? `${n(atrasadas)} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'}` : 'nada atrasado', pct: totalDia == null ? null : totalDia === 0 ? 1 : (emDia ?? 0) / totalDia, href: '/pro-labore/atividades' },
  ]
  return (
    <section className="iy-saude iy-vd" aria-label="Saúde da loja" data-saude>
      {itens.map(it => {
        const e = estadoDe(it.faixa)
        const dash = it.pct == null ? 0 : Math.max(1, Math.min(1, it.pct) * 75)
        return (
          <Link key={it.chave} href={it.href} className={`iy-in iy-medidor ${e.tom}`} data-medidor={it.chave} title={`${it.nome}: ${e.palavra}${it.valor !== '—' ? ` · ${it.valor}` : ''}`}>
            <span className="iy-anel">
              <svg viewBox="0 0 120 120" aria-hidden>
                <circle cx="60" cy="60" r="48" pathLength={100} strokeDasharray="75 100" className="iy-anel-trilho" />
                {dash > 0 && <circle cx="60" cy="60" r="48" pathLength={100} strokeDasharray={`${dash.toFixed(1)} 100`} className="iy-anel-valor" />}
              </svg>
              {/* Sem faixa no dicionário (sem histórico ou sem acesso), o número vem em primeiro lugar, sem cor. */}
              <span className="iy-anel-txt">{e.tom ? <><b>{e.palavra}</b><small>{it.valor}</small></> : <><b>{it.valor}</b><small>sem faixa</small></>}</span>
            </span>
            <span className="iy-medidor-nome">{it.nome}</span>
          </Link>
        )
      })}
    </section>
  )
}

// ---------- Centro: hoje/mês, destaques/metas e fila/atividade ----------
const NOME_IND: Record<string, string> = { faturamento: 'faturamento', vendas: 'motos vendidas', leads_novos: 'leads', conversao_lead_venda: 'conversão', gasto_anuncio: 'em tráfego' }
// Subir é bom em tudo, menos no investimento (gastar mais não é bom nem ruim por si): fica neutro.
const tomVariacao = (chave: string, v: number) => (chave === 'gasto_anuncio' || v === 0 ? '' : v > 0 ? 'ok' : 'crit')
const Variacao = ({ chave, v }: { chave: string; v: number | null }) => (v == null ? null : <i className={`iy-var ${tomVariacao(chave, v)}`}>{v > 0 ? '▲' : v < 0 ? '▼' : '='} {Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</i>)

function Abas<T extends string>({ rotulo, valor, opcoes, mudar }: { rotulo: string; valor: T; opcoes: Array<[T, string]>; mudar: (v: T) => void }) {
  return (
    <div className="iy-abas" role="tablist" aria-label={rotulo}>
      {opcoes.map(([v, r]) => <button key={v} type="button" role="tab" aria-selected={valor === v} className={`iy-pl${valor === v ? ' on' : ''}`} onClick={() => mudar(v)} data-aba-inicio={v}>{r}</button>)}
    </div>
  )
}

function Centro({ d, m, mesNome, hoje, agora, aoAtualizar, abrirGaveta }: { d: InicioDados | null; m: Leituras; mesNome: string; hoje: string | null; agora: number; aoAtualizar: () => void; abrirGaveta: (g: Gaveta) => void }) {
  const [periodo, setPeriodo] = useState<'hoje' | 'mes'>('hoje')
  const [visao, setVisao] = useState<'destaques' | 'metas'>('destaques')
  const [lista, setLista] = useState<'fila' | 'atividade'>('fila')
  return (
    <>
      <div className="iy-cab">
        <Abas rotulo="Período" valor={periodo} mudar={setPeriodo} opcoes={[['hoje', 'Hoje'], ['mes', mesNome]]} />
        <button type="button" className="iy-rb" onClick={() => abrirGaveta({ aba: 'tarefas', nova: true })} aria-label="Nova tarefa" title="Nova tarefa" data-nova-tarefa-topo><Ico n="mais" /></button>
      </div>
      {periodo === 'hoje' ? <Agora tarefas={d?.tarefas ?? null} abrirTarefas={() => abrirGaveta({ aba: 'tarefas' })} /> : <Mes d={d} />}

      <Abas rotulo="Visão do mês" valor={visao} mudar={setVisao} opcoes={[['destaques', 'Destaques'], ['metas', 'Metas']]} />
      {visao === 'destaques' ? <Destaques d={d} m={m} hoje={hoje} /> : <Metas d={d} m={m} />}

      <div className="iy-cab">
        <Abas rotulo="Lista" valor={lista} mudar={setLista} opcoes={[['fila', 'Fila de hoje'], ['atividade', 'Atividade recente']]} />
        {lista === 'fila'
          ? <Link href="/pro-labore/atividades" className="iy-rb" aria-label="Ver a fila inteira" title="Ver a fila inteira"><Traco n="direita" t={15} /></Link>
          : <button type="button" className="iy-rb" onClick={aoAtualizar} aria-label="Atualizar" title="Atualizar"><Ico n="relogio" /></button>}
      </div>
      {lista === 'fila' ? <Fila hoje={hoje} /> : <Atividade itens={d?.atividade ?? null} agora={agora} />}
    </>
  )
}

// Os mesmos números do aviso "Para hoje" do menu lateral (vêm do layout, sem chamada nova) e as tarefas da loja.
function Agora({ tarefas, abrirTarefas }: { tarefas: TarefaInicio[] | null; abrirTarefas: () => void }) {
  const p = useContext(ParaHojeContext)
  const abertas = tarefas?.filter(t => !t.feita).length ?? null
  const atrasados = p ? p.followsAtrasados + p.ligacoesAtrasadas : null
  return (
    <div className="iy-grade4" data-para-hoje>
      <Link href="/pro-labore/atividades" className={`iy-in iy-cartao${atrasados ? ' crit' : ''}`} data-para-hoje-atrasados>
        <span className="iy-cartao-ico"><Traco n="alerta" /></span>
        <span className="iy-cartao-txt"><b>{n(atrasados)}</b><span>atrasados</span><small>{atrasados ? 'follows e ligações' : p ? 'nada atrasado' : 'carregando…'}</small></span>
      </Link>
      <Link href="/pro-labore/atividades" className="iy-in iy-cartao" data-agora-follows>
        <span className="iy-cartao-ico"><Traco n="conversa" /></span>
        <span className="iy-cartao-txt"><b>{n(p?.followsHoje)}</b><span>follows hoje</span><small>{p ? `${n(p.followsAtrasados)} em atraso` : ''}</small></span>
      </Link>
      <Link href="/pro-labore/ligacoes" className="iy-in iy-cartao" data-agora-ligacoes>
        <span className="iy-cartao-ico"><Traco n="telefone" /></span>
        <span className="iy-cartao-txt"><b>{n(p?.ligacoesHoje)}</b><span>ligações hoje</span><small>{p ? `${n(p.ligacoesAtrasadas)} em atraso` : ''}</small></span>
      </Link>
      <button type="button" className="iy-in iy-cartao" onClick={abrirTarefas} data-agora-tarefas>
        <span className="iy-cartao-ico"><Traco n="tarefa" /></span>
        <span className="iy-cartao-txt"><b>{n(abertas)}</b><span>tarefas abertas</span><small>{tarefas ? `${tarefas.length - (abertas ?? 0)} concluídas` : ''}</small></span>
      </button>
    </div>
  )
}

// O mês em quatro números (os indicadores do Início, pelo alcance de quem vê).
function Mes({ d }: { d: InicioDados | null }) {
  const ICONE: Record<string, ReactNode> = { faturamento: <Ico n="dinheiro" />, vendas: <Ico n="moto" />, leads_novos: <Ico n="lead" />, gasto_anuncio: <Ico n="campanha" /> }
  const ROTULO: Record<string, string> = { faturamento: 'faturamento do mês', vendas: 'motos vendidas', leads_novos: 'leads recebidos', gasto_anuncio: 'investido em tráfego' }
  const lista = ['faturamento', 'vendas', 'leads_novos', 'gasto_anuncio'].map(chave => d?.indicadores.find(i => i.chave === chave) ?? { chave, valor: null, variacao: null, unidade: null, semAcesso: false })
  return (
    <div className="iy-grade4" data-mes>
      {lista.map(i => (
        <Link key={i.chave} href="/pro-labore/indicadores" className="iy-in iy-cartao" data-indicador={i.chave}>
          <span className="iy-cartao-ico">{ICONE[i.chave]}</span>
          <span className="iy-cartao-txt"><b>{i.semAcesso || i.valor == null ? '—' : compacto(i.valor, i.unidade)}</b><span>{ROTULO[i.chave]}</span>
            <small>{i.semAcesso ? 'fora do seu acesso' : i.valor == null ? (d ? 'sem dados ainda' : 'carregando…') : i.variacao == null ? 'sem comparação ainda' : <><Variacao chave={i.chave} v={i.variacao} /> vs. mês anterior</>}</small>
          </span>
        </Link>
      ))}
    </div>
  )
}

function Destaques({ d, m, hoje }: { d: InicioDados | null; m: Leituras; hoje: string | null }) {
  const ind = (chave: string) => d?.indicadores.find(i => i.chave === chave)
  const destaques = ['vendas', 'leads_novos', 'conversao_lead_venda', 'gasto_anuncio'].map(chave => ind(chave) ?? { chave, valor: null, variacao: null, unidade: null, semAcesso: false })
  const fat = ind('faturamento')
  const meta = metaDe(m)
  const veFat = !!fat && !fat.semAcesso && fat.valor != null
  const pct = veFat && meta.meta ? fat!.valor! / meta.meta : null
  // Fração do mês que já passou (até hoje, inclusive), para a linha do ritmo.
  const [a, me, di] = (hoje ?? '2000-01-01').split('-').map(Number)
  const diasMes = new Date(Date.UTC(a, me, 0)).getUTCDate()
  const passou = di / diasMes
  const leads = d?.leadsPorDia ?? null
  const totalLeads = ind('leads_novos')?.valor ?? null
  const maior = leads?.length ? Math.max(1, ...leads) : 1
  return (
    <div className="iy-dest" data-destaques>
      <div className="iy-in iy-dest-mes">
        <h3>Destaques do mês</h3>
        <div className="iy-dest-grade">
          {destaques.map(i => (
            <div key={i.chave} data-destaque={i.chave}>
              <b>{i.semAcesso || i.valor == null ? '—' : compacto(i.valor, i.unidade)}</b>
              <span>{NOME_IND[i.chave]} {i.semAcesso ? <i className="iy-var">fora do seu acesso</i> : <Variacao chave={i.chave} v={i.variacao} />}</span>
            </div>
          ))}
        </div>
      </div>
      <Link href="/pro-labore/indicadores" className="iy-in iy-dest-fat" data-destaque-faturamento>
        <h3>Faturamento</h3>
        {!fat ? <span className="iy-sub">carregando…</span> : fat.semAcesso ? <span className="iy-sub">Fora do seu acesso</span> : (
          <>
            <span className="iy-sub1">{pct == null ? (fat.valor == null ? 'sem dados ainda' : compacto(fat.valor, 'BRL')) : `${Math.round(pct * 100)}% da meta`}</span>
            <span className="iy-sub">{pct == null ? (meta.meta ? '' : 'meta do mês não definida') : meta.meta! > fat.valor! ? `faltam ${compacto(meta.meta! - fat.valor!, 'BRL')}` : 'meta batida'}</span>
            {pct != null && (
              <svg viewBox="0 0 220 70" className="iy-ritmo" role="img" aria-label={`Ritmo: ${Math.round(pct * 100)}% da meta com ${Math.round(passou * 100)}% do mês passado`}>
                <path d="M0 64 L220 6" className="iy-ritmo-meta" />
                <path d={`M0 64 L${(220 * passou).toFixed(1)} ${(64 - 58 * Math.min(1.05, pct)).toFixed(1)}`} className="iy-ritmo-real" />
                <circle cx={(220 * passou).toFixed(1)} cy={(64 - 58 * Math.min(1.05, pct)).toFixed(1)} r="4.5" className="iy-ritmo-ponto" />
              </svg>
            )}
          </>
        )}
        <span className="iy-mais">Ver o mês ›</span>
      </Link>
      <Link href="/pro-labore/leads" className="iy-in iy-dest-leads" data-destaque-leads>
        <h3>Leads por dia</h3>
        <span className="iy-sub1">{totalLeads == null ? '—' : `${n(totalLeads)} no mês`}</span>
        <span className="iy-sub">{totalLeads != null && leads?.length ? `${(totalLeads / leads.length).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por dia, em média` : ''}</span>
        <span className="iy-barras" aria-hidden>
          {(leads ?? []).map((v, k) => <span key={k} className={k === (leads?.length ?? 0) - 1 ? 'hoje' : ''} style={{ height: `${Math.max(4, (v / maior) * 100)}%` }} title={`${v}`} />)}
        </span>
        <span className="iy-mais">Abrir o CRM ›</span>
      </Link>
    </div>
  )
}

// Metas do mês (mesma régua do dicionário: meta ÷ ticket médio dos últimos 90 dias).
function Metas({ d, m }: { d: InicioDados | null; m: Leituras }) {
  const meta = metaDe(m)
  const fat = d?.indicadores.find(i => i.chave === 'faturamento')
  const veFat = !!fat && !fat.semAcesso
  const prev = m.previsao_fechamento
  const vpd = m.vendas_por_dia_necessarias
  const barra = (atual: number | null | undefined, alvo: number | null | undefined) => (atual == null || !alvo ? null : Math.min(100, (atual / alvo) * 100))
  const linhas: Array<{ chave: string; nome: string; valor: string; det: string; pct: number | null; tom?: string }> = []
  if (veFat) linhas.push({ chave: 'faturamento', nome: 'Faturamento', valor: fat!.valor == null ? '—' : compacto(fat!.valor, 'BRL'), det: meta.meta ? `meta ${compacto(meta.meta, 'BRL')}` : 'meta do mês não definida', pct: barra(fat!.valor, meta.meta) })
  linhas.push({ chave: 'vendas', nome: 'Motos vendidas', valor: n(meta.vendas ?? m.vendas?.valor ?? null), det: meta.metaVendas ? `precisa de ${n(Math.ceil(meta.metaVendas))} no mês` : meta.motivo ?? 'sem meta de vendas', pct: barra(meta.vendas ?? m.vendas?.valor, meta.metaVendas) })
  if (vpd?.valor != null) linhas.push({ chave: 'por-dia', nome: 'Vendas por dia para a meta', valor: vpd.valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), det: meta.diasRestantes != null ? `${meta.diasRestantes} ${meta.diasRestantes === 1 ? 'dia restante' : 'dias restantes'}, contando hoje` : '', pct: null, tom: estadoDe(vpd.faixa).tom })
  if (prev?.valor != null && veFat) linhas.push({ chave: 'previsao', nome: 'Previsão de fechamento', valor: compacto(prev.valor, 'BRL'), det: 'realizado + projeção do ritmo e do funil', pct: barra(prev.valor, meta.meta), tom: estadoDe(prev.faixa).tom })
  return (
    <div className="iy-in iy-metas" data-metas>
      {!d && !Object.keys(m).length ? <p className="ia-vazio">Carregando…</p> : linhas.map(l => (
        <div key={l.chave} className={`iy-meta ${l.tom ?? ''}`} data-meta={l.chave}>
          <span className="iy-meta-nome">{l.nome}</span>
          <b>{l.valor}</b>
          <small>{l.det}</small>
          {l.pct != null && <span className="iy-meta-barra" aria-hidden><span style={{ width: `${l.pct}%` }} /></span>}
        </div>
      ))}
      <Link href="/pro-labore/configuracoes" className="iy-mais">A meta do mês fica em Configurações ›</Link>
    </div>
  )
}

// Fila do dia: atividades atrasadas primeiro, depois as de hoje (mesma lista da tela Atividades).
function Fila({ hoje }: { hoje: string | null }) {
  const [itens, setItens] = useState<AtividadeLista[] | null>(null)
  const [falhou, setFalhou] = useState(false)
  useEffect(() => {
    let vivo = true
    telasApi.atividades().then(r => { if (vivo) setItens([...r.atrasadas, ...r.hoje]) }).catch(() => { if (vivo) { setItens([]); setFalhou(true) } })
    return () => { vivo = false }
  }, [])
  const atraso = (prazo: string) => {
    const dia = diaSP(new Date(prazo).getTime())
    if (!hoje || dia >= hoje) return { texto: dia === hoje ? `hoje, ${new Date(prazo).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}` : 'hoje', tom: '' }
    const dias = Math.round((Date.parse(hoje) - Date.parse(dia)) / 86_400_000)
    return { texto: `${dias} ${dias === 1 ? 'dia' : 'dias'} de atraso`, tom: 'crit' }
  }
  if (!itens) return <p className="ia-vazio">Carregando…</p>
  if (!itens.length) return <p className="ia-vazio">{falhou ? 'Não deu para carregar a fila agora.' : 'Nada para hoje. A fila do dia aparece aqui.'}</p>
  return (
    <ul className="iy-fila" data-fila-hoje>
      {itens.slice(0, 6).map(a => {
        const titulo = a.cliente ?? a.oQueFazer ?? a.tipo
        const det = a.cliente ? a.oQueFazer ?? a.tipo : a.responsavel ?? a.tipo
        const at = atraso(a.prazo)
        const href = a.ondeConcluir ?? (a.leadId ? `/pro-labore/leads?lead=${a.leadId}` : '/pro-labore/atividades')
        return (
          <li key={a.id}>
            <Link href={href} className="iy-fila-item" data-fila={a.codigo ?? a.id}>
              <span className="iy-ini" aria-hidden>{iniciais(titulo)}</span>
              <span className="iy-fila-txt"><b>{titulo}</b><small>{det}{a.cliente && a.responsavel ? ` · ${a.responsavel}` : ''}</small></span>
              <span className={`iy-fila-prazo ${at.tom}`}>{at.texto}</span>
              <span className="iy-rb iy-rb-p" aria-hidden><Traco n="direita" t={12} /></span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function Atividade({ itens, agora }: { itens: InicioDados['atividade'] | null; agora: number }) {
  if (!itens) return <p className="ia-vazio">Carregando…</p>
  if (!itens.length) return <p className="ia-vazio">Nada nos últimos 30 dias.</p>
  return (
    <ul className="iy-fila" data-cartao-atividade>
      {itens.slice(0, 6).map(a => (
        <li key={a.id}><Link href={a.href} className="iy-fila-item" data-atividade={a.modulo}>
          <span className="iy-ini" aria-hidden><Ico n={ICONE_MODULO[a.modulo] ?? 'brilho'} /></span>
          <span className="iy-fila-txt"><b>{a.texto}</b><small>{a.modulo}</small></span>
          <span className="iy-fila-prazo">{haQuanto(a.em, agora)}</span>
        </Link></li>
      ))}
    </ul>
  )
}

// ---------- ARIES: o que revisar hoje (Lente do Início) ----------
const FORCA: Record<string, string> = { HIPOTESE: 'hipótese', COMPROVADA: 'comprovado', PADRAO: 'padrão observado' }
const SELO: Record<string, { rotulo: string; tom: string }> = { RISCO: { rotulo: 'Crítico', tom: 'crit' }, REC: { rotulo: 'Recomendação', tom: 'info' }, PAUTA: { rotulo: 'Pauta', tom: 'info' } }
function Assistente({ saud, nome, itens, aoMudar }: { saud: string; nome: string; itens: InicioDados['insights'] | null; aoMudar: () => void }) {
  const router = useRouter()
  const avisar = useAvisar()
  const perguntar = usePerguntar()
  const [pergunta, setPergunta] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  async function aceitar(id: string) {
    setOcupado(id)
    try { await recApi.aceitar(id); avisar('Aceita: as atividades foram criadas.', 'ok'); aoMudar() } catch (e) { avisar(e instanceof Error ? e.message : 'Não foi possível aceitar', 'erro') } finally { setOcupado(null) }
  }
  async function descartar(id: string, titulo: string) {
    const motivo = await perguntar({ titulo: 'Descartar a recomendação?', texto: titulo, acao: 'Descartar', perigo: true, campo: { rotulo: 'Motivo (fica registrado)', minimo: 3 } })
    if (!motivo?.trim()) return
    setOcupado(id)
    try { await recApi.descartar(id, motivo.trim()); avisar('Descartada com motivo.', 'ok'); aoMudar() } catch (e) { avisar(e instanceof Error ? e.message : 'Não foi possível descartar', 'erro') } finally { setOcupado(null) }
  }
  function enviar() { const q = pergunta.trim(); router.push(q ? `/pro-labore/pergunte?q=${encodeURIComponent(q)}` : '/pro-labore/pergunte') }
  return (
    <aside className="iy-assist iy-vd" aria-label="ARIES: pontos para revisar hoje" data-cartao-insights>
      <div className="iy-assist-topo">
        <span className="iy-orbe" aria-hidden />
        <span className="iy-assist-acoes">
          <Link href="/pro-labore/pergunte" className="iy-rb" aria-label="Conversas com o ARIES" title="Conversas com o ARIES"><Traco n="conversa" t={14} /></Link>
          <Link href="/pro-labore/recomendacoes" className="iy-rb" aria-label="Abrir as recomendações" title="Abrir as recomendações"><Traco n="diagonal" t={14} /></Link>
        </span>
      </div>
      <div>
        <h2 className="iy-assist-ola" data-saudacao>{saud}{nome ? `, ${capital(nome.toLowerCase())}` : ''}!</h2>
        <p className="iy-assist-sub">{itens && !itens.length ? 'Nada fora do normal agora. Quando o ARIES encontrar um gargalo ou uma oportunidade, aparece aqui.' : 'Estes são os pontos mais importantes para você revisar hoje.'}</p>
      </div>
      <ul className="iy-pontos">
        {!itens && <li className="ia-vazio">Carregando…</li>}
        {itens?.slice(0, 4).map((it, k) => {
          const selo = SELO[it.tipo] ?? { rotulo: 'Atenção', tom: 'warn' }
          const decide = it.tipo === 'REC' && !!it.id && (it.podeAceitar || it.podeDescartar)
          const destaque = it.tipo === 'RISCO' || decide || k === 0
          if (!destaque) return (
            <li key={k} className={`iy-in iy-ponto-linha ${selo.tom}`}>
              <span className="iy-ponto" aria-hidden />
              <span className="iy-ponto-txt">{it.titulo}</span>
              {it.href && <Link href={it.href} className="iy-rb iy-rb-p" aria-label={`Abrir: ${it.titulo}`}><Traco n="direita" t={12} /></Link>}
            </li>
          )
          return (
            <li key={k} className={`iy-in iy-ponto-cartao ${selo.tom}`} data-selo-critico={it.tipo === 'RISCO' ? '' : undefined}>
              <span className="iy-selo"><span className="iy-ponto" aria-hidden />{selo.rotulo}{it.forca && FORCA[it.forca] ? ` · ${FORCA[it.forca]}` : ''}</span>
              <p><b>{it.titulo}</b>{it.texto ? <> — {it.texto}</> : null}</p>
              {decide ? (
                <div className="iy-decide">
                  {it.podeAceitar && <button type="button" className="iy-bt-claro" disabled={ocupado === it.id} onClick={() => void aceitar(it.id!)} data-inicio-aceitar>Aceitar</button>}
                  {it.podeDescartar && <button type="button" className="iy-bt-contorno" disabled={ocupado === it.id} onClick={() => void descartar(it.id!, it.titulo)} data-inicio-descartar>Descartar</button>}
                </div>
              ) : it.href ? <Link href={it.href} className="iy-bt-contorno iy-bt-p">{it.tipo === 'RISCO' ? 'Ver a análise' : 'Abrir'}</Link> : null}
            </li>
          )
        })}
      </ul>
      <form className="iy-pergunte" onSubmit={e => { e.preventDefault(); enviar() }} data-pergunte-inicio>
        <input value={pergunta} onChange={e => setPergunta(e.target.value)} placeholder="Pergunte ao ARIES…" aria-label="Pergunte ao ARIES" maxLength={500} />
        <button type="submit" aria-label="Perguntar"><Traco n="enviar" t={13} /></button>
      </form>
    </aside>
  )
}

// ---------- Barra de atalhos (embaixo) ----------
function Dock({ ids, podeConfigurar, abrirGaveta, configurar }: { ids: string[]; podeConfigurar: boolean; abrirGaveta: (g: Gaveta) => void; configurar: () => void }) {
  const lista = ids.filter(id => ATALHOS[id]).slice(0, 7)
  return (
    <nav className="iy-dock iy-vd" aria-label="Acesso rápido" data-cartao-atalhos>
      {lista.map(id => (
        <Link key={id} href={ATALHOS[id].href} className="iy-dock-item" title={ATALHOS[id].nome} aria-label={ATALHOS[id].nome} data-atalho={id}><Ico n={ATALHOS[id].icone} /></Link>
      ))}
      <span className="iy-dock-sep" aria-hidden />
      <button type="button" className="iy-dock-item" title="Tarefas da loja" aria-label="Tarefas da loja" onClick={() => abrirGaveta({ aba: 'tarefas' })} data-dock-tarefas><Traco n="tarefa" t={18} /></button>
      <button type="button" className="iy-dock-item" title="Notas da loja" aria-label="Notas da loja" onClick={() => abrirGaveta({ aba: 'notas' })} data-dock-notas><Ico n="nota" /></button>
      {podeConfigurar && lista.length < 7 && <><span className="iy-dock-sep" aria-hidden /><button type="button" className="iy-dock-item" title="Adicionar atalho" aria-label="Adicionar atalho" onClick={configurar} data-atalho-adicionar><Ico n="mais" /></button></>}
    </nav>
  )
}

// ---------- Tarefas (compartilhadas) ----------
function Tarefas({ lista, aoMudar, comecarNova }: { lista: TarefaInicio[] | null; aoMudar: () => void; comecarNova: boolean }) {
  const [novo, setNovo] = useState<string | null>(comecarNova ? '' : null)
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const feitas = lista?.filter(t => t.feita).length ?? 0
  const total = lista?.length ?? 0
  const fazer = async (p: Promise<unknown>) => { setMsg(null); try { await p; aoMudar() } catch (e) { setMsg(e instanceof Error ? e.message : 'Não deu certo') } }
  return (
    <section className="ia-cartao ia-tarefas iy-secao" id="ix-tarefas" aria-label="Tarefas da loja" data-cartao-tarefas>
      <div className="ia-cartao-topo"><h2>Tarefas da loja</h2><button type="button" className="ia-pilula" onClick={() => setNovo('')} data-nova-tarefa><Ico n="mais" /> Nova</button></div>
      <ul className="ia-lista-tarefas">
        {novo != null && (
          <li className="ia-tarefa ia-tarefa-nova">
            <input autoFocus value={novo} maxLength={200} onChange={e => setNovo(e.target.value)} placeholder="O que precisa ser feito?" aria-label="Nova tarefa"
              onKeyDown={e => { if (e.key === 'Enter' && novo.trim()) { void fazer(inicioApi.criarTarefa(novo.trim())); setNovo(null) } else if (e.key === 'Escape') { e.stopPropagation(); setNovo(null) } }}
              onBlur={() => { if (novo.trim()) void fazer(inicioApi.criarTarefa(novo.trim())); setNovo(null) }} data-campo-tarefa />
          </li>
        )}
        {lista?.map(t => (
          <li key={t.id} className={`ia-tarefa${t.feita ? ' feita' : ''}`} data-tarefa={t.id}>
            <button type="button" className="ia-marca" role="checkbox" aria-checked={t.feita} aria-label={t.feita ? 'Marcar como não feita' : 'Marcar como feita'} onClick={() => void fazer(inicioApi.mudarTarefa(t.id, { feita: !t.feita }))} data-marcar-tarefa>{t.feita && <Ico n="check" />}</button>
            {editando?.id === t.id
              ? <input autoFocus value={editando.texto} maxLength={200} onChange={e => setEditando({ id: t.id, texto: e.target.value })} aria-label="Editar tarefa"
                onKeyDown={e => { if (e.key === 'Enter' && editando.texto.trim()) { void fazer(inicioApi.mudarTarefa(t.id, { texto: editando.texto.trim() })); setEditando(null) } else if (e.key === 'Escape') setEditando(null) }}
                onBlur={() => { if (editando.texto.trim() && editando.texto.trim() !== t.texto) void fazer(inicioApi.mudarTarefa(t.id, { texto: editando.texto.trim() })); setEditando(null) }} data-editar-tarefa />
              : <span className="ia-tarefa-texto" onDoubleClick={() => setEditando({ id: t.id, texto: t.texto })} title={`${t.autorNome ? `Criada por ${t.autorNome}. ` : ''}Clique duas vezes para editar`}>{t.texto}</span>}
            <button type="button" className="ia-excluir" aria-label="Excluir tarefa" title="Excluir" onClick={() => void fazer(inicioApi.excluirTarefa(t.id))} data-excluir-tarefa><Ico n="lixo" /></button>
          </li>
        ))}
        {lista && !lista.length && novo == null && <li className="ia-vazio">Nenhuma tarefa. Use “Nova” para criar a primeira; toda a equipe vê a mesma lista.</li>}
      </ul>
      {msg && <p className="ia-msg" role="alert">{msg}</p>}
      <div className="ia-progresso" data-progresso-tarefas>
        <span>{total ? `${feitas} de ${total} concluídas` : 'Sem tarefas'}</span>
        <span className="ia-barra" aria-hidden><span style={{ width: total ? `${(feitas / total) * 100}%` : 0 }} /></span>
      </div>
    </section>
  )
}

// ---------- Notas (compartilhadas, salvam sozinhas) ----------
function Notas({ lista, aoMudar }: { lista: NotaInicio[] | null; aoMudar: () => void }) {
  const [pos, setPos] = useState(0)
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<'salvo' | 'salvando' | 'erro' | null>(null)
  const nota = lista?.[Math.min(pos, Math.max(0, (lista?.length ?? 1) - 1))] ?? null
  const idAtual = nota?.id ?? null
  useEffect(() => { setTexto(nota?.texto ?? '') }, [idAtual]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!nota || texto === nota.texto) return
    setEstado('salvando')
    const t = setTimeout(() => { inicioApi.salvarNota(nota.id, texto).then(() => setEstado('salvo')).catch(() => setEstado('erro')) }, 700)
    return () => clearTimeout(t)
  }, [texto]) // eslint-disable-line react-hooks/exhaustive-deps
  async function nova() { await inicioApi.criarNota(''); setPos(0); aoMudar() }
  async function excluir() { if (!nota) return; await inicioApi.excluirNota(nota.id); setPos(0); aoMudar() }
  return (
    <section className="ia-cartao ia-notas iy-secao" aria-label="Bloco de notas da loja" data-cartao-notas>
      <div className="ia-cartao-topo">
        <h2><Ico n="nota" /> Notas da loja</h2>
        <div className="ia-topo-acoes">
          {lista && lista.length > 1 && <span className="ia-pagina"><button type="button" aria-label="Nota anterior" onClick={() => setPos(p => Math.max(0, p - 1))}><Ico n="esquerda" /></button>{pos + 1}/{lista.length}<button type="button" aria-label="Próxima nota" onClick={() => setPos(p => Math.min(lista.length - 1, p + 1))}><Ico n="seta" /></button></span>}
          {nota && <button type="button" className="ia-icone-btn" aria-label="Excluir nota" title="Excluir nota" onClick={() => void excluir()} data-excluir-nota><Ico n="lixo" /></button>}
          <button type="button" className="ia-icone-btn" aria-label="Nova nota" title="Nova nota" onClick={() => void nova()} data-nova-nota><Ico n="mais" /></button>
        </div>
      </div>
      {nota ? (
        <div className="ia-nota">
          <textarea value={texto} onChange={e => setTexto(e.target.value)} maxLength={4000} aria-label="Texto da nota" placeholder="Escreva aqui. Salva sozinho." data-texto-nota />
          <span className="ia-nota-rodape">{estado === 'salvando' ? 'Salvando…' : estado === 'erro' ? 'Não salvou; tente de novo' : `${nota.autorNome ? `${nota.autorNome} · ` : ''}${new Date(nota.atualizadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}</span>
        </div>
      ) : <p className="ia-vazio">{lista ? 'Nenhuma nota. Use + para escrever; toda a equipe vê o mesmo bloco.' : 'Carregando…'}</p>}
    </section>
  )
}

// ---------- Configurar a tela (fundo e atalhos; iguais para todos) ----------
function ConfigurarInicio({ d, aoFechar, aoSalvar }: { d: InicioDados; aoFechar: () => void; aoSalvar: () => void }) {
  const [atalhos, setAtalhos] = useState<string[]>(d.atalhos ?? ATALHOS_PADRAO)
  const [msg, setMsg] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar() }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f) }, [aoFechar])
  const disponiveis = useMemo(() => Object.keys(ATALHOS).filter(k => !atalhos.includes(k)), [atalhos])
  async function salvar(dados: { fundo?: string | null; atalhos?: string[] }) {
    setMsg(null)
    try { await inicioApi.salvarConfig(dados); aoSalvar(); setMsg('Salvo para toda a loja.') } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível salvar') }
  }
  async function enviarFundo(f: File) {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setMsg('Use uma imagem JPG, PNG ou WEBP.'); return }
    setEnviando(true)
    try { const caminho = await inicioApi.enviarFundo(f); await salvar({ fundo: caminho }) } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível enviar') } finally { setEnviando(false) }
  }
  return (
    <div className="ia-modal" role="dialog" aria-modal="true" aria-label="Configurar a tela inicial" onClick={e => { if (e.target === e.currentTarget) aoFechar() }} data-modal-inicio>
      <div className="ia-modal-painel">
        <div className="ia-cartao-topo"><h2>Configurar a tela inicial</h2><button type="button" className="ia-icone-btn" onClick={aoFechar} aria-label="Fechar">✕</button></div>
        <p className="ia-modal-sub">Vale para toda a equipe.</p>
        <h3>Imagem de fundo</h3>
        <div className="ia-modal-linha">
          <label className="ia-pilula ia-arquivo">{enviando ? 'Enviando…' : 'Trocar a imagem'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const f = e.target.files?.[0]; if (f) void enviarFundo(f) }} data-enviar-fundo /></label>
          {d.fundo && <button type="button" className="ia-pilula" onClick={() => void salvar({ fundo: null })} data-fundo-padrao>Voltar à paisagem padrão</button>}
        </div>
        <h3>Acesso rápido ({atalhos.length} de 7)</h3>
        <ul className="ia-modal-atalhos">
          {atalhos.map(id => <li key={id}><Ico n={ATALHOS[id]?.icone ?? 'brilho'} />{ATALHOS[id]?.nome ?? id}<button type="button" className="ia-icone-btn" aria-label={`Tirar ${ATALHOS[id]?.nome}`} onClick={() => setAtalhos(a => a.filter(x => x !== id))}>✕</button></li>)}
        </ul>
        {atalhos.length < 7 && disponiveis.length > 0 && (
          <div className="ia-modal-linha">{disponiveis.map(id => <button key={id} type="button" className="ia-pilula" onClick={() => setAtalhos(a => [...a, id])} data-adicionar-atalho={id}><Ico n="mais" /> {ATALHOS[id].nome}</button>)}</div>
        )}
        <div className="ia-modal-linha"><button type="button" className="ia-botao" onClick={() => void salvar({ atalhos })} data-salvar-atalhos>Salvar os atalhos</button></div>
        {msg && <p className="ia-msg" role="status">{msg}</p>}
      </div>
    </div>
  )
}
