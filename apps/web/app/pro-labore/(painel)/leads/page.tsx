'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { proLaboreApi, type ErroApi, Lead, EstagioLead, TipoLead, TIPOS_LEAD, TipoNegociacao, TIPOS_NEGOCIACAO, Vendedor, ParametroLiquidez, MetaFunilProLabore, TipoMetaFunilPL, EstagioFunilPL } from '@/lib/proLaboreApi'
import { formatMoeda, formatPct, centavosParaReais } from '@/lib/format'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { FunilFiltro, periodoHoje, periodoSemanaAtual, popularFunilNoPeriodo } from '@/lib/proLaboreFunilFiltro'
import { PageHeader } from '../../PageHeader'
import Link from 'next/link'
import { FollowModal } from '../_follow/FollowModal'
import { PerdaModal } from '../_follow/PerdaModal'
import { situacaoFollow } from '../_follow/follow'
import { FaixaWhatsapp } from './_whatsapp/FaixaWhatsapp'
import { ChipNota } from '../assistente/_componentes/SugestoesConversa'
import { EtiquetasLead, ORDEM_ETIQUETAS, ROTULO_ETIQUETA } from '../assistente/_componentes/jornada'
import { PainelLead } from './_painel/PainelLead'

const COLUNAS: { estagio: EstagioFunilPL; titulo: string }[] = [
  { estagio: 'LEAD', titulo: 'Leads' },
  { estagio: 'ABORDADO', titulo: 'Abordados' },
  { estagio: 'NEGOCIACAO', titulo: 'Negociação (MQL)' },
  { estagio: 'PROPOSTA', titulo: 'Propostas (SQL)' },
  { estagio: 'FECHADO', titulo: 'Fechamentos' },
]

const TIPO_LABEL: Record<TipoLead, string> = { TRAFEGO: 'Tráfego Pago', ORGANICO: 'Orgânico' }
type Densidade = 'compacto' | 'detalhado'
// R$ 15 mil, R$ 1,2 mi — cabe no card e no cabeçalho da coluna.
function moedaCurta(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (v >= 1000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: v >= 100_000 ? 0 : 1 })} mil`
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`
}

// Rótulo fica só na abreviação (P/R) — o significado completo (Pagamento
// integral / Renegociação) aparece só no title (hover), nunca escrito por
// extenso na tela.
const TIPO_NEGOCIACAO_TITLE: Record<TipoNegociacao, string> = { P: 'Pagamento integral', R: 'Renegociação' }

// --pl-accent fica de fora: inverte de claro pra escuro entre os temas, e
// o texto do avatar é branco fixo — os outros 5 tokens formam a "família
// cinza/prata/dourado" da paleta, sempre escuros o bastante pro contraste.
const AVATAR_CORES = ['var(--pl-accent-3)', 'var(--pl-accent-4)', 'var(--pl-accent-5)', 'var(--pl-accent-2)', 'var(--pl-accent-6)']

function iniciais(nome: string) {
  return nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

// Hash simples e estável do id só pra escolher sempre a mesma cor de avatar
// pro mesmo vendedor, sem precisar de um índice de posição numa lista.
function corAvatar(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_CORES[h % AVATAR_CORES.length]
}

const MS_POR_DIA = 24 * 60 * 60 * 1000
// Tempo desde a última mudança (atualizadoEm bate com a última transição de
// estágio na imensa maioria dos casos — editar outros campos também atualiza
// isso, mas é uma aproximação boa o bastante pra um indicador visual, sem
// precisar de um endpoint novo só pra ler o histórico de estágio já salvo.
function diasParado(lead: Lead): number {
  return Math.floor((Date.now() - new Date(lead.atualizadoEm).getTime()) / MS_POR_DIA)
}

function tempoParado(dias: number): string {
  if (dias <= 0) return 'hoje'
  if (dias === 1) return '1d'
  return `${dias}d`
}

const somaDaColuna = (ls: Lead[]) => ls.reduce((t, l) => t + (l.valorNegociacao || 0), 0)

function hojeIso() {
  return new Date().toISOString().slice(0, 10)
}

function rotuloMetaCrm(meta: MetaFunilProLabore | undefined): string {
  if (!meta) return 'Meta: —'
  if (meta.tipoMeta === 'MAXIMO_CUSTO') return `Meta: ${formatMoeda(meta.metaCusto ?? 0)} (máx.)`
  if (meta.tipoMeta === 'MAXIMO_PERDA') return `Meta: ${formatPct(meta.metaPct)} (máx.)`
  return `Meta: ${formatPct(meta.metaPct)} (mín.)`
}

// Campo de valor em R$ no formato centavos: a pessoa digita só números (os 2
// últimos dígitos são sempre os centavos) e o campo formata pro real
// conforme digita — evita o problema de vírgula/ponto decimal de um input
// numérico nativo (o navegador só aceita ponto, mas todo mundo digita vírgula).
function CampoValorCentavos({ valorDigitos, onChange, id }: { valorDigitos: string; onChange: (v: string) => void; id?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const texto = formatMoeda(centavosParaReais(valorDigitos))

  // Sempre reposiciona o cursor no fim — sem isso, ao re-renderizar com o
  // valor formatado (símbolo, milhar, vírgula), o cursor pode "pular" pro
  // meio do texto, quebrando a digitação contínua.
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement === el) el.setSelectionRange(texto.length, texto.length)
  }, [texto])

  return (
    <input
      ref={ref}
      id={id}
      type="text"
      inputMode="numeric"
      className="pl-input"
      value={texto}
      onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
      placeholder="R$ 0,00"
    />
  )
}

// Etapas em ordem de progressão, sem PERDIDO — usada tanto pelo botão
// "Avançar" (sempre uma etapa adiante) quanto pelo menu "Mover para"
// (qualquer etapa, inclusive voltando, sem precisar arrastar).
const ORDEM_COLUNAS: EstagioLead[] = COLUNAS.map(c => c.estagio)
function proximaEtapaSimples(estagio: EstagioLead): EstagioLead | null {
  const idx = ORDEM_COLUNAS.indexOf(estagio)
  if (idx === -1 || idx >= ORDEM_COLUNAS.length - 2) return null
  return ORDEM_COLUNAS[idx + 1]
}

// Código do post do Instagram (#P-0917-XRE, #S-..., #BIO) colado em qualquer
// campo: o servidor liga o lead ao post (seção 3.5 do Social Media).
const REGEX_CODIGO_POST = /#(?:[PS]-\d{4}-[A-Z0-9]{1,6}(?:-\d{1,2})?|BIO)(?![A-Z0-9])/i
function codigoNoFormulario(f: FormLead): string | null {
  for (const v of [f.observacao, f.modeloInteresse, f.nomeCliente, f.telefone, f.email, f.endereco, f.cpf]) {
    const m = v.match(REGEX_CODIGO_POST)
    if (m) return m[0].toUpperCase()
  }
  return null
}

function AvisoCodigoPost({ codigo }: { codigo: string | null }) {
  if (!codigo) return null
  return <div className="pl-alert pl-alert-success" role="status" style={{ marginTop: 14 }}>Código {codigo} reconhecido: ao salvar, o lead fica ligado a esse post do Instagram (orgânico).</div>
}

function correspondeBusca(lead: Lead, termo: string): boolean {
  const alvo = termo.trim().toLowerCase()
  if (!alvo) return true
  return [lead.nomeCliente, lead.telefone, lead.email, lead.modeloInteresse, lead.observacao]
    .some(v => v?.toLowerCase().includes(alvo))
}

type FormLead = {
  nomeCliente: string
  telefone: string
  email: string
  cpf: string
  endereco: string
  modeloInteresse: string
  observacao: string
  vendedorId: string
  tipoLead: TipoLead | ''
  tipoNegociacao: TipoNegociacao | ''
  valorNegociacao: string
}

const FORM_VAZIO: FormLead = { nomeCliente: '', telefone: '', email: '', cpf: '', endereco: '', modeloInteresse: '', observacao: '', vendedorId: '', tipoLead: '', tipoNegociacao: '', valorNegociacao: '' }

const paramDaUrl = (nome: string) => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(nome))

export default function ProLaboreLeadsPage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel === 'DONO'
  const isSupervisor = usuario?.papel === 'SUPERVISOR'
  // Supervisor gerencia o CRM da equipe inteira (ver/criar/editar/reatribuir
  // qualquer lead), mas "Converter"/arrastar pra Fechamentos continua
  // exclusivo do dono — essas ações continuam em `isDono` estrito.
  const vejaEquipe = isDono || isSupervisor
  // Só ver o CRM: o painel mostra as notas, sem o campo de escrever (a API também barra).
  const podeEditarCrm = isDono || (usuario?.acessos?.crm ?? 'EDITAR') === 'EDITAR'

  const [leads, setLeads] = useState<Lead[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [parametro, setParametro] = useState<ParametroLiquidez | null>(null)
  const [metasFunil, setMetasFunil] = useState<MetaFunilProLabore[]>([])
  const [loading, setLoading] = useState(true)

  // Busca + filtros — tudo client-side (a lista de leads já vem inteira pra
  // quem vê a equipe). Ficam mais importantes conforme o CRM acumula leads,
  // que é exatamente onde achar um card "no olho" deixa de dar conta.
  // Canal, vendedor e período moram todos no mesmo popover (FunilFiltro,
  // igual à Jornada de compra do Painel) — sem controles soltos duplicados.
  const [busca, setBusca] = useState('')
  const [filtroCanal, setFiltroCanal] = useState<TipoLead | ''>('')
  const [filtroVendedorId, setFiltroVendedorId] = useState<string | null>(null)
  const [filtroPeriodo, setFiltroPeriodo] = useState<{ inicio: string; fim: string } | null>(null)
  const [filtroCustomInicio, setFiltroCustomInicio] = useState('')
  const [filtroCustomFim, setFiltroCustomFim] = useState('')
  // Follow (botão do card) e perda (o cliente vai para a Reativação).
  const [followAberto, setFollowAberto] = useState<Lead | null>(null)
  const [perdaAberta, setPerdaAberta] = useState<Lead | null>(null)
  const [filtroFollow, setFiltroFollow] = useState<'' | 'ATRASADO' | 'HOJE'>('')
  // Etiqueta da jornada (posta pelo Assistente): filtra só os cards do Kanban.
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('')
  // Custo por lead automático: gasto do mês (Tráfego/Indicadores) ÷ leads do mês.
  const [gastoMes, setGastoMes] = useState<number | null>(null)
  const [mesCorrente] = useState(() => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7))

  function aplicarFiltroPeriodo() {
    if (!filtroCustomInicio || !filtroCustomFim) return
    setFiltroPeriodo({ inicio: filtroCustomInicio, fim: filtroCustomFim })
  }

  function selecionarFiltroPreset(tipo: 'hoje' | 'semana') {
    const p = tipo === 'hoje' ? periodoHoje() : periodoSemanaAtual()
    setFiltroCustomInicio(p.inicio)
    setFiltroCustomFim(p.fim)
    setFiltroPeriodo(p)
  }

  function limparFiltroPeriodo() {
    setFiltroPeriodo(null)
    setFiltroCustomInicio('')
    setFiltroCustomFim('')
  }

  // Edição de meta por etapa e de custo/lead — mesma interação do painel
  // (FunilJourney), só que aqui refletindo direto na etapa do CRM.
  const [editandoEtapaMeta, setEditandoEtapaMeta] = useState<EstagioLead | null>(null)
  const [tipoMetaEdicao, setTipoMetaEdicao] = useState<TipoMetaFunilPL>('MINIMO')
  const [valorMetaEdicao, setValorMetaEdicao] = useState('')
  const [salvandoMeta, setSalvandoMeta] = useState(false)

  const [editandoCustoLead, setEditandoCustoLead] = useState(false)
  const [custoLeadValor, setCustoLeadValor] = useState('')
  const [salvandoCustoLead, setSalvandoCustoLead] = useState(false)

  // "Novo lead" virou modal (era um formulário grande sempre aberto no topo,
  // empurrando o quadro pra baixo toda vez) — abre só quando precisa.
  // ?novo=1 e ?lead=ID chegam da paleta de comandos (Ctrl K).
  const [novoLeadAberto, setNovoLeadAberto] = useState(() => paramDaUrl('novo') === '1')
  const [form, setForm] = useState<FormLead>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [convertendoId, setConvertendoId] = useState<string | null>(null)
  const [convertForm, setConvertForm] = useState({ data: hojeIso(), valorVenda: '', valorProLabore: '', valorComissao: '', observacao: '' })
  const [convertErro, setConvertErro] = useState('')
  const [convertSalvando, setConvertSalvando] = useState(false)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormLead>(FORM_VAZIO)
  const [editErro, setEditErro] = useState('')
  const [editSalvando, setEditSalvando] = useState(false)

  // Arrastar os cards usa Pointer Events (não o Drag and Drop nativo do
  // HTML5) — o nativo não funciona em toque/celular e, mesmo no mouse,
  // vinha falhando de forma inconsistente pra algumas vendedoras (o card
  // não se movia e ficava na etapa antiga). dragRef guarda o estado "vivo"
  // da arrastada — os listeners do pointermove/pointerup ficam presos ao
  // fechamento (closure) de quando o pointerdown começou, então não dá pra
  // confiar em state do React ali dentro; só em refs, que são sempre atuais.
  const [draggingId, setDraggingId] = useState<string | null>(null)
  // Painel lateral do lead (clique no card) e a densidade dos cards (fica no navegador).
  const [painelId, setPainelId] = useState<string | null>(() => paramDaUrl('lead'))
  const [densidade, setDensidadeEstado] = useState<Densidade>(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('pl_crm_densidade') === 'detalhado' ? 'detalhado' : 'compacto' } catch { return 'compacto' }
  })
  // Aberto pelo botão "Notas" do card: o painel já leva para o campo da nota.
  const [focoNota, setFocoNota] = useState(false)
  const fecharPainel = useCallback(() => { setPainelId(null); setFocoNota(false) }, [])
  const abrirNotas = (id: string) => { setPainelId(id); setFocoNota(true) }
  const contarNotas = (id: string, n: number) => setLeads(ls => ls.map(l => (l.id === id ? { ...l, _count: { ...l._count, notas: n } } : l)))
  // Os atalhos da paleta (?lead=, ?novo=, ?foraDoCrm=) já foram lidos ao montar:
  // limpa o endereço para recarregar a página não abrir tudo de novo.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!['lead', 'novo', 'foraDoCrm'].some(p => url.searchParams.has(p))) return
    for (const p of ['lead', 'novo', 'foraDoCrm']) url.searchParams.delete(p)
    window.history.replaceState(null, '', url.pathname + url.search)
  }, [])
  // Métricas por etapa (R$, conversão, metas): recolhidas num resumo de uma
  // linha para o quadro aparecer primeiro; a escolha fica no navegador.
  const [metricasAbertas, setMetricasAbertas] = useState(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('pl_crm_metricas') === 'aberto' } catch { return false }
  })
  const alternarMetricas = () => {
    const nova = !metricasAbertas
    setMetricasAbertas(nova)
    try { localStorage.setItem('pl_crm_metricas', nova ? 'aberto' : 'fechado') } catch { /* sem armazenamento */ }
  }
  const setDensidade = (d: Densidade) => { setDensidadeEstado(d); try { localStorage.setItem('pl_crm_densidade', d) } catch { /* sem armazenamento */ } }
  const [dragOverCol, setDragOverCol] = useState<EstagioLead | null>(null)
  const dragRef = useRef<{ lead: Lead; startX: number; startY: number; dragging: boolean; colSobre: EstagioLead | null; abort: AbortController } | null>(null)
  const colRefs = useRef(new Map<EstagioLead, HTMLDivElement>())

  const carregar = useCallback(() => {
    setLoading(true)
    Promise.all([
      proLaboreApi.leads.listar(),
      vejaEquipe ? proLaboreApi.vendedores.listar() : Promise.resolve<Vendedor[]>([]),
      proLaboreApi.parametros.get(),
      proLaboreApi.funilMetas.listar(),
    ])
      .then(([l, v, p, metas]) => { setLeads(l); setVendedores(v.filter(x => x.vende !== false)); setParametro(p); setMetasFunil(metas) })
      .finally(() => setLoading(false))
    if (isDono) {
      const mes = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7)
      proLaboreApi.gastosAnuncios.resumo(Number(mes.slice(0, 4))).then(r => setGastoMes(r.find(g => g.mes === mes)?.valor ?? null)).catch(() => setGastoMes(null))
    }
  }, [vejaEquipe, isDono])

  useEffect(() => { carregar() }, [carregar])

  // Lead do WhatsApp entra sozinho: a lista se atualiza enquanto a aba está
  // aberta (fora de um arrasto, pra não mexer no card que está na mão).
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden || dragRef.current) return
      proLaboreApi.leads.listar().then(setLeads).catch(() => undefined)
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  // Limpa os listeners de arrastar se a página desmontar no meio de um
  // gesto (ex: trocou de rota durante o drag) — lê a gaveta ATUAL (ref),
  // então funciona não importa em qual render o drag começou.
  useEffect(() => () => { dragRef.current?.abort.abort() }, [])

  function abrirNovoLead() {
    setForm(FORM_VAZIO)
    setErro('')
    setNovoLeadAberto(true)
  }

  function fecharNovoLead() {
    setNovoLeadAberto(false)
    setErro('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const valorNegociacao = centavosParaReais(form.valorNegociacao)
    if (valorNegociacao <= 0) {
      setErro('Informe o valor da negociação')
      return
    }
    setSalvando(true)
    const enviar = (forcarDuplicado?: boolean) => proLaboreApi.leads.criar({
      forcarDuplicado,
      nomeCliente: form.nomeCliente,
      telefone: form.telefone || undefined,
      email: form.email || undefined,
      cpf: form.cpf || undefined,
      endereco: form.endereco || undefined,
      modeloInteresse: form.modeloInteresse || undefined,
      observacao: form.observacao || undefined,
      vendedorId: form.vendedorId || undefined,
      tipoLead: form.tipoLead || undefined,
      valorNegociacao,
      })
    try {
      try {
        await enviar()
      } catch (err) {
        // Lead que chamou no WhatsApp já entra sozinho: confirma antes de duplicar.
        if ((err as ErroApi).status !== 409) throw err
        if (!confirm(`${(err as Error).message}\n\nCadastrar outro mesmo assim?`)) return
        await enviar(true)
      }
      setForm(FORM_VAZIO)
      setNovoLeadAberto(false)
      carregar()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar lead')
    } finally {
      setSalvando(false)
    }
  }

  async function mudarEstagio(lead: Lead, estagio: EstagioLead) {
    if (estagio === lead.estagio) return
    await proLaboreApi.leads.mudarEstagio(lead.id, estagio)
    carregar()
  }

  async function desfazerAvanco(lead: Lead) {
    try {
      await proLaboreApi.leads.desfazerAvanco(lead.id)
      carregar()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Não deu para desfazer')
    }
  }

  function marcarPerdido(lead: Lead) {
    setPerdaAberta(lead)
  }

  async function remover(lead: Lead) {
    const aviso = lead.origemCadastro === 'WHATSAPP' ? '\n\nEle entrou sozinho pelo WhatsApp: esse número não será mais cadastrado automaticamente.' : ''
    if (!confirm(`Remover o lead de ${lead.nomeCliente}?${aviso}`)) return
    try {
      await proLaboreApi.leads.remover(lead.id)
      carregar()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao remover lead')
    }
  }

  function abrirEdicao(lead: Lead) {
    setEditandoId(lead.id)
    setEditForm({
      nomeCliente: lead.nomeCliente,
      telefone: lead.telefone ?? '',
      email: lead.email ?? '',
      cpf: lead.cpf ?? '',
      endereco: lead.endereco ?? '',
      modeloInteresse: lead.modeloInteresse ?? '',
      observacao: lead.observacao ?? '',
      vendedorId: lead.vendedorId ?? '',
      tipoLead: lead.tipoLead ?? '',
      tipoNegociacao: lead.tipoNegociacao ?? '',
      valorNegociacao: String(Math.round(lead.valorNegociacao * 100)),
    })
    setEditErro('')
  }

  function fecharEdicao() {
    setEditandoId(null)
    setEditErro('')
  }

  async function salvarEdicao() {
    if (!editandoId) return
    setEditErro('')
    const valorNegociacao = centavosParaReais(editForm.valorNegociacao)
    if (valorNegociacao <= 0) {
      setEditErro('Informe o valor da negociação')
      return
    }
    setEditSalvando(true)
    try {
      await proLaboreApi.leads.editar(editandoId, {
        nomeCliente: editForm.nomeCliente,
        telefone: editForm.telefone || undefined,
        email: editForm.email || undefined,
        cpf: editForm.cpf || undefined,
        endereco: editForm.endereco || undefined,
        modeloInteresse: editForm.modeloInteresse || undefined,
        observacao: editForm.observacao || undefined,
        ...(vejaEquipe ? { vendedorId: editForm.vendedorId || null } : {}),
        tipoLead: editForm.tipoLead || null,
        ...(isDono ? { tipoNegociacao: editForm.tipoNegociacao || null } : {}),
        valorNegociacao,
      })
      fecharEdicao()
      carregar()
    } catch (err: unknown) {
      setEditErro(err instanceof Error ? err.message : 'Erro ao salvar lead')
    } finally {
      setEditSalvando(false)
    }
  }

  function iniciarEdicaoMeta(etapa: EstagioLead) {
    const meta = metasFunil.find(m => m.etapa === etapa)
    setEditandoEtapaMeta(etapa)
    setTipoMetaEdicao(meta?.tipoMeta ?? 'MINIMO')
    setValorMetaEdicao(meta?.tipoMeta === 'MAXIMO_CUSTO' ? String(meta.metaCusto ?? 0) : String(Math.round((meta?.metaPct ?? 0) * 100)))
  }

  async function salvarMeta() {
    if (!editandoEtapaMeta) return
    setSalvandoMeta(true)
    try {
      const etapa = editandoEtapaMeta as EstagioFunilPL
      let atualizado
      if (tipoMetaEdicao === 'MAXIMO_CUSTO') {
        const valor = Number(valorMetaEdicao)
        if (!Number.isFinite(valor) || valor < 0) return
        atualizado = await proLaboreApi.funilMetas.atualizar(etapa, { tipoMeta: tipoMetaEdicao, metaCusto: valor })
      } else {
        const valor = Number(valorMetaEdicao) / 100
        if (!Number.isFinite(valor) || valor < 0 || valor > 1) return
        atualizado = await proLaboreApi.funilMetas.atualizar(etapa, { tipoMeta: tipoMetaEdicao, metaPct: valor })
      }
      setMetasFunil(ms => [...ms.filter(m => m.etapa !== atualizado.etapa), atualizado])
      setEditandoEtapaMeta(null)
    } finally {
      setSalvandoMeta(false)
    }
  }

  function iniciarEdicaoCustoLead() {
    setCustoLeadValor(String(parametro?.custoPorLeadTopo ?? 0))
    setEditandoCustoLead(true)
  }

  async function salvarCustoLead() {
    const valor = Number(custoLeadValor)
    if (!Number.isFinite(valor) || valor < 0) return
    setSalvandoCustoLead(true)
    try {
      const atualizado = await proLaboreApi.parametros.atualizar({ custoPorLeadTopo: valor })
      setParametro(atualizado)
      setEditandoCustoLead(false)
    } finally {
      setSalvandoCustoLead(false)
    }
  }

  // Pró-labore é sempre do dono, sacado de qualquer venda — teto único da
  // conta. Comissão é o que se paga ao vendedor do lead, com teto próprio
  // (se definido) ou o padrão da conta. Conversão é exclusiva do dono.
  const tetoProLabore = parametro?.tetoProLaborePorVenda ?? 900
  function tetoComissao(vendedorId?: string | null): number {
    const vendedor = vendedorId ? vendedores.find(v => v.id === vendedorId) : undefined
    if (vendedor?.tetoComissaoPorVenda != null) return vendedor.tetoComissaoPorVenda
    // Quem loga como VENDEDOR não carrega `vendedores` (só dono/supervisor
    // veem a equipe inteira) — sem isso, o teto individual do próprio
    // vendedor nunca seria encontrado ali em cima e a conta cairia sempre
    // no padrão da conta inteira, mesmo quando o vendedor tem um teto
    // próprio diferente. O login/me já manda o teto individual pra esse caso.
    if (!vejaEquipe && vendedorId && usuario?.tetoComissaoPorVenda != null) return usuario.tetoComissaoPorVenda
    return parametro?.tetoComissaoPadrao ?? 900
  }

  // Negociação "R" (renegociação) usa os tetos reduzidos da conta em vez
  // dos normais — vale mesmo se o vendedor tiver um teto individual, é uma
  // regra da negociação, não do vendedor. Sem classificação (null), trata
  // igual a "P" (tetos normais).
  function tetoProLaboreEfetivo(lead: Lead): number {
    if (lead.tipoNegociacao === 'R') return parametro?.tetoProLaboreRenegociacao ?? 600
    return tetoProLabore
  }
  function tetoComissaoEfetivo(lead: Lead): number {
    if (lead.tipoNegociacao === 'R') return parametro?.tetoComissaoRenegociacao ?? 0
    return lead.vendedorId ? tetoComissao(lead.vendedorId) : 0
  }

  async function definirTipoNegociacao(lead: Lead, tipo: TipoNegociacao) {
    if (!isDono) return
    const tipoNovo = lead.tipoNegociacao === tipo ? null : tipo
    await proLaboreApi.leads.editar(lead.id, { tipoNegociacao: tipoNovo })
    carregar()
  }

  function abrirConversao(lead: Lead) {
    if (!isDono) return
    setConvertendoId(lead.id)
    setConvertForm({ data: hojeIso(), valorVenda: '', valorProLabore: String(tetoProLaboreEfetivo(lead)), valorComissao: lead.vendedorId ? String(tetoComissaoEfetivo(lead)) : '', observacao: '' })
    setConvertErro('')
  }

  function fecharConversao() {
    setConvertendoId(null)
    setConvertErro('')
  }

  function atualizarValorVendaConversao(valor: string) {
    const teto = leadConvertendo ? tetoProLaboreEfetivo(leadConvertendo) : tetoProLabore
    const numero = Number(valor)
    const sugestao = Number.isFinite(numero) && numero > 0 ? Math.min(numero, teto) : teto
    setConvertForm(f => ({ ...f, valorVenda: valor, valorProLabore: String(sugestao) }))
  }

  async function converter() {
    if (!convertendoId) return
    setConvertErro('')
    setConvertSalvando(true)
    try {
      await proLaboreApi.leads.converter(convertendoId, {
        data: convertForm.data,
        valorVenda: Number(convertForm.valorVenda),
        valorProLabore: Number(convertForm.valorProLabore),
        valorComissao: leadConvertendo?.vendedorId && convertForm.valorComissao !== '' ? Number(convertForm.valorComissao) : undefined,
        observacao: convertForm.observacao || undefined,
      })
      fecharConversao()
      carregar()
    } catch (err: unknown) {
      setConvertErro(err instanceof Error ? err.message : 'Erro ao converter lead em venda')
    } finally {
      setConvertSalvando(false)
    }
  }

  function limparDrag() {
    dragRef.current?.abort.abort()
    dragRef.current = null
    setDraggingId(null)
    setDragOverCol(null)
  }

  function colunaNoPonto(x: number, y: number): EstagioLead | null {
    for (const [estagio, el] of colRefs.current) {
      // Fechamentos exige registrar a venda (valor, pró-labore, comissão) —
      // só o dono faz isso, então pro vendedor essa coluna não é um alvo
      // válido: sem isso o card "não movia" ao soltar ali, sem nenhuma
      // pista visual de por quê.
      if (estagio === 'FECHADO' && !isDono) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return estagio
    }
    return null
  }

  function onPointerMoveWin(e: PointerEvent) {
    const st = dragRef.current
    if (!st) return
    const dx = e.clientX - st.startX, dy = e.clientY - st.startY
    if (!st.dragging) {
      // limiar de ~6px antes de virar arrastada — evita que um simples
      // toque/clique (ex: nos botões do card) já dispare o drag
      if (Math.hypot(dx, dy) < 6) return
      st.dragging = true
      setDraggingId(st.lead.id)
    }
    e.preventDefault()
    const colSobre = colunaNoPonto(e.clientX, e.clientY)
    if (st.colSobre !== colSobre) {
      st.colSobre = colSobre
      setDragOverCol(colSobre)
    }
  }

  function onPointerUpWin() {
    const st = dragRef.current
    limparDrag()
    // Toque sem arrastar = abrir o painel do lead.
    if (st && !st.dragging) { setPainelId(st.lead.id); return }
    if (!st?.dragging || !st.colSobre || st.colSobre === st.lead.estagio) return
    if (st.colSobre === 'FECHADO') {
      if (isDono) abrirConversao(st.lead)
    } else {
      mudarEstagio(st.lead, st.colSobre)
    }
  }

  function onPointerCancelWin() {
    limparDrag()
  }

  function onPointerDownCard(e: React.PointerEvent<HTMLDivElement>, lead: Lead) {
    if (lead.vendaId) return
    if ((e.target as HTMLElement).closest('button, a, select, input, .pl-kc-acoes, .pl-filter-wrap')) return
    const abort = new AbortController()
    dragRef.current = { lead, startX: e.clientX, startY: e.clientY, dragging: false, colSobre: null, abort }
    window.addEventListener('pointermove', onPointerMoveWin, { signal: abort.signal })
    window.addEventListener('pointerup', onPointerUpWin, { signal: abort.signal })
    window.addEventListener('pointercancel', onPointerCancelWin, { signal: abort.signal })
  }

  const dentroDoPeriodo = (dataIso: string, periodo: { inicio: string; fim: string }) => {
    const d = new Date(dataIso)
    return d >= new Date(`${periodo.inicio}T00:00:00`) && d <= new Date(`${periodo.fim}T23:59:59.999`)
  }
  const passaFiltrosBase = (l: Lead) =>
    (!filtroCanal || l.tipoLead === filtroCanal) && (!filtroVendedorId || l.vendedorId === filtroVendedorId) && correspondeBusca(l, busca)

  const leadsFiltrados = leads
    .filter(passaFiltrosBase)
    .filter(l => !filtroPeriodo || dentroDoPeriodo(l.criadoEm, filtroPeriodo))
  const leadsAtivos = leadsFiltrados.filter(l => l.estagio !== 'PERDIDO')
  const totalPerdidos = leads.filter(l => l.estagio === 'PERDIDO').length
  // Follows pendentes dos leads em andamento: atrasados e de hoje viram atalhos de filtro.
  const situacaoDe = (l: Lead) => (l.follows?.[0] ? situacaoFollow(l.follows[0]).tipo : null)
  const followsAtrasados = leadsAtivos.filter(l => situacaoDe(l) === 'ATRASADO').length
  const followsHoje = leadsAtivos.filter(l => situacaoDe(l) === 'HOJE').length
  const contagemEtiquetas = ORDEM_ETIQUETAS.map(e => ({ e, n: leadsAtivos.filter(l => l.etiquetas?.includes(e)).length })).filter(x => x.n > 0)
  const painelLead = painelId ? leads.find(l => l.id === painelId) ?? null : null
  const leadsAtivosOrdenados = [...leadsAtivos]
    .filter(l => !filtroFollow || situacaoDe(l) === filtroFollow)
    .filter(l => !filtroEtiqueta || l.etiquetas?.includes(filtroEtiqueta))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))

  // População de cada etapa do funil (pros indicadores de conversão/perda/R$
  // abaixo, NÃO pros cards do Kanban acima) — cada etapa contada pela data
  // em que foi REALMENTE alcançada (dataAlcancouEtapa: quando o lead virou
  // ABORDADO/NEGOCIACAO/PROPOSTA/FECHADO de verdade), não por `criadoEm`
  // uniforme. Sem isso, um lead criado antes do período mas que avançou (ou
  // fechou venda) dentro dele sumia do recorte inteiro — inclusive fazendo
  // uma venda fechada na semana "sumir" do filtro "essa semana" só porque o
  // lead tinha sido criado antes.
  const populacaoFunilPorEtapa = (() => {
    const base = leads.filter(l => correspondeBusca(l, busca))
    const filtros = { vendedorId: filtroVendedorId, canal: filtroCanal }
    if (!filtroPeriodo) return popularFunilNoPeriodo(base, () => true, filtros)
    const inicioData = new Date(`${filtroPeriodo.inicio}T00:00:00`)
    const fimData = new Date(`${filtroPeriodo.fim}T23:59:59.999`)
    return popularFunilNoPeriodo(base, d => d >= inicioData && d <= fimData, filtros)
  })()

  const totalFiltrado = leadsFiltrados.length
  const fechadosFiltrado = populacaoFunilPorEtapa.FECHADO.length
  const conversaoFiltrado = totalFiltrado > 0 ? (fechadosFiltrado / totalFiltrado) * 100 : 0
  const filtroTextualAtivo = busca !== '' || filtroCanal !== '' || filtroVendedorId !== null || filtroPeriodo !== null

  function limparFiltros() {
    setBusca('')
    setFiltroCanal('')
    setFiltroVendedorId(null)
    limparFiltroPeriodo()
  }

  // Indicadores de performance por etapa — mesma lógica de conversão/perda/
  // meta/custo da Jornada de compra do Painel (FunilJourney), só que
  // calculada em cima da contagem por estágio do próprio Kanban (respeitando
  // os filtros de canal/vendedor/período/busca já aplicados acima).
  const leadsDoMes = leads.filter(l => l.criadoEm.slice(0, 7) === mesCorrente).length
  const custoAutomatico = isDono && gastoMes != null && gastoMes > 0 && leadsDoMes > 0 ? gastoMes / leadsDoMes : null
  const custoPorLeadTopo = custoAutomatico ?? parametro?.custoPorLeadTopo ?? 0
  const metaPorEtapa = new Map<EstagioLead, MetaFunilProLabore>(metasFunil.map(m => [m.etapa, m]))
  const populacaoPorEtapa: Lead[][] = COLUNAS.map(col => populacaoFunilPorEtapa[col.estagio])
  const valoresPorEtapa = populacaoPorEtapa.map(pop => pop.length)
  const totalTopoFunil = valoresPorEtapa[0]
  // Valor de negociação usado nos cálculos em R$: o valor ATUAL salvo no
  // lead (não existe histórico do valor por etapa no modelo — só o
  // histórico de troca de estágio — então não dá pra saber quanto o lead
  // valia no momento em que passou por cada etapa).
  const oportunidadePorEtapaRS = populacaoPorEtapa.map(pop => pop.reduce((s, l) => s + l.valorNegociacao, 0))
  // Base de "Comissão (Perdida)" — mesma população cumulativa acima
  // ("alcançou essa etapa ou foi além"), só que somando o teto de comissão
  // efetivo de cada lead em vez do valor de negociação. A queda de uma
  // etapa pra outra é a comissão que deixou de ser possível (mesmo padrão
  // do "Perda (R$)" da oportunidade), já carregando o efeito de negociação
  // "R" (que contribui menos a cada etapa em que o lead ainda aparece).
  const comissaoPorEtapaCumulativaRS = populacaoPorEtapa.map(pop => pop.reduce((s, l) => s + tetoComissaoEfetivo(l), 0))
  // Pró-labore/comissão potencial por etapa usa a população que está
  // LITERALMENTE na coluna agora (não a cumulativa) — é o que permite abrir
  // os 2 indicadores agregados do topo (que somam sobre leadsAtivos inteiro,
  // um valor por lead) em 5 fatias que somadas batem com o total do topo.
  const ativosNaEtapaAgora = COLUNAS.map(col => leadsAtivos.filter(l => l.estagio === col.estagio))
  const stagesDados = COLUNAS.map((col, i) => {
    const value = valoresPorEtapa[i]
    const convFromPrev = i === 0 ? 1 : (valoresPorEtapa[i - 1] > 0 ? Math.min(1, value / valoresPorEtapa[i - 1]) : (value > 0 ? 1 : 0))
    const perdaQuantidade = i === 0 ? null : Math.max(0, valoresPorEtapa[i - 1] - value)
    const perdaPct = i === 0 ? null : 1 - convFromPrev
    const conversaoTotal = totalTopoFunil > 0 ? value / totalTopoFunil : 0
    const custoPorLead = custoPorLeadTopo > 0 && conversaoTotal > 0 ? custoPorLeadTopo / conversaoTotal : null
    const meta = metaPorEtapa.get(col.estagio)
    let statusOk: boolean | null = null
    if (meta) {
      if (meta.tipoMeta === 'MAXIMO_PERDA') statusOk = perdaPct == null ? null : perdaPct <= meta.metaPct
      else if (meta.tipoMeta === 'MAXIMO_CUSTO') statusOk = meta.metaCusto == null || custoPorLead == null ? null : custoPorLead <= meta.metaCusto
      else statusOk = conversaoTotal >= meta.metaPct
    }

    // ---- Trilha paralela em R$ (mesmo padrão acima, só que somando
    // valorNegociacao em vez de contar leads) ----
    const oportunidadeRS = oportunidadePorEtapaRS[i]
    const convAnteriorRS = i === 0 || oportunidadePorEtapaRS[i - 1] <= 0 ? null : oportunidadeRS / oportunidadePorEtapaRS[i - 1]
    const perdaRS = i === 0 || oportunidadePorEtapaRS[i - 1] <= 0 ? null : Math.max(0, oportunidadePorEtapaRS[i - 1] - oportunidadeRS)
    const perdaPctRS = perdaRS == null || oportunidadePorEtapaRS[i - 1] <= 0 ? null : perdaRS / oportunidadePorEtapaRS[i - 1]
    const proLaborePotencialRS = ativosNaEtapaAgora[i].reduce((s, l) => s + tetoProLaboreEfetivo(l), 0)
    const comissaoPotencialRS = ativosNaEtapaAgora[i].reduce((s, l) => s + tetoComissaoEfetivo(l), 0)
    // Comissão (Perdida): quanto da comissão que "entrou" na etapa anterior
    // não chegou nesta — cai tanto pelo lead não ter avançado (perdido ou
    // só parado numa etapa anterior) quanto por virar negociação "R" no
    // meio do caminho.
    const comissaoPerdidaRS = i === 0 ? 0 : Math.max(0, comissaoPorEtapaCumulativaRS[i - 1] - comissaoPorEtapaCumulativaRS[i])

    return {
      ...col, i, value, convFromPrev, perdaQuantidade, perdaPct, conversaoTotal, custoPorLead, meta, statusOk,
      oportunidadeRS, convAnteriorRS, perdaRS, perdaPctRS, proLaborePotencialRS, comissaoPotencialRS, comissaoPerdidaRS,
    }
  })
  const statusPorEtapa = new Map(stagesDados.map(d => [d.estagio, d.statusOk]))


  const leadConvertendo = convertendoId ? leads.find(l => l.id === convertendoId) ?? null : null
  const tetoProLaboreAtual = leadConvertendo ? tetoProLaboreEfetivo(leadConvertendo) : tetoProLabore
  const tetoComissaoAtual = leadConvertendo?.vendedorId ? tetoComissaoEfetivo(leadConvertendo) : null
  const leadEditando = editandoId ? leads.find(l => l.id === editandoId) ?? null : null

  return (
    <div>
      <PageHeader
        eyebrow="Vendas"
        title="Funil de vendas"
        subtitle={vejaEquipe ? 'Arraste os cards entre as etapas, use "Avançar" ou o menu de mover em cada card' : 'Seus leads, do primeiro contato ao fechamento'}
        actions={
          <button type="button" className="pl-btn pl-btn-primary" onClick={abrirNovoLead}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Novo lead
          </button>
        }
      />

      <FaixaWhatsapp gestao={vejaEquipe} versao={leads.length} onMudou={carregar} />

      <div className="pl-leads-toolbar">
        <div className="pl-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input
            className="pl-input pl-search-input"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone, e-mail, modelo..."
          />
        </div>
        <FunilFiltro
          vendedores={vejaEquipe ? vendedores : []}
          vendedorId={filtroVendedorId}
          vendedorGeralId=""
          canal={filtroCanal}
          onChangeVendedor={setFiltroVendedorId}
          onChangeCanal={setFiltroCanal}
          periodo={filtroPeriodo}
          customInicio={filtroCustomInicio}
          customFim={filtroCustomFim}
          onChangeCustomInicio={setFiltroCustomInicio}
          onChangeCustomFim={setFiltroCustomFim}
          onAplicarPeriodo={aplicarFiltroPeriodo}
          onLimparPeriodo={limparFiltroPeriodo}
          onSelecionarPreset={selecionarFiltroPreset}
        />
      </div>

      <div className="pl-section-note" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span>
          {totalFiltrado} lead{totalFiltrado !== 1 ? 's' : ''} · {fechadosFiltrado} fechamento{fechadosFiltrado !== 1 ? 's' : ''} · {conversaoFiltrado.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% de conversão
        </span>
        {totalPerdidos > 0 && (
          <Link className="pl-link-action pl-leads-textlink" href="/pro-labore/reativacao">Perdidos na Reativação ({totalPerdidos}) →</Link>
        )}
        {filtroTextualAtivo && (
          <span className="pl-link-action pl-leads-textlink" onClick={limparFiltros}>Limpar filtros</span>
        )}
      </div>

      {!loading && (
        <div className="pl-crm-resumo" data-metricas-resumo>
          <span><small>Oportunidade</small> <b className="pl-crm-fin-oportunidade">{formatMoeda(stagesDados.reduce((t, d) => t + d.oportunidadeRS, 0))}</b></span>
          <span><small>Comissão prevista</small> <b>{formatMoeda(stagesDados.reduce((t, d) => t + d.comissaoPotencialRS, 0))}</b></span>
          <span><small>Comissão perdida</small> <b className="pl-crm-resumo-perda">{formatMoeda(stagesDados.reduce((t, d) => t + d.comissaoPerdidaRS, 0))}</b></span>
          {stagesDados.some(d => d.statusOk === false) && <span className="pl-delta down">{stagesDados.filter(d => d.statusOk === false).length} etapa{stagesDados.filter(d => d.statusOk === false).length > 1 ? 's' : ''} fora da meta</span>}
          <button type="button" className="pl-link-action" onClick={alternarMetricas} aria-expanded={metricasAbertas} data-alternar-metricas>
            {metricasAbertas ? 'Esconder métricas por etapa ▴' : 'Ver métricas por etapa ▾'}
          </button>
        </div>
      )}

      {!loading && metricasAbertas && (
        <>
          {isDono && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span className="pl-hint">Custo por lead (topo do funil):</span>
              {custoAutomatico != null ? (
                <span style={{ fontWeight: 600 }} title="Gasto com anúncios do mês ÷ leads criados no mês. Atualiza sozinho.">
                  {formatMoeda(custoAutomatico)} <span className="pl-hint" style={{ fontWeight: 500 }}>· automático (gasto do mês ÷ {leadsDoMes} leads do mês)</span>
                </span>
              ) : editandoCustoLead ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number" step="0.01" min="0" autoFocus
                    className="pl-input" style={{ width: 100, padding: '4px 8px' }}
                    value={custoLeadValor} onChange={e => setCustoLeadValor(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && salvarCustoLead()}
                  />
                  <button type="button" className="pl-btn pl-btn-primary" disabled={salvandoCustoLead} onClick={salvarCustoLead} style={{ padding: '4px 10px' }}>OK</button>
                  <button type="button" className="pl-btn pl-btn-ghost" onClick={() => setEditandoCustoLead(false)} style={{ padding: '4px 10px' }}>Cancelar</button>
                </div>
              ) : (
                <span className="pl-link-action" onClick={iniciarEdicaoCustoLead} style={{ fontWeight: 600 }}>
                  {formatMoeda(custoPorLeadTopo)} ✎
                </span>
              )}
            </div>
          )}

          <div className="pl-crm-fin-row">
            {stagesDados.map(d => (
              <div key={d.estagio} className="pl-crm-fin-card">
                <div className="pl-crm-fin-item">
                  <span>Oportunidade</span>
                  <b className="pl-crm-fin-oportunidade">{formatMoeda(d.oportunidadeRS)}</b>
                </div>
                {isDono && (
                  <div className="pl-crm-fin-item">
                    <span>Pró-labore</span>
                    <b>{formatMoeda(d.proLaborePotencialRS)}</b>
                  </div>
                )}
                <div className="pl-crm-fin-item">
                  <span>Comissão (Previsão)</span>
                  <b>{formatMoeda(d.comissaoPotencialRS)}</b>
                </div>
                <div className="pl-crm-fin-item pl-crm-fin-perdida">
                  <span>Comissão (Perdida)</span>
                  <b>{formatMoeda(d.comissaoPerdidaRS)}</b>
                </div>
              </div>
            ))}
          </div>

          <div className="pl-crm-perf-row">
            {stagesDados.map(d => (
              <div key={d.estagio} className={`pl-crm-perf-card ${d.statusOk === false ? 'fora-meta' : ''}`}>
                <div className="pl-stage-conv" style={{ marginTop: 0 }}>
                  {d.i === 0 ? 'topo do funil' : <>conv. anterior <b>{(d.convFromPrev * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</b></>}
                </div>
                {d.i > 0 && (
                  <div className="pl-stage-conv">
                    Perda <b>{d.perdaQuantidade} ({formatPct(d.perdaPct ?? 0)})</b>
                  </div>
                )}
                {editandoEtapaMeta === d.estagio ? (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                    <select
                      className="pl-select" style={{ fontSize: 11, padding: '2px 4px' }}
                      value={tipoMetaEdicao} onChange={e => setTipoMetaEdicao(e.target.value as TipoMetaFunilPL)}
                    >
                      <option value="MINIMO">Conversão mín.</option>
                      <option value="MAXIMO_PERDA">Perda máx.</option>
                      <option value="MAXIMO_CUSTO">Custo máx.</option>
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {tipoMetaEdicao === 'MAXIMO_CUSTO' && <span className="pl-hint">R$</span>}
                      <input
                        type="number" autoFocus className="pl-input" style={{ width: 56, padding: '2px 4px', fontSize: 11, textAlign: 'center' }}
                        value={valorMetaEdicao} onChange={e => setValorMetaEdicao(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && salvarMeta()}
                      />
                      {tipoMetaEdicao !== 'MAXIMO_CUSTO' && <span className="pl-hint">%</span>}
                      <button type="button" className="pl-link-action" disabled={salvandoMeta} onClick={salvarMeta}>OK</button>
                    </div>
                  </div>
                ) : (
                  <div className="pl-stage-conv" style={{ marginTop: 6 }}>
                    {isDono ? (
                      <span className="pl-link-action" onClick={() => iniciarEdicaoMeta(d.estagio)}>{rotuloMetaCrm(d.meta)} ✎</span>
                    ) : (
                      <span>{rotuloMetaCrm(d.meta)}</span>
                    )}
                    {d.statusOk != null && <span className={`pl-delta ${d.statusOk ? 'up' : 'down'}`} style={{ marginLeft: 6 }}>{d.statusOk ? 'ok' : 'fora'}</span>}
                  </div>
                )}
                {d.custoPorLead != null && (
                  <div className="pl-stage-conv">
                    Custo/lead <b>{formatMoeda(d.custoPorLead)}</b>
                  </div>
                )}

                {d.i > 0 && (
                  <>
                    <div className="pl-crm-perf-divider" />
                    <div className="pl-crm-perf-subhead">Valores em R$</div>
                    <div className="pl-stage-conv">
                      conv. anterior (R$) <b>{d.convAnteriorRS != null ? `${(d.convAnteriorRS * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'}</b>
                    </div>
                    <div className="pl-stage-conv">
                      Perda (R$) <b>{d.perdaRS != null ? <>{formatMoeda(d.perdaRS)} ({d.perdaPctRS != null ? formatPct(d.perdaPctRS) : '—'})</> : '—'}</b>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {loading ? (
        <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>
      ) : totalFiltrado === 0 && filtroTextualAtivo ? (
        <div className="pl-empty pl-card">
          <div className="pl-emoji">🔍</div>
          <h3 style={{ margin: 0, color: 'var(--pl-ink-1)', fontWeight: 600 }}>Nenhum lead encontrado</h3>
          <p style={{ marginTop: 6 }}>Ajuste a busca ou os filtros pra ver os leads.</p>
          <span className="pl-link-action pl-leads-textlink" style={{ marginTop: 14, display: 'inline-block' }} onClick={limparFiltros}>Limpar filtros</span>
        </div>
      ) : (
        <>
          {(followsAtrasados > 0 || followsHoje > 0 || filtroFollow) && (
            <div className="fw-faixa" role="group" aria-label="Follows do dia">
              <span className="pl-hint">Follows:</span>
              {followsAtrasados > 0 && <button type="button" className={`pl-chip atrasado ${filtroFollow === 'ATRASADO' ? 'active' : ''}`} aria-pressed={filtroFollow === 'ATRASADO'} onClick={() => setFiltroFollow(f => (f === 'ATRASADO' ? '' : 'ATRASADO'))}>{followsAtrasados} atrasado{followsAtrasados > 1 ? 's' : ''}</button>}
              {followsHoje > 0 && <button type="button" className={`pl-chip hoje ${filtroFollow === 'HOJE' ? 'active' : ''}`} aria-pressed={filtroFollow === 'HOJE'} onClick={() => setFiltroFollow(f => (f === 'HOJE' ? '' : 'HOJE'))}>{followsHoje} para hoje</button>}
              {filtroFollow && <span className="pl-link-action pl-leads-textlink" onClick={() => setFiltroFollow('')}>Ver todos os cards</span>}
            </div>
          )}
          {(contagemEtiquetas.length > 0 || filtroEtiqueta) && (
            <div className="fw-faixa" role="group" aria-label="Etiquetas da jornada" data-filtro-etiquetas>
              <span className="pl-hint" title="Postas pelo Assistente a partir da conversa do WhatsApp">Etiquetas:</span>
              {contagemEtiquetas.map(({ e, n }) => (
                <button key={e} type="button" className={`pl-chip ${filtroEtiqueta === e ? 'active' : ''}`} aria-pressed={filtroEtiqueta === e} onClick={() => setFiltroEtiqueta(f => (f === e ? '' : e))}>{ROTULO_ETIQUETA[e]} · {n}</button>
              ))}
              {filtroEtiqueta && <span className="pl-link-action pl-leads-textlink" onClick={() => setFiltroEtiqueta('')}>Ver todos os cards</span>}
            </div>
          )}
          <div className="pl-kanban-barra">
            <span className="pl-hint">Clique no card para ver tudo do lead.</span>
            <div className="pl-kanban-densidade" role="group" aria-label="Tamanho dos cards">
              {(['compacto', 'detalhado'] as const).map(d => (
                <button key={d} type="button" className={`pl-chip ${densidade === d ? 'active' : ''}`} aria-pressed={densidade === d} onClick={() => setDensidade(d)} data-densidade={d}>{d === 'compacto' ? 'Compacto' : 'Detalhado'}</button>
              ))}
            </div>
          </div>
          <div className="pl-kanban">
            {COLUNAS.map(col => {
              const leadsDaColuna = leadsAtivosOrdenados.filter(l => l.estagio === col.estagio)
              return (
                <div
                  key={col.estagio}
                  ref={el => { if (el) colRefs.current.set(col.estagio, el); else colRefs.current.delete(col.estagio) }}
                  className={`pl-kanban-col ${dragOverCol === col.estagio ? 'drop-active' : ''} ${statusPorEtapa.get(col.estagio) === false ? 'fora-meta' : ''}`}
                >
                  <div className="pl-kanban-col-head">
                    <div>
                      <div className="pl-kanban-col-title">{col.titulo}</div>
                      {col.estagio === 'FECHADO' && !isDono && (
                        <div className="pl-kanban-col-hint">Confirmação de venda é só do dono</div>
                      )}
                    </div>
                    <div className="pl-kanban-col-lado">
                      <div className="pl-kanban-col-count pl-mono">{leadsDaColuna.length}</div>
                      {somaDaColuna(leadsDaColuna) > 0 && <div className="pl-kanban-col-soma" title="Soma do valor da negociação dos cards da coluna">{moedaCurta(somaDaColuna(leadsDaColuna))}</div>}
                    </div>
                  </div>
                  <div className="pl-kanban-cards">
                    {leadsDaColuna.length === 0 && <div className="pl-kanban-empty">Arraste um lead pra cá</div>}
                    {leadsDaColuna.map(lead => (
                      <KanbanCard
                        key={lead.id}
                        lead={lead}
                        estagio={col.estagio}
                        isDono={isDono}
                        vejaEquipe={vejaEquipe}
                        densidade={densidade}
                        destaque={filtroEtiqueta || undefined}
                        dragging={draggingId === lead.id}
                        onPointerDown={e => onPointerDownCard(e, lead)}
                        onAbrir={() => setPainelId(lead.id)}
                        onNotas={() => abrirNotas(lead.id)}
                        onMudarEstagio={estagio => mudarEstagio(lead, estagio)}
                        onConverter={() => abrirConversao(lead)}
                        onEditar={() => abrirEdicao(lead)}
                        onPerdido={() => marcarPerdido(lead)}
                        onFollow={() => setFollowAberto(lead)}
                        onDesfazer={() => desfazerAvanco(lead)}
                        onRemover={() => remover(lead)}
                        onDefinirTipoNegociacao={tipo => definirTipoNegociacao(lead, tipo)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

        </>
      )}

      {painelLead && (
        <PainelLead
          lead={painelLead}
          colunas={COLUNAS}
          isDono={isDono}
          vejaEquipe={vejaEquipe}
          focarNota={focoNota}
          podeEscrever={podeEditarCrm}
          onContagemNotas={n => contarNotas(painelLead.id, n)}
          onFechar={fecharPainel}
          onMover={estagio => { if (estagio === 'FECHADO') abrirConversao(painelLead); else mudarEstagio(painelLead, estagio) }}
          onConverter={() => abrirConversao(painelLead)}
          onEditar={() => { setPainelId(null); abrirEdicao(painelLead) }}
          onPerdido={() => { setPainelId(null); marcarPerdido(painelLead) }}
          onFollow={() => setFollowAberto(painelLead)}
          onDesfazer={() => desfazerAvanco(painelLead)}
          onRemover={() => { setPainelId(null); remover(painelLead) }}
          onDefinirTipoNegociacao={tipo => definirTipoNegociacao(painelLead, tipo)}
        />
      )}

      {followAberto && (
        <FollowModal lead={followAberto} pendente={followAberto.follows?.[0] ?? null} onFechar={() => setFollowAberto(null)} onMudou={carregar} />
      )}
      {perdaAberta && (
        <PerdaModal
          nomeCliente={perdaAberta.nomeCliente}
          onFechar={() => setPerdaAberta(null)}
          onConfirmar={async perda => { await proLaboreApi.leads.mudarEstagio(perdaAberta.id, 'PERDIDO', perda); carregar() }}
        />
      )}

      {novoLeadAberto && (
        <div className="pl-modal-backdrop" onClick={fecharNovoLead}>
          <form onSubmit={handleSubmit} className="pl-card pl-modal-panel" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="pl-card-title" style={{ marginBottom: 14 }}>Novo lead</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              <div className="pl-field">
                <label>Nome do cliente</label>
                <input className="pl-input" autoFocus value={form.nomeCliente} onChange={e => setForm(f => ({ ...f, nomeCliente: e.target.value }))} placeholder="Ex: Carlos Mendes" required minLength={2} />
              </div>
              <div className="pl-field">
                <label>Telefone (opcional)</label>
                <input className="pl-input" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
              </div>
              <div className="pl-field">
                <label>E-mail (opcional)</label>
                <input type="email" className="pl-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="cliente@email.com" />
              </div>
              <div className="pl-field">
                <label>CPF (opcional)</label>
                <input className="pl-input" value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
              </div>
              <div className="pl-field">
                <label>Endereço (opcional)</label>
                <input className="pl-input" value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Ex: Rua, número, cidade" />
              </div>
              <div className="pl-field">
                <label>Modelo de interesse (opcional)</label>
                <input className="pl-input" value={form.modeloInteresse} onChange={e => setForm(f => ({ ...f, modeloInteresse: e.target.value }))} placeholder="Ex: CG 160" />
              </div>
              <div className="pl-field">
                <label>Valor da negociação (R$)</label>
                <CampoValorCentavos valorDigitos={form.valorNegociacao} onChange={v => setForm(f => ({ ...f, valorNegociacao: v }))} />
                <span className="pl-hint">Quanto o cliente teria capacidade de gerar de faturamento</span>
              </div>
              <div className="pl-field">
                <label>Canal (opcional)</label>
                <select className="pl-select" value={form.tipoLead} onChange={e => setForm(f => ({ ...f, tipoLead: e.target.value as TipoLead | '' }))}>
                  <option value="">— Não informado —</option>
                  {TIPOS_LEAD.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
                </select>
              </div>
              {vejaEquipe && (
                <div className="pl-field">
                  <label>Vendedor (opcional)</label>
                  <select className="pl-select" value={form.vendedorId} onChange={e => setForm(f => ({ ...f, vendedorId: e.target.value }))}>
                    <option value="">— Sem vendedor —</option>
                    {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                  </select>
                </div>
              )}
              <div className="pl-field">
                <label>Observação (opcional)</label>
                <input className="pl-input" value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: preferências do cliente" />
              </div>
            </div>
            <AvisoCodigoPost codigo={codigoNoFormulario(form)} />
            {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 14 }}>{erro}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Adicionar lead'}</button>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={fecharNovoLead}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {leadConvertendo && (
        <div className="pl-modal-backdrop" onClick={fecharConversao}>
          <div className="pl-card pl-modal-panel" onClick={e => e.stopPropagation()}>
            <div className="pl-card-title" style={{ marginBottom: 4 }}>Converter em venda</div>
            <div className="pl-card-sub" style={{ marginBottom: 16 }}>
              {leadConvertendo.nomeCliente}
              {leadConvertendo.tipoNegociacao && (
                <span className="pl-tipo-negociacao-tag" title={TIPO_NEGOCIACAO_TITLE[leadConvertendo.tipoNegociacao]} style={{ marginLeft: 8 }}>
                  {leadConvertendo.tipoNegociacao}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="pl-field">
                <label>Data da venda</label>
                <input type="date" className="pl-input" value={convertForm.data} onChange={e => setConvertForm(f => ({ ...f, data: e.target.value }))} required />
              </div>
              <div className="pl-field">
                <label>Valor da venda (R$)</label>
                <input type="number" step="0.01" min="0" className="pl-input" value={convertForm.valorVenda} onChange={e => atualizarValorVendaConversao(e.target.value)} placeholder="0,00" required />
              </div>
              <div className="pl-field">
                <label>Pró-labore sacado (R$)</label>
                <input type="number" step="0.01" min="0" max={tetoProLaboreAtual} className="pl-input" value={convertForm.valorProLabore} onChange={e => setConvertForm(f => ({ ...f, valorProLabore: e.target.value }))} placeholder="0,00" required />
                <span className="pl-hint">Máximo {formatMoeda(tetoProLaboreAtual)}</span>
              </div>
              {leadConvertendo.vendedorId && (
                <div className="pl-field">
                  <label>Comissão do vendedor (R$)</label>
                  <input type="number" step="0.01" min="0" max={tetoComissaoAtual ?? undefined} className="pl-input" value={convertForm.valorComissao} onChange={e => setConvertForm(f => ({ ...f, valorComissao: e.target.value }))} placeholder="0,00" />
                  <span className="pl-hint">Máximo {formatMoeda(tetoComissaoAtual ?? 0)}</span>
                </div>
              )}
              <div className="pl-field">
                <label>Observação (opcional)</label>
                <input className="pl-input" value={convertForm.observacao} onChange={e => setConvertForm(f => ({ ...f, observacao: e.target.value }))} placeholder={`Convertido do lead: ${leadConvertendo.nomeCliente}`} />
              </div>
            </div>
            {convertErro && <div className="pl-alert pl-alert-error" style={{ marginTop: 14 }}>{convertErro}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="button" className="pl-btn pl-btn-primary" disabled={convertSalvando} onClick={converter}>
                {convertSalvando ? 'Convertendo...' : 'Confirmar venda'}
              </button>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={fecharConversao}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {leadEditando && (
        <div className="pl-modal-backdrop" onClick={fecharEdicao}>
          <div className="pl-card pl-modal-panel" onClick={e => e.stopPropagation()}>
            <div className="pl-card-title" style={{ marginBottom: 4 }}>Editar lead</div>
            <div className="pl-card-sub" style={{ marginBottom: 16 }}>{leadEditando.nomeCliente}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="pl-field">
                <label>Nome do cliente</label>
                <input className="pl-input" value={editForm.nomeCliente} onChange={e => setEditForm(f => ({ ...f, nomeCliente: e.target.value }))} required minLength={2} />
              </div>
              <div className="pl-field">
                <label>Telefone (opcional)</label>
                <input className="pl-input" value={editForm.telefone} onChange={e => setEditForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
              </div>
              <div className="pl-field">
                <label>E-mail (opcional)</label>
                <input type="email" className="pl-input" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="cliente@email.com" />
              </div>
              <div className="pl-field">
                <label>CPF (opcional)</label>
                <input className="pl-input" value={editForm.cpf} onChange={e => setEditForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
              </div>
              <div className="pl-field">
                <label>Endereço (opcional)</label>
                <input className="pl-input" value={editForm.endereco} onChange={e => setEditForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Ex: Rua, número, cidade" />
              </div>
              <div className="pl-field">
                <label>Modelo de interesse (opcional)</label>
                <input className="pl-input" value={editForm.modeloInteresse} onChange={e => setEditForm(f => ({ ...f, modeloInteresse: e.target.value }))} placeholder="Ex: CG 160" />
              </div>
              <div className="pl-field">
                <label>Valor da negociação (R$)</label>
                <CampoValorCentavos valorDigitos={editForm.valorNegociacao} onChange={v => setEditForm(f => ({ ...f, valorNegociacao: v }))} />
                <span className="pl-hint">Quanto o cliente teria capacidade de gerar de faturamento</span>
              </div>
              <div className="pl-field">
                <label>Canal (opcional)</label>
                <select className="pl-select" value={editForm.tipoLead} onChange={e => setEditForm(f => ({ ...f, tipoLead: e.target.value as TipoLead | '' }))}>
                  <option value="">— Não informado —</option>
                  {TIPOS_LEAD.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
                </select>
              </div>
              {vejaEquipe && (
                <div className="pl-field">
                  <label>Vendedor (opcional)</label>
                  <select className="pl-select" value={editForm.vendedorId} onChange={e => setEditForm(f => ({ ...f, vendedorId: e.target.value }))}>
                    <option value="">— Sem vendedor —</option>
                    {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                  </select>
                </div>
              )}
              <div className="pl-field">
                <label>Observação (opcional)</label>
                <input className="pl-input" value={editForm.observacao} onChange={e => setEditForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: preferências do cliente" />
              </div>
            </div>
            {!leadEditando.postCode && <AvisoCodigoPost codigo={codigoNoFormulario(editForm)} />}
            {editErro && <div className="pl-alert pl-alert-error" style={{ marginTop: 14 }}>{editErro}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="button" className="pl-btn pl-btn-primary" disabled={editSalvando} onClick={salvarEdicao}>
                {editSalvando ? 'Salvando...' : 'Salvar alterações'}
              </button>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={fecharEdicao}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Último avanço foi do Assistente e o lead continua lá: dá para desfazer (aviso por 3 dias).
function avancoAutomaticoRecente(lead: Lead) {
  const ultimo = lead.historico?.[lead.historico.length - 1]
  if (!ultimo || ultimo.origem !== 'ASSISTENTE' || ultimo.estagioNovo !== lead.estagio || lead.vendaId) return null
  return Date.now() - new Date(ultimo.criadoEm).getTime() < 3 * 86_400_000 ? ultimo : null
}

/* ============ CARD DO KANBAN ============ */
// Card enxuto: quem é, o que quer, quão quente está e o próximo passo. O
// resto (telefone, observação, histórico, todas as ações) fica no painel do
// lead, que abre com um clique no card. No modo "detalhado" o card mostra
// também o telefone e mais etiquetas.
function KanbanCard({
  lead, estagio, isDono, vejaEquipe, densidade, destaque, dragging, onPointerDown, onAbrir, onNotas, onMudarEstagio, onConverter, onEditar, onPerdido, onFollow, onDesfazer, onRemover, onDefinirTipoNegociacao,
}: {
  lead: Lead
  estagio: EstagioLead
  isDono: boolean
  vejaEquipe: boolean
  densidade: Densidade
  // Etiqueta filtrada: aparece primeiro no card.
  destaque?: string
  dragging: boolean
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onAbrir: () => void
  onNotas: () => void
  onMudarEstagio: (estagio: EstagioLead) => void
  onConverter: () => void
  onEditar: () => void
  onPerdido: () => void
  onFollow: () => void
  onDesfazer: () => void
  onRemover: () => void
  onDefinirTipoNegociacao: (tipo: TipoNegociacao) => void
}) {
  const proximoFollow = lead.follows?.[0] ?? null
  const sitFollow = proximoFollow ? situacaoFollow(proximoFollow) : null
  const avancoAuto = avancoAutomaticoRecente(lead)
  const movivel = !lead.vendaId
  const proxima = proximaEtapaSimples(estagio)
  const proximaTitulo = proxima ? COLUNAS.find(c => c.estagio === proxima)?.titulo : null
  // Fechamentos exige os dados da venda (valor, pró-labore, comissão) — indo
  // pra lá pelo menu "Mover para", abre o mesmo modal de conversão do
  // arrastar/botão, em vez de só trocar o estágio sem registrar a venda.
  function moverParaEtapa(destino: EstagioLead) {
    if (destino === 'FECHADO') { onConverter(); return }
    onMudarEstagio(destino)
  }
  const dias = diasParado(lead)
  // "Esfriando" — mais de uma semana sem avançar.
  const parado = dias >= 7 && !lead.vendaId
  const viaWhatsapp = lead.origemCadastro === 'WHATSAPP'
  const faixa = typeof lead.pontuacao === 'number' ? (lead.pontuacao >= 70 ? 'quente' : lead.pontuacao >= 40 ? 'morno' : 'frio') : ''
  const etiquetas = lead.etiquetas?.filter(e => e !== 'QUENTE') ?? []
  const detalhado = densidade === 'detalhado'
  const linha2 = lead.modeloInteresse || (lead.telefone ? telefoneBonito(lead.telefone) : null)
  const notas = lead._count?.notas ?? 0

  return (
    <div
      className={`pl-kanban-card pl-kc ${faixa ? `nota-${faixa}` : ''} ${dragging ? 'dragging' : ''} ${parado ? 'parado' : ''} ${lead.vendaId ? 'vendido' : ''}`}
      style={movivel ? undefined : { cursor: 'pointer' }}
      onPointerDown={movivel ? onPointerDown : undefined}
      onClick={movivel ? undefined : onAbrir}
      onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) onAbrir() }}
      tabIndex={0}
      role="button"
      aria-label={`Abrir ${lead.nomeCliente}`}
      data-lead={lead.id}
    >
      <div className="pl-kc-topo">
        <span className="pl-kanban-card-name pl-kc-nome">{lead.nomeCliente}</span>
        <span className="pl-kc-topo-lado">
          {!lead.vendaId && <span className={`pl-kanban-card-time ${parado ? 'stale' : ''}`} title={`Há ${tempoParado(dias)} sem mudar de etapa`}>{tempoParado(dias)}</span>}
          {vejaEquipe && lead.vendedor && <span className="pl-avatar pl-kc-vendedor" title={lead.vendedor.nome} style={{ background: corAvatar(lead.vendedor.id) }}>{iniciais(lead.vendedor.nome)}</span>}
        </span>
      </div>
      {(linha2 || lead.valorNegociacao > 0) && (
        <div className="pl-kc-linha">
          {linha2 && <span className="pl-kc-moto" title={linha2}>{lead.modeloInteresse ? '🏍 ' : ''}{linha2}</span>}
          {lead.valorNegociacao > 0 && <span className="pl-kc-valor pl-mono" title="Valor da negociação">{moedaCurta(lead.valorNegociacao)}</span>}
        </div>
      )}
      {detalhado && lead.modeloInteresse && lead.telefone && <div className="pl-kc-meta">{telefoneBonito(lead.telefone)}</div>}
      <div className="pl-kc-selos">
        {typeof lead.pontuacao === 'number' && !lead.vendaId && <ChipNota nota={lead.pontuacao} titulo={`Nota do Assistente pela conversa do WhatsApp: ${lead.pontuacao} de 100`} />}
        {(viaWhatsapp || lead.tipoLead || lead.postCode) && (
          <span className="pl-kc-origem">
            {viaWhatsapp && <span className="wa" title="Entrou sozinho quando o contato chamou no WhatsApp" data-tag-whatsapp><IconeOrigem tipo="wa" /></span>}
            {lead.tipoLead === 'TRAFEGO' && <span className="ads" title={TIPO_LABEL.TRAFEGO}><IconeOrigem tipo="ads" /></span>}
            {lead.tipoLead === 'ORGANICO' && !lead.postCode && <span title={TIPO_LABEL.ORGANICO}><IconeOrigem tipo="org" /></span>}
            {lead.postCode && <span className="ig" title={`Post do Instagram que trouxe o lead: ${lead.postCode}`}><IconeOrigem tipo="ig" /></span>}
          </span>
        )}
        {!lead.vendaId && etiquetas.length > 0 && <EtiquetasLead etiquetas={etiquetas} max={detalhado ? 4 : 2} primeiro={destaque} />}
        {notas > 0 && (
          <span className="pl-kc-notas" title={`${notas} nota${notas > 1 ? 's' : ''} da negociação`} data-notas-card={notas}>
            <IconeNota />{notas}
          </span>
        )}
      </div>
      {(sitFollow || lead.vendaId || lead.tipoNegociacao || avancoAuto) && (
        <div className="pl-kc-rodape">
          {avancoAuto && (
            <span className="pl-kc-auto-mini" data-avanco-auto title={`Movido pelo assistente: ${avancoAuto.motivo} (${new Date(avancoAuto.criadoEm).toLocaleString('pt-BR')})`}>
              ↗ Assistente moveu
              <button type="button" className="pl-link-action" onClick={onDesfazer} onPointerDown={e => e.stopPropagation()} data-desfazer>Desfazer</button>
            </span>
          )}
          {sitFollow && (
            <button type="button" className={`fw-selo ${sitFollow.tipo.toLowerCase()}`} onClick={onFollow} onPointerDown={e => e.stopPropagation()} title={proximoFollow?.nota ?? 'Ver o follow'} data-follow={sitFollow.tipo}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
              {sitFollow.texto}
            </button>
          )}
          {lead.vendaId && <span className="pl-kanban-card-badge pl-kc-venda">✓ Convertido em venda</span>}
          {lead.tipoNegociacao && <span className="pl-tipo-negociacao-tag" title={TIPO_NEGOCIACAO_TITLE[lead.tipoNegociacao]}>{lead.tipoNegociacao}</span>}
        </div>
      )}
      {movivel && (
        <div className="pl-kc-acoes" onPointerDown={e => e.stopPropagation()}>
          {proxima && (
            <button type="button" className="pl-kc-btn pl-kanban-card-advance" onClick={() => onMudarEstagio(proxima)} title={`Avançar para ${proximaTitulo}`} aria-label={`Avançar para ${proximaTitulo}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
            </button>
          )}
          <button type="button" className="pl-kc-btn" onClick={onFollow} title={proximoFollow ? 'Ver o follow' : 'Agendar follow'} aria-label={proximoFollow ? 'Ver o follow' : 'Agendar follow'} data-acao="follow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
          </button>
          <button type="button" className="pl-kc-btn" onClick={onNotas} title="Notas da negociação" aria-label="Notas da negociação" data-acao="notas">
            <IconeNota />
          </button>
          <MenuDoCard
            estagioAtual={estagio} isDono={isDono} tipoNegociacao={lead.tipoNegociacao ?? null}
            onAbrir={onAbrir} onMover={moverParaEtapa} onConverter={onConverter} onEditar={onEditar} onPerdido={onPerdido} onRemover={onRemover} onDefinirTipoNegociacao={onDefinirTipoNegociacao}
          />
        </div>
      )}
    </div>
  )
}

// Notas da negociação (selo e botão do card).
function IconeNota() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /><path d="M8 13h8M8 17h5" /></svg>
}

// Origem do lead em ícone (o nome completo fica no title).
function IconeOrigem({ tipo }: { tipo: 'wa' | 'ads' | 'org' | 'ig' }) {
  const p = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (tipo === 'wa') return <svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /></svg>
  if (tipo === 'ads') return <svg {...p}><path d="M3 11l15-6v14L3 13z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>
  if (tipo === 'ig') return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg>
  return <svg {...p}><path d="M11 20A7 7 0 0 1 4 13c0-5 7-10 7-10s7 5 7 10a7 7 0 0 1-7 7z" /><path d="M11 20v-8" /></svg>
}

// "5591969500009" → "+55 91 96950-0009" (lead cadastrado à mão com o número cru).
function telefoneBonito(t: string): string {
  const d = t.replace(/\D/g, '')
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return `+55 ${d.slice(2, 4)} ${d.slice(4, -4)}-${d.slice(-4)}`
  if (d.length === 10 || d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}`
  return t
}

/* ============ MENU "⋯" DO CARD ============ */
// Tudo que não precisa ficar à vista: abrir, mover para qualquer etapa
// (inclusive voltando), editar, converter, P/R, perdido e remover.
function MenuDoCard({ estagioAtual, isDono, tipoNegociacao, onAbrir, onMover, onConverter, onEditar, onPerdido, onRemover, onDefinirTipoNegociacao }: {
  estagioAtual: EstagioLead
  isDono: boolean
  tipoNegociacao: TipoNegociacao | null
  onAbrir: () => void
  onMover: (estagio: EstagioLead) => void
  onConverter: () => void
  onEditar: () => void
  onPerdido: () => void
  onRemover: () => void
  onDefinirTipoNegociacao: (tipo: TipoNegociacao) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [alvo, setAlvo] = useState<Element | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  // O botão vive dentro da coluna com rolagem própria: o menu sai por um
  // portal (no .pl-app, onde estão as cores do painel), na posição do botão.
  function alternar() {
    if (aberto) { setAberto(false); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ top: Math.min(r.bottom + 6, window.innerHeight - 360), left: Math.max(8, Math.min(r.right - 220, window.innerWidth - 228)) })
    setAlvo(btnRef.current?.closest('.pl-app') ?? document.body)
    setAberto(true)
  }

  useEffect(() => {
    if (!aberto) return
    function onClickFora(e: MouseEvent) {
      if (popRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return
      setAberto(false)
    }
    function fechar() { setAberto(false) }
    document.addEventListener('mousedown', onClickFora)
    window.addEventListener('scroll', fechar, true)
    window.addEventListener('resize', fechar)
    return () => {
      document.removeEventListener('mousedown', onClickFora)
      window.removeEventListener('scroll', fechar, true)
      window.removeEventListener('resize', fechar)
    }
  }, [aberto])

  const opcoes = COLUNAS.filter(c => c.estagio !== estagioAtual && (c.estagio !== 'FECHADO' || isDono))
  const item = (rotulo: string, fn: () => void, perigo = false) => (
    <button type="button" className={`pl-kanban-move-item ${perigo ? 'pl-kc-perigo' : ''}`} onClick={() => { setAberto(false); fn() }}>{rotulo}</button>
  )

  return (
    <>
      <button ref={btnRef} type="button" className="pl-kc-btn" onClick={alternar} title="Mais ações" aria-label="Mais ações" aria-expanded={aberto} data-menu-card>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {aberto && pos && alvo && createPortal(
        <div ref={popRef} className="pl-kanban-move-pop pl-kc-menu" style={{ top: pos.top, left: pos.left }} role="menu">
          {item('Abrir detalhes', onAbrir)}
          {item('Editar', onEditar)}
          <div className="pl-kc-menu-titulo">Mover para</div>
          {opcoes.map(o => <div key={o.estagio}>{item(`${o.titulo}${o.estagio === 'FECHADO' ? ' (converter)' : ''}`, () => onMover(o.estagio))}</div>)}
          {isDono && estagioAtual !== 'FECHADO' && item('✓ Converter em venda', onConverter)}
          {isDono && (
            <div className="pl-kc-menu-pr">
              {TIPOS_NEGOCIACAO.map(t => (
                <button key={t} type="button" className={`pl-kanban-card-tiponeg-btn ${tipoNegociacao === t ? 'active' : ''}`} onClick={() => { setAberto(false); onDefinirTipoNegociacao(t) }} title={TIPO_NEGOCIACAO_TITLE[t]}>{t}</button>
              ))}
            </div>
          )}
          <div className="pl-kc-menu-sep" />
          {item('Marcar como perdido', onPerdido, true)}
          {item('Remover', onRemover, true)}
        </div>,
        alvo,
      )}
    </>
  )
}
