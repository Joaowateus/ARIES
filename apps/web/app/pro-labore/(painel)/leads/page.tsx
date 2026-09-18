'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { proLaboreApi, Lead, EstagioLead, TipoLead, TIPOS_LEAD, Vendedor, ParametroLiquidez, MetaFunilProLabore, TipoMetaFunilPL, EstagioFunilPL } from '@/lib/proLaboreApi'
import { formatMoeda, formatPct, centavosParaReais } from '@/lib/format'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'
import { FunilFiltro, estagioAtingiu, periodoHoje, periodoSemanaAtual } from '@/lib/proLaboreFunilFiltro'

const COLUNAS: { estagio: EstagioFunilPL; titulo: string }[] = [
  { estagio: 'LEAD', titulo: 'Leads' },
  { estagio: 'ABORDADO', titulo: 'Abordados' },
  { estagio: 'NEGOCIACAO', titulo: 'Negociação (MQL)' },
  { estagio: 'PROPOSTA', titulo: 'Propostas (SQL)' },
  { estagio: 'FECHADO', titulo: 'Fechamentos' },
]

const TIPO_LABEL: Record<TipoLead, string> = { TRAFEGO: 'Tráfego Pago', ORGANICO: 'Orgânico' }
const TIPO_CLASS: Record<TipoLead, string> = { TRAFEGO: 'trafego', ORGANICO: 'organico' }

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
  valorNegociacao: string
}

const FORM_VAZIO: FormLead = { nomeCliente: '', telefone: '', email: '', cpf: '', endereco: '', modeloInteresse: '', observacao: '', vendedorId: '', tipoLead: '', valorNegociacao: '' }

export default function ProLaboreLeadsPage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel === 'DONO'
  const isSupervisor = usuario?.papel === 'SUPERVISOR'
  // Supervisor gerencia o CRM da equipe inteira (ver/criar/editar/reatribuir
  // qualquer lead), mas "Converter"/arrastar pra Fechamentos continua
  // exclusivo do dono — essas ações continuam em `isDono` estrito.
  const vejaEquipe = isDono || isSupervisor

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
  const [mostrarPerdidos, setMostrarPerdidos] = useState(false)

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
  const [novoLeadAberto, setNovoLeadAberto] = useState(false)
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
      .then(([l, v, p, metas]) => { setLeads(l); setVendedores(v); setParametro(p); setMetasFunil(metas) })
      .finally(() => setLoading(false))
  }, [vejaEquipe])

  useEffect(() => { carregar() }, [carregar])

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
    try {
      await proLaboreApi.leads.criar({
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

  async function marcarPerdido(lead: Lead) {
    if (!confirm(`Marcar o lead de ${lead.nomeCliente} como perdido?`)) return
    await mudarEstagio(lead, 'PERDIDO')
  }

  async function reabrir(lead: Lead) {
    await mudarEstagio(lead, 'LEAD')
  }

  async function remover(lead: Lead) {
    if (!confirm(`Remover o lead de ${lead.nomeCliente}?`)) return
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

  function abrirConversao(lead: Lead) {
    if (!isDono) return
    setConvertendoId(lead.id)
    setConvertForm({ data: hojeIso(), valorVenda: '', valorProLabore: String(tetoProLabore), valorComissao: lead.vendedorId ? String(tetoComissao(lead.vendedorId)) : '', observacao: '' })
    setConvertErro('')
  }

  function fecharConversao() {
    setConvertendoId(null)
    setConvertErro('')
  }

  function atualizarValorVendaConversao(valor: string) {
    const numero = Number(valor)
    const sugestao = Number.isFinite(numero) && numero > 0 ? Math.min(numero, tetoProLabore) : tetoProLabore
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
    if ((e.target as HTMLElement).closest('.pl-kanban-card-actions-row, .pl-kanban-card-advance, .pl-kanban-card-convert, .pl-filter-wrap')) return
    const abort = new AbortController()
    dragRef.current = { lead, startX: e.clientX, startY: e.clientY, dragging: false, colSobre: null, abort }
    window.addEventListener('pointermove', onPointerMoveWin, { signal: abort.signal })
    window.addEventListener('pointerup', onPointerUpWin, { signal: abort.signal })
    window.addEventListener('pointercancel', onPointerCancelWin, { signal: abort.signal })
  }

  const leadsFiltrados = leads
    .filter(l => !filtroCanal || l.tipoLead === filtroCanal)
    .filter(l => !filtroVendedorId || l.vendedorId === filtroVendedorId)
    .filter(l => correspondeBusca(l, busca))
    .filter(l => {
      if (!filtroPeriodo) return true
      const d = new Date(l.criadoEm)
      return d >= new Date(`${filtroPeriodo.inicio}T00:00:00`) && d <= new Date(`${filtroPeriodo.fim}T23:59:59.999`)
    })
  const leadsAtivos = leadsFiltrados.filter(l => l.estagio !== 'PERDIDO')
  const leadsPerdidos = leadsFiltrados.filter(l => l.estagio === 'PERDIDO')
  const leadsAtivosOrdenados = [...leadsAtivos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))

  const totalFiltrado = leadsFiltrados.length
  const fechadosFiltrado = leadsFiltrados.filter(l => l.vendaId).length
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
  const custoPorLeadTopo = parametro?.custoPorLeadTopo ?? 0
  const metaPorEtapa = new Map<EstagioLead, MetaFunilProLabore>(metasFunil.map(m => [m.etapa, m]))
  // População de cada etapa pra fins de conversão/perda: "alcançou essa etapa
  // ou foi além" (cumulativo, mesmo conceito do FunilJourney) — não é o
  // mesmo grupo que está literalmente parado nessa coluna do Kanban agora.
  const populacaoPorEtapa: Lead[][] = COLUNAS.map(col =>
    col.estagio === 'LEAD'
      ? leadsFiltrados
      : col.estagio === 'FECHADO'
        ? leadsFiltrados.filter(l => l.estagio === 'FECHADO')
        : leadsFiltrados.filter(l => estagioAtingiu(l.estagio, col.estagio)),
  )
  const valoresPorEtapa = populacaoPorEtapa.map(pop => pop.length)
  const totalTopoFunil = valoresPorEtapa[0]
  // Valor de negociação usado nos cálculos em R$: o valor ATUAL salvo no
  // lead (não existe histórico do valor por etapa no modelo — só o
  // histórico de troca de estágio — então não dá pra saber quanto o lead
  // valia no momento em que passou por cada etapa).
  const oportunidadePorEtapaRS = populacaoPorEtapa.map(pop => pop.reduce((s, l) => s + l.valorNegociacao, 0))
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
    const proLaborePotencialRS = ativosNaEtapaAgora[i].length * tetoProLabore
    const comVendedorNaEtapa = ativosNaEtapaAgora[i].filter(l => l.vendedorId)
    const comissaoPotencialRS = comVendedorNaEtapa.reduce((s, l) => s + tetoComissao(l.vendedorId), 0)

    return {
      ...col, i, value, convFromPrev, perdaQuantidade, perdaPct, conversaoTotal, custoPorLead, meta, statusOk,
      oportunidadeRS, convAnteriorRS, perdaRS, perdaPctRS, proLaborePotencialRS, comissaoPotencialRS,
    }
  })
  const statusPorEtapa = new Map(stagesDados.map(d => [d.estagio, d.statusOk]))


  const leadConvertendo = convertendoId ? leads.find(l => l.id === convertendoId) ?? null : null
  const tetoComissaoAtual = leadConvertendo?.vendedorId ? tetoComissao(leadConvertendo.vendedorId) : null
  const leadEditando = editandoId ? leads.find(l => l.id === editandoId) ?? null : null

  return (
    <div>
      <div className="pl-section-head" style={{ marginTop: 0 }}>
        <div>
          <div className="pl-eyebrow">CRM</div>
          <h2 className="pl-section-title">Funil de vendas</h2>
          <div className="pl-section-note" style={{ marginTop: 4 }}>
            {vejaEquipe ? 'Arraste os cards entre as etapas, use "Avançar" ou o menu de mover em cada card' : 'Seus leads, do primeiro contato ao fechamento'}
          </div>
        </div>
        <button type="button" className="pl-btn pl-btn-primary" onClick={abrirNovoLead}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          Novo lead
        </button>
      </div>

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
        {leadsPerdidos.length > 0 && (
          <span className="pl-link-action pl-leads-textlink" onClick={() => setMostrarPerdidos(m => !m)}>{mostrarPerdidos ? 'Ocultar' : 'Ver'} perdidos ({leadsPerdidos.length})</span>
        )}
        {filtroTextualAtivo && (
          <span className="pl-link-action pl-leads-textlink" onClick={limparFiltros}>Limpar filtros</span>
        )}
      </div>

      {!loading && (
        <>
          {isDono && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span className="pl-hint">Custo por lead (topo do funil):</span>
              {editandoCustoLead ? (
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
                  <span>Comissão</span>
                  <b>{formatMoeda(d.comissaoPotencialRS)}</b>
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
                    <div className="pl-kanban-col-count pl-mono">{leadsDaColuna.length}</div>
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
                        dragging={draggingId === lead.id}
                        onPointerDown={e => onPointerDownCard(e, lead)}
                        onMudarEstagio={estagio => mudarEstagio(lead, estagio)}
                        onConverter={() => abrirConversao(lead)}
                        onEditar={() => abrirEdicao(lead)}
                        onPerdido={() => marcarPerdido(lead)}
                        onRemover={() => remover(lead)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {mostrarPerdidos && leadsPerdidos.length > 0 && (
            <div className="pl-table-wrap" style={{ marginTop: 20 }}>
              <table className="pl-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Canal</th>
                    {vejaEquipe && <th>Vendedor</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {leadsPerdidos.map(l => (
                    <tr key={l.id}>
                      <td>{l.nomeCliente}</td>
                      <td>{l.tipoLead ? TIPO_LABEL[l.tipoLead] : '—'}</td>
                      {vejaEquipe && <td>{l.vendedor?.nome ?? '—'}</td>}
                      <td className="pl-right">
                        <span className="pl-link-action" onClick={() => reabrir(l)} style={{ marginRight: 14 }}>Reabrir</span>
                        <span className="pl-link-action pl-danger" onClick={() => remover(l)}>Remover</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
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
            <div className="pl-card-sub" style={{ marginBottom: 16 }}>{leadConvertendo.nomeCliente}</div>
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
                <input type="number" step="0.01" min="0" max={tetoProLabore} className="pl-input" value={convertForm.valorProLabore} onChange={e => setConvertForm(f => ({ ...f, valorProLabore: e.target.value }))} placeholder="0,00" required />
                <span className="pl-hint">Máximo {formatMoeda(tetoProLabore)}</span>
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

/* ============ CARD DO KANBAN ============ */
function KanbanCard({
  lead, estagio, isDono, vejaEquipe, dragging, onPointerDown, onMudarEstagio, onConverter, onEditar, onPerdido, onRemover,
}: {
  lead: Lead
  estagio: EstagioLead
  isDono: boolean
  vejaEquipe: boolean
  dragging: boolean
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onMudarEstagio: (estagio: EstagioLead) => void
  onConverter: () => void
  onEditar: () => void
  onPerdido: () => void
  onRemover: () => void
}) {
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
  // "Esfriando" — mais de uma semana sem avançar. É um sinal que só fica
  // mais valioso conforme o CRM acumula leads: com muita coisa na coluna,
  // é fácil um lead parado passar despercebido rolando a lista.
  const parado = dias >= 7 && !lead.vendaId

  return (
    <div
      className={`pl-kanban-card ${dragging ? 'dragging' : ''}`}
      style={movivel ? undefined : { cursor: 'default' }}
      onPointerDown={movivel ? onPointerDown : undefined}
    >
      <div className="pl-kanban-card-head">
        <div className="pl-kanban-card-name">{lead.nomeCliente}</div>
        {!lead.vendaId && <span className={`pl-kanban-card-time ${parado ? 'stale' : ''}`} title={`Há ${tempoParado(dias)} sem mudar de etapa`}>{tempoParado(dias)}</span>}
      </div>
      <div className="pl-kanban-card-valor pl-mono" title="Valor da negociação">{formatMoeda(lead.valorNegociacao)}</div>
      {lead.telefone && <div className="pl-kanban-card-meta">{lead.telefone}</div>}
      {vejaEquipe && lead.vendedor && (
        <div className="pl-kanban-card-vendor">
          <span className="pl-avatar" style={{ width: 18, height: 18, fontSize: 8.5, background: corAvatar(lead.vendedor.id) }}>{iniciais(lead.vendedor.nome)}</span>
          {lead.vendedor.nome}
        </div>
      )}
      {lead.modeloInteresse && <div className="pl-kanban-card-meta">Interesse: {lead.modeloInteresse}</div>}
      {lead.observacao && <div className="pl-kanban-card-meta">{lead.observacao}</div>}
      {lead.tipoLead && <span className={`pl-kanban-card-tag ${TIPO_CLASS[lead.tipoLead]}`}>{TIPO_LABEL[lead.tipoLead]}</span>}
      {lead.vendaId ? (
        <div className="pl-kanban-card-badge">✓ Convertido em venda</div>
      ) : (
        <>
          {proxima && (
            <button type="button" className="pl-kanban-card-advance" onClick={() => onMudarEstagio(proxima)} title={`Mover para ${proximaTitulo}`}>
              Avançar
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
            </button>
          )}
          {isDono && estagio !== 'FECHADO' && (
            <button type="button" className="pl-kanban-card-convert" onClick={onConverter} title="Converter em venda">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              Converter em venda
            </button>
          )}
          <div className="pl-kanban-card-actions-row">
            <MoverEtapaMenu estagioAtual={estagio} isDono={isDono} onMover={moverParaEtapa} />
            <button type="button" className="pl-kanban-icon-btn" onClick={onEditar} title="Editar" aria-label="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            </button>
            <button type="button" className="pl-kanban-icon-btn pl-danger" onClick={onPerdido} title="Marcar como perdido" aria-label="Marcar como perdido">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v16M4 5h13l-2.5 3.5L17 12H4" /></svg>
            </button>
            <button type="button" className="pl-kanban-icon-btn pl-danger" onClick={onRemover} title="Remover" aria-label="Remover">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ============ MENU "MOVER PARA" (qualquer etapa, sem precisar arrastar) ============ */
// Complementa o arrastar e o botão "Avançar" (que só vai uma etapa adiante):
// deixa pular direto pra qualquer etapa, inclusive voltando — o principal
// ganho é justamente numa coluna cheia, onde arrastar até o topo ou até uma
// etapa duas casas à frente exige rolar a lista inteira segurando o card.
function MoverEtapaMenu({ estagioAtual, isDono, onMover }: { estagioAtual: EstagioLead; isDono: boolean; onMover: (estagio: EstagioLead) => void }) {
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  // O botão vive dentro da coluna com rolagem própria (.pl-kanban-cards) —
  // um popover posicionado normalmente (absolute, dentro do fluxo) fica
  // cortado pelo overflow da coluna. Um portal, com a posição calculada a
  // partir do próprio botão, escapa desse recorte e sempre aparece por
  // cima, não importa em qual coluna o card esteja.
  function alternar() {
    if (aberto) { setAberto(false); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 186) })
    setAberto(true)
  }

  // As cores do painel (--pl-surface, --pl-border etc.) são escopadas em
  // .pl-app, de propósito, pra não vazar no resto do ARIES — um portal
  // direto pro <body> cairia FORA dessa árvore e perderia as variáveis
  // (o popover renderizava, mas transparente/sem contraste nenhum). Por
  // isso o alvo do portal é o próprio .pl-app, não o body.
  const portalAlvo = typeof document !== 'undefined' ? (btnRef.current?.closest('.pl-app') ?? document.body) : null

  useEffect(() => {
    if (!aberto) return
    function onClickFora(e: MouseEvent) {
      if (popRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return
      setAberto(false)
    }
    // Fecha ao rolar (a coluna do card ou a página) — sem isso o menu
    // ficaria "flutuando" longe do botão que o abriu.
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

  return (
    <>
      <button ref={btnRef} type="button" className="pl-kanban-icon-btn" onClick={alternar} title="Mover para etapa" aria-label="Mover para etapa">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7l4-4 4 4M16 17l-4 4-4-4M12 3v18" /></svg>
      </button>
      {aberto && pos && portalAlvo && createPortal(
        <div ref={popRef} className="pl-kanban-move-pop" style={{ top: pos.top, left: pos.left }}>
          {opcoes.map(o => (
            <button key={o.estagio} type="button" className="pl-kanban-move-item" onClick={() => { onMover(o.estagio); setAberto(false) }}>
              {o.titulo}{o.estagio === 'FECHADO' ? ' (converter)' : ''}
            </button>
          ))}
        </div>,
        portalAlvo,
      )}
    </>
  )
}
