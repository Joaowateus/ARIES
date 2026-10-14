// Copiloto Comercial: o que a produção de uma pessoa mostra, medido no
// banco. Daqui saem os fatos do dia, os achados (por regra, sem IA), o
// índice de execução e o plano de ações. A IA só redige em cima disso.
//
// Pessoa = um Vendedor (a própria produção) ou "EQUIPE" (o gestor: o time
// inteiro, com a comparação entre as pessoas).
// Dinheiro nunca sai daqui como valor: vendas vão em quantidade e a meta em
// percentual atingido.
import { prisma } from './prisma'
import { diaBrasilia, inicioDoDiaBrasilia } from './socialMediaSync'
import { COMPETENCIAS, type Competencia } from './copilotoCompetencias'

export const EQUIPE = 'EQUIPE'
const H = 3600e3
const DIA = 24 * H

export const ESTAGIOS_ABERTOS = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA'] as const
const RANK: Record<string, number> = { LEAD: 0, ABORDADO: 1, NEGOCIACAO: 2, PROPOSTA: 3, FECHADO: 4 }
export const rankEstagio = (e: string | null | undefined) => (e && e in RANK ? RANK[e] : -1)
/** Dias sem movimento a partir dos quais o lead conta como parado, por estágio. */
export const PARADO_APOS: Record<string, number> = { LEAD: 1, ABORDADO: 3, NEGOCIACAO: 4, PROPOSTA: 3 }
export const ESTAGIO_NOME: Record<string, string> = { LEAD: 'novo', ABORDADO: 'abordado', NEGOCIACAO: 'em negociação', PROPOSTA: 'com proposta', FECHADO: 'fechado', PERDIDO: 'perdido' }

export function primeiroNome(n: string | null | undefined): string {
  const p = (n ?? '').trim().split(/\s+/)[0]
  if (!p) return 'Cliente'
  // "BRENDA" ou "brenda" viram "Brenda"; "McCarthy" fica como está.
  return p === p.toUpperCase() || p === p.toLowerCase() ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p
}
const arred = (v: number, c = 0) => Math.round(v * 10 ** c) / 10 ** c
const pct = (a: number, b: number) => (b > 0 ? arred((a / b) * 100) : null)
function mediana(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
export const chaveDia = (d: Date) => d.toISOString().slice(0, 10)

// ---------- Tipos ----------

export interface LeadParado { id: string; nome: string; estagio: string; dias: number; modelo: string | null; vendedor?: string | null }
export interface ConversaPendente { id: string; nome: string; horas: number; situacao: 'ESPERANDO' | 'SEM_RESPOSTA'; leadId: string | null; vendedor?: string | null }
export interface TarefaHoje { id: string; titulo: string; horario: string | null }
export interface Conversao { leadParaAbordado: number | null; abordadoParaNegociacao: number | null; negociacaoParaProposta: number | null; propostaParaFechado: number | null; base: number }
export interface LinhaEquipe {
  vendedorId: string; nome: string; carteira: number; parados: number; semAbordar: number; novos7d: number; movimentos7d: number; fechados7d: number
  conversaoLeadAbordado: number | null; tempoAbordagemHoras: number | null; agendaPct: number | null; esperandoWhatsapp: number; indice: number
}

export interface Fatos {
  dia: string
  pessoa: { tipo: 'VENDEDOR' | 'EQUIPE'; nome: string; temWhatsapp: boolean }
  carteira: { LEAD: number; ABORDADO: number; NEGOCIACAO: number; PROPOSTA: number; total: number }
  leadsNovos: { ontem: number; semana: number; semanaAnterior: number }
  movimentos: { semana: Record<string, number>; semanaAnterior: Record<string, number> }
  conversao: Conversao
  conversaoEquipe: Conversao | null
  tempoAbordagemHoras: number | null
  tempoAbordagemEquipeHoras: number | null
  parados: { total: number; porEstagio: Record<string, number>; semAbordar: number; lista: LeadParado[] }
  vendas: { mes: number; mesAnteriorMesmoDia: number; semana: number; percentualMeta: number | null; percentualMesDecorrido: number }
  agenda: { previstas7d: number; concluidas7d: number; percentual: number | null; hoje: TarefaHoje[] }
  ocorrenciasAbertas: number
  whatsapp: {
    conectado: boolean; esperandoAgora: number; esperaMaisAntigaHoras: number | null; semResposta: number
    tempoAssumirMinutos: number | null; qualificados7d: number; qualificadosAvancaram: number
    mensagensVendedor7d: number; percentualComPergunta: number | null; precoNaPrimeiraMensagem: number
    pendentes: ConversaPendente[]
  }
  diasAtivos7d: number
  equipe: LinhaEquipe[] | null
}

export interface Achado { id: string; tipo: 'FORTE' | 'ATENCAO' | 'ERRO'; natureza: 'FATO'; competencia: Competencia; texto: string }
export interface AcaoPlano { tipo: string; texto: string; porque: string; refTipo?: string; refId?: string; estagioNaHora?: string }

// ---------- Coleta ----------

interface Escopo { usuarioId: string; pessoa: string; vendedorIds: string[] | null; autorAgenda: string; nome: string; assistenteIds: string[] }

async function escopoDa(usuarioId: string, pessoa: string): Promise<Escopo | null> {
  if (pessoa === EQUIPE) {
    const [dono, vendedores, assistentes] = await Promise.all([
      prisma.proLaboreUsuario.findUnique({ where: { id: usuarioId }, select: { nome: true } }),
      prisma.vendedor.findMany({ where: { usuarioId, ativo: true }, select: { id: true } }),
      prisma.assistenteComercial.findMany({ where: { vendedor: { usuarioId, ativo: true } }, select: { id: true } }),
    ])
    if (!dono) return null
    return { usuarioId, pessoa, vendedorIds: null, autorAgenda: usuarioId, nome: dono.nome, assistenteIds: assistentes.map(a => a.id) }
  }
  const v = await prisma.vendedor.findFirst({ where: { id: pessoa, usuarioId }, select: { id: true, nome: true, assistenteComercial: { select: { id: true } } } })
  if (!v) return null
  return { usuarioId, pessoa, vendedorIds: [v.id], autorAgenda: v.id, nome: v.nome, assistenteIds: v.assistenteComercial ? [v.assistenteComercial.id] : [] }
}

type LeadComHist = { id: string; nomeCliente: string; estagio: string; modeloInteresse: string | null; vendedorId: string | null; criadoEm: Date; atualizadoEm: Date; historico: { estagioNovo: string; criadoEm: Date }[] }

/** Maior estágio que o lead já alcançou (o PERDIDO conta pelo último estágio antes da perda). */
function maiorRank(l: LeadComHist): number {
  return Math.max(rankEstagio(l.estagio), 0, ...l.historico.map(h => rankEstagio(h.estagioNovo)))
}

function conversaoDe(leads: LeadComHist[], de: number, ate: number): Conversao {
  const coorte = leads.filter(l => l.criadoEm.getTime() >= de && l.criadoEm.getTime() < ate)
  const alcancou = (r: number) => coorte.filter(l => maiorRank(l) >= r).length
  const [a1, a2, a3, a4] = [alcancou(1), alcancou(2), alcancou(3), alcancou(4)]
  return { leadParaAbordado: pct(a1, coorte.length), abordadoParaNegociacao: pct(a2, a1), negociacaoParaProposta: pct(a3, a2), propostaParaFechado: pct(a4, a3), base: coorte.length }
}

function tempoAbordagem(leads: LeadComHist[], desde: number): number | null {
  const horas: number[] = []
  for (const l of leads) {
    if (l.criadoEm.getTime() < desde) continue
    const primeiro = l.historico.filter(h => rankEstagio(h.estagioNovo) >= 1).sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime())[0]
    if (primeiro) horas.push(Math.max(0, (primeiro.criadoEm.getTime() - l.criadoEm.getTime()) / H))
  }
  const m = mediana(horas)
  return m == null ? null : arred(m, 1)
}

function ultimoMovimento(l: LeadComHist): number {
  return Math.max(l.atualizadoEm.getTime(), l.criadoEm.getTime(), ...l.historico.map(h => h.criadoEm.getTime()))
}

/** Itens da agenda que valem para a pessoa num dia (mesma regra da tela da Agenda). */
type ItemAgenda = { id: string; titulo: string; tipo: string; data: Date | null; diasSemana: string | null; dataInicio: Date | null; dataFim: Date | null; horario: string | null; vendedorIds: string | null; incluiDono: boolean; criadoEm: Date }
function valeNoDia(i: ItemAgenda, dia: Date, autor: string, ehDono: boolean): boolean {
  const alvos = (i.vendedorIds ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const paraTodos = alvos.length === 0 && !i.incluiDono
  if (!paraTodos && !(ehDono ? i.incluiDono : alvos.includes(autor))) return false
  if (i.criadoEm.getTime() > dia.getTime() + DIA + 3 * H) return false
  if (i.tipo === 'UNICO') return !!i.data && chaveDia(i.data) === chaveDia(dia)
  const dias = (i.diasSemana ?? '').split(',').map(Number)
  if (!dias.includes(dia.getUTCDay())) return false
  if (i.dataInicio && chaveDia(i.dataInicio) > chaveDia(dia)) return false
  if (i.dataFim && chaveDia(i.dataFim) < chaveDia(dia)) return false
  return true
}

function contarMovimentos(leads: LeadComHist[], de: number, ate: number): Record<string, number> {
  const r: Record<string, number> = { ABORDADO: 0, NEGOCIACAO: 0, PROPOSTA: 0, FECHADO: 0, PERDIDO: 0 }
  for (const l of leads) for (const h of l.historico) {
    const t = h.criadoEm.getTime()
    if (t >= de && t < ate && h.estagioNovo in r) r[h.estagioNovo]++
  }
  return r
}

export async function coletarFatos(usuarioId: string, pessoa: string, agora = new Date()): Promise<Fatos | null> {
  const esc = await escopoDa(usuarioId, pessoa)
  if (!esc) return null
  const hojeDia = diaBrasilia(agora)
  const inicioHoje = inicioDoDiaBrasilia(hojeDia).getTime()
  const t = agora.getTime()
  const ontem = inicioHoje - DIA
  const semana = inicioHoje - 7 * DIA
  const semanaAnt = inicioHoje - 14 * DIA
  const filtroVend = esc.vendedorIds ? { vendedorId: { in: esc.vendedorIds } } : {}

  const leads: LeadComHist[] = await prisma.lead.findMany({
    where: { usuarioId, ...filtroVend, OR: [{ estagio: { in: [...ESTAGIOS_ABERTOS] } }, { criadoEm: { gte: new Date(t - 60 * DIA) } }, { atualizadoEm: { gte: new Date(semanaAnt) } }] },
    select: { id: true, nomeCliente: true, estagio: true, modeloInteresse: true, vendedorId: true, criadoEm: true, atualizadoEm: true, historico: { select: { estagioNovo: true, criadoEm: true }, orderBy: { criadoEm: 'asc' } } },
  })
  // Para comparar: a equipe inteira (só quando a pessoa é um vendedor).
  const leadsEquipe: LeadComHist[] = esc.vendedorIds
    ? await prisma.lead.findMany({
      where: { usuarioId, criadoEm: { gte: new Date(t - 60 * DIA) } },
      select: { id: true, nomeCliente: true, estagio: true, modeloInteresse: true, vendedorId: true, criadoEm: true, atualizadoEm: true, historico: { select: { estagioNovo: true, criadoEm: true }, orderBy: { criadoEm: 'asc' } } },
    })
    : leads

  const abertos = leads.filter(l => (ESTAGIOS_ABERTOS as readonly string[]).includes(l.estagio))
  const carteira = { LEAD: 0, ABORDADO: 0, NEGOCIACAO: 0, PROPOSTA: 0, total: abertos.length }
  for (const l of abertos) carteira[l.estagio as keyof typeof carteira]++

  const nomesVend = new Map((await prisma.vendedor.findMany({ where: { usuarioId }, select: { id: true, nome: true } })).map(v => [v.id, v.nome]))
  const paradosTodos: LeadParado[] = abertos
    .map(l => ({ l, dias: Math.floor((t - ultimoMovimento(l)) / DIA) }))
    .filter(({ l, dias }) => dias >= PARADO_APOS[l.estagio])
    .sort((a, b) => rankEstagio(b.l.estagio) - rankEstagio(a.l.estagio) || b.dias - a.dias)
    .map(({ l, dias }) => ({ id: l.id, nome: primeiroNome(l.nomeCliente), estagio: l.estagio, dias, modelo: l.modeloInteresse, vendedor: esc.vendedorIds ? undefined : (l.vendedorId ? primeiroNome(nomesVend.get(l.vendedorId)) : null) }))
  const porEstagio: Record<string, number> = { LEAD: 0, ABORDADO: 0, NEGOCIACAO: 0, PROPOSTA: 0 }
  for (const p of paradosTodos) porEstagio[p.estagio]++

  const novos = (de: number, ate: number) => leads.filter(l => l.criadoEm.getTime() >= de && l.criadoEm.getTime() < ate).length

  // Vendas em quantidade; a meta só como percentual atingido.
  const mesIni = new Date(Date.UTC(hojeDia.getUTCFullYear(), hojeDia.getUTCMonth(), 1))
  const mesAntIni = new Date(Date.UTC(hojeDia.getUTCFullYear(), hojeDia.getUTCMonth() - 1, 1))
  const diaDoMes = hojeDia.getUTCDate()
  const diasNoMes = new Date(Date.UTC(hojeDia.getUTCFullYear(), hojeDia.getUTCMonth() + 1, 0)).getUTCDate()
  const [vendasMes, vendasMesAnt, param, vendInfo] = await Promise.all([
    prisma.venda.findMany({ where: { usuarioId, ...filtroVend, data: { gte: mesIni } }, select: { data: true, valorVenda: true } }),
    prisma.venda.count({ where: { usuarioId, ...filtroVend, data: { gte: mesAntIni, lt: new Date(mesAntIni.getTime() + diaDoMes * DIA) } } }),
    prisma.parametroLiquidez.findUnique({ where: { usuarioId }, select: { metaMensalPadrao: true, metaFaturamentoAnual: true } }),
    esc.vendedorIds ? prisma.vendedor.findUnique({ where: { id: esc.vendedorIds[0] }, select: { metaMensal: true } }) : null,
  ])
  const meta = esc.vendedorIds ? (vendInfo?.metaMensal ?? param?.metaMensalPadrao ?? 0) : (param ? param.metaFaturamentoAnual / 12 : 0)
  const somaMes = vendasMes.reduce((s, v) => s + v.valorVenda, 0)

  // Agenda: previstas x concluídas nos últimos 7 dias, e as de hoje em aberto.
  const ehDono = pessoa === EQUIPE
  const [itens, conclusoes] = await Promise.all([
    prisma.agendaItem.findMany({ where: { usuarioId, ativo: true }, select: { id: true, titulo: true, tipo: true, data: true, diasSemana: true, dataInicio: true, dataFim: true, horario: true, vendedorIds: true, incluiDono: true, criadoEm: true } }),
    prisma.agendaConclusao.findMany({ where: { autorId: esc.autorAgenda, dataReferencia: { gte: new Date(hojeDia.getTime() - 7 * DIA) }, item: { usuarioId } }, select: { agendaItemId: true, dataReferencia: true } }),
  ])
  const feitas = new Set(conclusoes.map(c => `${c.agendaItemId}|${chaveDia(c.dataReferencia)}`))
  let previstas = 0, concluidas = 0
  for (let k = 1; k <= 7; k++) {
    const d = new Date(hojeDia.getTime() - k * DIA)
    for (const i of itens) if (valeNoDia(i, d, esc.autorAgenda, ehDono)) { previstas++; if (feitas.has(`${i.id}|${chaveDia(d)}`)) concluidas++ }
  }
  const hojeTarefas = itens.filter(i => valeNoDia(i, hojeDia, esc.autorAgenda, ehDono) && !feitas.has(`${i.id}|${chaveDia(hojeDia)}`))
    .sort((a, b) => (a.horario ?? '99').localeCompare(b.horario ?? '99')).map(i => ({ id: i.id, titulo: i.titulo, horario: i.horario }))

  const ocorrenciasAbertas = esc.vendedorIds
    ? await prisma.ocorrencia.count({ where: { usuarioId, vendedorId: { in: esc.vendedorIds }, status: { in: ['ABERTA', 'EM_PRAZO', 'EM_VERIFICACAO', 'REINCIDENTE', 'ESCALONADA'] }, tipo: { not: 'Feedback Positivo' } } })
    : 0

  const whatsapp = await fatosWhatsapp(esc.assistenteIds, t, semana)

  // Dias com alguma ação registrada (lead criado, estágio mudado ou tarefa concluída).
  const diasComAcao = new Set<string>()
  for (const l of leads) {
    if (l.criadoEm.getTime() >= semana) diasComAcao.add(chaveDia(diaBrasilia(l.criadoEm)))
    for (const h of l.historico) if (h.criadoEm.getTime() >= semana) diasComAcao.add(chaveDia(diaBrasilia(h.criadoEm)))
  }
  for (const c of conclusoes) if (c.dataReferencia.getTime() >= hojeDia.getTime() - 7 * DIA && c.dataReferencia.getTime() < hojeDia.getTime()) diasComAcao.add(chaveDia(c.dataReferencia))

  const fatos: Fatos = {
    dia: chaveDia(hojeDia),
    pessoa: { tipo: esc.vendedorIds ? 'VENDEDOR' : 'EQUIPE', nome: primeiroNome(esc.nome), temWhatsapp: whatsapp.conectado },
    carteira,
    leadsNovos: { ontem: novos(ontem, inicioHoje), semana: novos(semana, inicioHoje), semanaAnterior: novos(semanaAnt, semana) },
    movimentos: { semana: contarMovimentos(leads, semana, inicioHoje), semanaAnterior: contarMovimentos(leads, semanaAnt, semana) },
    conversao: conversaoDe(leads, t - 60 * DIA, t - 2 * DIA),
    conversaoEquipe: esc.vendedorIds ? conversaoDe(leadsEquipe, t - 60 * DIA, t - 2 * DIA) : null,
    tempoAbordagemHoras: tempoAbordagem(leads, t - 30 * DIA),
    tempoAbordagemEquipeHoras: esc.vendedorIds ? tempoAbordagem(leadsEquipe, t - 30 * DIA) : null,
    parados: { total: paradosTodos.length, porEstagio, semAbordar: porEstagio.LEAD, lista: paradosTodos.slice(0, 10) },
    vendas: {
      mes: vendasMes.length, mesAnteriorMesmoDia: vendasMesAnt,
      semana: vendasMes.filter(v => v.data.getTime() >= semana).length,
      percentualMeta: meta > 0 ? arred((somaMes / meta) * 100) : null,
      percentualMesDecorrido: arred((diaDoMes / diasNoMes) * 100),
    },
    agenda: { previstas7d: previstas, concluidas7d: concluidas, percentual: pct(concluidas, previstas), hoje: hojeTarefas.slice(0, 6) },
    ocorrenciasAbertas,
    whatsapp,
    diasAtivos7d: diasComAcao.size,
    equipe: null,
  }
  if (!esc.vendedorIds) fatos.equipe = await linhasEquipe(usuarioId, agora)
  return fatos
}

async function fatosWhatsapp(assistenteIds: string[], t: number, semana: number): Promise<Fatos['whatsapp']> {
  const vazio: Fatos['whatsapp'] = { conectado: false, esperandoAgora: 0, esperaMaisAntigaHoras: null, semResposta: 0, tempoAssumirMinutos: null, qualificados7d: 0, qualificadosAvancaram: 0, mensagensVendedor7d: 0, percentualComPergunta: null, precoNaPrimeiraMensagem: 0, pendentes: [] }
  if (!assistenteIds.length) return vazio
  const assistentes = await prisma.assistenteComercial.findMany({ where: { id: { in: assistenteIds } }, select: { id: true, status: true, vendedor: { select: { nome: true } } } })
  const vendedorDa = (id: string) => (assistenteIds.length > 1 ? primeiroNome(assistentes.find(a => a.id === id)?.vendedor.nome) : null)
  const conversas = await prisma.assistenteConversa.findMany({
    where: { assistenteId: { in: assistenteIds }, tipo: 'LEAD', OR: [{ status: { in: ['AGUARDANDO_VENDEDOR', 'ASSUMIDA'] } }, { ultimaMensagemEm: { gte: new Date(semana) } }] },
    select: {
      id: true, assistenteId: true, nomeContato: true, status: true, leadId: true, aguardandoVendedorEm: true, assumidaEm: true, ultimaMensagemEm: true,
      lead: { select: { estagio: true, historico: { select: { estagioNovo: true } } } },
      mensagens: { select: { remetente: true, texto: true, criadoEm: true }, orderBy: { criadoEm: 'asc' }, take: 200 },
    },
  })
  const pendentes: ConversaPendente[] = []
  const tempos: number[] = []
  let qualificados = 0, avancaram = 0, msgsVend = 0, comPergunta = 0, precoPrimeira = 0
  const PRECO = /pre[cç]o|valor|r\$|parcela|entrada|à vista|a vista/i
  for (const c of conversas) {
    if (c.status === 'AGUARDANDO_VENDEDOR') {
      const desde = (c.aguardandoVendedorEm ?? c.ultimaMensagemEm).getTime()
      pendentes.push({ id: c.id, nome: primeiroNome(c.nomeContato), horas: arred((t - desde) / H, 1), situacao: 'ESPERANDO', leadId: c.leadId, vendedor: vendedorDa(c.assistenteId) })
    } else if (c.status === 'ASSUMIDA') {
      const ultima = c.mensagens[c.mensagens.length - 1]
      if (ultima && ultima.remetente === 'CONTATO' && t - ultima.criadoEm.getTime() > 2 * H) {
        pendentes.push({ id: c.id, nome: primeiroNome(c.nomeContato), horas: arred((t - ultima.criadoEm.getTime()) / H, 1), situacao: 'SEM_RESPOSTA', leadId: c.leadId, vendedor: vendedorDa(c.assistenteId) })
      }
    }
    if (c.aguardandoVendedorEm && c.assumidaEm && c.assumidaEm.getTime() >= semana) tempos.push((c.assumidaEm.getTime() - c.aguardandoVendedorEm.getTime()) / 60e3)
    if (c.aguardandoVendedorEm && c.aguardandoVendedorEm.getTime() >= semana) {
      qualificados++
      const r = c.lead ? Math.max(rankEstagio(c.lead.estagio), ...c.lead.historico.map(h => rankEstagio(h.estagioNovo))) : -1
      if (r >= 1) avancaram++
    }
    const doVendedor = c.mensagens.filter(m => m.remetente === 'VENDEDOR')
    if (doVendedor[0] && doVendedor[0].criadoEm.getTime() >= semana && PRECO.test(doVendedor[0].texto)) precoPrimeira++
    for (const m of doVendedor) if (m.criadoEm.getTime() >= semana) { msgsVend++; if (m.texto.includes('?')) comPergunta++ }
  }
  pendentes.sort((a, b) => b.horas - a.horas)
  const esperando = pendentes.filter(p => p.situacao === 'ESPERANDO')
  const m = mediana(tempos)
  return {
    conectado: assistentes.some(a => a.status === 'CONECTADO') || conversas.length > 0,
    esperandoAgora: esperando.length, esperaMaisAntigaHoras: esperando[0]?.horas ?? null,
    semResposta: pendentes.length - esperando.length,
    tempoAssumirMinutos: m == null ? null : Math.round(m),
    qualificados7d: qualificados, qualificadosAvancaram: avancaram,
    mensagensVendedor7d: msgsVend, percentualComPergunta: pct(comPergunta, msgsVend), precoNaPrimeiraMensagem: precoPrimeira,
    pendentes: pendentes.slice(0, 8),
  }
}

async function linhasEquipe(usuarioId: string, agora: Date): Promise<LinhaEquipe[]> {
  const vendedores = await prisma.vendedor.findMany({ where: { usuarioId, ativo: true, vende: true }, select: { id: true }, orderBy: { nome: 'asc' } })
  const linhas: LinhaEquipe[] = []
  for (const v of vendedores) {
    const f = await coletarFatos(usuarioId, v.id, agora)
    if (!f) continue
    const mov = f.movimentos.semana
    linhas.push({
      vendedorId: v.id, nome: f.pessoa.nome, carteira: f.carteira.total, parados: f.parados.total, semAbordar: f.parados.semAbordar,
      novos7d: f.leadsNovos.semana, movimentos7d: mov.ABORDADO + mov.NEGOCIACAO + mov.PROPOSTA + mov.FECHADO, fechados7d: mov.FECHADO,
      conversaoLeadAbordado: f.conversao.leadParaAbordado, tempoAbordagemHoras: f.tempoAbordagemHoras, agendaPct: f.agenda.percentual,
      esperandoWhatsapp: f.whatsapp.esperandoAgora, indice: indiceDoDia(f),
    })
  }
  return linhas
}

// ---------- Índice do dia ----------

/**
 * Índice de execução (0 a 100), por regra fixa e explicável:
 * resposta no WhatsApp 25, leads novos abordados 20, carteira sem parados 20,
 * agenda cumprida 15, leads movidos na semana 20.
 */
export function indiceDoDia(f: Fatos): number {
  const w = f.whatsapp
  const resposta = !w.conectado ? 25 : w.esperandoAgora + w.semResposta === 0 ? 25 : 25 * Math.max(0, 1 - (w.esperaMaisAntigaHoras ?? 24) / 24) * 0.6
  const abordagem = 20 * Math.max(0, 1 - f.parados.semAbordar / 5)
  const carteira = f.carteira.total === 0 ? 20 : 20 * (1 - f.parados.total / f.carteira.total)
  const agenda = f.agenda.percentual == null ? 15 : 15 * (f.agenda.percentual / 100)
  const m = f.movimentos.semana
  const movidos = m.ABORDADO + m.NEGOCIACAO + m.PROPOSTA + m.FECHADO
  const movimento = 20 * Math.min(1, movidos / Math.max(1, f.leadsNovos.semana, 3))
  return Math.round(resposta + abordagem + carteira + agenda + movimento)
}

// ---------- Achados ----------

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`
const horasTexto = (h: number) => (h < 1 ? `${Math.round(h * 60)} minutos` : h < 48 ? `${Math.round(h)} ${Math.round(h) === 1 ? 'hora' : 'horas'}` : `${Math.round(h / 24)} dias`)

export function achadosDe(f: Fatos): Achado[] {
  const a: Achado[] = []
  const add = (id: string, tipo: Achado['tipo'], competencia: Competencia, texto: string) => a.push({ id, tipo, natureza: 'FATO', competencia, texto })
  const w = f.whatsapp
  const eq = f.pessoa.tipo === 'EQUIPE'

  if (w.esperandoAgora > 0) add('whats-esperando', 'ERRO', 'ATENDIMENTO_RAPIDO', `${plural(w.esperandoAgora, 'lead está esperando', 'leads estão esperando')} resposta no WhatsApp; a espera mais longa já passa de ${horasTexto(w.esperaMaisAntigaHoras ?? 0)}.`)
  if (w.semResposta > 0) add('whats-sem-resposta', 'ERRO', 'FOLLOW_UP', `${plural(w.semResposta, 'conversa assumida tem', 'conversas assumidas têm')} a última mensagem do cliente sem resposta há mais de 2 horas.`)
  if (f.parados.semAbordar > 0) add('sem-abordar', 'ERRO', 'ABORDAGEM', `${plural(f.parados.semAbordar, 'lead novo segue', 'leads novos seguem')} sem abordagem há mais de 1 dia.`)
  if (f.parados.porEstagio.PROPOSTA > 0) add('proposta-parada', 'ATENCAO', 'FOLLOW_UP', `${plural(f.parados.porEstagio.PROPOSTA, 'proposta está parada', 'propostas estão paradas')} há 3 dias ou mais: é o lead mais perto de fechar.`)
  if (f.parados.porEstagio.NEGOCIACAO > 0) add('negociacao-parada', 'ATENCAO', 'NEGOCIACAO', `${plural(f.parados.porEstagio.NEGOCIACAO, 'negociação está parada', 'negociações estão paradas')} há 4 dias ou mais.`)
  if (f.parados.porEstagio.ABORDADO > 0) add('abordado-parado', 'ATENCAO', 'QUALIFICACAO', `${plural(f.parados.porEstagio.ABORDADO, 'lead abordado não avançou', 'leads abordados não avançaram')} há 3 dias ou mais.`)

  const tA = f.tempoAbordagemHoras, tE = f.tempoAbordagemEquipeHoras
  if (tA != null && tE != null && !eq) {
    if (tA > 2 && tA > tE * 1.5) add('tempo-abordagem', 'ATENCAO', 'ATENDIMENTO_RAPIDO', `Seu tempo até a primeira abordagem é de ${tA} horas (mediana de 30 dias); a equipe está em ${tE} horas.`)
    else if (tA <= tE && tA <= 4) add('tempo-abordagem-bom', 'FORTE', 'ATENDIMENTO_RAPIDO', `Você aborda rápido: ${tA} horas até a primeira abordagem, contra ${tE} horas da equipe.`)
  }

  const c = f.conversao, ce = f.conversaoEquipe
  if (ce && c.base >= 5) {
    const compara = (chave: keyof Omit<Conversao, 'base'>, nome: string, comp: Competencia, id: string) => {
      const x = c[chave], y = ce[chave]
      if (x == null || y == null) return
      if (x < y - 10) add(id, 'ATENCAO', comp, `${nome}: ${x}% dos seus leads contra ${y}% da equipe (leads dos últimos 60 dias).`)
      else if (x > y + 10) add(`${id}-bom`, 'FORTE', comp, `${nome}: ${x}% dos seus leads contra ${y}% da equipe. Esse é um ponto forte seu.`)
    }
    compara('leadParaAbordado', 'Lead novo virou abordado', 'ABORDAGEM', 'conv-abordagem')
    compara('abordadoParaNegociacao', 'Abordado virou negociação', 'QUALIFICACAO', 'conv-qualificacao')
    compara('negociacaoParaProposta', 'Negociação virou proposta', 'NEGOCIACAO', 'conv-negociacao')
    compara('propostaParaFechado', 'Proposta virou venda', 'FECHAMENTO', 'conv-fechamento')
  }

  const n = f.leadsNovos
  if (n.semanaAnterior >= 3 && n.semana < n.semanaAnterior * 0.7) add('entrada-caiu', 'ATENCAO', 'PROSPECCAO', `Entraram ${n.semana} leads nos últimos 7 dias, contra ${n.semanaAnterior} nos 7 dias anteriores.`)
  const ms = f.movimentos.semana, ma = f.movimentos.semanaAnterior
  const mov = ms.ABORDADO + ms.NEGOCIACAO + ms.PROPOSTA + ms.FECHADO, movAnt = ma.ABORDADO + ma.NEGOCIACAO + ma.PROPOSTA + ma.FECHADO
  if (mov > movAnt && mov >= 3) add('movimento-subiu', 'FORTE', 'ORGANIZACAO', `${mov} avanços de estágio nos últimos 7 dias, contra ${movAnt} na semana anterior.`)
  if (ms.FECHADO > 0) add('fechou', 'FORTE', 'FECHAMENTO', `${plural(ms.FECHADO, 'venda fechada', 'vendas fechadas')} no CRM nos últimos 7 dias.`)
  if (ms.PERDIDO >= 3 && ms.PERDIDO > ms.FECHADO * 2) add('perdas', 'ATENCAO', 'OBJECOES', `${ms.PERDIDO} leads marcados como perdidos nos últimos 7 dias, contra ${ms.FECHADO} fechados.`)

  const ag = f.agenda
  if (ag.percentual != null && ag.previstas7d >= 3) {
    if (ag.percentual < 70) add('agenda', 'ATENCAO', 'ORGANIZACAO', `Você concluiu ${ag.concluidas7d} de ${ag.previstas7d} tarefas da agenda nos últimos 7 dias (${ag.percentual}%).`)
    else if (ag.percentual >= 90) add('agenda-boa', 'FORTE', 'ORGANIZACAO', `Agenda em dia: ${ag.concluidas7d} de ${ag.previstas7d} tarefas concluídas nos últimos 7 dias.`)
  }

  if (!eq && w.mensagensVendedor7d >= 10 && (w.percentualComPergunta ?? 0) < 30) add('poucas-perguntas', 'ATENCAO', 'QUALIFICACAO', `Só ${w.percentualComPergunta}% das suas ${w.mensagensVendedor7d} mensagens aos leads na semana tinham uma pergunta. Pergunta é o que mantém a conversa andando.`)
  if (!eq && w.precoNaPrimeiraMensagem >= 2) add('preco-cedo', 'ATENCAO', 'NEGOCIACAO', `Em ${w.precoNaPrimeiraMensagem} conversas da semana, a sua primeira mensagem já falava de preço ou condição, antes de entender o cliente.`)
  if (w.tempoAssumirMinutos != null) {
    if (w.tempoAssumirMinutos > 30) add('assumir-lento', 'ATENCAO', 'ATENDIMENTO_RAPIDO', `Depois que o assistente qualifica, o lead espera em média ${w.tempoAssumirMinutos} minutos até a resposta (mediana da semana).`)
    else if (w.tempoAssumirMinutos <= 10) add('assumir-rapido', 'FORTE', 'ATENDIMENTO_RAPIDO', `${eq ? 'A equipe assume' : 'Você assume'} o lead qualificado em ${w.tempoAssumirMinutos < 1 ? 'menos de 1 minuto' : plural(w.tempoAssumirMinutos, 'minuto', 'minutos')} (mediana da semana).`)
  }

  const v = f.vendas
  if (v.percentualMeta != null && v.percentualMesDecorrido >= 20) {
    if (v.percentualMeta < v.percentualMesDecorrido - 15) add('meta-ritmo', 'ATENCAO', 'FECHAMENTO', `A meta do mês está ${v.percentualMeta}% atingida com ${v.percentualMesDecorrido}% do mês já passado.`)
    else if (v.percentualMeta >= v.percentualMesDecorrido) add('meta-ritmo-bom', 'FORTE', 'FECHAMENTO', `A meta do mês está ${v.percentualMeta}% atingida com ${v.percentualMesDecorrido}% do mês passado: no ritmo.`)
  }
  if (f.diasAtivos7d < 4 && f.carteira.total > 0) add('constancia', 'ATENCAO', 'ORGANIZACAO', `O CRM teve movimento em ${f.diasAtivos7d} dos últimos 7 dias. Resultado em vendas vem de constância.`)
  if (f.ocorrenciasAbertas > 0) add('ocorrencias', 'ATENCAO', 'ORGANIZACAO', `${plural(f.ocorrenciasAbertas, 'ocorrência está aberta', 'ocorrências estão abertas')} com o gestor.`)

  if (eq && f.equipe?.length) {
    const comParados = [...f.equipe].filter(l => l.parados > 0).sort((a, b) => b.parados - a.parados)[0]
    if (comParados && comParados.parados >= 3) add(`equipe-parados-${comParados.vendedorId}`, 'ATENCAO', 'LIDERANCA', `${comParados.nome} tem ${comParados.parados} leads parados na carteira.`)
    const esperando = f.equipe.filter(l => l.esperandoWhatsapp > 0)
    if (esperando.length) add('equipe-whats', 'ERRO', 'LIDERANCA', `Leads esperando resposta no WhatsApp agora: ${esperando.map(l => `${l.nome} (${l.esperandoWhatsapp})`).join(', ')}.`)
    const destaque = [...f.equipe].sort((a, b) => b.movimentos7d - a.movimentos7d)[0]
    if (destaque && destaque.movimentos7d >= 3) add(`equipe-destaque-${destaque.vendedorId}`, 'FORTE', 'LIDERANCA', `${destaque.nome} foi quem mais moveu leads na semana: ${destaque.movimentos7d} avanços de estágio.`)
  }
  const ordem = { ERRO: 0, ATENCAO: 1, FORTE: 2 }
  return a.sort((x, y) => ordem[x.tipo] - ordem[y.tipo])
}

/** A competência que mais pede estudo agora (a que tem mais erros e atenções). */
export function competenciaFoco(achados: Achado[], pessoaEquipe: boolean): Competencia {
  const peso = new Map<Competencia, number>()
  for (const x of achados) if (x.tipo !== 'FORTE') peso.set(x.competencia, (peso.get(x.competencia) ?? 0) + (x.tipo === 'ERRO' ? 2 : 1))
  const top = [...peso.entries()].sort((a, b) => b[1] - a[1])[0]
  return top?.[0] ?? (pessoaEquipe ? 'LIDERANCA' : 'FECHAMENTO')
}

// ---------- Plano do dia ----------

/**
 * Até 7 ações concretas, na ordem de impacto. `efeito` traz a taxa medida de
 * cada tipo de ação com a pessoa (o que funcionou com ela antes vem primeiro
 * entre as de mesma urgência).
 */
export function planoDoDia(f: Fatos, foco: Competencia, minutosEstudo: number, efeito: Record<string, number> = {}): AcaoPlano[] {
  const acoes: AcaoPlano[] = []
  const w = f.whatsapp
  for (const p of w.pendentes.slice(0, 3)) {
    const quem = p.vendedor ? ` (${p.vendedor})` : ''
    acoes.push(p.situacao === 'ESPERANDO'
      ? { tipo: 'RESPONDER', texto: `Responder ${p.nome}${quem} no WhatsApp`, porque: `Esperando há ${horasTexto(p.horas)} depois de ser qualificado pelo assistente.`, refTipo: 'CONVERSA', refId: p.id }
      : { tipo: 'RESPONDER', texto: `Retomar a conversa com ${p.nome}${quem}`, porque: `A última mensagem é do cliente, sem resposta há ${horasTexto(p.horas)}.`, refTipo: 'CONVERSA', refId: p.id })
  }
  const paraLead = (l: LeadParado): AcaoPlano => {
    const quem = l.vendedor ? ` (${l.vendedor})` : ''
    const moto = l.modelo ? `, interesse em ${l.modelo}` : ''
    if (l.estagio === 'LEAD') return { tipo: 'ABORDAR', texto: `Abordar ${l.nome}${quem}`, porque: `Lead novo há ${plural(l.dias, 'dia', 'dias')} sem contato${moto}.`, refTipo: 'LEAD', refId: l.id, estagioNaHora: l.estagio }
    if (l.estagio === 'PROPOSTA') return { tipo: 'FOLLOW_UP', texto: `Follow-up da proposta de ${l.nome}${quem}`, porque: `Proposta parada há ${plural(l.dias, 'dia', 'dias')}${moto}. Pergunte o que falta para decidir.`, refTipo: 'LEAD', refId: l.id, estagioNaHora: l.estagio }
    if (l.estagio === 'NEGOCIACAO') return { tipo: 'FOLLOW_UP', texto: `Retomar a negociação com ${l.nome}${quem}`, porque: `Sem movimento há ${plural(l.dias, 'dia', 'dias')}${moto}.`, refTipo: 'LEAD', refId: l.id, estagioNaHora: l.estagio }
    return { tipo: 'REATIVAR', texto: `Puxar ${l.nome}${quem} para a próxima etapa`, porque: `Abordado há ${plural(l.dias, 'dia', 'dias')} sem avanço${moto}. Faça uma pergunta de diagnóstico.`, refTipo: 'LEAD', refId: l.id, estagioNaHora: l.estagio }
  }
  const leads = f.parados.lista.map(paraLead)
    .sort((a, b) => (efeito[b.tipo] ?? 0) - (efeito[a.tipo] ?? 0))
  const propostas = leads.filter(a => a.tipo === 'FOLLOW_UP').slice(0, 2)
  // Lead novo: o mais recente primeiro (o interesse ainda está quente).
  const diasDe = (a: AcaoPlano) => f.parados.lista.find(l => l.id === a.refId)?.dias ?? 0
  const abordar = leads.filter(a => a.tipo === 'ABORDAR').sort((a, b) => diasDe(a) - diasDe(b)).slice(0, 2)
  const outros = leads.filter(a => a.tipo === 'REATIVAR').slice(0, 1)
  const ordemLeads = (efeito.FOLLOW_UP ?? 0) >= (efeito.ABORDAR ?? 0) ? [...propostas, ...abordar] : [...abordar, ...propostas]
  acoes.push(...ordemLeads, ...outros)
  if (f.pessoa.tipo === 'EQUIPE' && f.equipe) {
    const precisa = [...f.equipe].sort((a, b) => a.indice - b.indice)[0]
    if (precisa && precisa.indice < 70) acoes.push({ tipo: 'EQUIPE', texto: `Conversar com ${precisa.nome} sobre a carteira`, porque: `Menor índice de execução da equipe hoje (${precisa.indice}): ${plural(precisa.parados, 'lead parado', 'leads parados')}.`, refTipo: 'VENDEDOR', refId: precisa.vendedorId })
  }
  for (const t of f.agenda.hoje.slice(0, 2)) acoes.push({ tipo: 'AGENDA', texto: t.titulo, porque: t.horario ? `Tarefa da agenda de hoje, às ${t.horario}.` : 'Tarefa da agenda de hoje.', refTipo: 'AGENDA', refId: t.id })
  acoes.splice(6)
  acoes.push({ tipo: 'ESTUDO', texto: `${minutosEstudo} minutos de estudo: ${COMPETENCIAS[foco].nome.toLowerCase()}`, porque: `É o ponto que mais apareceu nos seus números. A trilha de estudo tem o material.` })
  return acoes
}
