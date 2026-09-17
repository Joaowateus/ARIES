'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  proLaboreApi, AgendaItem, AgendaConclusao, AgendaInicio, AgendaCategoria, AgendaTipoItem, AGENDA_CATEGORIAS, Vendedor,
  ParametroLiquidez, EfetividadeVendedor,
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

function foiIniciado(inicios: AgendaInicio[], itemId: string, autorId: string, diaIso: string): boolean {
  return inicios.some(c => c.agendaItemId === itemId && c.autorId === autorId && c.dataReferencia.slice(0, 10) === diaIso)
}

type PeriodoAuditoria = 'hoje' | '7' | '30' | 'mes'

function rangeAuditoria(periodo: PeriodoAuditoria): { inicio: Date; fim: Date } {
  const hoje = hojeUTC()
  if (periodo === 'hoje') return { inicio: hoje, fim: hoje }
  if (periodo === 'mes') {
    return { inicio: new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1)), fim: hoje }
  }
  const inicio = new Date(hoje)
  inicio.setUTCDate(inicio.getUTCDate() - (periodo === '7' ? 6 : 29))
  return { inicio, fim: hoje }
}

// Janela imediatamente anterior à selecionada, com a mesma duração — não é
// um filtro paralelo, é só o espelho do período atual pra comparação.
function rangeAnterior(periodo: PeriodoAuditoria): { inicio: Date; fim: Date } {
  const { inicio } = rangeAuditoria(periodo)
  const fimAnterior = new Date(inicio)
  fimAnterior.setUTCDate(fimAnterior.getUTCDate() - 1)
  const duracaoDias = periodo === 'hoje' ? 1 : periodo === '7' ? 7 : periodo === '30' ? 30 : (fimAnterior.getTime() - inicio.getTime()) / 86400000 + 1
  const inicioAnterior = new Date(fimAnterior)
  inicioAnterior.setUTCDate(inicioAnterior.getUTCDate() - (duracaoDias - 1))
  return { inicio: inicioAnterior, fim: fimAnterior }
}

// Prende um dia ISO dentro dos limites do período — usado pra timeline da
// aba Individual nunca cair fora da janela carregada (ex: trocar de "7
// dias" pra "Hoje" com um dia antigo ainda selecionado).
function clampDia(diaIso: string, inicio: Date, fim: Date): string {
  if (diaIso < isoDia(inicio)) return isoDia(inicio)
  if (diaIso > isoDia(fim)) return isoDia(fim)
  return diaIso
}

type StatusConclusao = 'PENDENTE' | 'NO_PRAZO' | 'ATRASADO' | 'SEM_HORARIO'

// Prazo do item nesse dia, convertido pro UTC assumindo horário de Brasília
// (UTC-3, fixo, sem horário de verão) — mesma convenção já usada no backend
// (horaBrasilia, em proLabore.ts) pra tudo que envolve hora do dia.
function prazoUTC(dia: Date, horario: string): Date | null {
  const m = /^(\d{2}):(\d{2})$/.exec(horario)
  if (!m) return null
  return new Date(Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate(), Number(m[1]) + 3, Number(m[2])))
}

// Cruza a conclusão (quando existe) com o horário do item pra dizer se foi
// feito no prazo ou atrasado, e por quanto tempo — concluidoEm é o instante
// real em que a pessoa marcou "feito" (setado pelo backend), não o dia de
// referência, então dá pra comparar contra o prazo com precisão de minuto.
function statusConclusao(conclusoes: AgendaConclusao[], item: AgendaItem, autorId: string, dia: Date): { status: StatusConclusao; atrasoMin: number | null; conclusao: AgendaConclusao | null } {
  const diaIso = isoDia(dia)
  const c = conclusoes.find(c => c.agendaItemId === item.id && c.autorId === autorId && c.dataReferencia.slice(0, 10) === diaIso) ?? null
  if (!c) return { status: 'PENDENTE', atrasoMin: null, conclusao: null }
  const prazo = item.horario ? prazoUTC(dia, item.horario) : null
  if (!prazo) return { status: 'SEM_HORARIO', atrasoMin: null, conclusao: c }
  const diffMin = (new Date(c.concluidoEm).getTime() - prazo.getTime()) / 60000
  if (diffMin <= 0) return { status: 'NO_PRAZO', atrasoMin: null, conclusao: c }
  return { status: 'ATRASADO', atrasoMin: Math.round(diffMin), conclusao: c }
}

function formatAtraso(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const resto = min % 60
  return resto > 0 ? `${h}h${String(resto).padStart(2, '0')}` : `${h}h`
}

// Limiares configuráveis em Configurações (ParametroLiquidez) — nada disso
// é mais fixo no código. bom/atencao seguem sempre limiarBom > limiarAtencao.
function statusEquipe(pct: number, limiarBom: number, limiarAtencao: number): { label: string; classe: 'bom' | 'atencao' | 'critico' } {
  if (pct >= limiarBom) return { label: 'Em dia', classe: 'bom' }
  if (pct >= limiarAtencao) return { label: 'Atenção', classe: 'atencao' }
  return { label: 'Crítico', classe: 'critico' }
}

// ===== Efetividade, consistência e classificação (matriz 2x2 aderência x
// efetividade) — camada adicional sobre os dados já existentes: aderência
// vem da Agenda (AgendaConclusao), efetividade vem do funil de Leads
// (LeadEstagioHistorico, via /agenda/efetividade). Nenhuma tabela nova. =====

type Perfil = 'REFERENCIA' | 'ESTAVEL_SEM_SUBSTANCIA' | 'OSCILANTE' | 'OCIOSO' | 'INCONSISTENTE'

const PERFIL_LABEL: Record<Perfil, string> = {
  REFERENCIA: 'Referência',
  ESTAVEL_SEM_SUBSTANCIA: 'Estável sem substância',
  OSCILANTE: 'Oscilante',
  OCIOSO: 'Ocioso',
  INCONSISTENTE: 'Inconsistente',
}

const PERFIL_COR: Record<Perfil, string> = {
  REFERENCIA: 'var(--pl-good)',
  ESTAVEL_SEM_SUBSTANCIA: 'var(--pl-accent-4)',
  OSCILANTE: 'var(--pl-accent-5)',
  OCIOSO: 'var(--pl-accent-2)',
  INCONSISTENTE: 'var(--pl-critical)',
}

// Coeficiente de variação (desvio padrão ÷ média, em %) — precisa de pelo
// menos 2 pontos com produção real (dias sem nenhum item aplicável não
// entram, senão um "0%" artificial distorceria a variação).
function coeficienteVariacao(valores: number[]): number | null {
  if (valores.length < 2) return null
  const media = valores.reduce((s, v) => s + v, 0) / valores.length
  if (media === 0) return null
  const variancia = valores.reduce((s, v) => s + (v - media) ** 2, 0) / valores.length
  return (Math.sqrt(variancia) / media) * 100
}

// Maior sequência de dias (com item aplicável) seguidos abaixo do limiar de
// alerta — dias sem nada aplicável não contam nem quebram a sequência.
function maiorSequenciaAbaixoDe(valoresOrdenados: number[], limiar: number): number {
  let maior = 0
  let atual = 0
  for (const v of valoresOrdenados) {
    if (v < limiar) { atual += 1; maior = Math.max(maior, atual) }
    else atual = 0
  }
  return maior
}

// Aproximação de "semanas seguidas" a partir dos dias com produção real,
// em blocos de até 7 (não necessariamente semana-calendário) — pra achar
// quantos blocos mais recentes tiveram aderência média acima do limiar
// "bom", sem precisar de uma nova granularidade de período.
function blocosRecentesAcimaDe(valoresOrdenados: number[], limiar: number): number {
  if (valoresOrdenados.length === 0) return 0
  const blocos: number[] = []
  let i = valoresOrdenados.length
  while (i > 0) {
    const inicio = Math.max(0, i - 7)
    const bloco = valoresOrdenados.slice(inicio, i)
    blocos.push(bloco.reduce((s, v) => s + v, 0) / bloco.length)
    i = inicio
  }
  let streak = 0
  for (const media of blocos) {
    if (media >= limiar) streak++
    else break
  }
  return streak
}

// Prioridade da classificação: oscilação alta domina (é o padrão "ótimo numa
// semana, sumido noutra" que o badge único não capturava); depois aderência
// baixa e esporádica vira "Inconsistente"; aderência baixa mas estável vira
// "Ocioso"; aderência alta se separa só por efetividade (Referência vs.
// Estável sem substância). efetividade null (sem lead abordado no período)
// não penaliza — vira "alta" por omissão, pra não confundir "sem dado" com
// "não converte".
function classificarPerfil(params: {
  aderenciaPct: number
  efetividadePct: number | null
  oscilacaoPct: number | null
  limiarBom: number
  limiarEfetividadeAlta: number
  limiarOscilacao: number
}): Perfil {
  const { aderenciaPct, efetividadePct, oscilacaoPct, limiarBom, limiarEfetividadeAlta, limiarOscilacao } = params
  const efetividadeAlta = efetividadePct == null || efetividadePct >= limiarEfetividadeAlta
  const oscilaMuito = oscilacaoPct != null && oscilacaoPct >= limiarOscilacao
  const aderenciaAlta = aderenciaPct >= limiarBom

  if (oscilaMuito && aderenciaAlta) return 'OSCILANTE'
  if (!aderenciaAlta && oscilaMuito) return 'INCONSISTENTE'
  if (!aderenciaAlta) return 'OCIOSO'
  return efetividadeAlta ? 'REFERENCIA' : 'ESTAVEL_SEM_SUBSTANCIA'
}

// --pl-accent fica de fora: inverte de claro pra escuro entre os temas, e
// o texto do avatar é branco fixo — os outros 5 tokens formam a "família
// cinza/prata/dourado" da paleta, sempre escuros o bastante pro contraste.
const AVATAR_CORES_AUDITORIA = ['var(--pl-accent-3)', 'var(--pl-accent-4)', 'var(--pl-accent-5)', 'var(--pl-accent-2)', 'var(--pl-accent-6)']

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

function corPct(pct: number, limiarBom: number, limiarAtencao: number): string {
  if (pct >= limiarBom) return 'var(--pl-good)'
  if (pct >= limiarAtencao) return 'var(--pl-accent-4)'
  return 'var(--pl-critical)'
}

// Resumo em texto direto — em vez de obrigar quem audita a interpretar
// 4-5 números crus lado a lado, a linha já entrega o diagnóstico pronto.
// Os números continuam disponíveis, só que na aba individual da pessoa.
function diagnosticoPessoa(p: { perfil: Perfil; emAlerta: boolean; destaque: boolean }): string {
  const base: Record<Perfil, string> = {
    REFERENCIA: 'Cumpre a rotina e converte bem — referência da equipe.',
    ESTAVEL_SEM_SUBSTANCIA: 'Cumpre a rotina, mas converte pouco — abaixo da meta de efetividade.',
    OSCILANTE: 'Rendimento instável: ótimo em alguns dias, ausente em outros.',
    OCIOSO: 'Aderência baixa e estável — não está acompanhando a rotina.',
    INCONSISTENTE: 'Aderência baixa e imprevisível — pede atenção redobrada.',
  }
  let texto = base[p.perfil]
  if (p.emAlerta) texto += ' Em alerta agora.'
  else if (p.destaque) texto += ' Merece reconhecimento.'
  return texto
}

function media(valores: number[]): number | null {
  return valores.length > 0 ? valores.reduce((s, v) => s + v, 0) / valores.length : null
}

type Heatmap = { horarios: string[]; grade: Map<string, { total: number; feitos: number }[]> }

// Grade horário x dia da semana — reaproveitada tanto na Auditoria (com
// seletor de pessoa/equipe) quanto na aba Individual (sempre travada na
// pessoa aberta), pra não duplicar a marcação de 40+ linhas duas vezes.
function HeatmapGrid({ heatmap }: { heatmap: Heatmap }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `72px repeat(7, minmax(52px, 1fr))`, gap: 3, minWidth: 460 }}>
        <div />
        {DIAS_SEMANA_LABEL.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--pl-ink-muted)', fontWeight: 700 }}>{d}</div>
        ))}
        {heatmap.horarios.map(horario => (
          <div key={horario} style={{ display: 'contents' }}>
            <div style={{ fontSize: 11, color: 'var(--pl-ink-muted)', display: 'flex', alignItems: 'center' }}>{horario}</div>
            {heatmap.grade.get(horario)!.map((celula, diaSemana) => {
              const pct = celula.total > 0 ? (celula.feitos / celula.total) * 100 : null
              return (
                <div
                  key={diaSemana}
                  title={celula.total > 0 ? `${DIAS_SEMANA_LABEL[diaSemana]} ${horario}: ${celula.feitos}/${celula.total} (${pct!.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%)` : 'Sem item aplicável'}
                  style={{
                    height: 30, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: 'var(--pl-ink-1)',
                    background: pct != null ? `color-mix(in srgb, var(--pl-good) ${pct}%, var(--pl-critical))` : 'var(--pl-surface)',
                    opacity: pct != null ? 0.28 + (pct / 100) * 0.55 : 0.4,
                    border: pct == null ? '1px dashed var(--pl-border)' : 'none',
                  }}
                >
                  {pct != null ? `${Math.round(pct)}` : ''}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
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
  exigeLocalizacao: boolean
}

const FORM_VAZIO: FormAgenda = {
  titulo: '', descricao: '', categoria: 'META', tipo: 'RECORRENTE', data: '',
  diasSemana: [1, 2, 3, 4, 5], dataInicio: '', dataFim: '', horario: '',
  alvoModo: 'TODOS', alvoIncluiDono: false, alvoVendedorIds: [], exigeLocalizacao: false,
}

// Selo pontual de localização — uma leitura só, no instante do check-in,
// nunca rastreamento contínuo (sem watchPosition). Resolve `null` em vez de
// rejeitar quando a permissão é negada ou o navegador não suporta: a
// conclusão continua valendo, só sem o selo.
function obterLocalizacaoPontual(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    )
  })
}

function linkMapa(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`
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
  const [inicios, setInicios] = useState<AgendaInicio[]>([])
  const [loading, setLoading] = useState(true)

  const [mesVisivel, setMesVisivel] = useState(() => { const h = hojeUTC(); return { ano: h.getUTCFullYear(), mes: h.getUTCMonth() } })
  const [diaSelecionado, setDiaSelecionado] = useState(() => isoDia(hojeUTC()))

  // Abas isoladas — minha agenda pessoal, auditoria da equipe, drill-down
  // de uma pessoa e cadastro de rotinas nunca mais compartilham o mesmo
  // scroll. Só existe seletor de aba pra quem enxerga a equipe; vendedor
  // sempre vê só a própria rotina (não tem outra aba pra ele).
  type Aba = 'ROTINA' | 'AUDITORIA' | 'INDIVIDUAL' | 'CADASTRO'
  const [abaAtiva, setAbaAtiva] = useState<Aba>('AUDITORIA')

  const [periodoAuditoria, setPeriodoAuditoria] = useState<PeriodoAuditoria>('hoje')
  const [conclusoesAuditoria, setConclusoesAuditoria] = useState<AgendaConclusao[]>([])
  const [iniciosAuditoria, setIniciosAuditoria] = useState<AgendaInicio[]>([])
  const [carregandoAuditoria, setCarregandoAuditoria] = useState(false)
  const [parametro, setParametro] = useState<ParametroLiquidez | null>(null)
  const [efetividade, setEfetividade] = useState<EfetividadeVendedor[]>([])
  // Efetividade do período imediatamente anterior (mesma duração) — usada
  // só pra "queda de efetividade vs. média móvel do consultor" na regra de
  // alerta. Não é um filtro novo, é sempre o espelho do período selecionado.
  const [efetividadeAnterior, setEfetividadeAnterior] = useState<EfetividadeVendedor[]>([])

  const [modalAberto, setModalAberto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState<FormAgenda>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Heatmap: "equipe" mostra a média de todo mundo; escolher uma pessoa
  // troca pro heatmap individual dela, sem sair do período selecionado.
  // Sincronizado com a pessoa aberta na aba Individual (ver useEffect abaixo).
  const [heatmapPessoaId, setHeatmapPessoaId] = useState<string>('equipe')

  // Aba Individual: quem está sendo analisado e o dia aberto na timeline
  // dela — clicar num nome no ranking da Auditoria leva pra cá.
  const [individualId, setIndividualId] = useState<string | null>(null)
  const [diaIndividual, setDiaIndividual] = useState<string | null>(null)

  function carregarItens() {
    return proLaboreApi.agenda.itens.listar().then(setItens)
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      carregarItens(),
      vejaEquipe ? proLaboreApi.vendedores.listar().then(setVendedores) : Promise.resolve(),
      vejaEquipe ? proLaboreApi.parametros.get().then(setParametro) : Promise.resolve(),
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
    proLaboreApi.agenda.inicios.listar(isoDia(inicio), isoDia(fim)).then(setInicios)
  }, [mesVisivel.ano, mesVisivel.mes])

  // Auditoria de aderência: período independente do mês visível no
  // calendário, só carregado (e usado) por quem enxerga a equipe.
  useEffect(() => {
    if (!vejaEquipe) return
    const { inicio, fim } = rangeAuditoria(periodoAuditoria)
    const anterior = rangeAnterior(periodoAuditoria)
    setCarregandoAuditoria(true)
    Promise.all([
      proLaboreApi.agenda.conclusoes.listar(isoDia(inicio), isoDia(fim)).then(setConclusoesAuditoria),
      proLaboreApi.agenda.inicios.listar(isoDia(inicio), isoDia(fim)).then(setIniciosAuditoria),
      proLaboreApi.agenda.efetividade.listar(isoDia(inicio), isoDia(fim)).then(setEfetividade),
      proLaboreApi.agenda.efetividade.listar(isoDia(anterior.inicio), isoDia(anterior.fim)).then(setEfetividadeAnterior),
    ]).finally(() => setCarregandoAuditoria(false))
  }, [vejaEquipe, periodoAuditoria])

  const meusItens = useMemo(() => itens.filter(i => itemAplicaPara(i, meuVendedorId, isDono)), [itens, meuVendedorId, isDono])

  const hojeIso = isoDia(hojeUTC())
  const meusItensHoje = useMemo(() => meusItens.filter(i => itemAplicaNoDia(i, hojeUTC())), [meusItens])
  const meusConcluidosHoje = meusItensHoje.filter(i => foiConcluido(conclusoes, i.id, meuAutorId, hojeIso)).length

  const vendedoresAtivos = vendedores.filter(v => v.ativo)
  const donoAutorId = itens[0]?.usuarioId

  // Ranking de auditoria no período selecionado: pra cada pessoa (dono
  // incluído, quando ele mesmo é alvo de algum item) soma quantos itens
  // aplicáveis existiram em cada dia do período, quantos foram concluídos,
  // e — pros que tinham horário marcado — quantos no prazo vs. atrasados
  // (e por quanto tempo, em média).
  const auditoria = useMemo(() => {
    if (!vejaEquipe) return []
    const { inicio, fim } = rangeAuditoria(periodoAuditoria)
    const donoAutorId = itens[0]?.usuarioId
    const pessoas: { id: string; nome: string; ehDono: boolean }[] = []
    if (donoAutorId) pessoas.push({ id: donoAutorId, nome: ROTULO_DONO, ehDono: true })
    for (const v of vendedoresAtivos) pessoas.push({ id: v.id, nome: v.nome, ehDono: false })

    const dias: Date[] = []
    for (const d = new Date(inicio); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) dias.push(new Date(d))

    const limiarBom = parametro?.agendaLimiarBomPct ?? 80
    const limiarEfetividadeAlta = parametro?.agendaLimiarEfetividadeAltaPct ?? 30
    const limiarOscilacao = parametro?.agendaLimiarOscilacaoPct ?? 35
    const alertaAderenciaPct = parametro?.agendaAlertaAderenciaPct ?? 50
    const alertaDiasConsecutivos = parametro?.agendaAlertaDiasConsecutivos ?? 3
    const alertaQuedaEfetividadePct = parametro?.agendaAlertaQuedaEfetividadePct ?? 30
    const reconhecimentoSemanas = parametro?.agendaReconhecimentoSemanas ?? 4

    return pessoas
      .map(p => {
        let total = 0
        let feitos = 0
        let noPrazo = 0
        let atrasado = 0
        let somaAtrasoMin = 0
        let iniciados = 0
        const porDia: number[] = []
        for (const dia of dias) {
          const aplicaveis = itens.filter(i => itemAplicaPara(i, p.ehDono ? null : p.id, p.ehDono) && itemAplicaNoDia(i, dia))
          if (aplicaveis.length === 0) continue
          let totalDia = 0
          let feitosDia = 0
          for (const item of aplicaveis) {
            total += 1
            totalDia += 1
            const { status, atrasoMin } = statusConclusao(conclusoesAuditoria, item, p.id, dia)
            // Concluído sem ter clicado "Iniciar" antes ainda conta como
            // iniciado — a atividade obviamente começou pra ter terminado.
            if (status !== 'PENDENTE' || foiIniciado(iniciosAuditoria, item.id, p.id, isoDia(dia))) iniciados += 1
            if (status === 'PENDENTE') continue
            feitos += 1
            feitosDia += 1
            if (status === 'NO_PRAZO') noPrazo += 1
            else if (status === 'ATRASADO') { atrasado += 1; somaAtrasoMin += atrasoMin ?? 0 }
          }
          porDia.push((feitosDia / totalDia) * 100)
        }

        const pct = total > 0 ? (feitos / total) * 100 : 0
        const oscilacaoPct = coeficienteVariacao(porDia)
        const diasConsecutivosAbaixo = maiorSequenciaAbaixoDe(porDia, alertaAderenciaPct)

        // Efetividade só existe pra quem tem Lead atribuído (vendedores) —
        // o dono não aparece no endpoint (Lead.vendedorId nunca é dele).
        const efet = p.ehDono ? undefined : efetividade.find(e => e.vendedorId === p.id)
        const efetAnterior = p.ehDono ? undefined : efetividadeAnterior.find(e => e.vendedorId === p.id)
        const efetividadePct = efet && efet.leadsAbordados > 0 ? efet.efetividadePct : null
        const quedaEfetividadePct = efetividadePct != null && efetAnterior && efetAnterior.leadsAbordados > 0
          ? ((efetAnterior.efetividadePct - efetividadePct) / efetAnterior.efetividadePct) * 100
          : null

        const perfil = classificarPerfil({ aderenciaPct: pct, efetividadePct, oscilacaoPct, limiarBom, limiarEfetividadeAlta, limiarOscilacao })
        const emAlerta = diasConsecutivosAbaixo >= alertaDiasConsecutivos || (quedaEfetividadePct != null && quedaEfetividadePct >= alertaQuedaEfetividadePct)
        const blocosSeguidos = blocosRecentesAcimaDe(porDia, limiarBom)
        // Só considera "destaque" quando o período tem histórico suficiente
        // pra avaliar de verdade N blocos — senão qualquer período curto
        // (Hoje/7 dias) apareceria como destaque só por falta de dado ruim.
        const destaque = porDia.length >= reconhecimentoSemanas * 7 && blocosSeguidos >= reconhecimentoSemanas
          && (efetividadePct == null || efetividadePct >= limiarEfetividadeAlta)

        return {
          id: p.id, nome: p.nome, total, feitos, iniciados, pct,
          noPrazo, atrasado, atrasoMedioMin: atrasado > 0 ? Math.round(somaAtrasoMin / atrasado) : null,
          efetividadePct, quedaEfetividadePct, oscilacaoPct, perfil, emAlerta, destaque,
        }
      })
      .filter(p => p.total > 0)
      .sort((a, b) => b.pct - a.pct)
  }, [vejaEquipe, periodoAuditoria, itens, vendedoresAtivos, conclusoesAuditoria, iniciosAuditoria, efetividade, efetividadeAnterior, parametro])

  // Funil de aderência da equipe no período: onde a rotina "fura" — quantas
  // atividades eram esperadas, quantas ao menos começaram, e quantas
  // terminaram dentro do prazo.
  const funilAderencia = useMemo(() => {
    const previstas = auditoria.reduce((s, p) => s + p.total, 0)
    const iniciadas = auditoria.reduce((s, p) => s + p.iniciados, 0)
    const concluidasNoPrazo = auditoria.reduce((s, p) => s + p.noPrazo, 0)
    return { previstas, iniciadas, concluidasNoPrazo }
  }, [auditoria])

  // Na aba Individual o heatmap trava sempre na pessoa aberta ali; na
  // Auditoria segue o seletor (heatmapPessoaId, que pode ser "equipe" ou
  // qualquer pessoa). Derivado direto, sem efeito sincronizando estado.
  const heatmapAlvo = abaAtiva === 'INDIVIDUAL' && individualId ? individualId : heatmapPessoaId

  // Heatmap horário x dia da semana: em que horário/dia a produção
  // historicamente cai — o mapeamento de ociosidade que o "atraso médio"
  // sozinho não mostrava. Linhas = horário configurado no item (itens sem
  // horário caem numa linha "Sem horário" à parte), colunas = dia da semana.
  const heatmap = useMemo(() => {
    if (!vejaEquipe) return null
    const { inicio, fim } = rangeAuditoria(periodoAuditoria)
    const donoAutorId = itens[0]?.usuarioId
    const dias: Date[] = []
    for (const d = new Date(inicio); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) dias.push(new Date(d))

    const pessoasAlvo = heatmapAlvo === 'equipe'
      ? auditoria.map(p => ({ id: p.id, ehDono: p.id === donoAutorId }))
      : auditoria.filter(p => p.id === heatmapAlvo).map(p => ({ id: p.id, ehDono: p.id === donoAutorId }))

    const grade = new Map<string, { total: number; feitos: number }[]>()
    for (const dia of dias) {
      const diaSemana = dia.getUTCDay()
      for (const pessoa of pessoasAlvo) {
        const aplicaveis = itens.filter(i => itemAplicaPara(i, pessoa.ehDono ? null : pessoa.id, pessoa.ehDono) && itemAplicaNoDia(i, dia))
        for (const item of aplicaveis) {
          const chave = item.horario ?? 'Sem horário'
          if (!grade.has(chave)) grade.set(chave, Array.from({ length: 7 }, () => ({ total: 0, feitos: 0 })))
          const linha = grade.get(chave)!
          linha[diaSemana].total += 1
          const { status } = statusConclusao(conclusoesAuditoria, item, pessoa.id, dia)
          if (status !== 'PENDENTE') linha[diaSemana].feitos += 1
        }
      }
    }

    const horarios = Array.from(grade.keys()).sort((a, b) => {
      if (a === 'Sem horário') return 1
      if (b === 'Sem horário') return -1
      return a.localeCompare(b)
    })
    return { horarios, grade }
  }, [vejaEquipe, periodoAuditoria, itens, auditoria, heatmapAlvo, conclusoesAuditoria])

  // Itens do dia aberto na timeline individual, previstos x realizados —
  // mesma lógica de status já usada no painel do dia selecionado, só que
  // pra uma pessoa específica em vez de "eu".
  const itensIndividual = useMemo(() => {
    if (!individualId || !diaIndividual) return []
    const ehDono = individualId === donoAutorId
    const { inicio, fim } = rangeAuditoria(periodoAuditoria)
    const dia = new Date(`${clampDia(diaIndividual, inicio, fim)}T00:00:00.000Z`)
    return itens
      .filter(i => itemAplicaPara(i, ehDono ? null : individualId, ehDono) && itemAplicaNoDia(i, dia))
      .map(item => ({ item, ...statusConclusao(conclusoesAuditoria, item, individualId, dia) }))
      .sort((a, b) => (a.item.horario ?? '99:99').localeCompare(b.item.horario ?? '99:99'))
  }, [individualId, diaIndividual, periodoAuditoria, donoAutorId, itens, conclusoesAuditoria])

  // Log completo de atrasos da pessoa no período — a "visão incisiva" que
  // faltava: cada ocorrência com data, item e por quanto atrasou, não só a
  // média. Reaproveita o mesmo laço de dias da auditoria, só que pra uma
  // pessoa só e guardando cada ocorrência em vez de só somar.
  const atrasosIndividual = useMemo(() => {
    if (!individualId) return []
    const ehDono = individualId === donoAutorId
    const { inicio, fim } = rangeAuditoria(periodoAuditoria)
    const dias: Date[] = []
    for (const d = new Date(inicio); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) dias.push(new Date(d))

    const ocorrencias: { dia: Date; item: AgendaItem; atrasoMin: number }[] = []
    for (const dia of dias) {
      const aplicaveis = itens.filter(i => itemAplicaPara(i, ehDono ? null : individualId, ehDono) && itemAplicaNoDia(i, dia))
      for (const item of aplicaveis) {
        const { status, atrasoMin } = statusConclusao(conclusoesAuditoria, item, individualId, dia)
        if (status === 'ATRASADO') ocorrencias.push({ dia, item, atrasoMin: atrasoMin ?? 0 })
      }
    }
    return ocorrencias.sort((a, b) => b.dia.getTime() - a.dia.getTime())
  }, [individualId, donoAutorId, periodoAuditoria, itens, conclusoesAuditoria])

  // Abrir a aba Individual sem ter clicado em ninguém ainda (ex: direto
  // pela aba) cai por padrão no topo do ranking, assim que ele carregar.
  useEffect(() => {
    if (abaAtiva === 'INDIVIDUAL' && !individualId && auditoria.length > 0) abrirIndividual(auditoria[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaAtiva, auditoria])

  // Resumo da equipe inteira no período — os números que respondem "como
  // estamos indo" antes mesmo de olhar pessoa por pessoa.
  const auditoriaResumo = useMemo(() => {
    if (auditoria.length === 0) return null
    const somaFeitos = auditoria.reduce((s, p) => s + p.feitos, 0)
    const somaTotal = auditoria.reduce((s, p) => s + p.total, 0)
    const somaNoPrazo = auditoria.reduce((s, p) => s + p.noPrazo, 0)
    const somaAtrasado = auditoria.reduce((s, p) => s + p.atrasado, 0)
    const comHorario = somaNoPrazo + somaAtrasado
    const emAlerta = auditoria.filter(p => p.emAlerta).length
    const destaques = auditoria.filter(p => p.destaque)
    return {
      aderenciaPct: somaTotal > 0 ? (somaFeitos / somaTotal) * 100 : 0,
      pctNoPrazo: comHorario > 0 ? (somaNoPrazo / comHorario) * 100 : null,
      atrasos: somaAtrasado,
      emAlerta,
      destaques,
    }
  }, [auditoria])

  async function alternarConclusao(item: AgendaItem, diaIso: string) {
    // Só busca localização ao MARCAR (não ao desmarcar) — uma leitura única
    // no instante do check-in, nunca rastreamento contínuo.
    const jaConcluido = foiConcluido(conclusoes, item.id, meuAutorId, diaIso)
    const localizacao = !jaConcluido && item.exigeLocalizacao ? await obterLocalizacaoPontual() ?? undefined : undefined
    const resultado = await proLaboreApi.agenda.itens.concluir(item.id, diaIso, localizacao)
    setConclusoes(atual => {
      const semEsse = atual.filter(c => !(c.agendaItemId === item.id && c.autorId === meuAutorId && c.dataReferencia.slice(0, 10) === diaIso))
      if (!resultado.concluido) return semEsse
      return [...semEsse, {
        id: `${item.id}-${meuAutorId}-${diaIso}`, agendaItemId: item.id, autorId: meuAutorId, dataReferencia: diaIso,
        concluidoEm: resultado.concluidoEm ?? new Date().toISOString(), latitude: resultado.latitude, longitude: resultado.longitude,
      }]
    })
  }

  async function alternarInicio(item: AgendaItem, diaIso: string) {
    const resultado = await proLaboreApi.agenda.itens.iniciar(item.id, diaIso)
    setInicios(atual => {
      const semEsse = atual.filter(c => !(c.agendaItemId === item.id && c.autorId === meuAutorId && c.dataReferencia.slice(0, 10) === diaIso))
      if (!resultado.iniciado) return semEsse
      return [...semEsse, { id: `${item.id}-${meuAutorId}-${diaIso}`, agendaItemId: item.id, autorId: meuAutorId, dataReferencia: diaIso, iniciadoEm: resultado.iniciadoEm ?? new Date().toISOString() }]
    })
  }

  function abrirIndividual(pessoa: { id: string }) {
    const { fim } = rangeAuditoria(periodoAuditoria)
    setIndividualId(pessoa.id)
    setDiaIndividual(isoDia(fim))
    setAbaAtiva('INDIVIDUAL')
  }

  function moverDiaIndividual(deltaDias: number) {
    setDiaIndividual(d => {
      if (!d) return d
      const { inicio, fim } = rangeAuditoria(periodoAuditoria)
      const novoDia = new Date(`${clampDia(d, inicio, fim)}T00:00:00.000Z`)
      novoDia.setUTCDate(novoDia.getUTCDate() + deltaDias)
      if (novoDia < inicio || novoDia > fim) return d
      return isoDia(novoDia)
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
      exigeLocalizacao: item.exigeLocalizacao,
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
        exigeLocalizacao: form.exigeLocalizacao,
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

  // Só quem vê a equipe navega entre abas — vendedor sempre cai direto na
  // própria rotina, que é a única coisa que ele tem pra ver por aqui.
  const abaEfetiva: Aba = vejaEquipe ? abaAtiva : 'ROTINA'
  const pessoaIndividual = auditoria.find(p => p.id === individualId) ?? null

  return (
    <div>
      <div className="pl-section-head" style={{ marginTop: 0 }}>
        <div>
          <div className="pl-eyebrow">Rotina</div>
          <h2 className="pl-section-title">Agenda de trabalho</h2>
          <div className="pl-section-note" style={{ marginTop: 4 }}>
            {vejaEquipe ? 'Sua agenda pessoal, a auditoria da equipe e o cadastro de rotinas — separados, cada um na sua aba' : 'Sua rotina do dia a dia'}
          </div>
        </div>
      </div>

      {vejaEquipe && (
        <div className="pl-period-row" style={{ marginTop: 16, marginBottom: 4 }}>
          <button type="button" className={`pl-chip ${abaAtiva === 'AUDITORIA' ? 'active' : ''}`} onClick={() => setAbaAtiva('AUDITORIA')}>📊 Auditoria da Equipe</button>
          <button type="button" className={`pl-chip ${abaAtiva === 'INDIVIDUAL' ? 'active' : ''}`} onClick={() => setAbaAtiva('INDIVIDUAL')}>🔍 Vendedor Individual</button>
          <button type="button" className={`pl-chip ${abaAtiva === 'ROTINA' ? 'active' : ''}`} onClick={() => setAbaAtiva('ROTINA')}>🗓️ Minha Rotina</button>
          <button type="button" className={`pl-chip ${abaAtiva === 'CADASTRO' ? 'active' : ''}`} onClick={() => setAbaAtiva('CADASTRO')}>⚙️ Rotinas Cadastradas</button>
        </div>
      )}

      {abaEfetiva === 'AUDITORIA' && (
        <div className="pl-card" style={{ marginTop: 16 }}>
          <div className="pl-card-head">
            <div>
              <div className="pl-card-title">Auditoria comercial da equipe</div>
              <div className="pl-section-note" style={{ marginTop: 2 }}>Quem está cumprindo a rotina — e no horário certo — nesse período.</div>
            </div>
            <div className="pl-period-row">
              <button type="button" className={`pl-chip ${periodoAuditoria === 'hoje' ? 'active' : ''}`} onClick={() => setPeriodoAuditoria('hoje')}>Hoje</button>
              <button type="button" className={`pl-chip ${periodoAuditoria === '7' ? 'active' : ''}`} onClick={() => setPeriodoAuditoria('7')}>7 dias</button>
              <button type="button" className={`pl-chip ${periodoAuditoria === '30' ? 'active' : ''}`} onClick={() => setPeriodoAuditoria('30')}>30 dias</button>
              <button type="button" className={`pl-chip ${periodoAuditoria === 'mes' ? 'active' : ''}`} onClick={() => setPeriodoAuditoria('mes')}>Este mês</button>
            </div>
          </div>

          {carregandoAuditoria ? (
            <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13, padding: '20px 0' }}>Carregando...</div>
          ) : auditoria.length === 0 || !auditoriaResumo ? (
            <div className="pl-empty" style={{ padding: '30px 10px' }}>
              <div className="pl-emoji">📋</div>
              Ninguém tem itens de agenda aplicáveis neste período.
            </div>
          ) : (
            <>
              <div className="pl-kpi-grid" style={{ marginTop: 4, marginBottom: 20 }}>
                <div className="pl-kpi" style={{ ['--k-color' as string]: 'var(--pl-accent-3)' }}>
                  <div className="pl-kpi-label">Aderência da equipe</div>
                  <div className="pl-kpi-value">{auditoriaResumo.aderenciaPct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}<span className="pl-unit">%</span></div>
                </div>
                <div className="pl-kpi" style={{ ['--k-color' as string]: 'var(--pl-good)' }}>
                  <div className="pl-kpi-label">Cumprido no prazo</div>
                  <div className="pl-kpi-value">{auditoriaResumo.pctNoPrazo != null ? auditoriaResumo.pctNoPrazo.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—'}<span className="pl-unit">{auditoriaResumo.pctNoPrazo != null ? '%' : 'sem itens c/ horário'}</span></div>
                </div>
                <div className="pl-kpi" style={{ ['--k-color' as string]: 'var(--pl-accent-4)' }}>
                  <div className="pl-kpi-label">Atrasos no período</div>
                  <div className="pl-kpi-value">{auditoriaResumo.atrasos}<span className="pl-unit">{auditoriaResumo.atrasos === 1 ? 'ocorrência' : 'ocorrências'}</span></div>
                </div>
                <div className="pl-kpi" style={{ ['--k-color' as string]: 'var(--pl-critical)' }}>
                  <div className="pl-kpi-label">Em alerta</div>
                  <div className="pl-kpi-value">{auditoriaResumo.emAlerta}<span className="pl-unit">{auditoriaResumo.emAlerta === 1 ? 'pessoa' : 'pessoas'}</span></div>
                </div>
              </div>

              {auditoriaResumo.destaques.length > 0 && (
                <div className="pl-alert pl-alert-success" style={{ marginBottom: 16 }}>
                  🏆 Destaque{auditoriaResumo.destaques.length > 1 ? 's' : ''}: {auditoriaResumo.destaques.map(p => p.nome).join(', ')} — perfil Referência sustentado há {parametro?.agendaReconhecimentoSemanas ?? 4}+ blocos seguidos nesse período. Bom momento pra um feedback positivo.
                </div>
              )}

              <div>
                {auditoria.map((p, i) => {
                  const limiarBom = parametro?.agendaLimiarBomPct ?? 80
                  const limiarAtencao = parametro?.agendaLimiarAtencaoPct ?? 50
                  const status = statusEquipe(p.pct, limiarBom, limiarAtencao)
                  return (
                    <div key={p.id} className="pl-seller-row" style={{ cursor: 'pointer' }} onClick={() => abrirIndividual(p)} title="Ver o detalhe individual dessa pessoa">
                      <div className={`pl-rank ${i === 0 ? 'top' : ''}`}>{i + 1}</div>
                      <div className="pl-seller-main">
                        <div className="pl-seller-top">
                          <div className="pl-seller-name">
                            <span className="pl-avatar" style={{ background: corAvatar(p.id) }}>{iniciais(p.nome)}</span>
                            {p.nome}
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: PERFIL_COR[p.perfil], display: 'inline-block' }} title={PERFIL_LABEL[p.perfil]} />
                            <span className={`pl-status-badge ${status.classe}`}>{status.label}</span>
                            {p.emAlerta && <span className="pl-status-badge critico">⚠ Alerta</span>}
                          </div>
                          <div className="pl-seller-figs" style={{ color: corPct(p.pct, limiarBom, limiarAtencao) }} title="Aderência (% da rotina cumprido)">{p.pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</div>
                        </div>
                        <div className="pl-bar-track"><div className="pl-bar-fill" style={{ width: `${p.pct}%`, background: corPct(p.pct, limiarBom, limiarAtencao) }} /></div>
                        <div style={{ fontSize: 12, color: 'var(--pl-ink-muted)', marginTop: 6 }}>{diagnosticoPessoa(p)}</div>
                      </div>
                      <div className="pl-seller-meta" style={{ alignSelf: 'center' }}>Ver detalhes →</div>
                    </div>
                  )
                })}
              </div>

              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--pl-border)' }}>
                <div className="pl-card-title" style={{ fontSize: 13.5 }}>Funil de aderência</div>
                <div className="pl-section-note" style={{ marginTop: 2, marginBottom: 12 }}>Onde a rotina da equipe “fura” — previstas → iniciadas → concluídas no prazo</div>
                {[
                  { rotulo: 'Previstas', valor: funilAderencia.previstas, cor: 'var(--pl-accent-3)' },
                  { rotulo: 'Iniciadas', valor: funilAderencia.iniciadas, cor: 'var(--pl-accent-4)' },
                  { rotulo: 'Concluídas no prazo', valor: funilAderencia.concluidasNoPrazo, cor: 'var(--pl-good)' },
                ].map((estagio, i, arr) => {
                  const pctDoTotal = arr[0].valor > 0 ? (estagio.valor / arr[0].valor) * 100 : 0
                  const pctDoAnterior = i > 0 && arr[i - 1].valor > 0 ? (estagio.valor / arr[i - 1].valor) * 100 : null
                  return (
                    <div key={estagio.rotulo} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                        <span style={{ color: 'var(--pl-ink-2)' }}>{estagio.rotulo}</span>
                        <span className="pl-mono" style={{ color: 'var(--pl-ink-1)' }}>
                          {estagio.valor}
                          {pctDoAnterior != null && <span style={{ color: 'var(--pl-ink-muted)' }}> ({pctDoAnterior.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% da etapa anterior)</span>}
                        </span>
                      </div>
                      <div className="pl-bar-track"><div className="pl-bar-fill" style={{ width: `${pctDoTotal}%`, background: estagio.cor }} /></div>
                    </div>
                  )
                })}
              </div>

              {heatmap && heatmap.horarios.length > 0 && (
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--pl-border)' }}>
                  <div className="pl-card-head" style={{ marginBottom: 10 }}>
                    <div>
                      <div className="pl-card-title" style={{ fontSize: 13.5 }}>Heatmap horário × dia da semana</div>
                      <div className="pl-section-note" style={{ marginTop: 2 }}>Em que horário/dia a produção historicamente cai ou desaparece</div>
                    </div>
                    <select className="pl-select" value={heatmapPessoaId} onChange={e => setHeatmapPessoaId(e.target.value)} style={{ maxWidth: 200 }}>
                      <option value="equipe">Equipe (todos)</option>
                      {auditoria.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                  <HeatmapGrid heatmap={heatmap} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {abaEfetiva === 'INDIVIDUAL' && (
        <div className="pl-card" style={{ marginTop: 16 }}>
          <div className="pl-card-head">
            <div>
              <div className="pl-card-title">Vendedor Individual</div>
              <div className="pl-section-note" style={{ marginTop: 2 }}>Drill-down de uma pessoa por vez — atrasos, produção e eficiência em detalhe.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <select className="pl-select" value={individualId ?? ''} onChange={e => abrirIndividual({ id: e.target.value })} style={{ maxWidth: 200 }}>
                {auditoria.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <div className="pl-period-row">
                <button type="button" className={`pl-chip ${periodoAuditoria === 'hoje' ? 'active' : ''}`} onClick={() => setPeriodoAuditoria('hoje')}>Hoje</button>
                <button type="button" className={`pl-chip ${periodoAuditoria === '7' ? 'active' : ''}`} onClick={() => setPeriodoAuditoria('7')}>7 dias</button>
                <button type="button" className={`pl-chip ${periodoAuditoria === '30' ? 'active' : ''}`} onClick={() => setPeriodoAuditoria('30')}>30 dias</button>
                <button type="button" className={`pl-chip ${periodoAuditoria === 'mes' ? 'active' : ''}`} onClick={() => setPeriodoAuditoria('mes')}>Este mês</button>
              </div>
            </div>
          </div>

          {carregandoAuditoria ? (
            <div style={{ color: 'var(--pl-ink-muted)', fontSize: 13, padding: '20px 0' }}>Carregando...</div>
          ) : !pessoaIndividual ? (
            <div className="pl-empty" style={{ padding: '30px 10px' }}>
              <div className="pl-emoji">🔍</div>
              Ninguém tem itens de agenda aplicáveis neste período.
            </div>
          ) : (() => {
            const limiarBom = parametro?.agendaLimiarBomPct ?? 80
            const limiarAtencao = parametro?.agendaLimiarAtencaoPct ?? 50
            const status = statusEquipe(pessoaIndividual.pct, limiarBom, limiarAtencao)
            const mediaAderencia = media(auditoria.map(p => p.pct))
            const mediaEfetividade = media(auditoria.map(p => p.efetividadePct).filter((v): v is number => v != null))
            const mediaAtraso = media(auditoria.map(p => p.atrasoMedioMin).filter((v): v is number => v != null))
            const mediaOscilacao = media(auditoria.map(p => p.oscilacaoPct).filter((v): v is number => v != null))
            const { inicio: inicioPeriodo, fim: fimPeriodo } = rangeAuditoria(periodoAuditoria)
            const diaAtual = diaIndividual ? new Date(`${clampDia(diaIndividual, inicioPeriodo, fimPeriodo)}T00:00:00.000Z`) : null
            return (
              <>
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span className="pl-avatar" style={{ background: corAvatar(pessoaIndividual.id), width: 40, height: 40, fontSize: 15 }}>{iniciais(pessoaIndividual.nome)}</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{pessoaIndividual.nome}</span>
                      <span className={`pl-status-badge ${status.classe}`}>{status.label}</span>
                      <span className="pl-status-badge" style={{ color: PERFIL_COR[pessoaIndividual.perfil], background: `color-mix(in srgb, ${PERFIL_COR[pessoaIndividual.perfil]} 14%, transparent)` }}>{PERFIL_LABEL[pessoaIndividual.perfil]}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--pl-ink-muted)', marginTop: 2 }}>{diagnosticoPessoa(pessoaIndividual)}</div>
                  </div>
                </div>

                <div className="pl-kpi-grid" style={{ marginTop: 16, marginBottom: 20 }}>
                  <div className="pl-kpi" style={{ ['--k-color' as string]: 'var(--pl-accent-3)' }}>
                    <div className="pl-kpi-label">Aderência</div>
                    <div className="pl-kpi-value">{pessoaIndividual.pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}<span className="pl-unit">%</span></div>
                    {mediaAderencia != null && <div className="pl-section-note" style={{ marginTop: 4 }}>equipe: {mediaAderencia.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</div>}
                  </div>
                  <div className="pl-kpi" style={{ ['--k-color' as string]: 'var(--pl-good)' }}>
                    <div className="pl-kpi-label">Efetividade</div>
                    <div className="pl-kpi-value">{pessoaIndividual.efetividadePct != null ? pessoaIndividual.efetividadePct.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—'}<span className="pl-unit">{pessoaIndividual.efetividadePct != null ? '%' : 'sem leads abordados'}</span></div>
                    {mediaEfetividade != null && <div className="pl-section-note" style={{ marginTop: 4 }}>equipe: {mediaEfetividade.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</div>}
                  </div>
                  <div className="pl-kpi" style={{ ['--k-color' as string]: 'var(--pl-accent-4)' }}>
                    <div className="pl-kpi-label">Atraso médio</div>
                    <div className="pl-kpi-value">{pessoaIndividual.atrasoMedioMin != null ? formatAtraso(pessoaIndividual.atrasoMedioMin) : '—'}</div>
                    {mediaAtraso != null && <div className="pl-section-note" style={{ marginTop: 4 }}>equipe: {formatAtraso(Math.round(mediaAtraso))}</div>}
                  </div>
                  <div className="pl-kpi" style={{ ['--k-color' as string]: 'var(--pl-accent-5)' }}>
                    <div className="pl-kpi-label">Oscilação</div>
                    <div className="pl-kpi-value">{pessoaIndividual.oscilacaoPct != null ? pessoaIndividual.oscilacaoPct.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—'}<span className="pl-unit">{pessoaIndividual.oscilacaoPct != null ? '%' : 'sem histórico'}</span></div>
                    {mediaOscilacao != null && <div className="pl-section-note" style={{ marginTop: 4 }}>equipe: {mediaOscilacao.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</div>}
                  </div>
                </div>

                <div style={{ marginTop: 4 }}>
                  <div className="pl-card-title" style={{ fontSize: 13.5 }}>Atrasos no período ({atrasosIndividual.length})</div>
                  {atrasosIndividual.length === 0 ? (
                    <div className="pl-empty" style={{ padding: '20px 10px' }}>
                      <div className="pl-emoji">✅</div>
                      Nenhum atraso registrado nesse período.
                    </div>
                  ) : (
                    <div className="pl-table-wrap" style={{ marginTop: 10 }}>
                      <table className="pl-table">
                        <thead>
                          <tr><th>Data</th><th>Item</th><th>Horário previsto</th><th className="pl-right">Atraso</th></tr>
                        </thead>
                        <tbody>
                          {atrasosIndividual.map((o, i) => (
                            <tr key={`${o.item.id}-${isoDia(o.dia)}-${i}`}>
                              <td>{o.dia.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                              <td>{o.item.titulo}</td>
                              <td>{o.item.horario ?? '—'}</td>
                              <td className="pl-right" style={{ color: 'var(--pl-critical)', fontWeight: 700 }}>{formatAtraso(o.atrasoMin)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {heatmap && heatmap.horarios.length > 0 && (
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--pl-border)' }}>
                    <div className="pl-card-title" style={{ fontSize: 13.5 }}>Heatmap horário × dia da semana</div>
                    <div className="pl-section-note" style={{ marginTop: 2, marginBottom: 10 }}>Em que horário/dia a produção dessa pessoa historicamente cai ou desaparece</div>
                    <HeatmapGrid heatmap={heatmap} />
                  </div>
                )}

                {diaAtual && (
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--pl-border)' }}>
                    <div className="pl-card-title" style={{ fontSize: 13.5 }}>Timeline do dia</div>
                    <div className="pl-section-note" style={{ marginTop: 2, marginBottom: 8, textTransform: 'capitalize' }}>
                      {diaAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' })}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <button type="button" className="pl-btn pl-btn-ghost" style={{ padding: '5px 12px' }} disabled={diaAtual <= inicioPeriodo} onClick={() => moverDiaIndividual(-1)}>← Dia anterior</button>
                      <button type="button" className="pl-btn pl-btn-ghost" style={{ padding: '5px 12px' }} disabled={diaAtual >= fimPeriodo} onClick={() => moverDiaIndividual(1)}>Próximo dia →</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {itensIndividual.length === 0 ? (
                        <div className="pl-empty" style={{ padding: '24px 10px' }}>
                          <div className="pl-emoji">🗒️</div>
                          Nada previsto pra essa pessoa nesse dia.
                        </div>
                      ) : itensIndividual.map(({ item, status: statusItem, atrasoMin, conclusao }) => (
                        <div key={item.id} className="pl-agenda-item-card" style={{ ['--cat-cor' as string]: CATEGORIA_COR[item.categoria] }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="pl-kanban-card-time">{item.horario ?? 'sem horário'}</span>
                              <span className="pl-agenda-item-title" style={{ fontSize: 13 }}>{item.titulo}</span>
                              {item.exigeLocalizacao && <span title="Exige selo de localização">📍</span>}
                            </div>
                            <span
                              className="pl-status-badge"
                              style={{
                                color: statusItem === 'NO_PRAZO' ? 'var(--pl-good)' : statusItem === 'ATRASADO' ? 'var(--pl-critical)' : 'var(--pl-ink-muted)',
                                background: statusItem === 'NO_PRAZO' ? 'color-mix(in srgb, var(--pl-good) 14%, transparent)' : statusItem === 'ATRASADO' ? 'color-mix(in srgb, var(--pl-critical) 14%, transparent)' : 'var(--pl-surface-2)',
                              }}
                            >
                              {statusItem === 'NO_PRAZO' ? 'no prazo' : statusItem === 'ATRASADO' ? `atrasado ${formatAtraso(atrasoMin ?? 0)}` : statusItem === 'SEM_HORARIO' ? 'concluído' : 'pendente'}
                            </span>
                          </div>
                          {item.exigeLocalizacao && conclusao?.latitude != null && conclusao?.longitude != null && (
                            <a href={linkMapa(conclusao.latitude, conclusao.longitude)} target="_blank" rel="noreferrer" className="pl-link-action" style={{ display: 'inline-block', marginTop: 6 }}>
                              📍 Ver localização do check-in
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {abaEfetiva === 'ROTINA' && (
      <>
      <div className="pl-section-head" style={{ marginTop: 28 }}>
        <div>
          <div className="pl-eyebrow">Dia a dia</div>
          <h2 className="pl-section-title" style={{ fontSize: 17 }}>Calendário e conclusões</h2>
        </div>
      </div>

      <div className="pl-kpi-grid" style={{ marginTop: 12 }}>
        <div className="pl-kpi" style={{ ['--k-color' as string]: 'var(--pl-accent)' }}>
          <div className="pl-kpi-label">Hoje</div>
          <div className="pl-kpi-value">{meusConcluidosHoje}/{meusItensHoje.length}<span className="pl-unit">concluídos</span></div>
        </div>
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
                const euIniciado = foiIniciado(inicios, item.id, meuAutorId, diaSelecionado)
                const meuStatus = statusConclusao(conclusoes, item, meuAutorId, diaSelecionadoDate)
                let resumoEquipe: string | null = null
                if (vejaEquipe) {
                  const alvos = alvosDoItem(item)
                  const temAlvo = alvos.length > 0 || item.incluiDono
                  const rotuloStatus = (autorId: string) => {
                    const { status, atrasoMin } = statusConclusao(conclusoes, item, autorId, diaSelecionadoDate)
                    if (status === 'PENDENTE') return 'pendente'
                    if (status === 'ATRASADO') return `atrasado ${formatAtraso(atrasoMin ?? 0)}`
                    if (status === 'NO_PRAZO') return 'no prazo'
                    return 'concluído'
                  }
                  if (!temAlvo) {
                    const feitos = vendedoresAtivos.filter(v => foiConcluido(conclusoes, item.id, v.id, diaSelecionado)).length
                    resumoEquipe = vendedoresAtivos.length > 0 ? `${feitos} de ${vendedoresAtivos.length} vendedores concluíram` : null
                  } else {
                    const partes: string[] = []
                    if (item.incluiDono && !isDono) {
                      partes.push(`${ROTULO_DONO}: ${rotuloStatus(item.usuarioId)}`)
                    }
                    for (const id of alvos.filter(id => id !== meuVendedorId)) {
                      const nome = vendedores.find(v => v.id === id)?.nome ?? 'Vendedor'
                      partes.push(`${nome}: ${rotuloStatus(id)}`)
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
                          {item.exigeLocalizacao && <span title="Exige selo de localização no check-in">📍</span>}
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
                      <>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {!euConcluido && (
                            <button type="button" className={`pl-agenda-toggle-btn ${euIniciado ? 'done' : ''}`} onClick={() => alternarInicio(item, diaSelecionado)} title="Sinaliza que já começou, sem marcar como terminado — alimenta o funil de aderência">
                              {euIniciado ? (
                                <><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg> Iniciado</>
                              ) : 'Iniciar'}
                            </button>
                          )}
                          <button type="button" className={`pl-agenda-toggle-btn ${euConcluido ? 'done' : ''}`} onClick={() => alternarConclusao(item, diaSelecionado)}>
                            {euConcluido ? (
                              <><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg> Concluído</>
                            ) : 'Marcar como feito'}
                          </button>
                        </div>
                        {euConcluido && meuStatus.status === 'ATRASADO' && (
                          <div className="pl-kanban-card-meta" style={{ marginTop: 6, color: 'var(--pl-critical)', fontWeight: 700 }}>
                            Atrasado {formatAtraso(meuStatus.atrasoMin ?? 0)} em relação ao horário ({item.horario})
                          </div>
                        )}
                        {euConcluido && meuStatus.status === 'NO_PRAZO' && (
                          <div className="pl-kanban-card-meta" style={{ marginTop: 6, color: 'var(--pl-good)', fontWeight: 700 }}>
                            Concluído no prazo (horário: {item.horario})
                          </div>
                        )}
                        {euConcluido && item.exigeLocalizacao && (
                          meuStatus.conclusao?.latitude != null && meuStatus.conclusao?.longitude != null ? (
                            <a href={linkMapa(meuStatus.conclusao.latitude, meuStatus.conclusao.longitude)} target="_blank" rel="noreferrer" className="pl-link-action" style={{ display: 'inline-block', marginTop: 6 }}>
                              📍 Ver localização do check-in
                            </a>
                          ) : (
                            <div className="pl-kanban-card-meta" style={{ marginTop: 6, color: 'var(--pl-accent-4)' }}>
                              📍 Sem selo de localização (permissão não concedida)
                            </div>
                          )
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {abaEfetiva === 'CADASTRO' && (
        <div className="pl-card" style={{ marginTop: 16 }}>
          <div className="pl-card-head">
            <div>
              <div className="pl-card-title">Rotinas Cadastradas</div>
              <div className="pl-section-note" style={{ marginTop: 2 }}>Metas diárias, processos, auditorias e protocolos — cadastro isolado de qualquer métrica</div>
            </div>
            <button type="button" className="pl-btn pl-btn-primary" onClick={abrirNovoItem}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Novo item
            </button>
          </div>

          {itens.length === 0 ? (
            <div className="pl-empty" style={{ padding: '30px 10px' }}>
              <div className="pl-emoji">🗒️</div>
              Nenhum item cadastrado ainda.
            </div>
          ) : (
            <div className="pl-table-wrap" style={{ marginTop: 14 }}>
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
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--pl-ink-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.exigeLocalizacao} onChange={e => setForm(f => ({ ...f, exigeLocalizacao: e.target.checked }))} style={{ accentColor: 'var(--pl-accent-3)' }} />
                Exige selo de localização (visita, entrega, test-drive)
              </label>
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
