'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  proLaboreApi, AgendaItem, AgendaConclusao, AgendaCategoria, AgendaTipoItem, AGENDA_CATEGORIAS, Vendedor,
} from '@/lib/proLaboreApi'
import { useProLaboreAuth } from '@/lib/proLaboreAuth'

const MESES_LABEL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const CATEGORIA_LABEL: Record<AgendaCategoria, string> = {
  META: 'Meta diária', PROCESSO: 'Processo', AUDITORIA: 'Auditoria', PROTOCOLO: 'Protocolo', OUTRO: 'Outro',
}
const CATEGORIA_COR: Record<AgendaCategoria, string> = {
  META: 'var(--pl-accent)', PROCESSO: 'var(--pl-accent-3)', AUDITORIA: 'var(--pl-accent-5)', PROTOCOLO: 'var(--pl-accent-4)', OUTRO: 'var(--pl-ink-muted)',
}

const ROTULO_DONO = 'Você (Head Comercial)'

function isoDia(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function hojeUTC(): Date {
  const h = new Date()
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate()))
}

// Uma ocorrência "única" cai só na própria data; uma "recorrente" cai em
// todo dia da semana marcado, dentro do intervalo início/fim (quando
// definido) — resolvida aqui no cliente, sem precisar de uma linha por dia
// no banco pra cada item.
function itemAplicaNoDia(item: AgendaItem, dia: Date): boolean {
  if (!item.ativo) return false
  const diaIso = isoDia(dia)
  if (item.tipo === 'UNICO') {
    return !!item.data && item.data.slice(0, 10) === diaIso
  }
  const dias = (item.diasSemana ?? '').split(',').filter(Boolean).map(Number)
  if (!dias.includes(dia.getUTCDay())) return false
  if (item.dataInicio && diaIso < item.dataInicio.slice(0, 10)) return false
  if (item.dataFim && diaIso > item.dataFim.slice(0, 10)) return false
  return true
}

// Sem vendedorIds nem incluiDono = "toda a equipe" (cada pessoa segue e
// conclui por conta própria). Com alvo(s), só essas pessoas — pode ser
// vários vendedores e/ou o dono ("Head Comercial") ao mesmo tempo.
function alvosDoItem(item: AgendaItem): string[] {
  return (item.vendedorIds ?? '').split(',').filter(Boolean)
}

function itemAplicaPara(item: AgendaItem, meuVendedorId: string | null, souDono: boolean): boolean {
  const alvos = alvosDoItem(item)
  const temAlvo = alvos.length > 0 || item.incluiDono
  if (!temAlvo) return true
  if (souDono) return item.incluiDono
  return meuVendedorId != null && alvos.includes(meuVendedorId)
}

// Rótulo de "atribuído a" pra exibição — quem não vê a equipe não tem a
// lista de vendedores carregada (nem precisa: o backend só devolve pra ele
// os itens que já são dele mesmo), então só mostra "Você".
function alvoLabel(item: AgendaItem, vendedores: Vendedor[], vejaEquipe: boolean): string {
  const alvos = alvosDoItem(item)
  const temAlvo = alvos.length > 0 || item.incluiDono
  if (!temAlvo) return 'Toda a equipe'
  if (!vejaEquipe) return 'Você'
  const nomes: string[] = []
  if (item.incluiDono) nomes.push(ROTULO_DONO)
  for (const id of alvos) {
    const nome = vendedores.find(v => v.id === id)?.nome
    if (nome) nomes.push(nome)
  }
  return nomes.length > 0 ? nomes.join(', ') : 'Pessoas específicas'
}

function foiConcluido(conclusoes: AgendaConclusao[], itemId: string, autorId: string, diaIso: string): boolean {
  return conclusoes.some(c => c.agendaItemId === itemId && c.autorId === autorId && c.dataReferencia.slice(0, 10) === diaIso)
}

type PeriodoAuditoria = '7' | '30' | 'mes'

function rangeAuditoria(periodo: PeriodoAuditoria): { inicio: Date; fim: Date } {
  const hoje = hojeUTC()
  if (periodo === 'mes') {
    return { inicio: new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1)), fim: hoje }
  }
  const inicio = new Date(hoje)
  inicio.setUTCDate(inicio.getUTCDate() - (periodo === '7' ? 6 : 29))
  return { inicio, fim: hoje }
}

const AVATAR_CORES_AUDITORIA = ['var(--pl-accent)', 'var(--pl-accent-3)', 'var(--pl-accent-4)', 'var(--pl-accent-5)', 'var(--pl-accent-2)', 'var(--pl-accent-6)']

function iniciais(nome: string): string {
  return nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

// Hash simples e estável do id só pra escolher sempre a mesma cor de avatar
// pra mesma pessoa, sem precisar de um índice de posição numa lista.
function corAvatar(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_CORES_AUDITORIA[h % AVATAR_CORES_AUDITORIA.length]
}

function corPct(pct: number): string {
  if (pct >= 80) return 'var(--pl-good)'
  if (pct >= 50) return 'var(--pl-accent-4)'
  return 'var(--pl-critical)'
}

function diasDoMesGrid(ano: number, mes: number): (Date | null)[] {
  const primeiro = new Date(Date.UTC(ano, mes, 1))
  const diasNoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
  const celulas: (Date | null)[] = []
  for (let i = 0; i < primeiro.getUTCDay(); i++) celulas.push(null)
  for (let d = 1; d <= diasNoMes; d++) celulas.push(new Date(Date.UTC(ano, mes, d)))
  while (celulas.length % 7 !== 0) celulas.push(null)
  return celulas
}

type FormAgenda = {
  titulo: string
  descricao: string
  categoria: AgendaCategoria
  tipo: AgendaTipoItem
  data: string
  diasSemana: number[]
  dataInicio: string
  dataFim: string
  horario: string
  alvoModo: 'TODOS' | 'ESPECIFICO'
  alvoIncluiDono: boolean
  alvoVendedorIds: string[]
}

const FORM_VAZIO: FormAgenda = {
  titulo: '', descricao: '', categoria: 'META', tipo: 'RECORRENTE', data: '',
  diasSemana: [1, 2, 3, 4, 5], dataInicio: '', dataFim: '', horario: '',
  alvoModo: 'TODOS', alvoIncluiDono: false, alvoVendedorIds: [],
}

export default function ProLaboreAgendaPage() {
  const { usuario } = useProLaboreAuth()
  const isDono = usuario?.papel === 'DONO'
  const isSupervisor = usuario?.papel === 'SUPERVISOR'
  const vejaEquipe = isDono || isSupervisor
  // Pra VENDEDOR/SUPERVISOR, usuario.id já É o próprio vendedorId (é o que
  // /auth/me e /auth/login devolvem pra esses papéis); pro DONO é o próprio
  // usuarioId da conta. Os dois casam exatamente com o `autorId` que o
  // backend calcula (vendedorId do token, ou o usuarioId quando é o dono).
  const meuVendedorId = isDono ? null : usuario?.id ?? null
  const meuAutorId = usuario?.id ?? ''

  const [itens, setItens] = useState<AgendaItem[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [conclusoes, setConclusoes] = useState<AgendaConclusao[]>([])
  const [loading, setLoading] = useState(true)

  const [mesVisivel, setMesVisivel] = useState(() => { const h = hojeUTC(); return { ano: h.getUTCFullYear(), mes: h.getUTCMonth() } })
  const [diaSelecionado, setDiaSelecionado] = useState(() => isoDia(hojeUTC()))
  const [mostrarTodos, setMostrarTodos] = useState(false)

  const [periodoAuditoria, setPeriodoAuditoria] = useState<PeriodoAuditoria>('7')
  const [conclusoesAuditoria, setConclusoesAuditoria] = useState<AgendaConclusao[]>([])
  const [carregandoAuditoria, setCarregandoAuditoria] = useState(false)

  const [modalAberto, setModalAberto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState<FormAgenda>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function carregarItens() {
    return proLaboreApi.agenda.itens.listar().then(setItens)
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      carregarItens(),
      vejaEquipe ? proLaboreApi.vendedores.listar().then(setVendedores) : Promise.resolve(),
    ]).finally(() => setLoading(false))
  }, [vejaEquipe])

  // Busca conclusões cobrindo o mês visível E hoje (a união dos dois) — o
  // indicador "hoje" no topo precisa do dia atual mesmo quando a pessoa está
  // navegando o calendário por outro mês.
  useEffect(() => {
    const inicioMes = new Date(Date.UTC(mesVisivel.ano, mesVisivel.mes, 1))
    const fimMes = new Date(Date.UTC(mesVisivel.ano, mesVisivel.mes + 1, 0))
    const hoje = hojeUTC()
    const inicio = inicioMes < hoje ? inicioMes : hoje
    const fim = fimMes > hoje ? fimMes : hoje
    proLaboreApi.agenda.conclusoes.listar(isoDia(inicio), isoDia(fim)).then(setConclusoes)
  }, [mesVisivel.ano, mesVisivel.mes])

  // Auditoria de aderência: período independente do mês visível no
  // calendário, só carregado (e usado) por quem enxerga a equipe.
  useEffect(() => {
    if (!vejaEquipe) return
    const { inicio, fim } = rangeAuditoria(periodoAuditoria)
    setCarregandoAuditoria(true)
    proLaboreApi.agenda.conclusoes.listar(isoDia(inicio), isoDia(fim))
      .then(setConclusoesAuditoria)
      .finally(() => setCarregandoAuditoria(false))
  }, [vejaEquipe, periodoAuditoria])

  const meusItens = useMemo(() => itens.filter(i => itemAplicaPara(i, meuVendedorId, isDono)), [itens, meuVendedorId, isDono])

  const hojeIso = isoDia(hojeUTC())
  const meusItensHoje = useMemo(() => meusItens.filter(i => itemAplicaNoDia(i, hojeUTC())), [meusItens])
  const meusConcluidosHoje = meusItensHoje.filter(i => foiConcluido(conclusoes, i.id, meuAutorId, hojeIso)).length

  const vendedoresAtivos = vendedores.filter(v => v.ativo)
  const aderenciaEquipeHoje = useMemo(() => {
    if (!vejaEquipe || vendedoresAtivos.length === 0) return null
    let somaPct = 0
    let comItem = 0
    for (const v of vendedoresAtivos) {
      const aplicaveis = itens.filter(i => itemAplicaPara(i, v.id, false) && itemAplicaNoDia(i, hojeUTC()))
      if (aplicaveis.length === 0) continue
      comItem += 1
      const feitos = aplicaveis.filter(i => foiConcluido(conclusoes, i.id, v.id, hojeIso)).length
      somaPct += feitos / aplicaveis.length
    }
    return comItem > 0 ? (somaPct / comItem) * 100 : null
  }, [vejaEquipe, vendedoresAtivos, itens, conclusoes, hojeIso])

  // Ranking de aderência no período selecionado: pra cada pessoa (dono
  // incluído, quando ele mesmo é alvo de algum item) soma quantos itens
  // aplicáveis existiram em cada dia do período e quantos foram concluídos.
  const auditoria = useMemo(() => {
    if (!vejaEquipe) return []
    const { inicio, fim } = rangeAuditoria(periodoAuditoria)
    const donoAutorId = itens[0]?.usuarioId
    const pessoas: { id: string; nome: string; ehDono: boolean }[] = []
    if (donoAutorId) pessoas.push({ id: donoAutorId, nome: ROTULO_DONO, ehDono: true })
    for (const v of vendedoresAtivos) pessoas.push({ id: v.id, nome: v.nome, ehDono: false })

    const dias: Date[] = []
    for (const d = new Date(inicio); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) dias.push(new Date(d))

    return pessoas
      .map(p => {
        let total = 0
        let feitos = 0
        for (const dia of dias) {
          const diaIso = isoDia(dia)
          const aplicaveis = itens.filter(i => itemAplicaPara(i, p.ehDono ? null : p.id, p.ehDono) && itemAplicaNoDia(i, dia))
          total += aplicaveis.length
          feitos += aplicaveis.filter(i => foiConcluido(conclusoesAuditoria, i.id, p.id, diaIso)).length
        }
        return { id: p.id, nome: p.nome, total, feitos, pct: total > 0 ? (feitos / total) * 100 : 0 }
      })
      .filter(p => p.total > 0)
      .sort((a, b) => b.pct - a.pct)
  }, [vejaEquipe, periodoAuditoria, itens, vendedoresAtivos, conclusoesAuditoria])

  async function alternarConclusao(item: AgendaItem, diaIso: string) {
    const resultado = await proLaboreApi.agenda.itens.concluir(item.id, diaIso)
    setConclusoes(atual => {
      const semEsse = atual.filter(c => !(c.agendaItemId === item.id && c.autorId === meuAutorId && c.dataReferencia.slice(0, 10) === diaIso))
      if (!resultado.concluido) return semEsse
      return [...semEsse, { id: `${item.id}-${meuAutorId}-${diaIso}`, agendaItemId: item.id, autorId: meuAutorId, dataReferencia: diaIso, concluidoEm: resultado.concluidoEm ?? new Date().toISOString() }]
    })
  }

  function abrirNovoItem() {
    setEditandoId(null)
    setForm(FORM_VAZIO)
    setErro('')
    setModalAberto(true)
  }

  function abrirEdicaoItem(item: AgendaItem) {
    const alvos = alvosDoItem(item)
    setEditandoId(item.id)
    setForm({
      titulo: item.titulo,
      descricao: item.descricao ?? '',
      categoria: item.categoria,
      tipo: item.tipo,
      data: item.data ? item.data.slice(0, 10) : '',
      diasSemana: (item.diasSemana ?? '').split(',').filter(Boolean).map(Number),
      dataInicio: item.dataInicio ? item.dataInicio.slice(0, 10) : '',
      dataFim: item.dataFim ? item.dataFim.slice(0, 10) : '',
      horario: item.horario ?? '',
      alvoModo: alvos.length > 0 || item.incluiDono ? 'ESPECIFICO' : 'TODOS',
      alvoIncluiDono: item.incluiDono,
      alvoVendedorIds: alvos,
    })
    setErro('')
    setModalAberto(true)
  }

  function alternarAlvoVendedor(id: string) {
    setForm(f => ({ ...f, alvoVendedorIds: f.alvoVendedorIds.includes(id) ? f.alvoVendedorIds.filter(x => x !== id) : [...f.alvoVendedorIds, id] }))
  }

  function fecharModal() {
    setModalAberto(false)
    setErro('')
  }

  function alternarDiaSemana(dia: number) {
    setForm(f => ({ ...f, diasSemana: f.diasSemana.includes(dia) ? f.diasSemana.filter(d => d !== dia) : [...f.diasSemana, dia].sort() }))
  }

  async function salvarItem(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (form.tipo === 'UNICO' && !form.data) { setErro('Escolha a data do item'); return }
    if (form.tipo === 'RECORRENTE' && form.diasSemana.length === 0) { setErro('Selecione ao menos um dia da semana'); return }
    if (form.alvoModo === 'ESPECIFICO' && form.alvoVendedorIds.length === 0 && !form.alvoIncluiDono) { setErro('Selecione ao menos uma pessoa'); return }
    setSalvando(true)
    try {
      const vendedorIds = form.alvoModo === 'ESPECIFICO' ? form.alvoVendedorIds : []
      const incluiDono = form.alvoModo === 'ESPECIFICO' && form.alvoIncluiDono
      const payload = {
        titulo: form.titulo,
        descricao: form.descricao || undefined,
        categoria: form.categoria,
        tipo: form.tipo,
        data: form.tipo === 'UNICO' ? form.data : undefined,
        diasSemana: form.tipo === 'RECORRENTE' ? form.diasSemana : undefined,
        dataInicio: form.tipo === 'RECORRENTE' ? form.dataInicio || undefined : undefined,
        dataFim: form.tipo === 'RECORRENTE' ? form.dataFim || undefined : undefined,
        horario: form.horario || undefined,
        vendedorIds,
        incluiDono,
      }
      if (editandoId) {
        await proLaboreApi.agenda.itens.editar(editandoId, { ...payload, vendedorIds: vendedorIds.length > 0 ? vendedorIds : null, horario: form.horario || null })
      } else {
        await proLaboreApi.agenda.itens.criar(payload)
      }
      setModalAberto(false)
      carregarItens()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar item da agenda')
    } finally {
      setSalvando(false)
    }
  }

  async function alternarAtivo(item: AgendaItem) {
    await proLaboreApi.agenda.itens.editar(item.id, { ativo: !item.ativo })
    carregarItens()
  }

  async function removerItem(item: AgendaItem) {
    if (!confirm(`Remover "${item.titulo}" da agenda? O histórico de conclusões dele também será apagado.`)) return
    await proLaboreApi.agenda.itens.remover(item.id)
    carregarItens()
  }

  if (loading) return <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13 }}>Carregando...</div>

  const grid = diasDoMesGrid(mesVisivel.ano, mesVisivel.mes)
  const diaSelecionadoDate = new Date(`${diaSelecionado}T00:00:00.000Z`)
  const itensDoDiaSelecionado = itens
    .filter(i => itemAplicaNoDia(i, diaSelecionadoDate) && (vejaEquipe || itemAplicaPara(i, meuVendedorId, isDono)))
    .sort((a, b) => (a.horario ?? '99:99').localeCompare(b.horario ?? '99:99'))
  const rotuloDiaSelecionado = diaSelecionadoDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' })

  function mesAnterior() {
    setMesVisivel(m => (m.mes === 0 ? { ano: m.ano - 1, mes: 11 } : { ano: m.ano, mes: m.mes - 1 }))
  }
  function proximoMes() {
    setMesVisivel(m => (m.mes === 11 ? { ano: m.ano + 1, mes: 0 } : { ano: m.ano, mes: m.mes + 1 }))
  }
  function irParaHoje() {
    const h = hojeUTC()
    setMesVisivel({ ano: h.getUTCFullYear(), mes: h.getUTCMonth() })
    setDiaSelecionado(isoDia(h))
  }

  return (
    <div>
      <div className="pl-section-head" style={{ marginTop: 0 }}>
        <div>
          <div className="pl-eyebrow">Rotina</div>
          <h2 className="pl-section-title">Agenda de trabalho</h2>
          <div className="pl-section-note" style={{ marginTop: 4 }}>
            {vejaEquipe ? 'Metas diárias, processos, auditorias e protocolos — cadastrados pra toda a equipe seguir' : 'Sua rotina do dia a dia'}
          </div>
        </div>
        {vejaEquipe && (
          <button type="button" className="pl-btn pl-btn-primary" onClick={abrirNovoItem}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Novo item
          </button>
        )}
      </div>

      <div className="pl-kpi-grid" style={{ marginTop: 16 }}>
        <div className="pl-kpi" style={{ ['--k-color' as string]: 'var(--pl-accent)' }}>
          <div className="pl-kpi-label">Hoje</div>
          <div className="pl-kpi-value">{meusConcluidosHoje}/{meusItensHoje.length}<span className="pl-unit">concluídos</span></div>
        </div>
        {vejaEquipe && aderenciaEquipeHoje != null && (
          <div className="pl-kpi" style={{ ['--k-color' as string]: 'var(--pl-accent-3)' }}>
            <div className="pl-kpi-label">Aderência da equipe hoje</div>
            <div className="pl-kpi-value">{aderenciaEquipeHoje.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}<span className="pl-unit">%</span></div>
          </div>
        )}
      </div>

      <div className="pl-grid-2b" style={{ marginTop: 20 }}>
        <div className="pl-card">
          <div className="pl-card-head">
            <div className="pl-card-title">{MESES_LABEL[mesVisivel.mes]} {mesVisivel.ano}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" className="pl-icon-btn" onClick={mesAnterior} title="Mês anterior" aria-label="Mês anterior">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button type="button" className="pl-chip" onClick={irParaHoje}>Hoje</button>
              <button type="button" className="pl-icon-btn" onClick={proximoMes} title="Próximo mês" aria-label="Próximo mês">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          </div>
          <div className="pl-agenda-grid">
            {DIAS_SEMANA_LABEL.map(d => <div key={d} className="pl-agenda-weekday">{d}</div>)}
            {grid.map((dia, i) => {
              if (!dia) return <div key={`vazio-${i}`} className="pl-agenda-day empty" />
              const diaIso = isoDia(dia)
              const itensAplicaveis = meusItens.filter(item => itemAplicaNoDia(item, dia))
              const totalNoDia = itens.filter(item => item.ativo && itemAplicaNoDia(item, dia)).length
              const concluidosNoDia = itensAplicaveis.filter(item => foiConcluido(conclusoes, item.id, meuAutorId, diaIso)).length
              const status = itensAplicaveis.length === 0 ? null : concluidosNoDia === itensAplicaveis.length ? 'completo' : concluidosNoDia > 0 ? 'parcial' : 'pendente'
              return (
                <button
                  key={diaIso}
                  type="button"
                  className={`pl-agenda-day ${diaIso === diaSelecionado ? 'selected' : ''} ${diaIso === hojeIso ? 'today' : ''}`}
                  onClick={() => setDiaSelecionado(diaIso)}
                >
                  <span className="pl-agenda-day-num">{dia.getUTCDate()}</span>
                  {totalNoDia > 0 && <span className="pl-agenda-day-count">{totalNoDia}</span>}
                  {status && <span className={`pl-agenda-day-dot ${status}`} />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="pl-card">
          <div className="pl-card-title" style={{ textTransform: 'capitalize' }}>{rotuloDiaSelecionado}</div>
          {itensDoDiaSelecionado.length === 0 ? (
            <div className="pl-empty" style={{ padding: '30px 10px' }}>
              <div className="pl-emoji">🗒️</div>
              Nada agendado pra este dia.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {itensDoDiaSelecionado.map(item => {
                const souAlvo = itemAplicaPara(item, meuVendedorId, isDono)
                const euConcluido = foiConcluido(conclusoes, item.id, meuAutorId, diaSelecionado)
                let resumoEquipe: string | null = null
                if (vejaEquipe) {
                  const alvos = alvosDoItem(item)
                  const temAlvo = alvos.length > 0 || item.incluiDono
                  if (!temAlvo) {
                    const feitos = vendedoresAtivos.filter(v => foiConcluido(conclusoes, item.id, v.id, diaSelecionado)).length
                    resumoEquipe = vendedoresAtivos.length > 0 ? `${feitos} de ${vendedoresAtivos.length} vendedores concluíram` : null
                  } else {
                    const partes: string[] = []
                    if (item.incluiDono && !isDono) {
                      const concluiu = foiConcluido(conclusoes, item.id, item.usuarioId, diaSelecionado)
                      partes.push(`${ROTULO_DONO}: ${concluiu ? 'concluído' : 'pendente'}`)
                    }
                    for (const id of alvos.filter(id => id !== meuVendedorId)) {
                      const nome = vendedores.find(v => v.id === id)?.nome ?? 'Vendedor'
                      const concluiu = foiConcluido(conclusoes, item.id, id, diaSelecionado)
                      partes.push(`${nome}: ${concluiu ? 'concluído' : 'pendente'}`)
                    }
                    resumoEquipe = partes.length > 0 ? partes.join(' · ') : null
                  }
                }
                return (
                  <div key={item.id} className="pl-agenda-item-card" style={{ ['--cat-cor' as string]: CATEGORIA_COR[item.categoria] }}>
                    <div className="pl-agenda-item-head">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="pl-agenda-item-badge">{CATEGORIA_LABEL[item.categoria]}</span>
                          {item.horario && <span className="pl-kanban-card-time">{item.horario}</span>}
                        </div>
                        <div className="pl-agenda-item-title">{item.titulo}</div>
                      </div>
                      {vejaEquipe && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button type="button" className="pl-kanban-icon-btn" onClick={() => abrirEdicaoItem(item)} title="Editar" aria-label="Editar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                          </button>
                          <button type="button" className="pl-kanban-icon-btn pl-danger" onClick={() => removerItem(item)} title="Remover" aria-label="Remover">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                          </button>
                        </div>
                      )}
                    </div>
                    {item.descricao && <div className="pl-kanban-card-meta" style={{ marginTop: 4 }}>{item.descricao}</div>}
                    <div className="pl-kanban-card-meta" style={{ marginTop: 4 }}>
                      {alvoLabel(item, vendedores, vejaEquipe)}
                      {item.tipo === 'RECORRENTE' ? ' · recorrente' : ' · data única'}
                    </div>
                    {resumoEquipe && <div className="pl-kanban-card-meta">{resumoEquipe}</div>}
                    {souAlvo && (
                      <button type="button" className={`pl-agenda-toggle-btn ${euConcluido ? 'done' : ''}`} onClick={() => alternarConclusao(item, diaSelecionado)}>
                        {euConcluido ? (
                          <><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg> Concluído</>
                        ) : 'Marcar como feito'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {vejaEquipe && (
        <div className="pl-card" style={{ marginTop: 20 }}>
          <div className="pl-card-head">
            <div>
              <div className="pl-card-title">Auditoria de aderência</div>
              <div className="pl-section-note" style={{ marginTop: 2 }}>Quem está cumprindo a própria rotina de trabalho no período.</div>
            </div>
            <div className="pl-period-row">
              <button type="button" className={`pl-chip ${periodoAuditoria === '7' ? 'active' : ''}`} onClick={() => setPeriodoAuditoria('7')}>7 dias</button>
              <button type="button" className={`pl-chip ${periodoAuditoria === '30' ? 'active' : ''}`} onClick={() => setPeriodoAuditoria('30')}>30 dias</button>
              <button type="button" className={`pl-chip ${periodoAuditoria === 'mes' ? 'active' : ''}`} onClick={() => setPeriodoAuditoria('mes')}>Este mês</button>
            </div>
          </div>
          {carregandoAuditoria ? (
            <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13, padding: '20px 0' }}>Carregando...</div>
          ) : auditoria.length === 0 ? (
            <div className="pl-empty" style={{ padding: '30px 10px' }}>
              <div className="pl-emoji">📋</div>
              Ninguém tem itens de agenda aplicáveis neste período.
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              {auditoria.map((p, i) => (
                <div key={p.id} className="pl-seller-row">
                  <div className={`pl-rank ${i === 0 ? 'top' : ''}`}>{i + 1}</div>
                  <div className="pl-seller-main">
                    <div className="pl-seller-top">
                      <div className="pl-seller-name">
                        <span className="pl-avatar" style={{ background: corAvatar(p.id) }}>{iniciais(p.nome)}</span>
                        {p.nome}
                      </div>
                      <div className="pl-seller-figs" style={{ color: corPct(p.pct) }}>{p.pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</div>
                    </div>
                    <div className="pl-bar-track"><div className="pl-bar-fill" style={{ width: `${p.pct}%`, background: corPct(p.pct) }} /></div>
                  </div>
                  <div className="pl-seller-meta">{p.feitos}/{p.total}<br />concluídos</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {vejaEquipe && itens.length > 0 && (
        <div className="pl-section-note" style={{ margin: '16px 0' }}>
          <span className="pl-leads-textlink" onClick={() => setMostrarTodos(m => !m)}>{mostrarTodos ? 'Ocultar' : 'Ver'} todos os itens cadastrados ({itens.length})</span>
        </div>
      )}

      {vejaEquipe && mostrarTodos && (
        <div className="pl-table-wrap">
          <table className="pl-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Categoria</th>
                <th>Horário</th>
                <th>Tipo</th>
                <th>Atribuído a</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {itens.map(item => (
                <tr key={item.id}>
                  <td>{item.titulo}</td>
                  <td>{CATEGORIA_LABEL[item.categoria]}</td>
                  <td>{item.horario ?? '—'}</td>
                  <td>{item.tipo === 'UNICO' ? `Único · ${item.data ? new Date(item.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}` : `Recorrente · ${(item.diasSemana ?? '').split(',').filter(Boolean).map(d => DIAS_SEMANA_LABEL[Number(d)]).join(', ')}`}</td>
                  <td>{alvoLabel(item, vendedores, true)}</td>
                  <td>{item.ativo ? 'Ativo' : 'Inativo'}</td>
                  <td className="pl-right">
                    <span className="pl-link-action" style={{ marginRight: 14 }} onClick={() => abrirEdicaoItem(item)}>Editar</span>
                    <span className="pl-link-action" style={{ marginRight: 14 }} onClick={() => alternarAtivo(item)}>{item.ativo ? 'Desativar' : 'Ativar'}</span>
                    <span className="pl-link-action pl-danger" onClick={() => removerItem(item)}>Remover</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <div className="pl-modal-backdrop" onClick={fecharModal}>
          <form onSubmit={salvarItem} className="pl-card pl-modal-panel" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="pl-card-title" style={{ marginBottom: 14 }}>{editandoId ? 'Editar item da agenda' : 'Novo item da agenda'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="pl-field">
                <label>Título</label>
                <input className="pl-input" autoFocus value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Conferir caixa do dia" required minLength={2} />
              </div>
              <div className="pl-field">
                <label>Descrição (opcional)</label>
                <input className="pl-input" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes do processo/protocolo" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="pl-field">
                  <label>Categoria</label>
                  <select className="pl-select" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value as AgendaCategoria }))}>
                    {AGENDA_CATEGORIAS.map(c => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
                  </select>
                </div>
                <div className="pl-field">
                  <label>Horário (opcional)</label>
                  <input type="time" className="pl-input" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))} />
                </div>
              </div>
              <div className="pl-field">
                <label>Atribuído a</label>
                <div className="pl-period-row">
                  <button type="button" className={`pl-chip ${form.alvoModo === 'TODOS' ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, alvoModo: 'TODOS' }))}>Toda a equipe</button>
                  <button type="button" className={`pl-chip ${form.alvoModo === 'ESPECIFICO' ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, alvoModo: 'ESPECIFICO' }))}>Pessoas específicas</button>
                </div>
              </div>
              {form.alvoModo === 'ESPECIFICO' && (
                <div className="pl-field">
                  <label>Selecione quem (pode marcar mais de uma pessoa)</label>
                  <div className="pl-period-row">
                    <button type="button" className={`pl-chip ${form.alvoIncluiDono ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, alvoIncluiDono: !f.alvoIncluiDono }))}>{ROTULO_DONO}</button>
                    {vendedores.map(v => (
                      <button key={v.id} type="button" className={`pl-chip ${form.alvoVendedorIds.includes(v.id) ? 'active' : ''}`} onClick={() => alternarAlvoVendedor(v.id)}>{v.nome}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="pl-field">
                <label>Repetição</label>
                <div className="pl-period-row">
                  <button type="button" className={`pl-chip ${form.tipo === 'RECORRENTE' ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, tipo: 'RECORRENTE' }))}>Recorrente</button>
                  <button type="button" className={`pl-chip ${form.tipo === 'UNICO' ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, tipo: 'UNICO' }))}>Data única</button>
                </div>
              </div>
              {form.tipo === 'UNICO' ? (
                <div className="pl-field">
                  <label>Data</label>
                  <input type="date" className="pl-input" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />
                </div>
              ) : (
                <>
                  <div className="pl-field">
                    <label>Dias da semana</label>
                    <div className="pl-period-row">
                      {DIAS_SEMANA_LABEL.map((d, i) => (
                        <button key={d} type="button" className={`pl-chip ${form.diasSemana.includes(i) ? 'active' : ''}`} onClick={() => alternarDiaSemana(i)}>{d}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="pl-field">
                      <label>A partir de (opcional)</label>
                      <input type="date" className="pl-input" value={form.dataInicio} onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))} />
                    </div>
                    <div className="pl-field">
                      <label>Até (opcional)</label>
                      <input type="date" className="pl-input" value={form.dataFim} onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}
            </div>
            {erro && <div className="pl-alert pl-alert-error" style={{ marginTop: 14 }}>{erro}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" className="pl-btn pl-btn-primary" disabled={salvando}>{salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Adicionar item'}</button>
              <button type="button" className="pl-btn pl-btn-ghost" onClick={fecharModal}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
